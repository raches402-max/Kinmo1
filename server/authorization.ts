/**
 * Authorization middleware and helper functions
 * Ensures users can only access resources they own or have permission to access
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

/**
 * Get the authenticated user ID from the request
 */
export function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
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
 */
export async function userIsMemberOfGroup(userId: string, groupId: string): Promise<boolean> {
  const members = await storage.getGroupMembers(groupId);
  return members.some(member => member.userId === userId);
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
      const userId = getUserId(req);
      const groupId = req.params.id || req.params.groupId;

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
      const userId = getUserId(req);
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
      const userId = getUserId(req);
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

      // Check if user owns the group
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
      const userId = getUserId(req);
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
      const userId = getUserId(req);
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
      const userId = getUserId(req);
      const memberId = req.params.id;
      const claimToken = req.body.claimToken;

      if (!memberId) {
        return res.status(400).json({ message: "Member ID is required" });
      }

      const member = await storage.getMember(memberId);

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if user owns the group
      const group = await storage.getGroup(member.groupId);
      if (group?.userId === userId) {
        (req as any).member = member;
        (req as any).group = group;
        (req as any).isGroupOwner = true;
        return next();
      }

      // Check if valid claim token is provided
      if (claimToken && member.claimToken === claimToken) {
        (req as any).member = member;
        (req as any).isGroupOwner = false;
        return next();
      }

      return res.status(403).json({ message: "Forbidden: You don't have access to this member" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

/**
 * Middleware: Require admin access
 * Currently checks against a hardcoded list, but could be expanded to check roles in DB
 */
const ADMIN_EMAILS = ['raches402@gmail.com'];

export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const email = user?.claims?.email;

      if (!email || !ADMIN_EMAILS.includes(email)) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}
