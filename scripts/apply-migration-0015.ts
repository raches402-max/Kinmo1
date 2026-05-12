/**
 * Applies migrations/0015_add_ai_batch_requests.sql. Idempotent
 * (CREATE TABLE/INDEX IF NOT EXISTS).
 *
 * Local dev:   npx tsx scripts/apply-migration-0015.ts
 * Railway prod:
 *   railway run --service=Postgres -- \
 *     bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *       npx tsx scripts/apply-migration-0015.ts'
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
  "../migrations/0015_add_ai_batch_requests.sql"
);

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log("📦 Applying migration 0015…");
    await pool.query(readFileSync(MIGRATION_PATH, "utf8"));
    console.log("✅ Migration applied.");

    console.log("\n🔎 Verifying…");
    const { rows: tables } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE tablename = 'ai_batch_requests'`
    );
    if (tables.length === 0) {
      console.error("❌ ai_batch_requests table not present after apply");
      process.exit(1);
    }
    console.log("   ✓ ai_batch_requests table present");

    const { rows: idx } = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ai_batch_requests'
        AND indexname IN (
          'ai_batch_requests_status_idx',
          'ai_batch_requests_batch_id_idx',
          'ai_batch_requests_created_at_idx'
        )
      ORDER BY indexname
    `);
    for (const row of idx) console.log(`   ✓ ${row.indexname}`);
    if (idx.length !== 3) console.warn(`⚠️  Expected 3 indexes, found ${idx.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
