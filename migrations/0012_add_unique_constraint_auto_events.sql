-- Migration: Add unique constraint to prevent duplicate auto-scheduled events on same date
-- This ensures at the database level that we can't have multiple events on the same date for the same group

-- Create a unique index that enforces one event per group per day
-- Using DATE() to normalize timestamps to just the date part
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_scheduled_events_unique_date
ON auto_scheduled_events (group_id, DATE(proposed_date));

-- Note: This will prevent INSERT of duplicate events at the database level
-- Any attempt to insert a second event on the same date will fail with a unique constraint violation
