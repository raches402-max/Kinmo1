import { MapPin, Star, ExternalLink, Clock, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
  rating: string | null;
  googlePlaceId: string | null;
  googleMapsUrl: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  travelNotes?: string | null;
  notes?: string | null;
};

type ItineraryTimelineProps = {
  items: TimelineItem[];
  className?: string;
};

function formatTime(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return format(date, "h:mm a");
  } catch {
    return null;
  }
}

export function ItineraryTimeline({ items, className }: ItineraryTimelineProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={cn("space-y-0", className)}>
      {items.map((item, idx) => {
        const arrivalTime = formatTime(item.arrivalTime);
        const isLast = idx === items.length - 1;
        const nextItem = !isLast ? items[idx + 1] : null;
        const nextArrivalTime = nextItem ? formatTime(nextItem.arrivalTime) : null;

        return (
          <div key={item.id} className="relative">
            {/* Venue Card */}
            <div
              className="relative"
              data-testid={`venue-${item.id}`}
            >
              {/* Timeline connector line (left side) */}
              {!isLast && (
                <div
                  className="absolute left-4 top-[3.5rem] bottom-0 w-0.5 bg-gradient-to-b from-[hsl(44,87%,63%)] to-[hsl(44,70%,75%)]"
                  style={{ height: 'calc(100% + 1rem)' }}
                />
              )}

              {/* Time Badge - only show if arrival time exists */}
              {arrivalTime && (
                <div className="flex items-center gap-2 mb-2 ml-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(44,87%,63%)]/20 border border-[hsl(44,87%,63%)]/30">
                    <Clock className="h-3 w-3 text-[hsl(44,70%,40%)]" />
                    <span className="text-sm font-semibold text-[hsl(25,30%,20%)]">
                      {arrivalTime}
                    </span>
                  </div>
                </div>
              )}

              {/* Main Venue Card */}
              <div className="flex gap-3 p-3 rounded-xl bg-[hsl(35,40%,95%)] border border-[hsl(44,70%,75%)]/50 relative">
                {/* Number Circle with Timeline Dot */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(44,87%,63%)]/30 flex items-center justify-center text-sm font-bold text-[hsl(25,30%,14%)] relative z-10 border-2 border-[hsl(38,50%,98%)]">
                  {idx + 1}
                </div>

                {/* Venue Details */}
                <div className="flex-1 min-w-0">
                  <a
                    href={item.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.venueName} ${item.venueAddress}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[hsl(25,30%,14%)] hover:underline inline-flex items-center gap-1"
                  >
                    {item.venueName}
                    <ExternalLink className="h-3 w-3 text-[hsl(25,15%,55%)]" />
                  </a>
                  <div className="text-sm text-[hsl(25,20%,40%)]">{item.venueType}</div>

                  {item.venueAddress && (
                    <div className="text-xs text-[hsl(25,20%,40%)] flex items-start gap-1 mt-1">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-[hsl(44,87%,63%)]" />
                      <span className="break-words whitespace-normal leading-relaxed">{item.venueAddress}</span>
                    </div>
                  )}

                  {item.rating && (
                    <div className="text-xs text-[hsl(25,20%,40%)] mt-1 flex items-center gap-1">
                      <Star className="h-3 w-3 text-[hsl(44,87%,63%)] fill-[hsl(44,87%,63%)]" />
                      <span>{item.rating}</span>
                    </div>
                  )}

                  {/* Venue Notes */}
                  {item.notes && (
                    <div className="mt-2 text-sm text-[hsl(25,25%,35%)] italic bg-[hsl(44,50%,92%)]/50 rounded-lg px-3 py-2 border-l-2 border-[hsl(44,87%,63%)]">
                      "{item.notes}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Travel Notes Connector - between venues */}
            {!isLast && (
              <div className="relative py-3 pl-4">
                {/* Connector content */}
                <div className="ml-6 flex items-center gap-2">
                  {item.travelNotes ? (
                    // Custom travel note
                    <div className="flex items-center gap-2 text-sm text-[hsl(25,20%,45%)] italic">
                      <ArrowDown className="h-3.5 w-3.5 text-[hsl(44,70%,55%)] flex-shrink-0" />
                      <span className="bg-[hsl(44,60%,95%)] px-3 py-1.5 rounded-full border border-[hsl(44,70%,80%)] border-dashed">
                        {item.travelNotes}
                      </span>
                    </div>
                  ) : (
                    // Default connector with time gap if both times exist
                    <div className="flex items-center gap-2 text-xs text-[hsl(25,15%,55%)]">
                      <ArrowDown className="h-3.5 w-3.5 text-[hsl(44,70%,70%)]" />
                      {arrivalTime && nextArrivalTime && (
                        <span className="text-[hsl(25,15%,60%)]">then</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
