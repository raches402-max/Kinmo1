import { db } from './db';
import { itineraries, members, reminderLogs, groups, autoScheduledEvents, itineraryInvites } from '../shared/schema';
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
import { selectBestItineraryForAutoSchedule, shouldTriggerAutoSchedule } from './auto-scheduler';
import { randomBytes } from 'crypto';

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
      const eventDate = new Date(itinerary.eventDate);

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

async function sendInitialInvites(itinerary: any, group: any): Promise<void> {
  try {
    // Get all group members with emails
    const groupMembers = await db
      .select()
      .from(members)
      .where(eq(members.groupId, group.id));

    const membersWithEmails = groupMembers.filter(m => m.email);

    if (membersWithEmails.length === 0) {
      console.log('No recipients with emails for itinerary:', itinerary.id);
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
      if (shouldTriggerAutoSchedule(group, !!pendingEvent)) {
        console.log(`Creating auto-scheduled event for group: ${group.name}`);
        
        // Select best itinerary/venues for this event
        const selection = await selectBestItineraryForAutoSchedule(storage, group);
        
        if (!selection.itineraryId && (!selection.selectedVenues || selection.selectedVenues.length === 0)) {
          console.log(`No viable options for auto-scheduling group ${group.name}`);
          continue;
        }

        // Create or duplicate itinerary for this auto-event
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
            console.log(`[Auto-Schedule] Could not fetch itinerary ${itineraryId}`);
            continue;
          }

          const venues = itinerary.items.map((item: any) => ({
            name: item.venueName,
            type: item.venueType,
          }));

          // Aggregate member availability
          const { aggregateMemberAvailability, convertAvailabilityToText } = await import('./availability-utils');
          const aggregatedAvailability = await aggregateMemberAvailability(group.id, storage);

          console.log(`[Auto-Schedule] Using aggregated availability from ${aggregatedAvailability.memberCount} members`);

          // Convert to text format for AI
          const availabilityString = convertAvailabilityToText(
            aggregatedAvailability.grid,
            aggregatedAvailability.conflicts,
            aggregatedAvailability.memberCount
          );

          // Use AI to find optimal time
          const { suggestOptimalTime } = await import('./ai-time-picker');
          const timeResult = await suggestOptimalTime({
            generalAvailability: availabilityString,
            venues,
            location: group.locationBase,
            meetingFrequency: group.meetingFrequency || undefined,
            timezone: group.timezone || undefined, // Use stored timezone
          });

          proposedDate = timeResult.eventDate;
          console.log(`[Auto-Schedule] AI suggested optimal time: ${proposedDate.toISOString()}, reasoning: ${timeResult.reasoning}`);
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

        // Create auto-scheduled event record
        await storage.createAutoScheduledEvent({
          groupId: group.id,
          itineraryId,
          proposedDate,
          autoSendAt,
          status: 'pending',
        });

        console.log(`Created pending auto-event for group ${group.name}, proposed date: ${proposedDate.toISOString()}, auto-send at: ${autoSendAt.toISOString()} (48hr volunteer window)`);
      }
    }
  } catch (error) {
    console.error('Error processing auto-scheduling:', error);
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
        const inviteAdvanceDays = 14;
        const eventDate = new Date(event.proposedDate);
        const rsvpDeadline = addDays(eventDate, -3);
        
        await storage.updateItinerary(itinerary.id, {
          status: 'proposed',
          eventDate: event.proposedDate,
          rsvpDeadline,
          autoScheduleConfig: {
            inviteAdvanceDays,
            rsvpWindowDays: 11,
            reminders: [
              { type: 'gentle_nudge', daysBeforeDeadline: 7 },
              { type: 'final_call', daysBeforeDeadline: 1 },
              { type: 'day_before', daysBeforeEvent: 1 }
            ]
          }
        });

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

// Run every 5 minutes for reminders, once per day for auto-scheduling
export function startReminderScheduler(): void {
  const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const AUTO_SCHEDULE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const AUTO_SEND_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  console.log('Starting reminder scheduler...');
  
  // Run reminders immediately and every 5 minutes
  processScheduledReminders();
  setInterval(() => {
    processScheduledReminders();
  }, REMINDER_INTERVAL_MS);

  // Run auto-scheduling immediately and daily
  processAutoScheduling();
  setInterval(() => {
    processAutoScheduling();
  }, AUTO_SCHEDULE_INTERVAL_MS);

  // Run auto-send immediately and every hour
  processAutoSend();
  setInterval(() => {
    processAutoSend();
  }, AUTO_SEND_INTERVAL_MS);
}
