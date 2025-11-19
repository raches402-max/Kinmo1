-- Create member_favorite_venues table
CREATE TABLE IF NOT EXISTS "member_favorite_venues" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id" varchar NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "venue_place_id" text NOT NULL,
  "venue_name" text NOT NULL,
  "venue_address" text,
  "venue_photo_url" text,
  "category" text,
  "added_at" timestamp DEFAULT now() NOT NULL
);

-- Create index on member_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_member_favorite_venues_member_id" ON "member_favorite_venues"("member_id");

-- Create index on venue_place_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_member_favorite_venues_venue_place_id" ON "member_favorite_venues"("venue_place_id");
