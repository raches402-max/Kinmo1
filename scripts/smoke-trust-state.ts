/**
 * Smoke test for trust-state plumbing.
 * Exercises addAdHocVenueToItinerary, updateItineraryItem, addItineraryItems
 * against a real DB row, asserts trust fields land as expected, then cleans up.
 *
 * Run: npx tsx scripts/smoke-trust-state.ts
 */
import "dotenv/config";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { itineraryItems, itineraries, activities, votingEvents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`, detail ?? "");
  }
}

// Find an existing itinerary to attach test items to (read-only on the itinerary itself).
const [anyItinerary] = await db.select().from(itineraries).orderBy(desc(itineraries.createdAt)).limit(1);
if (!anyItinerary) {
  console.error("No itinerary found in DB; can't run smoke test.");
  process.exit(1);
}
console.log(`Using itinerary ${anyItinerary.id} (${anyItinerary.name ?? "unnamed"})\n`);

const created: string[] = [];
const baseVenue = {
  venueAddress: "123 Test St",
  venueType: "restaurant",
  googlePlaceId: "ChIJTEST_smoke_test_only",
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

try {
  // --- 1. addAdHocVenueToItinerary with each trust source ---
  console.log("addAdHocVenueToItinerary:");

  const a = await storage.addAdHocVenueToItinerary(
    anyItinerary.id,
    { ...baseVenue, venueName: "smoketest google_search" },
    "google_search"
  );
  created.push(a.id);
  check("google_search → verified", a.trustState === "verified", { trustState: a.trustState, trustSource: a.trustSource, verifiedAt: a.verifiedAt });
  check("google_search → trustSource recorded", a.trustSource === "google_search");
  check("google_search → verifiedAt set", a.verifiedAt instanceof Date);

  const b = await storage.addAdHocVenueToItinerary(
    anyItinerary.id,
    { ...baseVenue, venueName: "smoketest url_paste" },
    "url_paste"
  );
  created.push(b.id);
  check("url_paste → needs_review", b.trustState === "needs_review", { trustState: b.trustState });
  check("url_paste → verifiedAt null", b.verifiedAt === null);

  const c = await storage.addAdHocVenueToItinerary(
    anyItinerary.id,
    { ...baseVenue, venueName: "smoketest ai_suggestion" },
    "ai_suggestion"
  );
  created.push(c.id);
  check("ai_suggestion → needs_review", c.trustState === "needs_review");

  const d = await storage.addAdHocVenueToItinerary(
    anyItinerary.id,
    { ...baseVenue, venueName: "smoketest manual" },
    "manual"
  );
  created.push(d.id);
  check("manual → verified", d.trustState === "verified");

  const e = await storage.addAdHocVenueToItinerary(
    anyItinerary.id,
    { ...baseVenue, venueName: "smoketest validation_pass" },
    "validation_pass"
  );
  created.push(e.id);
  check("validation_pass → verified", e.trustState === "verified");

  // --- 2. updateItineraryItem dirtying behavior ---
  console.log("\nupdateItineraryItem:");

  const updated1 = await storage.updateItineraryItem(a.id, { notes: "just a note" });
  check("non-identity edit (notes) leaves trust alone",
    updated1?.trustState === "verified" && updated1?.trustSource === "google_search",
    { trustState: updated1?.trustState, trustSource: updated1?.trustSource });

  const updated2 = await storage.updateItineraryItem(a.id, { venueName: "renamed" });
  check("name edit flips to needs_review",
    updated2?.trustState === "needs_review",
    { trustState: updated2?.trustState });
  check("name edit records user_edit source",
    updated2?.trustSource === "user_edit",
    { trustSource: updated2?.trustSource });
  check("name edit clears verifiedAt",
    updated2?.verifiedAt === null);

  const updated3 = await storage.updateItineraryItem(d.id, { venueAddress: "999 New St" });
  check("address edit flips to needs_review",
    updated3?.trustState === "needs_review");

  const updated4 = await storage.updateItineraryItem(e.id, { googlePlaceId: "ChIJ_other" });
  check("placeId edit flips to needs_review",
    updated4?.trustState === "needs_review");

  // --- 3. Default values for inserts that bypass trustSource ---
  console.log("\nschema defaults:");
  const [direct] = await db.insert(itineraryItems).values({
    itineraryId: anyItinerary.id,
    sourceType: "ad_hoc",
    sourceId: null,
    venueName: "smoketest schema default",
    venueAddress: "",
    venueType: "venue",
    orderIndex: 9999,
  }).returning();
  created.push(direct.id);
  check("direct insert without trust fields → unknown",
    direct.trustState === "unknown",
    { trustState: direct.trustState });
} finally {
  // Cleanup
  console.log("\nCleanup:");
  for (const id of created) {
    await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
  }
  console.log(`  Deleted ${created.length} test rows.`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
