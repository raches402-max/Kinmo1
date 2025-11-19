import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Calendar, Users, Check, Circle, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeWithTimezone } from "@/lib/utils";

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
  timezone?: string;
}

export function TimeSlotVoting({ itineraryId, userId, memberId, isOrganizer = false, timezone = 'America/Los_Angeles' }: TimeSlotVotingProps) {
  const { toast } = useToast();

  const { data: timeSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/itineraries", itineraryId, "time-slots"],
  });

  const voteMutation = useMutation({
    mutationFn: async ({ timeSlotId, voteType }: { timeSlotId: string; voteType: "yes" | "maybe" }) => {
      return apiRequest("POST", `/api/time-slots/${timeSlotId}/vote`, {
        memberId,
        voteType,
      });
    },
    onSuccess: (_, { voteType }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId, "time-slots"] });
      toast({
        title: "Vote recorded!",
        description: voteType === "yes" ? "Marked as can attend" : "Marked as maybe",
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
                {formatDateTimeWithTimezone(selectedSlot.proposedDateTime, timezone)}
              </div>
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
        <span className="font-medium">When works best?</span>
      </div>
      
      <Card className="divide-y">
        {timeSlots.map((slot, index) => {
          const isTopChoice = slot.yesCount === maxYesVotes && maxYesVotes > 0;
          const userVote = slot.userVoteType;
          
          return (
            <div 
              key={slot.id}
              className={`p-4 transition-all ${isTopChoice ? 'bg-green-500/5' : ''}`}
              data-testid={`time-slot-${slot.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Date/Time */}
                <div className="flex-1">
                  <div className="font-semibold">
                    {formatDateTimeWithTimezone(slot.proposedDateTime, timezone)}
                  </div>

                  {/* Vote counts with hover cards */}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {/* Can attend */}
                    {slot.yesCount > 0 && slot.yesVoters && slot.yesVoters.length > 0 ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button className="flex items-center gap-1 hover-elevate px-1.5 py-0.5 rounded cursor-pointer" data-testid={`yes-voters-${slot.id}`}>
                            <span className="text-green-600 dark:text-green-400 font-medium">{slot.yesCount} can attend</span>
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
                    ) : slot.yesCount > 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">{slot.yesCount} can attend</span>
                    ) : null}

                    {/* Maybe */}
                    {slot.maybeCount > 0 && slot.maybeVoters && slot.maybeVoters.length > 0 ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button className="flex items-center gap-1 hover-elevate px-1.5 py-0.5 rounded cursor-pointer" data-testid={`maybe-voters-${slot.id}`}>
                            <span className="text-yellow-600 dark:text-yellow-400 font-medium">{slot.maybeCount} maybe</span>
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
                    ) : slot.maybeCount > 0 ? (
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">{slot.maybeCount} maybe</span>
                    ) : null}
                    
                    {isTopChoice && slot.yesCount > 0 && (
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                        Most Popular
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Vote buttons */}
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant={userVote === "yes" ? "default" : "outline"}
                    className="gap-1.5 text-xs h-8"
                    onClick={() => voteMutation.mutate({ timeSlotId: slot.id, voteType: "yes" })}
                    disabled={voteMutation.isPending}
                    data-testid={`vote-yes-${slot.id}`}
                  >
                    {userVote === "yes" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    Yes
                  </Button>
                  <Button 
                    size="sm" 
                    variant={userVote === "maybe" ? "secondary" : "outline"}
                    className="gap-1.5 text-xs h-8"
                    onClick={() => voteMutation.mutate({ timeSlotId: slot.id, voteType: "maybe" })}
                    disabled={voteMutation.isPending}
                    data-testid={`vote-maybe-${slot.id}`}
                  >
                    {userVote === "maybe" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    Maybe
                  </Button>
                  
                  {isOrganizer && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="gap-1 text-xs h-8"
                      onClick={() => selectMutation.mutate(slot.id)}
                      disabled={selectMutation.isPending}
                      data-testid={`select-time-${slot.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Finalize
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
      
      <p className="text-xs text-muted-foreground text-center">
        {isOrganizer 
          ? "Vote on each time, then finalize your choice when everyone has responded"
          : "Select all times that work for you"
        }
      </p>
    </div>
  );
}
