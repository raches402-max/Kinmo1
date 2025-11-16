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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Check, X, HelpCircle, User, Users, Baby } from "lucide-react";
import { format } from "date-fns";
import { TimeSlotVoting } from "@/components/TimeSlotVoting";

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
    rating: string | null;
    googleMapsUrl: string | null;
  }>;
  proposedTimeSlots?: Array<{
    id: string;
    proposedDateTime: string;
    label?: string;
    yesCount: number;
    maybeCount: number;
    noCount: number;
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
  guestName?: string | null;
  additionalAttendees?: Array<{type: 'member' | 'guest'; memberId?: string; name: string}> | null;
  numberOfKids?: number;
};

type AdditionalAttendee = {
  type: 'member' | 'guest';
  memberId?: string;
  name: string;
};

export default function RsvpItineraryPage() {
  const [, params] = useRoute("/rsvp/:itineraryId/:inviteToken");
  const itineraryId = params?.itineraryId;
  const inviteToken = params?.inviteToken;
  const { toast } = useToast();

  // Identity claiming state
  const [identityClaimed, setIdentityClaimed] = useState(false);
  const [claimedMemberId, setClaimedMemberId] = useState<string | null>(null);
  const [claimedIdentity, setClaimedIdentity] = useState<'member' | 'guest'>('member');
  const [guestName, setGuestName] = useState("");
  const [tempGuestName, setTempGuestName] = useState("");

  // RSVP state
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Additional attendees and kids state
  const [additionalAttendeeType, setAdditionalAttendeeType] = useState<'none' | 'member' | 'guest'>('none');
  const [additionalMemberId, setAdditionalMemberId] = useState<string>("");
  const [additionalGuestName, setAdditionalGuestName] = useState("");
  const [numberOfKids, setNumberOfKids] = useState(0);

  // Feedback form state
  const [tryDifferentDay, setTryDifferentDay] = useState(false);
  const [tryEarlier, setTryEarlier] = useState(false);
  const [tryLater, setTryLater] = useState(false);
  const [notThisWeek, setNotThisWeek] = useState(false);
  const [unavailableDays, setUnavailableDays] = useState("");
  const [freeformFeedback, setFreeformFeedback] = useState("");

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

  // Fetch group members for identity claiming
  const { data: groupMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/groups", itinerary?.groupId, "members"],
    enabled: !!itinerary?.groupId,
  });

  // Fetch existing RSVP - only if identity is claimed
  const { data: existingRsvp } = useQuery<RsvpData>({
    queryKey: ["/api/rsvps/itinerary", itineraryId, "member", claimedMemberId, "token", inviteToken],
    queryFn: async () => {
      if (!claimedMemberId || claimedIdentity === 'guest') return null;
      const url = `/api/rsvps/itinerary/${itineraryId}/member/${claimedMemberId}?inviteToken=${inviteToken}`;
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!itineraryId && !!claimedMemberId && !!inviteToken && identityClaimed && claimedIdentity === 'member',
  });

  // Update local response state when existing RSVP loads
  useEffect(() => {
    if (existingRsvp?.response) {
      setSelectedResponse(existingRsvp.response);
      if (existingRsvp.numberOfKids !== undefined) {
        setNumberOfKids(existingRsvp.numberOfKids);
      }
      if (existingRsvp.additionalAttendees && existingRsvp.additionalAttendees.length > 0) {
        const attendee = existingRsvp.additionalAttendees[0];
        setAdditionalAttendeeType(attendee.type);
        if (attendee.type === 'member' && attendee.memberId) {
          setAdditionalMemberId(attendee.memberId);
        } else if (attendee.type === 'guest') {
          setAdditionalGuestName(attendee.name);
        }
      }
    }
  }, [existingRsvp]);

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async ({ response, feedback }: { response: string; feedback?: any }) => {
      // Build additional attendees array
      let additionalAttendees: AdditionalAttendee[] | null = null;
      if (additionalAttendeeType === 'member' && additionalMemberId) {
        const member = groupMembers?.find(m => m.id === additionalMemberId);
        if (member) {
          additionalAttendees = [{
            type: 'member',
            memberId: member.id,
            name: member.name || member.email || 'Unknown',
          }];
        }
      } else if (additionalAttendeeType === 'guest' && additionalGuestName.trim()) {
        additionalAttendees = [{
          type: 'guest',
          name: additionalGuestName.trim(),
        }];
      }

      return await apiRequest("POST", `/api/rsvps`, {
        itineraryId,
        inviteToken,
        claimedMemberId: claimedIdentity === 'member' ? claimedMemberId : null,
        guestName: claimedIdentity === 'guest' ? guestName : null,
        response,
        rsvpFeedback: feedback,
        additionalAttendees,
        numberOfKids,
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

  const handleContinueIdentity = () => {
    if (claimedIdentity === 'guest') {
      if (!tempGuestName.trim()) {
        toast({
          title: "Name required",
          description: "Please enter your name",
          variant: "destructive",
        });
        return;
      }
      setGuestName(tempGuestName.trim());
    } else if (!claimedMemberId) {
      toast({
        title: "Selection required",
        description: "Please select who you are",
        variant: "destructive",
      });
      return;
    }
    setIdentityClaimed(true);
  };

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

  // Get display name based on claimed identity
  const getDisplayName = () => {
    if (claimedIdentity === 'guest') {
      return guestName;
    } else if (claimedMemberId) {
      const member = groupMembers?.find(m => m.id === claimedMemberId);
      return member?.name || member?.email || 'Unknown';
    }
    return '';
  };

  // Get available members for additional attendees (exclude claimed member)
  const availableMembers = groupMembers?.filter(m => m.id !== claimedMemberId) || [];

  // Loading state
  if (itineraryLoading || groupLoading || membersLoading) {
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

  // Step 1: Identity Claiming (show first, before event details)
  if (!identityClaimed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
          {/* Event Header */}
          <div className="text-center space-y-2">
            <div className="text-4xl mb-2">{group.emoji}</div>
            <h1 className="text-3xl font-bold">{itinerary.name}</h1>
            <p className="text-muted-foreground">from {group.name}</p>
          </div>

          {/* Identity Claiming Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Who's RSVPing?
              </CardTitle>
              <CardDescription>
                Select your name from the list or enter as a guest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={claimedMemberId || 'guest'}
                onValueChange={(value) => {
                  if (value === 'guest') {
                    setClaimedIdentity('guest');
                    setClaimedMemberId(null);
                  } else {
                    setClaimedIdentity('member');
                    setClaimedMemberId(value);
                  }
                }}
              >
                {groupMembers && groupMembers.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Group Members</Label>
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value={member.id} 
                          id={`member-${member.id}`}
                          data-testid={`radio-member-${member.id}`}
                        />
                        <Label htmlFor={`member-${member.id}`} className="cursor-pointer">
                          I'm {member.name || member.email}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="guest" id="guest" data-testid="radio-guest" />
                    <Label htmlFor="guest" className="cursor-pointer">
                      I'm a guest
                    </Label>
                  </div>
                  
                  {claimedIdentity === 'guest' && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="guest-name">Your name</Label>
                      <Input
                        id="guest-name"
                        placeholder="Enter your name"
                        value={tempGuestName}
                        onChange={(e) => setTempGuestName(e.target.value)}
                        data-testid="input-guest-name"
                      />
                    </div>
                  )}
                </div>
              </RadioGroup>

              <Button 
                onClick={handleContinueIdentity}
                className="w-full"
                data-testid="button-continue-identity"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2+: Show full event details and RSVP
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 py-8 space-y-6">
        {/* Event Header with claimed identity */}
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">{group.emoji}</div>
          <h1 className="text-3xl font-bold">{itinerary.name}</h1>
          <p className="text-muted-foreground">from {group.name}</p>
          <p className="text-sm text-muted-foreground" data-testid="text-claimed-identity">
            {claimedIdentity === 'guest' ? `RSVP as guest: ${guestName}` : `RSVP for ${getDisplayName()}`}
          </p>
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

        {/* Time Slot Voting */}
        {itinerary.proposedTimeSlots && itinerary.proposedTimeSlots.length > 0 && claimedMemberId && (
          <Card>
            <CardContent className="pt-6">
              <TimeSlotVoting 
                itineraryId={itinerary.id}
                memberId={claimedMemberId}
                isOrganizer={false}
              />
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
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold">{item.venueName}</h4>
                      {item.rating && (
                        <span className="text-sm text-muted-foreground shrink-0">⭐ {item.rating}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.venueType}</p>
                    {item.venueAddress && (
                      <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="text-xs">{item.venueAddress}</span>
                      </div>
                    )}
                    {item.googleMapsUrl && (
                      <a
                        href={item.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        <MapPin className="h-3 w-3" />
                        Open in Google Maps
                      </a>
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
                <Input
                  id="unavailable-days"
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
          <>
            {/* RSVP Response Buttons */}
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

            {/* Additional Attendees and Kids Count - Only show after selecting a response */}
            {selectedResponse === "yes" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Additional Details
                  </CardTitle>
                  <CardDescription>
                    Let us know if you're bringing anyone else
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Additional Attendees */}
                  <div className="space-y-3">
                    <Label htmlFor="additional-attendee" className="text-base font-semibold">
                      Also RSVPing for (optional)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Maximum 2 people total including yourself
                    </p>
                    
                    <Select
                      value={additionalAttendeeType}
                      onValueChange={(value: 'none' | 'member' | 'guest') => {
                        setAdditionalAttendeeType(value);
                        if (value === 'none') {
                          setAdditionalMemberId("");
                          setAdditionalGuestName("");
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-additional-attendee-type">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No one else</SelectItem>
                        <SelectItem value="member">A group member</SelectItem>
                        <SelectItem value="guest">A guest</SelectItem>
                      </SelectContent>
                    </Select>

                    {additionalAttendeeType === 'member' && (
                      <div className="space-y-2">
                        <Label htmlFor="additional-member">Select member</Label>
                        <Select
                          value={additionalMemberId}
                          onValueChange={setAdditionalMemberId}
                        >
                          <SelectTrigger data-testid="select-additional-member">
                            <SelectValue placeholder="Choose a member" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name || member.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {additionalAttendeeType === 'guest' && (
                      <div className="space-y-2">
                        <Label htmlFor="additional-guest-name">Guest name</Label>
                        <Input
                          id="additional-guest-name"
                          placeholder="Enter guest name"
                          value={additionalGuestName}
                          onChange={(e) => setAdditionalGuestName(e.target.value)}
                          data-testid="input-additional-guest-name"
                        />
                      </div>
                    )}
                  </div>

                  {/* Kids Count */}
                  <div className="space-y-3">
                    <Label htmlFor="kids-count" className="text-base font-semibold flex items-center gap-2">
                      <Baby className="h-4 w-4" />
                      Number of kids (optional)
                    </Label>
                    <Input
                      id="kids-count"
                      type="number"
                      min="0"
                      max="10"
                      value={numberOfKids}
                      onChange={(e) => setNumberOfKids(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                      data-testid="input-kids-count"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ages 0-12
                    </p>
                  </div>

                  {/* Submit Button for Additional Details */}
                  <Button
                    onClick={() => rsvpMutation.mutate({ response: selectedResponse })}
                    disabled={rsvpMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-rsvp"
                  >
                    {rsvpMutation.isPending ? "Saving..." : "Save RSVP"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
