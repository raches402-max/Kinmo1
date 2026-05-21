import { db } from "../db";
import {
  users,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const usersStorage = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async upsertUser(userData: UpsertUser): Promise<User> {
    // CRITICAL FIX: Use email as the stable identifier, NOT the OAuth sub
    // This prevents data loss when Replit OAuth provides different subject IDs across sessions

    if (!userData.email) {
      throw new Error("Email is required for upsertUser");
    }

    const existingUser = await usersStorage.getUserByEmail(userData.email);

    if (existingUser) {
      console.log(`[Auth] Updating existing user: ${userData.email}`);

      const newOidcSub = (userData as any).oidcSub || userData.id;
      const oldOidcSub = existingUser.oidcSub;

      let legacyOidcSubs = existingUser.legacyOidcSubs as string[] || [];

      if (oldOidcSub && newOidcSub !== oldOidcSub) {
        console.log(`[Auth] OAuth sub changed for ${userData.email}: ${oldOidcSub} → ${newOidcSub}`);

        if (!legacyOidcSubs.includes(oldOidcSub)) {
          legacyOidcSubs = [...legacyOidcSubs, oldOidcSub];
        }
      }

      const updateData: any = {
        firstName: userData.firstName || existingUser.firstName,
        lastName: userData.lastName || existingUser.lastName,
        profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
        oidcSub: newOidcSub,
        legacyOidcSubs: legacyOidcSubs.length > 0 ? legacyOidcSubs as any : null,
        updatedAt: new Date(),
      };

      if ((userData as any).googleId) {
        updateData.googleId = (userData as any).googleId;
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning();

      return updatedUser;
    } else {
      console.log(`[Auth] Creating new user: ${userData.email}`);

      const newOidcSub = (userData as any).oidcSub || userData.id;

      const insertData: any = {
        id: userData.id,
        email: userData.email,
        oidcSub: newOidcSub,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        legacyOidcSubs: null,
      };

      if ((userData as any).googleId) {
        insertData.googleId = (userData as any).googleId;
      }

      const [newUser] = await db
        .insert(users)
        .values(insertData)
        .returning();

      return newUser;
    }
  },
};
