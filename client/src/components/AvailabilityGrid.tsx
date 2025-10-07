import { useState } from "react";
import { Button } from "@/components/ui/button";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["morning", "afternoon", "evening"] as const;
const TIME_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon", 
  evening: "Evening"
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

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-muted-foreground w-24"></th>
                {DAYS.map(day => (
                  <th key={day} className="p-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDay(day)}
                      className="w-full text-xs font-medium hover-elevate"
                      data-testid={`button-toggle-day-${day.toLowerCase()}`}
                    >
                      {day}
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map(time => (
                <tr key={time}>
                  <td className="p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTime(time)}
                      className="w-full justify-start text-xs font-medium hover-elevate"
                      data-testid={`button-toggle-time-${time}`}
                    >
                      {TIME_LABELS[time]}
                    </Button>
                  </td>
                  {DAYS.map(day => (
                    <td key={`${day}-${time}`} className="p-1">
                      <button
                        type="button"
                        onClick={() => toggleSlot(day, time)}
                        className={`
                          w-full h-10 rounded-md border transition-colors
                          ${value[day]?.[time] 
                            ? 'bg-primary border-primary text-primary-foreground' 
                            : 'bg-background border-border hover-elevate'
                          }
                        `}
                        data-testid={`cell-${day.toLowerCase()}-${time}`}
                        aria-label={`${day} ${time}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Click cells to toggle availability. Click day/time headers to toggle entire rows/columns.
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
