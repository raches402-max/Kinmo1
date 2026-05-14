/**
 * Guest Invites Routes
 *
 * CRUD for guest invitations on itineraries.
 *
 *   POST   /itineraries/:itineraryId/guest-invites              — create guest invite
 *   GET    /itineraries/:itineraryId/guest-invites              — list guest invites
 *   PATCH  /itineraries/:itineraryId/guest-invites/:guestId     — update guest invite
 *   DELETE /itineraries/:itineraryId/guest-invites/:guestId     — delete guest invite
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import crypto from "crypto";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId, requireItineraryAccess } from "../authorization";
import { guestInvites } from "@shared/schema";

const router = Router();

router.post("/itineraries/:itineraryId/guest-invites", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { itineraryId } = req.params;
    const { guestName } = req.body;

    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ message: "Guest name is required" });
    }

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only the group owner can invite guests" });
    }

    const guestToken = `guest_${crypto.randomUUID()}`;

    const [guestInvite] = await db
      .insert(guestInvites)
      .values({
        itineraryId,
        guestName: guestName.trim(),
        guestToken,
        createdBy: userId,
      })
      .returning();

    res.json(guestInvite);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

router.get("/itineraries/:itineraryId/guest-invites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { itineraryId } = req.params;

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const invites = await db
      .select()
      .from(guestInvites)
      .where(eq(guestInvites.itineraryId, itineraryId));

    res.json(invites);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

router.patch("/itineraries/:itineraryId/guest-invites/:guestId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { itineraryId, guestId } = req.params;
    const { guestName } = req.body;

    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ message: "Guest name is required" });
    }

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only the group owner can edit guests" });
    }

    const [updated] = await db
      .update(guestInvites)
      .set({ guestName: guestName.trim() })
      .where(and(
        eq(guestInvites.id, guestId),
        eq(guestInvites.itineraryId, itineraryId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Guest not found" });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

router.delete("/itineraries/:itineraryId/guest-invites/:guestId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { itineraryId, guestId } = req.params;

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only the group owner can remove guests" });
    }

    const [deleted] = await db
      .delete(guestInvites)
      .where(and(
        eq(guestInvites.id, guestId),
        eq(guestInvites.itineraryId, itineraryId)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Guest not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
