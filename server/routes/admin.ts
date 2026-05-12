/**
 * Admin Routes
 *
 * All /api/admin/* endpoints. Requires authentication + admin email check.
 *
 *   POST   /api/admin/import-venues
 *   GET    /api/admin/ai-stats
 *   POST   /api/admin/calibrate-all
 *   POST   /api/admin/backfill-coordinates
 *   GET    /api/admin/stats
 *   GET    /api/admin/job-health
 *   POST   /api/admin/create-backup
 *   GET    /api/admin/backups
 *   POST   /api/admin/restore/:backupId
 *   GET    /api/admin/test-accounts
 *   POST   /api/admin/switch-user
 *   POST   /api/admin/cache-photos
 *   POST   /api/admin/backfill-favorites-coordinates
 *   POST   /api/admin/audit-venue-data
 *   POST   /api/admin/cleanup-curated-venues
 *   GET    /api/admin/deleted-venues
 *   POST   /api/admin/cleanup-orphaned-voting-data
 *   DELETE /api/admin/groups/:id
 *   POST   /api/admin/recategorize-venues
 *   POST   /api/admin/scraped-venues/upload
 *   GET    /api/admin/scraped-venues/comparison
 *   DELETE /api/admin/scraped-venues/clear
 *   POST   /api/admin/scraped-venues/import
 *   GET    /api/admin/venue-analytics
 *   GET    /api/admin/venues-by-filter
 *   GET    /api/admin/api-logs
 *   GET    /api/admin/api-costs
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, sql, and, or, gte, desc } from "drizzle-orm";
import { isAuthenticated, } from "../googleAuth";
import {
  requireAdmin,
  getUserId,
  getAdminEmails,
} from "../authorization";
import { safeParse } from "../validation-middleware";
import { importVenuesSchema, switchUserSchema } from "../validation-schemas";
import {
  curatedVenues,
  geocodingCache,
  activities as activitiesTable,
  votingEvents as votingEventsTable,
  photosCache,
  groups as groupsTable,
  users,
} from "@shared/schema";
import { geocodeLocation, getCacheStats, getPlaceDetails } from "../google-places";
import { getPromptCacheStats, isObviouslyInvalidVenue, validateVenuesBatch, categorizeVenue, clearCategorizationCache } from "../openai";
import { getJobHealthStatus } from "../lib/job-tracker";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function requireAdminAccess(req: any, res: any): Promise<string | null> {
  const userId = await getUserId(req);
  const user = await storage.getUser(userId);
  const adminEmails = getAdminEmails();
  if (!user || !adminEmails.includes(user.email || '')) {
    res.status(403).json({ message: "Unauthorized: Admin access required" });
    return null;
  }
  return userId;
}

// ─── routes ───────────────────────────────────────────────────────────────────

// Bulk import curated venues (admin only - for seeding SF data)
router.post('/admin/import-venues', isAuthenticated, requireAdmin(), async (req, res) => {
  try {
    const validatedData = safeParse(importVenuesSchema, req.body, res);
    if (!validatedData) return;

    const { venues } = validatedData;

    const extractPlaceId = (url: string): string | null => {
      const match = url.match(/query_place_id=([^&]+)/);
      return match ? match[1] : null;
    };

    const mapCategory = (categoryName: string): string => {
      const lower = categoryName.toLowerCase();
      if (lower.includes('bar') || lower.includes('pub') || lower.includes('brewery')) return 'drinks';
      if (lower.includes('restaurant') || lower.includes('dining')) return 'meal';
      if (lower.includes('cafe') || lower.includes('coffee')) return 'cafes';
      if (lower.includes('dessert') || lower.includes('ice cream') || lower.includes('bakery')) return 'dessert';
      if (lower.includes('museum') || lower.includes('theater') || lower.includes('concert')) return 'experiences';
      return 'experiences';
    };

    const imported = [];
    const skipped = [];

    for (const venue of venues) {
      try {
        const placeId = extractPlaceId(venue.url);
        if (!placeId) {
          skipped.push({ venue: venue.title, reason: 'No Place ID found' });
          continue;
        }

        const existing = await db
          .select()
          .from(curatedVenues)
          .where(eq(curatedVenues.googlePlaceId, placeId))
          .limit(1);

        if (existing.length > 0) {
          skipped.push({ venue: venue.title, reason: 'Already exists' });
          continue;
        }

        const address = `${venue.street || ''}, ${venue.city || ''}, ${venue.state || ''} ${venue.countryCode || ''}`.trim();

        let latitude = "0";
        let longitude = "0";

        try {
          const cached = await db
            .select()
            .from(geocodingCache)
            .where(eq(geocodingCache.location, address))
            .limit(1);

          if (cached.length > 0) {
            latitude = cached[0].latitude;
            longitude = cached[0].longitude;
          } else {
            const geocoded = await geocodeLocation(address);
            if (geocoded) {
              latitude = geocoded.latitude.toString();
              longitude = geocoded.longitude.toString();
            }
          }
        } catch (_geocodeError) {}

        await db.insert(curatedVenues).values({
          name: venue.title,
          address,
          latitude,
          longitude,
          category: mapCategory(venue.categoryName || 'other'),
          rating: venue.totalScore?.toString() || null,
          reviewCount: venue.reviewsCount || null,
          priceLevel: null,
          photoUrl: null,
          googlePlaceId: placeId,
          description: null,
          tags: venue.categoryName ? [venue.categoryName] : [],
          region: 'san_francisco',
          isActive: true,
          source: 'api_scrape',
        });

        imported.push(venue.title);
      } catch (venueError) {
        console.error(`[Venue Import] Error importing ${venue.title}:`, venueError);
        skipped.push({ venue: venue.title, reason: 'Import error' });
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      details: { imported: imported.slice(0, 10), skipped: skipped.slice(0, 10) },
    });
  } catch (error) {
    console.error("[Venue Import] Error:", error);
    res.status(500).json({ message: "Failed to import venues" });
  }
});

// Get A/B testing and cache statistics
router.get("/admin/ai-stats", isAuthenticated, requireAdmin(), async (req, res) => {
  try {
    const cacheStats = getPromptCacheStats();
    const placesStats = getCacheStats();

    const abTestMetrics = {
      totalCalls: 0,
      gpt4oCalls: 0,
      miniCalls: 0,
      cacheHits: 0,
      averageCost: { gpt4o: 0, mini: 0 },
      averageResponseTime: { gpt4o: 0, mini: 0 },
      currentABTestPercentage: 100,
    };

    res.json({
      promptCache: cacheStats,
      placesCache: {
        searchHits: placesStats.searchHits,
        searchMisses: placesStats.searchMisses,
        placeDetailsHits: placesStats.placeDetailsHits,
        placeDetailsMisses: placesStats.placeDetailsMisses,
      },
      abTest: abTestMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AI Stats] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Calibrate all groups
router.post("/admin/calibrate-all", isAuthenticated, async (req: any, res) => {
  try {
    const { calibrateAllGroups } = await import('../confidence-calibration');
    const results = await calibrateAllGroups();
    res.json({ totalGroups: results.length, results });
  } catch (error: any) {
    console.error('Error running calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Backfill coordinates for existing groups
router.post("/admin/backfill-coordinates", isAuthenticated, requireAdmin(), async (req, res) => {
  try {
    const groups = await storage.getAllGroups();
    let backfilled = 0;
    let failed = 0;
    let skipped = 0;

    for (const group of groups) {
      if (group.latitude && group.longitude && group.timezone) { skipped++; continue; }
      if (!group.locationBase || group.locationBase.trim() === '') { skipped++; continue; }

      const geocoded = await geocodeLocation(group.locationBase);
      if (geocoded) {
        await storage.updateGroup(group.id, {
          latitude: geocoded.latitude.toString(),
          longitude: geocoded.longitude.toString(),
          timezone: geocoded.timezone,
        });
        backfilled++;
      } else {
        failed++;
      }
    }

    res.json({
      success: true,
      message: `Backfilled ${backfilled} groups, ${skipped} already had coordinates, ${failed} failed to geocode`,
      backfilled,
      skipped,
      failed,
    });
  } catch (error: any) {
    console.error("Error backfilling coordinates:", error);
    res.status(500).json({ message: error.message });
  }
});

// Platform statistics
router.get("/admin/stats", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const includeTestData = req.query.includeTestData === 'true';
    const stats = await storage.getAdminStats(includeTestData);
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// Background job health
router.get("/admin/job-health", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const jobHealth = getJobHealthStatus();
    const jobs = Object.values(jobHealth);
    const failingJobs = jobs.filter((j: any) => j.status === 'failing').length;
    const degradedJobs = jobs.filter((j: any) => j.status === 'degraded').length;
    const overallStatus = failingJobs > 0 ? 'failing' : degradedJobs > 0 ? 'degraded' : 'healthy';

    res.json({
      overallStatus,
      summary: {
        total: jobs.length,
        healthy: jobs.filter((j: any) => j.status === 'healthy').length,
        degraded: degradedJobs,
        failing: failingJobs,
      },
      jobs: jobHealth,
    });
  } catch (error: any) {
    console.error("Error fetching job health:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create database backup
router.post("/admin/create-backup", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { notes } = req.body;
    const backup = await storage.createDatabaseBackup('manual', userId, notes);
    await storage.pruneDatabaseBackups(30);

    res.json({
      message: "Backup created successfully",
      backup: {
        id: backup.id,
        backupType: backup.backupType,
        createdAt: backup.createdAt,
        notes: backup.notes,
        counts: backup.snapshotData.counts,
      },
    });
  } catch (error: any) {
    console.error("Error creating backup:", error);
    res.status(500).json({ message: error.message });
  }
});

// List all database backups
router.get("/admin/backups", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const backups = await storage.getAllDatabaseBackups();
    const backupsList = backups.map((b: any) => ({
      id: b.id,
      backupType: b.backupType,
      createdAt: b.createdAt,
      notes: b.notes,
      createdBy: b.createdBy,
      counts: b.snapshotData.counts,
    }));

    res.json(backupsList);
  } catch (error: any) {
    console.error("Error fetching backups:", error);
    res.status(500).json({ message: error.message });
  }
});

// Restore database from backup
router.post("/admin/restore/:backupId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { backupId } = req.params;
    await storage.createDatabaseBackup('pre_restore', userId, `Backup before restoring to ${backupId}`);
    await storage.restoreDatabaseBackup(backupId);
    res.json({ message: "Database restored successfully" });
  } catch (error: any) {
    console.error("Error restoring backup:", error);
    res.status(500).json({ message: error.message });
  }
});

// List test accounts
router.get("/admin/test-accounts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const testAccounts = await storage.getTestAccounts();
    res.json(testAccounts);
  } catch (error: any) {
    console.error("Error fetching test accounts:", error);
    res.status(500).json({ message: error.message });
  }
});

// Switch to test account (admin impersonation)
router.post("/admin/switch-user", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const validatedData = safeParse(switchUserSchema, req.body, res);
    if (!validatedData) return;

    const { targetUserId } = validatedData;
    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const isTestAccount = targetUser.email?.includes('@example.com') || targetUser.email?.includes('@test.com');
    if (!isTestAccount) {
      return res.status(403).json({ message: "Can only switch to test accounts" });
    }

    req.user.claims.sub = targetUserId;
    req.user.claims.email = targetUser.email;

    res.json({ success: true, user: targetUser });
  } catch (error: any) {
    console.error("Error switching user:", error);
    res.status(500).json({ message: error.message });
  }
});

// Cache all uncached photos (migration)
router.post("/admin/cache-photos", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const apiKey = process.env.GOOGLE_PLACES_API_KEY_2;
    if (!apiKey) {
      return res.status(500).json({ message: "GOOGLE_PLACES_API_KEY_2 not configured" });
    }

    const uncachedActivities = await db
      .select({ id: activitiesTable.id, photoUrl: activitiesTable.photoUrl })
      .from(activitiesTable)
      .where(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ activityId: string; error: string }> = [];

    const BATCH_SIZE = 10;
    for (let i = 0; i < uncachedActivities.length; i += BATCH_SIZE) {
      const batch = uncachedActivities.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (activity) => {
        try {
          const urlMatch = activity.photoUrl?.match(/photo_reference=([^&]+)/);
          if (!urlMatch) throw new Error('Could not extract photo reference from URL');

          const photoReference = urlMatch[1];

          const existing = await db
            .select()
            .from(photosCache)
            .where(eq(photosCache.photoReference, photoReference))
            .limit(1);

          if (existing.length > 0 && new Date() < existing[0].expiresAt) {
            await db
              .update(activitiesTable)
              .set({ photoUrl: `/api/photos/${photoReference}` })
              .where(eq(activitiesTable.id, activity.id));
            successCount++;
            return;
          }

          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
          const photoResponse = await fetch(photoUrl);
          if (!photoResponse.ok) throw new Error(`Failed to fetch photo: ${photoResponse.status}`);

          const photoBuffer = await photoResponse.arrayBuffer();
          const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
          const base64Data = Buffer.from(photoBuffer).toString('base64');

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await db
            .insert(photosCache)
            .values({ photoReference, imageData: base64Data, contentType, expiresAt })
            .onConflictDoUpdate({
              target: photosCache.photoReference,
              set: { imageData: base64Data, contentType, expiresAt },
            });

          await db
            .update(activitiesTable)
            .set({ photoUrl: `/api/photos/${photoReference}` })
            .where(eq(activitiesTable.id, activity.id));

          successCount++;
        } catch (error: any) {
          console.error(`[Photo Migration] ✗ Error for activity ${activity.id}:`, error.message);
          errorCount++;
          errors.push({ activityId: activity.id, error: error.message });
        }
      }));

      if (i + BATCH_SIZE < uncachedActivities.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    res.json({
      success: true,
      total: uncachedActivities.length,
      cached: successCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error("Error in photo caching migration:", error);
    res.status(500).json({ message: error.message });
  }
});

// Backfill coordinates for voting_events (favorites)
router.post("/admin/backfill-favorites-coordinates", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const votingEventsToBackfill = await db
      .select()
      .from(votingEventsTable)
      .where(
        and(
          sql`${votingEventsTable.googlePlaceId} IS NOT NULL`,
          or(
            sql`${votingEventsTable.latitude} IS NULL`,
            sql`${votingEventsTable.longitude} IS NULL`
          )
        )
      );

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors: Array<{ eventId: string; title: string; error: string }> = [];

    const BATCH_SIZE = 25;
    for (let i = 0; i < votingEventsToBackfill.length; i += BATCH_SIZE) {
      const batch = votingEventsToBackfill.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (event) => {
        try {
          if (!event.googlePlaceId) { skippedCount++; return; }

          const placeDetails = await getPlaceDetails(event.googlePlaceId);
          if (!placeDetails || !placeDetails.location) throw new Error('No location data in place details');

          await db
            .update(votingEventsTable)
            .set({
              latitude: placeDetails.location.lat.toString(),
              longitude: placeDetails.location.lng.toString(),
            })
            .where(eq(votingEventsTable.id, event.id));

          successCount++;
        } catch (error: any) {
          console.error(`[Favorites Backfill] ✗ Error for "${event.title}":`, error.message);
          errorCount++;
          errors.push({ eventId: event.id, title: event.title, error: error.message });
        }
      }));

      if (i + BATCH_SIZE < votingEventsToBackfill.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    res.json({
      success: true,
      message: `Backfilled ${successCount} favorites, ${skippedCount} skipped, ${errorCount} errors`,
      total: votingEventsToBackfill.length,
      updated: successCount,
      skipped: skippedCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error("Error backfilling favorites coordinates:", error);
    res.status(500).json({ message: error.message });
  }
});

// Audit and fix bad categorizations in curated_venues
router.post("/admin/audit-venue-data", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const corrections = [
      { name: 'Burma Silver Star Restaurant', correctCategory: 'meal', correctDescription: 'Burmese cuisine' },
      { name: 'Cooking Papa San Mateo', correctCategory: 'meal', correctDescription: 'Chinese restaurant' },
      { name: 'Crossfit Burlingame', correctCategory: 'experiences', correctDescription: 'CrossFit gym' },
      { name: 'LC Photo Booths', correctCategory: 'experiences', correctDescription: 'Photo booth rentals' },
      { name: 'Baklavastory.', correctCategory: 'dessert', correctDescription: 'Turkish baklava shop' },
    ];

    let updatedCount = 0;
    let activityUpdates = 0;

    for (const correction of corrections) {
      const result = await db
        .update(curatedVenues)
        .set({ category: correction.correctCategory, description: correction.correctDescription })
        .where(eq(curatedVenues.name, correction.name))
        .returning();

      if (result.length > 0) updatedCount++;

      const activityResult = await db
        .update(activitiesTable)
        .set({ description: correction.correctDescription })
        .where(eq(activitiesTable.venueName, correction.name))
        .returning();

      if (activityResult.length > 0) activityUpdates += activityResult.length;
    }

    res.json({
      success: true,
      message: `Corrected ${updatedCount} curated venues and ${activityUpdates} activities`,
      corrections: corrections.map(c => c.name),
    });
  } catch (error: any) {
    console.error("Error auditing venue data:", error);
    res.status(500).json({ message: error.message });
  }
});

// Clean up invalid venues from curated_venues
router.post("/admin/cleanup-curated-venues", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const allVenues = await db.select().from(curatedVenues);

    let removedNonVenues = 0;
    let removedMissingPhotos = 0;
    let removedLowQuality = 0;
    let removedDuplicates = 0;
    let removedByRules = 0;

    const seenPlaceIds = new Set<string>();
    const { deletedVenues } = await import('@shared/schema');

    const venuesNeedingAI: any[] = [];
    const venuesToRemove: Array<{ venue: any; reasons: string[] }> = [];

    for (const venue of allVenues) {
      const reasons: string[] = [];

      if (venue.googlePlaceId && seenPlaceIds.has(venue.googlePlaceId)) {
        reasons.push('Duplicate venue (same Google Place ID)');
        removedDuplicates++;
      } else if (venue.googlePlaceId) {
        seenPlaceIds.add(venue.googlePlaceId);
      }

      if (!venue.photoUrl) {
        reasons.push('No photo available');
        removedMissingPhotos++;
      }

      const rating = parseFloat(venue.rating || '0');
      const reviewCount = venue.reviewCount || 0;
      if (rating < 3.0 || reviewCount < 5) {
        reasons.push(`Low quality (${rating}★, ${reviewCount} reviews)`);
        removedLowQuality++;
      }

      if (reasons.length > 0) {
        venuesToRemove.push({ venue, reasons });
        continue;
      }

      const googleTypes = venue.tags || [];
      const ruleCheck = isObviouslyInvalidVenue(
        venue.name,
        venue.address,
        Array.isArray(googleTypes) ? googleTypes : []
      );

      if (ruleCheck?.isInvalid) {
        reasons.push(`Rule-based filter: ${ruleCheck.reasoning}`);
        removedByRules++;
        removedNonVenues++;
        venuesToRemove.push({ venue, reasons });
      } else {
        venuesNeedingAI.push(venue);
      }
    }

    if (venuesNeedingAI.length > 0) {
      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < venuesNeedingAI.length; i += BATCH_SIZE) {
        batches.push(venuesNeedingAI.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchInput = batch.map((v: any) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          googleTypes: Array.isArray(v.tags) ? v.tags : [],
        }));

        const validationResults = await validateVenuesBatch(batchInput);

        for (const venue of batch) {
          const validation = validationResults.get(venue.id);
          if (validation && !validation.isValid) {
            venuesToRemove.push({ venue, reasons: [`AI validation: ${validation.reasoning}`] });
            removedNonVenues++;
          }
        }
      }
    }

    for (const { venue, reasons } of venuesToRemove) {
      await db.insert(deletedVenues).values({
        venueData: venue as any,
        deletionReason: reasons.join('; '),
        deletedBy: userId,
      });
      await db.delete(curatedVenues).where(eq(curatedVenues.id, venue.id));
    }

    const totalRemoved = venuesToRemove.length;
    const remaining = allVenues.length - totalRemoved;

    res.json({
      success: true,
      message: `Cleaned up ${totalRemoved} invalid venues (${removedByRules} by rules, ${removedNonVenues - removedByRules} by AI batching)`,
      stats: {
        total: allVenues.length,
        removed: {
          nonVenues: removedNonVenues,
          ruleBasedFiltering: removedByRules,
          aiBatchValidation: removedNonVenues - removedByRules,
          missingPhotos: removedMissingPhotos,
          lowQuality: removedLowQuality,
          duplicates: removedDuplicates,
          total: totalRemoved,
        },
        remaining,
      },
    });
  } catch (error: any) {
    console.error("Error cleaning up curated venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get deleted venues
router.get("/admin/deleted-venues", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { deletedVenues } = await import('@shared/schema');
    const deleted = await db
      .select()
      .from(deletedVenues)
      .orderBy(desc(deletedVenues.deletedAt))
      .limit(500);

    res.json({ success: true, deletedVenues: deleted });
  } catch (error: any) {
    console.error("Error fetching deleted venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Clean up orphaned voting data from deleted groups
router.post("/admin/cleanup-orphaned-voting-data", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const result = await storage.cleanupOrphanedVotingData();
    res.json({
      success: true,
      votingEventsDeleted: result.votingEventsDeleted,
      votesDeleted: result.votesDeleted,
      message: `Cleaned up ${result.votingEventsDeleted} orphaned voting events and ${result.votesDeleted} orphaned votes`,
    });
  } catch (error: any) {
    console.error("Error cleaning up orphaned voting data:", error);
    res.status(500).json({ message: error.message });
  }
});

// Permanently delete a group and all associated data
router.delete("/admin/groups/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const groupId = req.params.id;
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const user = await storage.getUser(userId);
    console.log(`[Hard Delete] Admin ${user?.email} permanently deleting group ${groupId} (${group.name})`);
    await storage.hardDeleteGroup(groupId);

    res.json({
      success: true,
      message: `Group "${group.name}" permanently deleted. Backup created for recovery if needed.`,
    });
  } catch (error: any) {
    console.error("Error deleting group:", error);
    res.status(500).json({ message: error.message });
  }
});

// Recategorize all curated venues
router.post("/admin/recategorize-venues", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    clearCategorizationCache();

    const venues = await storage.getAllCuratedVenues();
    const CANONICAL_CATEGORIES = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
    const categoriesBefore: Record<string, number> = {};
    const categoriesAfter: Record<string, number> = {};

    venues.forEach((venue: any) => {
      categoriesBefore[venue.category] = (categoriesBefore[venue.category] || 0) + 1;
    });

    const changes: Array<{ id: string; name: string; oldCategory: string; newCategory: string }> = [];
    let checked = 0;
    let errors = 0;
    let forcedUpdates = 0;

    for (const venue of venues) {
      checked++;
      try {
        const googleTypes = venue.tags || [];
        const correctCategory = await categorizeVenue(venue.name, '', googleTypes);
        const isNonCanonical = !CANONICAL_CATEGORIES.includes(venue.category);
        const needsUpdate = isNonCanonical || venue.category !== correctCategory;

        if (needsUpdate) {
          if (isNonCanonical && venue.category === correctCategory) forcedUpdates++;
          await storage.updateVenueCategory(venue.id, correctCategory);
          changes.push({ id: venue.id, name: venue.name, oldCategory: venue.category, newCategory: correctCategory });
          categoriesAfter[correctCategory] = (categoriesAfter[correctCategory] || 0) + 1;
        } else {
          categoriesAfter[venue.category] = (categoriesAfter[venue.category] || 0) + 1;
        }
      } catch (error: any) {
        console.error(`[Venue Recategorization] Error processing ${venue.name}:`, error.message);
        errors++;
      }
    }

    res.json({
      success: true,
      message: `Recategorization complete: ${changes.length} venues updated (${forcedUpdates} non-canonical)`,
      stats: {
        totalVenues: venues.length,
        venuesChecked: checked,
        venuesUpdated: changes.length,
        nonCanonicalFixed: forcedUpdates,
        errors,
        categoriesBefore,
        categoriesAfter,
      },
      changes: changes.slice(0, 100),
    });
  } catch (error: any) {
    console.error("Error recategorizing venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Upload scraped venues for comparison
router.post("/admin/scraped-venues/upload", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { venues } = req.body;
    if (!Array.isArray(venues) || venues.length === 0) {
      return res.status(400).json({ message: "Invalid request: venues array required" });
    }

    await storage.clearScrapedImport();
    await storage.insertScrapedVenues(venues);

    res.json({ success: true, message: `Uploaded ${venues.length} scraped venues for comparison`, count: venues.length });
  } catch (error: any) {
    console.error("Error uploading scraped venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get scraped venues comparison
router.get("/admin/scraped-venues/comparison", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const comparison = await storage.getScrapedVenuesComparison();
    res.json({ success: true, ...comparison });
  } catch (error: any) {
    console.error("Error getting scraped venues comparison:", error);
    res.status(500).json({ message: error.message });
  }
});

// Clear scraped venues import
router.delete("/admin/scraped-venues/clear", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    await storage.clearScrapedImport();
    res.json({ success: true, message: "Cleared all scraped venues" });
  } catch (error: any) {
    console.error("Error clearing scraped venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Import selected scraped venues to curated cache
router.post("/admin/scraped-venues/import", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { venues } = req.body;
    if (!Array.isArray(venues)) {
      return res.status(400).json({ message: "venues must be an array" });
    }

    const imported = await storage.importScrapedVenues(venues);
    res.json({ success: true, imported });
  } catch (error: any) {
    console.error("Error importing scraped venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// Venue analytics (region x category breakdown)
router.get("/admin/venue-analytics", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const allVenues = await db
      .select()
      .from(curatedVenues)
      .where(eq(curatedVenues.isActive, true));

    const analytics: Record<string, Record<string, number>> = {};
    const regions = new Set<string>();
    const categories = new Set<string>();
    let totalRating = 0;
    let totalReviewCount = 0;
    let venuesWithRatings = 0;

    for (const venue of allVenues) {
      const region = venue.region || 'unknown';
      const category = venue.category || 'unknown';
      regions.add(region);
      categories.add(category);
      if (!analytics[region]) analytics[region] = {};
      analytics[region][category] = (analytics[region][category] || 0) + 1;
      if (venue.rating) { totalRating += parseFloat(venue.rating); venuesWithRatings++; }
      if (venue.reviewCount) totalReviewCount += venue.reviewCount;
    }

    const avgRating = venuesWithRatings > 0 ? totalRating / venuesWithRatings : 0;
    const avgReviews = allVenues.length > 0 ? totalReviewCount / allVenues.length : 0;

    res.json({
      success: true,
      summary: {
        totalVenues: allVenues.length,
        totalRegions: regions.size,
        totalCategories: categories.size,
        avgRating: Math.round(avgRating * 10) / 10,
        avgReviewCount: Math.round(avgReviews),
      },
      breakdown: analytics,
      regions: Array.from(regions).sort(),
      categories: Array.from(categories).sort(),
    });
  } catch (error: any) {
    console.error("Error fetching venue analytics:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get filtered venues by region and category
router.get("/admin/venues-by-filter", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { region, category } = req.query;
    if (!region || !category) {
      return res.status(400).json({ message: "Missing region or category parameter" });
    }

    const venues = await db
      .select()
      .from(curatedVenues)
      .where(
        and(
          eq(curatedVenues.region, region as string),
          eq(curatedVenues.category, category as string),
          eq(curatedVenues.isActive, true)
        )
      )
      .orderBy(desc(curatedVenues.rating));

    res.json({
      success: true,
      region,
      category,
      count: venues.length,
      venues: venues.map(v => ({
        id: v.id,
        name: v.name,
        address: v.address,
        rating: v.rating,
        reviewCount: v.reviewCount,
        priceLevel: v.priceLevel,
        photoUrl: v.photoUrl,
        googlePlaceId: v.googlePlaceId,
        source: v.source,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching filtered venues:", error);
    res.status(500).json({ message: error.message });
  }
});

// API call logs with filtering
router.get("/admin/api-logs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const { service, method, cacheStatus, status, limit = '100', offset = '0' } = req.query;
    const apiCallLogsTable = (await import('@shared/schema')).apiCallLogs;

    const conditions: any[] = [];
    if (service) conditions.push(eq(apiCallLogsTable.service, service as string));
    if (method) conditions.push(eq(apiCallLogsTable.method, method as string));
    if (cacheStatus) conditions.push(eq(apiCallLogsTable.cacheStatus, cacheStatus as string));
    if (status) conditions.push(eq(apiCallLogsTable.status, status as string));

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const baseQuery = db.select().from(apiCallLogsTable);
    const logs = await (conditions.length > 0
      ? baseQuery.where(and(...conditions)).orderBy(desc(apiCallLogsTable.createdAt)).limit(limitNum).offset(offsetNum)
      : baseQuery.orderBy(desc(apiCallLogsTable.createdAt)).limit(limitNum).offset(offsetNum));

    const countBaseQuery = db.select({ count: sql<number>`count(*)` }).from(apiCallLogsTable);
    const totalResult = await (conditions.length > 0
      ? countBaseQuery.where(and(...conditions))
      : countBaseQuery);
    const total = Number(totalResult[0]?.count) || 0;

    res.json({ logs, total, limit: limitNum, offset: offsetNum });
  } catch (error: any) {
    console.error("Error fetching API logs:", error);
    res.status(500).json({ message: error.message });
  }
});

// API cost estimates and usage breakdown
router.get("/admin/api-costs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await requireAdminAccess(req, res);
    if (!userId) return;

    const period = (req.query.period as string || 'total').toLowerCase();

    let dateThreshold: Date | null = null;
    let periodLabel = 'Total';
    if (period === 'daily') { dateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); periodLabel = 'Daily'; }
    else if (period === 'monthly') { dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); periodLabel = 'Monthly'; }
    else if (period === 'quarterly') { dateThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); periodLabel = 'Quarterly'; }

    let activitiesCount: number;
    let geocodingCacheCount: number;
    let photosCacheCount: number;
    let groupsCount: number;

    if (dateThreshold) {
      [activitiesCount, geocodingCacheCount, photosCacheCount, groupsCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(gte(activitiesTable.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(geocodingCache).where(gte(geocodingCache.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(photosCache).where(gte(photosCache.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(groupsTable).where(gte(groupsTable.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
      ]);
    } else {
      [activitiesCount, geocodingCacheCount, photosCacheCount, groupsCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(activitiesTable).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(geocodingCache).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(photosCache).then(r => Number(r[0]?.count) || 0),
        db.select({ count: sql<number>`count(*)` }).from(groupsTable).then(r => Number(r[0]?.count) || 0),
      ]);
    }

    const uniquePlaces = dateThreshold
      ? await db.selectDistinct({ placeId: activitiesTable.googlePlaceId }).from(activitiesTable).where(and(sql`${activitiesTable.googlePlaceId} IS NOT NULL`, gte(activitiesTable.createdAt, dateThreshold)))
      : await db.selectDistinct({ placeId: activitiesTable.googlePlaceId }).from(activitiesTable).where(sql`${activitiesTable.googlePlaceId} IS NOT NULL`);
    const uniquePlacesCount = uniquePlaces.length;

    let uncachedPhotosCount: number;
    if (dateThreshold) {
      uncachedPhotosCount = await db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(and(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`, gte(activitiesTable.createdAt, dateThreshold))).then(r => Number(r[0]?.count) || 0);
    } else {
      uncachedPhotosCount = await db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`).then(r => Number(r[0]?.count) || 0);
    }

    const cacheStats = getCacheStats();
    const { getApiKeyStats } = await import('../google-places');
    const apiKeyStats = getApiKeyStats();

    const apiCallLogsTable = (await import('@shared/schema')).apiCallLogs;
    const baseLogQuery = db.select().from(apiCallLogsTable);
    const apiLogs = await (dateThreshold ? baseLogQuery.where(gte(apiCallLogsTable.createdAt, dateThreshold)) : baseLogQuery);

    let actualTextSearchCalls = 0, actualPlaceDetailsCalls = 0, actualGeocodingCalls = 0, actualPhotoCalls = 0;
    let cachedTextSearchCalls = 0, cachedPlaceDetailsCalls = 0, cachedGeocodingCalls = 0;

    if (apiLogs.length > 0) {
      for (const log of apiLogs) {
        if (log.service === 'google_places') {
          if (log.method === 'textSearch') { if (log.cacheStatus === 'miss') actualTextSearchCalls++; if (log.cacheStatus === 'hit') cachedTextSearchCalls++; }
          else if (log.method === 'placeDetails') { if (log.cacheStatus === 'miss') actualPlaceDetailsCalls++; if (log.cacheStatus === 'hit') cachedPlaceDetailsCalls++; }
          else if (log.method === 'placePhotos') { if (log.cacheStatus === 'miss') actualPhotoCalls++; }
          else if (log.method === 'geocoding') { if (log.cacheStatus === 'miss') actualGeocodingCalls++; if (log.cacheStatus === 'hit') cachedGeocodingCalls++; }
        }
      }
    } else {
      actualTextSearchCalls = Math.floor(activitiesCount / 15);
      actualPlaceDetailsCalls = uniquePlacesCount;
      actualGeocodingCalls = groupsCount;
    }

    const textSearchCost = (actualTextSearchCalls / 1000) * 17;
    const placeDetailsCost = (actualPlaceDetailsCalls / 1000) * 5;
    const geocodingCost = (actualGeocodingCalls / 1000) * 5;
    const cachedPhotoCost = (actualPhotoCalls / 1000) * 7;

    const VIEWS_PER_PHOTO_PER_DAY = 12;
    let estimatedUncachedPhotoViews = 0;
    let uncachedPhotoPeriodLabel = '';
    if (period === 'daily') { estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY; uncachedPhotoPeriodLabel = 'per day'; }
    else if (period === 'monthly') { estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * 30; uncachedPhotoPeriodLabel = 'per month (30 days)'; }
    else if (period === 'quarterly') { estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * 90; uncachedPhotoPeriodLabel = 'per quarter (90 days)'; }
    else { const daysSinceStart = 19; estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * daysSinceStart; uncachedPhotoPeriodLabel = `over ${daysSinceStart} days`; }

    const uncachedPhotoCost = (estimatedUncachedPhotoViews / 1000) * 7;
    const totalCost = textSearchCost + placeDetailsCost + geocodingCost + cachedPhotoCost + uncachedPhotoCost;

    const savedTextSearchCost = (cacheStats.searchHits / 1000) * 17;
    const savedPlaceDetailsCost = (cacheStats.placeDetailsHits / 1000) * 5;
    const savedGeocodingCost = (cacheStats.geocodeHits / 1000) * 5;
    const totalSavings = savedTextSearchCost + savedPlaceDetailsCost + savedGeocodingCost;

    res.json({
      period,
      periodLabel,
      apiCalls: {
        textSearch: { estimated: actualTextSearchCalls, cached: cachedTextSearchCalls, cost: textSearchCost, pricePerThousand: 17, note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)' },
        placeDetails: { estimated: actualPlaceDetailsCalls, cached: cachedPlaceDetailsCalls, cost: placeDetailsCost, pricePerThousand: 5, tier: 'Basic', note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)' },
        geocoding: { estimated: actualGeocodingCalls, cached: cachedGeocodingCalls, cost: geocodingCost, pricePerThousand: 5, note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)' },
        cachedPhotos: { estimated: actualPhotoCalls, cost: cachedPhotoCost, pricePerThousand: 7, note: apiLogs.length > 0 ? 'Actual photo downloads (one-time)' : 'Estimated downloads' },
        uncachedPhotos: { estimated: estimatedUncachedPhotoViews, cost: uncachedPhotoCost, pricePerThousand: 7, count: uncachedPhotosCount, note: `Estimated photo views ${uncachedPhotoPeriodLabel} (ongoing cost)` },
      },
      totals: { estimatedCalls: actualTextSearchCalls + actualPlaceDetailsCalls + actualGeocodingCalls + actualPhotoCalls + estimatedUncachedPhotoViews, estimatedCost: totalCost, actualCallsAvailable: apiLogs.length > 0 },
      caching: { textSearchHits: cacheStats.searchHits, placeDetailsHits: cacheStats.placeDetailsHits, geocodingHits: cacheStats.geocodeHits, totalHits: cacheStats.totalHits, hitRate: cacheStats.hitRate, savedCost: totalSavings },
      apiKeys: { key1Calls: apiKeyStats.key1Calls, key2Calls: apiKeyStats.key2Calls, totalCalls: apiKeyStats.totalCalls, key2Configured: apiKeyStats.key2Configured },
      database: { activities: activitiesCount, uniquePlaces: uniquePlacesCount, groups: groupsCount, geocodingCacheSize: geocodingCacheCount, photosCacheSize: photosCacheCount },
    });
  } catch (error: any) {
    console.error("Error fetching API costs:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
