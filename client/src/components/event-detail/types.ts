// Types for the mobile event details components

export type EventStatus = "draft" | "sent" | "finalized";
export type RsvpStatus = "yes" | "maybe" | "no" | "pending";

export interface EventVenue {
  id: string;
  sourceId?: string;
  venueName: string;
  venueType?: string;
  rating?: number;
  arrivalTime?: string;
  departureTime?: string;
  address?: string;
  googlePlaceId?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  notes?: string;
  photoUrl?: string;
}

export interface EventAttendee {
  id: string;
  name: string;
  email?: string;
  initials: string;
  response: RsvpStatus;
  isGuest: boolean;
  isHost?: boolean;
  isOrganizer?: boolean;
  additionalAttendees?: number;
  numberOfKids?: number;
  memberId?: string;
}

export interface AutoScheduleConfig {
  inviteAdvanceDays: number;
  rsvpWindowDays: number;
  timelineType: string;
  reminders?: any[];
  reasoning?: string;
}

export interface EventData {
  itineraryId: string;
  itineraryName: string;
  eventDate?: string | null;
  eventEndTime?: string | null;
  groupId: string;
  groupName: string;
  groupEmoji?: string;
  groupTimezone?: string;
  groupAccentColor?: string;
  items: EventVenue[];
  members?: any[];
  detailedRsvps?: any[];
  rsvp?: { response: RsvpStatus } | null;
  organizerRsvp?: RsvpStatus;
  isOrganizer: boolean;
  hostMemberId?: string;
  currentUserMemberId?: string;
  inviteSentAt?: string | null;
  inviteToken?: string;
  rsvpDeadline?: string | null;
  note?: string;
  quorumThreshold?: number;
  autoScheduleConfig?: AutoScheduleConfig | null;
}

export interface RsvpCounts {
  yes: number;
  maybe: number;
  pending: number;
  no: number;
}
