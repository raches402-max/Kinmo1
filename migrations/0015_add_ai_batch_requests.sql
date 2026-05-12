-- Migration: ai_batch_requests table for the OpenAI Batch API queue
-- Backs server/ai-batch.ts (added in commit ac78be8 — w3 tier 4 #9). Without
-- this table, the planning-agent batch path crashes the moment background
-- jobs are enabled in prod.

CREATE TABLE IF NOT EXISTS ai_batch_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  call_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  batch_id text,
  custom_id text NOT NULL,
  request_payload jsonb NOT NULL,
  result_payload jsonb,
  error_message text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  submitted_at timestamp,
  completed_at timestamp,
  processed_at timestamp
);

CREATE INDEX IF NOT EXISTS ai_batch_requests_status_idx
  ON ai_batch_requests (status);
CREATE INDEX IF NOT EXISTS ai_batch_requests_batch_id_idx
  ON ai_batch_requests (batch_id);
CREATE INDEX IF NOT EXISTS ai_batch_requests_created_at_idx
  ON ai_batch_requests (created_at);
