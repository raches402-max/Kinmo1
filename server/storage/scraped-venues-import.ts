import { db } from "../db";
import { scrapedVenuesImport, curatedVenues } from "@shared/schema";

export const scrapedVenuesImportStorage = {
  async clearScrapedImport(): Promise<void> {
    await db.delete(scrapedVenuesImport);
    console.log('[Scraped Import] Cleared all scraped venues');
  },

  async insertScrapedVenues(venues: Array<any>): Promise<void> {
    if (venues.length > 0) {
      console.log('[Scraped Import] Sample venue structure:', JSON.stringify(venues[0], null, 2));
    }

    const inserts = venues.map((v, idx) => {
      const name = v.name || v.venueName || v.title || v.businessName || `Venue ${idx + 1}`;

      let address = v.address || v.venueAddress || v.location;
      if (!address && (v.street || v.city || v.state)) {
        const parts = [v.street, v.city, v.state].filter(Boolean);
        address = parts.join(', ');
      }
      if (!address) address = 'Unknown address';

      let googlePlaceId = v.googlePlaceId || v.placeId || v.place_id;
      if (!googlePlaceId && v.url) {
        const match = v.url.match(/query_place_id=([^&]+)/);
        if (match) googlePlaceId = match[1];
      }

      return {
        name,
        address,
        categoryName: v.category || v.categoryName || null,
        totalScore: (v.rating || v.totalScore)?.toString() || null,
        reviewsCount: v.reviewCount || v.reviewsCount || null,
        googlePlaceId: googlePlaceId || null,
        rawData: v
      };
    });

    await db.insert(scrapedVenuesImport).values(inserts);
    console.log(`[Scraped Import] Inserted ${inserts.length} scraped venues`);
  },

  async getScrapedVenuesComparison(): Promise<{
    totalScraped: number;
    alreadyInDb: number;
    newVenues: number;
    matchedVenues: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }>;
    newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>;
  }> {
    const scraped = await db.select().from(scrapedVenuesImport);
    const curatedAll = await db.select().from(curatedVenues);

    const curatedByPlaceId = new Map();
    curatedAll.forEach(v => {
      if (v.googlePlaceId) {
        curatedByPlaceId.set(v.googlePlaceId, v);
      }
    });

    const matched: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }> = [];
    const newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }> = [];

    scraped.forEach(s => {
      if (s.googlePlaceId && curatedByPlaceId.has(s.googlePlaceId)) {
        const dbVenue = curatedByPlaceId.get(s.googlePlaceId);
        matched.push({
          scrapedName: s.name,
          dbName: dbVenue.name,
          googlePlaceId: s.googlePlaceId,
          source: dbVenue.source
        });
      } else {
        newVenuesList.push({
          name: s.name,
          address: s.address,
          category: s.categoryName || undefined,
          rating: s.totalScore ? parseFloat(s.totalScore) : undefined,
          googlePlaceId: s.googlePlaceId || undefined
        });
      }
    });

    return {
      totalScraped: scraped.length,
      alreadyInDb: matched.length,
      newVenues: newVenuesList.length,
      matchedVenues: matched,
      newVenuesList
    };
  },

  async importScrapedVenues(venues: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>): Promise<number> {
    const { getPlaceDetails } = await import('../google-places');

    const enrichedVenues = [];
    let failedCount = 0;

    for (const v of venues) {
      if (!v.googlePlaceId) {
        console.log(`[Scraped Import] Skipping venue without Place ID: ${v.name}`);
        failedCount++;
        continue;
      }

      try {
        const placeDetails = await getPlaceDetails(v.googlePlaceId);

        if (!placeDetails || !placeDetails.location) {
          console.log(`[Scraped Import] Failed to get coordinates for: ${v.name} (${v.googlePlaceId})`);
          failedCount++;
          continue;
        }

        let priceLevelNum: number | null = null;
        if (placeDetails.priceLevel) {
          const priceLevelMap: Record<string, number> = {
            'Free': 0,
            '$': 1,
            '$$': 2,
            '$$$': 3,
            '$$$$': 4,
          };
          priceLevelNum = priceLevelMap[placeDetails.priceLevel] ?? null;
        }

        enrichedVenues.push({
          name: v.name,
          address: v.address,
          latitude: placeDetails.location.lat.toString(),
          longitude: placeDetails.location.lng.toString(),
          region: 'SF Bay Area',
          category: v.category || 'Other',
          tags: v.category ? [v.category] : [],
          rating: v.rating?.toString() || placeDetails.rating || null,
          reviewCount: placeDetails.reviewCount || null,
          priceLevel: priceLevelNum,
          photoUrl: placeDetails.photoUrl || null,
          googlePlaceId: v.googlePlaceId,
          source: 'api_scrape' as const,
        });
      } catch (error) {
        console.error(`[Scraped Import] Error fetching details for ${v.name}:`, error);
        failedCount++;
      }
    }

    if (enrichedVenues.length === 0) {
      console.log(`[Scraped Import] No venues could be imported (${failedCount} failed)`);
      return 0;
    }

    await db.insert(curatedVenues).values(enrichedVenues);
    console.log(`[Scraped Import] Successfully imported ${enrichedVenues.length} venues with real coordinates (${failedCount} failed)`);
    return enrichedVenues.length;
  },
};
