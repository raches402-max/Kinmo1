/**
 * Notification Service
 * Handles creation and management of in-app notifications
 */

import { db } from "./db";
import { notifications, users, itineraries, groups } from "@shared/schema";
import type { InsertNotification, Notification } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Clean up event names for user-facing display.
 */
function getDisplayEventName(eventName: string, groupName?: string): string {
  const cleanName = eventName
    .replace(/\s*\(Auto-Scheduled\)\s*/i, '')
    .trim();

  // If the name is empty, use group name or fallback
  if (!cleanName || cleanName === groupName) {
    return groupName || 'Upcoming Event';
  }

  return cleanName;
}

export type NotificationType =
  | 'event_invite'
  | 'rsvp_reminder'
  | 'event_update'
  | 'time_selected'
  | 'feedback_request'
  | 'venue_change'
  | 'event_cancelled';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    eventId?: string;
    groupId?: string;
    itineraryId?: string;
    [key: string]: any;
  };
}

/**
 * Create a new notification for a user
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification> {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      read: false,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    })
    .returning();

  console.log(`[Notifications] Created ${params.type} notification for user ${params.userId}`);

  return notification;
}

/**
 * Create event invite notifications for all group members
 */
export async function notifyEventInvite(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  memberIds: string[];
  eventDate?: Date | string | null;
  venueName?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, memberIds, eventDate, venueName } = params;
  const displayName = getDisplayEventName(eventName, groupName);

  // Format date for title if available
  let dateStr = '';
  if (eventDate) {
    const date = new Date(eventDate);
    dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Build scannable title: "RSVP: Fri Dec 13 dinner"
  const title = dateStr ? `RSVP: ${dateStr}` : `RSVP: ${displayName}`;

  // Build concise message with venue if available
  const message = venueName
    ? `${venueName}${groupName ? ` · ${groupName}` : ''}`
    : displayName;

  // Get member user IDs
  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId) // Only notify members with user accounts
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'event_invite',
        title,
        message,
        actionUrl: `/event/${itineraryId}`,
        actionLabel: 'RSVP',
        metadata: {
          itineraryId,
          groupId,
          eventDate: eventDate ? new Date(eventDate).toISOString() : null,
          venueName,
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} event invite notifications`);

  return results;
}

/**
 * Create RSVP reminder notifications
 */
export async function notifyRSVPReminder(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  memberIds: string[];
  hoursUntilDeadline: number;
  eventDate?: Date | string | null;
  venueName?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, memberIds, hoursUntilDeadline, eventDate, venueName } = params;
  const displayName = getDisplayEventName(eventName, groupName);

  // Format urgency for title
  let urgencyText: string;
  if (hoursUntilDeadline <= 2) {
    urgencyText = 'Last call';
  } else if (hoursUntilDeadline <= 24) {
    urgencyText = `${hoursUntilDeadline}h left`;
  } else {
    const days = Math.ceil(hoursUntilDeadline / 24);
    urgencyText = `${days}d left`;
  }

  // Format date if available
  let dateContext = '';
  if (eventDate) {
    const date = new Date(eventDate);
    dateContext = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Title: "RSVP needed · 2h left" or "Last call to RSVP"
  const title = hoursUntilDeadline <= 2
    ? `Last call to RSVP`
    : `RSVP needed · ${urgencyText}`;

  // Message: "Fri Dec 13 at Marufuku" or just the venue/event name
  const message = dateContext
    ? `${dateContext}${venueName ? ` at ${venueName}` : ''}`
    : venueName || displayName;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const membersWithUsers = memberData.filter(member => member.userId);
  const userIds = membersWithUsers.map(m => m.userId!);

  // Deduplication: Check for existing RSVP reminder notifications for this itinerary
  const existingNotifications = userIds.length > 0
    ? await db.query.notifications.findMany({
        where: (notifs, { and, eq, inArray, sql }) => and(
          inArray(notifs.userId, userIds),
          eq(notifs.type, 'rsvp_reminder'),
          sql`${notifs.metadata}::jsonb->>'itineraryId' = ${itineraryId}`
        ),
      })
    : [];

  const usersWithExistingNotification = new Set(existingNotifications.map(n => n.userId));
  const membersToNotify = membersWithUsers.filter(m => !usersWithExistingNotification.has(m.userId!));

  if (membersToNotify.length === 0) {
    console.log(`[Notifications] Skipped RSVP reminders - all ${userIds.length} users already have notifications for itinerary ${itineraryId}`);
    return [];
  }

  const notificationPromises = membersToNotify.map(member =>
    createNotification({
      userId: member.userId!,
      type: 'rsvp_reminder',
      title,
      message,
      actionUrl: `/event/${itineraryId}`,
      actionLabel: 'RSVP',
      metadata: {
        itineraryId,
        groupId,
        hoursUntilDeadline,
        eventDate: eventDate ? new Date(eventDate).toISOString() : null,
        venueName,
      }
    })
  );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} RSVP reminder notifications (skipped ${usersWithExistingNotification.size} existing)`);

  return results;
}

/**
 * Notify about event time being selected/finalized
 */
export async function notifyTimeSelected(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  selectedTime: string;
  memberIds: string[];
  venueName?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, selectedTime, memberIds, venueName } = params;
  const displayName = getDisplayEventName(eventName, groupName);

  // Title: "Confirmed: Sat Dec 14 @ 7pm"
  const title = `Confirmed: ${selectedTime}`;

  // Message: "Marufuku Ramen · Book Club" or just the event name
  const message = venueName
    ? `${venueName}${groupName ? ` · ${groupName}` : ''}`
    : displayName;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'time_selected',
        title,
        message,
        actionUrl: `/event/${itineraryId}`,
        actionLabel: 'View',
        metadata: {
          itineraryId,
          groupId,
          selectedTime,
          venueName,
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} time selected notifications`);

  return results;
}

/**
 * Request post-event feedback
 */
export async function notifyFeedbackRequest(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  memberIds: string[];
  venueName?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, memberIds, venueName } = params;
  const displayName = getDisplayEventName(eventName, groupName);

  // Title: "How was Marufuku?" or "How was dinner?"
  const title = venueName ? `How was ${venueName}?` : 'How was the event?';

  // Message: one-tap framing matches the dialog's default mode (A.7)
  const message = 'One tap to let us know how it went';

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'feedback_request',
        title,
        message,
        actionUrl: `/event/${itineraryId}?feedback=true`,
        actionLabel: 'Rate',
        metadata: {
          itineraryId,
          groupId
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} feedback request notifications`);

  return results;
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(userId: string, options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<Notification[]> {
  const queryLimit = options?.limit || 50;
  const queryOffset = options?.offset || 0;

  const whereCondition = options?.unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId);

  const results = await db
    .select()
    .from(notifications)
    .where(whereCondition)
    .orderBy(desc(notifications.createdAt))
    .limit(queryLimit)
    .offset(queryOffset);

  return results;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ));

  return result.length;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId));

  console.log(`[Notifications] Marked notification ${notificationId} as read`);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false)
    ));

  console.log(`[Notifications] Marked all notifications as read for user ${userId}`);
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(eq(notifications.id, notificationId));

  console.log(`[Notifications] Deleted notification ${notificationId}`);
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(eq(notifications.userId, userId));

  console.log(`[Notifications] Deleted all notifications for user ${userId}`);
}

/**
 * Notify about event cancellation
 */
export async function notifyEventCancelled(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  memberIds: string[];
  eventDate?: Date | null;
  venueName?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, memberIds, eventDate, venueName } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  // Format date for title
  let dateStr = '';
  if (eventDate) {
    dateStr = new Date(eventDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  // Title: "Cancelled: Fri Dec 13" or "Event cancelled"
  const title = dateStr ? `Cancelled: ${dateStr}` : 'Event cancelled';

  // Message: "Marufuku · Book Club" or just group name
  const message = venueName
    ? `${venueName}${groupName ? ` · ${groupName}` : ''}`
    : groupName || 'Check group for details';

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'event_cancelled',
        title,
        message,
        actionUrl: `/groups/${groupId}`,
        actionLabel: 'View',
        metadata: {
          itineraryId,
          groupId,
          eventDate: eventDate?.toISOString(),
          venueName
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} event cancelled notifications`);

  return results;
}

/**
 * Notify about event/venue updates
 */
export async function notifyEventUpdate(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  groupName?: string;
  updateType: 'venue_change' | 'time_change' | 'general';
  memberIds: string[];
  eventDate?: Date | string | null;
  newVenueName?: string | null;
  newTime?: string | null;
}) {
  const { itineraryId, groupId, eventName, groupName, updateType, memberIds, eventDate, newVenueName, newTime } = params;
  const displayName = getDisplayEventName(eventName, groupName);

  // Format date for context
  let dateStr = '';
  if (eventDate) {
    const date = new Date(eventDate);
    dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Build scannable title based on update type
  const titles: Record<string, string> = {
    venue_change: newVenueName ? `New spot: ${newVenueName}` : 'Venue changed',
    time_change: newTime ? `New time: ${newTime}` : 'Time changed',
    general: dateStr ? `Updated: ${dateStr}` : 'Event updated'
  };

  // Build concise message
  const messages: Record<string, string> = {
    venue_change: dateStr ? `${dateStr}${groupName ? ` · ${groupName}` : ''}` : displayName,
    time_change: dateStr ? `${dateStr}${groupName ? ` · ${groupName}` : ''}` : displayName,
    general: groupName || displayName
  };

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: updateType === 'venue_change' ? 'venue_change' : 'event_update',
        title: titles[updateType],
        message: messages[updateType],
        actionUrl: `/event/${itineraryId}`,
        actionLabel: 'View',
        metadata: {
          itineraryId,
          groupId,
          updateType,
          eventDate: eventDate ? new Date(eventDate).toISOString() : null,
          venueName: newVenueName,
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} event update notifications`);

  return results;
}
