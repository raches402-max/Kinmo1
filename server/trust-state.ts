/**
 * Trust state plumbing for venue-bearing rows (activities, voting_events, itinerary_items).
 *
 * Rows carry (trustState, trustSource, verifiedAt) so the system can tell which records
 * have been vetted and which need validation before use. See PLAN.md / memory for design rationale.
 */

export type TrustSource =
  | "google_search"      // user clicked a Google Places search result; (name, placeId) came from same response
  | "ai_suggestion"      // AI generated the venue (name + maybe placeId from different sources)
  | "url_paste"          // parsed from a Google Maps URL the user pasted
  | "manual"             // user typed everything by hand; nothing to validate against
  | "validation_pass"    // a previously-needs_review row was checked and passed
  | "user_edit"          // identifying fields were edited; needs re-validation
  | "inherited"          // copied from another venue row; trust state inherited from source
  | "backfill";          // legacy data marked verified during migration

const VERIFIED_SOURCES: ReadonlySet<TrustSource> = new Set([
  "google_search",
  "manual",
  "validation_pass",
  "inherited",
  "backfill",
]);

export type TrustFields = {
  trustState: "verified" | "needs_review";
  trustSource: TrustSource;
  verifiedAt: Date | null;
};

export function trustFieldsForSource(source: TrustSource): TrustFields {
  const verified = VERIFIED_SOURCES.has(source);
  return {
    trustState: verified ? "verified" : "needs_review",
    trustSource: source,
    verifiedAt: verified ? new Date() : null,
  };
}

/**
 * Fields that, when changed by an update, invalidate a row's verified status.
 * Editing notes/times/photos doesn't dirty the row — only changes to identity do.
 */
export const ACTIVITY_DIRTYING_FIELDS = ["venueName", "venueAddress", "googlePlaceId"] as const;
export const VOTING_EVENT_DIRTYING_FIELDS = ["title", "venueAddress", "googlePlaceId"] as const;
export const ITINERARY_ITEM_DIRTYING_FIELDS = ["venueName", "venueAddress", "googlePlaceId"] as const;

export function isDirtyingUpdate(
  updates: Record<string, unknown>,
  fields: readonly string[]
): boolean {
  return fields.some((f) => f in updates);
}

/**
 * If updates touch identifying fields, returns the fields that flip a row to needs_review.
 * Otherwise returns null (no trust-state changes needed).
 */
export function dirtyingTrustFields(
  updates: Record<string, unknown>,
  fields: readonly string[]
): { trustState: "needs_review"; trustSource: TrustSource; verifiedAt: null } | null {
  if (!isDirtyingUpdate(updates, fields)) return null;
  return { trustState: "needs_review", trustSource: "user_edit", verifiedAt: null };
}
