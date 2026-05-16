import { describe, it, expect } from "vitest";
import {
  trustFieldsForSource,
  dirtyingTrustFields,
  isDirtyingUpdate,
  ITINERARY_ITEM_DIRTYING_FIELDS,
  VOTING_EVENT_DIRTYING_FIELDS,
} from "./trust-state";

describe("trustFieldsForSource", () => {
  it("marks google_search as verified with timestamp", () => {
    const t = trustFieldsForSource("google_search");
    expect(t.trustState).toBe("verified");
    expect(t.trustSource).toBe("google_search");
    expect(t.verifiedAt).toBeInstanceOf(Date);
  });

  it("marks manual as verified (nothing to validate against)", () => {
    expect(trustFieldsForSource("manual").trustState).toBe("verified");
  });

  it("marks validation_pass as verified", () => {
    expect(trustFieldsForSource("validation_pass").trustState).toBe("verified");
  });

  it("marks inherited as verified", () => {
    expect(trustFieldsForSource("inherited").trustState).toBe("verified");
  });

  it("marks backfill as verified", () => {
    expect(trustFieldsForSource("backfill").trustState).toBe("verified");
  });

  it("marks ai_suggestion as needs_review with null verifiedAt", () => {
    const t = trustFieldsForSource("ai_suggestion");
    expect(t.trustState).toBe("needs_review");
    expect(t.verifiedAt).toBeNull();
  });

  it("marks url_paste as needs_review", () => {
    expect(trustFieldsForSource("url_paste").trustState).toBe("needs_review");
  });

  it("marks user_edit as needs_review", () => {
    expect(trustFieldsForSource("user_edit").trustState).toBe("needs_review");
  });
});

describe("isDirtyingUpdate", () => {
  it("returns true when an identifying field is present", () => {
    expect(isDirtyingUpdate({ venueName: "x" }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(true);
    expect(isDirtyingUpdate({ venueAddress: "x" }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(true);
    expect(isDirtyingUpdate({ googlePlaceId: "x" }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(true);
  });

  it("returns false when only non-identifying fields are present", () => {
    expect(isDirtyingUpdate({ notes: "x", arrivalTime: new Date() }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(false);
  });

  it("treats title as identifying for voting events", () => {
    expect(isDirtyingUpdate({ title: "renamed" }, VOTING_EVENT_DIRTYING_FIELDS)).toBe(true);
  });

  it("returns false for empty updates", () => {
    expect(isDirtyingUpdate({}, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(false);
  });

  it("recognizes a field even when its value is undefined or null", () => {
    // 'in' operator semantics — explicit clear still dirties.
    expect(isDirtyingUpdate({ venueName: undefined }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(true);
    expect(isDirtyingUpdate({ googlePlaceId: null }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBe(true);
  });
});

describe("dirtyingTrustFields", () => {
  it("returns null when no dirtying fields are present", () => {
    expect(dirtyingTrustFields({ notes: "x" }, ITINERARY_ITEM_DIRTYING_FIELDS)).toBeNull();
  });

  it("returns user_edit fields when an identifying field is present", () => {
    const result = dirtyingTrustFields({ venueName: "x" }, ITINERARY_ITEM_DIRTYING_FIELDS);
    expect(result).toEqual({
      trustState: "needs_review",
      trustSource: "user_edit",
      verifiedAt: null,
    });
  });
});
