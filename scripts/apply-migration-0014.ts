/**
 * Applies migrations/0014_add_vote_unique_constraints.sql with pre-flight
 * duplicate checks. Idempotent — the SQL uses CREATE UNIQUE INDEX IF NOT EXISTS.
 *
 * Run against local dev DB:
 *   npx tsx scripts/apply-migration-0014.ts
 *
 * Run against Railway prod:
 *   DATABASE_URL="postgresql://...rlwy.net.../railway" \
 *     npx tsx scripts/apply-migration-0014.ts
 */

import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  __dirname,
  "../migrations/0014_add_vote_unique_constraints.sql"
);

const PREFLIGHT_QUERIES: Array<{ label: string; sql: string }> = [
  {
    label: "votes (user_id, event_id)",
    sql: `SELECT user_id, event_id, COUNT(*) AS n FROM votes
          GROUP BY user_id, event_id HAVING COUNT(*) > 1 LIMIT 20`,
  },
  {
    label: "itinerary_option_votes (user_id, auto_event_id)",
    sql: `SELECT user_id, auto_event_id, COUNT(*) AS n FROM itinerary_option_votes
          WHERE user_id IS NOT NULL
          GROUP BY user_id, auto_event_id HAVING COUNT(*) > 1 LIMIT 20`,
  },
  {
    label: "itinerary_option_votes (member_id, auto_event_id)",
    sql: `SELECT member_id, auto_event_id, COUNT(*) AS n FROM itinerary_option_votes
          WHERE member_id IS NOT NULL
          GROUP BY member_id, auto_event_id HAVING COUNT(*) > 1 LIMIT 20`,
  },
  {
    label: "time_slot_votes (user_id, time_slot_id)",
    sql: `SELECT user_id, time_slot_id, COUNT(*) AS n FROM time_slot_votes
          WHERE user_id IS NOT NULL
          GROUP BY user_id, time_slot_id HAVING COUNT(*) > 1 LIMIT 20`,
  },
  {
    label: "time_slot_votes (member_id, time_slot_id)",
    sql: `SELECT member_id, time_slot_id, COUNT(*) AS n FROM time_slot_votes
          WHERE member_id IS NOT NULL
          GROUP BY member_id, time_slot_id HAVING COUNT(*) > 1 LIMIT 20`,
  },
];

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("🔍 Pre-flight: checking for existing duplicate vote rows…\n");
    let foundDuplicates = false;

    for (const { label, sql } of PREFLIGHT_QUERIES) {
      const { rows } = await pool.query(sql);
      if (rows.length > 0) {
        foundDuplicates = true;
        console.log(`❌ ${label}: ${rows.length} duplicate group(s) found`);
        for (const row of rows.slice(0, 5)) console.log(`     ${JSON.stringify(row)}`);
      } else {
        console.log(`✅ ${label}: clean`);
      }
    }

    if (foundDuplicates) {
      console.error(
        "\n❌ Duplicates exist. Resolve them before applying the migration —" +
          "\n   the CREATE UNIQUE INDEX statements will fail otherwise."
      );
      process.exit(1);
    }

    console.log("\n📦 Applying migration…");
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    await pool.query(sql);
    console.log("✅ Migration applied.");

    console.log("\n🔎 Verifying new indexes…");
    const { rows: idx } = await pool.query(`
      SELECT indexname, tablename FROM pg_indexes
      WHERE indexname IN (
        'uniq_votes_user_event',
        'uniq_itinerary_option_votes_user',
        'uniq_itinerary_option_votes_member',
        'uniq_time_slot_votes_user',
        'uniq_time_slot_votes_member'
      )
      ORDER BY tablename, indexname
    `);
    for (const row of idx) console.log(`   ✓ ${row.tablename} → ${row.indexname}`);
    if (idx.length !== 5) {
      console.warn(`⚠️  Expected 5 indexes, found ${idx.length}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
