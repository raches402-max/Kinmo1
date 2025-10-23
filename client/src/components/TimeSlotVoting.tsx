import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Users, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimeSlot {
  id: string;
  proposedDateTime: string;
  label?: string;
  isSelected: boolean;
  voteCount: number;
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
  const [votedSlotId, setVotedSlotId] = useState<string | null>(null);

  const { data: timeSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/itineraries", itineraryId, "time-slots"],
  });

  useEffect(() => {
    if (timeSlots.length > 0 && !votedSlotId) {
      const userVotedSlot = timeSlots.find(slot => slot.userHasVoted);
      if (userVotedSlot) {
        setVotedSlotId(userVotedSlot.id);
      }
    }
  }, [timeSlots, votedSlotId]);

  const voteMutation = useMutation({
    mutationFn: async (timeSlotId: string) => {
      return apiRequest("POST", `/api/time-slots/${timeSlotId}/vote`, {
        body: { memberId },
      });
    },
    onSuccess: (_, timeSlotId) => {
      setVotedSlotId(timeSlotId);
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId, "time-slots"] });
      toast({
        title: "Vote recorded!",
        description: "Your preferred time has been noted.",
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

  const maxVotes = Math.max(...timeSlots.map(slot => slot.voteCount), 0);
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
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {timeSlots.map((slot) => {
          const isTopChoice = slot.voteCount === maxVotes && maxVotes > 0;
          const hasVoted = votedSlotId === slot.id;
          
          return (
            <Card 
              key={slot.id}
              className={`p-3 transition-all hover-elevate cursor-pointer ${
                hasVoted ? 'border-primary/50 bg-primary/5' : ''
              } ${isTopChoice ? 'border-green-500/50' : ''}`}
              onClick={() => !isOrganizer && voteMutation.mutate(slot.id)}
              data-testid={`time-slot-${slot.id}`}
            >
              <div className="space-y-2">
                <div className="text-center">
                  <div className="font-semibold text-sm">
                    {format(new Date(slot.proposedDateTime), "EEE, MMM d")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(slot.proposedDateTime), "h:mm a")}
                  </div>
                  {slot.label && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {slot.label}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{slot.voteCount}</span>
                  </div>
                  
                  {isTopChoice && slot.voteCount > 0 && (
                    <Badge variant="outline" className="text-xs h-5 px-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                      Top
                    </Badge>
                  )}
                  
                  {hasVoted && (
                    <Check className="h-4 w-4 text-primary" data-testid={`voted-${slot.id}`} />
                  )}
                </div>

                {isOrganizer && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectMutation.mutate(slot.id);
                    }}
                    disabled={selectMutation.isPending}
                    data-testid={`select-time-${slot.id}`}
                  >
                    Select This Time
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      
      {!isOrganizer && (
        <p className="text-xs text-muted-foreground text-center">
          Click a time to vote for it
        </p>
      )}
    </div>
  );
}
