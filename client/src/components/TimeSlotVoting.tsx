import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Calendar, Users, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimeSlot {
  id: string;
  proposedDateTime: string;
  label?: string;
  isSelected: boolean;
  yesCount: number;
  maybeCount: number;
  noCount: number;
  yesVoters?: string[];
  maybeVoters?: string[];
  noVoters?: string[];
  userVoteType?: string | null;
  userHasVoted?: boolean;
}

interface TimeSlotVotingProps {
  itineraryId: string;
  userId?: string;
  memberId?: string;
  isOrganizer?: boolean;
}

export function TimeSlotVoting({ itineraryId, userId, memberId, isOrganizer = false }: TimeSlotVotingProps) {
  const { toast } = useToast();

  const { data: timeSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/itineraries", itineraryId, "time-slots"],
  });

  const voteMutation = useMutation({
    mutationFn: async ({ timeSlotId, voteType }: { timeSlotId: string; voteType: "yes" | "maybe" | "no" }) => {
      return apiRequest("POST", `/api/time-slots/${timeSlotId}/vote`, {
        memberId,
        voteType,
      });
    },
    onSuccess: (_, { voteType }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId, "time-slots"] });
      toast({
        title: "Vote recorded!",
        description: `You voted "${voteType}" for this time.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Vote failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (timeSlotId: string) => {
      return apiRequest("PATCH", `/api/time-slots/${timeSlotId}/select`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId, "time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Time selected!",
        description: "Event time has been finalized.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Selection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex gap-2 p-4 bg-muted/50 rounded-md" data-testid="time-slots-loading">
        <div className="h-20 w-full animate-pulse bg-muted rounded"></div>
      </div>
    );
  }

  if (!timeSlots || timeSlots.length === 0) {
    return null;
  }

  const maxYesVotes = Math.max(...timeSlots.map(slot => slot.yesCount), 0);
  const selectedSlot = timeSlots.find(slot => slot.isSelected);

  if (selectedSlot) {
    return (
      <div className="space-y-2" data-testid="selected-time-slot">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Selected Time:</span>
        </div>
        <Card className="p-3 border-primary/50 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {format(new Date(selectedSlot.proposedDateTime), "EEE, MMM d")}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(selectedSlot.proposedDateTime), "h:mm a")}
              </div>
              {selectedSlot.label && (
                <div className="text-xs text-muted-foreground mt-1">{selectedSlot.label}</div>
              )}
            </div>
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" />
              Final
            </Badge>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="time-slot-voting">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="font-medium">Vote for your preferred time:</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {timeSlots.map((slot) => {
          const isTopChoice = slot.yesCount === maxYesVotes && maxYesVotes > 0;
          const userVote = slot.userVoteType;
          
          return (
            <Card 
              key={slot.id}
              className={`p-3 transition-all ${isTopChoice ? 'border-green-500/50' : ''}`}
              data-testid={`time-slot-${slot.id}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {format(new Date(slot.proposedDateTime), "EEE, MMM d")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(slot.proposedDateTime), "h:mm a")}
                    </div>
                    {slot.label && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {slot.label}
                      </div>
                    )}
                  </div>
                  
                  {isTopChoice && slot.yesCount > 0 && (
                    <Badge variant="outline" className="text-xs h-5 px-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                      Most Popular
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {/* Yes votes */}
                  {slot.yesCount > 0 && slot.yesVoters && slot.yesVoters.length > 0 ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex items-center gap-1 hover-elevate px-2 py-0.5 rounded cursor-pointer" data-testid={`yes-voters-${slot.id}`}>
                          <span className="text-green-600 dark:text-green-400 font-medium">{slot.yesCount} Yes</span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-auto max-w-xs p-3" side="top">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400">Can attend:</p>
                          <div className="flex flex-wrap gap-1">
                            {slot.yesVoters.map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 font-medium">{slot.yesCount} Yes</span>
                  )}

                  {/* Maybe votes */}
                  {slot.maybeCount > 0 && slot.maybeVoters && slot.maybeVoters.length > 0 ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex items-center gap-1 hover-elevate px-2 py-0.5 rounded cursor-pointer" data-testid={`maybe-voters-${slot.id}`}>
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium">{slot.maybeCount} Maybe</span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-auto max-w-xs p-3" side="top">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">Might attend:</p>
                          <div className="flex flex-wrap gap-1">
                            {slot.maybeVoters.map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">{slot.maybeCount} Maybe</span>
                  )}

                  {/* No votes */}
                  {slot.noCount > 0 && slot.noVoters && slot.noVoters.length > 0 ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="flex items-center gap-1 hover-elevate px-2 py-0.5 rounded cursor-pointer" data-testid={`no-voters-${slot.id}`}>
                          <span className="text-red-600 dark:text-red-400 font-medium">{slot.noCount} No</span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-auto max-w-xs p-3" side="top">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">Can't attend:</p>
                          <div className="flex flex-wrap gap-1">
                            {slot.noVoters.map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-medium">{slot.noCount} No</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant={userVote === "yes" ? "default" : "outline"}
                    className="flex-1 text-xs h-8"
                    onClick={() => voteMutation.mutate({ timeSlotId: slot.id, voteType: "yes" })}
                    disabled={voteMutation.isPending}
                    data-testid={`vote-yes-${slot.id}`}
                  >
                    {userVote === "yes" && <Check className="h-3 w-3 mr-1" />}
                    Yes
                  </Button>
                  <Button 
                    size="sm" 
                    variant={userVote === "maybe" ? "default" : "outline"}
                    className="flex-1 text-xs h-8"
                    onClick={() => voteMutation.mutate({ timeSlotId: slot.id, voteType: "maybe" })}
                    disabled={voteMutation.isPending}
                    data-testid={`vote-maybe-${slot.id}`}
                  >
                    {userVote === "maybe" && <Check className="h-3 w-3 mr-1" />}
                    Maybe
                  </Button>
                  <Button 
                    size="sm" 
                    variant={userVote === "no" ? "default" : "outline"}
                    className="flex-1 text-xs h-8"
                    onClick={() => voteMutation.mutate({ timeSlotId: slot.id, voteType: "no" })}
                    disabled={voteMutation.isPending}
                    data-testid={`vote-no-${slot.id}`}
                  >
                    {userVote === "no" && <Check className="h-3 w-3 mr-1" />}
                    No
                  </Button>
                </div>

                {isOrganizer && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full text-xs h-7 mt-1"
                    onClick={() => selectMutation.mutate(slot.id)}
                    disabled={selectMutation.isPending}
                    data-testid={`select-time-${slot.id}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Finalize This Time
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        {isOrganizer 
          ? "Vote on each time, then finalize your choice when everyone has responded"
          : "Vote on each time option with Yes, Maybe, or No"
        }
      </p>
    </div>
  );
}
