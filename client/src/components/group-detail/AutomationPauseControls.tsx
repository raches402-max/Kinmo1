/**
 * AutomationPauseControls
 * Prominent, easy-to-use controls for pausing/resuming automation.
 *
 * Displays:
 * - Current automation status (active/paused)
 * - Clear pause options (for X events, until date)
 * - One-click resume
 *
 * Design: Visible but non-intrusive, uses status colors to indicate state.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Play,
  Pause,
  ChevronDown,
  CalendarOff,
  Zap,
  Calendar as CalendarIcon,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

interface AutomationPauseControlsProps {
  groupId: string;
  autoScheduleEnabled: boolean;
  automationPaused: boolean;
  automationPausedUntil?: Date | string | null;
  automationPauseEventsRemaining?: number | null;
  className?: string;
}

export function AutomationPauseControls({
  groupId,
  autoScheduleEnabled,
  automationPaused,
  automationPausedUntil,
  automationPauseEventsRemaining,
  className,
}: AutomationPauseControlsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (params: { pauseType: 'events' | 'until' | 'indefinite'; value?: number | string }) => {
      const response = await fetch(`/api/groups/${groupId}/pause-automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to pause automation');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Automation Paused",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/resume-automation`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resume automation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Automation Resumed",
        description: "Auto-scheduling is active again.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Don't show if automation is off
  if (!autoScheduleEnabled) return null;

  const isPending = pauseMutation.isPending || resumeMutation.isPending;

  // Format pause info
  const getPauseInfo = () => {
    if (automationPauseEventsRemaining && automationPauseEventsRemaining > 0) {
      return `Paused for ${automationPauseEventsRemaining} more event${automationPauseEventsRemaining !== 1 ? 's' : ''}`;
    }
    if (automationPausedUntil) {
      const until = new Date(automationPausedUntil);
      return `Paused until ${format(until, 'MMM d')}`;
    }
    return "Paused indefinitely";
  };

  const handlePauseForEvents = (count: number) => {
    pauseMutation.mutate({ pauseType: 'events', value: count });
  };

  const handlePauseUntil = (date: Date) => {
    pauseMutation.mutate({ pauseType: 'until', value: date.toISOString() });
    setCalendarOpen(false);
  };

  if (automationPaused) {
    // Paused state - show resume option
    return (
      <Card className={cn(
        "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50",
        className
      )}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Pause className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {getPauseInfo()}
                </div>
                <div className="text-xs text-amber-600/80 dark:text-amber-400/70">
                  Events won't auto-send
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resumeMutation.mutate()}
              disabled={isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Resume
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active state - show pause options
  return (
    <Card className={cn(
      "border-secondary/30 bg-secondary/5",
      className
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-secondary/20">
              <Zap className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium">Auto-scheduling active</div>
              <div className="text-xs text-muted-foreground">
                Events will send automatically
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pause className="h-3.5 w-3.5 mr-1.5" />
                Pause
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handlePauseForEvents(1)}>
                <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                Skip next event
              </DropdownMenuItem>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    Pause until date...
                  </DropdownMenuItem>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={(date) => date && handlePauseUntil(date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => pauseMutation.mutate({ pauseType: 'indefinite' })}>
                <CalendarOff className="h-4 w-4 mr-2 text-muted-foreground" />
                Pause indefinitely
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
