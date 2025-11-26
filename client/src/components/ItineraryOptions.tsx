/**
 * Itinerary Options Component
 * Displays 3 AI-generated itinerary options for an auto-scheduled event
 * Supports voting and organizer selection
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VenueBadges } from "@/components/VenueBadges";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Users, ThumbsUp, RefreshCw } from "lucide-react";

interface ItineraryOptionsProps {
  eventId: string;
  isOrganizer: boolean;
  onOptionSelected?: () => void;
}

interface Venue {
  sourceType: 'activity' | 'voting_event';
  sourceId: string;
  venueName: string;
  badges: string[];
  rating?: string | null;
  venueAddress?: string | null;
  googleMapsUrl?: string | null;
}

interface NearbySuggestion {
  sourceType: 'activity' | 'voting_event';
  sourceId: string;
  venueName: string;
  distance: number;
  walkingTime: number;
  category?: string;
  badges: string[];
  rating?: string;
}

interface Option {
  id: string;
  autoEventId: string;
  optionNumber: number;
  venues: Venue[];
  description: string;
  voteCount: number;
  createdAt: string;
  nearbySuggestions?: NearbySuggestion[];
}

interface AutoEvent {
  id: string;
  groupId: string;
  scheduledDate: string;
  allowMemberVoting: boolean;
  selectedOptionId: string | null;
  status: string;
}

interface OptionsData {
  event: AutoEvent;
  options: Option[];
}

export function ItineraryOptions({ eventId, isOrganizer, onOptionSelected }: ItineraryOptionsProps) {
  const { toast } = useToast();
  const [selectedVote, setSelectedVote] = useState<string | null>(null);

  // Fetch options
  const { data, isLoading, error } = useQuery<OptionsData>({
    queryKey: [`/api/auto-events/${eventId}/options`],
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return apiRequest('POST', `/api/auto-events/${eventId}/vote`, { optionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/auto-events/${eventId}/options`] });
      toast({
        title: "Vote recorded",
        description: "Your vote has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Select option mutation (organizer only)
  const selectMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return apiRequest('POST', `/api/auto-events/${eventId}/select-option`, { optionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/auto-events/${eventId}/options`] });
      toast({
        title: "Option selected",
        description: "The itinerary has been created.",
      });
      if (onOptionSelected) {
        onOptionSelected();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Regenerate options mutation (organizer only)
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/auto-events/${eventId}/regenerate-options`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/auto-events/${eventId}/options`] });
      toast({
        title: "New options generated",
        description: "We've created fresh itinerary options for you.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVote = (optionId: string) => {
    setSelectedVote(optionId);
    voteMutation.mutate(optionId);
  };

  const handleSelect = (optionId: string) => {
    selectMutation.mutate(optionId);
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Unable to load itinerary options
      </div>
    );
  }

  const { event, options } = data;
  const hasSelectedOption = event.selectedOptionId !== null;

  const getOptionTitle = (optionNumber: number) => {
    switch (optionNumber) {
      case 1:
        return "🎯 Top Picks";
      case 2:
        return "⚖️ Balanced Mix";
      case 3:
        return "🚀 Adventure Mode";
      default:
        return `Option ${optionNumber}`;
    }
  };

  const isSingleOption = options.length === 1;
  const isFromFavorites = options.length === 1 && options[0]?.description?.toLowerCase().includes('favorite');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {isSingleOption ? "Your Curated Itinerary" : "Choose Your Itinerary"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSingleOption && isFromFavorites
              ? "Built from venues your group already loves"
              : event.allowMemberVoting
              ? "Vote for your preferred option"
              : "Select the itinerary you'd like to use"}
          </p>
        </div>
        {event.allowMemberVoting && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            Voting Enabled
          </Badge>
        )}
      </div>

      {/* Show Favorites badge for single-option mode */}
      {isSingleOption && isFromFavorites && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⭐</div>
            <div className="flex-1">
              <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                Created from your Favorites
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This itinerary features venues your group has upvoted and loved. We've applied smart filters to avoid recently visited spots and ensure a great flow.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${isSingleOption ? 'md:grid-cols-1' : 'md:grid-cols-3'}`}>
        {options.map((option) => {
          const isSelected = event.selectedOptionId === option.id;
          const hasVotes = option.voteCount > 0;

          return (
            <Card
              key={option.id}
              className={`relative ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : ""
              }`}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-primary flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Selected
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-base">
                  {isSingleOption ? "Your Itinerary" : getOptionTitle(option.optionNumber)}
                </CardTitle>
                <CardDescription className="text-xs">
                  {option.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {option.venues.map((venue, index) => (
                    <div
                      key={`${venue.sourceType}-${venue.sourceId}`}
                      className="p-2 border rounded-lg bg-card"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-sm truncate">
                          {index + 1}. {venue.venueName}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {venue.sourceType === 'voting_event' ? '⭐ Favorite' : '✨ AI'}
                        </Badge>
                      </div>
                      <VenueBadges badges={venue.badges} />
                    </div>
                  ))}
                </div>

                {/* Nearby Suggestions */}
                {option.nearbySuggestions && option.nearbySuggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      💡 Optional nearby spots:
                    </div>
                    <div className="space-y-2">
                      {option.nearbySuggestions.map((suggestion, index) => (
                        <div
                          key={`${suggestion.sourceType}-${suggestion.sourceId}`}
                          className="p-2 border rounded-lg bg-muted/30 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-medium text-sm truncate">
                              {suggestion.venueName}
                            </div>
                            {suggestion.rating && (
                              <Badge variant="outline" className="shrink-0 text-xs">
                                ⭐ {suggestion.rating}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.distance.toFixed(1)} mi away • {suggestion.walkingTime} min walk
                            {suggestion.category && ` • ${suggestion.category}`}
                          </div>
                          <VenueBadges badges={suggestion.badges} className="mt-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasVotes && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" />
                    {option.voteCount} {option.voteCount === 1 ? "vote" : "votes"}
                  </div>
                )}
              </CardContent>

              {!hasSelectedOption && (
                <CardFooter className="flex flex-col gap-2">
                  {event.allowMemberVoting && !isOrganizer && (
                    <Button
                      variant={selectedVote === option.id ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleVote(option.id)}
                      disabled={voteMutation.isPending}
                    >
                      {selectedVote === option.id ? "Voted" : "Vote"}
                    </Button>
                  )}

                  {isOrganizer && (
                    <Button
                      className="w-full"
                      onClick={() => handleSelect(option.id)}
                      disabled={selectMutation.isPending}
                    >
                      {selectMutation.isPending ? "Selecting..." : "Select This Option"}
                    </Button>
                  )}
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>

      {/* Try Again button for single-option mode (organizer only) */}
      {!hasSelectedOption && isOrganizer && isSingleOption && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
            {regenerateMutation.isPending ? "Generating new itinerary..." : "Try Again"}
          </Button>
        </div>
      )}

      {hasSelectedOption && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          The organizer has selected an option. The itinerary is now being created.
        </div>
      )}
    </div>
  );
}
