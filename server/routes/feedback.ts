/**
 * Feedback Routes
 *
 * Post-event feedback and feedback summaries.
 *
 *   POST   /itineraries/:id/post-event-feedback           — submit post-event feedback
 *   GET    /groups/:groupId/feedback-summary               — RSVP feedback summary
 *   GET    /groups/:groupId/post-event-feedback-summary    — post-event feedback summary
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { safeParse } from "../validation-middleware";
import { postEventFeedbackSchema } from "../validation-schemas";
import { triggerInsightUpdate } from "../insight-triggers";
import { fail } from "../lib/responses";
import {
  rsvps as rsvpsTable,
  itineraries,
  itineraryItems,
  groups as groupsTable,
} from "@shared/schema";

const router = Router();

router.post("/itineraries/:id/post-event-feedback", isAuthenticated, async (req: any, res) => {
  try {
    const validatedData = safeParse(postEventFeedbackSchema, req.body, res);
    if (!validatedData) {
      return;
    }

    const userId = await getUserId(req);
    const { itineraryId } = { itineraryId: req.params.id };
    const {
      actuallyAttended,
      didNotAttendReason,
      overallRating,
      venueRating,
      budgetRating,
      activityFit,
      timingRating,
      frequencyPreference,
      notes,
      wouldReturnToVenue,
      venueVibe,
      groupEnjoyment,
      activityMatch,
      timingFeedback,
      improvementNotes,
      wouldDoAgain
    } = validatedData;

    const [itinerary] = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.id, itineraryId))
      .limit(1);

    if (!itinerary) {
      return fail(res, 404, "Event not found");
    }

    let group = null;
    let isGroupOwner = false;
    let isEventOrganizer = false;

    if (itinerary.groupId) {
      group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return fail(res, 404, "Group not found");
      }
      isGroupOwner = group.userId === userId;
    } else {
      isEventOrganizer = itinerary.organizerId === userId;
    }

    let rsvp = await db
      .select()
      .from(rsvpsTable)
      .where(
        and(
          eq(rsvpsTable.itineraryId, itineraryId),
          eq(rsvpsTable.userId, userId)
        )
      )
      .limit(1);

    if ((!rsvp || rsvp.length === 0) && (isGroupOwner || isEventOrganizer)) {
      rsvp = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          userId,
          response: 'yes',
          isGuest: false,
        })
        .returning();
    }

    if (!rsvp || rsvp.length === 0) {
      return fail(res, 404, "RSVP not found. You must RSVP to an event before leaving feedback.");
    }

    const feedbackData: any = {
      actuallyAttended,
      submittedAt: new Date().toISOString(),
    };

    if (!actuallyAttended && didNotAttendReason) {
      feedbackData.didNotAttendReason = didNotAttendReason;
    }
    if (actuallyAttended) {
      if (overallRating) feedbackData.overallRating = overallRating;
      if (venueRating) feedbackData.venueRating = venueRating;
      if (budgetRating) feedbackData.budgetRating = budgetRating;
      if (activityFit) feedbackData.activityFit = activityFit;
      if (timingRating) feedbackData.timingRating = timingRating;
      if (frequencyPreference) feedbackData.frequencyPreference = frequencyPreference;
      if (notes) feedbackData.notes = notes;
      if (wouldReturnToVenue) feedbackData.wouldReturnToVenue = wouldReturnToVenue;
      if (venueVibe) feedbackData.venueVibe = venueVibe;
      if (groupEnjoyment) feedbackData.groupEnjoyment = groupEnjoyment;
      if (activityMatch) feedbackData.activityMatch = activityMatch;
      if (timingFeedback) feedbackData.timingFeedback = timingFeedback;
      if (improvementNotes) feedbackData.improvementNotes = improvementNotes;
      if (wouldDoAgain) feedbackData.wouldDoAgain = wouldDoAgain;
    }

    const updated = await db
      .update(rsvpsTable)
      .set({
        postEventFeedback: feedbackData,
        updatedAt: new Date(),
      })
      .where(eq(rsvpsTable.id, rsvp[0].id))
      .returning();

    const shouldBlacklistVenue =
      (venueRating !== undefined && venueRating !== null && venueRating <= 2) ||
      wouldReturnToVenue === 'no' ||
      wouldDoAgain === 'no';

    if (itinerary.groupId) {
      if (actuallyAttended && shouldBlacklistVenue) {
        try {
          const fetchedItems = await db
            .select()
            .from(itineraryItems)
            .where(eq(itineraryItems.itineraryId, itineraryId));

          for (const item of fetchedItems) {
            if (item.venueName) {
              const reason = venueRating && venueRating <= 2
                ? `lowRating:${venueRating}`
                : wouldReturnToVenue === 'no'
                  ? 'wouldNotReturn'
                  : 'wouldNotDoAgain';
              console.log(`Auto-blacklisting venue "${item.venueName}" (reason: ${reason})`);
              await storage.addRejectedVenue(itinerary.groupId, item.venueName);
            }
          }
        } catch (error) {
          console.error('[Auto-blacklist] Error adding rejected venue:', error);
        }
      }

      if (timingRating && timingRating !== 3) {
        const timingDescription = timingRating <= 2 ? 'too_early' : 'too_late';
        console.log(`[Timing Feedback] Group ${itinerary.groupId}: ${timingDescription} (rating: ${timingRating})`);
      } else if (timingFeedback && timingFeedback !== 'just_right') {
        console.log(`[Timing Feedback] Group ${itinerary.groupId}: ${timingFeedback}`);
      }

      if (activityFit && activityFit <= 2) {
        console.log(`[Activity Feedback] Group ${itinerary.groupId}: wants different activities (fit rating: ${activityFit})`);
      } else if (activityMatch === 'try_something_different') {
        console.log(`[Activity Feedback] Group ${itinerary.groupId}: wants different activities`);
      }

      if (budgetRating && budgetRating <= 2) {
        console.log(`[Budget Feedback] Group ${itinerary.groupId}: too expensive (rating: ${budgetRating})`);
      }

      triggerInsightUpdate(itinerary.groupId, 'post-event-feedback').catch(err => {
        console.error(`[Post Event Feedback] Insight update failed:`, err);
      });

      const { analyzeAndAdjustFrequency } = await import('../frequency-adjuster');
      analyzeAndAdjustFrequency(itinerary.groupId).then(result => {
        if (result && result.applied) {
          console.log(`[Frequency Adjuster] ${result.reason}`);
        } else if (result) {
          console.log(`[Frequency Adjuster] ${result.reason}`);
        }
      }).catch(err => {
        console.error(`[Frequency Adjuster] Error:`, err);
      });
    }

    res.json(updated[0]);
  } catch (error: any) {
    console.error('[Post Event Feedback] Error:', error);
    fail(res, 500, safeError(error));
  }
});

router.get("/groups/:groupId/feedback-summary", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    if (!group) {
      return fail(res, 404, "Group not found");
    }
    if (group.userId !== userId) {
      return fail(res, 403, "Not authorized to view this group's feedback");
    }

    const itinerariesData = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.groupId, groupId));

    const itineraryIds = itinerariesData.map(i => i.id);

    if (itineraryIds.length === 0) {
      return res.json({
        totalResponses: 0,
        budgetConcerns: 0,
        timeConcerns: 0,
        locationConcerns: 0,
        activityTypeConcerns: 0,
        otherConcerns: 0,
        recentFeedback: [],
      });
    }

    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)}) AND rsvp_feedback IS NOT NULL AND (is_guest IS NULL OR is_guest = false)`);

    let budgetConcerns = 0;
    let timeConcerns = 0;
    let locationConcerns = 0;
    let activityTypeConcerns = 0;
    let otherConcerns = 0;

    const recentFeedback: any[] = [];

    for (const rsvp of rsvps) {
      const feedback = rsvp.rsvpFeedback as any;
      if (!feedback) continue;

      if (feedback.budgetConcern) budgetConcerns++;
      if (feedback.timeConcern) timeConcerns++;
      if (feedback.locationConcern) locationConcerns++;
      if (feedback.activityTypeConcern) activityTypeConcerns++;
      if (feedback.otherConcern) otherConcerns++;

      if (feedback.notes) {
        const itinerary = itinerariesData.find(i => i.id === rsvp.itineraryId);
        recentFeedback.push({
          id: rsvp.id,
          itineraryName: itinerary?.name || 'Event',
          response: rsvp.response,
          feedback,
          createdAt: rsvp.createdAt,
        });
      }
    }

    recentFeedback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limitedFeedback = recentFeedback.slice(0, 10);

    res.json({
      totalResponses: rsvps.length,
      budgetConcerns,
      timeConcerns,
      locationConcerns,
      activityTypeConcerns,
      otherConcerns,
      recentFeedback: limitedFeedback,
    });
  } catch (error: any) {
    console.error('[Get Feedback Summary] Error:', error);
    fail(res, 500, safeError(error));
  }
});

router.get("/groups/:groupId/post-event-feedback-summary", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    if (!group) {
      return fail(res, 404, "Group not found");
    }
    if (group.userId !== userId) {
      return fail(res, 403, "Not authorized to view this group's feedback");
    }

    const itinerariesData = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.groupId, groupId));

    const itineraryIds = itinerariesData.map(i => i.id);

    if (itineraryIds.length === 0) {
      return res.json({
        totalResponses: 0,
        averageRating: 0,
        moreFrequent: 0,
        justRight: 0,
        lessFrequent: 0,
        wouldDoAgainYes: 0,
        wouldDoAgainMaybe: 0,
        wouldDoAgainNo: 0,
        recentComments: [],
      });
    }

    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)}) AND post_event_feedback IS NOT NULL AND (is_guest IS NULL OR is_guest = false)`);

    let totalRating = 0;
    let ratingCount = 0;
    let moreFrequent = 0;
    let justRight = 0;
    let lessFrequent = 0;
    let wouldDoAgainYes = 0;
    let wouldDoAgainMaybe = 0;
    let wouldDoAgainNo = 0;

    const recentComments: any[] = [];

    for (const rsvp of rsvps) {
      const feedback = rsvp.postEventFeedback as any;
      if (!feedback) continue;

      if (feedback.venueRating) {
        totalRating += feedback.venueRating;
        ratingCount++;
      }

      if (feedback.frequencyPreference === 'more_frequent') moreFrequent++;
      if (feedback.frequencyPreference === 'just_right') justRight++;
      if (feedback.frequencyPreference === 'less_frequent') lessFrequent++;

      if (feedback.wouldDoAgain === 'yes') wouldDoAgainYes++;
      if (feedback.wouldDoAgain === 'maybe') wouldDoAgainMaybe++;
      if (feedback.wouldDoAgain === 'no') wouldDoAgainNo++;

      if (feedback.improvementNotes && feedback.improvementNotes.trim()) {
        const itinerary = itinerariesData.find(i => i.id === rsvp.itineraryId);
        recentComments.push({
          id: rsvp.id,
          itineraryName: itinerary?.name || 'Event',
          rating: feedback.venueRating,
          notes: feedback.improvementNotes,
          submittedAt: feedback.submittedAt || rsvp.createdAt,
        });
      }
    }

    recentComments.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const limitedComments = recentComments.slice(0, 10);

    res.json({
      totalResponses: rsvps.length,
      averageRating: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0,
      moreFrequent,
      justRight,
      lessFrequent,
      wouldDoAgainYes,
      wouldDoAgainMaybe,
      wouldDoAgainNo,
      recentComments: limitedComments,
    });
  } catch (error: any) {
    console.error('[Get Post Event Feedback Summary] Error:', error);
    fail(res, 500, safeError(error));
  }
});

export default router;
