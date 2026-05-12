/**
 * Auto-Scheduling Routes
 *
 * Trigger, manage, and approve auto-scheduled events for groups.
 *
 *   POST   /api/groups/:id/trigger-auto-schedule           — manually trigger auto-schedule
 *   POST   /api/groups/:id/maintain-event-pipeline          — maintain event pipeline
 *   DELETE /api/groups/:id/auto-scheduled-events            — clear pending auto-scheduled events
 *   GET    /api/groups/:groupId/auto-scheduled-events       — get pending auto-scheduled events
 *   GET    /api/groups/:groupId/auto-scheduled-events/timeline — get events timeline
 *   GET    /api/groups/:groupId/auto-schedule-queue          — get auto-schedule queue
 *   POST   /api/groups/:groupId/auto-schedule-queue/regenerate — regenerate a queue event
 *   POST   /api/groups/:groupId/auto-schedule-queue/approve   — approve a queue event
 *   GET    /api/groups/:groupId/pending-auto-event           — get pending auto event
 *   POST   /api/auto-schedule/:id/approve                    — approve/finalize pending event
 *   POST   /api/frequency-feedback                           — submit frequency feedback
 *   POST   /api/groups/:groupId/schedule-next-event          — manually schedule next event
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { requireGroupOwnership, getUserId } from "../authorization";
import { storage } from "../storage";
import { itineraries } from "@shared/schema";

const router = Router();

// ==================== Trigger Auto-Schedule ====================

// Trigger auto-schedule for a group (manually create pending event if within window)
router.post("/groups/:id/trigger-auto-schedule", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({
          message: "Auto-scheduling not enabled",
          code: "AUTO_SCHEDULE_DISABLED",
          suggestion: "Enable auto-scheduling in group settings, or use manual event creation"
        });
      }

      if (!group.userId) {
        return res.status(400).json({
          message: "Group must have an owner",
          code: "NO_OWNER"
        });
      }

      // Check if there's already a pending auto-event
      const existingPendingEvents = await storage.getPendingAutoScheduledEvents(req.params.id);
      if (existingPendingEvents.length > 0) {
        return res.status(200).json({
          message: "Event already exists",
          event: existingPendingEvents[0]
        });
      }

      // Check for existing proposed/scheduled itineraries (regular events, not auto-scheduled)
      const existingItineraries = await storage.getGroupItineraries(req.params.id);
      const existingProposedOrScheduled = existingItineraries.filter(i =>
        i.status === 'proposed' || i.status === 'scheduled'
      );

      // Import auto-scheduler functions
      const { shouldTriggerAutoSchedule, selectBestItineraryForAutoSchedule } = await import('../auto-scheduler.js');
      const { suggestOptimalTime } = await import('../ai-time-picker.js');

      const hasPendingEvent = existingPendingEvents.length > 0;

      // Check if we should trigger (within 10-day window)
      // For high-cadence groups with existing events, we'll still generate new options
      // but return both to the frontend for user to choose
      const canTrigger = await shouldTriggerAutoSchedule(storage, group, hasPendingEvent);

      if (!canTrigger && existingProposedOrScheduled.length === 0) {
        // Not within window and no existing events - just return error
        return res.status(400).json({
          message: "Not within 10-day creation window",
          nextEventDueDate: group.nextEventDueDate
        });
      }

      // If there are existing proposed/scheduled events, generate new options anyway
      // and return both to the frontend
      const shouldGenerateNewEvent = canTrigger || existingProposedOrScheduled.length > 0;

      // Check if auto-itinerary creation is enabled
      // If not, we can only use existing saved itineraries
      let selection;

      if (group.autoItineraryEnabled) {
        // Auto-create itinerary combinations from activities/favorites

        selection = await selectBestItineraryForAutoSchedule(storage, group);
      } else {
        // Auto-itinerary disabled - only use existing saved itineraries

        const savedItineraries = existingItineraries.filter(i => i.isSaved && i.status === 'saved');

        if (savedItineraries.length === 0) {
          return res.status(400).json({
            message: "Auto-itinerary creation is disabled. Please create and save an itinerary first, or enable auto-itinerary creation in group settings.",
            suggestion: "Enable 'Auto-create itineraries' in group settings to let AI combine your activities automatically."
          });
        }

        // Use the most recently saved itinerary
        const mostRecent = savedItineraries.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        selection = { itineraryId: mostRecent.id };
      }

      if (!selection) {
        return res.status(400).json({
          message: "No venues available for AI scheduling",
          code: "NO_VENUES",
          suggestion: "Add some favorite venues or activities first, then try again"
        });
      }

      let itineraryId: string | null;

      // If we selected an existing itinerary, duplicate it manually
      if ('itineraryId' in selection && selection.itineraryId) {
        const originalItinerary = await storage.getItinerary(selection.itineraryId);
        if (!originalItinerary) {
          return res.status(404).json({ message: "Selected itinerary not found" });
        }

        // Clean up any existing draft itineraries before creating a new one
        await db.delete(itineraries).where(
          and(
            eq(itineraries.groupId, group.id),
            eq(itineraries.status, "draft"),
            eq(itineraries.isSaved, false)
          )
        );

        // Manually duplicate by creating new itinerary with same items
        const originalItems = originalItinerary.items;
        const duplicatedItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            status: "draft",
            proposedOrder: [],
          },
          group.userId,
          originalItems
            .filter(item => item.sourceId !== null)
            .map(item => ({
              sourceType: item.sourceType as 'activity' | 'voting_event' | 'ad_hoc',
              sourceId: item.sourceId!
            }))
        );
        itineraryId = duplicatedItinerary.id;
      } else if ('selectedVenues' in selection && selection.selectedVenues) {
        // Clean up any existing draft itineraries before creating a new one
        await db.delete(itineraries).where(
          and(
            eq(itineraries.groupId, group.id),
            eq(itineraries.status, "draft"),
            eq(itineraries.isSaved, false)
          )
        );

        // Create new itinerary from selected activities
        const proposedOrder = selection.selectedVenues.map(v => v.sourceId);
        const newItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            status: "draft",
            proposedOrder,
          },
          group.userId,
          selection.selectedVenues.map(venue => ({
            sourceType: 'activity' as const,
            sourceId: venue.sourceId
          }))
        );
        itineraryId = newItinerary.id;
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // NEW FLOW: Store options and create itinerary immediately for top option
        // This allows users to view/edit the event before approval

        const topOption = selection.options[0];
        const venueItems = topOption.venues.map((v: any) => ({
          sourceType: v.sourceType as 'activity' | 'voting_event',
          sourceId: v.sourceId,
        }));

        // Create itinerary immediately with "proposed" status
        const newItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            eventDate: null, // Will be set after AI time suggestion
            status: 'proposed',
            proposedOrder: [],
          },
          group.userId!,
          venueItems
        );
        itineraryId = newItinerary.id;

        // Create invites for all group members so event is visible
        const members = await storage.getGroupMembers(group.id);
        const { itineraryInvites } = await import('@shared/schema');
        const crypto = await import('crypto');

        for (const member of members) {
          const inviteToken = crypto.randomUUID();
          await db.insert(itineraryInvites).values({
            itineraryId: newItinerary.id,
            memberId: member.id,
            inviteToken,
          });
        }

      } else {
        return res.status(400).json({ message: "No valid selection" });
      }

      // Validate and optimize itinerary ordering using AI (only if itinerary was created)
      if (itineraryId) {

        try {
          const { validateItinerary } = await import('../itinerary-validation.js');
          const itineraryWithItems = await storage.getItinerary(itineraryId);
          if (!itineraryWithItems) {
            throw new Error('Itinerary not found for validation');
          }
          const itineraryItems = itineraryWithItems.items;

          // Prepare venues for validation
          const venuesForValidation = itineraryItems
            .filter(item => item.sourceId !== null)
            .map(item => ({
              sourceType: item.sourceType as 'activity' | 'voting_event' | 'ad_hoc',
              sourceId: item.sourceId!,
              venueName: item.venueName,
              venueType: item.venueType,
              venueAddress: item.venueAddress,
              googlePlaceId: item.googlePlaceId,
              location: item.latitude && item.longitude ? {
                lat: parseFloat(item.latitude),
                lng: parseFloat(item.longitude)
              } : undefined
            }));

          // Get AI-validated order
          const validation = await validateItinerary(venuesForValidation);

          if (validation.proposedOrder && validation.proposedOrder.length > 0) {
            // Update itinerary with optimized order
            await db.update(itineraries)
              .set({
                proposedOrder: validation.proposedOrder,
                aiValidationNotes: validation.validationNotes || null
              })
              .where(eq(itineraries.id, itineraryId));

          }
        } catch (validationError: any) {
          // Log but don't fail - validation is optional enhancement
          console.error('[Manual Trigger] AI validation failed (continuing anyway):', validationError.message);
        }
      }

      // AI suggests optimal time
      let proposedDate: Date;
      let venues: Array<{ name: string; type: string }> = [];

      // Get venue information (either from itinerary or from options)
      if (itineraryId) {
        const itinerary = await storage.getItinerary(itineraryId);
        if (!itinerary || !itinerary.groupId) {
          return res.status(404).json({ message: "Created itinerary not found" });
        }
        venues = itinerary.items.map((item: any) => ({
          name: item.venueName,
          type: item.venueType,
        }));
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // Use venues from the top option for time suggestion
        const topOption = selection.options[0];
        venues = topOption.venues.map((v: any) => ({
          name: v.venueName,
          type: v.venueType || 'restaurant',
        }));
      } else {
        return res.status(400).json({ message: "No venues available for scheduling" });
      }

      try {

        // Aggregate member availability
        const { aggregateMemberAvailability, convertAvailabilityToText } = await import('../availability-utils');
        const aggregatedAvailability = await aggregateMemberAvailability(group.id, storage);

        // Convert to text format for AI
        const availabilityString = convertAvailabilityToText(
          aggregatedAvailability.grid,
          aggregatedAvailability.conflicts,
          aggregatedAvailability.memberCount
        );

        // Use AI to find optimal time
        const timeResult = await suggestOptimalTime({
          generalAvailability: availabilityString,
          venues,
          location: group.locationBase,
          meetingFrequency: group.meetingFrequency || undefined,
          timezone: group.timezone || undefined,
        });

        proposedDate = timeResult.eventDate;

      } catch (err) {
        console.error('[Manual Trigger] AI time suggestion failed, using fallback:', err);
        proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }

      // Update the itinerary with the proposed date (fixes TBD date bug)
      await storage.updateItinerary(itineraryId, {
        eventDate: proposedDate
      });

      // If there are existing proposed/scheduled events, return both options for user to choose
      if (existingProposedOrScheduled.length > 0) {
        // Get full details of existing events with their items
        const existingEventsWithItems = await Promise.all(
          existingProposedOrScheduled.map(async (event) => {
            const fullEvent = await storage.getItinerary(event.id);
            return {
              ...event,
              items: fullEvent?.items || []
            };
          })
        );

        // Get details of the new event option
        const newItinerary = await storage.getItinerary(itineraryId);

        return res.json({
          hasMultipleOptions: true,
          existingEvents: existingEventsWithItems,
          newEventOption: {
            ...newItinerary,
            items: newItinerary?.items || [],
            proposedDate,
            isNewlyGenerated: true
          },
          message: "Multiple event options available"
        });
      }

      // No existing events - create auto-scheduled event as normal
      const autoSendAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      // Calculate confidence score for the event

      const { calculateEventConfidence } = await import('../confidence-scoring.js');

      // Get venue data for confidence calculation
      let venuesForConfidence: Array<{ sourceType: string; sourceId: string; venueName: string }> = [];

      if (itineraryId) {
        const fullItinerary = await storage.getItinerary(itineraryId);
        venuesForConfidence = fullItinerary?.items.map(item => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId || '',
          venueName: item.venueName,
        })) || [];
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // Use venues from top option for confidence calculation
        const topOption = selection.options[0];
        venuesForConfidence = topOption.venues.map((v: any) => ({
          sourceType: v.sourceType,
          sourceId: v.sourceId,
          venueName: v.venueName,
        }));
      }

      // Calculate member availability for this time
      const { aggregateMemberAvailability } = await import('../availability-utils');
      const availability = await aggregateMemberAvailability(group.id, storage);

      const dayOfWeek = proposedDate.getDay();
      const hour = proposedDate.getHours();
      const timePeriod = hour < 12 ? 'morning' : (hour < 17 ? 'afternoon' : 'evening');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
      const slotKey = `${dayNames[dayOfWeek]}-${timePeriod}` as keyof typeof availability.grid;
      const membersAvailable = (availability.grid as Record<string, number>)[slotKey] || 0;
      const totalMembers = availability.memberCount;

      const confidenceResult = await calculateEventConfidence(
        storage,
        group.id,
        venuesForConfidence,
        proposedDate,
        membersAvailable,
        totalMembers
      );

      // Determine initial status based on confidence
      // ≥80: auto-approve immediately
      // <80: pending_approval (requires organizer review or will auto-send after 48hrs)
      const shouldAutoApprove = confidenceResult.score >= 80;
      const initialStatus = shouldAutoApprove ? 'auto_approved' : 'pending_approval';
      const requiresReview = confidenceResult.score < 60;

      const pendingEvent = await storage.createAutoScheduledEvent({
        groupId: group.id,
        itineraryId,
        proposedDate,
        autoSendAt,
        status: initialStatus,
        confidenceScore: confidenceResult.score,
        confidenceFactors: confidenceResult.factors,
        requiresReview,
        reviewReason: requiresReview ? 'low_confidence' : null,
      });

      // Update itinerary's eventDate with the proposed date
      if (itineraryId) {
        await db.update(itineraries)
          .set({ eventDate: proposedDate })
          .where(eq(itineraries.id, itineraryId));

      }

      // Create itineraryOptions if we have options (for member voting and auto-approval)
      if ('options' in selection && selection.options && selection.options.length > 0) {

        const { itineraryOptions } = await import('@shared/schema');

        for (const option of selection.options) {
          await db.insert(itineraryOptions).values({
            autoEventId: pendingEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues, // Already in correct format from selectBestItineraryForAutoSchedule
            description: option.description,
            // nearbySuggestions not included in selectBestItineraryForAutoSchedule return type
          });
        }

      }

      // If auto-approved (≥80% confidence), immediately create the itinerary
      if (shouldAutoApprove) {

        const { approveAndCreateItinerary } = await import('../auto-approval.js');
        const approvalResult = await approveAndCreateItinerary(
          pendingEvent.id,
          null, // Let it determine best option
          'auto'
        );

        if (approvalResult.success) {

        } else {
          console.error('[Auto-Schedule] ❌ Auto-approval failed:', approvalResult.error);
        }
      } else if (requiresReview) {

      } else {

      }

      res.json({
        hasMultipleOptions: false,
        message: shouldAutoApprove
          ? "Event auto-approved! High confidence match for your group."
          : requiresReview
            ? "Event created but needs your review (low confidence)"
            : "Auto-scheduled event created - awaiting approval",
        event: pendingEvent,
        confidence: {
          score: confidenceResult.score,
          summary: confidenceResult.plainLanguageSummary,
          reasons: confidenceResult.plainLanguageReasons,
        },
      });
    } catch (error: any) {
      console.error('Error triggering auto-schedule:', error);
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Event Pipeline ====================

// Maintain event pipeline for a group (create future events based on cadence)
router.post("/groups/:id/maintain-event-pipeline", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({ message: "Auto-scheduling is not enabled for this group" });
      }

      console.log(`[Event Pipeline] Manually triggered pipeline maintenance for ${group.name}`);

      // Import and call the pipeline maintenance function
      const { maintainEventPipeline } = await import('../auto-scheduler.js');
      const eventsCreated = await maintainEventPipeline(req.params.id, storage);

      return res.status(200).json({
        message: `Pipeline maintenance complete`,
        eventsCreated,
        group: {
          id: group.id,
          name: group.name,
          targetFutureEvents: group.targetFutureEvents,
        }
      });
    } catch (error: any) {
      console.error('Error maintaining event pipeline:', error);
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Clear Auto-Scheduled Events ====================

// Clear all pending auto-scheduled events for a group
router.delete("/groups/:id/auto-scheduled-events", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({ message: "Auto-scheduling is not enabled for this group" });
      }

      console.log(`[Event Pipeline] Clearing pending events for ${group.name}`);

      const deletedCount = await storage.deletePendingAutoEvents(req.params.id);

      return res.status(200).json({
        message: `Cleared ${deletedCount} pending event(s)`,
        deletedCount,
        group: {
          id: group.id,
          name: group.name,
        }
      });
    } catch (error: any) {
      console.error('Error clearing pending events:', error);
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Auto-Schedule Queries ====================

// Get pending auto-scheduled events for a group
router.get("/groups/:groupId/auto-scheduled-events", async (req, res) => {
    try {
      const events = await storage.getPendingAutoScheduledEvents(req.params.groupId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// Get auto-scheduled events timeline for a group (past 90 days + all future)
router.get("/groups/:groupId/auto-scheduled-events/timeline", async (req, res) => {
    try {
      const events = await storage.getAutoScheduledEventsTimeline(req.params.groupId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Auto-Schedule Queue ====================

// Get auto-schedule queue with AI validation
router.get("/groups/:groupId/auto-schedule-queue", async (req, res) => {
    try {
      const { generateAutoScheduleQueue } = await import("../smart-event-pairing");
      const queue = await generateAutoScheduleQueue(req.params.groupId, storage);
      res.json(queue);
    } catch (error: any) {
      console.error('[Auto-Schedule Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

// Regenerate a queue event with different Favorites
router.post("/groups/:groupId/auto-schedule-queue/regenerate", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ message: "eventId is required" });
      }

      console.log('[Regenerate Queue] Regenerating event:', eventId);

      // Track regeneration count in metadata
      const { queueEventMetadata } = await import('../../shared/schema');

      // Check if metadata exists for this event
      const existingMetadata = await db
        .select()
        .from(queueEventMetadata)
        .where(
          and(
            eq(queueEventMetadata.groupId, groupId),
            eq(queueEventMetadata.eventId, eventId)
          )
        )
        .limit(1);

      let regenerationCount = 1;

      if (existingMetadata.length > 0) {
        // Increment existing count
        regenerationCount = existingMetadata[0].regenerationCount + 1;
        await db
          .update(queueEventMetadata)
          .set({
            regenerationCount,
            updatedAt: new Date(),
          })
          .where(eq(queueEventMetadata.id, existingMetadata[0].id));
      } else {
        // Create new metadata entry
        await db.insert(queueEventMetadata).values({
          groupId,
          eventId,
          regenerationCount: 1,
        });
      }

      console.log(`[Regenerate Queue] Regeneration count: ${regenerationCount}`);

      // Get the current queue to extract venues to exclude
      const { generateAutoScheduleQueue, regenerateQueueEvent } = await import("../smart-event-pairing");
      const currentQueue = await generateAutoScheduleQueue(groupId, storage);

      // Find the event being regenerated and extract its venue IDs
      const currentEvent = currentQueue.events.find(e => e.id === eventId);
      const excludeVenueIds = currentEvent?.venues.map(v => v.sourceId) || [];

      console.log('[Regenerate Queue] Excluding venue IDs:', excludeVenueIds);

      // Regenerate the event
      const newEvent = await regenerateQueueEvent(groupId, eventId, excludeVenueIds, storage);

      if (!newEvent) {
        return res.status(500).json({ message: 'Failed to regenerate event' });
      }

      // Add regeneration count to the new event
      const newEventWithCount = {
        ...newEvent,
        regenerationCount,
      };

      // Return updated queue with the new event replacing the old one
      const updatedEvents = currentQueue.events.map(e =>
        e.id === eventId ? newEventWithCount : e
      );

      res.json({ events: updatedEvents });
    } catch (error: any) {
      console.error('[Regenerate Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

// Approve a queue event and create an itinerary
router.post("/groups/:groupId/auto-schedule-queue/approve", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;
      const { queueEvent } = req.body; // Full queue event from frontend

      if (!queueEvent || !queueEvent.venues || queueEvent.venues.length === 0) {
        return res.status(400).json({ message: "Invalid queue event data" });
      }

      console.log('[Approve Queue] Creating itinerary from queue event:', queueEvent.id);

      // Generate name for the itinerary
      const { generateItineraryName } = await import("../ai-itinerary-naming");
      const group = await storage.getGroup(groupId);
      const itineraryName = await generateItineraryName(
        queueEvent.venues.map((v: any) => ({ name: v.venueName, type: v.venueType })),
        group?.locationBase || 'San Francisco'
      );

      // DEDUPLICATION: Check for existing proposed itineraries on the same date
      // This prevents duplicate itineraries if user clicks "Approve" multiple times
      const { deduplicateByDate } = await import('../itinerary-deduplication');
      const proposedEventDate = new Date(queueEvent.scheduledDate);
      await deduplicateByDate(groupId, proposedEventDate, 'Approve Queue');

      // Create proposed order (just the order they appear in the queue)
      const proposedOrder = queueEvent.venues.map((v: any) => v.sourceId);

      // Create the itinerary
      const itinerary = await storage.createItinerary(
        {
          groupId,
          name: itineraryName,
          status: 'proposed',
          eventDate: new Date(queueEvent.scheduledDate),
          aiValidationNotes: `Auto-generated from queue. AI validation score: ${queueEvent.aiValidationScore}/100. ${queueEvent.aiValidationReasoning}`,
          proposedOrder,
        },
        userId,
        queueEvent.venues.map((venue: any) => ({
          sourceType: venue.sourceType,
          sourceId: venue.sourceId,
        }))
      );

      console.log('[Approve Queue] Created itinerary:', itinerary.id);

      // Fetch full itinerary with items
      const fullItinerary = await storage.getItinerary(itinerary.id);

      res.json({
        itinerary: fullItinerary,
        message: 'Event approved and added to proposed itineraries',
      });
    } catch (error: any) {
      console.error('[Approve Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Pending Auto-Event ====================

// Get pending auto-scheduled event for a group
router.get("/groups/:groupId/pending-auto-event", isAuthenticated, async (req, res) => {
    try {
      const pendingEvent = await storage.getPendingAutoScheduledEvent(req.params.groupId);
      res.json(pendingEvent || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// Approve/finalize a pending auto-scheduled event
router.post("/auto-schedule/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const event = await storage.getAutoScheduledEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Auto-scheduled event not found" });
      }

      // Mark event as approved (will be sent immediately)
      await storage.updateAutoScheduledEventStatus(req.params.id, 'approved');

      res.json({ success: true, message: "Event approved and will be sent to group" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Frequency Feedback ====================

// Submit frequency feedback
router.post("/frequency-feedback", isAuthenticated, async (req, res) => {
    try {
      const { groupId, feedback } = req.body;
      const userId = await getUserId(req);

      // Store feedback
      await storage.createFrequencyFeedback({
        groupId,
        userId,
        feedback,
      });

      // Check if we should adjust frequency
      const allFeedback = await storage.getGroupFrequencyFeedback(groupId);
      const total = allFeedback.length;

      if (total >= 3) {
        const moreOften = allFeedback.filter(f => f.feedback === 'more_often').length;
        const lessOften = allFeedback.filter(f => f.feedback === 'less_often').length;

        const threshold = total * 0.5;

        if (moreOften > threshold || lessOften > threshold) {
          const group = await storage.getGroup(groupId);
          if (group) {
            const current = group.meetingFrequency || 'monthly';
            const frequencies = ['weekly', 'biweekly', 'monthly', 'bimonthly'];
            const currentIndex = frequencies.indexOf(current);

            let newFrequency = current;
            if (moreOften > threshold && currentIndex > 0) {
              newFrequency = frequencies[currentIndex - 1];
            } else if (lessOften > threshold && currentIndex < frequencies.length - 1) {
              newFrequency = frequencies[currentIndex + 1];
            }

            if (newFrequency !== current) {
              await storage.updateGroup(groupId, { meetingFrequency: newFrequency });

              // Update nextEventDueDate based on new frequency
              if (group.lastEventDate) {
                const { addDays } = await import('date-fns');
                const frequencyDays: Record<string, number> = {
                  'weekly': 7,
                  'biweekly': 14,
                  'monthly': 30,
                  'bimonthly': 60,
                };
                const daysToAdd = frequencyDays[newFrequency] || 30;
                const nextDue = addDays(new Date(group.lastEventDate), daysToAdd);
                await storage.updateGroup(groupId, { nextEventDueDate: nextDue });
              }
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// ==================== Schedule Next Event ====================

// Manually trigger next event scheduling with 3 itinerary options
router.post("/groups/:groupId/schedule-next-event", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { allowMemberVoting = false } = req.body;

      // Verify user is the group owner
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can schedule events" });
      }

      // Check if there's already a pending auto event
      const existingEvent = await storage.getPendingAutoScheduledEvent(groupId);
      if (existingEvent && existingEvent.status === 'pending_approval') {
        return res.status(400).json({ message: "There's already a pending event. Please approve or reject it first." });
      }

      // Generate 3 itinerary options
      const { selectBestItineraryForAutoSchedule } = await import('../auto-scheduler');
      const result = await selectBestItineraryForAutoSchedule(storage, group);

      if (!result.options || result.options.length === 0) {
        return res.status(400).json({
          message: "Unable to generate itinerary options. The group may not have enough venues or activities."
        });
      }

      // Create the auto-scheduled event with pending status
      const { addDays } = await import('date-fns');
      const proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : addDays(new Date(), 7);
      const autoSendAt = addDays(proposedDate, -7); // Auto-send 7 days before proposed date (minimum lead time for RSVPs)

      const autoEvent = await storage.createAutoScheduledEvent({
        groupId,
        proposedDate,
        autoSendAt,
        status: 'pending_approval',
        allowMemberVoting,
      });

      // Note: Options are already validated and ordered by the AI Event Planning Agent
      // The agent uses specialized tools for diversity, time appropriateness, and logical flow
      // No additional validation needed - trust the agent's expertise
      console.log('[Schedule Next Event] Using agent-validated options (already ordered optimally)');

      // Store the 3 options
      const { itineraryOptions: itineraryOptionsTable } = await import('../../shared/schema');
      const savedOptions = await Promise.all(
        result.options.map(async (option: any) => {
          const [saved] = await db.insert(itineraryOptionsTable).values({
            autoEventId: autoEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues,
            description: option.description,
            nearbySuggestions: option.nearbySuggestions || null,
          }).returning();
          return saved;
        })
      );

      res.json({
        autoEvent,
        options: savedOptions,
      });
    } catch (error: any) {
      console.error('[Schedule Next Event] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

export default router;
