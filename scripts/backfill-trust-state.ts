import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const tables = ["activities", "voting_events", "itinerary_items"];

for (const t of tables) {
  const before = await db.execute(
    sql.raw(
      `SELECT trust_state, COUNT(*)::int AS n FROM ${t} GROUP BY trust_state ORDER BY trust_state`
    )
  );
  console.log(`[${t}] before:`, before.rows);

  const res = await db.execute(
    sql.raw(
      `UPDATE ${t} SET trust_state='verified', verified_at=NOW(), trust_source='backfill' WHERE trust_state='unknown'`
    )
  );
  console.log(`[${t}] updated rows:`, res.rowCount ?? "(unknown)");

  const after = await db.execute(
    sql.raw(
      `SELECT trust_state, COUNT(*)::int AS n FROM ${t} GROUP BY trust_state ORDER BY trust_state`
    )
  );
  console.log(`[${t}] after:`, after.rows);
}

process.exit(0);
