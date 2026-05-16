/**
 * AIPreview
 * Shows what automation would do, even when it's off.
 * Designed as a "glimpse into the future" - soft, inviting, and non-pushy.
 *
 * Aesthetic: Refined warmth with a touch of magic. Uses subtle gradients,
 * confidence indicators, and gentle animations to feel like AI "thinking"
 * without being intimidating.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Calendar,
  MapPin,
  ChevronRight,
  Check,
  Clock,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Play,
  Pause,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { cn } from "@/lib/utils";

interface AIPreviewProps {
  groupId: string;
  isOrganizer: boolean;
  autoScheduleEnabled: boolean;
  automationPaused: boolean;
  nextEventDueDate?: Date | string | null;
  confidenceThreshold: number;
  onToggleAutomation: (enabled: boolean) => void;
  onNavigateToQueue: () => void;
}

interface QueueVenue {
  sourceType: 'voting_event' | 'activity' | 'ad_hoc' | 'google_place';
  sourceId: string;
  venueName: string;
  venueType: string;
  googleMapsUrl?: string | null;
  adHocData?: {
    name: string;
    address?: string | null;
    type?: string | null;
    googlePlaceId?: string | null;
    notes?: string | null;
    googleMapsUrl?: string | null;
    arrivalTime?: Date | string | null;
    departureTime?: Date | string | null;
    travelNotes?: string | null;
  };
}

interface QueueEvent {
  id: string;
  scheduledDate: string;
  scheduledTime?: string;
  venues: QueueVenue[];
  sourceType: 'favorites' | 'itinerary';
  aiValidationScore: number;
  aiValidationReasoning: string;
}

interface QueueData {
  events: QueueEvent[];
}

// Confidence tier styling
function getConfidenceTier(score: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
} {
  if (score >= 90) return {
    label: "High",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    description: "Ready to auto-send"
  };
  if (score >= 70) return {
    label: "Good",
    color: "text-secondary-foreground",
    bgColor: "bg-secondary/20",
    borderColor: "border-secondary/40",
    description: "Might need a look"
  };
  return {
    label: "Review",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    description: "Needs your input"
  };
}

// Format relative date
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return "Next week";
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AIPreview({
  groupId,
  isOrganizer,
  autoScheduleEnabled,
  automationPaused,
  nextEventDueDate,
  confidenceThreshold,
  onToggleAutomation,
  onNavigateToQueue,
}: AIPreviewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch the queue preview (just first 2 events)
  const { data, isLoading, error, refetch, isFetching } = useQuery<QueueData>({
    queryKey: [`/api/groups/${groupId}/auto-schedule-queue`],
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Quick approve mutation
  const approveMutation = useMutation({
    mutationFn: async (queueEvent: QueueEvent) => {
      const response = await fetch(`/api/groups/${groupId}/auto-schedule-queue/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ queueEvent }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve event');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Event Created",
        description: `${data.itinerary.name} is ready to send.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/auto-schedule-queue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/itineraries`] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const events = data?.events || [];
  const nextEvent = events[0];
  const hasQueue = events.length > 0;

  // Determine the automation status message
  const getStatusMessage = () => {
    if (automationPaused) return "Paused";
    if (autoScheduleEnabled) return "Active";
    return "Off";
  };

  const getStatusColor = () => {
    if (automationPaused) return "text-amber-600";
    if (autoScheduleEnabled) return "text-secondary-foreground";
    return "text-muted-foreground";
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - subtle, non-blocking
  if (error) {
    return null; // Don't show anything if there's an error
  }

  // Empty state — don't render anything. The card has nothing to show
  // yet, and announcing "AI is ready" before there's any output reads
  // as spammy filler.
  if (!hasQueue) {
    return null;
  }

  const confidenceTier = getConfidenceTier(nextEvent.aiValidationScore);
  const wouldAutoSend = nextEvent.aiValidationScore >= confidenceThreshold && autoScheduleEnabled && !automationPaused;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      "bg-gradient-to-br from-card via-card to-primary/[0.02]",
      "border-primary/10 hover:border-primary/20",
      isExpanded && "ring-1 ring-primary/10"
    )}>
      {/* Header - Always visible */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4">
          {/* AI Icon with subtle pulse when active */}
          <div className={cn(
            "relative p-2.5 rounded-xl transition-colors",
            autoScheduleEnabled && !automationPaused
              ? "bg-primary/15"
              : "bg-muted/50"
          )}>
            <Sparkles className={cn(
              "h-5 w-5 transition-colors",
              autoScheduleEnabled && !automationPaused
                ? "text-primary"
                : "text-muted-foreground"
            )} />
            {autoScheduleEnabled && !automationPaused && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">Next AI Event</h4>
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", getStatusColor())}
              >
                {getStatusMessage()}
              </Badge>
            </div>

            {/* Preview of next event */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium">{formatRelativeDate(nextEvent.scheduledDate)}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate">{nextEvent.venues[0]?.venueName}</span>
              {nextEvent.venues.length > 1 && (
                <span className="text-muted-foreground/70">+{nextEvent.venues.length - 1}</span>
              )}
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center gap-2 mt-2">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                confidenceTier.bgColor,
                confidenceTier.color
              )}>
                <span className="tabular-nums">{nextEvent.aiValidationScore}</span>
                <span className="text-current/70">confidence</span>
              </div>
              {wouldAutoSend && (
                <div className="flex items-center gap-1 text-xs text-secondary-foreground">
                  <Zap className="h-3 w-3" />
                  <span>Will auto-send</span>
                </div>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground/50 transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Venue list */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Planned Venues
            </div>
            <div className="space-y-1.5">
              {nextEvent.venues.map((venue, index) => (
                <div
                  key={`${venue.sourceType}-${venue.sourceId}`}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg",
                    "bg-muted/30 border border-transparent",
                    "hover:bg-muted/50 hover:border-border/50 transition-colors"
                  )}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </div>
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="flex-1 text-sm font-medium truncate">{venue.venueName}</span>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {venue.venueType}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* What automation would do */}
          <div className={cn(
            "p-3 rounded-lg border",
            confidenceTier.bgColor,
            confidenceTier.borderColor
          )}>
            <div className="flex items-start gap-3">
              {wouldAutoSend ? (
                <Zap className={cn("h-4 w-4 mt-0.5", confidenceTier.color)} />
              ) : autoScheduleEnabled ? (
                <Eye className={cn("h-4 w-4 mt-0.5", confidenceTier.color)} />
              ) : (
                <EyeOff className="h-4 w-4 mt-0.5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <div className={cn("text-sm font-medium", confidenceTier.color)}>
                  {wouldAutoSend
                    ? "This event will be sent automatically"
                    : autoScheduleEnabled
                      ? confidenceTier.description
                      : "Automation is off"
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {wouldAutoSend
                    ? `Confidence ${nextEvent.aiValidationScore}% exceeds your ${confidenceThreshold}% threshold`
                    : autoScheduleEnabled
                      ? `Confidence ${nextEvent.aiValidationScore}% is below your ${confidenceThreshold}% threshold`
                      : "Turn on automation to let AI handle scheduling"
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isOrganizer && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  approveMutation.mutate(nextEvent);
                }}
                disabled={approveMutation.isPending}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1.5" />
                {approveMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToQueue();
                }}
              >
                View Queue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                disabled={isFetching}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          )}

          {/* Automation toggle - only for organizers */}
          {isOrganizer && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                {autoScheduleEnabled && !automationPaused ? (
                  <Play className="h-3.5 w-3.5 text-secondary-foreground" />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  Auto-scheduling
                </span>
              </div>
              <Switch
                checked={autoScheduleEnabled && !automationPaused}
                onCheckedChange={(checked) => onToggleAutomation(checked)}
                className="data-[state=checked]:bg-secondary"
              />
            </div>
          )}

          {/* More events indicator */}
          {events.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToQueue();
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              +{events.length - 1} more event{events.length > 2 ? 's' : ''} in queue
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
