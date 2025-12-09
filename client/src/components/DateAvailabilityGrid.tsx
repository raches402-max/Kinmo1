import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sun, Sunset, Moon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { format, eachDayOfInterval, isWeekend, isToday, startOfWeek, addDays } from "date-fns";

const TIMES = ["morning", "afternoon", "evening"] as const;
const TIME_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening"
};
const TIME_DETAILS = {
  morning: { icon: Sun, label: "6am - 12pm", color: "text-amber-500" },
  afternoon: { icon: Sunset, label: "12pm - 6pm", color: "text-orange-500" },
  evening: { icon: Moon, label: "6pm - 12am", color: "text-indigo-500" }
};

type TimeSlot = typeof TIMES[number];

// Date-specific availability format: { "2025-01-15": { morning: true, afternoon: false, evening: true } }
export type DateSpecificAvailability = Record<string, {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}>;

// Aggregated availability for heatmap display: { "2025-01-15": { morning: 3, afternoon: 5, evening: 4 } }
export type AggregatedAvailability = Record<string, {
  morning: number;
  afternoon: number;
  evening: number;
}>;

interface DateAvailabilityGridProps {
  startDate: Date;
  endDate: Date;
  value: DateSpecificAvailability;
  onChange: (value: DateSpecificAvailability) => void;
  // Optional: show aggregated group data as heatmap background
  groupData?: AggregatedAvailability;
  totalMembers?: number;
  readOnly?: boolean;
}

export function DateAvailabilityGrid({
  startDate,
  endDate,
  value,
  onChange,
  groupData,
  totalMembers = 1,
  readOnly = false
}: DateAvailabilityGridProps) {
  const isMobile = useIsMobile();

  // Generate all dates in the range
  const allDates = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Group dates by week (starting Monday)
  const weekGroups = useMemo(() => {
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let lastWeekStart: Date | null = null;

    for (const date of allDates) {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      if (!lastWeekStart || weekStart.getTime() !== lastWeekStart.getTime()) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
        }
        currentWeek = [];
        lastWeekStart = weekStart;
      }
      currentWeek.push(date);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  }, [allDates]);

  // Mobile: show one week at a time
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  const toggleSlot = (dateKey: string, time: TimeSlot) => {
    if (readOnly) return;
    const newValue = {
      ...value,
      [dateKey]: {
        morning: value[dateKey]?.morning || false,
        afternoon: value[dateKey]?.afternoon || false,
        evening: value[dateKey]?.evening || false,
        [time]: !value[dateKey]?.[time]
      }
    };
    onChange(newValue);
  };

  const toggleDate = (dateKey: string) => {
    if (readOnly) return;
    const allSelected = TIMES.every(time => value[dateKey]?.[time]);
    const newValue = {
      ...value,
      [dateKey]: {
        morning: !allSelected,
        afternoon: !allSelected,
        evening: !allSelected
      }
    };
    onChange(newValue);
  };

  // Count total available slots
  const totalAvailable = allDates.reduce((acc, date) => {
    const dateKey = formatDateKey(date);
    return acc + TIMES.filter(time => value[dateKey]?.[time]).length;
  }, 0);

  // Get heat intensity for a slot (0-1)
  const getHeatIntensity = (dateKey: string, time: TimeSlot): number => {
    if (!groupData || !groupData[dateKey] || totalMembers <= 1) return 0;
    return groupData[dateKey][time] / totalMembers;
  };

  // Mobile: One week at a time with navigation
  if (isMobile) {
    const currentWeek = weekGroups[currentWeekIndex] || [];
    const selectedDate = currentWeek[selectedDateIndex] || currentWeek[0];
    const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : '';
    const dayAvailable = selectedDate ? TIMES.filter(time => value[selectedDateKey]?.[time]).length : 0;

    return (
      <div className="space-y-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1));
              setSelectedDateIndex(0);
            }}
            disabled={currentWeekIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-sm font-medium">
            Week {currentWeekIndex + 1} of {weekGroups.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentWeekIndex(Math.min(weekGroups.length - 1, currentWeekIndex + 1));
              setSelectedDateIndex(0);
            }}
            disabled={currentWeekIndex === weekGroups.length - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Summary badge */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalAvailable} of {allDates.length * 3} slots available
          </span>
          <span className={cn(
            "font-medium",
            totalAvailable === 0 ? "text-destructive" : "text-primary"
          )}>
            {dayAvailable}/3 for {selectedDate ? format(selectedDate, 'MMM d') : ''}
          </span>
        </div>

        {/* Date selector tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {currentWeek.map((date, idx) => {
            const dateKey = formatDateKey(date);
            const isWeekendDay = isWeekend(date);
            const isTodayDate = isToday(date);
            const daySlots = TIMES.filter(time => value[dateKey]?.[time]).length;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDateIndex(idx)}
                className={cn(
                  "relative flex-1 min-w-[52px] py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center",
                  idx === selectedDateIndex
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : cn(
                        "text-muted-foreground hover:bg-muted",
                        isWeekendDay ? "bg-muted/60" : "bg-muted/40"
                      ),
                  isTodayDate && idx !== selectedDateIndex && "ring-2 ring-primary/50"
                )}
              >
                <span className="text-2xs opacity-70">{format(date, 'EEE')}</span>
                <span>{format(date, 'd')}</span>
                {daySlots > 0 && idx !== selectedDateIndex && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-2xs text-primary-foreground flex items-center justify-center">
                    {daySlots}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time slots for selected date */}
        {selectedDate && (
          <div className="space-y-2">
            {TIMES.map(time => {
              const TimeIcon = TIME_DETAILS[time].icon;
              const isSelected = value[selectedDateKey]?.[time];
              const heatIntensity = getHeatIntensity(selectedDateKey, time);
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => toggleSlot(selectedDateKey, time)}
                  disabled={readOnly}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                    isSelected
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-muted/30 border-transparent hover:border-muted-foreground/20 hover:bg-muted/50",
                    readOnly && "cursor-not-allowed opacity-60"
                  )}
                  style={heatIntensity > 0 && !isSelected ? {
                    backgroundColor: `rgba(34, 197, 94, ${heatIntensity * 0.2})`
                  } : undefined}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}>
                    <TimeIcon className={cn("h-5 w-5", isSelected ? "text-primary" : TIME_DETAILS[time].color)} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{TIME_LABELS[time]}</div>
                    <div className="text-xs text-muted-foreground">
                      {TIME_DETAILS[time].label}
                      {heatIntensity > 0 && groupData && (
                        <span className="ml-2 text-green-600">
                          ({groupData[selectedDateKey]?.[time] || 0} available)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick actions */}
        {!readOnly && selectedDate && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleDate(selectedDateKey)}
              className="flex-1"
            >
              {dayAvailable === 3 ? "Clear" : "Select All"} {format(selectedDate, 'MMM d')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Desktop: Full grid with weeks as sections
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">
          {totalAvailable} of {allDates.length * 3} time slots selected
        </span>
        {groupData && (
          <span className="text-muted-foreground text-xs">
            Green = others available
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        {weekGroups.map((week, weekIdx) => (
          <div key={weekIdx} className="mb-6">
            {/* Week header */}
            <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
              {format(week[0], 'MMM d')} - {format(week[week.length - 1], 'MMM d, yyyy')}
            </div>

            <div className="inline-block min-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-sm font-medium text-muted-foreground w-24"></th>
                    {week.map((date) => {
                      const dateKey = formatDateKey(date);
                      const isWeekendDay = isWeekend(date);
                      const isTodayDate = isToday(date);
                      const daySlots = TIMES.filter(time => value[dateKey]?.[time]).length;
                      return (
                        <th key={dateKey} className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => !readOnly && toggleDate(dateKey)}
                            disabled={readOnly}
                            className={cn(
                              "w-full h-auto py-1 text-xs font-semibold transition-all flex flex-col items-center gap-0",
                              isWeekendDay && "bg-muted/50",
                              isTodayDate && "ring-2 ring-primary",
                              daySlots === 3 && "text-primary"
                            )}
                          >
                            <span className="text-2xs opacity-60">{format(date, 'EEE')}</span>
                            <span>{format(date, 'd')}</span>
                            {daySlots > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
                            )}
                          </Button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TIMES.map(time => {
                    const TimeIcon = TIME_DETAILS[time].icon;
                    return (
                      <tr key={time}>
                        <td className="p-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium px-2 h-10">
                            <TimeIcon className={cn("h-4 w-4", TIME_DETAILS[time].color)} />
                            <span className="hidden sm:inline">{TIME_LABELS[time]}</span>
                            <span className="sm:hidden">{TIME_LABELS[time].slice(0, 3)}</span>
                          </div>
                        </td>
                        {week.map((date) => {
                          const dateKey = formatDateKey(date);
                          const isSelected = value[dateKey]?.[time];
                          const isWeekendDay = isWeekend(date);
                          const heatIntensity = getHeatIntensity(dateKey, time);
                          return (
                            <td key={`${dateKey}-${time}`} className="p-1">
                              <button
                                type="button"
                                onClick={() => toggleSlot(dateKey, time)}
                                disabled={readOnly}
                                className={cn(
                                  "w-full h-11 rounded-lg border-2 transition-all duration-200 flex items-center justify-center",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                    : cn(
                                        "border-transparent hover:border-muted-foreground/20",
                                        isWeekendDay ? "bg-muted/60 hover:bg-muted" : "bg-muted/30 hover:bg-muted/50"
                                      ),
                                  readOnly && "cursor-not-allowed"
                                )}
                                style={heatIntensity > 0 && !isSelected ? {
                                  backgroundColor: `rgba(34, 197, 94, ${heatIntensity * 0.3})`
                                } : undefined}
                              >
                                {isSelected && <Check className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <p className="text-xs text-muted-foreground text-center">
          Click cells to toggle availability. Click date headers to select/clear all times for that day.
        </p>
      )}
    </div>
  );
}

// Helper to create empty availability for a date range
export function createEmptyDateAvailability(startDate: Date, endDate: Date): DateSpecificAvailability {
  const grid: DateSpecificAvailability = {};
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  dates.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    grid[dateKey] = {
      morning: false,
      afternoon: false,
      evening: false
    };
  });
  return grid;
}

// Helper to create fully available for a date range
export function createFullDateAvailability(startDate: Date, endDate: Date): DateSpecificAvailability {
  const grid: DateSpecificAvailability = {};
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  dates.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    grid[dateKey] = {
      morning: true,
      afternoon: true,
      evening: true
    };
  });
  return grid;
}
