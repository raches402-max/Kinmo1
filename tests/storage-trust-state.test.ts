/**
 * Storage-level tests for trust state.
 * Hits the real dev DB (DATABASE_URL); each test cleans up its own writes.
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { itineraryItems, itineraries } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

let itineraryId: string;
const createdItemIds: string[] = [];

beforeAll(async () => {
  // Borrow any existing itinerary as an attachment point. Read-only on the itinerary itself;
  // we only insert and clean up itinerary_items rows.
  const [it] = await db.select().from(itineraries).orderBy(desc(itineraries.createdAt)).limit(1);
  if (!it) throw new Error("No itinerary in DB; can't run storage tests. Seed one first.");
  itineraryId = it.id;
});

afterEach(async () => {
  if (createdItemIds.length === 0) return;
  for (const id of createdItemIds) {
    await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
  }
  createdItemIds.length = 0;
});

const baseVenue = {
  venueAddress: "123 Test St",
  venueType: "restaurant",
  googlePlaceId: "ChIJTEST_storage_test",
  latitude: "37.7",
  longitude: "-122.4",
  notes: null,
  googleMapsUrl: null,
  arrivalTime: null,
  departureTime: null,
  travelNotes: null,
  rating: null,
  photoUrl: null,
};

async function addItem(name: string, source: Parameters<typeof storage.addAdHocVenueToItinerary>[2]) {
  const item = await storage.addAdHocVenueToItinerary(
    itineraryId,
    { ...baseVenue, venueName: name },
    source
  );
  createdItemIds.push(item.id);
  return item;
}

describe("addAdHocVenueToItinerary trust state", () => {
  it("google_search → verified with timestamp", async () => {
    const item = await addItem("test google_search", "google_search");
    expect(item.trustState).toBe("verified");
    expect(item.trustSource).toBe("google_search");
    expect(item.verifiedAt).toBeInstanceOf(Date);
  });

  it("url_paste → needs_review with null verifiedAt", async () => {
    const item = await addItem("test url_paste", "url_paste");
    expect(item.trustState).toBe("needs_review");
    expect(item.verifiedAt).toBeNull();
  });

  it("ai_suggestion → needs_review", async () => {
    const item = await addItem("test ai_suggestion", "ai_suggestion");
    expect(item.trustState).toBe("needs_review");
  });

  it("manual → verified", async () => {
    const item = await addItem("test manual", "manual");
    expect(item.trustState).toBe("verified");
  });

  it("validation_pass → verified", async () => {
    const item = await addItem("test validation_pass", "validation_pass");
    expect(item.trustState).toBe("verified");
  });
});

describe("updateItineraryItem dirtying behavior", () => {
  it("editing notes leaves trust state alone", async () => {
    const item = await addItem("starts verified", "google_search");
    const updated = await storage.updateItineraryItem(item.id, { notes: "added a note" });
    expect(updated?.trustState).toBe("verified");
    expect(updated?.trustSource).toBe("google_search");
  });

  it("editing venueName flips to needs_review with user_edit source", async () => {
    const item = await addItem("about to be renamed", "google_search");
    const updated = await storage.updateItineraryItem(item.id, { venueName: "renamed" });
    expect(updated?.trustState).toBe("needs_review");
    expect(updated?.trustSource).toBe("user_edit");
    expect(updated?.verifiedAt).toBeNull();
  });

  it("editing venueAddress flips to needs_review", async () => {
    const item = await addItem("about to move", "google_search");
    const updated = await storage.updateItineraryItem(item.id, { venueAddress: "999 New St" });
    expect(updated?.trustState).toBe("needs_review");
  });

  it("editing googlePlaceId flips to needs_review", async () => {
    const item = await addItem("about to swap places", "validation_pass");
    const updated = await storage.updateItineraryItem(item.id, { googlePlaceId: "ChIJ_other" });
    expect(updated?.trustState).toBe("needs_review");
  });
});

describe("schema default safety net", () => {
  it("direct insert without trust fields lands as unknown", async () => {
    const [item] = await db
      .insert(itineraryItems)
      .values({
        itineraryId,
        sourceType: "ad_hoc",
        sourceId: null,
        venueName: "raw insert no trust",
        venueAddress: "",
        venueType: "venue",
        orderIndex: 9999,
      })
      .returning();
    createdItemIds.push(item.id);
    expect(item.trustState).toBe("unknown");
  });
});
