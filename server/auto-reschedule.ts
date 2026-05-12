/**
 * Auto-Reschedule Module
 *
 * Extracted from server/routes.ts (was an inline function inside registerRoutes).
 * Handles automatic rescheduling of itineraries when RSVP feedback indicates
 * most members can't make the current time.
 */

import { db } from "./db";
import { storage } from "./storage";
import {
  rsvps as rsvpsTable,
  itineraryInvites,
  itineraries,
  type ItineraryItem,
} from "@shared/schema";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// RSVP response normalization helpers
// ---------------------------------------------------------------------------

function normalizeRsvpResponse(response: string | null | undefined): 'yes' | 'maybe' | 'no' | null {
  if (!response) return null;
  const r = response.toLowerCase();
  if (r === 'yes' || r === 'going') return 'yes';
  if (r === 'maybe') return 'maybe';
  if (r === 'no' || r === 'not_going') return 'no';
  return null;
}

function isPositiveRsvp(response: string | null | undefined): boolean {
  return normalizeRsvpResponse(response) === 'yes';
}

function isTentativeRsvp(response: string | null | undefined): boolean {
  return normalizeRsvpResponse(response) === 'maybe';
}

function isNegativeRsvp(response: string | null | undefined): boolean {
  return normalizeRsvpResponse(response) === 'no';
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function checkAndReschedule(itineraryId: string): Promise<void> {
  try {
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.eventDate || !itinerary.groupId) {
      return;
    }

    const rescheduleAttempts = itinerary.rescheduleAttempts || 0;
    if (rescheduleAttempts >= 2) {
      return;
    }

    // Get all RSVPs (exclude guests)
    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId} AND (is_guest IS NULL OR is_guest = false)`);

    if (rsvps.length === 0) {
      return;
    }

    const yesCount = rsvps.filter(r => isPositiveRsvp(r.response)).length;
    const maybeCount = rsvps.filter(r => isTentativeRsvp(r.response)).length;
    const noCount = rsvps.filter(r => isNegativeRsvp(r.response)).length;
    const totalResponses = rsvps.length;

    const negativeResponses = noCount + maybeCount;
    const shouldReschedule = totalResponses >= 3 && (negativeResponses / totalResponses) > 0.5;

    if (!shouldReschedule) {
      return;
    }

    // ATOMIC: Try to acquire reschedule lock
    const lockAcquired = await db
      .update(itineraries)
      .set({
        autoScheduleConfig: sql`
          CASE 
            WHEN (auto_schedule_config->>'rescheduleInProgress')::boolean IS NOT TRUE
            THEN jsonb_set(COALESCE(auto_schedule_config, '{}'::jsonb), '{rescheduleInProgress}', 'true'::jsonb)
            ELSE auto_schedule_config
          END
        `,
      })
      .where(sql`
        id = ${itineraryId} 
        AND (auto_schedule_config->>'rescheduleInProgress')::boolean IS NOT TRUE
      `)
      .returning();

    if (lockAcquired.length === 0) {
      return;
    }

    // Analyze feedback patterns
    interface RsvpFeedback {
      tryEarlier?: boolean;
      tryLater?: boolean;
      notThisWeek?: boolean;
      unavailableOn?: string[];
    }
    const feedback = rsvps
      .map(r => r.rsvpFeedback as RsvpFeedback | null)
      .filter((f): f is RsvpFeedback => f != null);

    const constraints = {
      avoidDays: [] as string[],
      preferEarlier: 0,
      preferLater: 0,
      avoidThisWeek: false,
    };

    for (const f of feedback) {
      if (f.tryEarlier) constraints.preferEarlier++;
      if (f.tryLater) constraints.preferLater++;
      if (f.notThisWeek) constraints.avoidThisWeek = true;
      if (f.unavailableOn && Array.isArray(f.unavailableOn)) {
        constraints.avoidDays.push(...f.unavailableOn);
      }
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return;
    }

    const venueInfo = itinerary.items.map((item: any) => ({
      name: item.venueName,
      type: item.venueType,
    }));

    const { generateOptimalTime } = await import('./ai-time-picker');
    let result;

    try {
      result = await generateOptimalTime(
        venueInfo,
        group.availability || {},
        {
          avoidDays: constraints.avoidDays,
          preferEarlier: constraints.preferEarlier > constraints.preferLater,
          preferLater: constraints.preferLater > constraints.preferEarlier,
          avoidThisWeek: constraints.avoidThisWeek,
        },
        group.locationBase
      );
    } catch (aiError) {
      console.error(`[Auto-Reschedule] AI time picker failed:`, aiError);
      await storage.updateItinerary(itineraryId, {
        autoScheduleConfig: {
          ...(itinerary.autoScheduleConfig as object || {}),
          rescheduleInProgress: false,
        },
      });
      return;
    }

    if (!result.suggestedTime) {
      await storage.updateItinerary(itineraryId, {
        autoScheduleConfig: {
          ...(itinerary.autoScheduleConfig as object || {}),
          rescheduleInProgress: false,
        },
      });
      return;
    }

    const newEventDate = new Date(result.suggestedTime);
    await storage.updateItinerary(itineraryId, {
      eventDate: newEventDate,
      rescheduleAttempts: rescheduleAttempts + 1,
      autoScheduleConfig: {
        ...(itinerary.autoScheduleConfig as object || {}),
        lastRescheduleReason: result.reasoning,
        rescheduleInProgress: false,
      },
    });

    // Clear all existing RSVPs
    await db
      .delete(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId}`);

    const members = await storage.getGroupMembers(group.id);

    // Delete old invite tokens
    await db
      .delete(itineraryInvites)
      .where(sql`itinerary_id = ${itineraryId}`);

    // Create new invite tokens for each member
    const memberInvites = new Map<string, string>();
    for (const member of members) {
      const inviteToken = crypto.randomUUID();
      await db.insert(itineraryInvites).values({
        itineraryId,
        memberId: member.id,
        inviteToken,
      });
      memberInvites.set(member.id, inviteToken);
    }

    // Send reschedule emails
    for (const member of members) {
      if (!member.email) continue;
      const inviteToken = memberInvites.get(member.id);
      if (!inviteToken) continue;

      try {
        const primaryDomain = 'kinmo.ai';
        const rsvpLink = `https://${primaryDomain}/rsvp/${itineraryId}/${inviteToken}`;

        const { sendItineraryReschedule } = await import('./email-service');
        await sendItineraryReschedule(
          { email: member.email, name: member.name || 'Member' },
          {
            groupName: group.name,
            eventDate: newEventDate.toLocaleDateString(),
            eventTime: newEventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            venues: itinerary.items.map((item: ItineraryItem) => ({
              name: item.venueName || 'Venue',
              type: item.venueType || 'Activity',
            })),
            reason: result.reasoning,
            rsvpLink,
          }
        );
      } catch (emailError) {
        console.error(`[Auto-Reschedule] Failed to send email to ${member.email}:`, emailError);
      }
    }

  } catch (error) {
    console.error(`[Auto-Reschedule] Error:`, error);
  }
}
