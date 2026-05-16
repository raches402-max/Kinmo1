import { db } from './db';
import { itineraries, members, reminderLogs, groups, autoScheduledEvents, itineraryInvites, rejectedEventDates, rsvps as rsvpsTable, type Group } from '../shared/schema';
import { eq, and, isNull, sql, or, lt, not, inArray } from 'drizzle-orm';
import { addDays, differenceInDays } from 'date-fns';
import {
  sendItineraryInvite,
  sendGentleNudge,
  sendFinalCall,
  sendDayBeforeReminder,
  sendAvailabilityPulseRequest,
  type EmailRecipient,
  type ItineraryInviteData,
  type ReminderData,
} from './email-service';
import { storage } from './storage';
import { selectBestItineraryForAutoSchedule, shouldTriggerAutoSchedule, maintainEventPipeline, calculateTargetEventCount, calculateCadenceInDays } from './auto-scheduler';
import { calculateEventConfidence, shouldRequireReview } from './confidence-scoring';
import { randomBytes } from 'crypto';
import { createTrackedJob, getJobHealthStatus } from './lib/job-tracker';
import { isGroupActive } from './job-gating';

// Export job health status for API endpoint
export { getJobHealthStatus };

/**
 * Calculate lead days for availability pulse based on meeting frequency
 */
function calculatePulseLeadDays(meetingFrequency: string | null): number {
  switch (meetingFrequency) {
    case '2x week':
    case '3x week':
      return 4;
    case '1x week':
      return 6;
    case '2x month':
      return 8;
    case '1x month':
    default:
      return 10;
  }
}

interface ScheduleConfig {
  inviteAdvanceDays: number;
  rsvpDeadlineDays: number; // days before event
  rsvpWindowDays: number;
  reminders: Array<{ type: 'gentle_nudge' | 'final_call' | 'day_before'; daysBeforeDeadline?: number; daysBeforeEvent?: number }>;
}

/**
 * Returns adaptive invite/reminder timing based on group cadence.
 * All windows scale proportionally so high-frequency groups aren't over-notified
 * and low-frequency groups have enough lead time.
 *
 * Tiers (by cycle length):
 *   ≤4 days  (3x/2x week): invite=3d, deadline=1d
 *   ≤7 days  (weekly):      invite=7d, deadline=2d
 *   ≤14 days (biweekly):   invite=10d, deadline=3d, 1 nudge
 *   ≤30 days (monthly):    invite=14d, deadline=7d, nudge+final_call
 *   >30 days (quarterly+): invite=30d, deadline=14d, nudge+final_call
 */
function calculateScheduleConfig(meetingFrequency: string | null): ScheduleConfig {
  const cycleDays = meetingFrequency ? calculateCadenceInDays(meetingFrequency) : 30;

  if (cycleDays <= 4) {
    return {
      inviteAdvanceDays: 3,
      rsvpDeadlineDays: 1,
      rsvpWindowDays: 2,
      reminders: [{ type: 'day_before', daysBeforeEvent: 1 }],
    };
  }
  if (cycleDays <= 7) {
    return {
      inviteAdvanceDays: 7,
      rsvpDeadlineDays: 2,
      rsvpWindowDays: 5,
      reminders: [{ type: 'day_before', daysBeforeEvent: 1 }],
    };
  }
  if (cycleDays <= 14) {
    return {
      inviteAdvanceDays: 10,
      rsvpDeadlineDays: 3,
      rsvpWindowDays: 7,
      reminders: [
        { type: 'gentle_nudge', daysBeforeDeadline: 1 },
        { type: 'day_before', daysBeforeEvent: 1 },
      ],
    };
  }
  if (cycleDays <= 30) {
    return {
      inviteAdvanceDays: 14,
      rsvpDeadlineDays: 7,
      rsvpWindowDays: 7,
      reminders: [
        { type: 'gentle_nudge', daysBeforeDeadline: 3 },
        { type: 'final_call', daysBeforeDeadline: 1 },
        { type: 'day_before', daysBeforeEvent: 1 },
      ],
    };
  }
  // quarterly+
  return {
    inviteAdvanceDays: 30,
    rsvpDeadlineDays: 14,
    rsvpWindowDays: 16,
    reminders: [
      { type: 'gentle_nudge', daysBeforeDeadline: 7 },
      { type: 'final_call', daysBeforeDeadline: 2 },
      { type: 'day_before', daysBeforeEvent: 1 },
    ],
  };
}

/**
 * Check if we should trigger an availability pulse for a group and create it if needed
 */
async function triggerAvailabilityPulseIfNeeded(group: Group): Promise<boolean> {
  // Skip if no next event date is set
  if (!group.nextEventDueDate) {
    return false;
  }

  const targetDate = new Date(group.nextEventDueDate);
  const now = new Date();
  const daysUntilEvent = differenceInDays(targetDate, now);

  // Get configured lead days or calculate from frequency
  const leadDays = group.availabilityPulseLeadDays || calculatePulseLeadDays(group.meetingFrequency);

  // Only trigger pulse if we're within the lead window but not too close
  // (pulse should be sent leadDays before, but not after the event is already being created)
  if (daysUntilEvent > leadDays || daysUntilEvent < 3) {
    return false;
  }

  // Check if there's already an active pulse
  const existingPulse = await storage.getActivePulseForGroup(group.id);
  if (existingPulse) {
    return false; // Pulse already exists
  }

  console.log(`[AvailabilityPulse] Creating pulse for group ${group.name}, ${daysUntilEvent} days until event`);

  // Get group members
  const groupMembers = await storage.getGroupMembers(group.id);

  // Calculate pulse window (3 days before target to 2.5 weeks after)
  const startDate = addDays(targetDate, -3);
  const endDate = addDays(targetDate, 18); // 21 days total (3 weeks)
  const expiresAt = addDays(targetDate, -2); // Expires 2 days before event

  // Create the pulse
  const pulse = await storage.createAvailabilityPulse({
    groupId: group.id,
    startDate,
    endDate,
    targetEventDate: targetDate,
    memberCount: groupMembers.length,
    expiresAt,
    status: 'active',
  });

  // Create response tokens for each member
  for (const member of groupMembers) {
    await storage.getOrCreatePulseResponseForMember(
      pulse.id,
      member.id,
      member.userId || undefined
    );
  }

  // Send email notifications to members with email addresses
  const membersWithEmail = groupMembers.filter(m => m.email);
  for (const member of membersWithEmail) {
    const response = await storage.getPulseResponse(pulse.id, member.id);
    if (!response?.responseToken) continue;

    try {
      await sendAvailabilityPulseRequest(
        { email: member.email!, name: member.name || 'there' },
        {
          groupName: group.name,
          groupEmoji: group.emoji || '',
          memberName: member.name || 'there',
          targetEventDate: targetDate.toISOString(),
          pulseLink: `${process.env.REPLIT_DEPLOYMENT_URL || 'https://kinmo.ai'}/availability/${pulse.id}/${response.responseToken}`,
          deadline: expiresAt.toISOString(),
        }
      );
    } catch (emailError) {
      console.error(`[AvailabilityPulse] Failed to send email to ${member.email}:`, emailError);
    }
  }

  // Mark email as sent
  await storage.updatePulseEmailSentAt(pulse.id);

  console.log(`[AvailabilityPulse] Created pulse ${pulse.id} and sent ${membersWithEmail.length} emails`);
  return true;
}

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
          // For rescheduled events, skip nudges — the reschedule email already served
          // as the re-invite. Only the day-before confirmation is worth sending.
          if (
            (reminder.type === 'gentle_nudge' || reminder.type === 'final_call') &&
            (itinerary.rescheduleAttempts ?? 0) > 0
          ) {
            continue;
          }

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

        // Fetch RSVPs to suppress in-app nudges for members who already responded
        const nudgeRsvps = await db
          .select({ memberId: rsvpsTable.memberId })
          .from(rsvpsTable)
          .where(sql`itinerary_id = ${itinerary.id} AND (is_guest IS NULL OR is_guest = false)`);
        const respondedMemberIds = new Set(nudgeRsvps.map(r => r.memberId).filter(Boolean));
        const pendingMemberIds = groupMembers
          .map(m => m.id)
          .filter(id => !respondedMemberIds.has(id));

        if (pendingMemberIds.length > 0) {
          const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;
          const hoursUntilDeadline = rsvpDeadline
            ? Math.round((rsvpDeadline.getTime() - Date.now()) / (1000 * 60 * 60))
            : 24;

          await notifyRSVPReminder({
            itineraryId: itinerary.id,
            groupId: group.id,
            eventName: itinerary.name || 'Upcoming Event',
            memberIds: pendingMemberIds,
            hoursUntilDeadline
          });
          console.log(`[Notifications] Sent in-app RSVP reminders to ${pendingMemberIds.length} non-responders for ${reminderType}`);
        }
      } catch (notifyError) {
        console.error('[Notifications] Error sending RSVP reminder notifications:', notifyError);
      }
    }

    // Fetch all RSVPs for this itinerary once — used to filter recipients below
    const existingRsvps = await db
      .select({ memberId: rsvpsTable.memberId, response: rsvpsTable.response })
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itinerary.id} AND (is_guest IS NULL OR is_guest = false)`);

    const rsvpByMember = new Map(existingRsvps.map(r => [r.memberId, r.response]));

    let eligibleMembers = groupMembers.filter(m => m.email);

    if (reminderType === 'gentle_nudge' || reminderType === 'final_call') {
      // Only ping members who haven't responded yet — if you already said yes or no, no more nudges
      eligibleMembers = eligibleMembers.filter(m => !rsvpByMember.has(m.id));
    } else if (reminderType === 'day_before') {
      // Day-before confirmation only goes to people who said yes
      eligibleMembers = eligibleMembers.filter(m => {
        const r = rsvpByMember.get(m.id);
        return r === 'yes' || r === 'going';
      });
    }

    if (eligibleMembers.length === 0) {
      // Log as skipped so it doesn't re-trigger
      await db.insert(reminderLogs).values({
        itineraryId: itinerary.id,
        reminderType,
        recipientEmail: 'no-recipients',
        emailStatus: 'skipped',
      });
      console.log(`[Reminders] No eligible recipients for ${reminderType} (all already RSVPed or no yes-RSVPs), logged as skipped`);
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

    // Send to each eligible member with their unique RSVP link
    for (const member of eligibleMembers) {
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

    console.log(`Sent ${eligibleMembers.length} ${reminderType} reminders for itinerary ${itinerary.id}`);
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

      // Skip dormant groups so we don't burn 3x gpt-4o per day for nothing.
      if (!(await isGroupActive(group.id))) {
        console.log(`[Auto-Schedule] ⏭️  Skipping dormant group "${group.name}" (${group.id}) — no activity in window`);
        continue;
      }

      // Try to trigger an availability pulse if we're in the right window
      // This gives members a chance to submit their real calendar availability before we pick a date
      try {
        await triggerAvailabilityPulseIfNeeded(group);
      } catch (pulseError) {
        console.error(`[AvailabilityPulse] Error checking pulse for group ${group.name}:`, pulseError);
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
              name: group.name,
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
              name: group.name,
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

          // Check for active availability pulse with responses
          let pulseAvailability: {
            aggregated: Record<string, { morning: number; afternoon: number; evening: number }>;
            totalResponses: number;
            memberCount: number;
          } | undefined;

          try {
            const activePulse = await storage.getActivePulseForGroup(group.id);
            if (activePulse && activePulse.responseCount > 0) {
              const { aggregated, totalResponses } = await storage.getAggregatedPulseAvailability(activePulse.id);
              if (totalResponses > 0 && Object.keys(aggregated).length > 0) {
                pulseAvailability = {
                  aggregated,
                  totalResponses,
                  memberCount: activePulse.memberCount,
                };
                console.log(`[Auto-Schedule] Using pulse availability: ${totalResponses}/${activePulse.memberCount} responses, ${Object.keys(aggregated).length} dates`);
              }
            }
          } catch (pulseError) {
            console.error('[Auto-Schedule] Error fetching pulse availability:', pulseError);
            // Continue without pulse data
          }

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
            pulseAvailability, // Pass date-specific availability from pulse responses
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

      // Skip dormant groups — drafting AI itineraries for groups no one is using
      // wastes OpenAI tokens on plans that will never be reviewed.
      if (!(await isGroupActive(group.id))) {
        console.log(`[Auto-Draft] ⏭️  Skipping dormant group "${group.name}" (${group.id}) — no activity in window`);
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

        // Update itinerary to proposed status with event date and adaptive schedule config
        const scheduleConfig = calculateScheduleConfig(group.meetingFrequency);
        const eventDate = new Date(event.proposedDate);
        const rsvpDeadline = addDays(eventDate, -scheduleConfig.rsvpDeadlineDays);

        await storage.updateItinerary(itinerary.id, {
          status: 'proposed',
          eventDate: event.proposedDate,
          rsvpDeadline,
          autoScheduleConfig: {
            inviteAdvanceDays: scheduleConfig.inviteAdvanceDays,
            rsvpWindowDays: scheduleConfig.rsvpWindowDays,
            reminders: scheduleConfig.reminders,
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

/**
 * Check for events where the RSVP deadline has passed (+ 24h grace) but quorum hasn't been met.
 *
 * Decision logic:
 *   0-1 respondents → default rule (skip if weekly or less, reschedule if biweekly+)
 *   2+ respondents below quorum → send check-in: "still want to meet?"
 *   Quorum met → do nothing
 *   Max reschedule attempts exhausted → cancel
 *   Standalone events → skipped entirely
 *
 * Runs daily.
 */
async function processQuorumChecks(): Promise<void> {
  try {
    console.log('[Quorum Check] Checking for events past RSVP deadline + 24h grace...');

    // Deadline + 24h grace period must have passed, event still in future, not already resolved
    const overdueItineraries = await db
      .select()
      .from(itineraries)
      .where(
        and(
          sql`${itineraries.rsvpDeadline} IS NOT NULL`,
          sql`${itineraries.rsvpDeadline} + INTERVAL '24 hours' < NOW()`,
          sql`${itineraries.eventDate} > NOW()`,
          not(inArray(itineraries.status, ['rejected', 'cancelled'])),
          // Skip standalones — organizer's call, never auto-reschedule
          eq(itineraries.isStandalone, false),
          // Skip itineraries already in check-in flow
          sql`${itineraries.quorumCheckinSentAt} IS NULL`,
        )
      );

    if (overdueItineraries.length === 0) {
      console.log('[Quorum Check] No overdue itineraries found');
      return;
    }

    console.log(`[Quorum Check] Found ${overdueItineraries.length} itinerary/itineraries to evaluate`);

    const { checkAndReschedule } = await import('./auto-reschedule');

    for (const itinerary of overdueItineraries) {
      try {
        if (!itinerary.groupId) continue;

        const group = await storage.getGroup(itinerary.groupId);
        if (!group) continue;

        // All RSVPs excluding guests
        const allRsvps = await db
          .select()
          .from(rsvpsTable)
          .where(sql`itinerary_id = ${itinerary.id} AND (is_guest IS NULL OR is_guest = false)`);

        const yesRsvps = allRsvps.filter(r => r.response === 'yes' || r.response === 'going');
        const yesCount = yesRsvps.length;
        const totalResponded = allRsvps.length;

        const groupMembers = await storage.getGroupMembers(itinerary.groupId);
        const memberCount = groupMembers.length;
        const quorumThreshold = group.defaultQuorumThreshold ?? 50;
        const requiredYes = Math.max(1, Math.ceil(memberCount * quorumThreshold / 100));

        if (yesCount >= requiredYes) {
          console.log(`[Quorum Check] ${itinerary.id}: quorum met (${yesCount}/${requiredYes}), skipping`);
          continue;
        }

        const rescheduleAttempts = itinerary.rescheduleAttempts || 0;
        const cycleDays = calculateCadenceInDays(group.meetingFrequency);
        const shouldSkipByDefault = cycleDays <= 7;

        console.log(`[Quorum Check] ${itinerary.id}: below quorum (${yesCount}/${requiredYes} yes, ${totalResponded} total responded)`);

        // 2+ respondents on a group where rescheduling makes sense → send check-in
        if (totalResponded >= 2 && !shouldSkipByDefault) {
          console.log(`[Quorum Check] ${itinerary.id}: sending check-in to ${totalResponded} respondents`);
          await sendQuorumCheckin(itinerary, group, allRsvps, groupMembers, requiredYes);
          continue;
        }

        // Default rule: skip (weekly) or reschedule (biweekly+)
        if (shouldSkipByDefault) {
          console.log(`[Quorum Check] ${itinerary.id}: weekly cadence + no quorum → skipping this week`);
          await storage.updateItinerary(itinerary.id, { status: 'cancelled' });
          continue;
        }

        if (rescheduleAttempts >= 2) {
          console.log(`[Quorum Check] ${itinerary.id}: max reschedule attempts, cancelling`);
          await storage.updateItinerary(itinerary.id, { status: 'cancelled' });
          continue;
        }

        console.log(`[Quorum Check] ${itinerary.id}: rescheduling (attempt ${rescheduleAttempts + 1}/2)`);
        await checkAndReschedule(itinerary.id, { forceReschedule: true });

      } catch (itineraryError: any) {
        console.error(`[Quorum Check] Error processing itinerary ${itinerary.id}:`, itineraryError);
      }
    }

    console.log('[Quorum Check] Finished');
  } catch (error: any) {
    console.error('[Quorum Check] Error in processQuorumChecks:', error);
  }
}

/**
 * Send a soft check-in to respondents asking if they still want to meet despite being below quorum.
 * Records the timestamp so processQuorumCheckinResults can evaluate after 24h.
 */
async function sendQuorumCheckin(
  itinerary: any,
  group: any,
  allRsvps: any[],
  groupMembers: any[],
  requiredYes: number,
): Promise<void> {
  await storage.updateItinerary(itinerary.id, {
    quorumCheckinSentAt: new Date(),
    quorumCheckinResponses: {},
  });

  const { sendQuorumCheckinEmail } = await import('./email-service');

  for (const rsvp of allRsvps) {
    const member = rsvp.memberId
      ? groupMembers.find((m: any) => m.id === rsvp.memberId)
      : null;
    if (!member?.email) continue;

    const [invite] = await db
      .select({ inviteToken: itineraryInvites.inviteToken })
      .from(itineraryInvites)
      .where(and(eq(itineraryInvites.itineraryId, itinerary.id), eq(itineraryInvites.memberId, member.id)))
      .limit(1);

    if (!invite?.inviteToken) continue;

    await sendQuorumCheckinEmail(
      { email: member.email, name: member.name || 'there' },
      {
        groupName: group.name,
        eventDate: new Date(itinerary.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        keepLink: `https://kinmo.ai/api/itineraries/${itinerary.id}/quorum-checkin/${invite.inviteToken}?response=keep`,
        rescheduleLink: `https://kinmo.ai/api/itineraries/${itinerary.id}/quorum-checkin/${invite.inviteToken}?response=reschedule`,
        respondedCount: allRsvps.length,
        requiredYes,
      },
    ).catch((e: unknown) => console.error(`[Quorum Check] Failed to send check-in to ${member.email}:`, e));
  }
}

/**
 * Evaluate check-in responses 24h after they were sent.
 * Decision: 2+ say keep → proceed. Tie or majority reschedule → default rule.
 * Runs daily.
 */
async function processQuorumCheckinResults(): Promise<void> {
  try {
    console.log('[Quorum Checkin] Evaluating check-in responses...');

    const pendingCheckins = await db
      .select()
      .from(itineraries)
      .where(
        and(
          sql`${itineraries.quorumCheckinSentAt} IS NOT NULL`,
          sql`${itineraries.quorumCheckinSentAt} + INTERVAL '24 hours' < NOW()`,
          sql`${itineraries.eventDate} > NOW()`,
          not(inArray(itineraries.status, ['rejected', 'cancelled'])),
        )
      );

    if (pendingCheckins.length === 0) {
      console.log('[Quorum Checkin] No pending check-ins to evaluate');
      return;
    }

    const { checkAndReschedule } = await import('./auto-reschedule');

    for (const itinerary of pendingCheckins) {
      try {
        if (!itinerary.groupId) continue;

        const group = await storage.getGroup(itinerary.groupId);
        if (!group) continue;

        const responses = (itinerary.quorumCheckinResponses as Record<string, 'keep' | 'reschedule'>) || {};
        const keepVotes = Object.values(responses).filter(v => v === 'keep').length;
        const rescheduleVotes = Object.values(responses).filter(v => v === 'reschedule').length;

        console.log(`[Quorum Checkin] ${itinerary.id}: ${keepVotes} keep, ${rescheduleVotes} reschedule`);

        const cycleDays = calculateCadenceInDays(group.meetingFrequency);
        const shouldSkipByDefault = cycleDays <= 7;
        const rescheduleAttempts = itinerary.rescheduleAttempts || 0;

        if (keepVotes >= 2 && keepVotes > rescheduleVotes) {
          // Enough people want to meet — proceed as-is, clear check-in state
          console.log(`[Quorum Checkin] ${itinerary.id}: ${keepVotes} want to keep it, proceeding`);
          await storage.updateItinerary(itinerary.id, {
            quorumCheckinSentAt: null,
            quorumCheckinResponses: null,
          });
          continue;
        }

        // Tie, majority reschedule, or no replies → default rule
        if (shouldSkipByDefault) {
          console.log(`[Quorum Checkin] ${itinerary.id}: defaulting to skip`);
          await storage.updateItinerary(itinerary.id, { status: 'cancelled' });
        } else if (rescheduleAttempts >= 2) {
          console.log(`[Quorum Checkin] ${itinerary.id}: max attempts reached, cancelling`);
          await storage.updateItinerary(itinerary.id, { status: 'cancelled' });
        } else {
          console.log(`[Quorum Checkin] ${itinerary.id}: rescheduling`);
          await checkAndReschedule(itinerary.id, { forceReschedule: true });
        }

      } catch (err: any) {
        console.error(`[Quorum Checkin] Error processing itinerary ${itinerary.id}:`, err);
      }
    }

    console.log('[Quorum Checkin] Finished');
  } catch (error: any) {
    console.error('[Quorum Checkin] Error in processQuorumCheckinResults:', error);
  }
}

// Run every 5 minutes for reminders, once per day for auto-scheduling
export function startReminderScheduler(): void {
  const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const AUTO_SCHEDULE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const AUTO_SEND_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const AUTO_APPROVAL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  console.log('Starting reminder scheduler with job tracking...');

  // Create tracked job runners for all background tasks
  const trackedReminders = createTrackedJob('scheduledReminders', processScheduledReminders, { intervalMs: REMINDER_INTERVAL_MS });
  const trackedAutoScheduling = createTrackedJob('autoScheduling', processAutoScheduling, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });
  const trackedAutoSend = createTrackedJob('autoSend', processAutoSend, { intervalMs: AUTO_SEND_INTERVAL_MS });
  const trackedAutoApproval = createTrackedJob('autoApproval', checkAndAutoApproveEvents, { intervalMs: AUTO_APPROVAL_INTERVAL_MS });
  const trackedAutoSuggestions = createTrackedJob('autoSuggestions', autoProcessSuggestions, { intervalMs: AUTO_APPROVAL_INTERVAL_MS });
  const trackedTimeSlots = createTrackedJob('timeSlotSelection', checkAndSelectTimeSlots, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });
  const trackedAutoDrafts = createTrackedJob('autoDraftItineraries', processAutoDraftItineraries, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });
  const trackedQuorumChecks = createTrackedJob('quorumChecks', processQuorumChecks, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });
  const trackedQuorumCheckins = createTrackedJob('quorumCheckinResults', processQuorumCheckinResults, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });

  // Run reminders immediately and every 5 minutes
  trackedReminders();
  setInterval(trackedReminders, REMINDER_INTERVAL_MS);

  // Run auto-scheduling immediately and daily
  trackedAutoScheduling();
  setInterval(trackedAutoScheduling, AUTO_SCHEDULE_INTERVAL_MS);

  // Run auto-send immediately and every hour
  trackedAutoSend();
  setInterval(trackedAutoSend, AUTO_SEND_INTERVAL_MS);

  // Run auto-approval check immediately and every hour
  trackedAutoApproval();
  setInterval(trackedAutoApproval, AUTO_APPROVAL_INTERVAL_MS);

  // Run auto-process suggestions immediately and every hour
  trackedAutoSuggestions();
  setInterval(trackedAutoSuggestions, AUTO_APPROVAL_INTERVAL_MS);

  // Run time slot selection immediately and daily
  trackedTimeSlots();
  setInterval(trackedTimeSlots, AUTO_SCHEDULE_INTERVAL_MS);

  // Run auto-draft itinerary creation immediately and daily
  trackedAutoDrafts();
  setInterval(trackedAutoDrafts, AUTO_SCHEDULE_INTERVAL_MS);

  // Run quorum checks and check-in evaluation immediately and daily
  trackedQuorumChecks();
  setInterval(trackedQuorumChecks, AUTO_SCHEDULE_INTERVAL_MS);

  trackedQuorumCheckins();
  setInterval(trackedQuorumCheckins, AUTO_SCHEDULE_INTERVAL_MS);

  // Run weekly swipe digest (checks every day, only runs on Monday)
  const processWeeklySwipeDigest = async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Only run on Mondays
    if (dayOfWeek === 1) {
      const { processWeeklyDigests } = await import('./swipe-digest-worker');
      await processWeeklyDigests();
    }
  };

  const trackedWeeklyDigest = createTrackedJob('weeklySwipeDigest', processWeeklySwipeDigest, { intervalMs: AUTO_SCHEDULE_INTERVAL_MS });
  trackedWeeklyDigest();
  setInterval(trackedWeeklyDigest, AUTO_SCHEDULE_INTERVAL_MS);

  // Auto-Refresh Stale Activities - runs daily
  const ACTIVITY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const processActivityRefresh = async () => {
    const { refreshStaleActivityPools } = await import('./activity-refresh-worker');
    await refreshStaleActivityPools();
  };

  const trackedActivityRefresh = createTrackedJob('activityRefresh', processActivityRefresh, { intervalMs: ACTIVITY_REFRESH_INTERVAL_MS });
  trackedActivityRefresh();
  setInterval(trackedActivityRefresh, ACTIVITY_REFRESH_INTERVAL_MS);

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

  const trackedEventCleanup = createTrackedJob('eventCleanup', processOldEventCleanup, { intervalMs: CLEANUP_INTERVAL_MS });
  trackedEventCleanup();
  setInterval(trackedEventCleanup, CLEANUP_INTERVAL_MS);

  // Cleanup past rejected dates - runs daily alongside event cleanup
  const cleanupPastRejectedDates = async () => {
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
  };

  const trackedRejectedDatesCleanup = createTrackedJob('rejectedDatesCleanup', cleanupPastRejectedDates, { intervalMs: CLEANUP_INTERVAL_MS });
  trackedRejectedDatesCleanup();
  setInterval(trackedRejectedDatesCleanup, CLEANUP_INTERVAL_MS);

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

          // Only notify members who actually said yes — no point asking someone
          // for feedback on an event they didn't attend
          const yesRsvps = await db
            .select({ memberId: rsvpsTable.memberId })
            .from(rsvpsTable)
            .where(sql`itinerary_id = ${itinerary.id} AND response IN ('yes', 'going') AND member_id IS NOT NULL AND (is_guest IS NULL OR is_guest = false)`);

          const memberIds = yesRsvps.map(r => r.memberId).filter(Boolean) as string[];

          if (memberIds.length === 0) {
            console.log(`[Feedback Request] No yes-RSVPs for itinerary ${itinerary.id}, skipping`);
            await db.insert(reminderLogs).values({
              itineraryId: itinerary.id,
              reminderType: 'feedback_request',
              recipientEmail: 'no-attendees',
              emailStatus: 'skipped',
            });
            continue;
          }

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

  const trackedFeedbackRequests = createTrackedJob('feedbackRequests', processPostEventFeedbackRequests, { intervalMs: FEEDBACK_REQUEST_INTERVAL_MS });
  trackedFeedbackRequests();
  setInterval(trackedFeedbackRequests, FEEDBACK_REQUEST_INTERVAL_MS);

  // Planning Agent - runs daily to generate proactive insights
  const PLANNING_AGENT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const runPlanningAgentTask = async () => {
    console.log('[Planning Agent] Starting scheduled run...');
    const { runPlanningAgent } = await import('./planning-agent');
    await runPlanningAgent();
  };

  const trackedPlanningAgent = createTrackedJob('planningAgent', runPlanningAgentTask, { intervalMs: PLANNING_AGENT_INTERVAL_MS });

  // Run after a short delay on startup (give other systems time to initialize)
  setTimeout(trackedPlanningAgent, 60000); // 1 minute after startup
  setInterval(trackedPlanningAgent, PLANNING_AGENT_INTERVAL_MS);

  // Database Backup - runs daily
  const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const processAutoDatabaseBackup = async () => {
    console.log('[Database Backup] Starting scheduled backup...');
    const backup = await storage.createDatabaseBackup(
      'daily_auto',
      undefined,
      `Automated daily backup - ${new Date().toISOString().split('T')[0]}`
    );
    console.log(`[Database Backup] ✓ Created backup ${backup.id}`);

    // Keep only last 30 auto backups
    await storage.pruneDatabaseBackups(30);
    console.log('[Database Backup] ✓ Cleanup complete');
  };

  const trackedDatabaseBackup = createTrackedJob('databaseBackup', processAutoDatabaseBackup, { intervalMs: BACKUP_INTERVAL_MS });

  // Run after 1 minute on startup, then every 24 hours
  setTimeout(trackedDatabaseBackup, 60000);
  setInterval(trackedDatabaseBackup, BACKUP_INTERVAL_MS);

  // Daily API cost report - aggregates api_call_logs and prints a per-service
  // summary. Closes the observability gap so "is the system efficient now?"
  // has an answer in Railway logs once a day.
  const COST_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const runCostReport = async () => {
    const { generateDailyCostReport } = await import('./cost-report');
    await generateDailyCostReport(24);
  };
  const trackedCostReport = createTrackedJob('dailyCostReport', runCostReport, { intervalMs: COST_REPORT_INTERVAL_MS });
  setTimeout(trackedCostReport, 90000); // 1.5 min after startup, after backup
  setInterval(trackedCostReport, COST_REPORT_INTERVAL_MS);

  console.log('Reminder scheduler started successfully');
}
