/**
 * Notification Service
 * Handles creation and management of in-app notifications
 */

import { db } from "./db";
import { notifications, users, itineraries, groups } from "@shared/schema";
import type { InsertNotification, Notification } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

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
  memberIds: string[];
}) {
  const { itineraryId, groupId, eventName, memberIds } = params;

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
        title: 'New Event Invitation',
        message: `You're invited to ${eventName}`,
        actionUrl: `/rsvp/${itineraryId}`,
        actionLabel: 'RSVP Now',
        metadata: {
          itineraryId,
          groupId,
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
  memberIds: string[];
  hoursUntilDeadline: number;
}) {
  const { itineraryId, groupId, eventName, memberIds, hoursUntilDeadline } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'rsvp_reminder',
        title: 'RSVP Deadline Approaching',
        message: `RSVP deadline for ${eventName} is in ${hoursUntilDeadline} hours`,
        actionUrl: `/rsvp/${itineraryId}`,
        actionLabel: 'RSVP Now',
        metadata: {
          itineraryId,
          groupId,
          hoursUntilDeadline
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} RSVP reminder notifications`);

  return results;
}

/**
 * Notify about event time being selected/finalized
 */
export async function notifyTimeSelected(params: {
  itineraryId: string;
  groupId: string;
  eventName: string;
  selectedTime: string;
  memberIds: string[];
}) {
  const { itineraryId, groupId, eventName, selectedTime, memberIds } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'time_selected',
        title: 'Event Time Finalized',
        message: `${eventName} is confirmed for ${selectedTime}`,
        actionUrl: `/rsvp/${itineraryId}`,
        actionLabel: 'View Event',
        metadata: {
          itineraryId,
          groupId,
          selectedTime
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
  memberIds: string[];
}) {
  const { itineraryId, groupId, eventName, memberIds } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'feedback_request',
        title: 'How was the event?',
        message: `Share your feedback for ${eventName}`,
        actionUrl: `/event/${itineraryId}?feedback=true`,
        actionLabel: 'Give Feedback',
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
  memberIds: string[];
}) {
  const { itineraryId, groupId, eventName, memberIds } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: 'event_cancelled',
        title: 'Event Cancelled',
        message: `${eventName} has been cancelled`,
        actionUrl: `/groups/${groupId}`,
        actionLabel: 'View Group',
        metadata: {
          itineraryId,
          groupId
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
  updateType: 'venue_change' | 'time_change' | 'general';
  memberIds: string[];
}) {
  const { itineraryId, groupId, eventName, updateType, memberIds } = params;

  const memberData = await db.query.members.findMany({
    where: (members, { inArray }) => inArray(members.id, memberIds),
  });

  const messages: Record<string, string> = {
    venue_change: `The venues for ${eventName} have been updated`,
    time_change: `The time for ${eventName} has been updated`,
    general: `${eventName} has been updated`
  };

  const notificationPromises = memberData
    .filter(member => member.userId)
    .map(member =>
      createNotification({
        userId: member.userId!,
        type: updateType === 'venue_change' ? 'venue_change' : 'event_update',
        title: 'Event Updated',
        message: messages[updateType],
        actionUrl: `/rsvp/${itineraryId}`,
        actionLabel: 'View Event',
        metadata: {
          itineraryId,
          groupId,
          updateType
        }
      })
    );

  const results = await Promise.all(notificationPromises);
  console.log(`[Notifications] Created ${results.length} event update notifications`);

  return results;
}
