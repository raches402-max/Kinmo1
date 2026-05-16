/**
 * Copies all data from one Postgres database into another — used to seed /
 * refresh the local DEV database with a one-way snapshot of PRODUCTION.
 *
 * Direction is ALWAYS prod -> dev. Data never flows dev -> prod.
 *
 * Run with:
 *   SOURCE_DATABASE_URL="postgresql://...prod..." \
 *   DEST_DATABASE_URL="postgresql://...dev..." \
 *     npx tsx scripts/copy-prod-to-dev.ts
 *
 * Safety guards (see checks below):
 *   - Both URLs must be set, and must differ.
 *   - The destination host MUST match ALLOWED_DEST_HOST — a hardcoded allowlist
 *     of the dev database's host. This makes it structurally impossible to
 *     write to production, even if SOURCE/DEST are accidentally swapped.
 *
 * Behaviour:
 *   - Single dest client so SET session_replication_role persists
 *   - Per-table column filtering (tolerates schema drift between the two DBs)
 *   - Batched inserts for speed
 *   - Skips cache/log tables (they regenerate naturally)
 *   - TRUNCATEs dest tables first, so re-running gives a clean fresh copy
 */

import { Pool, PoolClient } from "pg";

const BATCH_SIZE = 200;

/**
 * Allowlist: the destination URL's host MUST contain this string, or the
 * script refuses to run. This is the load-bearing safety guard — production
 * can never be the destination.
 *
 * If the dev Postgres service is ever recreated, update this to the new host
 * (Railway dashboard -> Postgres-Dev -> Variables -> DATABASE_PUBLIC_URL).
 */
const ALLOWED_DEST_HOST = "yamanote.proxy.rlwy.net";

const SKIP_TABLES = new Set([
  "api_call_logs", // historical API call log, regenerates
  "places_cache", // Google Places cache, regenerates on demand
  "search_cache", // search results cache, regenerates
  "sessions", // express-session sessions, users will re-login
  "user_sessions",
]);

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const DEST_URL = process.env.DEST_DATABASE_URL;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "<unparseable>";
  }
}

if (!SOURCE_URL) {
  console.error("❌ SOURCE_DATABASE_URL not set (should be the PROD database URL).");
  process.exit(1);
}
if (!DEST_URL) {
  console.error("❌ DEST_DATABASE_URL not set (should be the DEV database URL).");
  process.exit(1);
}
if (SOURCE_URL === DEST_URL) {
  console.error("❌ SOURCE and DEST URLs are identical — refusing to run.");
  process.exit(1);
}
if (!hostOf(DEST_URL).includes(ALLOWED_DEST_HOST)) {
  console.error(
    `❌ DEST host "${hostOf(DEST_URL)}" is not the allowed dev host ` +
      `("${ALLOWED_DEST_HOST}"). Refusing to run — this guard prevents ever ` +
      `writing into production. If the dev DB was recreated, update ` +
      `ALLOWED_DEST_HOST in this script.`
  );
  process.exit(1);
}

console.log("🔁 Copying data PROD -> DEV");
console.log(`   Source (prod): ${hostOf(SOURCE_URL)}`);
console.log(`   Dest   (dev):  ${hostOf(DEST_URL)}`);

const sourcePool = new Pool({ connectionString: SOURCE_URL });
const destPool = new Pool({ connectionString: DEST_URL });

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

async function copy() {
  console.log("\n🔌 Verifying connections...");

  const sourceTables = await getTableNames(sourcePool);

  // Acquire a single dest client and hold it for the full copy so
  // SET session_replication_role persists across all queries.
  const destClient = await destPool.connect();

  try {
    const destTables = await getTableNames(destClient);

    console.log(`   Source (prod): ${sourceTables.length} tables`);
    console.log(`   Dest   (dev):  ${destTables.length} tables`);

    if (destTables.length === 0) {
      console.error('\n❌ Dest has no tables. Run "npm run db:push" first.');
      process.exit(1);
    }

    const commonTables = sourceTables.filter((t) => destTables.includes(t));
    const willCopy = commonTables.filter((t) => !SKIP_TABLES.has(t));
    const skipped = commonTables.filter((t) => SKIP_TABLES.has(t));

    if (skipped.length > 0) {
      console.log(`\n⏭️  Skipping cache/log tables: ${skipped.join(", ")}`);
    }

    // Disable FK checks for this session (persists since same client)
    console.log("\n🔓 Disabling FK constraints for this copy session...");
    await destClient.query("SET session_replication_role = replica");

    console.log(`\n🧹 Truncating ${willCopy.length} dev tables...`);
    for (const table of willCopy) {
      try {
        await destClient.query(`TRUNCATE "${table}" RESTART IDENTITY CASCADE`);
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

    for (const table of willCopy) {
      const result: Result = { table, copied: 0, skipped: 0, droppedCols: [] };
      const tableStart = Date.now();

      try {
        const data = await sourcePool.query(`SELECT * FROM "${table}"`);

        if (data.rows.length === 0) {
          console.log(`   ${table.padEnd(32)} (empty)`);
          summary.push(result);
          continue;
        }

        // Find common columns between source and destination
        const sourceCols = Object.keys(data.rows[0]);
        const destCols = await getColumnNames(destClient, table);
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
            await destClient.query(sql, values);
            result.copied += batch.length;
          } catch (e: any) {
            // Batch failed — fall back to row-by-row to identify problem rows
            for (const row of batch) {
              const placeholders = commonCols.map((_, i) => `$${i + 1}`).join(", ");
              const rowSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;
              try {
                await destClient.query(
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
    await destClient.query("SET session_replication_role = origin");

    console.log("\n🔢 Resetting sequences...");
    const seqResult = await destClient.query(`
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
        await destClient.query(
          `SELECT setval('"${seq_name}"', COALESCE((SELECT MAX("${col_name}") FROM "${table_name}"), 1), true)`
        );
        seqUpdated++;
      } catch {
        // ignore
      }
    }
    console.log(`   ${seqUpdated} sequences updated`);

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Copy complete in ${totalElapsed}s\n`);
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
    destClient.release();
    await sourcePool.end();
    await destPool.end();
  }
}

copy().catch(async (e) => {
  console.error("❌ Copy failed:", e);
  await sourcePool.end().catch(() => {});
  await destPool.end().catch(() => {});
  process.exit(1);
});
