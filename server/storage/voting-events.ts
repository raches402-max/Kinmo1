import { db } from "../db";
import {
  votingEvents,
  votes,
  groups,
  type VotingEvent,
  type InsertVotingEvent,
  type UpdateVotingEvent,
  type Vote,
} from "@shared/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import {
  trustFieldsForSource,
  dirtyingTrustFields,
  VOTING_EVENT_DIRTYING_FIELDS,
  type TrustSource,
} from "../trust-state";

export const votingEventsStorage = {
  async createVotingEvent(
    insertEvent: InsertVotingEvent,
    userId: string,
    trustSource: TrustSource = "manual"
  ): Promise<VotingEvent> {
    const trust = trustFieldsForSource(trustSource);
    const [event] = await db
      .insert(votingEvents)
      .values({ ...insertEvent, ...trust, createdBy: userId })
      .returning();

    await db
      .insert(votes)
      .values({ eventId: event.id, userId, voteType: 'upvote' });

    return event;
  },

  async getVotingEvents(): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        city: votingEvents.city,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        latitude: votingEvents.latitude,
        longitude: votingEvents.longitude,
        rating: votingEvents.rating,
        reviewCount: votingEvents.reviewCount,
        priceLevel: votingEvents.priceLevel,
        photoUrl: votingEvents.photoUrl,
        aiReasoning: votingEvents.aiReasoning,
        priceEstimate: votingEvents.priceEstimate,
        timeConstraints: votingEvents.timeConstraints,
        complementaryPlaceName: votingEvents.complementaryPlaceName,
        complementaryPlaceAddress: votingEvents.complementaryPlaceAddress,
        complementaryPlaceId: votingEvents.complementaryPlaceId,
        complementaryPlacePhotoUrl: votingEvents.complementaryPlacePhotoUrl,
        complementaryPlaceRating: votingEvents.complementaryPlaceRating,
        complementaryPlaceName2: votingEvents.complementaryPlaceName2,
        complementaryPlaceAddress2: votingEvents.complementaryPlaceAddress2,
        complementaryPlaceId2: votingEvents.complementaryPlaceId2,
        complementaryPlacePhotoUrl2: votingEvents.complementaryPlacePhotoUrl2,
        complementaryPlaceRating2: votingEvents.complementaryPlaceRating2,
        swipeConsensus: votingEvents.swipeConsensus,
        createdBy: votingEvents.createdBy,
        trustState: votingEvents.trustState,
        verifiedAt: votingEvents.verifiedAt,
        trustSource: votingEvents.trustSource,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .innerJoin(groups, eq(votingEvents.groupId, groups.id))
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(isNull(groups.deletedAt))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`))
      .limit(10);

    return events;
  },

  async getGroupVotingEvents(groupId: string): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        city: votingEvents.city,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        latitude: votingEvents.latitude,
        longitude: votingEvents.longitude,
        rating: votingEvents.rating,
        reviewCount: votingEvents.reviewCount,
        priceLevel: votingEvents.priceLevel,
        photoUrl: votingEvents.photoUrl,
        aiReasoning: votingEvents.aiReasoning,
        priceEstimate: votingEvents.priceEstimate,
        timeConstraints: votingEvents.timeConstraints,
        complementaryPlaceName: votingEvents.complementaryPlaceName,
        complementaryPlaceAddress: votingEvents.complementaryPlaceAddress,
        complementaryPlaceId: votingEvents.complementaryPlaceId,
        complementaryPlacePhotoUrl: votingEvents.complementaryPlacePhotoUrl,
        complementaryPlaceRating: votingEvents.complementaryPlaceRating,
        complementaryPlaceName2: votingEvents.complementaryPlaceName2,
        complementaryPlaceAddress2: votingEvents.complementaryPlaceAddress2,
        complementaryPlaceId2: votingEvents.complementaryPlaceId2,
        complementaryPlacePhotoUrl2: votingEvents.complementaryPlacePhotoUrl2,
        complementaryPlaceRating2: votingEvents.complementaryPlaceRating2,
        swipeConsensus: votingEvents.swipeConsensus,
        createdBy: votingEvents.createdBy,
        trustState: votingEvents.trustState,
        verifiedAt: votingEvents.verifiedAt,
        trustSource: votingEvents.trustSource,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .innerJoin(groups, eq(votingEvents.groupId, groups.id))
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(and(
        eq(votingEvents.groupId, groupId),
        isNull(groups.deletedAt)
      ))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`));

    return events;
  },

  async getVotingEvent(id: string): Promise<VotingEvent | undefined> {
    const [event] = await db.select().from(votingEvents).where(eq(votingEvents.id, id));
    return event || undefined;
  },

  async updateVotingEvent(id: string, updates: UpdateVotingEvent): Promise<VotingEvent> {
    const dirty = dirtyingTrustFields(updates as Record<string, unknown>, VOTING_EVENT_DIRTYING_FIELDS);
    const [event] = await db
      .update(votingEvents)
      .set({ ...updates, ...(dirty ?? {}) })
      .where(eq(votingEvents.id, id))
      .returning();
    return event;
  },

  async deleteVotingEvent(id: string): Promise<void> {
    await db.delete(votingEvents).where(eq(votingEvents.id, id));
  },

  async castVote(eventId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<Vote> {
    const [vote] = await db
      .insert(votes)
      .values({ eventId, userId, voteType })
      .onConflictDoUpdate({
        target: [votes.userId, votes.eventId],
        set: { voteType, createdAt: new Date() },
      })
      .returning();
    return vote;
  },

  async removeVote(eventId: string, userId: string): Promise<void> {
    await db
      .delete(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
  },

  async getEventVotes(eventId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.eventId, eventId));
  },

  async getUserVote(eventId: string, userId: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
    return vote || undefined;
  },

  async getUserVotes(userId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.userId, userId));
  },
};
