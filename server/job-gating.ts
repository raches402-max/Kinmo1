import { db } from "./db";
import { sql } from "drizzle-orm";

const DEFAULT_ACTIVE_WINDOW_DAYS = 14;

/**
 * Most recent member-driven activity timestamp for a group.
 *
 * Combines: most recent finalized event (groups.last_event_date),
 * most recent itinerary creation, and most recent RSVP update.
 * Returns null if the group has no signal at all (treat as never active).
 */
export async function getGroupLastActiveAt(
  groupId: string,
): Promise<Date | null> {
  const result = await db.execute<{ last_active: string | null }>(sql`
    SELECT GREATEST(
      (SELECT last_event_date FROM groups WHERE id = ${groupId}),
      (SELECT MAX(created_at) FROM itineraries WHERE group_id = ${groupId}),
      (SELECT MAX(r.updated_at)
         FROM rsvps r
         JOIN itineraries i ON i.id = r.itinerary_id
         WHERE i.group_id = ${groupId})
    ) AS last_active
  `);

  const ts = result.rows[0]?.last_active;
  return ts ? new Date(ts) : null;
}

/**
 * Cheap gate for background jobs: returns true if the group has had
 * member-driven activity within the window. Use this before firing
 * expensive AI/Google Places calls for a specific group.
 *
 * Default window is 14 days; pass a different number to tune.
 */
export async function isGroupActive(
  groupId: string,
  windowDays: number = DEFAULT_ACTIVE_WINDOW_DAYS,
): Promise<boolean> {
  const lastActive = await getGroupLastActiveAt(groupId);
  if (!lastActive) return false;
  const ageMs = Date.now() - lastActive.getTime();
  return ageMs <= windowDays * 24 * 60 * 60 * 1000;
}
