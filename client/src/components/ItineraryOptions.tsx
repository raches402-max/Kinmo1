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
import { CheckCircle2, Users, ThumbsUp } from "lucide-react";

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
}

interface Option {
  id: string;
  autoEventId: string;
  optionNumber: number;
  venues: Venue[];
  description: string;
  voteCount: number;
  createdAt: string;
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

  const handleVote = (optionId: string) => {
    setSelectedVote(optionId);
    voteMutation.mutate(optionId);
  };

  const handleSelect = (optionId: string) => {
    selectMutation.mutate(optionId);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Choose Your Itinerary</h3>
          <p className="text-sm text-muted-foreground">
            {event.allowMemberVoting
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

      <div className="grid gap-4 md:grid-cols-3">
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
                  {getOptionTitle(option.optionNumber)}
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

      {hasSelectedOption && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          The organizer has selected an option. The itinerary is now being created.
        </div>
      )}
    </div>
  );
}
