-- Add fields for managing future event pipeline
ALTER TABLE groups ADD COLUMN target_future_events integer DEFAULT NULL;
ALTER TABLE groups ADD COLUMN allow_early_rsvp boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN groups.target_future_events IS 'Number of future events to maintain in pipeline. NULL = use smart default based on cadence';
COMMENT ON COLUMN groups.allow_early_rsvp IS 'Whether members can RSVP to approved events before they are fully scheduled';
