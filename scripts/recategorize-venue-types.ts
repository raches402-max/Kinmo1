/**
 * One-shot tool to assign a real venueType to rows currently stamped 'venue'
 * (or NULL/empty) across activities, voting_events, and itinerary_items.
 *
 * Strategy per row:
 *  1. Name-pattern match — fastest, no DB hit beyond the initial scan.
 *  2. places_cache lookup via google_place_id — uses the existing 30-day cache;
 *     skipped (no API call) if the row's place isn't cached.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/recategorize-venue-types.ts             # dry-run (default)
 *   DATABASE_URL=... npx tsx scripts/recategorize-venue-types.ts --apply     # write changes
 */

import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { getBestVenueTypeSync } from "../server/google-places";

const APPLY = process.argv.includes("--apply");

const TABLES = ["activities", "voting_events", "itinerary_items"] as const;

// Match name fragments to canonical types. Order matters — more specific first.
// Each test runs against the lowercased name with non-word chars stripped.
const NAME_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ice ?cream|gelato|frozen yogurt|froyo)\b/, "ice_cream_shop"],
  [/\b(bakery|patisserie|pâtisserie)\b/, "bakery"],
  [/\b(dessert|sweets|sweet shop|confection)\b/, "dessert_shop"],
  [/\b(coffee|espresso|roastery|roasters)\b/, "coffee_shop"],
  [/\b(cafe|caf[eé])\b/, "cafe"],
  [/\b(brewery|brewing|brewhouse|taproom)\b/, "brewery"],
  [/\b(distillery)\b/, "distillery"],
  [/\b(wine bar|enoteca)\b/, "wine_bar"],
  [/\b(pub|tavern|alehouse)\b/, "bar"],
  [/\b(cocktail|lounge)\b/, "bar"],
  [/\b(bar & grill|sports bar|bar)\b/, "bar"],
  [/\b(night ?club|nightclub|disco)\b/, "night_club"],
  [/\b(cinema|movie theater|imax|cineplex)\b/, "movie_theater"],
  [/\b(bowling)\b/, "bowling_alley"],
  [/\b(museum)\b/, "museum"],
  [/\b(gallery|art gallery)\b/, "art_gallery"],
  [/\b(spa|hammam|onsen)\b/, "spa"],
  [/\b(gym|fitness|crossfit|yoga studio|pilates)\b/, "gym"],
  [/\b(park|gardens?|arboretum)\b/, "park"],
  [/\b(mall|shopping center)\b/, "shopping_mall"],
  // Generic restaurant catch-alls
  [/\b(restaurant|ristorante|trattoria|osteria|bistro|brasserie|eatery|diner|grill|kitchen|steakhouse|pizzeria|pizza|sushi|ramen|noodle|noodles|dim sum|taqueria|burger|bbq|barbecue)\b/, "restaurant"],
];

function classifyByName(name: string): string | null {
  const normalized = name.toLowerCase();
  for (const [pattern, type] of NAME_PATTERNS) {
    if (pattern.test(normalized)) return type;
  }
  return null;
}

async function classifyByPlacesCache(googlePlaceId: string | null): Promise<string | null> {
  if (!googlePlaceId) return null;
  const result = await db.execute(
    sql`SELECT place_data FROM places_cache WHERE place_id = ${googlePlaceId} LIMIT 1`
  );
  const row = result.rows[0] as { place_data?: any } | undefined;
  if (!row?.place_data) return null;
  const types: string[] | undefined = row.place_data.types;
  if (!types || types.length === 0) return null;
  const derived = getBestVenueTypeSync(types);
  return derived && derived !== "venue" ? derived : null;
}

type Candidate = {
  table: string;
  id: string;
  name: string;
  oldType: string | null;
  newType: string;
  source: "name" | "cache";
};

async function scanTable(table: string): Promise<{ candidates: Candidate[]; skipped: Array<{ id: string; name: string }> }> {
  // Column names match across all three tables: id, venue_type|name conventions differ.
  // activities + voting_events: name + venue_type + google_place_id
  // itinerary_items: venue_name + venue_type + google_place_id
  const nameCol = table === "itinerary_items" ? "venue_name" : "name";
  const result = await db.execute(
    sql.raw(
      `SELECT id, ${nameCol} AS name, venue_type, google_place_id
       FROM ${table}
       WHERE venue_type IS NULL OR venue_type = '' OR venue_type = 'venue'`
    )
  );

  const candidates: Candidate[] = [];
  const skipped: Array<{ id: string; name: string }> = [];

  for (const r of result.rows as Array<{ id: string; name: string; venue_type: string | null; google_place_id: string | null }>) {
    const byName = classifyByName(r.name || "");
    if (byName) {
      candidates.push({ table, id: r.id, name: r.name, oldType: r.venue_type, newType: byName, source: "name" });
      continue;
    }
    const byCache = await classifyByPlacesCache(r.google_place_id);
    if (byCache) {
      candidates.push({ table, id: r.id, name: r.name, oldType: r.venue_type, newType: byCache, source: "cache" });
      continue;
    }
    skipped.push({ id: r.id, name: r.name });
  }
  return { candidates, skipped };
}

async function applyUpdates(candidates: Candidate[]) {
  // Group by table for slightly fewer roundtrips
  const byTable = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!byTable.has(c.table)) byTable.set(c.table, []);
    byTable.get(c.table)!.push(c);
  }
  for (const [table, rows] of byTable) {
    for (const r of rows) {
      await db.execute(
        sql.raw(`UPDATE ${table} SET venue_type = '${r.newType.replace(/'/g, "''")}' WHERE id = '${r.id.replace(/'/g, "''")}'`)
      );
    }
    console.log(`[${table}] updated ${rows.length} rows`);
  }
}

(async () => {
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN"}\n`);

  const allCandidates: Candidate[] = [];
  const allSkipped: Array<{ table: string; id: string; name: string }> = [];

  for (const t of TABLES) {
    const { candidates, skipped } = await scanTable(t);
    allCandidates.push(...candidates);
    for (const s of skipped) allSkipped.push({ table: t, ...s });
    console.log(`[${t}] candidates: ${candidates.length}, skipped: ${skipped.length}`);
  }

  if (allCandidates.length > 0) {
    console.log(`\nProposed remappings:\n`);
    console.table(
      allCandidates.map((c) => ({
        table: c.table,
        name: c.name.slice(0, 40),
        old: c.oldType ?? "(null)",
        new: c.newType,
        via: c.source,
      }))
    );
  }

  if (allSkipped.length > 0) {
    console.log(`\nSkipped (no name match, no cached place data) — these stay as-is:\n`);
    console.table(allSkipped.slice(0, 50).map((s) => ({ table: s.table, name: s.name.slice(0, 50) })));
    if (allSkipped.length > 50) console.log(`...and ${allSkipped.length - 50} more`);
  }

  if (APPLY && allCandidates.length > 0) {
    console.log("\nApplying updates...");
    await applyUpdates(allCandidates);
    console.log("Done.");
  } else if (!APPLY) {
    console.log(`\nDry run complete. Re-run with --apply to write changes.`);
  }

  process.exit(0);
})();
