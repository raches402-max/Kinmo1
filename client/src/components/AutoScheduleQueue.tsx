/**
 * Auto Schedule Queue Component
 * Displays upcoming auto-scheduled events with AI validation
 * Shows events generated from Favorites and saved itineraries
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit,
  X,
  ExternalLink,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { RegenerationFallbackDialog } from "@/components/RegenerationFallbackDialog";
import { DiscoverVenuesModal } from "@/components/DiscoverVenuesModal";

interface AutoScheduleQueueProps {
  groupId: string;
  isOrganizer: boolean;
  onNavigateToTab?: (tab: string) => void;
}

interface QueueVenue {
  sourceType: 'voting_event' | 'activity';
  sourceId: string;
  venueName: string;
  venueType: string;
  googleMapsUrl?: string;
}

interface QueueEvent {
  id: string;
  scheduledDate: string;
  scheduledTime?: string;
  venues: QueueVenue[];
  sourceType: 'favorites' | 'itinerary';
  sourceItineraryId?: string;
  sourceItineraryName?: string;
  aiValidationScore: number;
  aiValidationReasoning: string;
  aiValidationConcerns: string[];
  aiValidationSuggestions: string[];
  regenerationCount?: number;
}

interface QueueData {
  events: QueueEvent[];
}

export function AutoScheduleQueue({ groupId, isOrganizer, onNavigateToTab }: AutoScheduleQueueProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for regeneration fallback dialog
  const [fallbackDialogOpen, setFallbackDialogOpen] = useState(false);
  const [currentEventForFallback, setCurrentEventForFallback] = useState<QueueEvent | null>(null);

  // State for discover venues modal
  const [discoverModalOpen, setDiscoverModalOpen] = useState(false);

  // Fetch auto-schedule queue
  const { data, isLoading, error, refetch } = useQuery<QueueData>({
    queryKey: [`/api/groups/${groupId}/auto-schedule-queue`],
    enabled: !!groupId,
  });

  // Fetch Favorites count for empty state logic
  const { data: favoritesData } = useQuery<any[]>({
    queryKey: [`/api/groups/${groupId}/voting-events`],
    enabled: !!groupId,
  });

  const favoritesCount = favoritesData?.length || 0;

  // Approve mutation
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
        title: "Event Approved!",
        description: `${data.itinerary.name} has been added to proposed itineraries.`,
      });

      // Refresh queue and proposed itineraries
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/auto-schedule-queue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/proposed-itineraries`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/itineraries`] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleApprove = (event: QueueEvent) => {
    approveMutation.mutate(event);
  };

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/groups/${groupId}/auto-schedule-queue/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to regenerate event');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Regenerated!",
        description: "A new event combination has been generated from your Favorites.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/auto-schedule-queue`] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleTryAgain = (event: QueueEvent) => {
    // Check if this event has been regenerated 3+ times
    if (event.regenerationCount && event.regenerationCount >= 3) {
      setCurrentEventForFallback(event);
      setFallbackDialogOpen(true);
    } else {
      regenerateMutation.mutate(event.id);
    }
  };

  const handleEdit = (event: QueueEvent) => {
    // Navigate to Manual tab
    if (onNavigateToTab) {
      onNavigateToTab('manual');
      toast({
        title: "Opening Manual Creation",
        description: "You can now create a custom itinerary in the Plan Event tab.",
      });
    } else {
      toast({
        title: "Edit Feature",
        description: "Edit functionality coming soon. For now, you can skip this event and create a custom itinerary in the Plan Event tab.",
      });
    }
  };

  const handleSkip = async (eventId: string) => {
    try {
      const response = await fetch(`/api/auto-events/${eventId}/skip`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to skip event");
      }

      const result = await response.json();

      toast({
        title: "Event Skipped",
        description: result.message || "This event has been skipped. A replacement will be created for a future week.",
      });

      // Refetch to show updated queue
      refetch();
    } catch (error: any) {
      console.error("Error skipping event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to skip event. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Unable to load queue</h3>
          <p className="text-sm text-muted-foreground">
            There was an error loading the auto-schedule queue.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { events } = data;

  // Empty state with smart messaging based on Favorites count
  if (!events || events.length === 0) {
    let emptyStateTitle = "No auto-scheduled events yet";
    let emptyStateMessage = "Build your Favorites for smarter suggestions!";
    let emptyStateIcon = Calendar;

    if (favoritesCount === 0) {
      emptyStateTitle = "Your Favorites is empty";
      emptyStateMessage = "Discover venues first to unlock smart auto-scheduling! The AI will create personalized events from places your group loves.";
      emptyStateIcon = Search;
    } else if (favoritesCount < 3) {
      emptyStateTitle = `You have ${favoritesCount} Favorite${favoritesCount === 1 ? '' : 's'}`;
      emptyStateMessage = "Add more Favorites (3+ recommended) for better auto-scheduling variety and smarter event suggestions.";
    }

    const EmptyIcon = emptyStateIcon;

    return (
      <>
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{emptyStateTitle}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {emptyStateMessage}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                variant={favoritesCount === 0 ? "default" : "outline"}
                onClick={() => setDiscoverModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Discover Venues
              </Button>
              {favoritesCount === 0 ? (
                <Button variant="outline" onClick={() => onNavigateToTab?.('manual')}>
                  Use Manual Planning
                </Button>
              ) : (
                <Button variant="outline" onClick={() => onNavigateToTab?.('manual')}>
                  Save an Itinerary
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Discover Venues Modal */}
        <DiscoverVenuesModal
          open={discoverModalOpen}
          onOpenChange={setDiscoverModalOpen}
          groupId={groupId}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Upcoming Auto-Scheduled Events</h3>
          <p className="text-sm text-muted-foreground">
            AI-curated events from your Favorites and saved itineraries
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Queue
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pb-2">
        <div className="flex items-center gap-1.5">
          <span>⭐</span>
          <span>From Favorites</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>📋</span>
          <span>From Itinerary</span>
        </div>
      </div>

      {/* Queue Events */}
      <div className="space-y-4">
        {events.map((event) => {
          const validationColor =
            event.aiValidationScore >= 80 ? 'text-green-600' :
            event.aiValidationScore >= 60 ? 'text-yellow-600' :
            'text-red-600';

          const validationBadge =
            event.aiValidationScore >= 80 ? (
              <Badge className="bg-green-100 text-green-800 border-green-200" title="Validated">
                <CheckCircle2 className="h-3 w-3" />
              </Badge>
            ) : (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                <AlertCircle className="h-3 w-3 mr-1" />
                Needs Review
              </Badge>
            );

          return (
            <Card key={event.id} className="overflow-hidden max-w-4xl mx-auto">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {new Date(event.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {event.scheduledTime && ` at ${event.scheduledTime}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {event.sourceType === 'itinerary' ? (
                        <Badge variant="secondary" title={`From Itinerary: ${event.sourceItineraryName}`}>
                          📋
                        </Badge>
                      ) : (
                        <Badge variant="secondary" title="From Favorites">
                          ⭐
                        </Badge>
                      )}
                      {validationBadge}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Venues */}
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {event.venues.map((venue, index) => (
                      <div
                        key={`${venue.sourceType}-${venue.sourceId}`}
                        className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30"
                      >
                        <span className="font-medium text-muted-foreground">{index + 1}.</span>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {venue.googleMapsUrl ? (
                          <a
                            href={venue.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 hover:underline text-primary flex items-center gap-1"
                          >
                            {venue.venueName}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="flex-1">{venue.venueName}</span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {venue.venueType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions (Organizer only) */}
                {isOrganizer && (
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(event)}
                        className="flex-1"
                        disabled={event.aiValidationScore < 60 || approveMutation.isPending || regenerateMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {approveMutation.isPending ? 'Creating...' : 'Approve & Create'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleSkip(event.id)}
                        disabled={approveMutation.isPending || regenerateMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Skip
                      </Button>
                    </div>
                    {event.sourceType === 'favorites' && (
                      <Button
                        variant="outline"
                        onClick={() => handleTryAgain(event)}
                        disabled={approveMutation.isPending || regenerateMutation.isPending}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {regenerateMutation.isPending ? 'Regenerating...' : 'Try Again (Different Favorites)'}
                        {event.regenerationCount && event.regenerationCount > 0 && (
                          <Badge variant="secondary" className="ml-2">{event.regenerationCount}</Badge>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Regeneration Fallback Dialog */}
      {currentEventForFallback && (
        <RegenerationFallbackDialog
          open={fallbackDialogOpen}
          onOpenChange={setFallbackDialogOpen}
          regenerationCount={currentEventForFallback.regenerationCount || 0}
          onDiscoverMore={() => {
            setFallbackDialogOpen(false);
            setDiscoverModalOpen(true);
          }}
          onManualPlanning={() => {
            setFallbackDialogOpen(false);
            onNavigateToTab?.('manual');
            toast({
              title: "Opening Manual Planning",
              description: "Create a custom event with full control over venues and timing.",
            });
          }}
          onKeepTrying={() => {
            setFallbackDialogOpen(false);
            if (currentEventForFallback) {
              regenerateMutation.mutate(currentEventForFallback.id);
            }
          }}
        />
      )}

      {/* Discover Venues Modal */}
      <DiscoverVenuesModal
        open={discoverModalOpen}
        onOpenChange={setDiscoverModalOpen}
        groupId={groupId}
      />
    </div>
  );
}
