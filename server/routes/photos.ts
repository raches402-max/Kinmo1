/**
 * Photos & OG Image Routes
 *
 * Routes:
 *   GET /api/og-image/:type/:id          — generate OG image (join, rsvp, claim, default)
 *   GET /api/geocode                     — geocode an address to coordinates
 *   GET /api/photos/v1/:photoName(*)     — Places API v1 photo proxy (with cache)
 *   GET /api/photos/:photoReference      — Legacy photo proxy (with cache)
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { geocodeLocation } from "../google-places";
import { generateOGImage, generateDefaultOGImage, type OGImageParams } from "../og-image";
import { fail } from "../lib/responses";
import {
  members as membersTable,
  rsvps as rsvpsTable,
  guestInvites,
  photosCache,
} from "@shared/schema";

const router = Router();

// ── OG Image ──────────────────────────────────────────────────────────────

router.get("/og-image/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  // Set caching headers (cache for 1 day)
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.setHeader("Content-Type", "image/png");

  try {
    let imageParams: OGImageParams;

    if (type === "join") {
      const group = await storage.getGroupByShareableLink(id);
      if (!group) {
        return res.status(404).send("Not found");
      }
      imageParams = {
        groupEmoji: group.emoji || "👋",
        groupName: group.name,
        city: group.locationBase || undefined,
      };
    } else if (type === "rsvp") {
      const [guestRsvp] = await db
        .select()
        .from(rsvpsTable)
        .where(eq(rsvpsTable.guestToken, id))
        .limit(1);

      let itineraryId: string | null = null;

      if (guestRsvp) {
        itineraryId = guestRsvp.itineraryId;
      } else {
        const [guestInvite] = await db
          .select()
          .from(guestInvites)
          .where(eq(guestInvites.guestToken, id))
          .limit(1);

        if (guestInvite) {
          itineraryId = guestInvite.itineraryId;
        }
      }

      if (!itineraryId) {
        return res.status(404).send("Not found");
      }

      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).send("Not found");
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).send("Not found");
      }

      const eventDate = itinerary.eventDate
        ? new Date(itinerary.eventDate).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })
        : undefined;

      imageParams = {
        groupEmoji: group.emoji || "📅",
        groupName: group.name,
        date: eventDate,
        city: group.locationBase || undefined,
      };
    } else if (type === "claim") {
      const [member] = await db
        .select({
          id: membersTable.id,
          name: membersTable.name,
          groupId: membersTable.groupId,
        })
        .from(membersTable)
        .where(sql`claim_token = ${id}`)
        .limit(1);

      if (!member) {
        return res.status(404).send("Not found");
      }

      const group = await storage.getGroup(member.groupId);
      if (!group) {
        return res.status(404).send("Not found");
      }

      imageParams = {
        groupEmoji: group.emoji || "👋",
        groupName: `Join ${group.name}`,
        city: group.locationBase || undefined,
      };
    } else if (type === "default") {
      const image = await generateDefaultOGImage();
      return res.send(image);
    } else {
      return res.status(400).send("Invalid type");
    }

    const image = await generateOGImage(imageParams);
    res.send(image);
  } catch (error) {
    console.error("[OG Image] Error:", error);
    res.status(500).send("Error generating image");
  }
});

// ── Geocode ───────────────────────────────────────────────────────────────

router.get("/geocode", async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return fail(res, 400, "Address parameter required");
    }

    const result = await geocodeLocation(address);

    if (!result) {
      return fail(res, 404, "Location not found");
    }

    res.json(result);
  } catch (error: any) {
    console.error("Geocode error:", error);
    fail(res, 500, safeError(error, "Failed to geocode location"));
  }
});

// ── Photos API v1 proxy ───────────────────────────────────────────────────

router.get("/photos/v1/:photoName(*)", async (req, res) => {
  try {
    const photoName = decodeURIComponent(req.params.photoName);

    if (!photoName) {
      return fail(res, 400, "Photo name is required");
    }

    const placeIdMatch = photoName.match(/^places\/([^\/]+)\/photos\//);
    const placeId = placeIdMatch ? placeIdMatch[1] : null;

    // Check cache first
    const cached = await db
      .select()
      .from(photosCache)
      .where(eq(photosCache.photoReference, photoName))
      .limit(1);

    if (cached.length > 0) {
      const cachedPhoto = cached[0];
      if (new Date() > cachedPhoto.expiresAt) {
        console.log(`[Photo Cache v1] EXPIRED - ${photoName}`);
        await db.delete(photosCache).where(eq(photosCache.photoReference, photoName));
      } else {
        console.log(`[Photo Cache v1] HIT - ${photoName}`);
        const imageBuffer = Buffer.from(cachedPhoto.imageData, "base64");
        res.set("Content-Type", cachedPhoto.contentType);
        res.set("Cache-Control", "public, max-age=2592000");
        return res.send(imageBuffer);
      }
    }

    // Fallback: Try same placeId (handles ephemeral photo IDs)
    if (placeId) {
      const placeIdCached = await db
        .select()
        .from(photosCache)
        .where(eq(photosCache.placeId, placeId))
        .limit(1);

      if (placeIdCached.length > 0) {
        const cachedPhoto = placeIdCached[0];
        if (new Date() > cachedPhoto.expiresAt) {
          console.log(`[Photo Cache v1] EXPIRED (placeId fallback) - ${placeId}`);
          await db.delete(photosCache).where(eq(photosCache.photoReference, cachedPhoto.photoReference));
        } else {
          console.log(`[Photo Cache v1] HIT (placeId fallback) - ${placeId}`);
          const imageBuffer = Buffer.from(cachedPhoto.imageData, "base64");
          res.set("Content-Type", cachedPhoto.contentType);
          res.set("Cache-Control", "public, max-age=2592000");
          return res.send(imageBuffer);
        }
      }
    }

    console.log(`[Photo Cache v1] MISS - downloading ${photoName}`);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY_2 || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return fail(res, 500, "Google API key not configured");
    }

    let photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400`;
    let photoResponse = await fetch(photoUrl, {
      headers: { "X-Goog-Api-Key": apiKey },
    });

    let actualPhotoName = photoName;

    if (!photoResponse.ok && placeId) {
      console.log(`[Photo Cache v1] Stale photo ID, fetching fresh photo for place ${placeId}`);
      const placeDetailsUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&languageCode=en`;
      const placeResponse = await fetch(placeDetailsUrl, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "photos",
        },
      });

      if (placeResponse.ok) {
        const placeData = await placeResponse.json();
        if (placeData.photos && placeData.photos.length > 0) {
          actualPhotoName = placeData.photos[0].name;
          console.log(`[Photo Cache v1] Got fresh photo: ${actualPhotoName}`);
          photoUrl = `https://places.googleapis.com/v1/${actualPhotoName}/media?maxWidthPx=400`;
          photoResponse = await fetch(photoUrl, {
            headers: { "X-Goog-Api-Key": apiKey },
          });
        }
      }
    }

    if (!photoResponse.ok) {
      console.error(`[Photo Cache v1] Failed to fetch photo: ${photoResponse.status}`);
      return fail(res, 404, "Photo not found");
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    const contentType = photoResponse.headers.get("content-type") || "image/jpeg";
    const base64Data = Buffer.from(photoBuffer).toString("base64");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db
      .insert(photosCache)
      .values({
        photoReference: actualPhotoName,
        placeId: placeId,
        imageData: base64Data,
        contentType,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: photosCache.photoReference,
        set: {
          placeId: placeId,
          imageData: base64Data,
          contentType,
          expiresAt,
        },
      });

    console.log(`[Photo Cache v1] SAVED - ${actualPhotoName} (placeId: ${placeId})`);

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=2592000");
    res.send(Buffer.from(photoBuffer));
  } catch (error) {
    console.error("Error fetching photo v1:", error);
    fail(res, 500, "Failed to fetch photo");
  }
});

// ── Legacy photos proxy ───────────────────────────────────────────────────

router.get("/photos/:photoReference", async (req, res) => {
  try {
    const { photoReference } = req.params;

    if (!photoReference) {
      return fail(res, 400, "Photo reference is required");
    }

    const cached = await db
      .select()
      .from(photosCache)
      .where(eq(photosCache.photoReference, photoReference))
      .limit(1);

    if (cached.length > 0) {
      const cachedPhoto = cached[0];
      if (new Date() > cachedPhoto.expiresAt) {
        await db.delete(photosCache).where(eq(photosCache.photoReference, photoReference));
      } else {
        const imageBuffer = Buffer.from(cachedPhoto.imageData, "base64");
        res.set("Content-Type", cachedPhoto.contentType);
        res.set("Cache-Control", "public, max-age=2592000");
        return res.send(imageBuffer);
      }
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return fail(res, 500, "Google API key not configured");
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
    const photoResponse = await fetch(photoUrl);

    if (!photoResponse.ok) {
      console.error(`[Photo Cache] Failed to fetch photo: ${photoResponse.status}`);
      return fail(res, 404, "Photo not found");
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    const contentType = photoResponse.headers.get("content-type") || "image/jpeg";
    const base64Data = Buffer.from(photoBuffer).toString("base64");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db
      .insert(photosCache)
      .values({
        photoReference,
        imageData: base64Data,
        contentType,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: photosCache.photoReference,
        set: {
          imageData: base64Data,
          contentType,
          expiresAt,
        },
      });

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=2592000");
    res.send(Buffer.from(photoBuffer));
  } catch (error) {
    console.error("Error fetching photo:", error);
    fail(res, 500, "Failed to fetch photo");
  }
});

export default router;
