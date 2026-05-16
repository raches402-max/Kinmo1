/**
 * UnifiedEventSidebar - Deduplicated, chronologically sorted event list
 *
 * Replaces the old EventTimeline sidebar with:
 * - Merged view of itineraries + auto-scheduled events
 * - Chronological sorting (future first, past at bottom)
 * - Status badges showing lifecycle (draft → proposed → confirmed)
 * - Click-to-edit functionality
 */

import { useMemo } from "react";
import { format, isPast, differenceInDays } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit,
  MapPin,
  MoreHorizontal,
  Send,
  Sparkles,
  Vote,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  UnifiedEvent,
  EventStatus,
  STATUS_CONFIG,
} from "@/lib/event-utils";
import { didEventHappen } from "@/lib/events";

export interface UnifiedEventSidebarProps {
  events: UnifiedEvent[];
  isLoading?: boolean;
  onEventClick?: (event: UnifiedEvent) => void;
  onEditEvent?: (event: UnifiedEvent) => void;
  onSendInvites?: (event: UnifiedEvent) => void;
  onCreateEvent?: () => void;
  maxHeight?: string;
  showCreateButton?: boolean;
  className?: string;
}

// Status icon mapping
const STATUS_ICONS: Record<EventStatus, React.ReactNode> = {
  draft: <Edit className="h-3.5 w-3.5" />,
  saved: <Clock className="h-3.5 w-3.5" />,
  proposed: <Vote className="h-3.5 w-3.5" />,
  scheduled: <CalendarClock className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
  past: <Calendar className="h-3.5 w-3.5" />,
  tbd: <Sparkles className="h-3.5 w-3.5" />,
};

function EventCard({
  event,
  isNext,
  onClick,
  onEdit,
  onSendInvites,
}: {
  event: UnifiedEvent;
  isNext: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onSendInvites?: () => void;
}) {
  const isPastEvent = event.status === "past";
  // Safely get config with fallback for unknown statuses
  const config = STATUS_CONFIG[event.status] || {
    label: event.status || "Unknown",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };

  // Calculate days until event
  const daysUntil = useMemo(() => {
    if (!event.eventDate) return null;
    const date = new Date(event.eventDate);
    const diff = differenceInDays(date, new Date());
    return diff;
  }, [event.eventDate]);

  // Format relative time
  const relativeTime = useMemo(() => {
    if (daysUntil === null) return "Date TBD";
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
    if (daysUntil === 0) return "Today";
    if (daysUntil === 1) return "Tomorrow";
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    return `In ${Math.ceil(daysUntil / 7)} weeks`;
  }, [daysUntil]);

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:border-primary/30",
        isNext && !isPastEvent && "border-primary/50 bg-primary/5",
        isPastEvent && "opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Event name */}
            <h4 className="text-sm font-medium truncate">
              {event.name}
            </h4>
            {/* Date */}
            {event.eventDate ? (
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.eventDate), "EEE, MMM d")}
                {event.eventTime && ` at ${event.eventTime}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Date TBD
              </p>
            )}
          </div>

          {/* Status badge + actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isNext && !isPastEvent && (
              <Badge variant="default" className="text-2xs px-1.5 py-0">
                Next
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("text-2xs px-1.5 py-0 gap-0.5", config.color)}
            >
              {STATUS_ICONS[event.status] || <Calendar className="h-3.5 w-3.5" />}
              {config.label}
            </Badge>

            {/* Actions dropdown */}
            {(onEdit || onSendInvites) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onSendInvites && event.status === "draft" && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendInvites();
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Invites
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Venue Preview */}
        {event.items.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {event.items[0].venueName}
              {event.items.length > 1 && ` +${event.items.length - 1} more`}
            </span>
          </div>
        )}

        {/* Time indicator */}
        {!isPastEvent && (
          <p
            className={cn(
              "text-xs",
              daysUntil !== null && daysUntil <= 3
                ? "text-amber-600 font-medium"
                : "text-muted-foreground"
            )}
          >
            {relativeTime}
          </p>
        )}

        {/* RSVP summary for sent events */}
        {event.rsvpCount && event.inviteSentAt && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600">{event.rsvpCount.yes} yes</span>
            <span className="text-amber-600">{event.rsvpCount.maybe} maybe</span>
            <span className="text-muted-foreground">
              {event.rsvpCount.pending} pending
            </span>
          </div>
        )}

        {/* Auto-generated indicator */}
        {event.source === "auto" && (
          <div className="flex items-center gap-1 text-xs text-purple-600">
            <Sparkles className="h-3 w-3" />
            <span>AI Suggested</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

export function UnifiedEventSidebar({
  events,
  isLoading,
  onEventClick,
  onEditEvent,
  onSendInvites,
  onCreateEvent,
  maxHeight = "500px",
  showCreateButton = true,
  className,
}: UnifiedEventSidebarProps) {
  // Separate future and past events
  const { futureEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const future: UnifiedEvent[] = [];
    const past: UnifiedEvent[] = [];

    events.forEach((event) => {
      const isPastDated =
        event.status === "past" || (event.eventDate && isPast(new Date(event.eventDate)));
      if (isPastDated) {
        // Only keep past events that actually happened (>=1 "yes" RSVP, not
        // cancelled). Past-dated events that didn't happen are dropped entirely.
        if (didEventHappen(event)) {
          past.push({ ...event, status: "past" });
        }
      } else {
        future.push(event);
      }
    });

    return { futureEvents: future, pastEvents: past.slice(0, 5) }; // Limit past to 5
  }, [events]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Events</CardTitle>
          <Badge variant="outline" className="text-xs">
            {futureEvents.length} upcoming
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create Event Button */}
        {showCreateButton && onCreateEvent && (
          <Button
            onClick={onCreateEvent}
            variant="outline"
            className="w-full gap-2"
            size="sm"
          >
            <Calendar className="h-4 w-4" />
            Create Event
          </Button>
        )}

        {/* Scrollable event list */}
        <ScrollArea style={{ maxHeight }} className="pr-3">
          <div className="space-y-2">
            {/* Upcoming Events */}
            {futureEvents.length > 0 ? (
              futureEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isNext={index === 0}
                  onClick={() => onEventClick?.(event)}
                  onEdit={() => onEditEvent?.(event)}
                  onSendInvites={() => onSendInvites?.(event)}
                />
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming events</p>
                {showCreateButton && (
                  <p className="text-xs mt-1">Create one to get started!</p>
                )}
              </div>
            )}

            {/* Past Events Section */}
            {pastEvents.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Recent Past Events
                </p>
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isNext={false}
                    onClick={() => onEventClick?.(event)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default UnifiedEventSidebar;
