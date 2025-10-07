// Reference: javascript_database blueprint
import { 
  groups, members, activities,
  type Group, type InsertGroup,
  type Member, type InsertMember,
  type Activity, type InsertActivity
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // Groups
  createGroup(group: InsertGroup, memberInputs: Array<{name: string, email: string}>): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByShareableLink(link: string): Promise<Group | undefined>;
  updateGroupStatus(id: string, status: string, error?: string): Promise<void>;
  
  // Members
  getGroupMembers(groupId: string): Promise<Member[]>;
  createMember(member: InsertMember): Promise<Member>;
  markInvitationsSent(groupId: string): Promise<void>;
  
  // Activities
  getGroupActivities(groupId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  createActivities(activities: InsertActivity[]): Promise<Activity[]>;
}

export class DatabaseStorage implements IStorage {
  async createGroup(insertGroup: InsertGroup, memberInputs: Array<{name: string, email: string}>): Promise<Group> {
    // Generate unique shareable link
    const shareableLink = randomBytes(16).toString('hex');
    
    const [group] = await db
      .insert(groups)
      .values({ ...insertGroup, shareableLink })
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
    return await db.select().from(activities).where(eq(activities.groupId, groupId));
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
}

export const storage = new DatabaseStorage();
