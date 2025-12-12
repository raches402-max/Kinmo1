import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar, CalendarClock, CalendarPlus, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventAccordionSection } from "./EventAccordionSection";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";

interface WhenSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  eventDate?: string | null;
  eventEndTime?: string | null;
  timezone?: string;
  rsvpDeadline?: string | null;
  isOrganizer: boolean;
  onEditDate?: () => void;
  onEditDeadline?: () => void;
  // For calendar link
  eventName?: string;
  groupName?: string;
  venues?: Array<{ venueName: string; venueAddress?: string | null }>;
}

export function WhenSection({
  isExpanded,
  onToggle,
  eventDate,
  eventEndTime,
  timezone = "America/Los_Angeles",
  rsvpDeadline,
  isOrganizer,
  onEditDate,
  onEditDeadline,
  eventName,
  groupName,
  venues,
}: WhenSectionProps) {
  const hasDate = !!eventDate;
  const date = eventDate ? new Date(eventDate) : null;
  const endDate = eventEndTime ? new Date(eventEndTime) : null;
  const deadlineDate = rsvpDeadline ? new Date(rsvpDeadline) : null;

  // Format relative date (e.g., "in 2 weeks", "tomorrow", "3 days ago")
  const relativeDate = date && isFuture(date)
    ? formatDistanceToNow(date, { addSuffix: true })
    : null;

  // Format display date with timezone abbreviation
  const tzAbbrev = date ? formatInTimeZone(date, timezone, "zzz") : null;
  const dateDisplay = date
    ? `${formatInTimeZone(date, timezone, "EEEE, MMMM d")} (${tzAbbrev})`
    : null;

  // Format time range
  const startTime = date
    ? formatInTimeZone(date, timezone, "h:mm a")
    : null;
  const endTime = endDate
    ? formatInTimeZone(endDate, timezone, "h:mm a")
    : null;

  // Get timezone display name
  const timezoneDisplay = timezone
    ? timezone.replace(/_/g, " ").split("/").pop() || timezone
    : "Local Time";

  // Format deadline with timezone
  const deadlineDisplay = deadlineDate
    ? formatInTimeZone(deadlineDate, timezone, "MMMM d, yyyy")
    : null;

  return (
    <EventAccordionSection
      icon={Calendar}
      title="When"
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={
        hasDate && relativeDate ? (
          <span className="text-2xs text-muted-foreground ml-2">
            {relativeDate}
          </span>
        ) : null
      }
    >
      {!hasDate ? (
        // Empty state
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">No date set yet</p>
          {isOrganizer && (
            <Button size="sm" className="gap-2" onClick={onEditDate}>
              <Plus className="h-4 w-4" />
              Pick a date
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main date/time */}
          <button
            onClick={() => isOrganizer && onEditDate?.()}
            className={cn("w-full text-left", isOrganizer && "group")}
            disabled={!isOrganizer}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-lg font-semibold text-foreground">
                  {dateDisplay}
                </span>
                <div className="text-muted-foreground mt-0.5">
                  {startTime}
                  {endTime && ` – ${endTime}`}
                  <span className="text-muted-foreground/60 ml-1">
                    {timezoneDisplay}
                  </span>
                </div>
              </div>
              {isOrganizer && (
                <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              )}
            </div>
          </button>

          {/* Add to Calendar link */}
          {eventDate && (
            <a
              href={generateCalendarUrlFromItinerary({
                groupName: groupName || 'Event',
                eventName: eventName || groupName || 'Event',
                eventDate: eventDate,
                venues: venues || [],
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to Google Calendar
            </a>
          )}

          {/* RSVP deadline */}
          {deadlineDisplay && (
            <button
              onClick={() => isOrganizer && onEditDeadline?.()}
              className={cn(
                "w-full flex items-center justify-between text-left py-2 px-3 -mx-3 rounded-lg transition-colors",
                isOrganizer && "hover:bg-muted/50 group"
              )}
              disabled={!isOrganizer}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                <span>RSVP by {deadlineDisplay}</span>
              </div>
              {isOrganizer && (
                <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          )}
        </div>
      )}
    </EventAccordionSection>
  );
}
