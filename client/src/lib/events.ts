export type EventLike = {
  eventDate?: string | Date | null;
  inviteSentAt?: string | Date | null;
  status?: string | null;
  isOrganizer?: boolean;
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
 * Past-list visibility used by the dashboard's main pastEvents filter.
 * Organizers see all past events (including their own drafts). Non-organizers
 * see anything sent (inviteSentAt set) or anything with a status that implies
 * the event actually happened ('proposed', 'scheduled', 'completed', 'rejected').
 */
export function isPastDisplayableEvent(e: EventLike, now: Date = new Date()): boolean {
  if (!isPastDated(e, now)) return false;
  if (e.isOrganizer) return true;
  if (e.status === "draft" && !e.inviteSentAt) return false;
  if (e.status === "saved" && !e.inviteSentAt) return false;
  return true;
}
