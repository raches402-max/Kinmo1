-- Create table for tracking skipped auto-schedule dates
CREATE TABLE IF NOT EXISTS "skipped_auto_schedule_dates" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "group_id" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "skipped_date" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE("group_id", "skipped_date")
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "skipped_dates_group_idx" ON "skipped_auto_schedule_dates"("group_id");
