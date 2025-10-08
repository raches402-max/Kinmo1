// Reference: javascript_database blueprint
// Reference: javascript_log_in_with_replit blueprint
import { 
  users, groups, members, activities, votingEvents, votes,
  type User, type UpsertUser,
  type Group, type InsertGroup, type UpdateGroup,
  type Member, type InsertMember, type UpdateMember,
  type Activity, type InsertActivity,
  type VotingEvent, type InsertVotingEvent, type UpdateVotingEvent,
  type Vote, type InsertVote
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Groups
  createGroup(group: InsertGroup, userId: string, memberInputs: Array<{name: string, email: string}>): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByShareableLink(link: string): Promise<Group | undefined>;
  getUserGroups(userId: string): Promise<Group[]>;
  updateGroup(id: string, updates: UpdateGroup): Promise<Group>;
  updateGroupStatus(id: string, status: string, error?: string): Promise<void>;
  
  // Members
  getGroupMembers(groupId: string): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, updates: UpdateMember): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  markInvitationsSent(groupId: string): Promise<void>;
  
  // Activities
  getGroupActivities(groupId: string): Promise<Activity[]>;
  getAllGroupActivities(groupId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  createActivities(activities: InsertActivity[]): Promise<Activity[]>;
  updateActivityFeedback(activityId: string, feedback: string): Promise<Activity>;
  archiveGroupActivities(groupId: string): Promise<void>;
  deleteAllGroupActivities(groupId: string): Promise<void>;
  
  // Voting Events
  createVotingEvent(event: InsertVotingEvent, userId: string): Promise<VotingEvent>;
  getVotingEvents(): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>;
  getGroupVotingEvents(groupId: string): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>;
  getVotingEvent(id: string): Promise<VotingEvent | undefined>;
  updateVotingEvent(id: string, updates: UpdateVotingEvent): Promise<VotingEvent>;
  deleteVotingEvent(id: string): Promise<void>;
  
  // Votes
  castVote(eventId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<Vote>;
  removeVote(eventId: string, userId: string): Promise<void>;
  getEventVotes(eventId: string): Promise<Vote[]>;
  getUserVote(eventId: string, userId: string): Promise<Vote | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Group operations
  async createGroup(insertGroup: InsertGroup, userId: string, memberInputs: Array<{name: string, email: string}>): Promise<Group> {
    // Generate unique shareable link
    const shareableLink = randomBytes(16).toString('hex');
    
    const [group] = await db
      .insert(groups)
      .values({ ...insertGroup, userId, shareableLink })
      .returning();
    
    // Create members if provided
    if (memberInputs.length > 0) {
      const membersData = memberInputs.map((m, index) => ({
        groupId: group.id,
        name: m.name || null,
        email: m.email || null,
        isOrganizer: index === 0, // First member is organizer
        invitationSent: false,
        hasJoined: false,
      }));
      
      await db.insert(members).values(membersData);
    }
    
    return group;
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.userId, userId));
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group || undefined;
  }

  async getGroupByShareableLink(link: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.shareableLink, link));
    return group || undefined;
  }

  async getGroupMembers(groupId: string): Promise<Member[]> {
    return await db.select().from(members).where(eq(members.groupId, groupId));
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const [member] = await db
      .insert(members)
      .values(insertMember)
      .returning();
    return member;
  }

  async getGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      and(
        eq(activities.groupId, groupId),
        sql`${activities.archivedAt} IS NULL`
      )
    ).orderBy(activities.createdAt);
  }

  async getAllGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      eq(activities.groupId, groupId)
    ).orderBy(activities.createdAt);
  }

  async archiveGroupActivities(groupId: string): Promise<void> {
    await db
      .update(activities)
      .set({ archivedAt: new Date() })
      .where(eq(activities.groupId, groupId));
  }

  async deleteAllGroupActivities(groupId: string): Promise<void> {
    await db
      .delete(activities)
      .where(eq(activities.groupId, groupId));
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    return activity;
  }

  async createActivities(insertActivities: InsertActivity[]): Promise<Activity[]> {
    if (insertActivities.length === 0) return [];
    
    return await db
      .insert(activities)
      .values(insertActivities)
      .returning();
  }

  async updateGroupStatus(id: string, status: string, error?: string): Promise<void> {
    await db
      .update(groups)
      .set({ 
        activityGenerationStatus: status,
        activityGenerationError: error || null
      })
      .where(eq(groups.id, id));
  }

  async markInvitationsSent(groupId: string): Promise<void> {
    await db
      .update(members)
      .set({ invitationSent: true })
      .where(eq(members.groupId, groupId));
  }

  async updateActivityFeedback(activityId: string, feedback: string): Promise<Activity> {
    const [activity] = await db
      .update(activities)
      .set({ feedback })
      .where(eq(activities.id, activityId))
      .returning();
    return activity;
  }

  async updateGroup(id: string, updates: UpdateGroup): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set(updates)
      .where(eq(groups.id, id))
      .returning();
    return group;
  }

  async getMember(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member || undefined;
  }

  async updateMember(id: string, updates: UpdateMember): Promise<Member> {
    const [member] = await db
      .update(members)
      .set(updates)
      .where(eq(members.id, id))
      .returning();
    return member;
  }

  async deleteMember(id: string): Promise<void> {
    // First check if the member is an organizer
    const member = await this.getMember(id);
    if (member?.isOrganizer) {
      throw new Error("Cannot delete organizer member");
    }
    
    await db
      .delete(members)
      .where(eq(members.id, id));
  }

  // Voting Events operations
  async createVotingEvent(insertEvent: InsertVotingEvent, userId: string): Promise<VotingEvent> {
    const [event] = await db
      .insert(votingEvents)
      .values({ ...insertEvent, createdBy: userId })
      .returning();
    return event;
  }

  async getVotingEvents(): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        rating: votingEvents.rating,
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
        createdBy: votingEvents.createdBy,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`))
      .limit(10);

    return events;
  }

  async getGroupVotingEvents(groupId: string): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        rating: votingEvents.rating,
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
        createdBy: votingEvents.createdBy,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(eq(votingEvents.groupId, groupId))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`))
      .limit(10);

    return events;
  }

  async getVotingEvent(id: string): Promise<VotingEvent | undefined> {
    const [event] = await db.select().from(votingEvents).where(eq(votingEvents.id, id));
    return event || undefined;
  }

  async updateVotingEvent(id: string, updates: UpdateVotingEvent): Promise<VotingEvent> {
    const [event] = await db
      .update(votingEvents)
      .set(updates)
      .where(eq(votingEvents.id, id))
      .returning();
    return event;
  }

  async deleteVotingEvent(id: string): Promise<void> {
    await db.delete(votingEvents).where(eq(votingEvents.id, id));
  }

  // Votes operations
  async castVote(eventId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<Vote> {
    const existingVote = await this.getUserVote(eventId, userId);
    
    if (existingVote) {
      if (existingVote.voteType === voteType) {
        return existingVote;
      }
      const [vote] = await db
        .update(votes)
        .set({ voteType })
        .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)))
        .returning();
      return vote;
    }
    
    const [vote] = await db
      .insert(votes)
      .values({ eventId, userId, voteType })
      .returning();
    return vote;
  }

  async removeVote(eventId: string, userId: string): Promise<void> {
    await db
      .delete(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
  }

  async getEventVotes(eventId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.eventId, eventId));
  }

  async getUserVote(eventId: string, userId: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
    return vote || undefined;
  }
}

export const storage = new DatabaseStorage();
