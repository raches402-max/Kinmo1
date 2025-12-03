import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sun, Sunset, Moon, Users, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const TIMES = ["morning", "afternoon", "evening"] as const;

type Day = typeof DAYS[number];
type TimeSlot = typeof TIMES[number];

type AvailabilityGrid = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

type MemberAvailability = {
  memberId: string;
  memberName: string;
  availability: AvailabilityGrid;
};

interface GroupAvailabilityHeatmapProps {
  /** All members' availability data */
  membersAvailability: MemberAvailability[];
  /** Current user's member ID */
  currentMemberId: string;
  /** Current user's availability (controlled) */
  myAvailability: AvailabilityGrid;
  /** Callback when user toggles their availability */
  onMyAvailabilityChange: (availability: AvailabilityGrid) => void;
  /** Optional: Show member names on hover */
  showMemberDetails?: boolean;
  /** Optional: Compact mode for smaller spaces */
  compact?: boolean;
}

const TIME_DETAILS: Record<TimeSlot, { icon: typeof Sun; label: string; shortLabel: string; range: string }> = {
  morning: { icon: Sun, label: "Morning", shortLabel: "AM", range: "6am–12pm" },
  afternoon: { icon: Sunset, label: "Afternoon", shortLabel: "PM", range: "12pm–6pm" },
  evening: { icon: Moon, label: "Evening", shortLabel: "Eve", range: "6pm–12am" },
};

const DAY_LABELS: Record<Day, { full: string; short: string }> = {
  Mon: { full: "Monday", short: "M" },
  Tue: { full: "Tuesday", short: "T" },
  Wed: { full: "Wednesday", short: "W" },
  Thu: { full: "Thursday", short: "T" },
  Fri: { full: "Friday", short: "F" },
  Sat: { full: "Saturday", short: "S" },
  Sun: { full: "Sunday", short: "S" },
};

export function GroupAvailabilityHeatmap({
  membersAvailability,
  currentMemberId,
  myAvailability,
  onMyAvailabilityChange,
  showMemberDetails = true,
  compact = false,
}: GroupAvailabilityHeatmapProps) {
  const isMobile = useIsMobile();
  const [hoveredCell, setHoveredCell] = useState<{ day: Day; time: TimeSlot } | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Optimistic local state for instant feedback
  const [optimisticAvailability, setOptimisticAvailability] = useState<AvailabilityGrid | null>(null);

  // Use optimistic state if available, otherwise use prop
  const effectiveMyAvailability = optimisticAvailability ?? myAvailability;

  const totalMembers = membersAvailability.length;

  // Find current user's member info for optimistic updates
  const currentUserMember = useMemo(() =>
    membersAvailability.find(m => m.memberId === currentMemberId),
    [membersAvailability, currentMemberId]
  );

  // Calculate aggregate availability for each cell
  // Uses optimistic availability for the current user for instant feedback
  const aggregateAvailability = useMemo(() => {
    const aggregate: Record<string, Record<TimeSlot, { count: number; members: string[] }>> = {};

    DAYS.forEach(day => {
      aggregate[day] = {
        morning: { count: 0, members: [] },
        afternoon: { count: 0, members: [] },
        evening: { count: 0, members: [] },
      };
    });

    membersAvailability.forEach(({ memberId, memberName, availability }) => {
      // For the current user, use optimistic availability instead of prop
      const effectiveAvail = memberId === currentMemberId
        ? effectiveMyAvailability
        : availability;

      DAYS.forEach(day => {
        TIMES.forEach(time => {
          if (effectiveAvail[day]?.[time]) {
            aggregate[day][time].count++;
            aggregate[day][time].members.push(memberName);
          }
        });
      });
    });

    return aggregate;
  }, [membersAvailability, currentMemberId, effectiveMyAvailability]);

  // Find the "sweet spots" - times when most/all members are available
  const sweetSpots = useMemo(() => {
    const spots: { day: Day; time: TimeSlot; count: number }[] = [];

    DAYS.forEach(day => {
      TIMES.forEach(time => {
        const count = aggregateAvailability[day][time].count;
        if (count === totalMembers && totalMembers > 0) {
          spots.push({ day, time, count });
        }
      });
    });

    return spots;
  }, [aggregateAvailability, totalMembers]);

  // Toggle user's availability for a slot - optimistic update for instant feedback
  const toggleMySlot = useCallback((day: Day, time: TimeSlot) => {
    const currentAvailability = optimisticAvailability ?? myAvailability;
    const newAvailability = {
      ...currentAvailability,
      [day]: {
        ...currentAvailability[day],
        [time]: !currentAvailability[day]?.[time],
      },
    };

    // Immediately update local state for instant feedback
    setOptimisticAvailability(newAvailability);

    // Then trigger the actual save (async, non-blocking)
    onMyAvailabilityChange(newAvailability);
  }, [myAvailability, optimisticAvailability, onMyAvailabilityChange]);

  // Sync optimistic state when prop changes (e.g., after successful save)
  // This clears optimistic state when the real data catches up
  useEffect(() => {
    if (optimisticAvailability !== null) {
      // Clear optimistic state after a short delay to allow prop to update
      const timer = setTimeout(() => {
        setOptimisticAvailability(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [myAvailability]);

  // Get color intensity based on member count
  const getCellStyle = (day: Day, time: TimeSlot) => {
    const { count } = aggregateAvailability[day][time];
    const ratio = totalMembers > 0 ? count / totalMembers : 0;
    const isMySlot = effectiveMyAvailability[day]?.[time];

    // Use primary color (gold) with varying opacity based on how many can make it
    // This creates a warm, inviting heatmap
    if (count === 0) {
      return {
        background: "hsl(var(--muted) / 0.3)",
        border: isMySlot ? "hsl(var(--primary) / 0.5)" : "transparent",
      };
    }

    // Calculate saturation and lightness based on ratio
    // More people = more saturated, slightly darker gold
    const baseHue = 44; // Gold hue
    const saturation = 60 + (ratio * 27); // 60-87%
    const lightness = 85 - (ratio * 25); // 85% -> 60% (gets richer with more people)
    const alpha = 0.3 + (ratio * 0.7); // 0.3 -> 1.0

    return {
      background: `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${alpha})`,
      border: isMySlot ? "hsl(var(--primary))" : count === totalMembers ? "hsl(var(--primary) / 0.3)" : "transparent",
    };
  };

  // Summary stats
  const myAvailableCount = DAYS.reduce((acc, day) => {
    return acc + TIMES.filter(time => effectiveMyAvailability[day]?.[time]).length;
  }, 0);

  // Mobile layout - single day view with swipe
  if (isMobile) {
    const selectedDay = DAYS[selectedDayIndex];

    return (
      <div className="space-y-4">
        {/* Header with summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{totalMembers} members</span>
          </div>
          {sweetSpots.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{sweetSpots.length} perfect {sweetSpots.length === 1 ? "time" : "times"}</span>
            </div>
          )}
        </div>

        {/* Day selector - horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {DAYS.map((day, idx) => {
            const dayAggregate = aggregateAvailability[day];
            const hasSweetSpot = TIMES.some(time => dayAggregate[time].count === totalMembers && totalMembers > 0);
            const maxCount = Math.max(...TIMES.map(time => dayAggregate[time].count));
            const ratio = totalMembers > 0 ? maxCount / totalMembers : 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDayIndex(idx)}
                className={cn(
                  "relative flex-1 min-w-[46px] h-12 rounded-xl text-sm font-semibold transition-all duration-200",
                  idx === selectedDayIndex
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="relative z-10">{day}</span>
                {/* Heat indicator dot */}
                {idx !== selectedDayIndex && maxCount > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 w-4 h-4 rounded-full text-2xs flex items-center justify-center font-bold",
                      hasSweetSpot
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/40 text-primary-foreground/80"
                    )}
                    style={{
                      opacity: 0.5 + (ratio * 0.5),
                    }}
                  >
                    {maxCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time slots for selected day */}
        <div className="space-y-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDay}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {TIMES.map(time => {
                const TimeIcon = TIME_DETAILS[time].icon;
                const { count, members } = aggregateAvailability[selectedDay][time];
                const isMySlot = effectiveMyAvailability[selectedDay]?.[time];
                const ratio = totalMembers > 0 ? count / totalMembers : 0;
                const isPerfect = count === totalMembers && totalMembers > 0;

                return (
                  <motion.button
                    key={time}
                    onClick={() => toggleMySlot(selectedDay, time)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                      isMySlot
                        ? "border-primary shadow-sm"
                        : "border-transparent hover:border-muted-foreground/10"
                    )}
                    style={{
                      background: count > 0
                        ? `linear-gradient(135deg, hsla(44, ${60 + ratio * 27}%, ${85 - ratio * 20}%, ${0.2 + ratio * 0.4}) 0%, hsla(44, ${60 + ratio * 27}%, ${80 - ratio * 15}%, ${0.1 + ratio * 0.2}) 100%)`
                        : "hsl(var(--muted) / 0.3)",
                    }}
                  >
                    {/* Time icon */}
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                      isPerfect ? "bg-primary/20" : "bg-background/60"
                    )}>
                      <TimeIcon className={cn(
                        "h-5 w-5",
                        isPerfect ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>

                    {/* Time info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{TIME_DETAILS[time].label}</span>
                        {isPerfect && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-2xs font-semibold">
                            <Sparkles className="h-2.5 w-2.5" />
                            Everyone
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {TIME_DETAILS[time].range}
                        {count > 0 && (
                          <span className="ml-2 text-foreground/70">
                            · {count} {count === 1 ? "person" : "people"} available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Availability indicator */}
                    <div className="flex flex-col items-center gap-1">
                      {/* Member count visualization */}
                      <div className="flex -space-x-1">
                        {Array.from({ length: Math.min(totalMembers, 5) }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 border-background transition-all",
                              i < count ? "bg-primary" : "bg-muted"
                            )}
                            style={{
                              opacity: i < count ? 1 : 0.3,
                            }}
                          />
                        ))}
                        {totalMembers > 5 && (
                          <div className="w-5 h-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                            +{totalMembers - 5}
                          </div>
                        )}
                      </div>
                      {/* My toggle indicator */}
                      <span className={cn(
                        "text-2xs font-medium transition-colors",
                        isMySlot ? "text-primary" : "text-muted-foreground"
                      )}>
                        {isMySlot ? "I'm in" : "Tap to join"}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-2 text-2xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/20" />
            <span>Few available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/60" />
            <span>Some</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Everyone</span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout - full grid heatmap
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Group Availability</h4>
            <p className="text-xs text-muted-foreground">
              {totalMembers} {totalMembers === 1 ? "member" : "members"} · Tap cells to update yours
            </p>
          </div>
        </div>
        {sweetSpots.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">
              {sweetSpots.length} time{sweetSpots.length !== 1 ? "s" : ""} work for everyone
            </span>
          </div>
        )}
      </div>

      {/* Heatmap grid - using CSS Grid for equal column widths */}
      <div className="space-y-1">
        {/* Header row with day labels */}
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}
        >
          {/* Empty corner cell */}
          <div />
          {/* Day headers */}
          {DAYS.map((day, idx) => {
            const isWeekend = idx >= 5;
            const hasSweetSpot = TIMES.some(
              time => aggregateAvailability[day][time].count === totalMembers && totalMembers > 0
            );

            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 rounded-lg",
                  isWeekend && "bg-muted/30"
                )}
              >
                <span className={cn(
                  "text-xs font-semibold",
                  hasSweetSpot ? "text-primary" : "text-muted-foreground"
                )}>
                  {day}
                </span>
                {hasSweetSpot && (
                  <Sparkles className="h-3 w-3 text-primary mt-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {TIMES.map(time => {
          const TimeIcon = TIME_DETAILS[time].icon;

          return (
            <div
              key={time}
              className="grid gap-1"
              style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}
            >
              {/* Time label */}
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                <TimeIcon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">{TIME_DETAILS[time].label}</span>
                <span className="sm:hidden">{TIME_DETAILS[time].shortLabel}</span>
              </div>

              {/* Day cells */}
              {DAYS.map((day, idx) => {
                const { count, members } = aggregateAvailability[day][time];
                const isMySlot = effectiveMyAvailability[day]?.[time];
                const isPerfect = count === totalMembers && totalMembers > 0;
                const isWeekend = idx >= 5;
                const isHovered = hoveredCell?.day === day && hoveredCell?.time === time;
                const cellStyle = getCellStyle(day, time);

                return (
                  <div
                    key={`${day}-${time}`}
                    className={cn("p-0.5", isWeekend && "bg-muted/30 rounded-lg")}
                  >
                    <button
                      onClick={() => toggleMySlot(day, time)}
                      onMouseEnter={() => setHoveredCell({ day, time })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={cn(
                        "relative w-full h-11 rounded-lg transition-all duration-150",
                        "flex items-center justify-center",
                        "border-2 active:scale-95 hover:scale-[1.02]",
                        isPerfect && "ring-2 ring-primary/20 ring-offset-1"
                      )}
                      style={{
                        background: cellStyle.background,
                        borderColor: cellStyle.border,
                      }}
                      aria-label={`${day} ${time}: ${count} of ${totalMembers} available${isMySlot ? " (you're available)" : ""}`}
                    >
                      {/* Count indicator */}
                      {count > 0 && (
                        <span className={cn(
                          "text-sm font-bold transition-colors",
                          isPerfect ? "text-primary-foreground" : "text-foreground/70"
                        )}>
                          {count}
                        </span>
                      )}

                      {/* Perfect time sparkle */}
                      {isPerfect && (
                        <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary" />
                      )}

                      {/* My availability indicator */}
                      {isMySlot && (
                        <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
                      )}

                      {/* Hover tooltip */}
                      <AnimatePresence>
                        {isHovered && showMemberDetails && count > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg min-w-[140px]"
                          >
                            <p className="text-xs font-semibold mb-1">
                              {DAY_LABELS[day].full} {TIME_DETAILS[time].label}
                            </p>
                            <p className="text-2xs text-muted-foreground mb-1.5">
                              {count} of {totalMembers} available
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {members.slice(0, 5).map((name, i) => (
                                <span
                                  key={i}
                                  className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-2xs font-medium"
                                >
                                  {name.split(" ")[0]}
                                </span>
                              ))}
                              {members.length > 5 && (
                                <span className="text-2xs text-muted-foreground">
                                  +{members.length - 5} more
                                </span>
                              )}
                            </div>
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                              <div className="border-8 border-transparent border-t-popover" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer with legend and summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {/* Legend */}
        <div className="flex items-center gap-3 text-2xs text-muted-foreground">
          <span className="font-medium">Availability:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-muted/50" />
            <span>None</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "hsla(44, 70%, 75%, 0.5)" }} />
            <span>Some</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "hsla(44, 87%, 63%, 1)" }} />
            <span>Everyone</span>
          </div>
        </div>

        {/* User's availability count */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">You're available:</span>
          <span className="font-semibold text-primary">{myAvailableCount} of 21 slots</span>
        </div>
      </div>
    </div>
  );
}

// Helper to create empty availability grid
export function createEmptyAvailability(): AvailabilityGrid {
  const grid: AvailabilityGrid = {};
  DAYS.forEach(day => {
    grid[day] = {
      morning: false,
      afternoon: false,
      evening: false,
    };
  });
  return grid;
}
