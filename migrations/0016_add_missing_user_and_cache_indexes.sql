-- Workstream 6 / Sub-track D: add the missing read/cleanup indexes called out in PLAN.md.
-- Note: api_call_logs.created_at already has an index, and votes(user_id) is already covered
-- by the existing unique index on (user_id, event_id) from migration 0014.

CREATE INDEX IF NOT EXISTS "members_user_id_idx"
  ON "members" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "rsvps_user_id_idx"
  ON "rsvps" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "places_cache_expires_at_idx"
  ON "places_cache" USING btree ("expires_at");

CREATE INDEX IF NOT EXISTS "search_cache_expires_at_idx"
  ON "search_cache" USING btree ("expires_at");
