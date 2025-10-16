import { db } from './db';
import { itineraries, members, reminderLogs, groups } from '../shared/schema';
import { eq, and, isNull, sql, or, lt } from 'drizzle-orm';
import {
  sendItineraryInvite,
  sendGentleNudge,
  sendFinalCall,
  sendDayBeforeReminder,
  type EmailRecipient,
  type ItineraryInviteData,
  type ReminderData,
} from './email-service';

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

    const recipients: EmailRecipient[] = groupMembers
      .filter(m => m.email)
      .map(m => ({
        email: m.email!,
        name: m.name || 'there',
      }));

    if (recipients.length === 0) {
      console.log('No recipients with emails for itinerary:', itinerary.id);
      return;
    }

    // Get itinerary items (venues)
    const items = await db.query.itineraryItems.findMany({
      where: eq(itineraries.id, itinerary.id),
    });

    const eventDate = new Date(itinerary.eventDate);
    const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;

    const inviteData: ItineraryInviteData = {
      groupName: group.name,
      organizerName: group.name, // Could enhance this with actual organizer name
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
      rsvpLink: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/invite/${group.shareableLink}`,
    };

    // Send to all recipients
    for (const recipient of recipients) {
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

    console.log(`Sent ${recipients.length} initial invites for itinerary ${itinerary.id}`);
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

    let recipients: EmailRecipient[] = [];

    if (reminderType === 'day_before') {
      // Send to everyone who RSVP'd yes
      // For now, send to all members with emails
      recipients = groupMembers
        .filter(m => m.email)
        .map(m => ({
          email: m.email!,
          name: m.name || 'there',
        }));
    } else {
      // Send nudge/final call only to people who haven't RSVP'd
      // For now, send to all members (can enhance with RSVP tracking)
      recipients = groupMembers
        .filter(m => m.email)
        .map(m => ({
          email: m.email!,
          name: m.name || 'there',
        }));
    }

    if (recipients.length === 0) {
      return;
    }

    const eventDate = new Date(itinerary.eventDate);
    const rsvpDeadline = itinerary.rsvpDeadline ? new Date(itinerary.rsvpDeadline) : null;

    const reminderData: ReminderData = {
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
      rsvpLink: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/invite/${group.shareableLink}`,
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

    // Send to all recipients
    for (const recipient of recipients) {
      const result = await sendFunction(recipient, reminderData);
      
      // Log the attempt
      await db.insert(reminderLogs).values({
        itineraryId: itinerary.id,
        reminderType,
        recipientEmail: recipient.email,
        emailStatus: result.success ? 'sent' : 'failed',
      });
    }

    console.log(`Sent ${recipients.length} ${reminderType} reminders for itinerary ${itinerary.id}`);
  } catch (error) {
    console.error(`Error sending ${reminderType} reminders:`, error);
  }
}

// Run every 5 minutes
export function startReminderScheduler(): void {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  console.log('Starting reminder scheduler...');
  
  // Run immediately on start
  processScheduledReminders();
  
  // Then run every 5 minutes
  setInterval(() => {
    processScheduledReminders();
  }, INTERVAL_MS);
}
