import { format } from "date-fns";
import { ChevronDown, ChevronUp, MapPin, ExternalLink } from "lucide-react";
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

  const getMeetingAtText = (items: EventItem[]) => {
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
    if (event.hostMemberId === event.currentUserMemberId) {
      return <Badge variant="default" className="text-xs">Hosting</Badge>;
    }
    if (event.isOrganizer) {
      return <Badge variant="outline" className="text-xs">Organizer</Badge>;
    }
    // Default to Member badge for now (Guest logic to be added later)
    return <Badge variant="secondary" className="text-xs">Member</Badge>;
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

        return (
          <div key={eventId} className="border-b last:border-b-0">
            {/* Main Row */}
            <Link href={`/event/${eventId}`}>
              <div className="grid grid-cols-[180px_1fr_200px_120px_40px] gap-4 px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer items-center">
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
                  <span className="text-base flex-shrink-0">{event.groupEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{event.groupName}</div>
                    <div className="flex gap-2 mt-1">
                      {getRoleBadge(event)}
                      {event.isVirtual && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700">
                          AI Scheduling
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meeting At Column */}
                <div className="text-sm truncate">
                  {getMeetingAtText(event.items)}
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
