import { db } from "../db";
import {
  memberFavoriteVenues,
  userSavedPlaces,
  groupSavedPlaces,
  members,
  groups,
  type MemberFavoriteVenue,
  type UserSavedPlace,
  type InsertUserSavedPlace,
  type GroupSavedPlace,
  type InsertGroupSavedPlace,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const savedPlacesStorage = {
  // Member Favorite Venues
  async getMemberFavoriteVenues(memberId: string): Promise<MemberFavoriteVenue[]> {
    const favorites = await db
      .select()
      .from(memberFavoriteVenues)
      .where(eq(memberFavoriteVenues.memberId, memberId))
      .orderBy(desc(memberFavoriteVenues.addedAt));

    return favorites;
  },

  // Get all favorite venues for a user across all their group memberships
  async getUserAllFavoriteVenues(userId: string, category?: string): Promise<Array<MemberFavoriteVenue & { groupId: string; groupName: string; groupEmoji: string | null; memberName: string | null }>> {
    const conditions = [eq(members.userId, userId)];
    if (category) {
      conditions.push(eq(memberFavoriteVenues.category, category));
    }

    const favorites = await db
      .select({
        id: memberFavoriteVenues.id,
        memberId: memberFavoriteVenues.memberId,
        venuePlaceId: memberFavoriteVenues.venuePlaceId,
        venueName: memberFavoriteVenues.venueName,
        venueAddress: memberFavoriteVenues.venueAddress,
        venuePhotoUrl: memberFavoriteVenues.venuePhotoUrl,
        category: memberFavoriteVenues.category,
        addedAt: memberFavoriteVenues.addedAt,
        groupId: groups.id,
        groupName: groups.name,
        groupEmoji: groups.emoji,
        memberName: members.name,
      })
      .from(memberFavoriteVenues)
      .innerJoin(members, eq(memberFavoriteVenues.memberId, members.id))
      .innerJoin(groups, eq(members.groupId, groups.id))
      .where(and(...conditions))
      .orderBy(desc(memberFavoriteVenues.addedAt));

    return favorites;
  },

  async addMemberFavoriteVenue(
    memberId: string,
    venue: {
      venuePlaceId: string;
      venueName: string;
      venueAddress?: string;
      venuePhotoUrl?: string;
      category?: string;
    }
  ): Promise<MemberFavoriteVenue> {
    const [favorite] = await db
      .insert(memberFavoriteVenues)
      .values({
        memberId,
        venuePlaceId: venue.venuePlaceId,
        venueName: venue.venueName,
        venueAddress: venue.venueAddress || null,
        venuePhotoUrl: venue.venuePhotoUrl || null,
        category: venue.category || null,
      })
      .returning();

    return favorite;
  },

  async removeMemberFavoriteVenue(memberId: string, venuePlaceId: string): Promise<void> {
    await db
      .delete(memberFavoriteVenues)
      .where(
        and(
          eq(memberFavoriteVenues.memberId, memberId),
          eq(memberFavoriteVenues.venuePlaceId, venuePlaceId)
        )
      );
  },

  async isFavoriteVenue(memberId: string, venuePlaceId: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(memberFavoriteVenues)
      .where(
        and(
          eq(memberFavoriteVenues.memberId, memberId),
          eq(memberFavoriteVenues.venuePlaceId, venuePlaceId)
        )
      )
      .limit(1);

    return !!favorite;
  },

  // User Saved Places
  async getUserSavedPlaces(userId: string, category?: string): Promise<UserSavedPlace[]> {
    if (category) {
      return db
        .select()
        .from(userSavedPlaces)
        .where(and(
          eq(userSavedPlaces.userId, userId),
          eq(userSavedPlaces.category, category)
        ))
        .orderBy(desc(userSavedPlaces.createdAt));
    }
    return db
      .select()
      .from(userSavedPlaces)
      .where(eq(userSavedPlaces.userId, userId))
      .orderBy(desc(userSavedPlaces.createdAt));
  },

  async addUserSavedPlace(data: InsertUserSavedPlace): Promise<UserSavedPlace> {
    const [place] = await db
      .insert(userSavedPlaces)
      .values(data)
      .returning();
    return place;
  },

  async removeUserSavedPlace(userId: string, placeId: string): Promise<void> {
    await db
      .delete(userSavedPlaces)
      .where(
        and(
          eq(userSavedPlaces.userId, userId),
          eq(userSavedPlaces.id, placeId)
        )
      );
  },

  async isUserSavedPlace(userId: string, googlePlaceId: string): Promise<boolean> {
    const [place] = await db
      .select()
      .from(userSavedPlaces)
      .where(
        and(
          eq(userSavedPlaces.userId, userId),
          eq(userSavedPlaces.googlePlaceId, googlePlaceId)
        )
      )
      .limit(1);
    return !!place;
  },

  // Group Saved Places
  async getGroupSavedPlaces(groupId: string, category?: string): Promise<GroupSavedPlace[]> {
    if (category) {
      return db
        .select()
        .from(groupSavedPlaces)
        .where(and(
          eq(groupSavedPlaces.groupId, groupId),
          eq(groupSavedPlaces.category, category)
        ))
        .orderBy(desc(groupSavedPlaces.createdAt));
    }
    return db
      .select()
      .from(groupSavedPlaces)
      .where(eq(groupSavedPlaces.groupId, groupId))
      .orderBy(desc(groupSavedPlaces.createdAt));
  },

  async addGroupSavedPlace(data: InsertGroupSavedPlace): Promise<GroupSavedPlace> {
    const [place] = await db
      .insert(groupSavedPlaces)
      .values(data)
      .returning();
    return place;
  },

  async removeGroupSavedPlace(groupId: string, placeId: string): Promise<void> {
    await db
      .delete(groupSavedPlaces)
      .where(
        and(
          eq(groupSavedPlaces.groupId, groupId),
          eq(groupSavedPlaces.id, placeId)
        )
      );
  },

  async isGroupSavedPlace(groupId: string, googlePlaceId: string): Promise<boolean> {
    const [place] = await db
      .select()
      .from(groupSavedPlaces)
      .where(
        and(
          eq(groupSavedPlaces.groupId, groupId),
          eq(groupSavedPlaces.googlePlaceId, googlePlaceId)
        )
      )
      .limit(1);
    return !!place;
  },
};
