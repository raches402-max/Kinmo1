import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Clock, Check, X, HelpCircle } from "lucide-react";
import { format } from "date-fns";

type Member = {
  id: string;
  name: string;
  email: string | null;
};

type Itinerary = {
  id: string;
  name: string;
  groupId: string;
  eventDate: string | null;
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
  }>;
};

type Group = {
  id: string;
  name: string;
  emoji: string;
  locationBase: string;
};

type RsvpData = {
  id: string;
  response: string;
  rsvpFeedback: any;
};

export default function RsvpItineraryPage() {
  const [, params] = useRoute("/rsvp/:itineraryId/:inviteToken");
  const itineraryId = params?.itineraryId;
  const inviteToken = params?.inviteToken; // Invite token from URL authenticates the member
  const { toast } = useToast();

  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Feedback form state
  const [tryDifferentDay, setTryDifferentDay] = useState(false);
  const [tryEarlier, setTryEarlier] = useState(false);
  const [tryLater, setTryLater] = useState(false);
  const [notThisWeek, setNotThisWeek] = useState(false);
  const [unavailableDays, setUnavailableDays] = useState("");
  const [freeformFeedback, setFreeformFeedback] = useState("");

  // Verify invite token and get member data
  const { data: memberData, isLoading: verifyingToken, error: verifyError } = useQuery<Member>({
    queryKey: ["/api/members/verify-claim", inviteToken],
    enabled: !!inviteToken,
  });

  // Fetch itinerary
  const { data: itinerary, isLoading: itineraryLoading } = useQuery<Itinerary>({
    queryKey: ["/api/itineraries", itineraryId],
    enabled: !!itineraryId,
  });

  // Fetch group
  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", itinerary?.groupId],
    enabled: !!itinerary?.groupId,
  });

  // Fetch existing RSVP for this member/itinerary
  const { data: existingRsvp } = useQuery<RsvpData>({
    queryKey: ["/api/rsvps/itinerary", itineraryId, "member", memberData?.id, "token", inviteToken],
    queryFn: async () => {
      const url = `/api/rsvps/itinerary/${itineraryId}/member/${memberData?.id}?inviteToken=${inviteToken}`;
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No RSVP exists yet
        }
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!itineraryId && !!memberData?.id && !!inviteToken,
  });

  // Update local response state when existing RSVP loads
  useEffect(() => {
    if (existingRsvp?.response) {
      setSelectedResponse(existingRsvp.response);
    }
  }, [existingRsvp]);

  // RSVP mutation - includes invite token for validation
  const rsvpMutation = useMutation({
    mutationFn: async ({ response, feedback }: { response: string; feedback?: any }) => {
      return await apiRequest("POST", `/api/rsvps`, {
        itineraryId,
        inviteToken, // Include invite token for backend validation
        response,
        rsvpFeedback: feedback,
      });
    },
    onSuccess: (_, variables) => {
      setSelectedResponse(variables.response);
      queryClient.invalidateQueries({ queryKey: ["/api/rsvps/itinerary", itineraryId] });
      toast({
        title: "RSVP recorded",
        description: "Your response has been saved",
      });
      setShowFeedbackForm(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRsvp = (response: string) => {
    if (response === "yes") {
      rsvpMutation.mutate({ response });
    } else {
      setSelectedResponse(response);
      setShowFeedbackForm(true);
    }
  };

  const handleSubmitFeedback = () => {
    const feedback: any = {};
    
    if (tryDifferentDay) feedback.tryDifferentDay = true;
    if (tryEarlier) feedback.tryEarlier = true;
    if (tryLater) feedback.tryLater = true;
    if (notThisWeek) feedback.notThisWeek = true;
    if (unavailableDays.trim()) {
      feedback.unavailableOn = unavailableDays.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (freeformFeedback.trim()) {
      feedback.freeformFeedback = freeformFeedback.trim();
    }

    rsvpMutation.mutate({ 
      response: selectedResponse!, 
      feedback: Object.keys(feedback).length > 0 ? feedback : undefined 
    });
  };

  // Loading state
  if (itineraryLoading || groupLoading || verifyingToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (!itinerary || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Event not found</CardTitle>
            <CardDescription>This event link may be invalid or expired</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (verifyError || !memberData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              This RSVP link is invalid or has expired. Please contact the organizer for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 py-8 space-y-6">
        {/* Event Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">{group.emoji}</div>
          <h1 className="text-3xl font-bold">{itinerary.name}</h1>
          <p className="text-muted-foreground">from {group.name}</p>
          <p className="text-sm text-muted-foreground">RSVP for {memberData.name}</p>
        </div>

        {/* Event Date/Time */}
        {itinerary.eventDate && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 justify-center">
                <div className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="font-semibold">
                    {format(new Date(itinerary.eventDate), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold">
                    {format(new Date(itinerary.eventDate), "h:mm a")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Itinerary Items */}
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>Here's what we'll do</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itinerary.items.map((item, idx) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                      {idx + 1}
                    </div>
                    {idx < itinerary.items.length - 1 && (
                      <div className="flex-1 w-px bg-border my-1"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <h4 className="font-semibold">{item.venueName}</h4>
                    <p className="text-sm text-muted-foreground">{item.venueType}</p>
                    {item.venueAddress && (
                      <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="text-xs">{item.venueAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RSVP Section */}
        {showFeedbackForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Help us reschedule</CardTitle>
              <CardDescription>
                Let us know your constraints so we can find a better time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="try-different-day"
                    checked={tryDifferentDay}
                    onCheckedChange={(checked) => setTryDifferentDay(checked as boolean)}
                    data-testid="checkbox-try-different-day"
                  />
                  <Label htmlFor="try-different-day">Try a different day of the week</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="try-earlier"
                    checked={tryEarlier}
                    onCheckedChange={(checked) => setTryEarlier(checked as boolean)}
                    data-testid="checkbox-try-earlier"
                  />
                  <Label htmlFor="try-earlier">Try an earlier time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="try-later"
                    checked={tryLater}
                    onCheckedChange={(checked) => setTryLater(checked as boolean)}
                    data-testid="checkbox-try-later"
                  />
                  <Label htmlFor="try-later">Try a later time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="not-this-week"
                    checked={notThisWeek}
                    onCheckedChange={(checked) => setNotThisWeek(checked as boolean)}
                    data-testid="checkbox-not-this-week"
                  />
                  <Label htmlFor="not-this-week">Not this week</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unavailable-days">Days I'm unavailable (optional)</Label>
                <input
                  id="unavailable-days"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="e.g., Monday, Thursday"
                  value={unavailableDays}
                  onChange={(e) => setUnavailableDays(e.target.value)}
                  data-testid="input-unavailable-days"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Additional notes (optional)</Label>
                <Textarea
                  id="feedback"
                  placeholder="Any other constraints or preferences?"
                  value={freeformFeedback}
                  onChange={(e) => setFreeformFeedback(e.target.value)}
                  data-testid="textarea-feedback"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={rsvpMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-feedback"
                >
                  {rsvpMutation.isPending ? "Submitting..." : "Submit Response"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFeedbackForm(false)}
                  data-testid="button-cancel-feedback"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Can you make it?</CardTitle>
              <CardDescription>
                {selectedResponse 
                  ? "You can update your response anytime" 
                  : "Let us know if you can join"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Button
                  variant={selectedResponse === "yes" ? "default" : "outline"}
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => handleRsvp("yes")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-yes"
                >
                  <Check className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">Yes, I'll be there!</div>
                    <div className="text-xs text-muted-foreground">Count me in</div>
                  </div>
                </Button>
                <Button
                  variant={selectedResponse === "maybe" ? "default" : "outline"}
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => handleRsvp("maybe")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-maybe"
                >
                  <HelpCircle className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">Maybe</div>
                    <div className="text-xs text-muted-foreground">Not sure about this time</div>
                  </div>
                </Button>
                <Button
                  variant={selectedResponse === "no" ? "default" : "outline"}
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => handleRsvp("no")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-no"
                >
                  <X className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">Can't make it</div>
                    <div className="text-xs text-muted-foreground">This time doesn't work</div>
                  </div>
                </Button>
              </div>

              {selectedResponse && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg text-sm">
                  <p className="font-medium text-primary">Your response: {
                    selectedResponse === "yes" ? "Going" :
                    selectedResponse === "maybe" ? "Maybe" :
                    "Can't make it"
                  }</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
