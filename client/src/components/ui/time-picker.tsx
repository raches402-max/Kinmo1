/**
 * Time Picker Component
 *
 * A warm, refined time picker that matches Kinmo's aesthetic.
 * Features smooth scrolling, 15-min intervals, and elegant styling.
 */

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";

interface TimePickerProps {
  value?: { hours: number; minutes: number };
  onChange: (time: { hours: number; minutes: number }) => void;
  className?: string;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options: { hours: number; minutes: number; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hours12 = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${hours12}:${m.toString().padStart(2, '0')} ${ampm}`;
      options.push({ hours: h, minutes: m, label });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Find closest option to current value
  const currentIndex = value
    ? TIME_OPTIONS.findIndex(
        (opt) =>
          opt.hours === value.hours &&
          Math.abs(opt.minutes - value.minutes) < 15
      )
    : -1;

  const selectedOption = currentIndex >= 0 ? TIME_OPTIONS[currentIndex] : null;

  // Format display value
  const displayValue = value
    ? (() => {
        const hours12 = value.hours % 12 || 12;
        const ampm = value.hours < 12 ? 'AM' : 'PM';
        return `${hours12}:${value.minutes.toString().padStart(2, '0')} ${ampm}`;
      })()
    : 'Set time';

  // Scroll to selected item when opening
  useEffect(() => {
    if (isOpen && selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const selected = selectedRef.current;
      const containerHeight = container.clientHeight;
      const selectedTop = selected.offsetTop;
      const selectedHeight = selected.clientHeight;

      container.scrollTop = selectedTop - containerHeight / 2 + selectedHeight / 2;
    }
  }, [isOpen]);

  const handleSelect = (option: typeof TIME_OPTIONS[0]) => {
    onChange({ hours: option.hours, minutes: option.minutes });
    setIsOpen(false);
  };

  // Quick adjust buttons
  const adjustTime = (direction: 'up' | 'down') => {
    if (!value) {
      // Default to 6 PM
      onChange({ hours: 18, minutes: 0 });
      return;
    }

    let newMinutes = value.minutes + (direction === 'up' ? 15 : -15);
    let newHours = value.hours;

    if (newMinutes >= 60) {
      newMinutes = 0;
      newHours = (newHours + 1) % 24;
    } else if (newMinutes < 0) {
      newMinutes = 45;
      newHours = newHours === 0 ? 23 : newHours - 1;
    }

    onChange({ hours: newHours, minutes: newMinutes });
  };

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-[hsl(35,40%,97%)] border border-[hsl(32,20%,88%)]",
          "hover:border-[hsl(44,70%,65%)] hover:bg-[hsl(35,40%,95%)]",
          "transition-all duration-200",
          "text-sm font-medium text-[hsl(25,30%,25%)]",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(44,87%,63%)]/30 focus:border-[hsl(44,70%,65%)]",
          isOpen && "border-[hsl(44,70%,65%)] bg-[hsl(35,40%,95%)] ring-2 ring-[hsl(44,87%,63%)]/30"
        )}
      >
        <Clock className="h-4 w-4 text-[hsl(44,70%,45%)]" />
        <span>{displayValue}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className={cn(
              "absolute top-full left-0 mt-2 z-50",
              "bg-white rounded-xl shadow-xl",
              "border border-[hsl(32,20%,88%)]",
              "overflow-hidden",
              "animate-in fade-in-0 zoom-in-95 duration-200"
            )}
          >
            {/* Quick adjust header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[hsl(35,40%,97%)] border-b border-[hsl(32,20%,90%)]">
              <button
                type="button"
                onClick={() => adjustTime('down')}
                className={cn(
                  "p-1.5 rounded-lg",
                  "hover:bg-[hsl(44,87%,63%)]/20 text-[hsl(25,15%,45%)]",
                  "transition-colors"
                )}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-[hsl(25,30%,25%)] tabular-nums">
                {displayValue}
              </span>
              <button
                type="button"
                onClick={() => adjustTime('up')}
                className={cn(
                  "p-1.5 rounded-lg",
                  "hover:bg-[hsl(44,87%,63%)]/20 text-[hsl(25,15%,45%)]",
                  "transition-colors"
                )}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable time list */}
            <div
              ref={scrollRef}
              className="max-h-[240px] overflow-y-auto py-1 scroll-smooth"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(32,20%,85%) transparent'
              }}
            >
              {TIME_OPTIONS.map((option, idx) => {
                const isSelected =
                  selectedOption?.hours === option.hours &&
                  selectedOption?.minutes === option.minutes;

                // Visual groupings - add separator at noon
                const showDivider = option.hours === 12 && option.minutes === 0;

                return (
                  <div key={idx}>
                    {showDivider && (
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[hsl(25,15%,55%)] bg-[hsl(35,40%,98%)]">
                        Afternoon
                      </div>
                    )}
                    {idx === 0 && (
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[hsl(25,15%,55%)] bg-[hsl(35,40%,98%)]">
                        Morning
                      </div>
                    )}
                    <button
                      ref={isSelected ? selectedRef : null}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm",
                        "transition-colors duration-100",
                        isSelected
                          ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] font-semibold"
                          : "text-[hsl(25,15%,35%)] hover:bg-[hsl(44,87%,63%)]/15"
                      )}
                    >
                      {option.label}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Common times footer */}
            <div className="flex gap-1 px-2 py-2 bg-[hsl(35,40%,97%)] border-t border-[hsl(32,20%,90%)]">
              {[
                { label: '12p', hours: 12, minutes: 0 },
                { label: '5p', hours: 17, minutes: 0 },
                { label: '6p', hours: 18, minutes: 0 },
                { label: '7p', hours: 19, minutes: 0 },
                { label: '8p', hours: 20, minutes: 0 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelect({ ...preset, label: '' })}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md",
                    "transition-colors duration-100",
                    value?.hours === preset.hours && value?.minutes === preset.minutes
                      ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
                      : "bg-white text-[hsl(25,15%,45%)] hover:bg-[hsl(44,87%,63%)]/20 border border-[hsl(32,20%,88%)]"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TimePicker;
