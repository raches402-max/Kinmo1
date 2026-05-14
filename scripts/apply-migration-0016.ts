/**
 * Applies migrations/0016_add_missing_user_and_cache_indexes.sql.
 * Idempotent (CREATE INDEX IF NOT EXISTS).
 *
 * Local dev:   npx tsx scripts/apply-migration-0016.ts
 * Railway prod:
 *   railway run --service=Postgres -- \
 *     bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *       npx tsx scripts/apply-migration-0016.ts'
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
  "../migrations/0016_add_missing_user_and_cache_indexes.sql"
);

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log("📦 Applying migration 0016…");
    await pool.query(readFileSync(MIGRATION_PATH, "utf8"));
    console.log("✅ Migration applied.");

    console.log("\n🔎 Verifying…");
    const { rows } = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'members_user_id_idx',
        'rsvps_user_id_idx',
        'places_cache_expires_at_idx',
        'search_cache_expires_at_idx'
      )
      ORDER BY indexname
    `);
    for (const row of rows) console.log(`   ✓ ${row.indexname}`);
    if (rows.length !== 4) console.warn(`⚠️  Expected 4 indexes, found ${rows.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
