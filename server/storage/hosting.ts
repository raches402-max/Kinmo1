import { db } from "../db";
import {
  members,
  groups,
  itineraries,
  hostAssignments,
  type Member,
  type Itinerary,
  type HostAssignment,
} from "@shared/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

export const hostingStorage = {
  // Event Hosting
  async toggleMemberHosting(memberId: string, openToHosting: boolean): Promise<Member> {
    const [result] = await db
      .update(members)
      .set({ openToHosting })
      .where(eq(members.id, memberId))
      .returning();
    return result;
  },

  async volunteerToHost(itineraryId: string, memberId: string): Promise<Itinerary> {
    const [result] = await db
      .update(itineraries)
      .set({ hostMemberId: memberId })
      .where(eq(itineraries.id, itineraryId))
      .returning();
    return result;
  },

  async handOffHost(itineraryId: string, newHostMemberId: string): Promise<Itinerary> {
    const [result] = await db
      .update(itineraries)
      .set({ hostMemberId: newHostMemberId })
      .where(eq(itineraries.id, itineraryId))
      .returning();
    return result;
  },

  async getHostingAvailableMembers(groupId: string): Promise<Member[]> {
    const rows = await db
      .select()
      .from(members)
      .innerJoin(groups, eq(members.groupId, groups.id))
      .where(
        and(
          eq(members.groupId, groupId),
          eq(members.openToHosting, true),
          isNull(groups.deletedAt)
        )
      );

    return rows.map(({ members }) => members);
  },

  // Host Assignments (rotating host system)
  async createHostAssignment(groupId: string, memberId: string, itineraryId?: string): Promise<HostAssignment> {
    const [result] = await db
      .insert(hostAssignments)
      .values({
        groupId,
        memberId,
        itineraryId: itineraryId || null,
        status: 'pending'
      })
      .returning();
    return result;
  },

  async getPendingHostAssignment(groupId: string): Promise<HostAssignment | undefined> {
    const [result] = await db
      .select()
      .from(hostAssignments)
      .where(
        and(
          eq(hostAssignments.groupId, groupId),
          eq(hostAssignments.status, 'pending')
        )
      )
      .orderBy(desc(hostAssignments.askedAt))
      .limit(1);
    return result;
  },

  async getMemberHostAssignments(memberId: string): Promise<HostAssignment[]> {
    return await db
      .select()
      .from(hostAssignments)
      .where(eq(hostAssignments.memberId, memberId))
      .orderBy(desc(hostAssignments.askedAt));
  },

  async respondToHostAssignment(assignmentId: string, accepted: boolean, memberId: string): Promise<HostAssignment> {
    const [result] = await db
      .update(hostAssignments)
      .set({
        status: accepted ? 'accepted' : 'declined',
        respondedAt: new Date()
      })
      .where(
        and(
          eq(hostAssignments.id, assignmentId),
          eq(hostAssignments.memberId, memberId)
        )
      )
      .returning();

    // If accepted, update member's last_hosted_at timestamp
    if (accepted && result) {
      await db
        .update(members)
        .set({ lastHostedAt: new Date() })
        .where(eq(members.id, memberId));
    }

    return result;
  },

  async getNextHostVolunteer(groupId: string, excludeMemberIds: string[] = []): Promise<Member | null> {
    let whereConditions = [
      eq(members.groupId, groupId),
      eq(members.openToHosting, true),
      eq(members.isOrganizer, false),
      isNull(groups.deletedAt)
    ];

    if (excludeMemberIds.length > 0) {
      whereConditions.push(sql`${members.id} NOT IN (${sql.join(excludeMemberIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const rows = await db
      .select()
      .from(members)
      .innerJoin(groups, eq(members.groupId, groups.id))
      .where(and(...whereConditions))
      .orderBy(members.lastHostedAt); // null values come first (never hosted)

    return rows.length > 0 ? rows[0].members : null;
  },
};
