/**
 * EventCard - Mobile-optimized event card with date-first layout
 *
 * Features:
 * - Date/time prominent in header
 * - RSVP status as card border color
 * - Tappable card navigates to event details
 * - Tappable attendee count opens bottom sheet
 * - Clickable venue opens Google Maps
 */

import { useState } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { MapPin, ExternalLink, ChevronRight, Users, X, Check, HelpCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
type EventItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
  rating: string | null;
  googlePlaceId: string | null;
};

type EventCardEvent = {
  inviteId: string;
  itineraryId: string | null;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  groupTimezone: string | null;
  eventDate: string | null;
  isOrganizer: boolean;
  isVirtual?: boolean;
  items: EventItem[];
  rsvp: {
    response: string;
  } | null;
  rsvpSummary?: {
    yes: string[];
    maybe: string[];
    no: string[];
  };
  members?: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
};

type EventCardProps = {
  event: EventCardEvent;
  index?: number;
  isPastEvent?: boolean;
  onRsvpChange?: (response: string) => void;
  isRsvpLoading?: boolean;
};

// RSVP border styling based on status
const getRsvpBorderStyle = (rsvp: string | null) => {
  switch (rsvp) {
    case "going":
    case "yes":
      return "border-2 border-emerald-400 bg-emerald-50/30";
    case "maybe":
      return "border-2 border-amber-400 bg-amber-50/20";
    case "no":
      return "border border-stone-200 bg-stone-50/50 opacity-60";
    default:
      return "border-2 border-stone-200 bg-white";
  }
};

// RSVP button styling
const getRsvpStyle = (rsvp: string | null) => {
  switch (rsvp) {
    case "going":
    case "yes":
      return { bg: "bg-emerald-500", text: "text-white", label: "Going", icon: Check };
    case "maybe":
      return { bg: "bg-amber-500", text: "text-white", label: "Maybe", icon: HelpCircle };
    case "no":
      return { bg: "bg-stone-400", text: "text-white", label: "Can't go", icon: X };
    default:
      return { bg: "bg-stone-800", text: "text-white", label: "RSVP", icon: null };
  }
};

// Get Google Maps URL for a venue
const getGoogleMapsUrl = (venue: EventItem) => {
  if (venue.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`;
  }
  if (venue.venueAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueAddress)}`;
  }
  return null;
};

// Format day of week with date from date
const getDayOfWeek = (dateStr: string, timezone: string | null): string => {
  const date = new Date(dateStr);
  return timezone
    ? formatInTimeZone(date, timezone, "EEEE, MMM d")
    : format(date, "EEEE, MMM d");
};

// Format time from date
const getFormattedTime = (dateStr: string, timezone: string | null): string => {
  const date = new Date(dateStr);
  return timezone
    ? formatInTimeZone(date, timezone, "h:mm a")
    : format(date, "h:mm a");
};

// RSVP Dropdown component
function RsvpDropdown({
  currentRsvp,
  onRsvpChange,
  accentColor,
  disabled,
  isLoading
}: {
  currentRsvp: string | null;
  onRsvpChange: (rsvp: string) => void;
  accentColor: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const rsvp = getRsvpStyle(currentRsvp);
  const Icon = rsvp.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all px-4 py-2.5 text-sm min-w-[80px] min-h-[44px]",
            rsvp.bg,
            rsvp.text,
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {Icon && <Icon className="h-4 w-4" />}
              {rsvp.label}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-xl border-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-emerald-700 font-semibold text-base hover:bg-emerald-50 cursor-pointer"
          onClick={() => onRsvpChange("going")}
        >
          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">
            <Check className="h-4 w-4" />
          </span>
          I'm going!
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-amber-700 font-semibold text-base hover:bg-amber-50 cursor-pointer"
          onClick={() => onRsvpChange("maybe")}
        >
          <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
            <HelpCircle className="h-4 w-4" />
          </span>
          Maybe
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-stone-600 font-semibold text-base hover:bg-stone-100 cursor-pointer"
          onClick={() => onRsvpChange("no")}
        >
          <span className="w-8 h-8 rounded-full bg-stone-400 text-white flex items-center justify-center text-sm font-bold">
            <X className="h-4 w-4" />
          </span>
          Can't make it
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Attendee Bottom Sheet component
export function AttendeeBottomSheet({
  event,
  isOpen,
  onClose
}: {
  event: EventCardEvent | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  // Get pending members (those who haven't responded)
  const getPendingMembers = (): string[] => {
    if (!event.members || !event.rsvpSummary) return [];

    const allRespondents = new Set([
      ...(event.rsvpSummary.yes || []),
      ...(event.rsvpSummary.maybe || []),
      ...(event.rsvpSummary.no || [])
    ]);

    return event.members
      .map(m => m.name || m.email || 'Unknown')
      .filter(name => !allRespondents.has(name));
  };

  const pendingMembers = getPendingMembers();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-stone-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 flex items-center justify-between border-b border-stone-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{event.groupEmoji}</span>
                <div>
                  <h3 className="font-bold text-lg text-stone-800">{event.itineraryName?.trim() || event.groupName?.trim() || 'Untitled Event'}</h3>
                  {event.eventDate && (
                    <p className="text-sm text-stone-500">
                      {getDayOfWeek(event.eventDate, event.groupTimezone)}, {getFormattedTime(event.eventDate, event.groupTimezone)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors"
              >
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {/* Attendee lists */}
            <div className="px-5 py-4 overflow-y-auto max-h-[50vh] space-y-5">
              {/* Going */}
              {event.rsvpSummary?.yes && event.rsvpSummary.yes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold text-stone-700">
                      Going ({event.rsvpSummary.yes.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.rsvpSummary.yes.map((name) => (
                      <div
                        key={name}
                        className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Maybe */}
              {event.rsvpSummary?.maybe && event.rsvpSummary.maybe.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <p className="text-sm font-semibold text-stone-700">
                      Maybe ({event.rsvpSummary.maybe.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.rsvpSummary.maybe.map((name) => (
                      <div
                        key={name}
                        className="px-3 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not going */}
              {event.rsvpSummary?.no && event.rsvpSummary.no.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-stone-400" />
                    <p className="text-sm font-semibold text-stone-700">
                      Can't make it ({event.rsvpSummary.no.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.rsvpSummary.no.map((name) => (
                      <div
                        key={name}
                        className="px-3 py-2 bg-stone-100 text-stone-500 rounded-full text-sm font-medium"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending */}
              {pendingMembers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-stone-300 border border-dashed border-stone-400" />
                    <p className="text-sm font-semibold text-stone-700">
                      Waiting for response ({pendingMembers.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingMembers.map((name) => (
                      <div
                        key={name}
                        className="px-3 py-2 bg-stone-50 text-stone-400 rounded-full text-sm font-medium border border-dashed border-stone-200"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Safe area padding for bottom */}
            <div className="h-8" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Main EventCard component
export function EventCard({
  event,
  index = 0,
  isPastEvent = false,
  onRsvpChange,
  isRsvpLoading = false
}: EventCardProps) {
  const [showAttendees, setShowAttendees] = useState(false);
  const currentRsvp = event.rsvp?.response || null;
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.rsvpSummary?.yes?.length || 0;
  const maybeCount = event.rsvpSummary?.maybe?.length || 0;
  const accentColor = event.groupAccentColor || '#6B7280';

  // Get venue info
  const venue = event.items?.[0];
  const venueUrl = venue ? getGoogleMapsUrl(venue) : null;

  // Format date/time
  const dayOfWeek = event.eventDate
    ? getDayOfWeek(event.eventDate, event.groupTimezone)
    : null;
  const formattedTime = event.eventDate
    ? getFormattedTime(event.eventDate, event.groupTimezone)
    : null;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
  };

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={handleCardClick}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.98] cursor-pointer",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Colored header - clean, date first */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <span className="text-2xl">{event.groupEmoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-stone-800 leading-tight">
            {dayOfWeek || 'Date TBD'}
          </h3>
          <p className="text-sm text-stone-600 font-medium">
            {formattedTime || 'Time TBD'}
          </p>
          <p className="text-sm text-stone-500">
            {event.itineraryName?.trim() || event.groupName?.trim() || 'Untitled Event'}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-stone-300 flex-shrink-0" />
      </div>

      {/* Content - venue list */}
      <div className="p-4 bg-white">
        {venue ? (
          <div className="space-y-2">
            {/* First venue with address */}
            <a
              href={venueUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-stone-600 hover:text-stone-800 transition-colors group"
              onClick={(e) => {
                e.stopPropagation();
                if (!venueUrl) e.preventDefault();
              }}
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium group-hover:underline">
                  {venue.venueName}
                </p>
                {venue.venueAddress && (
                  <p className="text-xs text-stone-400">{venue.venueAddress}</p>
                )}
              </div>
              {venueUrl && (
                <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-40 group-hover:opacity-70 flex-shrink-0" />
              )}
            </a>
            {/* Additional venues */}
            {event.items.length > 1 && (
              <div className="ml-6 space-y-1">
                {event.items.slice(1).map((item, idx) => (
                  <p key={idx} className="text-sm text-stone-500">
                    • {item.venueName}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : event.isVirtual ? (
          <div className="flex items-center gap-2 text-stone-500">
            <MapPin className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-sm">Venue will be decided soon</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-stone-500">
            <MapPin className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-sm">Venue TBD</span>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowAttendees(true);
            }}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1.5 min-h-[44px] -my-2"
          >
            <Users className="h-4 w-4 text-stone-400" />
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {maybeCount > 0 && (
              <span className="text-amber-600"> · {maybeCount} maybe</span>
            )}
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}

        {onRsvpChange && !isPastEvent && (
          <RsvpDropdown
            currentRsvp={currentRsvp}
            onRsvpChange={onRsvpChange}
            accentColor={accentColor}
            disabled={isPastEvent}
            isLoading={isRsvpLoading}
          />
        )}

        {isPastEvent && currentRsvp && (
          <span className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium",
            currentRsvp === 'going' || currentRsvp === 'yes'
              ? "bg-emerald-100 text-emerald-700"
              : currentRsvp === 'maybe'
              ? "bg-amber-100 text-amber-700"
              : "bg-stone-100 text-stone-500"
          )}>
            {currentRsvp === 'going' || currentRsvp === 'yes' ? 'Attended' :
             currentRsvp === 'maybe' ? 'Maybe' : 'Declined'}
          </span>
        )}
      </div>

      {/* Attendee bottom sheet */}
      <AttendeeBottomSheet
        event={event}
        isOpen={showAttendees}
        onClose={() => setShowAttendees(false)}
      />
    </motion.div>
  );

  // Wrap with Link for navigation
  const linkHref = event.itineraryId
    ? `/event/${event.itineraryId}`
    : `/group/${event.groupId}`;

  return (
    <Link href={linkHref} className="block">
      {cardContent}
    </Link>
  );
}

export default EventCard;
