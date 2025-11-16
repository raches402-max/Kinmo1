/**
 * Auto Schedule Queue Component
 * Displays upcoming auto-scheduled events with AI validation
 * Shows events generated from Favorites and saved itineraries
 */

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
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AutoScheduleQueueProps {
  groupId: string;
  isOrganizer: boolean;
}

interface QueueVenue {
  sourceType: 'voting_event' | 'activity';
  sourceId: string;
  venueName: string;
  venueType: string;
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
}

interface QueueData {
  events: QueueEvent[];
}

export function AutoScheduleQueue({ groupId, isOrganizer }: AutoScheduleQueueProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch auto-schedule queue
  const { data, isLoading, error, refetch } = useQuery<QueueData>({
    queryKey: [`/api/groups/${groupId}/auto-schedule-queue`],
    enabled: !!groupId,
  });

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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTryAgain = (eventId: string) => {
    regenerateMutation.mutate(eventId);
  };

  const handleEdit = (eventId: string) => {
    // TODO: Navigate to Build tab with venues pre-populated
    toast({
      title: "Edit Feature",
      description: "Edit functionality coming soon. For now, you can skip this event and create a custom itinerary in the Build tab.",
    });
  };

  const handleSkip = (eventId: string) => {
    // For skip, we just refresh the queue - the skipped event won't reappear
    // because we track visit history
    toast({
      title: "Event Skipped",
      description: "This event has been removed from the queue.",
    });
    refetch();
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

  // Empty state
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No auto-scheduled events yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Add 5+ favorites or save an itinerary to enable smart auto-scheduling
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => {/* TODO: Navigate to Favorites */}}>
              Add to Favorites
            </Button>
            <Button variant="outline" onClick={() => {/* TODO: Navigate to Build */}}>
              Save an Itinerary
            </Button>
          </div>
        </CardContent>
      </Card>
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
                        <span className="flex-1">{venue.venueName}</span>
                        <Badge variant="outline" className="text-xs">
                          {venue.venueType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Validation Details */}
                {event.aiValidationReasoning && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground">AI Analysis</div>
                    <p className="text-sm">{event.aiValidationReasoning}</p>

                    {event.aiValidationConcerns && event.aiValidationConcerns.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-yellow-700">Concerns:</div>
                        <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                          {event.aiValidationConcerns.map((concern, i) => (
                            <li key={i} className="list-disc">{concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {event.aiValidationSuggestions && event.aiValidationSuggestions.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-blue-700">Suggestions:</div>
                        <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                          {event.aiValidationSuggestions.map((suggestion, i) => (
                            <li key={i} className="list-disc">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

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
                        onClick={() => handleTryAgain(event.id)}
                        disabled={approveMutation.isPending || regenerateMutation.isPending}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {regenerateMutation.isPending ? 'Regenerating...' : 'Try Again (Different Favorites)'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
