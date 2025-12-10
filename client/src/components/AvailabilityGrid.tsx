import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sun, Sunset, Moon, Check } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
type AvailabilityGrid = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

interface AvailabilityGridProps {
  value: AvailabilityGrid;
  onChange: (value: AvailabilityGrid) => void;
}

export function AvailabilityGrid({ value, onChange }: AvailabilityGridProps) {
  const isMobile = useIsMobile();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const toggleSlot = (day: string, time: TimeSlot) => {
    const newValue = {
      ...value,
      [day]: {
        ...value[day],
        [time]: !value[day]?.[time]
      }
    };
    onChange(newValue);
  };

  const toggleDay = (day: string) => {
    const allSelected = TIMES.every(time => value[day]?.[time]);
    const newValue = {
      ...value,
      [day]: {
        morning: !allSelected,
        afternoon: !allSelected,
        evening: !allSelected
      }
    };
    onChange(newValue);
  };

  const toggleTime = (time: TimeSlot) => {
    const allSelected = DAYS.every(day => value[day]?.[time]);
    const newValue = { ...value };
    DAYS.forEach(day => {
      newValue[day] = {
        ...newValue[day],
        [time]: !allSelected
      };
    });
    onChange(newValue);
  };

  // Count total available slots
  const totalAvailable = DAYS.reduce((acc, day) => {
    return acc + TIMES.filter(time => value[day]?.[time]).length;
  }, 0);

  // Mobile: One day at a time with tab navigation
  if (isMobile) {
    const selectedDay = DAYS[selectedDayIndex];
    const dayAvailable = TIMES.filter(time => value[selectedDay]?.[time]).length;

    return (
      <div className="space-y-4">
        {/* Summary badge */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalAvailable} of 21 slots available
          </span>
          <span className={cn(
            "font-medium",
            totalAvailable === 0 ? "text-destructive" : "text-primary"
          )}>
            {dayAvailable}/3 for {selectedDay}
          </span>
        </div>

        {/* Day selector tabs - pill style */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {DAYS.map((day, idx) => {
            const isWeekend = idx >= 5;
            const daySlots = TIMES.filter(time => value[day]?.[time]).length;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDayIndex(idx)}
                className={cn(
                  "relative flex-1 min-w-[48px] h-11 rounded-xl text-sm font-semibold transition-all duration-200",
                  idx === selectedDayIndex
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : cn(
                        "text-muted-foreground hover:bg-muted",
                        isWeekend ? "bg-muted/60" : "bg-muted/40"
                      )
                )}
                data-testid={`mobile-day-tab-${day.toLowerCase()}`}
              >
                {day}
                {daySlots > 0 && idx !== selectedDayIndex && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-2xs text-primary-foreground flex items-center justify-center">
                    {daySlots}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time slots for selected day */}
        <div className="space-y-2">
          {TIMES.map(time => {
            const TimeIcon = TIME_DETAILS[time].icon;
            const isSelected = value[selectedDay]?.[time];
            return (
              <button
                key={time}
                type="button"
                onClick={() => toggleSlot(selectedDay, time)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-muted/30 border-transparent hover:border-muted-foreground/20 hover:bg-muted/50"
                )}
                data-testid={`mobile-cell-${selectedDay.toLowerCase()}-${time}`}
                aria-label={`${selectedDay} ${time}`}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  isSelected ? "bg-primary/20" : "bg-muted"
                )}>
                  <TimeIcon className={cn("h-5 w-5", isSelected ? "text-primary" : TIME_DETAILS[time].color)} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{TIME_LABELS[time]}</div>
                  <div className="text-xs text-muted-foreground">{TIME_DETAILS[time].label}</div>
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

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleDay(selectedDay)}
            className="flex-1"
            data-testid={`mobile-toggle-day-${selectedDay.toLowerCase()}`}
          >
            {dayAvailable === 3 ? "Clear" : "Select All"} {selectedDay}
          </Button>
        </div>
      </div>
    );
  }

  // Desktop: Compact 7×3 grid optimized for modal display
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {totalAvailable} of 21 time slots selected
      </div>

      {/* Grid container - uses CSS Grid for precise column control */}
      <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1">
        {/* Header row: empty corner + day labels */}
        <div className="h-8" /> {/* Empty corner cell */}
        {DAYS.map((day, idx) => {
          const isWeekend = idx >= 5;
          const daySlots = TIMES.filter(time => value[day]?.[time]).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "h-8 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center",
                "hover:bg-muted/80",
                isWeekend ? "bg-muted/40" : "bg-transparent",
                daySlots === 3 && "text-primary"
              )}
              data-testid={`button-toggle-day-${day.toLowerCase()}`}
            >
              <span>{day}</span>
              {daySlots > 0 && (
                <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Time rows */}
        {TIMES.map(time => {
          const TimeIcon = TIME_DETAILS[time].icon;
          const timeSlots = DAYS.filter(day => value[day]?.[time]).length;
          return (
            <Fragment key={time}>
              {/* Time label button */}
              <button
                type="button"
                onClick={() => toggleTime(time)}
                className={cn(
                  "h-12 pr-2 flex items-center gap-1.5 text-xs font-medium transition-all rounded-md hover:bg-muted/50",
                  timeSlots === 7 && "text-primary"
                )}
                data-testid={`button-toggle-time-${time}`}
              >
                <TimeIcon className={cn("h-4 w-4 flex-shrink-0", TIME_DETAILS[time].color)} />
                <span className="truncate">{TIME_LABELS[time]}</span>
              </button>

              {/* Day cells for this time */}
              {DAYS.map((day, idx) => {
                const isSelected = value[day]?.[time];
                const isWeekend = idx >= 5;
                return (
                  <button
                    key={`${day}-${time}`}
                    type="button"
                    onClick={() => toggleSlot(day, time)}
                    className={cn(
                      "h-12 rounded-lg border-2 transition-all duration-150 flex items-center justify-center",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : cn(
                            "border-transparent hover:border-primary/30",
                            isWeekend ? "bg-muted/50 hover:bg-muted/70" : "bg-muted/25 hover:bg-muted/40"
                          )
                    )}
                    data-testid={`cell-${day.toLowerCase()}-${time}`}
                    aria-label={`${day} ${time}`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Click cells to toggle. Click day or time headers to select entire rows/columns.
      </p>
    </div>
  );
}

export function createEmptyAvailability(): AvailabilityGrid {
  const grid: AvailabilityGrid = {};
  DAYS.forEach(day => {
    grid[day] = {
      morning: false,
      afternoon: false,
      evening: false
    };
  });
  return grid;
}
