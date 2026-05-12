/**
 * One-off migration script: copies all data from Neon to Railway Postgres.
 *
 * Run with:
 *   RAILWAY_PUBLIC_URL="postgresql://postgres:...@xxx.proxy.rlwy.net:PORT/railway" \
 *     npx tsx scripts/migrate-neon-to-railway.ts
 *
 * Fixes from v2:
 *   - Single Railway client (so SET session_replication_role persists)
 *   - Per-table column filtering (handles schema drift — skips columns
 *     present in Neon but missing in Railway's current Drizzle schema)
 *   - Batched inserts for speed
 *   - Skips cache/log tables (regenerate naturally)
 */

import { Pool, PoolClient } from "pg";
import "dotenv/config";

const BATCH_SIZE = 200;

const SKIP_TABLES = new Set([
  "api_call_logs", // historical API call log, regenerates
  "places_cache", // Google Places cache, regenerates on demand
  "search_cache", // search results cache, regenerates
  "sessions", // express-session sessions, users will re-login
  "user_sessions",
]);

const NEON_URL = process.env.DATABASE_URL;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_URL;

if (!NEON_URL) {
  console.error("❌ DATABASE_URL not set (should be Neon URL from .env)");
  process.exit(1);
}
if (!RAILWAY_URL) {
  console.error("❌ RAILWAY_PUBLIC_URL not set. Run with:");
  console.error(
    '   RAILWAY_PUBLIC_URL="postgresql://..." npx tsx scripts/migrate-neon-to-railway.ts'
  );
  process.exit(1);
}
if (NEON_URL === RAILWAY_URL) {
  console.error("❌ Source and destination URLs are identical");
  process.exit(1);
}

const neonPool = new Pool({ connectionString: NEON_URL });
const railwayPool = new Pool({ connectionString: RAILWAY_URL });

async function getTableNames(client: Pool | PoolClient): Promise<string[]> {
  const r = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' ORDER BY tablename
  `);
  return r.rows.map((row: any) => row.tablename);
}

async function getColumnNames(
  client: Pool | PoolClient,
  table: string
): Promise<Set<string>> {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(r.rows.map((row: any) => row.column_name));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function migrate() {
  console.log("🔌 Verifying connections...");

  const neonTables = await getTableNames(neonPool);

  // Acquire a single Railway client and hold it for the full migration
  // so SET session_replication_role persists across all queries.
  const railwayClient = await railwayPool.connect();

  try {
    const railwayTables = await getTableNames(railwayClient);

    console.log(`   Neon (source):    ${neonTables.length} tables`);
    console.log(`   Railway (target): ${railwayTables.length} tables`);

    if (railwayTables.length === 0) {
      console.error('\n❌ Railway has no tables. Run "npm run db:push" first.');
      process.exit(1);
    }

    const commonTables = neonTables.filter((t) => railwayTables.includes(t));
    const willMigrate = commonTables.filter((t) => !SKIP_TABLES.has(t));
    const skipped = commonTables.filter((t) => SKIP_TABLES.has(t));

    if (skipped.length > 0) {
      console.log(`\n⏭️  Skipping cache/log tables: ${skipped.join(", ")}`);
    }

    // Disable FK checks and triggers for this session (persists since same client)
    console.log("\n🔓 Disabling FK constraints for this migration session...");
    await railwayClient.query("SET session_replication_role = replica");

    console.log(`\n🧹 Truncating ${willMigrate.length} Railway tables...`);
    for (const table of willMigrate) {
      try {
        await railwayClient.query(`TRUNCATE "${table}" RESTART IDENTITY CASCADE`);
      } catch (e: any) {
        console.error(`   ⚠️  Failed to truncate ${table}: ${e.message}`);
      }
    }

    console.log("\n📊 Copying data (batched, column-filtered)...\n");
    const startTime = Date.now();

    type Result = {
      table: string;
      copied: number;
      skipped: number;
      droppedCols: string[];
    };
    const summary: Result[] = [];

    for (const table of willMigrate) {
      const result: Result = { table, copied: 0, skipped: 0, droppedCols: [] };
      const tableStart = Date.now();

      try {
        const data = await neonPool.query(`SELECT * FROM "${table}"`);

        if (data.rows.length === 0) {
          console.log(`   ${table.padEnd(32)} (empty)`);
          summary.push(result);
          continue;
        }

        // Find common columns between source and destination
        const sourceCols = Object.keys(data.rows[0]);
        const destCols = await getColumnNames(railwayClient, table);
        const commonCols = sourceCols.filter((c) => destCols.has(c));
        result.droppedCols = sourceCols.filter((c) => !destCols.has(c));

        if (commonCols.length === 0) {
          console.error(`   ❌ ${table}: no common columns`);
          summary.push(result);
          continue;
        }

        const colList = commonCols.map((c) => `"${c}"`).join(", ");

        const batches = chunk(data.rows, BATCH_SIZE);

        for (const batch of batches) {
          const values: any[] = [];
          const valueGroups: string[] = [];
          let placeholderIdx = 1;

          for (const row of batch) {
            const rowPlaceholders = commonCols.map(() => `$${placeholderIdx++}`);
            valueGroups.push(`(${rowPlaceholders.join(", ")})`);
            for (const c of commonCols) values.push(row[c]);
          }

          const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueGroups.join(", ")}`;

          try {
            await railwayClient.query(sql, values);
            result.copied += batch.length;
          } catch (e: any) {
            // Batch failed — fall back to row-by-row to identify problem rows
            for (const row of batch) {
              const placeholders = commonCols.map((_, i) => `$${i + 1}`).join(", ");
              const rowSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;
              try {
                await railwayClient.query(
                  rowSql,
                  commonCols.map((c) => row[c])
                );
                result.copied++;
              } catch (rowErr: any) {
                result.skipped++;
                if (result.skipped <= 2) {
                  console.warn(
                    `     ⚠️  ${table} row error: ${rowErr.message.split("\n")[0]}`
                  );
                }
              }
            }
          }
        }

        const elapsed = ((Date.now() - tableStart) / 1000).toFixed(1);
        const dropNote =
          result.droppedCols.length > 0
            ? ` (dropped cols: ${result.droppedCols.join(", ")})`
            : "";
        const status =
          result.skipped > 0
            ? `${result.copied} copied, ${result.skipped} skipped (${elapsed}s)${dropNote}`
            : `${result.copied} rows (${elapsed}s)${dropNote}`;
        console.log(`   ${table.padEnd(32)} ${status}`);
      } catch (e: any) {
        console.error(`   ❌ ${table}: ${e.message}`);
      }
      summary.push(result);
    }

    // Re-enable FK checks
    await railwayClient.query("SET session_replication_role = origin");

    console.log("\n🔢 Resetting sequences...");
    const seqResult = await railwayClient.query(`
      SELECT s.relname AS seq_name, a.attname AS col_name, t.relname AS table_name
      FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid
      JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      JOIN pg_class t ON t.oid = d.refobjid
      WHERE s.relkind = 'S'
    `);

    let seqUpdated = 0;
    for (const { seq_name, col_name, table_name } of seqResult.rows) {
      try {
        await railwayClient.query(
          `SELECT setval('"${seq_name}"', COALESCE((SELECT MAX("${col_name}") FROM "${table_name}"), 1), true)`
        );
        seqUpdated++;
      } catch {
        // ignore
      }
    }
    console.log(`   ${seqUpdated} sequences updated`);

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Migration complete in ${totalElapsed}s\n`);
    console.log("📊 Summary:");
    let totalCopied = 0;
    let totalSkipped = 0;
    const tablesWithIssues: Result[] = [];
    for (const s of summary) {
      totalCopied += s.copied;
      totalSkipped += s.skipped;
      if (s.skipped > 0 || s.droppedCols.length > 0) {
        tablesWithIssues.push(s);
      }
    }
    console.log(`   Total: ${totalCopied} rows copied, ${totalSkipped} skipped`);

    if (tablesWithIssues.length > 0) {
      console.log("\n⚠️  Tables with issues:");
      for (const s of tablesWithIssues) {
        const drops =
          s.droppedCols.length > 0
            ? ` dropped: [${s.droppedCols.join(", ")}]`
            : "";
        console.log(`   ${s.table}: ${s.copied}/${s.copied + s.skipped} rows${drops}`);
      }
    }
  } finally {
    railwayClient.release();
    await neonPool.end();
    await railwayPool.end();
  }
}

migrate().catch(async (e) => {
  console.error("❌ Migration failed:", e);
  await neonPool.end().catch(() => {});
  await railwayPool.end().catch(() => {});
  process.exit(1);
});
