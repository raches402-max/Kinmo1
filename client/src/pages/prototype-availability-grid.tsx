/**
 * Prototype: Mobile Availability Grid
 * Full 7x3 grid adapted for mobile with larger touch targets
 *
 * Design Direction: Warm & Tactile
 * - Full week visible at once (no day-by-day stepping)
 * - Generous touch targets (minimum 44px)
 * - Visual feedback on selection
 * - Quick actions for bulk selection
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sun, Sunset, Moon, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["morning", "afternoon", "evening"] as const;
type TimeSlot = typeof TIMES[number];

const TIME_CONFIG = {
  morning: { icon: Sun, label: "AM", fullLabel: "Morning", color: "text-amber-500", bgSelected: "bg-amber-500" },
  afternoon: { icon: Sunset, label: "PM", fullLabel: "Afternoon", color: "text-orange-500", bgSelected: "bg-orange-500" },
  evening: { icon: Moon, label: "Eve", fullLabel: "Evening", color: "text-indigo-500", bgSelected: "bg-indigo-500" }
};

type AvailabilityData = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

function createEmptyAvailability(): AvailabilityData {
  const grid: AvailabilityData = {};
  DAYS.forEach(day => {
    grid[day] = { morning: false, afternoon: false, evening: false };
  });
  return grid;
}

// ============================================
// DESIGN OPTION A: Compact Grid with Color Coding
// ============================================
function AvailabilityGridOptionA({ value, onChange }: { value: AvailabilityData; onChange: (v: AvailabilityData) => void }) {
  const toggleSlot = (day: string, time: TimeSlot) => {
    onChange({
      ...value,
      [day]: { ...value[day], [time]: !value[day]?.[time] }
    });
  };

  const toggleDay = (day: string) => {
    const allSelected = TIMES.every(time => value[day]?.[time]);
    onChange({
      ...value,
      [day]: { morning: !allSelected, afternoon: !allSelected, evening: !allSelected }
    });
  };

  const toggleTime = (time: TimeSlot) => {
    const allSelected = DAYS.every(day => value[day]?.[time]);
    const newValue = { ...value };
    DAYS.forEach(day => {
      newValue[day] = { ...newValue[day], [time]: !allSelected };
    });
    onChange(newValue);
  };

  const totalSelected = DAYS.reduce((acc, day) =>
    acc + TIMES.filter(time => value[day]?.[time]).length, 0);

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {totalSelected} of 21 slots selected
        </span>
        <button
          type="button"
          onClick={() => {
            const newValue: AvailabilityData = {};
            const shouldSelectAll = totalSelected < 21;
            DAYS.forEach(day => {
              newValue[day] = { morning: shouldSelectAll, afternoon: shouldSelectAll, evening: shouldSelectAll };
            });
            onChange(newValue);
          }}
          className="text-xs text-primary font-medium"
        >
          {totalSelected === 21 ? "Clear all" : "Select all"}
        </button>
      </div>

      {/* Grid */}
      <div className="bg-muted/30 rounded-2xl p-3">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="h-8" /> {/* Empty corner */}
          {DAYS.map((day, idx) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all active:scale-95",
                idx >= 5 ? "bg-muted/80 text-muted-foreground" : "text-foreground",
                TIMES.every(t => value[day]?.[t]) && "text-primary"
              )}
            >
              {day.charAt(0)}
            </button>
          ))}
        </div>

        {/* Time rows */}
        {TIMES.map(time => {
          const TimeIcon = TIME_CONFIG[time].icon;
          const allSelected = DAYS.every(day => value[day]?.[time]);

          return (
            <div key={time} className="grid grid-cols-8 gap-1 mb-1">
              {/* Time label */}
              <button
                type="button"
                onClick={() => toggleTime(time)}
                className={cn(
                  "h-12 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95",
                  allSelected ? "text-primary" : "text-muted-foreground"
                )}
              >
                <TimeIcon className={cn("h-4 w-4", TIME_CONFIG[time].color)} />
                <span className="text-2xs font-medium mt-0.5">{TIME_CONFIG[time].label}</span>
              </button>

              {/* Day cells */}
              {DAYS.map((day, idx) => {
                const isSelected = value[day]?.[time];
                const isWeekend = idx >= 5;

                return (
                  <button
                    key={`${day}-${time}`}
                    type="button"
                    onClick={() => toggleSlot(day, time)}
                    className={cn(
                      "h-12 rounded-xl transition-all duration-150 flex items-center justify-center active:scale-90",
                      isSelected
                        ? cn(TIME_CONFIG[time].bgSelected, "text-white shadow-md")
                        : cn(
                            "border-2 border-transparent",
                            isWeekend ? "bg-muted/60" : "bg-background",
                            "hover:border-muted-foreground/20"
                          )
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-2xs text-center text-muted-foreground">
        Tap cells to toggle. Tap headers to select entire rows/columns.
      </p>
    </div>
  );
}

// ============================================
// DESIGN OPTION B: Larger Cells with Unified Color
// ============================================
function AvailabilityGridOptionB({ value, onChange }: { value: AvailabilityData; onChange: (v: AvailabilityData) => void }) {
  const toggleSlot = (day: string, time: TimeSlot) => {
    onChange({
      ...value,
      [day]: { ...value[day], [time]: !value[day]?.[time] }
    });
  };

  const toggleDay = (day: string) => {
    const allSelected = TIMES.every(time => value[day]?.[time]);
    onChange({
      ...value,
      [day]: { morning: !allSelected, afternoon: !allSelected, evening: !allSelected }
    });
  };

  const toggleTime = (time: TimeSlot) => {
    const allSelected = DAYS.every(day => value[day]?.[time]);
    const newValue = { ...value };
    DAYS.forEach(day => {
      newValue[day] = { ...newValue[day], [time]: !allSelected };
    });
    onChange(newValue);
  };

  const totalSelected = DAYS.reduce((acc, day) =>
    acc + TIMES.filter(time => value[day]?.[time]).length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold">{totalSelected}</span>
          <span className="text-sm text-muted-foreground"> / 21 available</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const newValue: AvailabilityData = {};
            const shouldSelectAll = totalSelected < 21;
            DAYS.forEach(day => {
              newValue[day] = { morning: shouldSelectAll, afternoon: shouldSelectAll, evening: shouldSelectAll };
            });
            onChange(newValue);
          }}
          className="text-xs"
        >
          {totalSelected === 21 ? "Clear" : "All"}
        </Button>
      </div>

      {/* Scrollable grid container */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[340px]">
          {/* Day headers */}
          <div className="flex mb-2">
            <div className="w-14 flex-shrink-0" /> {/* Spacer for time labels */}
            <div className="flex-1 grid grid-cols-7 gap-1.5">
              {DAYS.map((day, idx) => {
                const daySelected = TIMES.filter(t => value[day]?.[t]).length;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-10 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all active:scale-95",
                      idx >= 5 ? "bg-muted" : "bg-muted/50",
                      daySelected === 3 && "ring-2 ring-primary ring-offset-1"
                    )}
                  >
                    <span>{day}</span>
                    {daySelected > 0 && daySelected < 3 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {[...Array(daySelected)].map((_, i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time rows */}
          {TIMES.map(time => {
            const TimeIcon = TIME_CONFIG[time].icon;
            const timeSelected = DAYS.filter(day => value[day]?.[time]).length;

            return (
              <div key={time} className="flex mb-1.5">
                {/* Time label */}
                <button
                  type="button"
                  onClick={() => toggleTime(time)}
                  className={cn(
                    "w-14 flex-shrink-0 h-14 rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 mr-1.5",
                    timeSelected === 7 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                >
                  <TimeIcon className={cn("h-5 w-5", TIME_CONFIG[time].color)} />
                  <span className="text-2xs font-semibold mt-1">{TIME_CONFIG[time].label}</span>
                </button>

                {/* Day cells */}
                <div className="flex-1 grid grid-cols-7 gap-1.5">
                  {DAYS.map((day, idx) => {
                    const isSelected = value[day]?.[time];
                    const isWeekend = idx >= 5;

                    return (
                      <button
                        key={`${day}-${time}`}
                        type="button"
                        onClick={() => toggleSlot(day, time)}
                        className={cn(
                          "h-14 rounded-xl transition-all duration-150 flex items-center justify-center active:scale-90",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : cn(
                                "border-2",
                                isWeekend
                                  ? "bg-muted/80 border-transparent"
                                  : "bg-background border-muted hover:border-primary/30"
                              )
                        )}
                      >
                        {isSelected && <Check className="h-5 w-5 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// DESIGN OPTION C: Stacked Rows (Most Compact)
// ============================================
function AvailabilityGridOptionC({ value, onChange }: { value: AvailabilityData; onChange: (v: AvailabilityData) => void }) {
  const toggleSlot = (day: string, time: TimeSlot) => {
    onChange({
      ...value,
      [day]: { ...value[day], [time]: !value[day]?.[time] }
    });
  };

  const toggleTime = (time: TimeSlot) => {
    const allSelected = DAYS.every(day => value[day]?.[time]);
    const newValue = { ...value };
    DAYS.forEach(day => {
      newValue[day] = { ...newValue[day], [time]: !allSelected };
    });
    onChange(newValue);
  };

  const totalSelected = DAYS.reduce((acc, day) =>
    acc + TIMES.filter(time => value[day]?.[time]).length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">
          <span className="text-primary font-bold">{totalSelected}</span> slots available
        </span>
      </div>

      {/* Time-based rows */}
      <div className="space-y-3">
        {TIMES.map(time => {
          const TimeIcon = TIME_CONFIG[time].icon;
          const timeSelected = DAYS.filter(day => value[day]?.[time]).length;

          return (
            <div key={time} className="bg-muted/30 rounded-2xl p-3">
              {/* Row header */}
              <button
                type="button"
                onClick={() => toggleTime(time)}
                className="w-full flex items-center justify-between mb-3 active:opacity-70"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    timeSelected === 7 ? "bg-primary/20" : "bg-muted"
                  )}>
                    <TimeIcon className={cn("h-4 w-4", TIME_CONFIG[time].color)} />
                  </div>
                  <span className="font-semibold text-sm">{TIME_CONFIG[time].fullLabel}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {timeSelected}/7 days
                </span>
              </button>

              {/* Day buttons */}
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((day, idx) => {
                  const isSelected = value[day]?.[time];
                  const isWeekend = idx >= 5;

                  return (
                    <button
                      key={`${day}-${time}`}
                      type="button"
                      onClick={() => toggleSlot(day, time)}
                      className={cn(
                        "h-11 rounded-xl transition-all duration-150 flex flex-col items-center justify-center active:scale-90 text-xs font-medium",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : cn(
                              isWeekend ? "bg-muted/80" : "bg-background",
                              "text-muted-foreground hover:text-foreground"
                            )
                      )}
                    >
                      <span>{day.charAt(0)}</span>
                      {isSelected && <Check className="h-3 w-3 mt-0.5 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// DESIGN OPTION D: Group Heatmap (Read-only aggregated view)
// ============================================
type GroupHeatmapData = {
  [day: string]: {
    [time in TimeSlot]: number; // 0-5 representing how many people are available
  };
};

// Mock group data - represents OTHER members' availability (not including you)
// In a 5-person group, this is 4 other members' aggregated availability
// Your selection adds +1 to these counts
const MOCK_GROUP_HEATMAP: GroupHeatmapData = {
  Mon: { morning: 1, afternoon: 3, evening: 3 },
  Tue: { morning: 0, afternoon: 2, evening: 3 },
  Wed: { morning: 1, afternoon: 1, evening: 4 },
  Thu: { morning: 2, afternoon: 3, evening: 4 },
  Fri: { morning: 1, afternoon: 4, evening: 4 },
  Sat: { morning: 3, afternoon: 4, evening: 3 },
  Sun: { morning: 3, afternoon: 3, evening: 2 },
};

const MEMBER_NAMES = ["You", "Sarah", "Mike", "Emma", "Alex"];

function GroupAvailabilityHeatmap({ data, totalMembers = 5 }: { data: GroupHeatmapData; totalMembers?: number }) {
  // Find the best slots (highest availability)
  const bestSlots: { day: string; time: TimeSlot; count: number }[] = [];
  DAYS.forEach(day => {
    TIMES.forEach(time => {
      if (data[day]?.[time] >= totalMembers - 1) {
        bestSlots.push({ day, time, count: data[day][time] });
      }
    });
  });
  bestSlots.sort((a, b) => b.count - a.count);

  // Get heat color based on availability ratio
  const getHeatColor = (count: number) => {
    const ratio = count / totalMembers;
    if (ratio === 0) return "bg-muted/40 text-muted-foreground/50";
    if (ratio <= 0.2) return "bg-primary/10 text-primary/40";
    if (ratio <= 0.4) return "bg-primary/25 text-primary/60";
    if (ratio <= 0.6) return "bg-primary/50 text-primary-foreground/80";
    if (ratio <= 0.8) return "bg-primary/75 text-primary-foreground";
    return "bg-primary text-primary-foreground shadow-md";
  };

  const getHeatBorder = (count: number) => {
    const ratio = count / totalMembers;
    if (ratio >= 0.8) return "ring-2 ring-primary ring-offset-1";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Header with group info */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Group availability</span>
          <span className="text-xs text-muted-foreground ml-2">({totalMembers} members)</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-muted/30 rounded-2xl p-3">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="h-8" /> {/* Empty corner */}
          {DAYS.map((day, idx) => {
            // Calculate total availability for this day
            const dayTotal = TIMES.reduce((sum, time) => sum + (data[day]?.[time] || 0), 0);
            const dayMax = totalMembers * 3;
            const dayRatio = dayTotal / dayMax;

            return (
              <div
                key={day}
                className={cn(
                  "h-8 rounded-lg text-xs font-bold flex items-center justify-center",
                  idx >= 5 ? "bg-muted/60" : "",
                  dayRatio >= 0.7 && "text-primary"
                )}
              >
                {day.charAt(0)}
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {TIMES.map(time => {
          const TimeIcon = TIME_CONFIG[time].icon;
          const timeTotal = DAYS.reduce((sum, day) => sum + (data[day]?.[time] || 0), 0);
          const timeMax = totalMembers * 7;

          return (
            <div key={time} className="grid grid-cols-8 gap-1 mb-1">
              {/* Time label */}
              <div className="h-12 rounded-lg flex flex-col items-center justify-center">
                <TimeIcon className={cn("h-4 w-4", TIME_CONFIG[time].color)} />
                <span className="text-2xs font-medium mt-0.5 text-muted-foreground">{TIME_CONFIG[time].label}</span>
              </div>

              {/* Day cells with heat intensity */}
              {DAYS.map((day, idx) => {
                const count = data[day]?.[time] || 0;
                const isWeekend = idx >= 5;

                return (
                  <div
                    key={`${day}-${time}`}
                    className={cn(
                      "h-12 rounded-xl transition-all duration-150 flex flex-col items-center justify-center",
                      getHeatColor(count),
                      getHeatBorder(count)
                    )}
                  >
                    <span className="text-sm font-bold">{count}</span>
                    <span className="text-2xs opacity-70">/{totalMembers}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 text-2xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-4 rounded bg-muted/40" />
          <div className="w-4 h-4 rounded bg-primary/20" />
          <div className="w-4 h-4 rounded bg-primary/40" />
          <div className="w-4 h-4 rounded bg-primary/60" />
          <div className="w-4 h-4 rounded bg-primary" />
        </div>
        <span>More</span>
      </div>

      {/* Best times suggestion */}
      {bestSlots.length > 0 && (
        <div className="bg-primary/10 rounded-xl p-3">
          <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Best times ({bestSlots[0].count}/{totalMembers} available)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bestSlots.slice(0, 4).map(({ day, time, count }) => (
              <span
                key={`${day}-${time}`}
                className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-medium"
              >
                {day} {TIME_CONFIG[time].label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Member avatars */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {MEMBER_NAMES.map((name, i) => (
            <div
              key={name}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold border-2 border-background"
              title={name}
            >
              {name.charAt(0)}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{totalMembers} members</span>
      </div>
    </div>
  );
}

// ============================================
// DESIGN OPTION E: Combined Heatmap + Personal Selection
// Group heatmap in warm tones, personal selection outlined in accent color
// ============================================
function CombinedAvailabilityGrid({
  groupData,
  personalData,
  onPersonalChange,
  totalMembers = 5
}: {
  groupData: GroupHeatmapData;
  personalData: AvailabilityData;
  onPersonalChange: (v: AvailabilityData) => void;
  totalMembers?: number;
}) {
  const toggleSlot = (day: string, time: TimeSlot) => {
    onPersonalChange({
      ...personalData,
      [day]: { ...personalData[day], [time]: !personalData[day]?.[time] }
    });
  };

  const toggleDay = (day: string) => {
    const allSelected = TIMES.every(time => personalData[day]?.[time]);
    onPersonalChange({
      ...personalData,
      [day]: { morning: !allSelected, afternoon: !allSelected, evening: !allSelected }
    });
  };

  const toggleTime = (time: TimeSlot) => {
    const allSelected = DAYS.every(day => personalData[day]?.[time]);
    const newValue = { ...personalData };
    DAYS.forEach(day => {
      newValue[day] = { ...newValue[day], [time]: !allSelected };
    });
    onPersonalChange(newValue);
  };

  // Get heat color based on group availability (warm yellow/gold tones)
  const getHeatBg = (count: number) => {
    const ratio = count / totalMembers;
    if (ratio === 0) return "bg-gray-100";
    if (ratio <= 0.2) return "bg-amber-50";
    if (ratio <= 0.4) return "bg-amber-100";
    if (ratio <= 0.6) return "bg-amber-200";
    if (ratio <= 0.8) return "bg-amber-300";
    return "bg-amber-400";
  };

  const getHeatText = (count: number) => {
    const ratio = count / totalMembers;
    // White text - more visible on darker (higher availability) backgrounds
    if (ratio <= 0.2) return "text-white/20";
    if (ratio <= 0.4) return "text-white/30";
    if (ratio <= 0.6) return "text-white/50";
    if (ratio <= 0.8) return "text-white/70";
    return "text-white/90";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">General availability</span>
          <span className="text-xs text-muted-foreground ml-1">({totalMembers} members)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-violet-500 bg-violet-500/20" />
          <span className="text-xs text-muted-foreground">You</span>
        </div>
      </div>

      {/* Combined Grid */}
      <div className="bg-muted/30 rounded-2xl p-3">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="h-8" />
          {DAYS.map((day, idx) => {
            const personalDayCount = TIMES.filter(t => personalData[day]?.[t]).length;
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  "h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all active:scale-95",
                  idx >= 5 ? "bg-muted/60" : "",
                  personalDayCount === 3 && "text-violet-600"
                )}
              >
                {day.charAt(0)}
              </button>
            );
          })}
        </div>

        {/* Time rows */}
        {TIMES.map(time => {
          const TimeIcon = TIME_CONFIG[time].icon;
          const personalTimeCount = DAYS.filter(day => personalData[day]?.[time]).length;

          return (
            <div key={time} className="grid grid-cols-8 gap-1 mb-1">
              {/* Time label */}
              <button
                type="button"
                onClick={() => toggleTime(time)}
                className={cn(
                  "h-12 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95",
                  personalTimeCount === 7 ? "text-violet-600" : "text-muted-foreground"
                )}
              >
                <TimeIcon className={cn("h-4 w-4", TIME_CONFIG[time].color)} />
                <span className="text-2xs font-medium mt-0.5">{TIME_CONFIG[time].label}</span>
              </button>

              {/* Day cells - heatmap + personal selection */}
              {DAYS.map((day) => {
                const othersCount = groupData[day]?.[time] || 0;
                const isPersonalSelected = personalData[day]?.[time];
                // Total count = others + you (if selected)
                const totalCount = othersCount + (isPersonalSelected ? 1 : 0);

                return (
                  <button
                    key={`${day}-${time}`}
                    type="button"
                    onClick={() => toggleSlot(day, time)}
                    className={cn(
                      "h-12 rounded-xl transition-all duration-150 flex flex-col items-center justify-center active:scale-90",
                      getHeatBg(totalCount),
                      // Purple outline when personally selected
                      isPersonalSelected
                        ? "ring-[3px] ring-violet-500 ring-inset shadow-sm"
                        : "hover:ring-2 hover:ring-violet-300 hover:ring-inset"
                    )}
                  >
                    <span className={cn("text-xs font-bold", getHeatText(totalCount))}>
                      {totalCount}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Dual Legend */}
      <div className="flex items-center justify-between text-2xs">
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

      {/* Member avatars */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {MEMBER_NAMES.map((name, i) => (
            <div
              key={name}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-background",
                i === 0 ? "bg-violet-500 text-white" : "bg-muted"
              )}
              title={name}
            >
              {name.charAt(0)}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{totalMembers} members</span>
      </div>
    </div>
  );
}

// ============================================
// MOBILE DEVICE FRAME COMPONENT
// ============================================
function MobileFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-semibold mb-3 text-center">{label}</div>
      <div className="relative">
        {/* Phone frame */}
        <div className="w-[375px] h-[700px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
          {/* Screen bezel */}
          <div className="w-full h-full bg-background rounded-[2.25rem] overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-50" />
            {/* Screen content */}
            <div className="w-full h-full overflow-y-auto pt-8">
              {children}
            </div>
            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PROTOTYPE PAGE
// ============================================
export default function PrototypeAvailabilityGrid() {
  const [valueA, setValueA] = useState(createEmptyAvailability());
  const [valueB, setValueB] = useState(createEmptyAvailability());
  const [valueC, setValueC] = useState(createEmptyAvailability());
  const [valueE, setValueE] = useState(createEmptyAvailability());

  // Pre-populate some values for demo
  useState(() => {
    const preset: AvailabilityData = {
      Mon: { morning: false, afternoon: true, evening: true },
      Tue: { morning: false, afternoon: true, evening: true },
      Wed: { morning: false, afternoon: false, evening: true },
      Thu: { morning: false, afternoon: true, evening: true },
      Fri: { morning: false, afternoon: true, evening: true },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: true, afternoon: true, evening: false },
    };
    setValueA(preset);
    setValueB(preset);
    setValueC(preset);
    setValueE(preset);
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Availability Grid Mockups</h1>
          <p className="text-sm text-muted-foreground">Mobile-optimized full week view</p>
        </div>
      </header>

      {/* Section: Group Heatmap (NEW) */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Group Heatmap View</h2>
          <p className="text-sm text-muted-foreground">Shows aggregated availability - darker = more people free</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {/* Option E - Combined Heatmap + Personal Selection (RECOMMENDED) */}
          <MobileFrame label="Option E: Combined Heatmap + Your Selection">
            <div className="px-4 py-4">
              <div className="mb-4">
                <h2 className="font-semibold text-lg">🍕 Friday Dinner Club</h2>
                <p className="text-xs text-muted-foreground">Tap to mark when you're free</p>
              </div>
              <CombinedAvailabilityGrid
                groupData={MOCK_GROUP_HEATMAP}
                personalData={valueE}
                onPersonalChange={setValueE}
                totalMembers={5}
              />
            </div>
          </MobileFrame>

          {/* Option D - Group Heatmap (Read-only) */}
          <MobileFrame label="Option D: Group Availability Heatmap">
            <div className="px-4 py-4">
              <div className="mb-4">
                <h2 className="font-semibold text-lg">🍕 Friday Dinner Club</h2>
                <p className="text-xs text-muted-foreground">When can everyone meet?</p>
              </div>
              <GroupAvailabilityHeatmap data={MOCK_GROUP_HEATMAP} totalMembers={5} />
            </div>
          </MobileFrame>

          {/* Option A for comparison - Individual Selection */}
          <MobileFrame label="Option A: Your Availability (Input)">
            <div className="px-4 py-4">
              <div className="mb-4">
                <h2 className="font-semibold text-lg">When are you free?</h2>
                <p className="text-xs text-muted-foreground">Tap to select your availability</p>
              </div>
              <AvailabilityGridOptionA value={valueA} onChange={setValueA} />
            </div>
          </MobileFrame>
        </div>

        <div className="border-t pt-8 mb-6">
          <h2 className="text-xl font-bold mb-1">Individual Input Options</h2>
          <p className="text-sm text-muted-foreground">Different layouts for members to input their availability</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8">
          {/* Option B */}
          <MobileFrame label="Option B: Larger Touch Targets">
            <div className="px-4 py-4">
              <div className="mb-4">
                <h2 className="font-semibold text-lg">When are you free?</h2>
                <p className="text-xs text-muted-foreground">Tap to select your availability</p>
              </div>
              <AvailabilityGridOptionB value={valueB} onChange={setValueB} />
            </div>
          </MobileFrame>

          {/* Option C */}
          <MobileFrame label="Option C: Stacked Time Rows">
            <div className="px-4 py-4">
              <div className="mb-4">
                <h2 className="font-semibold text-lg">When are you free?</h2>
                <p className="text-xs text-muted-foreground">Tap to select your availability</p>
              </div>
              <AvailabilityGridOptionC value={valueC} onChange={setValueC} />
            </div>
          </MobileFrame>
        </div>

        {/* Legend */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Design Comparison
            </h3>
            <div className="grid md:grid-cols-5 gap-6">
              <div className="bg-violet-50 rounded-xl p-3 -m-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-violet-600">E</span>
                  </div>
                  <span className="font-medium">Combined</span>
                  <span className="text-2xs bg-violet-500 text-white px-1.5 py-0.5 rounded-full">Best</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Yellow = group availability</li>
                  <li>• Purple outline = your picks</li>
                  <li>• See where you fit</li>
                  <li>• Highlights overlaps</li>
                  <li>• <strong>Interactive input</strong></li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-rose-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-rose-600">D</span>
                  </div>
                  <span className="font-medium">Heatmap</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Aggregated group view</li>
                  <li>• Shows X/5 per slot</li>
                  <li>• Heat intensity = availability</li>
                  <li>• Highlights best times</li>
                  <li>• <strong>Read-only</strong></li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-600">A</span>
                  </div>
                  <span className="font-medium">Compact</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Color-coded time slots</li>
                  <li>• Single-letter headers</li>
                  <li>• 48px touch targets</li>
                  <li>• Most space efficient</li>
                  <li>• <strong>Individual input</strong></li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">B</span>
                  </div>
                  <span className="font-medium">Large Targets</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Unified primary color</li>
                  <li>• Full day names</li>
                  <li>• 56px touch targets</li>
                  <li>• Best accessibility</li>
                  <li>• <strong>Individual input</strong></li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-600">C</span>
                  </div>
                  <span className="font-medium">Stacked Rows</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Grouped by time period</li>
                  <li>• Card-based layout</li>
                  <li>• Clear visual hierarchy</li>
                  <li>• Shows X/7 progress</li>
                  <li>• <strong>Individual input</strong></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
