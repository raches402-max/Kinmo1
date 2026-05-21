import { db } from "../db";
import {
  members,
  groups,
  memberGroupPreferences,
  userProfiles,
  type Member,
  type InsertMember,
  type UpdateMember,
  type UserProfile,
} from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export const membersStorage = {
  async getGroupMembers(groupId: string): Promise<Member[]> {
    const rows = await db
      .select()
      .from(members)
      .innerJoin(groups, eq(members.groupId, groups.id))
      .where(and(eq(members.groupId, groupId), isNull(groups.deletedAt)));

    return rows.map(({ members }) => members);
  },

  async createMember(insertMember: InsertMember): Promise<Member> {
    const [member] = await db
      .insert(members)
      .values(insertMember)
      .returning();
    return member;
  },

  async markInvitationsSent(groupId: string): Promise<void> {
    await db
      .update(members)
      .set({ invitationSent: true })
      .where(eq(members.groupId, groupId));
  },

  async getMember(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member || undefined;
  },

  async getGroupMemberByUserId(groupId: string, userId: string): Promise<Member | undefined> {
    const [row] = await db
      .select()
      .from(members)
      .innerJoin(groups, eq(members.groupId, groups.id))
      .where(and(
        eq(members.groupId, groupId),
        eq(members.userId, userId),
        isNull(groups.deletedAt)
      ));
    return row?.members || undefined;
  },

  async updateMember(id: string, updates: UpdateMember): Promise<Member> {
    const [member] = await db
      .update(members)
      .set(updates)
      .where(eq(members.id, id))
      .returning();
    return member;
  },

  async deleteMember(id: string): Promise<void> {
    const member = await membersStorage.getMember(id);
    if (member?.isOrganizer) {
      throw new Error("Cannot delete organizer member");
    }

    await db
      .delete(members)
      .where(eq(members.id, id));
  },

  async getGroupMembersAvailability(groupId: string): Promise<Array<{
    memberId: string;
    memberName: string;
    userId: string | null;
    availability: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> | null;
  }>> {
    const groupMembers = await membersStorage.getGroupMembers(groupId);

    const allGroupPrefs = await db
      .select()
      .from(memberGroupPreferences)
      .where(eq(memberGroupPreferences.groupId, groupId));

    const userIds = groupMembers
      .filter(m => m.userId)
      .map(m => m.userId as string);

    let userProfilesMap: Map<string, UserProfile> = new Map();
    if (userIds.length > 0) {
      const profiles = await db
        .select()
        .from(userProfiles)
        .where(sql`${userProfiles.userId} IN ${userIds}`);

      profiles.forEach(profile => {
        userProfilesMap.set(profile.userId, profile);
      });
    }

    return groupMembers.map(member => {
      const groupPref = member.userId
        ? allGroupPrefs.find(p => p.userId === member.userId)
        : null;

      if (groupPref?.availabilityOverride) {
        return {
          memberId: member.id,
          memberName: member.name || 'Unknown',
          userId: member.userId,
          availability: groupPref.availabilityOverride as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>,
        };
      }

      if (member.personalAvailability) {
        return {
          memberId: member.id,
          memberName: member.name || 'Unknown',
          userId: member.userId,
          availability: member.personalAvailability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>,
        };
      }

      if (member.userId) {
        const userProfile = userProfilesMap.get(member.userId);
        if (userProfile?.personalAvailability) {
          return {
            memberId: member.id,
            memberName: member.name || 'Unknown',
            userId: member.userId,
            availability: userProfile.personalAvailability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>,
          };
        }
      }

      return {
        memberId: member.id,
        memberName: member.name || 'Unknown',
        userId: member.userId,
        availability: null,
      };
    });
  },

  async getGroupMembersBudgets(groupId: string): Promise<Array<{
    memberId: string;
    memberName: string;
    userId: string | null;
    budgetMin: number;
    budgetMax: number;
  }>> {
    // Inline group lookup (groups domain not yet extracted)
    const [group] = await db.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.deletedAt)));
    const groupBudgetMin = group?.budgetMin ?? 20;
    const groupBudgetMax = group?.budgetMax ?? 80;

    const groupMembers = await membersStorage.getGroupMembers(groupId);

    const allGroupPrefs = await db
      .select()
      .from(memberGroupPreferences)
      .where(eq(memberGroupPreferences.groupId, groupId));

    const userIds = groupMembers
      .filter(m => m.userId)
      .map(m => m.userId as string);

    let userProfilesMap: Map<string, UserProfile> = new Map();
    if (userIds.length > 0) {
      const profiles = await db
        .select()
        .from(userProfiles)
        .where(sql`${userProfiles.userId} IN ${userIds}`);

      profiles.forEach(profile => {
        userProfilesMap.set(profile.userId, profile);
      });
    }

    return groupMembers.map(member => {
      const groupPref = member.userId
        ? allGroupPrefs.find(p => p.userId === member.userId)
        : null;

      if (groupPref?.budgetOverrideMin != null && groupPref?.budgetOverrideMax != null) {
        return {
          memberId: member.id,
          memberName: member.name || 'Unknown',
          userId: member.userId,
          budgetMin: groupPref.budgetOverrideMin,
          budgetMax: groupPref.budgetOverrideMax,
        };
      }

      if (member.userId) {
        const userProfile = userProfilesMap.get(member.userId);
        if (userProfile?.budgetMin != null && userProfile?.budgetMax != null) {
          return {
            memberId: member.id,
            memberName: member.name || 'Unknown',
            userId: member.userId,
            budgetMin: userProfile.budgetMin,
            budgetMax: userProfile.budgetMax,
          };
        }
      }

      return {
        memberId: member.id,
        memberName: member.name || 'Unknown',
        userId: member.userId,
        budgetMin: groupBudgetMin,
        budgetMax: groupBudgetMax,
      };
    });
  },
};
