import { db } from "../db";
import {
  proposedTimeSlots,
  timeSlotVotes,
  members,
  userProfiles,
  users,
  type ProposedTimeSlot,
  type InsertProposedTimeSlot,
  type TimeSlotVote,
  type InsertTimeSlotVote,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export const timeSlotsStorage = {
  // Proposed Time Slots
  async createProposedTimeSlot(timeSlot: InsertProposedTimeSlot): Promise<ProposedTimeSlot> {
    const [result] = await db.insert(proposedTimeSlots).values(timeSlot).returning();
    return result;
  },

  async createProposedTimeSlots(timeSlots: InsertProposedTimeSlot[]): Promise<ProposedTimeSlot[]> {
    if (timeSlots.length === 0) return [];
    const results = await db.insert(proposedTimeSlots).values(timeSlots).returning();
    return results;
  },

  async getTimeSlot(timeSlotId: string): Promise<ProposedTimeSlot | undefined> {
    const [result] = await db.select().from(proposedTimeSlots).where(eq(proposedTimeSlots.id, timeSlotId));
    return result;
  },

  async getItineraryTimeSlots(itineraryId: string): Promise<ProposedTimeSlot[]> {
    return await db.select().from(proposedTimeSlots).where(eq(proposedTimeSlots.itineraryId, itineraryId)).orderBy(proposedTimeSlots.proposedDateTime);
  },

  async updateTimeSlotSelection(timeSlotId: string, isSelected: boolean): Promise<ProposedTimeSlot> {
    const [result] = await db
      .update(proposedTimeSlots)
      .set({ isSelected })
      .where(eq(proposedTimeSlots.id, timeSlotId))
      .returning();
    return result;
  },

  async deleteTimeSlot(timeSlotId: string): Promise<void> {
    await db.delete(proposedTimeSlots).where(eq(proposedTimeSlots.id, timeSlotId));
  },

  // Time Slot Votes
  async voteForTimeSlot(vote: InsertTimeSlotVote): Promise<TimeSlotVote> {
    const setOnConflict = {
      voteType: vote.voteType,
      memberName: vote.memberName ?? null,
      createdAt: new Date(),
    };

    if (vote.userId) {
      const [result] = await db
        .insert(timeSlotVotes)
        .values(vote)
        .onConflictDoUpdate({
          target: [timeSlotVotes.userId, timeSlotVotes.timeSlotId],
          targetWhere: sql`${timeSlotVotes.userId} IS NOT NULL`,
          set: setOnConflict,
        })
        .returning();
      return result;
    }

    if (vote.memberId) {
      const [result] = await db
        .insert(timeSlotVotes)
        .values(vote)
        .onConflictDoUpdate({
          target: [timeSlotVotes.memberId, timeSlotVotes.timeSlotId],
          targetWhere: sql`${timeSlotVotes.memberId} IS NOT NULL`,
          set: setOnConflict,
        })
        .returning();
      return result;
    }

    // memberName-only vote: no unique index covers this path by design.
    // See migrations/0014_add_vote_unique_constraints.sql and the
    // project-name-resolution-feature memory for the upstream fix.
    const [result] = await db.insert(timeSlotVotes).values(vote).returning();
    return result;
  },

  async getTimeSlotVotes(timeSlotId: string): Promise<TimeSlotVote[]> {
    return await db.select().from(timeSlotVotes).where(eq(timeSlotVotes.timeSlotId, timeSlotId));
  },

  async getUserTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<TimeSlotVote | undefined> {
    const conditions = [eq(timeSlotVotes.timeSlotId, timeSlotId)];

    if (userId) {
      conditions.push(eq(timeSlotVotes.userId, userId));
    } else if (memberId) {
      conditions.push(eq(timeSlotVotes.memberId, memberId));
    } else {
      return undefined;
    }

    const [vote] = await db.select().from(timeSlotVotes).where(and(...conditions));
    return vote;
  },

  async removeTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<void> {
    const conditions = [eq(timeSlotVotes.timeSlotId, timeSlotId)];

    if (userId) {
      conditions.push(eq(timeSlotVotes.userId, userId));
    } else if (memberId) {
      conditions.push(eq(timeSlotVotes.memberId, memberId));
    } else {
      return;
    }

    await db.delete(timeSlotVotes).where(and(...conditions));
  },

  async getItineraryTimeSlotVoteCounts(itineraryId: string): Promise<Array<{
    timeSlotId: string;
    yesCount: number;
    maybeCount: number;
    noCount: number;
    yesVoters: string[];
    maybeVoters: string[];
    noVoters: string[];
  }>> {
    const result = await db
      .select({
        timeSlotId: timeSlotVotes.timeSlotId,
        yesCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'yes')::int`,
        maybeCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'maybe')::int`,
        noCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'no')::int`,
        yesVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'yes')`,
        maybeVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'maybe')`,
        noVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'no')`,
      })
      .from(timeSlotVotes)
      .innerJoin(proposedTimeSlots, eq(timeSlotVotes.timeSlotId, proposedTimeSlots.id))
      .leftJoin(members, eq(timeSlotVotes.memberId, members.id))
      .leftJoin(userProfiles, eq(timeSlotVotes.userId, userProfiles.userId))
      .leftJoin(users, eq(timeSlotVotes.userId, users.id))
      .where(eq(proposedTimeSlots.itineraryId, itineraryId))
      .groupBy(timeSlotVotes.timeSlotId);

    // Clean up the voter arrays (remove null entries)
    return result.map(r => ({
      ...r,
      yesVoters: (r.yesVoters || []).filter(name => name && name.trim()),
      maybeVoters: (r.maybeVoters || []).filter(name => name && name.trim()),
      noVoters: (r.noVoters || []).filter(name => name && name.trim()),
    }));
  },
};
