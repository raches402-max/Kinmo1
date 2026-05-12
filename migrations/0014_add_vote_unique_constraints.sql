-- Migration: Add unique constraints to prevent duplicate votes
-- Covers votes, itinerary_option_votes, time_slot_votes. Two requests from the
-- same user/member for the same target previously could insert duplicate rows.
--
-- Partial indexes used on the two tables where user_id and member_id are both
-- nullable: anonymous voting (no login) carries member_id, logged-in voting
-- carries user_id, and the indexes protect both paths.

-- votes: user_id and event_id are both NOT NULL, so a simple unique index works
CREATE UNIQUE INDEX IF NOT EXISTS uniq_votes_user_event
  ON votes (user_id, event_id);

-- itinerary_option_votes: partial uniques on each discriminator
CREATE UNIQUE INDEX IF NOT EXISTS uniq_itinerary_option_votes_user
  ON itinerary_option_votes (user_id, auto_event_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_itinerary_option_votes_member
  ON itinerary_option_votes (member_id, auto_event_id)
  WHERE member_id IS NOT NULL;

-- time_slot_votes: partial uniques on each discriminator
-- Note: memberName-only votes (both ids null) are intentionally NOT constrained;
-- name resolution to member_id happens upstream in the route layer (future work).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_slot_votes_user
  ON time_slot_votes (user_id, time_slot_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_slot_votes_member
  ON time_slot_votes (member_id, time_slot_id)
  WHERE member_id IS NOT NULL;
