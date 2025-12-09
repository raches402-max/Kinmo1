import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Star,
  Edit2,
  Clock,
  ArrowUpDown,
  MessageSquare,
  Trash2,
  Plus,
  ExternalLink,
  Navigation,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventAccordionSection } from "./EventAccordionSection";
import type { EventVenue } from "./types";

interface TimelineVenueCardProps {
  venue: EventVenue;
  index: number;
  totalCount: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isOrganizer: boolean;
  onEditTime?: () => void;
  onSwapVenue?: () => void;
  onEditNotes?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  distanceToNext?: string | null;
}

function TimelineVenueCard({
  venue,
  index,
  totalCount,
  isLast,
  isExpanded,
  onToggle,
  isOrganizer,
  onEditTime,
  onSwapVenue,
  onEditNotes,
  onRemove,
  onMoveUp,
  onMoveDown,
  distanceToNext,
}: TimelineVenueCardProps) {
  const isFirst = index === 0;
  const canReorder = totalCount > 1;
  // Use venue name + place ID when available (matches desktop pattern)
  const mapsUrl = venue.googlePlaceId && venue.venueName
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName)}&query_place_id=${venue.googlePlaceId}`
    : venue.address
    ? `https://maps.google.com/?q=${encodeURIComponent(venue.address)}`
    : venue.latitude && venue.longitude
    ? `https://maps.google.com/?q=${venue.latitude},${venue.longitude}`
    : null;

  return (
    <div className="relative min-w-0">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[3px] top-4 bottom-0 w-0.5 bg-border" />
      )}

      <div className="flex items-start gap-3 min-w-0">
        {/* Timeline dot */}
        <div className="relative z-10 flex flex-col items-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
        </div>

        {/* Content */}
        <div className="flex-1 pb-5 min-w-0 overflow-hidden">
          {/* Time label */}
          {venue.arrivalTime && (
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              {venue.arrivalTime}
            </div>
          )}

          <div
            className={cn(
              "rounded-xl border transition-all overflow-hidden",
              isExpanded
                ? "border-primary bg-primary/5"
                : "border-card-border bg-card"
            )}
          >
            {/* Main content - always visible */}
            <div className="p-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">{venue.venueName}</h4>
                    {venue.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {venue.rating}
                      </span>
                    )}
                  </div>
                  {venue.venueType && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {venue.venueType}
                    </div>
                  )}
                </div>
                {isOrganizer && (
                  <button
                    onClick={onToggle}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isExpanded
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Address with Google Maps link */}
              {venue.address && mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors group"
                >
                  <Navigation className="h-3 w-3 shrink-0" />
                  <span className="truncate">{venue.address}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 shrink-0" />
                </a>
              )}

              {/* Note if exists */}
              {venue.notes && (
                <div className="mt-2 text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-2 py-1.5">
                  "{venue.notes}"
                </div>
              )}
            </div>

            {/* Expanded edit options */}
            <AnimatePresence>
              {isExpanded && isOrganizer && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 pt-2 border-t border-border">
                    {/* Mobile-optimized compact action row */}
                    <div className="flex items-center gap-2">
                      {/* Reorder arrows - only show when multiple venues */}
                      {canReorder && (
                        <div className="flex items-center gap-0.5 mr-1">
                          <button
                            className={cn(
                              "flex items-center justify-center h-8 w-7 rounded-md transition-all",
                              isFirst
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-primary border border-primary/30 hover:bg-primary/10 active:scale-[0.95]"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isFirst) onMoveUp?.();
                            }}
                            disabled={isFirst}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            className={cn(
                              "flex items-center justify-center h-8 w-7 rounded-md transition-all",
                              isLast
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-primary border border-primary/30 hover:bg-primary/10 active:scale-[0.95]"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isLast) onMoveDown?.();
                            }}
                            disabled={isLast}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <button
                        className="flex-1 flex items-center justify-center gap-1 h-8 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTime?.();
                        }}
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Time</span>
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1 h-8 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapVenue?.();
                        }}
                      >
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                        <span>Swap</span>
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1 h-8 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditNotes?.();
                        }}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        <span>Note</span>
                      </button>
                      <button
                        className="flex items-center justify-center h-8 w-8 rounded-md border border-destructive/20 text-destructive/70 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 active:scale-[0.98] transition-all shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove?.();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Distance to next venue */}
          {distanceToNext && (
            <div className="flex items-center gap-2 mt-2 ml-1 text-xs text-muted-foreground">
              <span className="w-px h-3 bg-border" />
              <span>{distanceToNext} to next stop</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface WhereSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  venues: EventVenue[];
  isOrganizer: boolean;
  onAddVenue?: () => void;
  onEditVenue?: (venue: EventVenue) => void;
  onRemoveVenue?: (venue: EventVenue) => void;
  onMoveVenue?: (fromIndex: number, toIndex: number) => void;
}

// Helper function to validate venue has minimum location data
function hasLocationData(venue: EventVenue): boolean {
  return !!(venue.address || (venue.latitude && venue.longitude));
}

// Helper function to build multi-venue Google Maps URL
function buildMultiVenueMapUrl(venues: EventVenue[]): string | null {
  const validVenues = venues.filter(v => v.venueName || v.address || (v.latitude && v.longitude));
  if (validVenues.length === 0) return null;

  // For a single venue, use place ID format like desktop does
  if (validVenues.length === 1) {
    const venue = validVenues[0];
    // Prefer venue name + place ID (most precise)
    if (venue.googlePlaceId && venue.venueName) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName)}&query_place_id=${venue.googlePlaceId}`;
    }
    // Fallback to venue name, then address, then coordinates
    const query = encodeURIComponent(venue.venueName || venue.address || `${venue.latitude},${venue.longitude}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // For multiple venues, use venue names in directions URL
  const locations = validVenues
    .map(v => encodeURIComponent(v.venueName || v.address || ''))
    .filter(loc => loc);

  return locations.length > 0 ? `https://www.google.com/maps/dir/${locations.join('/')}` : null;
}

export function WhereSection({
  isExpanded,
  onToggle,
  venues,
  isOrganizer,
  onAddVenue,
  onEditVenue,
  onRemoveVenue,
  onMoveVenue,
}: WhereSectionProps) {
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const hasVenues = venues.length > 0;

  // Generate Google Maps search URL to display all venues with markers
  const allVenuesMapUrl = buildMultiVenueMapUrl(venues);

  return (
    <EventAccordionSection
      icon={MapPin}
      title="Where"
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={
        hasVenues ? (
          <span className="text-2xs text-muted-foreground ml-2">
            {venues.length} {venues.length === 1 ? "stop" : "stops"}
          </span>
        ) : null
      }
    >
      {!hasVenues ? (
        // Empty state
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">No stops planned yet</p>
          {isOrganizer && (
            <Button size="sm" className="gap-2" onClick={onAddVenue}>
              <Plus className="h-4 w-4" />
              Add a venue
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4 min-w-0 overflow-hidden">
          {/* Venue timeline */}
          <div className="space-y-0 min-w-0">
            {venues.map((venue, index) => (
              <TimelineVenueCard
                key={venue.id}
                venue={venue}
                index={index}
                totalCount={venues.length}
                isLast={index === venues.length - 1}
                isExpanded={expandedVenueId === venue.id}
                onToggle={() => {
                  if (isOrganizer) {
                    setExpandedVenueId(
                      expandedVenueId === venue.id ? null : venue.id
                    );
                  }
                }}
                isOrganizer={isOrganizer}
                onEditTime={() => onEditVenue?.(venue)}
                onSwapVenue={() => onEditVenue?.(venue)}
                onEditNotes={() => onEditVenue?.(venue)}
                onRemove={() => onRemoveVenue?.(venue)}
                onMoveUp={() => onMoveVenue?.(index, index - 1)}
                onMoveDown={() => onMoveVenue?.(index, index + 1)}
                distanceToNext={index < venues.length - 1 ? null : null} // TODO: calculate distance
              />
            ))}

            {/* Add stop button */}
            {isOrganizer && (
              <div className="flex items-center gap-3 pt-2">
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center">
                  <Plus className="h-3 w-3 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/5"
                  onClick={onAddVenue}
                >
                  Add another stop
                </Button>
              </div>
            )}
          </div>

          {/* Subtle "view in maps" link - extremely low profile */}
          {allVenuesMapUrl && venues.length > 1 && (
            <a
              href={allVenuesMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-1"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              <span>View route in Maps</span>
            </a>
          )}
        </div>
      )}
    </EventAccordionSection>
  );
}
