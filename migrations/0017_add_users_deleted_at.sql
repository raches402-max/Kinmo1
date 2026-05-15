-- W6-G account deletion: add soft-delete tombstone column to users.
-- We don't hard-delete users because all user-data FKs cascade — destroying
-- a user would also destroy groups they organized (with other members' RSVPs)
-- and their memberships in other users' groups. Anonymize-not-delete keeps the
-- id row as a tombstone so FK integrity is preserved while PII is wiped.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx"
  ON "users" USING btree ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;
