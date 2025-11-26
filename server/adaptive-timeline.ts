import { differenceInDays, addDays } from 'date-fns';

export interface AdaptiveScheduleConfig {
  inviteAdvanceDays: number;
  rsvpWindowDays: number;
  reminders: Array<{
    type: 'gentle_nudge' | 'final_call' | 'day_before';
    daysBeforeDeadline?: number;
    daysBeforeEvent?: number;
  }>;
  timelineType: 'standard' | 'medium' | 'compressed' | 'urgent';
  reasoning: string;
}

/**
 * Calculate adaptive timeline based on how far out the event is
 * Automatically adjusts notice periods and RSVP windows based on available time
 */
export function calculateAdaptiveTimeline(
  eventDate: Date,
  fromDate: Date = new Date(),
  requiresReservation: boolean = false
): AdaptiveScheduleConfig {
  const daysUntilEvent = differenceInDays(eventDate, fromDate);

  // Ensure minimum buffers for operational requirements
  const MIN_VENUE_BUFFER = 2; // 48 hours for venue confirmation
  const MIN_HEADCOUNT_BUFFER = 1; // 24 hours for final headcount
  const MIN_RSVP_WINDOW = 2; // Minimum 2 days to respond

  let inviteAdvanceDays: number;
  let rsvpWindowDays: number;
  let timelineType: AdaptiveScheduleConfig['timelineType'];
  let reasoning: string;

  if (daysUntilEvent >= 21) {
    // Standard timeline: Full 21-day notice with 14-day RSVP window
    inviteAdvanceDays = 21;
    rsvpWindowDays = 14;
    timelineType = 'standard';
    reasoning = 'Standard timeline with 3 weeks advance notice for optimal planning';
  } else if (daysUntilEvent >= 14) {
    // Medium timeline: 14-20 days out
    inviteAdvanceDays = Math.min(daysUntilEvent, 14);
    rsvpWindowDays = Math.min(10, daysUntilEvent - 4); // Leave 4 days for venue/logistics
    timelineType = 'medium';
    reasoning = 'Medium timeline with 2 weeks notice for good coordination';
  } else if (daysUntilEvent >= 7) {
    // Compressed timeline: 7-13 days out
    inviteAdvanceDays = daysUntilEvent;
    rsvpWindowDays = Math.min(5, daysUntilEvent - MIN_VENUE_BUFFER);
    timelineType = 'compressed';
    reasoning = 'Compressed timeline for events coming up within 2 weeks';
  } else {
    // Urgent timeline: Less than 7 days out
    inviteAdvanceDays = daysUntilEvent;
    // For urgent events, take half the available time for RSVPs (minimum 2 days)
    rsvpWindowDays = Math.max(MIN_RSVP_WINDOW, Math.floor(daysUntilEvent * 0.5));
    timelineType = 'urgent';
    reasoning = `Urgent timeline - event in ${daysUntilEvent} days requires quick coordination`;
  }

  // Adjust for venues requiring reservations
  if (requiresReservation && timelineType === 'urgent') {
    // Try to give more RSVP time if we need reservations
    rsvpWindowDays = Math.min(
      rsvpWindowDays + 1,
      daysUntilEvent - MIN_VENUE_BUFFER
    );
    reasoning += ' (adjusted for reservation requirements)';
  }

  // Ensure we never exceed the actual time available
  inviteAdvanceDays = Math.min(inviteAdvanceDays, daysUntilEvent);
  rsvpWindowDays = Math.min(rsvpWindowDays, inviteAdvanceDays - MIN_HEADCOUNT_BUFFER);

  // Calculate appropriate reminders based on RSVP window
  const reminders: AdaptiveScheduleConfig['reminders'] = [];

  if (rsvpWindowDays >= 7) {
    // For longer RSVP windows, add gentle nudge halfway through
    reminders.push({
      type: 'gentle_nudge',
      daysBeforeDeadline: Math.floor(rsvpWindowDays / 2)
    });
  }

  if (rsvpWindowDays >= 3) {
    // Add final call for windows 3+ days
    reminders.push({
      type: 'final_call',
      daysBeforeDeadline: 1
    });
  }

  // Always add day-before reminder if there's time
  if (daysUntilEvent > 1) {
    reminders.push({
      type: 'day_before',
      daysBeforeEvent: 1
    });
  }

  return {
    inviteAdvanceDays,
    rsvpWindowDays,
    reminders,
    timelineType,
    reasoning
  };
}

/**
 * Calculate when to send initial invites based on event date
 */
export function calculateInviteSendDate(
  eventDate: Date,
  fromDate: Date = new Date()
): Date {
  const config = calculateAdaptiveTimeline(eventDate, fromDate);
  return addDays(eventDate, -config.inviteAdvanceDays);
}

/**
 * Calculate RSVP deadline based on event date and timeline config
 */
export function calculateRsvpDeadline(
  eventDate: Date,
  config: AdaptiveScheduleConfig
): Date {
  const daysBeforeEvent = config.inviteAdvanceDays - config.rsvpWindowDays;
  return addDays(eventDate, -daysBeforeEvent);
}

/**
 * Get a human-readable description of the timeline being used
 */
export function getTimelineDescription(config: AdaptiveScheduleConfig): string {
  switch (config.timelineType) {
    case 'standard':
      return `Standard timeline (${config.inviteAdvanceDays} days notice)`;
    case 'medium':
      return `Medium timeline (${config.inviteAdvanceDays} days notice)`;
    case 'compressed':
      return `Quick turnaround (${config.inviteAdvanceDays} days notice)`;
    case 'urgent':
      return `Urgent scheduling (${config.inviteAdvanceDays} days notice)`;
    default:
      return `${config.inviteAdvanceDays} days advance notice`;
  }
}

/**
 * Validate if there's enough time to execute a timeline
 */
export function isTimelineValid(
  eventDate: Date,
  fromDate: Date = new Date()
): { valid: boolean; reason?: string } {
  const daysUntilEvent = differenceInDays(eventDate, fromDate);

  if (daysUntilEvent < 1) {
    return {
      valid: false,
      reason: 'Event date must be at least 1 day in the future'
    };
  }

  if (daysUntilEvent < 2) {
    return {
      valid: false,
      reason: 'Not enough time for venue confirmation (requires 48 hours minimum)'
    };
  }

  return { valid: true };
}