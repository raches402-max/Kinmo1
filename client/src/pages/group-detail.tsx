import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";

export default function GroupDetail() {
  const [, params] = useRoute("/group/:id");
  const groupId = params?.id;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupData, setEditGroupData] = useState({
    name: "",
    locationBase: "",
    budgetMin: "",
    budgetMax: "",
    meetingFrequency: ""
  });

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", groupId],
    enabled: !!groupId,
    refetchInterval: (query) => {
      const group = query.state.data as Group | undefined;
      // Poll every 3 seconds if generation is pending or in progress
      return group?.activityGenerationStatus === "pending" || 
             group?.activityGenerationStatus === "generating" 
        ? 3000 
        : false;
    },
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/groups", groupId, "activities"],
    enabled: !!groupId,
    refetchInterval: () => {
      // Poll every 3 seconds while generating new activities
      return group?.activityGenerationStatus === "pending" || 
             group?.activityGenerationStatus === "generating"
        ? 3000 
        : false;
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/groups", groupId, "members"],
    enabled: !!groupId,
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/send-invitations`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invitations sent!",
        description: data.message,
      });
      // Invalidate members query to refresh invitation status
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending invitations",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retryGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/retry-generation`, {
        tempInstructions: tempInstructions.trim() || undefined
      });
    },
    onSuccess: () => {
      toast({
        title: "Retrying generation",
        description: "AI is creating new activity suggestions...",
      });
      setTempInstructions(""); // Clear the temp instructions after use
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error retrying",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearActivitiesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/groups/${groupId}/activities`, {});
    },
    onSuccess: () => {
      toast({
        title: "Activities cleared",
        description: "All AI suggestions have been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error clearing activities",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ activityId, feedback }: { activityId: string; feedback: string }) => {
      return await apiRequest("PATCH", `/api/activities/${activityId}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      toast({
        title: "Feedback saved",
        description: "Your preference has been recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      setEditGroupOpen(false);
      toast({
        title: "Group updated",
        description: "Your group details have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return await apiRequest("DELETE", `/api/members/${memberId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the group",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Voting functionality
  const [newEventTitle, setNewEventTitle] = useState("");
  const [addEventOpen, setAddEventOpen] = useState(false);

  const { data: votingEvents = [], isLoading: votingEventsLoading } = useQuery<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>({
    queryKey: ["/api/groups", groupId, "voting-events"],
    enabled: !!groupId,
  });

  const { data: myVotes = {} } = useQuery<Record<string, Vote>>({
    queryKey: ["/api/groups", groupId, "my-votes"],
    queryFn: async () => {
      if (!groupId) return {};
      const votes: Record<string, Vote> = {};
      for (const event of votingEvents) {
        const response = await fetch(`/api/voting-events/${event.id}/my-vote`);
        if (response.ok) {
          const vote = await response.json();
          if (vote) votes[event.id] = vote;
        }
      }
      return votes;
    },
    enabled: !!groupId && votingEvents.length > 0,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: { 
      title: string;
      description?: string;
      venueAddress?: string;
      venueType?: string;
      googlePlaceId?: string;
      rating?: string;
      priceLevel?: string;
      photoUrl?: string;
      aiReasoning?: string;
      priceEstimate?: string;
      timeConstraints?: string;
      complementaryPlaceName?: string;
      complementaryPlaceAddress?: string;
      complementaryPlaceId?: string;
      complementaryPlacePhotoUrl?: string;
      complementaryPlaceRating?: string;
      complementaryPlaceName2?: string;
      complementaryPlaceAddress2?: string;
      complementaryPlaceId2?: string;
      complementaryPlacePhotoUrl2?: string;
      complementaryPlaceRating2?: string;
    }) => {
      return await apiRequest("POST", "/api/voting-events", { groupId, ...eventData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      setNewEventTitle("");
      setAddEventOpen(false);
      toast({
        title: "Event added",
        description: "Your event has been added to the voting list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ eventId, voteType }: { eventId: string; voteType: 'upvote' | 'downvote' }) => {
      return await apiRequest("POST", `/api/voting-events/${eventId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error voting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeVoteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${eventId}/vote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVote = (eventId: string, voteType: 'upvote' | 'downvote') => {
    const currentVote = myVotes[eventId];
    if (currentVote) {
      if (currentVote.voteType === voteType) {
        removeVoteMutation.mutate(eventId);
      } else {
        voteMutation.mutate({ eventId, voteType });
      }
    } else {
      voteMutation.mutate({ eventId, voteType });
    }
  };

  const openEditGroup = () => {
    if (group) {
      setEditGroupData({
        name: group.name,
        locationBase: group.locationBase,
        budgetMin: group.budgetMin.toString(),
        budgetMax: group.budgetMax.toString(),
        meetingFrequency: group.meetingFrequency
      });
      setEditGroupOpen(true);
    }
  };

  const handleUpdateGroup = () => {
    const updates = {
      name: editGroupData.name,
      locationBase: editGroupData.locationBase,
      budgetMin: parseInt(editGroupData.budgetMin),
      budgetMax: parseInt(editGroupData.budgetMax),
      meetingFrequency: editGroupData.meetingFrequency
    };
    updateGroupMutation.mutate(updates);
  };

  const copyShareLink = () => {
    if (group?.shareableLink) {
      const fullUrl = `${window.location.origin}/join/${group.shareableLink}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with your group members",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAvailability = (availability: any): string => {
    if (typeof availability === 'string') {
      return availability.replace("-", " ");
    }
    
    if (typeof availability === 'object' && availability !== null) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const times = ['morning', 'afternoon', 'evening'];
      const selectedSlots: string[] = [];
      
      days.forEach(day => {
        if (availability[day]) {
          const dayTimes = times.filter(time => availability[day][time]);
          if (dayTimes.length > 0) {
            selectedSlots.push(`${day}: ${dayTimes.join(', ')}`);
          }
        }
      });
      
      return selectedSlots.length > 0 ? selectedSlots.join(' • ') : 'Not specified';
    }
    
    return 'Not specified';
  };

  if (groupLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Group not found</h2>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const priceDisplay = (level: string) => {
    const count = parseInt(level) || 0;
    return "$".repeat(Math.max(1, count));
  };

  const extractCity = (address: string | null | undefined): string => {
    if (!address) return "";
    // Address format is typically: "123 Street, City, State ZIP"
    const parts = address.split(",").map(p => p.trim());
    // Return the second part (city) if it exists
    return parts.length >= 2 ? parts[1] : "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" data-testid="text-group-name">{group.name}</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Group Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Group Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Group Details</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={openEditGroup}
                    data-testid="button-edit-group"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.locationBase}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="text-sm font-medium">${group.budgetMin}-${group.budgetMax}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="text-sm font-medium capitalize">{group.meetingFrequency.replace("-", " ")}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Availability</p>
                  <p className="text-xs leading-relaxed">{formatAvailability(group.availability)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Members Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>
                      {members.length} {members.length === 1 ? "member" : "members"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyShareLink}
                    data-testid="button-copy-link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {membersLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : members.length > 0 ? (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3" data-testid={`member-${member.id}`}>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name || "Member"}</p>
                          {member.email && (
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          )}
                        </div>
                        {member.isOrganizer ? (
                          <Badge variant="secondary" className="text-xs">Organizer</Badge>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                data-testid={`button-delete-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.name || member.email || "this member"} from the group?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete-member">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMemberMutation.mutate(member.id)}
                                  data-testid="button-confirm-delete-member"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No members yet</p>
                )}

                {members.some(m => m.email && !m.invitationSent) && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => sendInvitationsMutation.mutate()}
                      disabled={sendInvitationsMutation.isPending}
                      data-testid="button-send-invitations"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {sendInvitationsMutation.isPending ? "Sending..." : "Send Email Invitations"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* YAS THIS Voting Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>YAS THIS</CardTitle>
                    <CardDescription>Top 10 Events - Vote Now!</CardDescription>
                  </div>
                  <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-event">
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Event to YAS THIS</DialogTitle>
                        <DialogDescription>
                          Suggest an event for the group to vote on
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="event-title">Event Title</Label>
                          <Input
                            id="event-title"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            placeholder="e.g., Karaoke Night at Sing Sing"
                            data-testid="input-event-title"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createEventMutation.mutate({ title: newEventTitle })}
                          disabled={!newEventTitle.trim() || createEventMutation.isPending}
                          data-testid="button-submit-event"
                        >
                          {createEventMutation.isPending ? "Adding..." : "Add Event"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {votingEventsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : votingEvents.length > 0 ? (
                  <div className="space-y-2">
                    {votingEvents.map((event, index) => {
                      const currentVote = myVotes[event.id];
                      const hasUpvoted = currentVote?.voteType === 'upvote';
                      const hasDownvoted = currentVote?.voteType === 'downvote';
                      
                      return (
                        <Popover key={event.id}>
                          <PopoverTrigger asChild>
                            <div 
                              className="flex items-center gap-1 p-2 rounded-md hover-elevate cursor-pointer"
                              data-testid={`voting-event-${event.id}`}
                            >
                              <span className="text-xs font-medium text-muted-foreground w-5">#{index + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{event.title}</p>
                                {extractCity(event.venueAddress) && (
                                  <p className="text-[10px] text-muted-foreground truncate">{extractCity(event.venueAddress)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant={hasUpvoted ? "default" : "ghost"}
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVote(event.id, 'upvote');
                                  }}
                                  data-testid={`button-upvote-${event.id}`}
                                >
                                  <ThumbsUp className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-[10px] font-medium w-4 text-center" data-testid={`upvote-count-${event.id}`}>
                                  {event.upvotes}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant={hasDownvoted ? "default" : "ghost"}
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVote(event.id, 'downvote');
                                  }}
                                  data-testid={`button-downvote-${event.id}`}
                                >
                                  <ThumbsDown className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-[10px] font-medium w-4 text-center" data-testid={`downvote-count-${event.id}`}>
                                  {event.downvotes}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <span className="text-[10px] font-bold w-6 text-center" data-testid={`net-votes-${event.id}`}>
                                  {event.netVotes > 0 ? `+${event.netVotes}` : event.netVotes}
                                </span>
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" side="right">
                            <Card className="border-0 shadow-none">
                              {event.photoUrl && (
                                <div className="aspect-video w-full overflow-hidden bg-muted">
                                  <img
                                    src={event.photoUrl}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <CardHeader className="space-y-3">
                                <div>
                                  <CardTitle className="text-lg">{event.title}</CardTitle>
                                  {event.description && (
                                    <CardDescription className="mt-2">{event.description}</CardDescription>
                                  )}
                                </div>
                                
                                {(event.rating || event.priceLevel || event.venueType) && (
                                  <div className="flex flex-wrap gap-2">
                                    {event.rating && (
                                      <Badge variant="secondary" className="gap-1">
                                        <Star className="h-3 w-3 fill-current" />
                                        {event.rating}
                                      </Badge>
                                    )}
                                    {event.priceLevel && (
                                      <Badge variant="secondary">
                                        {priceDisplay(event.priceLevel)}
                                      </Badge>
                                    )}
                                    {event.venueType && (
                                      <Badge variant="outline">{event.venueType}</Badge>
                                    )}
                                  </div>
                                )}

                                {event.venueAddress && (
                                  <div className="text-sm text-muted-foreground flex items-start gap-2">
                                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{event.venueAddress}</span>
                                  </div>
                                )}

                                {event.aiReasoning && (
                                  <div className="text-sm bg-primary/5 rounded-md p-3">
                                    <p className="text-primary font-medium mb-2">Why we suggest this:</p>
                                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                                      {event.aiReasoning.split(/[.!]\s+/).filter(s => s.trim()).slice(0, 3).map((point, i) => (
                                        <li key={i} className="text-sm">{point.trim()}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {(event.priceEstimate || event.timeConstraints) && (
                                  <div className="space-y-2">
                                    {event.priceEstimate && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Ticket className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">Price:</span>
                                        <span className="text-muted-foreground">{event.priceEstimate}</span>
                                      </div>
                                    )}
                                    {event.timeConstraints && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">When:</span>
                                        <span className="text-muted-foreground">{event.timeConstraints}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(event.complementaryPlaceName || event.complementaryPlaceName2) && (
                                  <div className="bg-accent/20 rounded-md p-3">
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      Grab food nearby:
                                    </p>
                                    <div className="space-y-2">
                                      {event.complementaryPlaceName && (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{event.complementaryPlaceName}</p>
                                            {event.complementaryPlaceRating && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <Star className="h-3 w-3 fill-current text-yellow-500" />
                                                <span className="text-xs text-muted-foreground">{event.complementaryPlaceRating}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {event.complementaryPlaceName2 && (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{event.complementaryPlaceName2}</p>
                                            {event.complementaryPlaceRating2 && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <Star className="h-3 w-3 fill-current text-yellow-500" />
                                                <span className="text-xs text-muted-foreground">{event.complementaryPlaceRating2}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {event.googlePlaceId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="w-full"
                                  >
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${event.googlePlaceId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="gap-2"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      View on Google Maps
                                    </a>
                                  </Button>
                                )}
                              </CardHeader>
                            </Card>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No events yet. Add one to get started!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Activities */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="text-2xl font-bold" data-testid="text-activities-title">AI-Suggested Activities</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Personalized recommendations based on your group's preferences
              </p>
              
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Textarea
                    placeholder="Tell the AI what you want to see... (e.g., 'more outdoor activities' or 'include live music venues')"
                    value={tempInstructions}
                    onChange={(e) => setTempInstructions(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-temp-instructions"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => retryGenerationMutation.mutate()}
                    disabled={retryGenerationMutation.isPending || group?.activityGenerationStatus === "generating" || group?.activityGenerationStatus === "pending"}
                    variant="default"
                    data-testid="button-generate-suggestions"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {retryGenerationMutation.isPending ? "Generating..." : "Generate New Ideas"}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activities.length === 0 || clearActivitiesMutation.isPending}
                        data-testid="button-clear-activities"
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all AI suggestions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all activity suggestions for this group. You can generate new ones anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => clearActivitiesMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

            {activitiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="h-48 w-full rounded-t-lg" />
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  {group?.activityGenerationStatus === "failed" ? (
                    <>
                      <Calendar className="h-12 w-12 text-destructive mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
                      <p className="text-muted-foreground mb-4">
                        {group.activityGenerationError || "Unable to generate activity suggestions"}
                      </p>
                      <Button 
                        onClick={() => retryGenerationMutation.mutate()} 
                        variant="outline"
                        disabled={retryGenerationMutation.isPending}
                        data-testid="button-retry-generation"
                      >
                        {retryGenerationMutation.isPending ? "Retrying..." : "Retry Generation"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {group?.activityGenerationStatus === "generating" ? "Generating suggestions..." : "Finding perfect activities..."}
                      </h3>
                      <p className="text-muted-foreground">
                        Our AI is analyzing your group's preferences
                      </p>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activities.filter(activity => activity.feedback !== "less").map((activity) => (
                  <Card key={activity.id} className="overflow-hidden hover-elevate transition-all" data-testid={`activity-${activity.id}`}>
                    {activity.photoUrl && (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={activity.photoUrl}
                          alt={activity.venueName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="space-y-3">
                      <div>
                        <CardTitle className="text-lg mb-2">{activity.venueName}</CardTitle>
                        <CardDescription className="line-clamp-2">{activity.description}</CardDescription>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {activity.rating && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              {activity.rating}
                            </Badge>
                          )}
                          {activity.priceLevel && (
                            <Badge variant="secondary">
                              {priceDisplay(activity.priceLevel)}
                            </Badge>
                          )}
                          <Badge variant="outline">{activity.venueType}</Badge>
                        </div>
                        {activity.googlePlaceId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-google-link-${activity.id}`}
                          >
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${activity.googlePlaceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Google
                            </a>
                          </Button>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{activity.venueAddress}</span>
                      </div>

                      {activity.aiReasoning && (
                        <div className="text-sm bg-primary/5 rounded-md p-3">
                          <p className="text-primary font-medium mb-2">Why we suggest this:</p>
                          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                            {activity.aiReasoning.split(/[.!]\s+/).filter(s => s.trim()).slice(0, 3).map((point, i) => (
                              <li key={i} className="text-sm">{point.trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(activity.priceEstimate || activity.timeConstraints) && (
                        <div className="space-y-2">
                          {activity.priceEstimate && (
                            <div className="flex items-center gap-2 text-sm">
                              <Ticket className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Price:</span>
                              <span className="text-muted-foreground">{activity.priceEstimate}</span>
                            </div>
                          )}
                          {activity.timeConstraints && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">When:</span>
                              <span className="text-muted-foreground">{activity.timeConstraints}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {(activity.complementaryPlaceName || activity.complementaryPlaceName2) && (
                        <div className="bg-accent/20 rounded-md p-3">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Grab food nearby:
                          </p>
                          <div className="space-y-2">
                            {activity.complementaryPlaceName && (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{activity.complementaryPlaceName}</p>
                                  {activity.complementaryPlaceRating && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star className="h-3 w-3 fill-current text-yellow-500" />
                                      <span className="text-xs text-muted-foreground">{activity.complementaryPlaceRating}</span>
                                    </div>
                                  )}
                                </div>
                                {activity.complementaryPlaceId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    data-testid={`button-complementary-link-${activity.id}`}
                                  >
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.complementaryPlaceName)}&query_place_id=${activity.complementaryPlaceId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      View
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}
                            {activity.complementaryPlaceName2 && (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{activity.complementaryPlaceName2}</p>
                                  {activity.complementaryPlaceRating2 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star className="h-3 w-3 fill-current text-yellow-500" />
                                      <span className="text-xs text-muted-foreground">{activity.complementaryPlaceRating2}</span>
                                    </div>
                                  )}
                                </div>
                                {activity.complementaryPlaceId2 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    data-testid={`button-complementary-link-2-${activity.id}`}
                                  >
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.complementaryPlaceName2)}&query_place_id=${activity.complementaryPlaceId2}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      View
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Your feedback:</p>
                        <div className="flex gap-2">
                          <Button
                            variant={activity.feedback === "love" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              feedbackMutation.mutate({ activityId: activity.id, feedback: "love" });
                              createEventMutation.mutate({
                                title: activity.venueName,
                                description: activity.description,
                                venueAddress: activity.venueAddress,
                                venueType: activity.venueType,
                                googlePlaceId: activity.googlePlaceId || undefined,
                                rating: activity.rating || undefined,
                                priceLevel: activity.priceLevel || undefined,
                                photoUrl: activity.photoUrl || undefined,
                                aiReasoning: activity.aiReasoning || undefined,
                                priceEstimate: activity.priceEstimate || undefined,
                                timeConstraints: activity.timeConstraints || undefined,
                                complementaryPlaceName: activity.complementaryPlaceName || undefined,
                                complementaryPlaceAddress: activity.complementaryPlaceAddress || undefined,
                                complementaryPlaceId: activity.complementaryPlaceId || undefined,
                                complementaryPlacePhotoUrl: activity.complementaryPlacePhotoUrl || undefined,
                                complementaryPlaceRating: activity.complementaryPlaceRating || undefined,
                                complementaryPlaceName2: activity.complementaryPlaceName2 || undefined,
                                complementaryPlaceAddress2: activity.complementaryPlaceAddress2 || undefined,
                                complementaryPlaceId2: activity.complementaryPlaceId2 || undefined,
                                complementaryPlacePhotoUrl2: activity.complementaryPlacePhotoUrl2 || undefined,
                                complementaryPlaceRating2: activity.complementaryPlaceRating2 || undefined,
                              });
                            }}
                            className="flex-1 gap-1"
                            data-testid={`button-love-${activity.id}`}
                          >
                            <Flame className="h-3 w-3" />
                            YAS THIS
                          </Button>
                          <Button
                            variant={activity.feedback === "more" ? "default" : "outline"}
                            size="sm"
                            onClick={() => feedbackMutation.mutate({ activityId: activity.id, feedback: "more" })}
                            className="flex-1 gap-1"
                            data-testid={`button-more-${activity.id}`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            More like this
                          </Button>
                          <Button
                            variant={activity.feedback === "less" ? "default" : "outline"}
                            size="sm"
                            onClick={() => feedbackMutation.mutate({ activityId: activity.id, feedback: "less" })}
                            className="flex-1 gap-1"
                            data-testid={`button-less-${activity.id}`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                            Not this
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Group Dialog */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>Edit Group Details</DialogTitle>
            <DialogDescription>
              Update your group's information and preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                value={editGroupData.name}
                onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                data-testid="input-edit-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editGroupData.locationBase}
                onChange={(e) => setEditGroupData({ ...editGroupData, locationBase: e.target.value })}
                data-testid="input-edit-location"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-budget-min">Min Budget ($)</Label>
                <Input
                  id="edit-budget-min"
                  type="number"
                  value={editGroupData.budgetMin}
                  onChange={(e) => setEditGroupData({ ...editGroupData, budgetMin: e.target.value })}
                  data-testid="input-edit-budget-min"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-budget-max">Max Budget ($)</Label>
                <Input
                  id="edit-budget-max"
                  type="number"
                  value={editGroupData.budgetMax}
                  onChange={(e) => setEditGroupData({ ...editGroupData, budgetMax: e.target.value })}
                  data-testid="input-edit-budget-max"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateGroup} 
              disabled={updateGroupMutation.isPending}
              data-testid="button-save-group"
            >
              {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
