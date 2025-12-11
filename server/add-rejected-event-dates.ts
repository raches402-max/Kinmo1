import { db } from "./db";
import { sql } from "drizzle-orm";

export async function addRejectedEventDatesTable() {
  console.log("Creating rejected_event_dates table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rejected_event_dates (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id VARCHAR NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      rejected_date TIMESTAMP NOT NULL,
      reason TEXT DEFAULT 'user_deleted' NOT NULL,
      source_type TEXT,
      source_id VARCHAR,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Add index for faster lookups by groupId and date
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_rejected_event_dates_group_date
    ON rejected_event_dates(group_id, rejected_date)
  `);

  console.log("✓ rejected_event_dates table created successfully");
}

// Run migration
addRejectedEventDatesTable()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
