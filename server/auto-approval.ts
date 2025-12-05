/**
 * Auto-Approval Logic for Auto-Scheduled Events
 * Handles both manual organizer selection and automatic high-confidence approvals
 */

import { storage } from './storage';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { autoScheduledEvents, itineraryInvites, itineraries } from '../shared/schema';
import crypto from 'crypto';
import { calculateAdaptiveTimeline, calculateRsvpDeadline } from './adaptive-timeline';
import { sendInitialInvites } from './reminder-scheduler';

export interface ApprovalResult {
  success: boolean;
  itinerary?: any;
  error?: string;
}

/**
 * Approve an auto-scheduled event option and create the itinerary
 * Used by both manual selection endpoint and auto-approval job
 *
 * @param eventId - ID of the auto-scheduled event
 * @param optionId - ID of the option to approve (if null, selects top-voted or Option 1)
 * @param source - 'manual' or 'auto' (for logging/status tracking)
 * @returns ApprovalResult with itinerary or error
 */
export async function approveAndCreateItinerary(
  eventId: string,
  optionId: string | null,
  source: 'manual' | 'auto' = 'manual'
): Promise<ApprovalResult> {
  try {
    // Get the auto event
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Get the group
    const group = await storage.getGroup(event.groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    // Fetch members for logging
    const members = await storage.getGroupMembers(event.groupId);

    let itinerary: any;

    // Check if itinerary already exists (new flow creates it upfront)
    // If it does, we can skip the options logic entirely
    if (event.itineraryId) {
      console.log(`[Auto-Approval] Itinerary already exists (${event.itineraryId}), updating status to approved`);

      // Calculate adaptive timeline for auto-send configuration
      const eventDate = new Date(event.proposedDate);
      const now = new Date();
      const adaptiveConfig = calculateAdaptiveTimeline(eventDate, now);
      const rsvpDeadline = calculateRsvpDeadline(eventDate, adaptiveConfig);

      console.log(`[Auto-Approval] Using ${adaptiveConfig.timelineType} timeline: ${adaptiveConfig.reasoning}`);

      // Update existing itinerary status to approved with autoScheduleConfig
      await db
        .update(itineraries)
        .set({
          status: source === 'auto' ? 'auto_approved' : 'approved',
          autoScheduleConfig: adaptiveConfig,
          rsvpDeadline,
        })
        .where(eq(itineraries.id, event.itineraryId));

      // Update the auto event status
      await db
        .update(autoScheduledEvents)
        .set({
          status: source === 'auto' ? 'auto_approved' : 'approved',
        })
        .where(eq(autoScheduledEvents.id, eventId));

      // Fetch the updated itinerary
      itinerary = await storage.getItinerary(event.itineraryId);

      // Send invites if not already sent
      if (!itinerary.inviteSentAt) {
        console.log(`[Auto-Approval] Sending invites for ${group.name}`);
        await sendInitialInvites(itinerary, group);
      } else {
        console.log(`[Auto-Approval] Invites already sent, skipping`);
      }
    } else {
      // Old flow: Need to use options to create itinerary
      console.log(`[Auto-Approval] Creating new itinerary from options (legacy flow)`);

      // If no optionId provided, determine the best option
      let selectedOptionId = optionId;
      if (!selectedOptionId) {
        selectedOptionId = await determineTopOption(eventId);
        if (!selectedOptionId) {
          return { success: false, error: 'No options available' };
        }
      }

      // Verify option exists and belongs to this event
      const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');
      const [option] = await db
        .select()
        .from(itineraryOptionsTable)
        .where(eq(itineraryOptionsTable.id, selectedOptionId));

      if (!option || option.autoEventId !== eventId) {
        return { success: false, error: 'Invalid option' };
      }

      // Update the auto event with the selected option
      await db
        .update(autoScheduledEvents)
        .set({
          selectedOptionId,
          status: source === 'auto' ? 'auto_approved' : 'approved',
        })
        .where(eq(autoScheduledEvents.id, eventId));

      // Extract venue information from the selected option
      const venues = option.venues as Array<{
        sourceType: 'activity' | 'voting_event';
        sourceId: string;
        venueName: string;
        badges: string[];
      }>;

      // Check if an itinerary already exists for this group/date (prevent duplicates)
      const eventDateStr = new Date(event.proposedDate).toISOString().split('T')[0];
      const { sql } = await import('drizzle-orm');
      const existingItineraries = await db
        .select()
        .from(itineraries)
        .where(and(
          eq(itineraries.groupId, event.groupId),
          sql`DATE(${itineraries.eventDate}) = ${eventDateStr}`
        ));

      if (existingItineraries.length > 0) {
        // Itinerary already exists for this date - reuse it
        itinerary = existingItineraries[0];
        console.log(`[Auto-Approval] Itinerary already exists for ${group.name} on ${eventDateStr}, reusing ${itinerary.id}`);
      } else {
        // Create new itinerary
        const venueItems = venues.map(v => ({
          sourceType: v.sourceType,
          sourceId: v.sourceId,
        }));

        itinerary = await storage.createItinerary(
          {
            groupId: event.groupId,
            name: group.name,
            eventDate: event.proposedDate,
            status: 'proposed',
            proposedOrder: [],
          },
          group.userId!,
          venueItems
        );
      }

      // Update the event with the itinerary ID
      await db
        .update(autoScheduledEvents)
        .set({ itineraryId: itinerary.id })
        .where(eq(autoScheduledEvents.id, eventId));

      // Create invites for all group members
      console.log(`[Auto-Approval] Creating invites for ${members.length} members in group ${group.name}`);

      for (const member of members) {
        const inviteToken = crypto.randomUUID();

        await db.insert(itineraryInvites).values({
          itineraryId: itinerary.id,
          memberId: member.id,
          inviteToken,
        });
      }

      // Calculate adaptive timeline and update itinerary with config
      const eventDate = new Date(event.proposedDate);
      const now = new Date();
      const adaptiveConfig = calculateAdaptiveTimeline(eventDate, now);
      const rsvpDeadline = calculateRsvpDeadline(eventDate, adaptiveConfig);

      console.log(`[Auto-Approval] Using ${adaptiveConfig.timelineType} timeline: ${adaptiveConfig.reasoning}`);

      await db
        .update(itineraries)
        .set({
          autoScheduleConfig: adaptiveConfig,
          rsvpDeadline,
        })
        .where(eq(itineraries.id, itinerary.id));

      // Send initial invites
      itinerary = await storage.getItinerary(itinerary.id); // Refresh to get updated data
      await sendInitialInvites(itinerary, group);
    }

    console.log(`[Auto-Approval] ${source === 'auto' ? '🤖 AUTO' : '👤 MANUAL'} approval for event ${eventId}:`, {
      itineraryId: itinerary?.id,
      itineraryName: itinerary?.name,
      confidence: event.confidenceScore,
      memberCount: members.length,
    });

    return {
      success: true,
      itinerary,
    };
  } catch (error: any) {
    console.error(`[Auto-Approval] Error approving event ${eventId}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Determine the top option based on votes, or fallback to Option 1
 *
 * @param eventId - ID of the auto-scheduled event
 * @returns Option ID to select, or null if none available
 */
async function determineTopOption(eventId: string): Promise<string | null> {
  try {
    const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import('../shared/schema');

    // Get all options for this event
    const options = await db
      .select()
      .from(itineraryOptionsTable)
      .where(eq(itineraryOptionsTable.autoEventId, eventId))
      .orderBy(itineraryOptionsTable.optionNumber);

    if (options.length === 0) {
      return null;
    }

    // Get vote counts for each option
    const optionsWithVotes = await Promise.all(
      options.map(async (option: any) => {
        const votes = await db
          .select()
          .from(itineraryOptionVotes)
          .where(eq(itineraryOptionVotes.optionId, option.id));

        return {
          ...option,
          voteCount: votes.length,
        };
      })
    );

    // Sort by vote count (highest first), then by option number (lowest first)
    optionsWithVotes.sort((a: any, b: any) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return a.optionNumber - b.optionNumber;
    });

    // Return top-voted option (or Option 1 if no votes)
    return optionsWithVotes[0].id;
  } catch (error) {
    console.error('[Auto-Approval] Error determining top option:', error);
    return null;
  }
}
