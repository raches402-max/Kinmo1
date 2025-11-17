import { format, differenceInHours, differenceInDays } from "date-fns";
import { ChevronDown, ChevronUp, MapPin, ExternalLink, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

type EventItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
  rating: string | null;
  googlePlaceId: string | null;
};

type Event = {
  inviteId: string;
  itineraryId: string | null;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  eventDate: string | null;
  isOrganizer: boolean;
  isVirtual?: boolean;
  hostMemberId: string | null;
  hostMemberName: string | null;
  currentUserMemberId: string | null;
  items: EventItem[];
  rsvp: {
    response: string;
  } | null;
  // Auto-schedule properties
  isAutoScheduled?: boolean;
  status?: string;
  autoSendAt?: string;
  confidenceScore?: number;
  requiresReview?: boolean;
};

type EventsTableProps = {
  events: Event[];
  expandedEvents: Set<string>;
  onToggleExpand: (eventId: string) => void;
  currentUserId?: string;
};

export default function EventsTable({
  events,
  expandedEvents,
  onToggleExpand
}: EventsTableProps) {

  // Determine border style based on event status
  const getEventBorderStyle = (event: Event): { borderColor: string; borderWidth: string; backgroundColor?: string } => {
    if (!event.isAutoScheduled) {
      // Regular event - thin border with group accent color
      return {
        borderColor: event.groupAccentColor || '#94A3B8',
        borderWidth: '2px'
      };
    }

    // Auto-scheduled event - determine status
    const status = event.status;
    const confidenceScore = event.confidenceScore || 0;
    const requiresReview = event.requiresReview;

    // Red: Blocked (low confidence, requires review, or other blocking issue)
    if (requiresReview || confidenceScore < 60 || status === 'blocked') {
      return {
        borderColor: '#ef4444', // red-500
        borderWidth: '4px',
        backgroundColor: 'rgba(254, 242, 242, 0.3)' // red-50/30
      };
    }

    // Green: Approved or auto-approved
    if (status === 'approved' || status === 'auto_approved' || status === 'scheduled') {
      return {
        borderColor: '#22c55e', // green-500
        borderWidth: '2px'
      };
    }

    // Yellow: Pending approval (will auto-send)
    return {
      borderColor: '#f59e0b', // amber-500
      borderWidth: '4px',
      backgroundColor: 'rgba(254, 243, 199, 0.3)' // amber-50/30
    };
  };

  // Get countdown text for auto-send deadline
  const getAutoSendCountdown = (event: Event): string | null => {
    if (!event.isAutoScheduled || !event.autoSendAt) return null;

    const now = new Date();
    const autoSendDate = new Date(event.autoSendAt);
    const hoursUntil = differenceInHours(autoSendDate, now);
    const daysUntil = differenceInDays(autoSendDate, now);

    if (hoursUntil < 0) return null; // Already auto-sent

    if (hoursUntil < 24) {
      return `Auto-sends in ${hoursUntil}h`;
    } else {
      return `Auto-sends in ${daysUntil}d`;
    }
  };

  const getMeetingAtText = (items: EventItem[], isVirtual?: boolean, eventDate?: string | null) => {
    if (isVirtual) {
      // For virtual events, show when it will be planned
      if (eventDate) {
        const planDate = new Date(eventDate);
        planDate.setDate(planDate.getDate() - 3); // Plan 3 days before event
        return `Will be decided on ${format(planDate, "MMM d")}`;
      }
      return "Planning in progress";
    }
    if (!items || items.length === 0) return "TBD";
    if (items.length === 1) return items[0].venueName;
    return `${items[0].venueName} + ${items.length - 1}`;
  };

  const getGoogleMapsUrl = (venue: EventItem) => {
    if (venue.googlePlaceId) {
      return `https://www.google.com/maps/search/?api=1&query_place_id=${venue.googlePlaceId}`;
    }
    if (venue.venueAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueAddress)}`;
    }
    return null;
  };

  const getRoleBadge = (event: Event) => {
    // Only show role info if user is hosting
    if (event.hostMemberId === event.currentUserMemberId && event.hostMemberName) {
      return (
        <span className="text-xs text-muted-foreground">
          Host: {event.hostMemberName}
        </span>
      );
    }
    // Don't show organizer or member badges - reduces clutter
    return null;
  };

  const getHostInfo = (event: Event) => {
    // Don't show host info if current user is the host (already shown in getRoleBadge)
    if (event.hostMemberId === event.currentUserMemberId) {
      return null;
    }

    if (event.hostMemberId && event.hostMemberName) {
      return (
        <span className="text-xs text-muted-foreground">
          hosts: {event.hostMemberName}
        </span>
      );
    }
    if (!event.hostMemberId) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="h-3 w-3" />
          AI scheduling
        </span>
      );
    }
    return null;
  };

  const getRsvpBadge = (event: Event) => {
    if (!event.rsvp) return null;

    const response = event.rsvp.response;
    if (response === "going") {
      return <span className="text-xs text-green-600 font-medium">Going ✓</span>;
    }
    if (response === "maybe") {
      return <span className="text-xs text-yellow-600 font-medium">Maybe</span>;
    }
    if (response === "no") {
      return <span className="text-xs text-gray-500 font-medium">Can't go</span>;
    }
    return null;
  };

  return (
    <div className="space-y-1">
      {/* Table Header */}
      <div className="grid grid-cols-[180px_1fr_200px_120px_40px] gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
        <div>DATE/TIME</div>
        <div>EVENT</div>
        <div>MEETING AT</div>
        <div>RSVP</div>
        <div></div>
      </div>

      {/* Event Rows */}
      {events.map((event) => {
        const eventId = event.itineraryId || event.inviteId;
        const isExpanded = expandedEvents.has(eventId);
        const hasMultipleVenues = event.items && event.items.length > 1;
        const borderStyle = getEventBorderStyle(event);
        const countdown = getAutoSendCountdown(event);

        const rowContent = (
          <div
            className="grid grid-cols-[180px_1fr_200px_120px_40px] gap-4 px-3 py-3 hover:bg-muted/50 transition-colors items-center cursor-pointer"
            style={{
              borderLeft: `${borderStyle.borderWidth} solid ${borderStyle.borderColor}`,
              backgroundColor: borderStyle.backgroundColor
            }}
          >
                {/* Date/Time Column */}
                <div className="text-sm">
                  {event.eventDate ? (
                    <>
                      <div className="font-medium">
                        {format(new Date(event.eventDate), "MMM d, h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.eventDate), "EEEE")}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">TBD</div>
                  )}
                </div>

                {/* Event Column */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl flex-shrink-0">
                    {event.isAutoScheduled ? '🤖' : event.groupEmoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-base truncate">{event.groupName}</div>
                    <div className="flex gap-2 mt-1 items-center flex-wrap">
                      {getRoleBadge(event)}
                      {getHostInfo(event)}
                      {countdown && (
                        <span className="text-xs text-amber-600 font-medium">
                          ⏰ {countdown}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meeting At Column */}
                <div className="text-sm truncate">
                  {getMeetingAtText(event.items, event.isVirtual, event.eventDate)}
                </div>

                {/* RSVP Column */}
                <div className="text-sm">
                  {getRsvpBadge(event)}
                </div>

                {/* Expand Arrow */}
                <div
                  className="flex justify-center"
                  onClick={(e) => {
                    if (hasMultipleVenues) {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleExpand(eventId);
                    }
                  }}
                >
                  {hasMultipleVenues && (
                    <button className="p-1 hover:bg-muted rounded">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              </div>
        );

        return (
          <div key={eventId} className="border-b last:border-b-0">
            {/* Main Row */}
            <Link href={event.itineraryId ? `/event/${event.itineraryId}` : `/group/${event.groupId}`}>
              {rowContent}
            </Link>

            {/* Expanded Venue List */}
            {isExpanded && hasMultipleVenues && (
              <div className="bg-muted/30 px-3 py-2 space-y-2">
                {event.items.map((venue, idx) => {
                  const mapsUrl = getGoogleMapsUrl(venue);
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm pl-[180px]">
                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="text-xs text-muted-foreground min-w-[150px]">
                        {venue.venueAddress || "Address not available"}
                      </div>
                      <div className="font-medium">→ {venue.venueName}</div>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Maps
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
