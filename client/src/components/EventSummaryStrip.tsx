import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { formatVenueTypeForDisplay } from "@/lib/event-utils";
import {
  Users,
  MapPin,
  Calendar,
  ChevronDown,
  Search,
  Star,
  Sparkles,
  CalendarPlus,
  Vote,
  PenLine,
  Plus,
} from "lucide-react";

// Types
interface GroupInfo {
  id: string;
  name: string;
  emoji: string;
  memberCount?: number;
}

interface VenueInfo {
  name: string;
  type: string;
}

interface RsvpSummary {
  yes: number;
  maybe: number;
  pending: number;
}

export interface EventSummaryStripProps {
  // WHO (required for v1, future: supports multiple groups)
  groups: GroupInfo[];
  rsvpSummary?: RsvpSummary;

  // WHERE (optional - TBD state)
  venues: VenueInfo[];

  // WHEN (optional - TBD state)
  eventDate: string | null;
  eventTime?: string;
  timezone?: string;

  // Note (optional)
  occasionNote?: string;

  // Behavior
  expandable?: boolean;
  defaultExpanded?: boolean;
  editable?: boolean;
  onChangeGroups?: () => void;
  onAddVenue?: () => void;
  onSearchVenue?: () => void;
  onFavoritesVenue?: () => void;
  onAiPickVenue?: () => void;
  onChangeDate?: () => void;
  onLetGroupVote?: () => void;
  onEditNote?: (note: string) => void;

  // Display mode
  variant?: "full" | "compact" | "inline";

  // Style
  className?: string;
}

// Helper to format venue display
function formatVenues(venues: VenueInfo[]): string {
  if (venues.length === 0) return "TBD";
  if (venues.length === 1) return venues[0].name;
  return `${venues[0].name} + ${venues.length - 1}`;
}

// Helper to format date display
function formatEventDate(
  date: string | null,
  timezone?: string,
  style: "short" | "full" = "short"
): string {
  if (!date) return "TBD";
  try {
    const d = new Date(date);
    if (style === "short") {
      return timezone
        ? formatInTimeZone(d, timezone, "EEE MMM d")
        : format(d, "EEE MMM d");
    }
    return timezone
      ? formatInTimeZone(d, timezone, "EEEE, MMMM d • h:mm a")
      : format(d, "EEEE, MMMM d • h:mm a");
  } catch {
    return "TBD";
  }
}

// Helper for relative date
function getRelativeDate(date: string | null, timezone?: string): string | null {
  if (!date) return null;
  try {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 14) return "Next week";
    if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
    return `In ${Math.ceil(diffDays / 30)} month${Math.ceil(diffDays / 30) > 1 ? 's' : ''}`;
  } catch {
    return null;
  }
}

// Collapsed summary line component
function CollapsedSummary({
  groups,
  venues,
  eventDate,
  timezone,
  isExpanded,
  expandable,
  onClick,
}: {
  groups: GroupInfo[];
  venues: VenueInfo[];
  eventDate: string | null;
  timezone?: string;
  isExpanded: boolean;
  expandable: boolean;
  onClick: () => void;
}) {
  const groupDisplay = groups.length > 0
    ? `${groups[0].emoji} ${groups[0].name}${groups.length > 1 ? ` +${groups.length - 1}` : ''}`
    : "Select group";

  const venueDisplay = formatVenues(venues);
  const dateDisplay = formatEventDate(eventDate, timezone, "short");

  const hasTbd = venues.length === 0 || !eventDate;

  return (
    <button
      onClick={onClick}
      disabled={!expandable}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-3 rounded-2xl transition-all duration-300",
        "bg-gradient-to-r from-card via-card to-card/80",
        "border border-border/50 hover:border-border",
        "shadow-sm hover:shadow-md",
        expandable && "cursor-pointer active:scale-[0.99]",
        !expandable && "cursor-default",
        hasTbd && "border-dashed border-amber-300/50"
      )}
      style={{
        boxShadow: hasTbd
          ? "0 2px 12px -4px rgba(251, 191, 36, 0.15)"
          : "0 2px 12px -4px rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* WHO */}
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[100px]">{groupDisplay}</span>
      </span>

      <span className="text-muted-foreground/40">•</span>

      {/* WHERE */}
      <span className={cn(
        "flex items-center gap-1.5 text-sm",
        venues.length === 0 ? "text-amber-600 font-medium" : "font-medium"
      )}>
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[100px]">{venueDisplay}</span>
      </span>

      <span className="text-muted-foreground/40">•</span>

      {/* WHEN */}
      <span className={cn(
        "flex items-center gap-1.5 text-sm",
        !eventDate ? "text-amber-600 font-medium" : "font-medium"
      )}>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[80px]">{dateDisplay}</span>
      </span>

      {/* Expand indicator */}
      {expandable && (
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="ml-auto"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      )}
    </button>
  );
}

// Section card for expanded view
function SectionCard({
  icon: Icon,
  label,
  isTbd,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  isTbd?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-3 transition-all",
        isTbd
          ? "border-2 border-dashed border-amber-300/40 bg-amber-50/30 dark:bg-amber-950/10"
          : "border border-border/50 bg-card/50",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn(
          "h-4 w-4",
          isTbd ? "text-amber-500" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isTbd ? "text-amber-600" : "text-muted-foreground"
        )}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// TBD Action button
function TbdAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-8 gap-1.5 text-xs font-medium border-amber-200 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:border-amber-700 dark:hover:bg-amber-950/30"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

// Main component
export function EventSummaryStrip({
  groups,
  rsvpSummary,
  venues,
  eventDate,
  timezone,
  occasionNote,
  expandable = true,
  defaultExpanded = false,
  editable = true,
  onChangeGroups,
  onAddVenue,
  onSearchVenue,
  onFavoritesVenue,
  onAiPickVenue,
  onChangeDate,
  onLetGroupVote,
  onEditNote,
  variant = "full",
  className,
}: EventSummaryStripProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Inline variant - just the one-liner, no expansion
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground" />
          {groups[0]?.emoji} {groups[0]?.name || "TBD"}
        </span>
        <span className="text-muted-foreground/40">•</span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {formatVenues(venues)}
        </span>
        <span className="text-muted-foreground/40">•</span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {formatEventDate(eventDate, timezone, "short")}
        </span>
      </div>
    );
  }

  // Compact variant - smaller, less padding
  if (variant === "compact") {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-card/50 p-2", className)}>
        <CollapsedSummary
          groups={groups}
          venues={venues}
          eventDate={eventDate}
          timezone={timezone}
          isExpanded={false}
          expandable={false}
          onClick={() => {}}
        />
      </div>
    );
  }

  // Full variant with expand/collapse
  const relativeDate = getRelativeDate(eventDate, timezone);

  return (
    <div className={cn("space-y-0", className)}>
      {/* Collapsed strip */}
      <CollapsedSummary
        groups={groups}
        venues={venues}
        eventDate={eventDate}
        timezone={timezone}
        isExpanded={isExpanded}
        expandable={expandable}
        onClick={() => expandable && setIsExpanded(!isExpanded)}
      />

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {/* WHO Section */}
              <SectionCard icon={Users} label="Who">
                <div className="flex items-center justify-between">
                  <div>
                    {groups.map((group, i) => (
                      <div key={group.id} className="flex items-center gap-2">
                        <span className="text-lg">{group.emoji}</span>
                        <span className="font-medium">{group.name}</span>
                        {group.memberCount && (
                          <span className="text-xs text-muted-foreground">
                            {group.memberCount} members
                          </span>
                        )}
                      </div>
                    ))}
                    {rsvpSummary && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {rsvpSummary.yes} going
                        {rsvpSummary.maybe > 0 && ` • ${rsvpSummary.maybe} maybe`}
                        {rsvpSummary.pending > 0 && ` • ${rsvpSummary.pending} pending`}
                      </div>
                    )}
                  </div>
                  {editable && onChangeGroups && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onChangeGroups}
                      className="h-8 text-xs"
                    >
                      Change
                    </Button>
                  )}
                </div>
              </SectionCard>

              {/* WHERE Section */}
              <SectionCard icon={MapPin} label="Where" isTbd={venues.length === 0}>
                {venues.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No venues yet - where should you meet?
                    </p>
                    {editable && (
                      <div className="flex flex-wrap gap-2">
                        {onSearchVenue && (
                          <TbdAction icon={Search} label="Search" onClick={onSearchVenue} />
                        )}
                        {onFavoritesVenue && (
                          <TbdAction icon={Star} label="Places" onClick={onFavoritesVenue} />
                        )}
                        {onAiPickVenue && (
                          <TbdAction icon={Sparkles} label="AI Pick" onClick={onAiPickVenue} />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {venues.map((venue, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium">
                          {i + 1}
                        </span>
                        <span className="font-medium">{venue.name}</span>
                        {formatVenueTypeForDisplay(venue.type) && (
                          <span className="text-xs text-muted-foreground">{formatVenueTypeForDisplay(venue.type)}</span>
                        )}
                      </div>
                    ))}
                    {editable && onAddVenue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddVenue}
                        className="h-7 text-xs gap-1 mt-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Stop
                      </Button>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* WHEN Section */}
              <SectionCard icon={Calendar} label="When" isTbd={!eventDate}>
                {!eventDate ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Date not set yet - when works best?
                    </p>
                    {editable && (
                      <div className="flex flex-wrap gap-2">
                        {onChangeDate && (
                          <TbdAction icon={CalendarPlus} label="Pick Date" onClick={onChangeDate} />
                        )}
                        {onLetGroupVote && (
                          <TbdAction icon={Vote} label="Let Group Vote" onClick={onLetGroupVote} />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {formatEventDate(eventDate, timezone, "full")}
                      </div>
                      {relativeDate && (
                        <div className="text-xs text-muted-foreground">{relativeDate}</div>
                      )}
                    </div>
                    {editable && onChangeDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onChangeDate}
                        className="h-8 text-xs"
                      >
                        Change
                      </Button>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Note Section (optional) */}
              <SectionCard icon={PenLine} label="Note (optional)">
                {occasionNote ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{occasionNote}</span>
                    {editable && onEditNote && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditNote(occasionNote)}
                        className="h-8 text-xs"
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground italic">
                      Add a note about this gathering...
                    </span>
                    {editable && onEditNote && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditNote("")}
                        className="h-8 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EventSummaryStrip;
