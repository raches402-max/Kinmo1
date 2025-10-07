import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member } from "@shared/schema";

export default function GroupDetail() {
  const [, params] = useRoute("/group/:id");
  const groupId = params?.id;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");

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
    refetchInterval: (query) => {
      const activities = query.state.data as Activity[] | undefined;
      // Poll every 3 seconds if no activities and group status is generating
      return (!activities || activities.length === 0) && 
             (group?.activityGenerationStatus === "pending" || group?.activityGenerationStatus === "generating")
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
                <CardTitle>Group Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Location</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {group.locationBase}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Budget Range</p>
                  <p className="font-medium">${group.budgetMin} - ${group.budgetMax}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Meeting Frequency</p>
                  <p className="font-medium capitalize">{group.meetingFrequency.replace("-", " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Availability</p>
                  <p className="text-sm">{formatAvailability(group.availability)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Share Link Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Invite Members
                </CardTitle>
                <CardDescription>Share this link with your group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={copyShareLink}
                  data-testid="button-copy-link"
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied!" : "Copy Invite Link"}
                </Button>
                
                {members.some(m => m.email && !m.invitationSent) && (
                  <Button
                    variant="default"
                    className="w-full justify-start"
                    onClick={() => sendInvitationsMutation.mutate()}
                    disabled={sendInvitationsMutation.isPending}
                    data-testid="button-send-invitations"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {sendInvitationsMutation.isPending ? "Sending..." : "Send Email Invitations"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Members Card */}
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  {members.length} {members.length === 1 ? "member" : "members"}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                        {member.isOrganizer && (
                          <Badge variant="secondary" className="text-xs">Organizer</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No members yet</p>
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
                <Button
                  onClick={() => retryGenerationMutation.mutate()}
                  disabled={retryGenerationMutation.isPending || group?.activityGenerationStatus === "generating" || group?.activityGenerationStatus === "pending"}
                  variant="default"
                  data-testid="button-generate-suggestions"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {retryGenerationMutation.isPending ? "Generating..." : "Generate New Ideas"}
                </Button>
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
                            <Badge variant="secondary" className="gap-1">
                              <DollarSign className="h-3 w-3" />
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
                          <p className="text-primary font-medium mb-1">Why we suggest this:</p>
                          <p className="text-muted-foreground line-clamp-3">{activity.aiReasoning}</p>
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

                      {activity.complementaryPlaceName && (
                        <div className="bg-accent/20 rounded-md p-3">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Grab food nearby:
                          </p>
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
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Your feedback:</p>
                        <div className="flex gap-2">
                          <Button
                            variant={activity.feedback === "love" ? "default" : "outline"}
                            size="sm"
                            onClick={() => feedbackMutation.mutate({ activityId: activity.id, feedback: "love" })}
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
                            Less like this
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
    </div>
  );
}
