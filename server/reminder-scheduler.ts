import { db } from './db';
import { itineraries, members, reminderLogs, groups, autoScheduledEvents, itineraryInvites, rejectedEventDates } from '../shared/schema';
import { eq, and, isNull, sql, or, lt } from 'drizzle-orm';
import { addDays } from 'date-fns';
import {
  sendItineraryInvite,
  sendGentleNudge,
  sendFinalCall,
  sendDayBeforeReminder,
  type EmailRecipient,
  type ItineraryInviteData,
  type ReminderData,
} from './email-service';
import { storage } from './storage';
import { selectBestItineraryForAutoSchedule, shouldTriggerAutoSchedule, maintainEventPipeline, calculateTargetEventCount } from './auto-scheduler';
import { calculateEventConfidence, shouldRequireReview } from './confidence-scoring';
import { randomBytes } from 'crypto';

/**
 * Validates that a date is valid before performing mutations
 * @throws Error if date is invalid
 */
function validateDate(date: Date, context: string): void {
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date in ${context}: ${date}`);
  }
}

interface ReminderToSend {
  itineraryId: string;
  reminderType: 'initial_invite' | 'gentle_nudge' | 'final_call' | 'day_before';
  recipients: EmailRecipient[];
  itinerary: any;
  group: any;
}

export async function processScheduledReminders(): Promise<void> {
  const now = new Date();
  
  try {
    // Get all scheduled itineraries with upcoming events
    const scheduledItineraries = await db
      .select({
        itinerary: itineraries,
        group: groups,
      })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .where(
        and(
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled')
          ),
          isNull(itineraries.inviteSentAt) // Only process if invites haven't been sent yet
        )
      );

    for (const { itinerary, group } of scheduledItineraries) {
      // Skip if no event date or schedule config
      if (!itinerary.eventDate || !itinerary.autoScheduleConfig) {
        continue;
      }

      const config = itinerary.autoScheduleConfig as {
        inviteAdvanceDays: number;
        rsvpWindowDays: number;
        reminders: Array<{
          type: 'gentle_nudge' | 'final_call' | 'day_before';
          daysBeforeDeadline?: number;
          daysBeforeEvent?: number;
        }>;
      };

      const eventDate = new Date(itinerary.eventDate);
      validateDate(eventDate, 'processScheduledReminders - eventDate');
      const inviteSendDate = new Date(eventDate);
      inviteSendDate.setDate(eventDate.getDate() - config.inviteAdvanceDays);

      // Check if it's time to send initial invite
      if (now >= inviteSendDate && !itinerary.inviteSentAt) {
        await sendInitialInvites(itinerary, group);
      }
    }

    // Process reminders for itineraries where invites have been sent
    const activeItineraries = await db
      .select({
        itinerary: itineraries,
        group: groups,
      })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .where(
        and(
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled')
          ),
          sql`${itineraries.inviteSentAt} IS NOT NULL`,
          sql`${itineraries.eventDate} > NOW()`
        )
      );

    for (const { itinerary, group } of activeItineraries) {
      if (!itinerary.rsvpDeadline || !itinerary.eventDate || !itinerary.autoScheduleConfig) {
        continue;
      }

      const config = itinerary.autoScheduleConfig as {
        reminders: Array<{
          type: 'gentle_nudge' | 'final_call' | 'day_before';
          daysBeforeDeadline?: number;
          daysBeforeEvent?: number;
        }>;
      };

      const rsvpDeadline = new Date(itinerary.rsvpDeadline);
      validateDate(rsvpDeadline, 'processScheduledReminders - rsvpDeadline');
      const eventDate = new Date(itinerary.eventDate);
      validateDate(eventDate, 'processScheduledReminders - reminder eventDate');

      // Check each configured reminder
      for (const reminder of config.reminders) {
        let sendDate: Date;

        if (reminder.type === 'day_before' && reminder.daysBeforeEvent) {
          sendDate = new Date(eventDate);
          sendDate.setDate(eventDate.getDate() - reminder.daysBeforeEvent);
        } else if (reminder.daysBeforeDeadline) {
          sendDate = new Date(rsvpDeadline);
          sendDate.setDate(rsvpDeadline.getDate() - reminder.daysBeforeDeadline);
        } else {
          continue;
        }

        // Check if reminder should be sent now
        if (now >= sendDate) {
          // Check if this reminder type has already been sent
          const existingLog = await db
            .select()
            .from(reminderLogs)
            .where(
              and(
                eq(reminderLogs.itineraryId, itinerary.id),
                eq(reminderLogs.reminderType, reminder.type)
              )
            )
            .limit(1);

          if (existingLog.length === 0) {
            await sendReminderEmails(itinerary, group, reminder.type);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing scheduled reminders:', error);
  }
}

export async function sendInitialInvites(itinerary: any, group: any): Promise<void> {
  try {
    // Get all group members with emails
    const groupMembers = await db
      .select()
      .from(members)
      .where(eq(members.groupId, group.id));

    const membersWithEmails = groupMembers.filter(m => m.email);

    if (membersWithEmails.length === 0) {
      console.log('No recipients with emails for itinerary:', itinerary.id);
      // Mark as sent to prevent retrying
      await db
        .update(itineraries)
        .set({ inviteSentAt: new Date() })
        .where(eq(itineraries.id, itinerary.id));
      return;
    }

    // Get itinerary items (venues)
    const items = await db.query.itineraryItems.findMany({
      where: eq(itineraries.id, itinerary.id),
    });

    const eventDate = new Date(itinerary.eventDate);
    const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;

    const baseInviteData = {
      groupName: group.name,
      organizerName: group.name,
      eventDate: eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      }),
      eventTime: eventDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      venues: items.map(item => ({
        name: item.venueName,
        type: item.venueType,
        address: item.venueAddress || undefined,
      })),
      rsvpDeadline: rsvpDeadline?.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      }) || 'soon',
    };

    // Send individual invite to each member with their unique RSVP link
    for (const member of membersWithEmails) {
      // Get the invite token for this member and itinerary
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(
          and(
            eq(itineraryInvites.itineraryId, itinerary.id),
            eq(itineraryInvites.memberId, member.id)
          )
        )
        .limit(1);

      if (invites.length === 0) {
        console.log(`No invite token found for member ${member.id} and itinerary ${itinerary.id}`);
        continue;
      }

      const invite = invites[0];
      const rsvpLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/rsvp/${itinerary.id}/${invite.inviteToken}`;

      const inviteData: ItineraryInviteData = {
        ...baseInviteData,
        rsvpLink,
      };

      const recipient: EmailRecipient = {
        email: member.email!,
        name: member.name || 'there',
      };

      const result = await sendItineraryInvite(recipient, inviteData);
      
      // Log the attempt
      await db.insert(reminderLogs).values({
        itineraryId: itinerary.id,
        reminderType: 'initial_invite',
        recipientEmail: recipient.email,
        emailStatus: result.success ? 'sent' : 'failed',
      });
    }

    // Mark invites as sent
    await db
      .update(itineraries)
      .set({ inviteSentAt: new Date() })
      .where(eq(itineraries.id, itinerary.id));

    console.log(`Sent ${membersWithEmails.length} initial invites for itinerary ${itinerary.id}`);
  } catch (error) {
    console.error('Error sending initial invites:', error);
  }
}

async function sendReminderEmails(
  itinerary: any,
  group: any,
  reminderType: 'gentle_nudge' | 'final_call' | 'day_before'
): Promise<void> {
  try {
    // Get group members
    const groupMembers = await db
      .select()
      .from(members)
      .where(eq(members.groupId, group.id));

    // Send in-app RSVP reminder notifications for gentle_nudge and final_call
    if (reminderType === 'gentle_nudge' || reminderType === 'final_call') {
      try {
        const { notifyRSVPReminder } = await import('./notifications');
        const memberIds = groupMembers.map(m => m.id);

        // Calculate hours until deadline
        const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;
        const hoursUntilDeadline = rsvpDeadline
          ? Math.round((rsvpDeadline.getTime() - Date.now()) / (1000 * 60 * 60))
          : 24;

        await notifyRSVPReminder({
          itineraryId: itinerary.id,
          groupId: group.id,
          eventName: itinerary.name || 'Upcoming Event',
          memberIds,
          hoursUntilDeadline
        });
        console.log(`[Notifications] Sent in-app RSVP reminders for ${reminderType}`);
      } catch (notifyError) {
        console.error('[Notifications] Error sending RSVP reminder notifications:', notifyError);
      }
    }

    const membersWithEmails = groupMembers.filter(m => m.email);

    if (membersWithEmails.length === 0) {
      return;
    }

    const eventDate = new Date(itinerary.eventDate);
    const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;

    const baseReminderData = {
      groupName: group.name,
      organizerName: group.name,
      eventDate: eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      }),
      eventTime: eventDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      rsvpDeadline: rsvpDeadline?.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      }),
    };

    let sendFunction;
    switch (reminderType) {
      case 'gentle_nudge':
        sendFunction = sendGentleNudge;
        break;
      case 'final_call':
        sendFunction = sendFinalCall;
        break;
      case 'day_before':
        sendFunction = sendDayBeforeReminder;
        break;
    }

    // Send to each member with their unique RSVP link
    for (const member of membersWithEmails) {
      // Get the invite token for this member and itinerary
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(
          and(
            eq(itineraryInvites.itineraryId, itinerary.id),
            eq(itineraryInvites.memberId, member.id)
          )
        )
        .limit(1);

      if (invites.length === 0) {
        console.log(`No invite token found for member ${member.id} and itinerary ${itinerary.id}`);
        continue;
      }

      const invite = invites[0];
      const rsvpLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/rsvp/${itinerary.id}/${invite.inviteToken}`;

      const reminderData: ReminderData = {
        ...baseReminderData,
        rsvpLink,
      };

      const recipient: EmailRecipient = {
        email: member.email!,
        name: member.name || 'there',
      };

      const result = await sendFunction(recipient, reminderData);
      
      // Log the attempt
      await db.insert(reminderLogs).values({
        itineraryId: itinerary.id,
        reminderType,
        recipientEmail: recipient.email,
        emailStatus: result.success ? 'sent' : 'failed',
      });
    }

    console.log(`Sent ${membersWithEmails.length} ${reminderType} reminders for itinerary ${itinerary.id}`);
  } catch (error) {
    console.error(`Error sending ${reminderType} reminders:`, error);
  }
}

/**
 * Auto-Process AI Suggestions
 * Automatically approves events where autoSendAt has passed
 * Removes "overdue" concept - AI suggestions become visible when ready
 */
async function autoProcessSuggestions(): Promise<void> {
  try {
    // Find events ready to be suggested (autoSendAt has passed)
    const readyEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(
        sql`${autoScheduledEvents.status} = 'pending_approval'
            AND ${autoScheduledEvents.autoSendAt} < NOW()`
      );

    if (readyEvents.length === 0) {
      return; // No events ready
    }

    console.log(`[Auto-Process] Found ${readyEvents.length} AI suggestions ready to show`);

    for (const event of readyEvents) {
      try {
        // Import here to avoid circular dependency
        const { approveAndCreateItinerary } = await import('./auto-approval');

        // Automatically approve AI's top suggestion
        const result = await approveAndCreateItinerary(
          event.id,
          null, // Let it choose best option
          'auto' // Mark as auto-suggested
        );

        if (result.success) {
          console.log(`[Auto-Process] ✓ AI suggestion ready for group ${event.groupId}: ${result.itinerary?.name}`);
        } else {
          console.error(`[Auto-Process] ✗ Failed to process suggestion: ${result.error}`);
        }
      } catch (error) {
        console.error(`[Auto-Process] Error processing event ${event.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Auto-Process] Error in autoProcessSuggestions:', error);
  }
}

/**
 * Auto-Scheduling Worker: Creates pending events for groups that need them
 * Runs once per day to check if groups need their next event created
 */
export async function processAutoScheduling(): Promise<void> {
  try {
    // Get all groups with auto-scheduling enabled
    const autoEnabledGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.autoScheduleEnabled, true));

    for (const group of autoEnabledGroups) {
      // Skip groups without a valid userId (deleted owner)
      if (!group.userId) {
        console.log(`Skipping auto-schedule for group ${group.name} - no userId`);
        continue;
      }

      // Check if there's already a pending auto-event
      const pendingEvent = await storage.getPendingAutoScheduledEvent(group.id);

      // Determine if we should trigger auto-scheduling
      if (await shouldTriggerAutoSchedule(storage, group, !!pendingEvent)) {
        console.log(`Creating auto-scheduled event for group: ${group.name}`);

        // Select best itinerary/venues for this event
        const selection = await selectBestItineraryForAutoSchedule(storage, group);

        // Check if we got 3 itinerary options (new flow)
        if (selection.options && selection.options.length > 0) {

          // Use nextEventDueDate for the proposed date (AI time picker will be used after option selection)
          const proposedDate = group.nextEventDueDate
            ? new Date(group.nextEventDueDate)
            : addDays(new Date(), 14);

          // Create auto-scheduled event with pending_approval status
          const autoEvent = await storage.createAutoScheduledEvent({
            groupId: group.id,
            proposedDate: proposedDate,
            autoSendAt: addDays(new Date(), 2),
            status: 'pending_approval',
            allowMemberVoting: false,
          });

          // Store the 3 itinerary options
          const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');
          await Promise.all(
            selection.options.map(async (option) => {
              await db.insert(itineraryOptionsTable).values({
                autoEventId: autoEvent.id,
                optionNumber: option.optionNumber,
                venues: option.venues,
                description: option.description,
              });
            })
          );

          console.log(`Created auto-event with ${selection.options.length} options for group ${group.name}, organizer needs to select an option`);

          // Trigger post-AI swipe session (collect feedback on generated venues)
          try {
            const { triggerSwipeSession } = await import('./swipe-trigger-manager');

            // Collect all activity IDs from the 3 options
            const allActivityIds = selection.options.flatMap(opt =>
              opt.venues
                .filter((v: any) => v.sourceType === 'activity' && v.sourceId)
                .map((v: any) => v.sourceId)
            );

            if (allActivityIds.length >= 3) {
              const triggerResult = await triggerSwipeSession({
                groupId: group.id,
                triggerType: 'post_ai',
                activityIds: allActivityIds,
                reason: `AI generated ${selection.options.length} itinerary options with ${allActivityIds.length} venues - your feedback helps improve future suggestions!`,
                expiresInHours: 48,
              });

              if (triggerResult.triggered) {
                console.log(`[SwipeTrigger] ${triggerResult.reason}`);
              } else {
                console.log(`[SwipeTrigger] Skipped: ${triggerResult.skippedReason}`);
              }
            }
          } catch (triggerError) {
            console.error('[SwipeTrigger] Error triggering post-AI swipe session:', triggerError);
          }

          continue;
        }

        // Fallback to old flow if no options returned
        if (!selection.itineraryId && (!selection.selectedVenues || selection.selectedVenues.length === 0)) {
          console.log(`No viable options for auto-scheduling group ${group.name}`);
          continue;
        }

        // OLD FLOW: Create or duplicate itinerary for this auto-event
        let itineraryId: string;

        if (selection.itineraryId) {
          // Duplicate the saved itinerary
          const original = await storage.getItinerary(selection.itineraryId);
          if (!original) continue;

          const itemsData = original.items
            .filter(item => item.sourceType !== 'ad_hoc' && item.sourceId !== null)
            .map(item => ({
              sourceType: item.sourceType as 'activity' | 'voting_event',
              sourceId: item.sourceId!
            }));

          // Clean up any existing draft itineraries before creating a new one
          await db.delete(itineraries).where(
            and(
              eq(itineraries.groupId, group.id),
              eq(itineraries.status, "draft"),
              eq(itineraries.isSaved, false)
            )
          );

          const newItinerary = await storage.createItinerary(
            {
              groupId: group.id,
              name: `${original.name} (Auto-Scheduled)`,
              status: 'draft',
              isSaved: false,
              proposedOrder: {},
            },
            group.userId,
            itemsData
          );
          itineraryId = newItinerary.id;
        } else if (selection.selectedVenues) {
          // Clean up any existing draft itineraries before creating a new one
          await db.delete(itineraries).where(
            and(
              eq(itineraries.groupId, group.id),
              eq(itineraries.status, "draft"),
              eq(itineraries.isSaved, false)
            )
          );

          // Create new itinerary from selected venues
          const newItinerary = await storage.createItinerary(
            {
              groupId: group.id,
              name: 'Upcoming Hangout',
              status: 'draft',
              isSaved: false,
              proposedOrder: {},
            },
            group.userId,
            selection.selectedVenues
          );
          itineraryId = newItinerary.id;
        } else {
          continue;
        }

        // Use AI time picker to find optimal date/time based on availability
        let proposedDate;

        try {
          // Get itinerary items to understand venue types
          const itinerary = await storage.getItinerary(itineraryId);
          if (!itinerary) {

            continue;
          }

          const venues = itinerary.items.map((item: any) => ({
            name: item.venueName,
            type: item.venueType,
            openingHours: item.openingHours,
            businessStatus: item.businessStatus,
          }));

          // Aggregate member availability
          const { aggregateMemberAvailability, convertAvailabilityToText, calculateDayDensity } = await import('./availability-utils');
          const aggregatedAvailability = await aggregateMemberAvailability(group.id, storage);

          // Convert to text format for AI
          const availabilityString = convertAvailabilityToText(
            aggregatedAvailability.grid,
            aggregatedAvailability.conflicts,
            aggregatedAvailability.memberCount
          );

          // Calculate density scores for smart spacing
          const densityScores = calculateDayDensity(aggregatedAvailability.grid);

          // Get existing events to avoid time slot conflicts
          const existingEvents = await storage.getUserUpcomingEventsWithTimeSlots(
            group.userId,
            new Date(),
            addDays(new Date(), 90)
          );

          // Use AI to find optimal time
          const { suggestOptimalTime } = await import('./ai-time-picker');
          const timeResult = await suggestOptimalTime({
            generalAvailability: availabilityString,
            venues,
            location: group.locationBase,
            meetingFrequency: group.meetingFrequency || undefined,
            timezone: group.timezone || undefined, // Use stored timezone
            densityScores, // Pass density for smart spacing
            existingEvents, // Pass existing events to avoid conflicts
            currentGroupId: group.id, // Pass current group to exclude from conflict check
            schedulingPreferences: group.schedulingPreferences || undefined, // Pass custom scheduling instructions
          });

          proposedDate = timeResult.eventDate;

        } catch (aiError) {
          console.error('[Auto-Schedule] AI time picker failed, falling back to nextEventDueDate:', aiError);

          // Fallback to original logic if AI fails
          proposedDate = group.nextEventDueDate
            ? new Date(group.nextEventDueDate)
            : addDays(new Date(), 14);
        }

        // Calculate auto-send deadline: 48 hours from now (volunteer window)
        // If no one volunteers to host within 48 hours, AI auto-approves and sends
        const autoSendAt = addDays(new Date(), 2);

        // Calculate confidence score for this event
        const itinerary = await storage.getItinerary(itineraryId);
        const venuesForConfidence = itinerary?.items.map(item => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId || '',
          venueName: item.venueName,
        })) || [];

        const confidenceResult = await calculateEventConfidence(
          storage,
          group.id,
          venuesForConfidence,
          proposedDate
        );

        // Determine if review is required based on automation level and confidence
        const { requiresReview, reason } = shouldRequireReview(
          confidenceResult.score,
          {
            automationLevel: group.automationLevel || 'smart',
            confidenceThreshold: group.confidenceThreshold || 80,
            automationPaused: group.automationPaused || false,
            reviewEveryNthEvent: group.reviewEveryNthEvent || null,
            eventCountSinceLastReview: group.eventCountSinceLastReview || 0,
          }
        );

        console.log(`[Review] Required: ${requiresReview}, Reason: ${reason || 'none'}`);

        // Create auto-scheduled event record
        const autoEvent = await storage.createAutoScheduledEvent({
          groupId: group.id,
          itineraryId,
          proposedDate,
          autoSendAt,
          status: requiresReview ? 'pending_approval' : 'auto_approved', // Auto-approve if no review needed
          confidenceScore: confidenceResult.score,
          confidenceFactors: confidenceResult.factors,
          requiresReview,
          reviewReason: reason,
        });

        // Log prediction for calibration
        const { logConfidencePrediction, getGroupConfidenceWeights } = await import('./confidence-scoring');
        const weights = await getGroupConfidenceWeights(group.id);
        await logConfidencePrediction(
          group.id,
          autoEvent.id,
          null, // No swipe session yet
          confidenceResult,
          weights
        );

        // If no review required, auto-send the event immediately
        if (!requiresReview) {
          console.log(`[AutoApproval] Confidence ${confidenceResult.score}% >= threshold, auto-sending event`);

          // Get the itinerary to send
          const [itinerary] = await db
            .select()
            .from(itineraries)
            .where(eq(itineraries.id, itineraryId))
            .limit(1);

          if (itinerary) {
            // Send initial invites to all members
            await sendInitialInvites(itinerary, group);

            // Mark as auto-sent
            await db.update(autoScheduledEvents)
              .set({ status: 'auto_sent' })
              .where(eq(autoScheduledEvents.id, autoEvent.id));

            console.log(`[AutoApproval] Event auto-sent for group ${group.name}`);
          }
        }

        // Update event counter for review sampling
        if (reason === 'scheduled_review') {
          await db.update(groups)
            .set({ eventCountSinceLastReview: 0 })
            .where(eq(groups.id, group.id));
        } else {
          await db.update(groups)
            .set({ eventCountSinceLastReview: (group.eventCountSinceLastReview || 0) + 1 })
            .where(eq(groups.id, group.id));
        }

        console.log(`Created pending auto-event for group ${group.name}, proposed date: ${proposedDate.toISOString()}, auto-send at: ${autoSendAt.toISOString()} (48hr volunteer window), confidence: ${confidenceResult.score}%, review required: ${requiresReview}`);

        // Trigger post-AI swipe session (collect feedback on generated event)
        try {
          const { triggerSwipeSession } = await import('./swipe-trigger-manager');

          // Collect activity IDs from the created itinerary
          const activityIds = venuesForConfidence
            .filter(v => v.sourceType === 'activity' && v.sourceId)
            .map(v => v.sourceId);

          if (activityIds.length >= 3) {
            const triggerResult = await triggerSwipeSession({
              groupId: group.id,
              triggerType: 'post_ai',
              activityIds,
              reason: `AI created an event with ${activityIds.length} venues - your feedback helps improve future suggestions!`,
              expiresInHours: 48,
            });

            if (triggerResult.triggered) {
              console.log(`[SwipeTrigger] ${triggerResult.reason}`);
            } else {
              console.log(`[SwipeTrigger] Skipped: ${triggerResult.skippedReason}`);
            }
          }
        } catch (triggerError) {
          console.error('[SwipeTrigger] Error triggering post-AI swipe session:', triggerError);
        }
      }
    }

    // NEW: Detect and fix pipeline gaps (when events were manually deleted)
    console.log('[Pipeline Gap Detection] Checking for groups with insufficient future events...');
    for (const group of autoEnabledGroups) {
      try {
        // Skip groups without a valid userId
        if (!group.userId) continue;

        // Skip if automation is paused
        if (group.automationPaused) {
          console.log(`[Pipeline Gap] Skipping ${group.name} - automation paused`);
          continue;
        }

        // Count existing future events
        const existingCount = await storage.countFutureEvents(group.id);

        // Calculate target event count based on cadence (use custom target if set)
        const targetCount = group.targetFutureEvents ?? calculateTargetEventCount(group.meetingFrequency);

        // If there's a gap, trigger pipeline maintenance
        if (existingCount < targetCount) {
          console.log(`[Pipeline Gap] Group "${group.name}" has ${existingCount}/${targetCount} events - triggering backfill`);
          await maintainEventPipeline(group.id, storage);
        } else {
          console.log(`[Pipeline Gap] Group "${group.name}" has ${existingCount}/${targetCount} events - pipeline healthy`);
        }
      } catch (gapError) {
        console.error(`[Pipeline Gap] Error checking group ${group.name}:`, gapError);
      }
    }
  } catch (error) {
    console.error('Error processing auto-scheduling:', error);
  }
}

/**
 * Auto-Draft Itinerary Worker: Creates draft itineraries for upcoming virtual events
 * Uses adaptive timeline to determine when to create drafts based on event proximity
 */
export async function processAutoDraftItineraries(): Promise<void> {
  try {
    console.log('[Auto-Draft] Checking for virtual events needing draft itineraries...');

    // Import adaptive timeline functions
    const { calculateAdaptiveTimeline } = await import('./adaptive-timeline');

    // Get all groups with auto-scheduling enabled
    const autoEnabledGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.autoScheduleEnabled, true));

    for (const group of autoEnabledGroups) {
      // Skip groups without a valid userId
      if (!group.userId) {
        continue;
      }

      // Skip if group doesn't have auto-itinerary enabled
      if (!group.autoItineraryEnabled) {
        console.log(`[Auto-Draft] Skipping ${group.name} - autoItineraryEnabled is false`);
        continue;
      }

      // Check if there's a nextEventDueDate
      if (!group.nextEventDueDate) {
        continue;
      }

      const eventDate = new Date(group.nextEventDueDate);
      const now = new Date();
      const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Use adaptive timeline to determine when to create draft
      const timeline = calculateAdaptiveTimeline(eventDate, now);

      // Create draft at the invite send time (when we would send invites)
      // This gives organizers a chance to review before invites go out
      const shouldCreateDraft = daysUntilEvent <= timeline.inviteAdvanceDays &&
                                daysUntilEvent >= (timeline.inviteAdvanceDays - 1);

      if (!shouldCreateDraft) {
        continue;
      }

      console.log(`[Auto-Draft] Group ${group.name} has event in ${daysUntilEvent} days - using ${timeline.timelineType} timeline`);
      console.log(`[Auto-Draft] Timeline: ${timeline.reasoning}`);

      // Check if a draft itinerary already exists for this date
      const existingDrafts = await db
        .select()
        .from(itineraries)
        .where(
          and(
            eq(itineraries.groupId, group.id),
            eq(itineraries.status, 'draft'),
            eq(itineraries.isSaved, false)
          )
        );

      if (existingDrafts.length > 0) {
        console.log(`[Auto-Draft] Draft already exists for ${group.name}`);
        continue;
      }

      // Check if there's already a scheduled or proposed itinerary for this date
      const existingItineraries = await db
        .select()
        .from(itineraries)
        .where(
          and(
            eq(itineraries.groupId, group.id),
            or(
              eq(itineraries.status, 'scheduled'),
              eq(itineraries.status, 'proposed')
            )
          )
        );

      if (existingItineraries.length > 0) {
        console.log(`[Auto-Draft] Scheduled/proposed itinerary already exists for ${group.name}`);
        continue;
      }

      console.log(`[Auto-Draft] Creating draft itinerary for ${group.name} (event date: ${eventDate.toISOString()})`);

      // Select best venues using existing favorites logic
      const selection = await selectBestItineraryForAutoSchedule(storage, group);

      // Use the favorites-only option if available, otherwise use top option
      let venueSelection = [];
      if (selection.options && selection.options.length > 0) {
        // Get the first option (which is either favorites-only or top-scoring venues)
        const topOption = selection.options[0];
        venueSelection = topOption.venues.map(v => ({
          sourceType: v.sourceType as 'activity' | 'voting_event',
          sourceId: v.sourceId
        }));
        console.log(`[Auto-Draft] Selected ${venueSelection.length} venues for draft`);
      } else if (selection.selectedVenues && selection.selectedVenues.length > 0) {
        venueSelection = selection.selectedVenues;
        console.log(`[Auto-Draft] Using fallback selection with ${venueSelection.length} venues`);
      } else {
        console.log(`[Auto-Draft] No venues available for ${group.name} - skipping draft creation`);
        continue;
      }

      // Create draft itinerary
      try {
        const draftItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: `${group.name} - ${eventDate.toLocaleDateString()}`,
            status: 'draft',
            isSaved: false,
            eventDate: eventDate,
            proposedOrder: {},
          },
          group.userId,
          venueSelection
        );

        console.log(`[Auto-Draft] ✅ Created draft itinerary ${draftItinerary.id} for ${group.name}`);
      } catch (error) {
        console.error(`[Auto-Draft] Error creating draft for ${group.name}:`, error);
      }
    }

    console.log('[Auto-Draft] Finished processing auto-draft itineraries');
  } catch (error) {
    console.error('[Auto-Draft] Error in processAutoDraftItineraries:', error);
  }
}

/**
 * Auto-Send Worker: Sends pending events that have reached their deadline
 * Runs every hour to check for events ready to auto-send
 */
export async function processAutoSend(): Promise<void> {
  try {
    // Get all pending events that are ready to auto-send
    const readyEvents = await storage.getAutoScheduledEventsReadyForAutoSend();

    for (const event of readyEvents) {
      console.log(`Auto-sending event ${event.id} for group ${event.groupId}`);

      try {
        const group = await storage.getGroup(event.groupId);
        const itinerary = event.itineraryId ? await storage.getItinerary(event.itineraryId) : null;

        if (!group || !itinerary) {
          console.error(`Missing group or itinerary for auto-event ${event.id}`);
          continue;
        }

        // Check if event requires review (low confidence, paused automation, or scheduled review)
        if (event.requiresReview) {
          console.log(`Event ${event.id} requires review (reason: ${event.reviewReason}) - skipping auto-send, organizer must approve`);
          // Keep pending status, organizer must manually approve
          continue;
        }

        // Check if someone volunteered to host
        // If there's a host, skip auto-sending (host should manually approve the event)
        const itineraryDetails = await db
          .select()
          .from(itineraries)
          .where(eq(itineraries.id, itinerary.id));
        
        const hasHost = itineraryDetails[0]?.hostMemberId !== null;
        
        if (hasHost) {
          console.log(`Event ${event.id} has a volunteer host - skipping auto-send, waiting for host approval`);
          // Don't auto-send, but keep the pending status so host can still approve
          continue;
        }

        console.log(`Event ${event.id} has no volunteer host - AI auto-approving and sending`);

        // Update itinerary to proposed status with event date and schedule config
        const inviteAdvanceDays = 21; // Increased from 14 to give members more planning time
        const eventDate = new Date(event.proposedDate);
        const rsvpDeadline = addDays(eventDate, -7); // Increased from 3 to 7 days before event

        await storage.updateItinerary(itinerary.id, {
          status: 'proposed',
          eventDate: event.proposedDate,
          rsvpDeadline,
          autoScheduleConfig: {
            inviteAdvanceDays,
            rsvpWindowDays: 14, // Updated from 11 to match new timeline (21 - 7 = 14)
            reminders: [
              { type: 'gentle_nudge', daysBeforeDeadline: 7 },
              { type: 'final_call', daysBeforeDeadline: 1 },
              { type: 'day_before', daysBeforeEvent: 1 }
            ]
          }
        });

        // Log venue visits for rotation tracking
        await storage.logVenueVisits(itinerary.id, new Date(event.proposedDate));

        // Send initial invites
        await sendInitialInvites(itinerary, group);

        // Mark auto-event as sent
        await storage.updateAutoScheduledEventStatus(event.id, 'auto_sent');

        console.log(`Auto-sent event ${event.id} successfully`);
      } catch (error) {
        console.error(`Error auto-sending event ${event.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing auto-send:', error);
  }
}

/**
 * Check itineraries that need time slot selection and auto-select the best time
 * Runs daily to select time slots 24-48 hours before events
 */
async function checkAndSelectTimeSlots() {
  try {
    console.log('[Time Selection] Checking for itineraries needing time slot selection...');

    // Get all itineraries where:
    // 1. RSVP deadline has passed, OR
    // 2. No RSVP deadline but event is within 24-48 hours
    const upcomingItineraries = await db
      .select()
      .from(itineraries)
      .where(
        and(
          // Event is in the future
          sql`${itineraries.eventDate} > NOW()`,
          // Either RSVP deadline passed OR within 48 hours of event
          or(
            // RSVP deadline has passed
            and(
              sql`${itineraries.rsvpDeadline} IS NOT NULL`,
              sql`${itineraries.rsvpDeadline} < NOW()`
            ),
            // No RSVP deadline but event is within 48 hours
            and(
              sql`${itineraries.rsvpDeadline} IS NULL`,
              sql`${itineraries.eventDate} < NOW() + INTERVAL '48 hours'`
            )
          )
        )
      );

    if (upcomingItineraries.length === 0) {
      console.log('[Time Selection] No itineraries with expired RSVP deadlines found');
      return;
    }

    console.log(`[Time Selection] Found ${upcomingItineraries.length} upcoming itinerary/itineraries`);

    const { needsTimeSelection, selectBestTimeSlot } = await import('./auto-time-selector');

    for (const itinerary of upcomingItineraries) {
      try {
        // Check if this itinerary needs time selection
        const needs = await needsTimeSelection(itinerary.id);

        if (!needs) {
          console.log(`[Time Selection] Skipping ${itinerary.id}: no selection needed`);
          continue;
        }

        console.log(`[Time Selection] ⏰ Selecting time slot for itinerary ${itinerary.id}`);

        // Select the best time slot
        const result = await selectBestTimeSlot(itinerary.id);

        if (result.success && result.selectedTimeSlot) {
          console.log(`[Time Selection] ✅ Selected: ${result.selectedTimeSlot.label || result.selectedTimeSlot.proposedDateTime.toISOString()}`);
          console.log(`[Time Selection] 📊 Votes: ${result.selectedTimeSlot.yesVotes} yes, ${result.selectedTimeSlot.maybeVotes} maybe, ${result.selectedTimeSlot.noVotes} no`);

          // See TODO.md: "Time Selection Notifications" for planned notification system
        } else {
          console.error(`[Time Selection] ❌ Failed to select time for ${itinerary.id}: ${result.error}`);
        }
      } catch (itineraryError: any) {
        console.error(`[Time Selection] Error processing itinerary ${itinerary.id}:`, itineraryError);
        // Continue with next itinerary
      }
    }

    console.log('[Time Selection] Finished checking for time selections');
  } catch (error: any) {
    console.error('[Time Selection] Error in checkAndSelectTimeSlots:', error);
  }
}

/**
 * Check pending auto-scheduled events and auto-approve those with high confidence
 * Runs hourly to automatically approve events that meet the confidence threshold
 */
async function checkAndAutoApproveEvents() {
  try {
    console.log('[Auto-Approval] Checking for high-confidence events to auto-approve...');

    // Get all pending_approval events with confidence scores
    const pendingEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.status, 'pending_approval'));

    if (pendingEvents.length === 0) {
      console.log('[Auto-Approval] No pending events found');
      return;
    }

    console.log(`[Auto-Approval] Found ${pendingEvents.length} pending event(s)`);

    for (const event of pendingEvents) {
      try {
        // Check if event has high confidence (≥80%)
        const confidence = event.confidenceScore || 0;
        const group = await storage.getGroup(event.groupId);

        if (!group) {
          console.log(`[Auto-Approval] Skipping event ${event.id}: group not found`);
          continue;
        }

        // Get group's confidence threshold (default 80%)
        const threshold = group.confidenceThreshold || 80;

        if (confidence < threshold) {
          console.log(`[Auto-Approval] Skipping event ${event.id}: confidence ${confidence}% < threshold ${threshold}%`);
          continue;
        }

        // Check if automation is paused for this group
        if (group.automationPaused) {
          console.log(`[Auto-Approval] Skipping event ${event.id}: automation paused for group ${group.name}`);
          continue;
        }

        console.log(`[Auto-Approval] 🤖 Auto-approving event ${event.id} for group ${group.name} (confidence: ${confidence}%)`);

        // Auto-approve the event using shared logic
        const { approveAndCreateItinerary } = await import('./auto-approval');
        const result = await approveAndCreateItinerary(event.id, null, 'auto');

        if (result.success) {
          console.log(`[Auto-Approval] ✅ Successfully auto-approved event ${event.id}`);

          // Send invites for the auto-approved itinerary
          if (result.itinerary) {
            await sendInitialInvites(result.itinerary, group);
            console.log(`[Auto-Approval] 📧 Invites sent for event ${event.id}`);
          }
        } else {
          console.error(`[Auto-Approval] ❌ Failed to auto-approve event ${event.id}: ${result.error}`);
        }
      } catch (eventError: any) {
        console.error(`[Auto-Approval] Error processing event ${event.id}:`, eventError);
        // Continue with next event even if this one fails
      }
    }

    console.log('[Auto-Approval] Finished checking for auto-approvals');
  } catch (error: any) {
    console.error('[Auto-Approval] Error in checkAndAutoApproveEvents:', error);
  }
}

// Run every 5 minutes for reminders, once per day for auto-scheduling
export function startReminderScheduler(): void {
  const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const AUTO_SCHEDULE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const AUTO_SEND_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const AUTO_APPROVAL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  console.log('Starting reminder scheduler...');

  // Run reminders immediately and every 5 minutes (async, non-blocking)
  processScheduledReminders().catch(err => {
    console.error('Error in initial reminder processing:', err);
  });
  setInterval(() => {
    processScheduledReminders().catch(err => {
      console.error('Error in scheduled reminder processing:', err);
    });
  }, REMINDER_INTERVAL_MS);

  // Run auto-scheduling immediately and daily (async, non-blocking)
  processAutoScheduling().catch(err => {
    console.error('Error in initial auto-scheduling:', err);
  });
  setInterval(() => {
    processAutoScheduling().catch(err => {
      console.error('Error in scheduled auto-scheduling:', err);
    });
  }, AUTO_SCHEDULE_INTERVAL_MS);

  // Run auto-send immediately and every hour (async, non-blocking)
  processAutoSend().catch(err => {
    console.error('Error in initial auto-send:', err);
  });
  setInterval(() => {
    processAutoSend().catch(err => {
      console.error('Error in scheduled auto-send:', err);
    });
  }, AUTO_SEND_INTERVAL_MS);

  // Run auto-approval check immediately and every hour (async, non-blocking)
  checkAndAutoApproveEvents().catch(err => {
    console.error('Error in initial auto-approval check:', err);
  });
  setInterval(() => {
    checkAndAutoApproveEvents().catch(err => {
      console.error('Error in scheduled auto-approval check:', err);
    });
  }, AUTO_APPROVAL_INTERVAL_MS);

  // Run auto-process suggestions immediately and every hour (async, non-blocking)
  autoProcessSuggestions().catch(err => {
    console.error('Error in initial auto-process suggestions:', err);
  });
  setInterval(() => {
    autoProcessSuggestions().catch(err => {
      console.error('Error in scheduled auto-process suggestions:', err);
    });
  }, AUTO_APPROVAL_INTERVAL_MS);

  // Run time slot selection immediately and daily (async, non-blocking)
  checkAndSelectTimeSlots().catch(err => {
    console.error('Error in initial time selection check:', err);
  });
  setInterval(() => {
    checkAndSelectTimeSlots().catch(err => {
      console.error('Error in scheduled time selection check:', err);
    });
  }, AUTO_SCHEDULE_INTERVAL_MS); // Run daily, same as auto-scheduling

  // Run auto-draft itinerary creation immediately and daily (async, non-blocking)
  processAutoDraftItineraries().catch(err => {
    console.error('Error in initial auto-draft processing:', err);
  });
  setInterval(() => {
    processAutoDraftItineraries().catch(err => {
      console.error('Error in scheduled auto-draft processing:', err);
    });
  }, AUTO_SCHEDULE_INTERVAL_MS); // Run daily, same as auto-scheduling

  // Run weekly swipe digest (checks every day, only runs on Monday)
  const processWeeklySwipeDigest = async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Only run on Mondays
    if (dayOfWeek === 1) {
      const { processWeeklyDigests } = await import('./swipe-digest-worker');
      processWeeklyDigests().catch(err => {
        console.error('Error in weekly swipe digest:', err);
      });
    }
  };

  processWeeklySwipeDigest().catch(err => {
    console.error('Error in initial weekly digest check:', err);
  });
  setInterval(() => {
    processWeeklySwipeDigest().catch(err => {
      console.error('Error in scheduled weekly digest:', err);
    });
  }, AUTO_SCHEDULE_INTERVAL_MS); // Check daily, runs only on Mondays

  // Auto-Refresh Stale Activities - runs daily
  const ACTIVITY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const processActivityRefresh = async () => {
    const { refreshStaleActivityPools } = await import('./activity-refresh-worker');
    refreshStaleActivityPools().catch(err => {
      console.error('Error in activity refresh:', err);
    });
  };

  processActivityRefresh().catch(err => {
    console.error('Error in initial activity refresh:', err);
  });
  setInterval(() => {
    processActivityRefresh().catch(err => {
      console.error('Error in scheduled activity refresh:', err);
    });
  }, ACTIVITY_REFRESH_INTERVAL_MS);

  // Auto-Cleanup Old Pending Events - runs daily
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const processOldEventCleanup = async () => {
    try {
      console.log('[Event Cleanup] Starting cleanup of old pending events...');

      // Get all pending events older than 60 days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const oldEvents = await db
        .select()
        .from(autoScheduledEvents)
        .where(
          and(
            sql`${autoScheduledEvents.status} IN ('pending_approval', 'auto_approved', 'approved', 'auto_sent')`,
            lt(autoScheduledEvents.createdAt, sixtyDaysAgo)
          )
        );

      if (oldEvents.length === 0) {
        console.log('[Event Cleanup] No old pending events to clean up');
        return;
      }

      console.log(`[Event Cleanup] Found ${oldEvents.length} event(s) older than 60 days`);

      // Delete each group's old events
      const deletedByGroup = new Map<string, number>();

      for (const event of oldEvents) {
        await storage.deletePendingAutoEvents(event.groupId);
        const count = deletedByGroup.get(event.groupId) || 0;
        deletedByGroup.set(event.groupId, count + 1);
      }

      for (const [groupId, count] of deletedByGroup.entries()) {
        const group = await storage.getGroup(groupId);
        console.log(`[Event Cleanup] Cleaned up ${count} old event(s) for group: ${group?.name || groupId}`);
      }

      console.log('[Event Cleanup] Cleanup complete');
    } catch (error) {
      console.error('[Event Cleanup] Error during cleanup:', error);
    }
  };

  processOldEventCleanup().catch(err => {
    console.error('Error in initial event cleanup:', err);
  });
  setInterval(() => {
    processOldEventCleanup().catch(err => {
      console.error('Error in scheduled event cleanup:', err);
    });
  }, CLEANUP_INTERVAL_MS);

  // Cleanup past rejected dates - runs daily alongside event cleanup
  const cleanupPastRejectedDates = async () => {
    try {
      console.log('[Rejected Dates Cleanup] Cleaning up past rejected dates...');

      const now = new Date();
      // Delete rejected dates that are more than 7 days in the past
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deletedDates = await db
        .delete(rejectedEventDates)
        .where(lt(rejectedEventDates.rejectedDate, sevenDaysAgo))
        .returning();

      if (deletedDates.length > 0) {
        console.log(`[Rejected Dates Cleanup] Removed ${deletedDates.length} old rejected date(s)`);
      } else {
        console.log('[Rejected Dates Cleanup] No old rejected dates to clean up');
      }
    } catch (error) {
      console.error('[Rejected Dates Cleanup] Error:', error);
    }
  };

  cleanupPastRejectedDates().catch(err => {
    console.error('Error in initial rejected dates cleanup:', err);
  });
  setInterval(() => {
    cleanupPastRejectedDates().catch(err => {
      console.error('Error in scheduled rejected dates cleanup:', err);
    });
  }, CLEANUP_INTERVAL_MS);

  // Post-Event Feedback Request - runs daily
  const FEEDBACK_REQUEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const processPostEventFeedbackRequests = async () => {
    try {
      console.log('[Feedback Request] Checking for completed events needing feedback requests...');

      // Get events that completed 1-2 days ago and haven't had feedback requests sent
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Find itineraries with events that happened 1-2 days ago
      const completedItineraries = await db
        .select({
          itinerary: itineraries,
          group: groups,
        })
        .from(itineraries)
        .innerJoin(groups, eq(itineraries.groupId, groups.id))
        .where(
          and(
            or(
              eq(itineraries.status, 'scheduled'),
              eq(itineraries.status, 'proposed')
            ),
            sql`${itineraries.eventDate} < ${oneDayAgo.toISOString()}`,
            sql`${itineraries.eventDate} > ${twoDaysAgo.toISOString()}`
          )
        );

      if (completedItineraries.length === 0) {
        console.log('[Feedback Request] No recently completed events found');
        return;
      }

      console.log(`[Feedback Request] Found ${completedItineraries.length} recently completed event(s)`);

      for (const { itinerary, group } of completedItineraries) {
        try {
          // Check if we've already sent feedback requests for this itinerary
          const existingLog = await db
            .select()
            .from(reminderLogs)
            .where(
              and(
                eq(reminderLogs.itineraryId, itinerary.id),
                eq(reminderLogs.reminderType, 'feedback_request')
              )
            )
            .limit(1);

          if (existingLog.length > 0) {
            console.log(`[Feedback Request] Already sent for itinerary ${itinerary.id}`);
            continue;
          }

          // Get members who RSVP'd yes (attended)
          const attendees = await db
            .select()
            .from(members)
            .where(eq(members.groupId, group.id));

          const memberIds = attendees.map(m => m.id);

          // Send feedback request notifications
          const { notifyFeedbackRequest } = await import('./notifications');
          await notifyFeedbackRequest({
            itineraryId: itinerary.id,
            groupId: group.id,
            eventName: itinerary.name || 'Recent Event',
            groupName: group.name,
            memberIds
          });

          // Log that we sent feedback requests
          await db.insert(reminderLogs).values({
            itineraryId: itinerary.id,
            reminderType: 'feedback_request',
            recipientEmail: 'all_members',
            emailStatus: 'sent',
          });

          console.log(`[Feedback Request] Sent feedback requests for ${itinerary.name} (group: ${group.name})`);
        } catch (itineraryError) {
          console.error(`[Feedback Request] Error processing itinerary ${itinerary.id}:`, itineraryError);
        }
      }

      console.log('[Feedback Request] Finished processing feedback requests');
    } catch (error) {
      console.error('[Feedback Request] Error:', error);
    }
  };

  processPostEventFeedbackRequests().catch(err => {
    console.error('Error in initial feedback request processing:', err);
  });
  setInterval(() => {
    processPostEventFeedbackRequests().catch(err => {
      console.error('Error in scheduled feedback request processing:', err);
    });
  }, FEEDBACK_REQUEST_INTERVAL_MS);

  // Planning Agent - runs daily to generate proactive insights
  const PLANNING_AGENT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const runPlanningAgentTask = async () => {
    try {
      console.log('[Planning Agent] Starting scheduled run...');
      const { runPlanningAgent } = await import('./planning-agent');
      await runPlanningAgent();
    } catch (error) {
      console.error('[Planning Agent] Error in scheduled run:', error);
    }
  };

  // Run after a short delay on startup (give other systems time to initialize)
  setTimeout(() => {
    runPlanningAgentTask().catch(err => {
      console.error('Error in initial planning agent run:', err);
    });
  }, 60000); // 1 minute after startup

  setInterval(() => {
    runPlanningAgentTask().catch(err => {
      console.error('Error in scheduled planning agent run:', err);
    });
  }, PLANNING_AGENT_INTERVAL_MS);

  console.log('Reminder scheduler started successfully');
}
