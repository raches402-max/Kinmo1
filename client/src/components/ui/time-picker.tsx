/**
 * Time Picker - Scroll Wheel Style
 *
 * Three independent scroll wheels: Hour | Minute (15-min) | AM/PM
 * Inspired by iOS picker wheels with Kinmo's warm aesthetic.
 * Uses portal to escape container overflow constraints.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: { hours: number; minutes: number };
  onChange: (time: { hours: number; minutes: number }) => void;
  className?: string;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 15, 30, 45];
const PERIODS = ['AM', 'PM'] as const;

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;

interface WheelColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onChange: (index: number) => void;
  formatItem?: (item: string | number) => string;
}

function WheelColumn({ items, selectedIndex, onChange, formatItem }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(-selectedIndex * ITEM_HEIGHT);

  // Sync offset when selectedIndex changes externally
  useEffect(() => {
    if (!isDragging) {
      setCurrentOffset(-selectedIndex * ITEM_HEIGHT);
    }
  }, [selectedIndex, isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setScrollOffset(currentOffset);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientY - startY;
    setCurrentOffset(scrollOffset + delta);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Snap to nearest item
    const rawIndex = Math.round(-currentOffset / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));

    setCurrentOffset(-clampedIndex * ITEM_HEIGHT);
    if (clampedIndex !== selectedIndex) {
      onChange(clampedIndex);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + direction));
    if (newIndex !== selectedIndex) {
      onChange(newIndex);
    }
  };

  const handleClick = (index: number) => {
    onChange(index);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[200px] w-[72px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Fade overlays */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/90 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent z-10 pointer-events-none" />

      {/* Selection highlight - golden strip */}
      <div
        className="absolute inset-x-1 z-5 pointer-events-none rounded-lg"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          height: ITEM_HEIGHT,
          background: 'linear-gradient(135deg, hsl(44, 87%, 63%) 0%, hsl(38, 80%, 58%) 100%)',
          boxShadow: '0 2px 12px rgba(242, 201, 76, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      />

      {/* Items container */}
      <div
        className={cn(
          "absolute inset-x-0 transition-transform",
          isDragging ? "duration-0" : "duration-300 ease-out"
        )}
        style={{
          transform: `translateY(${currentOffset + (VISIBLE_ITEMS * ITEM_HEIGHT) / 2 - ITEM_HEIGHT / 2}px)`,
        }}
      >
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          const distance = Math.abs(index - selectedIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.25;

          return (
            <div
              key={index}
              onClick={() => handleClick(index)}
              className={cn(
                "flex items-center justify-center transition-all duration-200",
                isSelected
                  ? "text-[hsl(25,30%,12%)] font-bold text-xl"
                  : "text-[hsl(25,15%,45%)] font-medium text-lg"
              )}
              style={{
                height: ITEM_HEIGHT,
                opacity: isDragging ? 1 : opacity,
              }}
            >
              {formatItem ? formatItem(item) : item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Convert 24h to 12h format
  const hours24 = value?.hours ?? 18;
  const minutes = value?.minutes ?? 0;
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 || 12;

  // Find indices
  const hourIndex = HOURS.indexOf(hours12);
  const minuteIndex = MINUTES.indexOf(Math.round(minutes / 15) * 15 % 60);
  const periodIndex = isPM ? 1 : 0;

  // Format display
  const displayTime = `${hours12}:${String(Math.round(minutes / 15) * 15 % 60).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerHeight = 280;
      const pickerWidth = 260;

      // Check if there's room below
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      if (spaceBelow >= pickerHeight || spaceBelow >= spaceAbove) {
        top = rect.bottom + 8;
      } else {
        top = rect.top - pickerHeight - 8;
      }

      // Keep within horizontal bounds
      let left = rect.left;
      if (left + pickerWidth > window.innerWidth - 16) {
        left = window.innerWidth - pickerWidth - 16;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  // Handle time change from wheels
  const handleTimeChange = useCallback((newHourIndex: number, newMinuteIndex: number, newPeriodIndex: number) => {
    const hour12 = HOURS[newHourIndex];
    const minute = MINUTES[newMinuteIndex];
    const period = PERIODS[newPeriodIndex];

    let hour24 = hour12;
    if (period === 'PM' && hour12 !== 12) {
      hour24 = hour12 + 12;
    } else if (period === 'AM' && hour12 === 12) {
      hour24 = 0;
    }

    onChange({ hours: hour24, minutes: minute });
  }, [onChange]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl",
          "bg-gradient-to-b from-[hsl(35,40%,98%)] to-[hsl(35,35%,96%)]",
          "border border-[hsl(32,25%,85%)]",
          "hover:border-[hsl(44,60%,60%)] hover:shadow-[0_2px_8px_rgba(242,201,76,0.15)]",
          "active:scale-[0.98]",
          "transition-all duration-200",
          "text-sm font-semibold text-[hsl(25,30%,20%)]",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(44,87%,63%)]/40 focus:border-[hsl(44,60%,55%)]",
          isOpen && "border-[hsl(44,60%,55%)] shadow-[0_2px_12px_rgba(242,201,76,0.25)] ring-2 ring-[hsl(44,87%,63%)]/40",
          className
        )}
      >
        <Clock className="h-4 w-4 text-[hsl(44,65%,45%)]" />
        <span className="tabular-nums tracking-wide">{displayTime}</span>
      </button>

      {/* Portal dropdown */}
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Picker panel */}
          <div
            className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-200"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            <div
              className={cn(
                "bg-white rounded-2xl overflow-hidden",
                "shadow-[0_20px_60px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.1)]",
                "border border-[hsl(32,20%,90%)]"
              )}
            >
              {/* Header */}
              <div className="px-5 py-3 bg-gradient-to-r from-[hsl(44,87%,63%)] to-[hsl(38,75%,55%)] text-center">
                <span className="text-[hsl(25,30%,12%)] font-bold text-lg tracking-wide tabular-nums">
                  {displayTime}
                </span>
              </div>

              {/* Wheel container */}
              <div className="flex items-center justify-center px-3 py-2 gap-0 bg-white">
                {/* Hour wheel */}
                <WheelColumn
                  items={HOURS}
                  selectedIndex={hourIndex >= 0 ? hourIndex : 0}
                  onChange={(idx) => handleTimeChange(idx, minuteIndex >= 0 ? minuteIndex : 0, periodIndex)}
                />

                {/* Separator */}
                <div className="flex flex-col items-center justify-center h-[200px] px-1">
                  <span className="text-2xl font-bold text-[hsl(25,30%,25%)]">:</span>
                </div>

                {/* Minute wheel */}
                <WheelColumn
                  items={MINUTES}
                  selectedIndex={minuteIndex >= 0 ? minuteIndex : 0}
                  onChange={(idx) => handleTimeChange(hourIndex >= 0 ? hourIndex : 0, idx, periodIndex)}
                  formatItem={(item) => String(item).padStart(2, '0')}
                />

                {/* Spacer */}
                <div className="w-3" />

                {/* AM/PM wheel */}
                <WheelColumn
                  items={[...PERIODS]}
                  selectedIndex={periodIndex}
                  onChange={(idx) => handleTimeChange(hourIndex >= 0 ? hourIndex : 0, minuteIndex >= 0 ? minuteIndex : 0, idx)}
                />
              </div>

              {/* Done button */}
              <div className="px-4 pb-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "w-full py-2.5 rounded-xl font-semibold text-sm",
                    "bg-gradient-to-b from-[hsl(44,87%,63%)] to-[hsl(44,80%,55%)]",
                    "text-[hsl(25,30%,12%)]",
                    "shadow-[0_2px_8px_rgba(242,201,76,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]",
                    "hover:shadow-[0_4px_12px_rgba(242,201,76,0.4)]",
                    "active:scale-[0.98]",
                    "transition-all duration-200"
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default TimePicker;
