/**
 * Authorization middleware and helper functions
 * Ensures users can only access resources they own or have permission to access
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

/**
 * Get the authenticated user ID from the request
 * CRITICAL: This returns the stable user.id from the database, NOT the OAuth sub
 * OAuth subs can change, but user.id is stable and tied to email
 */
export async function getUserId(req: Request): Promise<string> {
  const user = req.user as any;
  const email = user?.claims?.email;
  const oauthSub = user?.claims?.sub;

  if (!email && !oauthSub) {
    throw new Error("No authentication claims found");
  }

  // Look up user by email first (most stable identifier)
  if (email) {
    const dbUser = await storage.getUserByEmail(email);
    if (dbUser) {
      return dbUser.id;
    }
  }

  // Fallback: try looking up by OAuth sub directly (for backwards compatibility)
  if (oauthSub) {
    const dbUser = await storage.getUser(oauthSub);
    if (dbUser) {
      return dbUser.id;
    }
  }

  // If we get here, user is authenticated but not in database (shouldn't happen)
  throw new Error("Authenticated user not found in database");
}

/**
 * Check if a user owns a group
 */
export async function userOwnsGroup(userId: string, groupId: string): Promise<boolean> {
  const group = await storage.getGroup(groupId);
  return group?.userId === userId;
}

/**
 * Check if a user is a member of a group
 * Also verifies the group exists and is not soft-deleted
 */
export async function userIsMemberOfGroup(userId: string, groupId: string): Promise<boolean> {
  // First verify the group exists and is not deleted
  const group = await storage.getGroup(groupId);
  if (!group) {
    return false;
  }
  const members = await storage.getGroupMembers(groupId);
  return members.some(member => member.userId === userId);
}

/**
 * Synchronous version for cases where we just need OAuth sub
 * DEPRECATED: Use getUserId() instead whenever possible
 */
export function getOAuthSub(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

/**
 * Check if a claim token is valid for a specific member
 */
export async function isValidClaimToken(memberId: string, claimToken: string): Promise<boolean> {
  const member = await storage.getMember(memberId);
  return member?.claimToken === claimToken;
}

/**
 * Middleware: Require group ownership
 * Use this for routes that modify group settings
 */
export function requireGroupOwnership() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      // Check URL params first, then fall back to request body for POST endpoints
      const groupId = req.params.id || req.params.groupId || (req.body as any)?.groupId;

      if (!groupId) {
        return res.status(400).json({ message: "Group ID is required" });
      }

      const group = await storage.getGroup(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't own this group" });
      }

      // Store group in request for later use to avoid re-fetching
      (req as any).group = group;
      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require group ownership OR membership
 * Use this for routes where group members can participate
 */
export function requireGroupAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const groupId = req.params.id || req.params.groupId;

      if (!groupId) {
        return res.status(400).json({ message: "Group ID is required" });
      }

      const group = await storage.getGroup(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user owns the group
      if (group.userId === userId) {
        (req as any).group = group;
        (req as any).isGroupOwner = true;
        return next();
      }

      // Check if user is a member
      const isMember = await userIsMemberOfGroup(userId, groupId);
      if (isMember) {
        (req as any).group = group;
        (req as any).isGroupOwner = false;
        return next();
      }

      return res.status(403).json({ message: "Forbidden: You don't have access to this group" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require itinerary access (creator or group owner)
 */
export function requireItineraryAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const itineraryId = req.params.id || req.params.itineraryId;

      if (!itineraryId) {
        return res.status(400).json({ message: "Itinerary ID is required" });
      }

      const itinerary = await storage.getItinerary(itineraryId);

      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Check if user created the itinerary
      if (itinerary.createdBy === userId) {
        (req as any).itinerary = itinerary;
        return next();
      }

      // Check if user is the host member of this itinerary
      if (itinerary.hostMemberId && itinerary.groupId) {
        const members = await storage.getGroupMembers(itinerary.groupId);
        const hostMember = members.find(m => m.id === itinerary.hostMemberId);
        if (hostMember?.userId === userId) {
          (req as any).itinerary = itinerary;
          (req as any).isHost = true;
          return next();
        }
      }

      // Check if user owns the group
      if (!itinerary.groupId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const group = await storage.getGroup(itinerary.groupId);
      if (group?.userId === userId) {
        (req as any).itinerary = itinerary;
        (req as any).group = group;
        return next();
      }

      return res.status(403).json({ message: "Forbidden: You don't have access to this itinerary" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require voting event access (creator or group owner)
 */
export function requireVotingEventAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const eventId = req.params.id;

      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      const event = await storage.getVotingEvent(eventId);

      if (!event) {
        return res.status(404).json({ message: "Voting event not found" });
      }

      // Check if user created the event
      if (event.createdBy === userId) {
        (req as any).votingEvent = event;
        return next();
      }

      // Check if user owns the group
      const group = await storage.getGroup(event.groupId);
      if (group?.userId === userId) {
        (req as any).votingEvent = event;
        (req as any).group = group;
        return next();
      }

      return res.status(403).json({ message: "Forbidden: You don't have access to this voting event" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require collection ownership
 */
export function requireCollectionOwnership() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const collectionId = req.params.id;

      if (!collectionId) {
        return res.status(400).json({ message: "Collection ID is required" });
      }

      // Get all user collections and find the one we're looking for
      const collections = await storage.getUserGroupCollections(userId);
      const collection = collections.find(c => c.id === collectionId);

      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }

      (req as any).collection = collection;
      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require member access (group owner OR valid claim token)
 */
export function requireMemberAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const memberId = req.params.id;
      const claimToken = req.body.claimToken;

      if (!memberId) {
        return res.status(400).json({ message: "Member ID is required" });
      }

      const member = await storage.getMember(memberId);

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // First check if valid claim token is provided (allows unauthenticated access)
      if (claimToken && member.claimToken === claimToken) {
        (req as any).member = member;
        (req as any).isGroupOwner = false;
        return next();
      }

      // Then check if user is authenticated and owns the group
      try {
        const userId = await getUserId(req);
        const group = await storage.getGroup(member.groupId);
        if (group?.userId === userId) {
          (req as any).member = member;
          (req as any).group = group;
          (req as any).isGroupOwner = true;
          return next();
        }
      } catch {
        // User not authenticated - that's okay, we already checked claim token above
      }

      return res.status(403).json({ message: "Forbidden: You don't have access to this member" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require admin access
 * Checks against ADMIN_EMAILS environment variable (comma-separated list)
 */
function getAdminEmails(): string[] {
  const envAdmins = process.env.ADMIN_EMAILS;
  if (envAdmins) {
    return envAdmins.split(',').map(email => email.trim().toLowerCase());
  }
  return [];
}

export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const email = user?.claims?.email?.toLowerCase();
      const adminEmails = getAdminEmails();

      if (!email || !adminEmails.includes(email)) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}
