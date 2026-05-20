export type EventLike = {
  eventDate?: string | Date | null;
  inviteSentAt?: string | Date | null;
  status?: string | null;
  isOrganizer?: boolean;
  // RSVP signals — different event sources carry different shapes.
  // /api/user/events events carry rsvpSummary; UnifiedEvent carries rsvpCount.
  rsvpSummary?: { yes: string[]; maybe: string[]; no: string[] } | null;
  rsvpCount?: { yes: number; maybe: number; no: number; pending: number } | null;
  // The current user's own RSVP on this event, if known. Populated by
  // /api/user/events; absent on UnifiedEvent-shaped sources.
  rsvp?: { response?: string | null } | null;
};

/**
 * Minimal "past in time" check. Used by group-detail and member-events past
 * lists, and by the dashboard's "needs feedback" filter (which combines this
 * with RSVP-attended + no-feedback-yet checks at the callsite).
 */
export function isPastDated(e: EventLike, now: Date = new Date()): boolean {
  return !!e.eventDate && new Date(e.eventDate) <= now;
}

/**
 * Whether an event actually happened: it has at least one "yes" RSVP and was
 * not cancelled. A past-dated event that nobody confirmed attendance for (or
 * that was rejected) is treated as never having happened.
 */
export function didEventHappen(e: EventLike): boolean {
  if (e.status === "rejected") return false;
  const yesCount = e.rsvpSummary?.yes.length ?? e.rsvpCount?.yes ?? 0;
  return yesCount > 0;
}

/**
 * A real past event: past-dated AND it actually happened.
 */
export function isPastEvent(e: EventLike, now: Date = new Date()): boolean {
  return isPastDated(e, now) && didEventHappen(e);
}

/**
 * Past-list visibility used by the dashboard's main pastEvents filter.
 * Only events that actually happened (>=1 "yes" RSVP, not cancelled) qualify.
 * Beyond that: organizers see all such past events (including their own
 * drafts); non-organizers additionally need the invite sent or a status that
 * implies the event happened.
 */
export function isPastDisplayableEvent(e: EventLike, now: Date = new Date()): boolean {
  if (!isPastDated(e, now)) return false;
  if (!didEventHappen(e)) return false;
  if (e.isOrganizer) return true;
  if (e.status === "draft" && !e.inviteSentAt) return false;
  if (e.status === "saved" && !e.inviteSentAt) return false;
  return true;
}

/**
 * Did the *current user* attend this event? Today, "attended" = their RSVP
 * was 'yes' or 'going'. Eventually post-event feedback can override this
 * ("I didn't end up going" → false, "I went after all" → true), but feedback
 * collection isn't reliable enough yet (~4/50 fill rate) so RSVP=yes is
 * treated as the authoritative attendance signal.
 *
 * Only meaningful on event shapes that carry the current user's `rsvp` —
 * /api/user/events does, UnifiedEvent shapes do not. Returns false when
 * the field is absent, so callers should only use this in user-scoped views.
 */
export function userAttendedEvent(e: EventLike): boolean {
  const response = e.rsvp?.response;
  return response === "yes" || response === "going";
}

export const FEEDBACK_WINDOW_DAYS = 30;

/**
 * Post-event feedback prompts only surface within FEEDBACK_WINDOW_DAYS of the
 * event date. After that, retrospective feedback is unlikely to be useful, so
 * we stop nagging.
 */
export function isWithinFeedbackWindow(
  e: EventLike,
  now: Date = new Date(),
  windowDays: number = FEEDBACK_WINDOW_DAYS,
): boolean {
  if (!e.eventDate) return false;
  const eventMs = new Date(e.eventDate).getTime();
  if (eventMs > now.getTime()) return false;
  return now.getTime() - eventMs <= windowDays * 24 * 60 * 60 * 1000;
}
