/**
 * Events / Itineraries CRUD Routes
 *
 * Extracted from routes.ts. Basic CRUD only — no AI, no auto-scheduling.
 *
 * Routes:
 *   GET  /api/user/events                      — user's events dashboard (all types)
 *   GET  /api/groups/:groupId/itineraries       — list itineraries for a group
 *   GET  /api/itineraries/:id                   — get single itinerary
 *   POST /api/itineraries                       — create itinerary
 *   PATCH /api/itineraries/:id                  — update itinerary
 *   PATCH /api/itineraries/:id/order            — reorder itinerary items
 *   DELETE /api/itineraries/:id                 — delete itinerary
 */

import { Router } from "express";
import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { safeParse } from "../validation-middleware";
import { insertItinerarySchema } from "@shared/schema";
import {
  itineraries,
  itineraryInvites,
  itineraryItems,
  groups as groupsTable,
  members as membersTable,
  rsvps as rsvpsTable,
  guestInvites,
  autoScheduledEvents,
  rejectedEventDates,
  standaloneEventInvitees,
  users,
  userProfiles,
} from "@shared/schema";
import type { ItineraryItem } from "@shared/schema";

// ============================================================================
// Local helpers (inlined from routes.ts — not yet exported)
// ============================================================================

function normalizeRsvpResponse(response: string | null | undefined): 'yes' | 'maybe' | 'no' | null {
  if (!response) return null;
  const r = response.toLowerCase();
  if (r === 'yes' || r === 'going') return 'yes';
  if (r === 'maybe') return 'maybe';
  if (r === 'no' || r === 'not_going') return 'no';
  return null;
}

async function getGroupMembersWithOrganizer(groupId: string, organizerUserId: string) {
  const [organizerInfo] = await db
    .select({ displayName: userProfiles.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, organizerUserId));

  const organizerName = organizerInfo?.displayName ||
    (organizerInfo?.firstName && organizerInfo?.lastName
      ? `${organizerInfo.firstName} ${organizerInfo.lastName}`
      : organizerInfo?.firstName || organizerInfo?.email?.split('@')[0] || 'Organizer');
  const organizerEmail = organizerInfo?.email || null;

  const regularMembers = await db
    .select({ id: membersTable.id, name: membersTable.name, email: membersTable.email, openToHosting: membersTable.openToHosting, userId: membersTable.userId, isGuest: membersTable.isGuest })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));

  const organizerMemberRecord = regularMembers.find(m =>
    m.userId === organizerUserId ||
    (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase())
  );

  const filteredMembers = regularMembers.filter(m => {
    if (m.userId === organizerUserId) return false;
    if (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase()) return false;
    return true;
  });

  const organizer = {
    id: organizerMemberRecord?.id || `organizer-${organizerUserId}`,
    name: organizerMemberRecord?.name || organizerName,
    email: organizerMemberRecord?.email || organizerEmail,
    openToHosting: organizerMemberRecord?.openToHosting || false,
    isOrganizer: true,
    isGuest: false,
    userId: organizerUserId,
  };

  return [
    organizer,
    ...filteredMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      openToHosting: m.openToHosting || false,
      isOrganizer: false,
      isGuest: m.isGuest || false,
      userId: m.userId || null,
    })),
  ];
}

const router = Router();

// ============================================================================
// GET /api/user/events
// All events for the authenticated user (group, draft, virtual, standalone)
// ============================================================================
router.get("/user/events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const filterGroupId = req.query.groupId as string | undefined;

    // Build where conditions
    const whereConditions = [isNull(groupsTable.deletedAt)];
    if (filterGroupId) {
      whereConditions.push(eq(itineraries.groupId, filterGroupId));
    }

    // Find all itinerary invites for this user
    const invitesQuery = await db
      .select({
        inviteId: itineraryInvites.id,
        inviteToken: itineraryInvites.inviteToken,
        itineraryId: itineraryInvites.itineraryId,
        memberId: itineraryInvites.memberId,
        itineraryName: itineraries.name,
        eventDate: itineraries.eventDate,
        status: itineraries.status,
        groupId: itineraries.groupId,
        groupName: groupsTable.name,
        groupEmoji: groupsTable.emoji,
        groupAccentColor: groupsTable.accentColor,
        groupTimezone: groupsTable.timezone,
        groupUserId: groupsTable.userId,
      })
      .from(itineraryInvites)
      .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
      .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
      .where(and(...whereConditions));

    // Filter to only invites relevant to this user
    const verifiedInvites = [];
    const seenItineraryIds = new Set<string>();

    for (const invite of invitesQuery) {
      if (!invite.itineraryId) continue;
      if (seenItineraryIds.has(invite.itineraryId)) continue;

      const isGroupOrganizer = invite.groupUserId === userId;

      if (isGroupOrganizer) {
        verifiedInvites.push({ ...invite, isOrganizer: true });
        seenItineraryIds.add(invite.itineraryId);
      } else if (invite.memberId) {
        const member = await storage.getMember(invite.memberId);
        if (member && member.userId === userId) {
          verifiedInvites.push({ ...invite, isOrganizer: false });
          seenItineraryIds.add(invite.itineraryId);
        }
      }
    }

    // Fetch RSVP status and itinerary items for each invite
    const eventResults = await Promise.allSettled(verifiedInvites.map(async (invite) => {
      let rsvp = null;
      if (invite.isOrganizer) {
        let rsvps = await db
          .select()
          .from(rsvpsTable)
          .where(sql`itinerary_id = ${invite.itineraryId} AND user_id = ${userId} AND member_id IS NULL`);
        rsvp = rsvps[0] || null;

        if (!rsvp && invite.groupId) {
          const organizerMember = await db
            .select({ id: membersTable.id })
            .from(membersTable)
            .where(sql`group_id = ${invite.groupId} AND user_id = ${userId}`)
            .limit(1);

          if (organizerMember.length > 0) {
            rsvps = await db
              .select()
              .from(rsvpsTable)
              .where(sql`itinerary_id = ${invite.itineraryId} AND member_id = ${organizerMember[0].id}`);
            rsvp = rsvps[0] || null;
          }
        }
      } else if (invite.memberId) {
        const rsvps = await db
          .select()
          .from(rsvpsTable)
          .where(sql`itinerary_id = ${invite.itineraryId} AND member_id = ${invite.memberId}`);
        rsvp = rsvps[0] || null;
      }

      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, invite.itineraryId))
        .orderBy(itineraryItems.orderIndex);

      const [itinerary] = await db
        .select()
        .from(itineraries)
        .where(eq(itineraries.id, invite.itineraryId));

      let hostMemberName = null;
      if (itinerary?.hostMemberId) {
        const [hostMember] = await db
          .select({ name: membersTable.name })
          .from(membersTable)
          .where(eq(membersTable.id, itinerary.hostMemberId));
        hostMemberName = hostMember?.name || null;
      }

      const groupMembers = invite.groupId && invite.groupUserId
        ? await getGroupMembersWithOrganizer(invite.groupId, invite.groupUserId)
        : [];

      let currentUserMemberId = null;
      let currentUserOpenToHosting = false;
      if (!invite.isOrganizer && invite.memberId) {
        currentUserMemberId = invite.memberId;
        const member = groupMembers.find(m => m.id === invite.memberId);
        currentUserOpenToHosting = member?.openToHosting || false;
      }

      const allRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${invite.itineraryId} AND (requires_approval = false OR approved = true)`);

      const rsvpSummary = { yes: [] as string[], maybe: [] as string[], no: [] as string[] };
      const detailedRsvps: Array<{name: string; response: string; additionalAttendees: any[]; numberOfKids: number; isGuest: boolean}> = [];
      const processedNames = new Set<string>();

      for (const r of allRsvps) {
        let name = '';
        if (r.memberId) {
          const member = groupMembers.find(m => m.id === r.memberId);
          name = member?.name || member?.email || 'Unknown';
        } else if (r.userId) {
          const [userInfo] = await db
            .select({ displayName: userProfiles.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email })
            .from(users)
            .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
            .where(eq(users.id, r.userId));

          if (userInfo) {
            name = userInfo.displayName ||
                   (userInfo.firstName && userInfo.lastName ? `${userInfo.firstName} ${userInfo.lastName}` : userInfo.firstName || userInfo.email || 'Organizer');
          } else {
            name = 'Organizer';
          }
        } else if (r.guestName) {
          name = r.guestName;
        }

        const nameLower = name.toLowerCase();
        const normalizedResponse = normalizeRsvpResponse(r.response);
        if (name && normalizedResponse && !processedNames.has(nameLower)) {
          processedNames.add(nameLower);
          rsvpSummary[normalizedResponse].push(name);
          detailedRsvps.push({
            name,
            response: normalizedResponse,
            additionalAttendees: Array.isArray(r.additionalAttendees) ? r.additionalAttendees : [],
            numberOfKids: r.numberOfKids || 0,
            isGuest: !!r.guestName,
          });
        }
      }

      const pendingGuestRsvps = invite.isOrganizer ? await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${invite.itineraryId} AND requires_approval = true AND approved = false`) : [];

      const allGuestInvites = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.itineraryId, invite.itineraryId));

      for (const gi of allGuestInvites) {
        const guestNameLower = gi.guestName.toLowerCase();
        if (gi.rsvpStatus && gi.rsvpStatus !== null && !processedNames.has(guestNameLower)) {
          processedNames.add(guestNameLower);
          detailedRsvps.push({ name: gi.guestName, response: gi.rsvpStatus, additionalAttendees: [], numberOfKids: 0, isGuest: true });
          if (gi.rsvpStatus in rsvpSummary) {
            rsvpSummary[gi.rsvpStatus as 'yes' | 'maybe' | 'no'].push(gi.guestName);
          }
        }
      }

      console.log('[DEBUG /api/user/events] Event:', invite.itineraryName, 'groupMembers count:', groupMembers.length, 'members:', groupMembers.map(m => m.name));

      let shareableInviteToken = invite.inviteToken;
      if (invite.isOrganizer) {
        const [shareableInvite] = await db
          .select({ inviteToken: itineraryInvites.inviteToken })
          .from(itineraryInvites)
          .where(and(eq(itineraryInvites.itineraryId, invite.itineraryId), isNull(itineraryInvites.memberId)))
          .limit(1);
        if (shareableInvite) {
          shareableInviteToken = shareableInvite.inviteToken;
        } else {
          const crypto = await import('crypto');
          const newShareableToken = crypto.randomUUID();
          await db.insert(itineraryInvites).values({ itineraryId: invite.itineraryId, memberId: null, inviteToken: newShareableToken });
          shareableInviteToken = newShareableToken;
          console.log(`[User Events] Created shareable invite token for legacy itinerary ${invite.itineraryId}`);
        }
      }

      return {
        inviteId: invite.inviteId,
        inviteToken: shareableInviteToken,
        itineraryId: invite.itineraryId,
        itineraryName: invite.itineraryName,
        eventDate: invite.eventDate,
        status: invite.status,
        inviteSentAt: itinerary?.inviteSentAt || null,
        rsvpDeadline: itinerary?.rsvpDeadline || null,
        note: itinerary?.note || null,
        groupId: invite.groupId,
        groupName: invite.groupName,
        groupEmoji: invite.groupEmoji,
        groupAccentColor: invite.groupAccentColor,
        groupTimezone: invite.groupTimezone,
        isOrganizer: invite.isOrganizer,
        hostMemberId: itinerary?.hostMemberId || null,
        hostMemberName,
        currentUserMemberId,
        currentUserOpenToHosting,
        members: groupMembers,
        rsvp: rsvp ? { response: rsvp.response, rsvpFeedback: rsvp.rsvpFeedback, postEventFeedback: rsvp.postEventFeedback } : null,
        rsvpSummary,
        detailedRsvps,
        pendingGuestRsvps: pendingGuestRsvps.map(gr => ({
          id: gr.id,
          guestName: gr.guestName,
          response: gr.response,
          additionalAttendees: gr.additionalAttendees,
          numberOfKids: gr.numberOfKids,
        })),
        items: items.map(item => ({
          id: item.id,
          sourceId: item.sourceId,
          venueName: item.venueName,
          venueType: item.venueType,
          venueAddress: item.venueAddress,
          photoUrl: item.photoUrl,
          rating: item.rating,
          googlePlaceId: item.googlePlaceId,
          notes: item.notes,
          googleMapsUrl: item.googleMapsUrl,
          sourceType: item.sourceType,
          arrivalTime: item.arrivalTime,
          departureTime: item.departureTime,
          travelNotes: item.travelNotes,
        })),
      };
    }));

    const events = eventResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    const failedEvents = eventResults.filter(r => r.status === 'rejected');
    if (failedEvents.length > 0) {
      console.error(`[User Events] ${failedEvents.length}/${verifiedInvites.length} event fetches failed`);
      failedEvents.forEach((f, i) => {
        if (f.status === 'rejected') console.error(`[User Events] Failed event ${i}:`, f.reason);
      });
    }

    // Draft and proposed itineraries
    const existingItineraryIds = verifiedInvites.map(inv => inv.itineraryId);
    const draftWhereConditions = [
      or(eq(itineraries.status, 'draft'), eq(itineraries.status, 'proposed')),
      eq(itineraries.isSaved, false),
      sql`${itineraries.groupId} IN (SELECT id FROM groups WHERE user_id = ${userId})`,
      existingItineraryIds.length > 0
        ? sql`${itineraries.id} NOT IN (${sql.join(existingItineraryIds.map(id => sql`${id}`), sql`, `)})`
        : sql`1=1`
    ];
    if (filterGroupId) {
      draftWhereConditions.push(eq(itineraries.groupId, filterGroupId));
    }

    const draftItineraries = await db
      .select({
        itineraryId: itineraries.id,
        itineraryName: itineraries.name,
        note: itineraries.note,
        eventDate: itineraries.eventDate,
        status: itineraries.status,
        groupId: itineraries.groupId,
        groupName: groupsTable.name,
        groupEmoji: groupsTable.emoji,
        groupAccentColor: groupsTable.accentColor,
      })
      .from(itineraries)
      .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
      .where(and(...draftWhereConditions));

    const draftEvents = await Promise.all(draftItineraries.map(async (draft) => {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, draft.itineraryId))
        .orderBy(itineraryItems.orderIndex);

      const groupMembers = draft.groupId
        ? await getGroupMembersWithOrganizer(draft.groupId, userId)
        : [];

      const organizerRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${draft.itineraryId} AND user_id = ${userId} AND member_id IS NULL`);
      const organizerRsvp = organizerRsvps.length > 0
        ? { response: organizerRsvps[0].response, rsvpFeedback: organizerRsvps[0].rsvpFeedback }
        : null;

      return {
        inviteId: `draft-${draft.itineraryId}`,
        inviteToken: null,
        itineraryId: draft.itineraryId,
        itineraryName: draft.itineraryName,
        note: draft.note || null,
        eventDate: draft.eventDate,
        status: draft.status,
        groupId: draft.groupId,
        groupName: draft.groupName,
        groupEmoji: draft.groupEmoji || '🎉',
        groupAccentColor: draft.groupAccentColor,
        isOrganizer: true,
        hostMemberId: null,
        hostMemberName: null,
        currentUserMemberId: null,
        currentUserOpenToHosting: false,
        members: groupMembers,
        rsvp: organizerRsvp,
        rsvpSummary: { yes: [], maybe: [], no: [] },
        detailedRsvps: [],
        pendingGuestRsvps: [],
        items: items.map(item => ({
          id: item.id,
          sourceId: item.sourceId,
          venueName: item.venueName,
          venueType: item.venueType,
          venueAddress: item.venueAddress,
          photoUrl: item.photoUrl,
          rating: item.rating,
          googlePlaceId: item.googlePlaceId,
          orderIndex: item.orderIndex,
          sourceType: item.sourceType,
          notes: item.notes,
          googleMapsUrl: item.googleMapsUrl,
          arrivalTime: item.arrivalTime,
          departureTime: item.departureTime,
          travelNotes: item.travelNotes,
        })),
        isVirtual: false,
        meetingFrequency: null,
      };
    }));

    // Virtual future events for recurring groups with auto-schedule enabled
    const userGroupsWhereConditions = [
      eq(groupsTable.userId, userId),
      eq(groupsTable.autoScheduleEnabled, true),
      isNotNull(groupsTable.nextEventDueDate)
    ];
    if (filterGroupId) {
      userGroupsWhereConditions.push(eq(groupsTable.id, filterGroupId));
    }

    const userGroups = await db
      .select()
      .from(groupsTable)
      .where(and(...userGroupsWhereConditions));

    const virtualEvents = [];
    for (const group of userGroups) {
      if (!group.nextEventDueDate || !group.meetingFrequency) continue;

      const { calculateFutureEventDates } = await import('../auto-scheduler');
      const futureDates = calculateFutureEventDates(new Date(group.nextEventDueDate), group.meetingFrequency, 2, group);

      const existingEventDates = new Set(
        events.filter(e => e.groupId === group.id && e.eventDate).map(e => new Date(e.eventDate!).toISOString().split('T')[0])
      );

      const draftItineraries = await db
        .select()
        .from(itineraries)
        .where(and(eq(itineraries.groupId, group.id), eq(itineraries.status, 'draft'), eq(itineraries.isSaved, false)));
      const draftEventDates = new Set(
        draftItineraries.filter(d => d.eventDate).map(d => new Date(d.eventDate!).toISOString().split('T')[0])
      );

      const proposedItineraries = await db
        .select()
        .from(itineraries)
        .where(and(eq(itineraries.groupId, group.id), eq(itineraries.status, 'proposed'), isNotNull(itineraries.eventDate)));
      const proposedEventDates = new Set(
        proposedItineraries.filter(p => p.eventDate).map(p => new Date(p.eventDate!).toISOString().split('T')[0])
      );

      const rejectedDates = await db
        .select()
        .from(rejectedEventDates)
        .where(eq(rejectedEventDates.groupId, group.id));
      const rejectedDateStrs = new Set(
        rejectedDates.map(rd => new Date(rd.rejectedDate).toISOString().split('T')[0])
      );

      for (const date of futureDates) {
        const dateStr = date.toISOString().split('T')[0];
        if (rejectedDateStrs.has(dateStr)) continue;
        if (existingEventDates.has(dateStr) || draftEventDates.has(dateStr) || proposedEventDates.has(dateStr)) continue;

        const autoEvent = await db
          .select()
          .from(autoScheduledEvents)
          .where(and(eq(autoScheduledEvents.groupId, group.id), sql`DATE(${autoScheduledEvents.proposedDate}) = ${dateStr}`))
          .limit(1);
        const autoEventData = autoEvent[0];

        virtualEvents.push({
          inviteId: `virtual-${group.id}-${dateStr}`,
          inviteToken: null,
          itineraryId: autoEventData?.itineraryId || null,
          itineraryName: `${group.name}`,
          eventDate: date.toISOString(),
          status: autoEventData?.status || ('virtual' as any),
          groupId: group.id,
          groupName: group.name,
          groupEmoji: group.emoji || '🎉',
          isOrganizer: true,
          hostMemberId: null,
          hostMemberName: null,
          currentUserMemberId: null,
          currentUserOpenToHosting: false,
          members: [],
          rsvp: null,
          rsvpSummary: { yes: [], maybe: [], no: [] },
          detailedRsvps: [],
          pendingGuestRsvps: [],
          items: [],
          isVirtual: true,
          meetingFrequency: group.meetingFrequency,
          isAutoScheduled: !!autoEventData,
          autoEventId: autoEventData?.id || null,
          autoEventItineraryId: autoEventData?.itineraryId || null,
          autoSendAt: autoEventData?.autoSendAt?.toISOString() || null,
          proposedDate: autoEventData?.proposedDate?.toISOString() || null,
          confidenceScore: autoEventData?.confidenceScore || null,
          requiresReview: autoEventData?.requiresReview || null,
        });
      }
    }

    // Standalone events — skip entirely when a group filter is set; standalones have no group.
    const standaloneItineraries = filterGroupId
      ? []
      : await db
          .select()
          .from(itineraries)
          .where(and(eq(itineraries.createdBy, userId), eq(itineraries.isStandalone, true)));

    const standaloneEvents = await Promise.all(standaloneItineraries.map(async (itinerary) => {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);

      const invitees = await db.select().from(standaloneEventInvitees).where(eq(standaloneEventInvitees.itineraryId, itinerary.id));

      const [organizerRsvp] = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itinerary.id} AND user_id = ${userId} AND member_id IS NULL`);

      return {
        inviteId: null,
        inviteToken: null,
        itineraryId: itinerary.id,
        itineraryName: itinerary.name,
        eventDate: itinerary.eventDate,
        eventEndTime: null,
        status: itinerary.status,
        inviteSentAt: itinerary.inviteSentAt,
        groupId: null,
        groupName: null,
        groupEmoji: null,
        groupAccentColor: null,
        groupTimezone: itinerary.timezone,
        isOrganizer: true,
        hostMemberId: null,
        hostMemberName: null,
        currentUserMemberId: null,
        currentUserOpenToHosting: false,
        members: [],
        rsvp: organizerRsvp ? { response: organizerRsvp.response, rsvpFeedback: organizerRsvp.rsvpFeedback, postEventFeedback: organizerRsvp.postEventFeedback } : null,
        organizerRsvp: organizerRsvp?.response || null,
        rsvpSummary: { yes: [], maybe: [], no: [] },
        detailedRsvps: [],
        pendingGuestRsvps: [],
        items: items.map(item => ({
          id: item.id,
          venueName: item.venueName,
          venueType: item.venueType,
          venueAddress: item.venueAddress,
          photoUrl: item.photoUrl,
          rating: item.rating,
          googlePlaceId: item.googlePlaceId,
          orderIndex: item.orderIndex,
          arrivalTime: item.arrivalTime,
          departureTime: item.departureTime,
          travelNotes: item.travelNotes,
          notes: item.notes,
          googleMapsUrl: item.googleMapsUrl,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        })),
        isStandalone: true,
        invitees: invitees.map(inv => ({
          id: inv.id,
          inviteeName: inv.inviteeName,
          inviteeEmail: inv.inviteeEmail,
          rsvpStatus: inv.rsvpStatus,
          memberId: inv.memberId,
          sourceGroupId: inv.sourceGroupId,
        })),
        note: itinerary.note || null,
        quorumThreshold: null,
        rsvpDeadline: itinerary.rsvpDeadline,
        autoScheduleConfig: itinerary.autoScheduleConfig,
      };
    }));

    const allEvents = [...events, ...draftEvents, ...virtualEvents, ...standaloneEvents];

    // Deduplicate
    const deduplicatedEvents = [];
    const seenFinalItineraryIds = new Set<string>();
    const seenInviteIds = new Set<string>();

    for (const event of allEvents) {
      if (event.inviteId && seenInviteIds.has(event.inviteId)) continue;
      if (event.itineraryId) {
        if (!seenFinalItineraryIds.has(event.itineraryId)) {
          deduplicatedEvents.push(event);
          seenFinalItineraryIds.add(event.itineraryId);
          if (event.inviteId) seenInviteIds.add(event.inviteId);
        }
      } else {
        deduplicatedEvents.push(event);
        if (event.inviteId) seenInviteIds.add(event.inviteId);
      }
    }

    // Sort by event date (upcoming first)
    deduplicatedEvents.sort((a, b) => {
      if (!a.eventDate && !b.eventDate) return 0;
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });

    res.json(deduplicatedEvents);
  } catch (error: any) {
    console.error('[User Events] Error:', error);
    console.error('[User Events] Error stack:', error.stack);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// GET /api/groups/:groupId/itineraries
// List all itineraries for a group
// ============================================================================
router.get("/groups/:groupId/itineraries", async (req, res) => {
  try {
    const itinerariesList = await storage.getGroupItineraries(req.params.groupId);
    res.json(itinerariesList);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// GET /api/itineraries/:id
// Get single itinerary (public — used for RSVP page)
// ============================================================================
router.get("/itineraries/:id", async (req, res) => {
  try {
    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    if (itinerary.isStandalone || !itinerary.groupId) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);

      const invitees = await storage.getStandaloneEventInvitees(itinerary.id);
      const timeSlots = await storage.getItineraryTimeSlots(req.params.id);
      const voteCounts = await storage.getItineraryTimeSlotVoteCounts(req.params.id);
      const timeSlotsWithVotes = timeSlots.map((slot) => {
        const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
        return {
          ...slot,
          yesCount: counts?.yesCount || 0,
          maybeCount: counts?.maybeCount || 0,
          noCount: counts?.noCount || 0,
          yesVoters: counts?.yesVoters || [],
          maybeVoters: counts?.maybeVoters || [],
          noVoters: counts?.noVoters || [],
        };
      });

      return res.json({
        ...itinerary,
        items: items.map(item => ({
          id: item.id,
          venueName: item.venueName,
          venueType: item.venueType,
          venueAddress: item.venueAddress,
          photoUrl: item.photoUrl,
          rating: item.rating,
          googlePlaceId: item.googlePlaceId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          orderIndex: item.orderIndex,
        })),
        invitees,
        isStandalone: true,
        group: null,
        members: [],
        proposedTimeSlots: timeSlotsWithVotes,
      });
    }

    const group = await storage.getGroup(itinerary.groupId);
    const groupMembers = group?.userId
      ? await getGroupMembersWithOrganizer(itinerary.groupId, group.userId)
      : [];

    let organizerRsvp = null;
    if (group?.userId) {
      const organizerRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${req.params.id} AND user_id = ${group.userId} AND member_id IS NULL`);
      if (organizerRsvps.length > 0) {
        organizerRsvp = { response: organizerRsvps[0].response, rsvpFeedback: organizerRsvps[0].rsvpFeedback };
      }
    }

    const timeSlots = await storage.getItineraryTimeSlots(req.params.id);
    const voteCounts = await storage.getItineraryTimeSlotVoteCounts(req.params.id);
    const timeSlotsWithVotes = timeSlots.map((slot) => {
      const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
      return {
        ...slot,
        yesCount: counts?.yesCount || 0,
        maybeCount: counts?.maybeCount || 0,
        noCount: counts?.noCount || 0,
        yesVoters: counts?.yesVoters || [],
        maybeVoters: counts?.maybeVoters || [],
        noVoters: counts?.noVoters || [],
      };
    });

    res.json({
      ...itinerary,
      group,
      members: groupMembers,
      rsvp: organizerRsvp,
      proposedTimeSlots: timeSlotsWithVotes,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// POST /api/itineraries
// Create a new itinerary
// ============================================================================
router.post("/itineraries", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    console.log('[Create Itinerary] Received request body:', JSON.stringify(req.body, null, 2));

    const bodyWithDateConversion = { ...req.body };
    if (bodyWithDateConversion.eventDate && typeof bodyWithDateConversion.eventDate === 'string') {
      bodyWithDateConversion.eventDate = new Date(bodyWithDateConversion.eventDate);
    }

    const validatedData = safeParse(insertItinerarySchema, bodyWithDateConversion, res);
    if (!validatedData) {
      console.log('[Create Itinerary] Validation failed for body:', JSON.stringify(req.body, null, 2));
      return;
    }

    console.log('[Create Itinerary] Creating new itinerary:', {
      groupId: validatedData.groupId,
      name: validatedData.name,
      status: validatedData.status,
      eventDate: validatedData.eventDate,
    });

    const groupId = validatedData.groupId;
    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const groupMembers = await storage.getGroupMembers(groupId);
    const isMember = groupMembers.some(m => m.userId === userId);
    const isOwner = group.userId === userId;
    if (!isMember && !isOwner) {
      return res.status(403).json({ message: "You must be a member of this group to create itineraries" });
    }

    const itinerary = await storage.createItinerary(validatedData, userId, []);
    console.log('[Create Itinerary] ✅ Created itinerary:', itinerary.id);
    res.json(itinerary);
  } catch (error: any) {
    console.error('[Create Itinerary] Error:', error);
    res.status(500).json({ message: error.message || "Couldn't create itinerary. Mind giving it another try?" });
  }
});

// ============================================================================
// PATCH /api/itineraries/:id
// Update itinerary fields (and optionally reorder/delete items via proposedOrder)
// ============================================================================
router.patch("/itineraries/:id", isAuthenticated, async (req, res) => {
  try {
    const updates = req.body;
    const itineraryId = req.params.id;

    if (updates.proposedOrder) {
      const currentItinerary = await storage.getItinerary(itineraryId);
      if (currentItinerary) {
        const newSourceIds = new Set(updates.proposedOrder);
        const itemsToDelete = currentItinerary.items.filter(
          (item: ItineraryItem) => !newSourceIds.has(item.sourceId)
        );
        for (const item of itemsToDelete) {
          await storage.deleteItineraryItem(item.id);
        }
        const sourceIdToItemId = new Map(
          currentItinerary.items.map((item: ItineraryItem) => [item.sourceId, item.id])
        );
        const orderedItemIds = updates.proposedOrder
          .map((sourceId: string) => sourceIdToItemId.get(sourceId))
          .filter((id: string | undefined) => id !== undefined);
        await storage.updateItineraryItemOrder(itineraryId, orderedItemIds);
      }
      delete updates.proposedOrder;
    }

    if (updates.eventDate && typeof updates.eventDate === 'string') {
      updates.eventDate = new Date(updates.eventDate);
    }

    const itinerary = await storage.updateItinerary(itineraryId, updates);
    res.json(itinerary);
  } catch (error: any) {
    console.error("[Update Itinerary] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// PATCH /api/itineraries/:id/order
// Reorder itinerary items
// ============================================================================
router.patch("/itineraries/:id/order", isAuthenticated, async (req, res) => {
  try {
    const { proposedOrder } = req.body;
    const itineraryId = req.params.id;

    const currentItinerary = await storage.getItinerary(itineraryId);
    if (!currentItinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const validItemIds = new Set(currentItinerary.items.map((item: ItineraryItem) => item.id));
    const orderedItemIds = proposedOrder.filter((id: string) => validItemIds.has(id));

    await storage.updateItineraryItemOrder(itineraryId, orderedItemIds);

    const updatedItinerary = await storage.getItinerary(itineraryId);
    res.json(updatedItinerary);
  } catch (error: any) {
    console.error("[Update Order] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// DELETE /api/itineraries/:id
// Delete itinerary (group owner only), sends cancellation notifications
// ============================================================================
router.delete("/itineraries/:id", isAuthenticated, async (req: any, res) => {
  try {
    const itineraryId = req.params.id;
    const userId = await getUserId(req);

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this itinerary" });
    }

    if (itinerary.eventDate) {
      try {
        await db.insert(rejectedEventDates).values({
          groupId: itinerary.groupId,
          rejectedDate: itinerary.eventDate,
          reason: 'user_deleted',
          sourceType: 'itinerary',
          sourceId: itineraryId,
        });
        console.log(`[Rejected Dates] Tracked rejected date for group ${itinerary.groupId}: ${itinerary.eventDate}`);
      } catch (error) {
        console.error('[Rejected Dates] Error tracking rejected date:', error);
      }
    }

    if (itinerary.status === 'proposed' || itinerary.status === 'scheduled') {
      try {
        const groupMembers = await storage.getGroupMembers(itinerary.groupId);
        const memberIds = groupMembers.map(m => m.id);
        const firstVenueName = itinerary.items && itinerary.items.length > 0 ? itinerary.items[0].venueName : null;

        const { notifyEventCancelled } = await import('../notifications');
        await notifyEventCancelled({
          itineraryId,
          groupId: itinerary.groupId,
          eventName: itinerary.name || 'Upcoming Event',
          groupName: group.name,
          memberIds,
          eventDate: itinerary.eventDate,
          venueName: firstVenueName,
        });
      } catch (notifyError) {
        console.error('[Notifications] Error sending cancellation notifications:', notifyError);
      }
    }

    await storage.deleteItinerary(itineraryId);
    res.json({ message: "Itinerary deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
