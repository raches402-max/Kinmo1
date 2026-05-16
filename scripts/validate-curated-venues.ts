/**
 * Validate cached curated venues without burning Google Places API calls.
 *
 * Workflow:
 *   1. `pull` — write a batch of stale venues to ./validation/pending/batch-{ts}.json
 *   2. Claude Code (or you) fills in the `check` block for each venue using
 *      WebSearch / WebFetch / Yelp / the venue's website, etc.
 *   3. `apply <file>` — applies the results back to the DB:
 *        action="keep"        → SET lastRefreshed = NOW(), businessStatus = 'OPERATIONAL'
 *        action="update"      → write `updates` block (name/address/description/tags/
 *                                businessStatus/lat/lng), SET lastRefreshed = NOW()
 *        action="mark-closed" → archive to deleted_venues, hard delete from curated_venues
 *        action="flag"        → SET lastRefreshed = NOW() (user reviews manually)
 *        action="skip"        → no-op
 *   4. `status` — refresh-health summary (never checked / stale / recent).
 *
 * Stale priority: never-refreshed first, then oldest lastRefreshed first.
 *
 * Run with:
 *   npx tsx scripts/validate-curated-venues.ts status
 *   npx tsx scripts/validate-curated-venues.ts pull --batch 10 [--region bay_area] [--category meal]
 *   npx tsx scripts/validate-curated-venues.ts apply validation/pending/batch-XXX.json [--dry-run]
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";

type BusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

interface VenueUpdates {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  tags?: string[];
  businessStatus?: BusinessStatus;
}

interface CheckResult {
  action: "keep" | "update" | "mark-closed" | "flag" | "skip";
  notes: string;
  evidence?: string;
  // Only used when action === "update". Each key is optional;
  // only present keys are written.
  updates?: VenueUpdates;
}

interface VenueCheckItem {
  id: string;
  name: string;
  address: string;
  category: string;
  region: string;
  googlePlaceId: string | null;
  businessStatus: string | null;
  description: string | null;
  tags: string[] | null;
  lastRefreshed: string | null;
  // Candidate URLs for validation:
  googleMapsUrl: string | null;
  googleSearchUrl: string;
  // Fill this in to validate:
  check: CheckResult | null;
}

// Whitelist of columns updatable via the `updates` block. Field names map
// 1:1 to curated_venues columns. Kept here so a typo in the JSON can't
// reach the SQL — unknown keys are rejected at apply time.
const UPDATE_COLUMNS: Record<keyof VenueUpdates, string> = {
  name: "name",
  address: "address",
  latitude: "latitude",
  longitude: "longitude",
  description: "description",
  tags: "tags",
  businessStatus: "business_status",
};

interface Batch {
  generatedAt: string;
  filters: { region?: string; category?: string };
  instructions: string;
  venues: VenueCheckItem[];
}

const VALIDATION_DIR = path.resolve(process.cwd(), "validation");
const PENDING_DIR = path.join(VALIDATION_DIR, "pending");
const DONE_DIR = path.join(VALIDATION_DIR, "done");

function ensureDirs() {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.mkdirSync(DONE_DIR, { recursive: true });
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

function googleMapsUrlFor(placeId: string | null): string | null {
  if (!placeId) return null;
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

function googleSearchUrlFor(name: string, address: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${address}`)}`;
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string>; positional: string[] } {
  const [, , command, ...rest] = argv;
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }
  return { command: command || "", flags, positional };
}

async function status() {
  const pool = getPool();
  try {
    const totals = await pool.query<{ region: string; total: string; never_checked: string; stale_90d: string; refreshed_30d: string }>(
      `SELECT
         region,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE last_refreshed IS NULL)::text AS never_checked,
         COUNT(*) FILTER (WHERE last_refreshed IS NOT NULL AND last_refreshed < NOW() - INTERVAL '90 days')::text AS stale_90d,
         COUNT(*) FILTER (WHERE last_refreshed >= NOW() - INTERVAL '30 days')::text AS refreshed_30d
       FROM curated_venues
       WHERE is_active = true
       GROUP BY region
       ORDER BY region`,
    );

    const businessStatusBreakdown = await pool.query<{ business_status: string | null; count: string }>(
      `SELECT business_status, COUNT(*)::text AS count
       FROM curated_venues
       WHERE is_active = true
       GROUP BY business_status
       ORDER BY count DESC`,
    );

    console.log("\nCurated venue refresh health (is_active = true):\n");
    console.log("region          total   never   stale>90d   fresh<30d");
    console.log("----------------------------------------------------------");
    for (const row of totals.rows) {
      console.log(
        `${row.region.padEnd(15)} ${row.total.padStart(5)}   ${row.never_checked.padStart(5)}   ${row.stale_90d.padStart(9)}   ${row.refreshed_30d.padStart(9)}`,
      );
    }

    console.log("\nBusiness status breakdown:");
    for (const row of businessStatusBreakdown.rows) {
      console.log(`  ${(row.business_status || "(null)").padEnd(25)} ${row.count}`);
    }
    console.log();
  } finally {
    await pool.end();
  }
}

async function pull(flags: Record<string, string>) {
  const batchSize = parseInt(flags.batch || "10", 10);
  if (Number.isNaN(batchSize) || batchSize <= 0 || batchSize > 100) {
    throw new Error("--batch must be between 1 and 100");
  }
  const region = flags.region;
  const category = flags.category;

  const pool = getPool();
  try {
    const conditions = ["is_active = true"];
    const params: any[] = [];
    if (region) {
      params.push(region);
      conditions.push(`region = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    params.push(batchSize);

    // Prioritize: never-refreshed first, then oldest lastRefreshed.
    const result = await pool.query(
      `SELECT id, name, address, category, region, google_place_id, business_status,
              description, tags, last_refreshed
       FROM curated_venues
       WHERE ${conditions.join(" AND ")}
       ORDER BY last_refreshed ASC NULLS FIRST, created_at ASC
       LIMIT $${params.length}`,
      params,
    );

    if (result.rows.length === 0) {
      console.log("No venues match those filters.");
      return;
    }

    const venues: VenueCheckItem[] = result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      category: r.category,
      region: r.region,
      googlePlaceId: r.google_place_id,
      businessStatus: r.business_status,
      description: r.description,
      tags: r.tags,
      lastRefreshed: r.last_refreshed ? new Date(r.last_refreshed).toISOString() : null,
      googleMapsUrl: googleMapsUrlFor(r.google_place_id),
      googleSearchUrl: googleSearchUrlFor(r.name, r.address),
      check: null,
    }));

    ensureDirs();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const filename = `batch-${ts}.json`;
    const filepath = path.join(PENDING_DIR, filename);

    const batch: Batch = {
      generatedAt: new Date().toISOString(),
      filters: { region, category },
      instructions:
        "For each venue, fill in `check` with one of these actions:\n" +
        "  - 'keep'         → still operational, no changes needed.\n" +
        "  - 'update'       → still operational, but one or more fields need updating;\n" +
        "                      include an `updates` object with any of: name, address,\n" +
        "                      latitude, longitude, description, tags, businessStatus.\n" +
        "                      If you change `address` without `latitude`/`longitude`,\n" +
        "                      apply will warn — those will need a separate geocoding pass.\n" +
        "  - 'mark-closed'  → permanently closed; will be archived + hard-deleted.\n" +
        "  - 'flag'         → uncertain, needs human review later.\n" +
        "  - 'skip'         → couldn't validate this round.\n" +
        "Use WebSearch / WebFetch on the venue name + address. Then run:\n" +
        "  npx tsx scripts/validate-curated-venues.ts apply " + filepath,
      venues,
    };

    fs.writeFileSync(filepath, JSON.stringify(batch, null, 2));
    console.log(`Wrote ${venues.length} venues to ${filepath}`);
    console.log("\nNext: fill in each venue's `check` block, then run:");
    console.log(`  npx tsx scripts/validate-curated-venues.ts apply ${filepath}`);
  } finally {
    await pool.end();
  }
}

async function apply(filePath: string, flags: Record<string, string>) {
  if (!filePath) {
    throw new Error("apply requires a path to a batch JSON file");
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const dryRun = flags["dry-run"] === "true";

  const batch: Batch = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const counts = { keep: 0, update: 0, "mark-closed": 0, flag: 0, skip: 0, unchecked: 0 };
  for (const v of batch.venues) {
    if (!v.check) counts.unchecked++;
    else counts[v.check.action]++;
  }

  // Pre-validate every update block before opening a transaction — fail fast
  // if any unknown column keys snuck in.
  for (const v of batch.venues) {
    if (v.check?.action !== "update") continue;
    if (!v.check.updates || Object.keys(v.check.updates).length === 0) {
      throw new Error(`Venue ${v.id} (${v.name}): action="update" requires a non-empty \`updates\` object`);
    }
    for (const key of Object.keys(v.check.updates)) {
      if (!(key in UPDATE_COLUMNS)) {
        throw new Error(
          `Venue ${v.id} (${v.name}): unknown updates key "${key}". ` +
            `Allowed: ${Object.keys(UPDATE_COLUMNS).join(", ")}`,
        );
      }
    }
  }

  console.log(`Batch ${filePath}`);
  console.log(`  total venues:  ${batch.venues.length}`);
  console.log(`  keep:          ${counts.keep}`);
  console.log(`  update:        ${counts.update}`);
  console.log(`  mark-closed:   ${counts["mark-closed"]}`);
  console.log(`  flag:          ${counts.flag}`);
  console.log(`  skip:          ${counts.skip}`);
  console.log(`  unchecked:     ${counts.unchecked}`);
  if (dryRun) console.log("\n(dry run — no DB changes)\n");

  if (counts.unchecked > 0) {
    console.warn(`\nWARNING: ${counts.unchecked} venues have no check filled in (treated as skip).`);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!dryRun) await client.query("BEGIN");

    let applied = 0;
    for (const v of batch.venues) {
      if (!v.check) continue;
      const { action, notes } = v.check;

      if (action === "skip") continue;

      if (action === "keep") {
        if (!dryRun) {
          await client.query(
            `UPDATE curated_venues
             SET last_refreshed = NOW(), business_status = 'OPERATIONAL'
             WHERE id = $1`,
            [v.id],
          );
        }
        applied++;
      } else if (action === "update") {
        const updates = v.check.updates!;
        const setFragments: string[] = [];
        const values: any[] = [];
        const diff: string[] = [];

        for (const [key, val] of Object.entries(updates)) {
          if (val === undefined) continue;
          const column = UPDATE_COLUMNS[key as keyof VenueUpdates];
          values.push(val);
          setFragments.push(`${column} = $${values.length}`);
          // For the diff log, show old → new.
          const oldVal = (v as any)[key];
          diff.push(`    ${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(val)}`);
        }
        setFragments.push(`last_refreshed = NOW()`);

        // Warn if address changed but lat/lng didn't — they're now stale.
        if (
          updates.address !== undefined &&
          updates.latitude === undefined &&
          updates.longitude === undefined
        ) {
          console.warn(
            `  WARN: ${v.name} address changed but lat/lng not updated — they're now stale. ` +
              `Add latitude/longitude to the updates block, or plan a geocoding pass.`,
          );
        }

        values.push(v.id);
        if (!dryRun) {
          await client.query(
            `UPDATE curated_venues SET ${setFragments.join(", ")} WHERE id = $${values.length}`,
            values,
          );
        }
        applied++;
        console.log(`  updated: ${v.name}`);
        for (const line of diff) console.log(line);
      } else if (action === "flag") {
        if (!dryRun) {
          await client.query(
            `UPDATE curated_venues SET last_refreshed = NOW() WHERE id = $1`,
            [v.id],
          );
        }
        applied++;
      } else if (action === "mark-closed") {
        if (!dryRun) {
          // Archive full row then hard delete (matches admin.ts cleanup pattern).
          const existing = await client.query(
            `SELECT * FROM curated_venues WHERE id = $1`,
            [v.id],
          );
          if (existing.rows.length === 0) {
            console.warn(`  ${v.name}: not found in DB (already removed?)`);
            continue;
          }
          await client.query(
            `INSERT INTO deleted_venues (venue_data, deletion_reason, deleted_by)
             VALUES ($1, $2, NULL)`,
            [existing.rows[0], `validate-curated-venues: ${notes || "marked closed"}`],
          );
          await client.query(`DELETE FROM curated_venues WHERE id = $1`, [v.id]);
        }
        applied++;
        console.log(`  marked closed: ${v.name} (${v.address})`);
      }
    }

    if (!dryRun) {
      await client.query("COMMIT");
      // Archive the batch file.
      ensureDirs();
      const doneName = path.basename(filePath);
      const doneDest = path.join(DONE_DIR, doneName);
      fs.renameSync(filePath, doneDest);
      console.log(`\nApplied ${applied} updates. Archived to ${doneDest}`);
    } else {
      console.log(`\nWould apply ${applied} updates.`);
    }
  } catch (err) {
    if (!dryRun) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const { command, flags, positional } = parseArgs(process.argv);

  switch (command) {
    case "status":
      await status();
      break;
    case "pull":
      await pull(flags);
      break;
    case "apply":
      await apply(positional[0], flags);
      break;
    default:
      console.error(
        "Usage:\n" +
          "  npx tsx scripts/validate-curated-venues.ts status\n" +
          "  npx tsx scripts/validate-curated-venues.ts pull --batch 10 [--region bay_area] [--category meal]\n" +
          "  npx tsx scripts/validate-curated-venues.ts apply validation/pending/batch-XXX.json [--dry-run]",
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
