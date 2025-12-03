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
  /** Optional: Mobile display mode - 'single-day' shows one day at a time, 'compact-week' shows entire week in tiny grid */
  mobileMode?: 'single-day' | 'compact-week';
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
  mobileMode = 'single-day',
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

  // Get heat background color based on availability ratio (amber tones)
  const getHeatBg = (count: number) => {
    const ratio = totalMembers > 0 ? count / totalMembers : 0;
    if (ratio === 0) return "bg-gray-100";
    if (ratio <= 0.2) return "bg-amber-50";
    if (ratio <= 0.4) return "bg-amber-100";
    if (ratio <= 0.6) return "bg-amber-200";
    if (ratio <= 0.8) return "bg-amber-300";
    return "bg-amber-400";
  };

  // Get text color - white with progressive opacity (more visible at higher availability)
  const getHeatText = (count: number) => {
    const ratio = totalMembers > 0 ? count / totalMembers : 0;
    if (ratio <= 0.2) return "text-white/20";
    if (ratio <= 0.4) return "text-white/30";
    if (ratio <= 0.6) return "text-white/50";
    if (ratio <= 0.8) return "text-white/70";
    return "text-white/90";
  };

  // Summary stats
  const myAvailableCount = DAYS.reduce((acc, day) => {
    return acc + TIMES.filter(time => effectiveMyAvailability[day]?.[time]).length;
  }, 0);

  // Mobile layout - compact week view (shows all 7 days in a tiny grid)
  if (isMobile && mobileMode === 'compact-week') {
    return (
      <div className="space-y-3 -mx-2">
        {/* Compact header */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{totalMembers} members</span>
          </div>
          {sweetSpots.length > 0 && (
            <div className="flex items-center gap-1 text-2xs text-primary font-medium">
              <Sparkles className="h-3 w-3" />
              <span>{sweetSpots.length} perfect</span>
            </div>
          )}
        </div>

        {/* Compact full-week grid - edge to edge */}
        <div className="space-y-1.5">
          {/* Day headers */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
            <div /> {/* Empty corner */}
            {DAYS.map((day) => (
              <div key={day} className="text-center">
                <span className="text-xs font-semibold text-muted-foreground">
                  {DAY_LABELS[day].short}
                </span>
              </div>
            ))}
          </div>

          {/* Time rows */}
          {TIMES.map(time => {
            const TimeIcon = TIME_DETAILS[time].icon;

            return (
              <div
                key={time}
                className="grid gap-1.5"
                style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}
              >
                {/* Time icon */}
                <div className="flex items-center justify-center">
                  <TimeIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Day cells */}
                {DAYS.map((day) => {
                  const { count } = aggregateAvailability[day][time];
                  const isMySlot = effectiveMyAvailability[day]?.[time];

                  return (
                    <button
                      key={`${day}-${time}`}
                      onClick={() => toggleMySlot(day, time)}
                      className={cn(
                        "h-12 rounded-xl transition-all duration-150 active:scale-95",
                        "flex items-center justify-center",
                        getHeatBg(count),
                        isMySlot
                          ? "ring-2 ring-violet-500 ring-inset"
                          : ""
                      )}
                      aria-label={`${day} ${time}: ${count} of ${totalMembers} available`}
                    >
                      <span className={cn(
                        "text-sm font-bold",
                        getHeatText(count)
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Compact legend */}
        <div className="flex items-center justify-center gap-4 text-2xs text-muted-foreground pt-1 px-2">
          <div className="flex items-center gap-1.5">
            <span>Heat:</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
              <div className="w-3 h-3 rounded bg-amber-200" />
              <div className="w-3 h-3 rounded bg-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span>You:</span>
            <div className="w-3 h-3 rounded bg-amber-200 ring-2 ring-violet-500 ring-inset" />
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout - single day view with swipe (default mobile behavior)
  if (isMobile && mobileMode === 'single-day') {
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
                const { count } = aggregateAvailability[selectedDay][time];
                const isMySlot = effectiveMyAvailability[selectedDay]?.[time];

                return (
                  <motion.button
                    key={time}
                    onClick={() => toggleMySlot(selectedDay, time)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200",
                      getHeatBg(count),
                      // Violet ring when personally selected
                      isMySlot
                        ? "ring-[3px] ring-violet-500 ring-inset shadow-sm"
                        : "hover:ring-2 hover:ring-violet-300 hover:ring-inset"
                    )}
                  >
                    {/* Time icon */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/40">
                      <TimeIcon className="h-5 w-5 text-amber-700" />
                    </div>

                    {/* Time info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-amber-900">{TIME_DETAILS[time].label}</span>
                      </div>
                      <div className="text-xs text-amber-700/70 mt-0.5">
                        {TIME_DETAILS[time].range}
                      </div>
                    </div>

                    {/* Count indicator */}
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-2xl font-bold",
                        getHeatText(count)
                      )}>
                        {count}
                      </span>
                      <span className="text-2xs text-amber-700/60">
                        /{totalMembers}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-2xs pt-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>Group:</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded bg-gray-100 border" />
              <div className="w-3 h-3 rounded bg-amber-200" />
              <div className="w-3 h-3 rounded bg-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>You:</span>
            <div className="w-3 h-3 rounded bg-amber-200 ring-2 ring-violet-500 ring-inset" />
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
                const isWeekend = idx >= 5;
                const isHovered = hoveredCell?.day === day && hoveredCell?.time === time;

                return (
                  <div
                    key={`${day}-${time}`}
                    className={cn("p-0.5", isWeekend && "bg-muted/20 rounded-lg")}
                  >
                    <button
                      onClick={() => toggleMySlot(day, time)}
                      onMouseEnter={() => setHoveredCell({ day, time })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={cn(
                        "relative w-full h-12 rounded-xl transition-all duration-150",
                        "flex items-center justify-center",
                        "active:scale-90",
                        getHeatBg(count),
                        // Violet ring when personally selected
                        isMySlot
                          ? "ring-[3px] ring-violet-500 ring-inset shadow-sm"
                          : "hover:ring-2 hover:ring-violet-300 hover:ring-inset"
                      )}
                      aria-label={`${day} ${time}: ${count} of ${totalMembers} available${isMySlot ? " (you're available)" : ""}`}
                    >
                      {/* Count indicator - white with progressive opacity */}
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        getHeatText(count)
                      )}>
                        {count}
                      </span>

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

      {/* Footer with legend */}
      <div className="flex items-center justify-between text-2xs pt-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>Group:</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded bg-gray-100 border" />
            <div className="w-4 h-4 rounded bg-amber-100" />
            <div className="w-4 h-4 rounded bg-amber-200" />
            <div className="w-4 h-4 rounded bg-amber-300" />
            <div className="w-4 h-4 rounded bg-amber-400" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>You:</span>
          <div className="w-4 h-4 rounded bg-amber-200 ring-2 ring-violet-500 ring-inset" />
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
