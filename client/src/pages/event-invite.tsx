/**
 * Event Invite Page - Phase 1: Event-by-Event Invite System
 *
 * Supports two flows:
 * 1. Personalized: /event/:eventId/invite?member=:memberId (has email, name pre-filled)
 * 2. Generic: /event/:eventId/invite (no email, select name from dropdown)
 *
 * Members can RSVP without accounts and provide event-specific feedback
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Check, X, HelpCircle, Clock, ExternalLink, Sparkles, Users } from "lucide-react";
import { format } from "date-fns";

type Member = {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
};

type ItineraryItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
  rating: string | null;
  googleMapsUrl: string | null;
  orderIndex: number;
};

type Itinerary = {
  id: string;
  name: string;
  groupId: string;
  groupName?: string;
  groupEmoji?: string;
  eventDate: string | null;
  items: ItineraryItem[];
};

type RsvpResponse = {
  response: "going" | "maybe" | "not_going";
  feedbackText?: string;
  alternativeDays?: string;
  alternativeTimes?: string;
};

type RsvpRecord = {
  memberId: string;
  memberName?: string;
  response: string;
};

type Attendee = {
  name: string;
  initials: string;
  response: string;
  isHost: boolean;
};

export default function EventInvitePage() {
  const [, params] = useRoute("/event/:eventId/invite");
  const eventId = params?.eventId;
  const search = useSearch();
  const memberId = new URLSearchParams(search).get("member");
  const { toast } = useToast();

  // Member selection state (for generic links)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(memberId);
  const [memberSelectionComplete, setMemberSelectionComplete] = useState(!!memberId);

  // RSVP state
  const [rsvpResponse, setRsvpResponse] = useState<"going" | "maybe" | "not_going" | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [alternativeDays, setAlternativeDays] = useState("");
  const [alternativeTimes, setAlternativeTimes] = useState("");
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  // Fetch event/itinerary
  const { data: event, isLoading: eventLoading, error: eventError } = useQuery<Itinerary>({
    queryKey: [`/api/itineraries/${eventId}`],
    enabled: !!eventId,
  });

  // Fetch group members (for name selection dropdown)
  const { data: groupMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: [`/api/groups/${event?.groupId}/members`],
    enabled: !!event?.groupId && !memberId, // Only load if this is a generic link
  });

  // Fetch selected member details
  const { data: member } = useQuery<Member>({
    queryKey: [`/api/members/${selectedMemberId}`],
    enabled: !!selectedMemberId,
  });

  // Fetch existing RSVP to check if already responded
  const { data: existingRsvp } = useQuery<{ response: string } | null>({
    queryKey: [`/api/rsvps/itinerary/${eventId}/member/${selectedMemberId}`],
    enabled: !!eventId && !!selectedMemberId && memberSelectionComplete,
  });

  // Fetch all RSVPs for this event (to show who's coming)
  const { data: rsvps } = useQuery<RsvpRecord[]>({
    queryKey: [`/api/itineraries/${eventId}/rsvps`],
    enabled: !!eventId && memberSelectionComplete,
  });

  // Transform RSVPs to attendees format
  const attendees = useMemo((): Attendee[] => {
    if (!rsvps) return [];
    return rsvps
      .filter(r => r.response && r.response !== 'pending')
      .map(r => {
        const name = r.memberName || 'Unknown';
        return {
          name,
          initials: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          response: r.response === 'going' ? 'yes' : r.response === 'not_going' ? 'no' : r.response,
          isHost: false,
        };
      });
  }, [rsvps]);

  const goingCount = attendees.filter(a => a.response === 'yes' || a.response === 'going').length;
  const maybeCount = attendees.filter(a => a.response === 'maybe').length;

  // Initialize response from existing RSVP
  useEffect(() => {
    if (existingRsvp?.response) {
      setRsvpResponse(existingRsvp.response as "going" | "maybe" | "not_going");
    }
  }, [existingRsvp]);

  // Save member selection to localStorage for next time
  useEffect(() => {
    if (selectedMemberId && event?.groupId) {
      localStorage.setItem(`lastMemberSelection_${event.groupId}`, selectedMemberId);
    }
  }, [selectedMemberId, event?.groupId]);

  // Try to restore member selection from localStorage
  useEffect(() => {
    if (!memberId && event?.groupId && !selectedMemberId) {
      const lastSelection = localStorage.getItem(`lastMemberSelection_${event.groupId}`);
      if (lastSelection) {
        setSelectedMemberId(lastSelection);
      }
    }
  }, [event?.groupId, memberId, selectedMemberId]);

  // RSVP submission mutation
  const rsvpMutation = useMutation({
    mutationFn: async (data: RsvpResponse) => {
      if (!selectedMemberId) {
        throw new Error("Please select your name first");
      }

      const response = await fetch(`/api/itineraries/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          memberId: selectedMemberId,
          response: data.response,
          rsvpFeedback: {
            feedbackText: data.feedbackText,
            alternativeDays: data.alternativeDays,
            alternativeTimes: data.alternativeTimes,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit RSVP");
      }

      return response.json();
    },
    onSuccess: () => {
      setRsvpSubmitted(true);
      toast({
        title: "RSVP Submitted!",
        description: `You're all set for ${event?.name || "this event"}!`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleRsvpClick = (response: "going" | "maybe" | "not_going") => {
    setRsvpResponse(response);

    // Show feedback form for "maybe" and "not_going"
    if (response === "maybe" || response === "not_going") {
      setShowFeedbackForm(true);
    } else {
      // For "going", submit immediately
      rsvpMutation.mutate({ response });
    }
  };

  const handleFeedbackSubmit = () => {
    if (!rsvpResponse) return;

    rsvpMutation.mutate({
      response: rsvpResponse,
      feedbackText,
      alternativeDays,
      alternativeTimes,
    });
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMemberId(memberId);
    setMemberSelectionComplete(true);
  };

  // Loading states
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-48 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-12 text-center">
            <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
            <p className="text-gray-600">This event invite link may be invalid or expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Member selection screen (for generic links)
  if (!memberSelectionComplete && !memberId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {event.groupEmoji} {event.groupName || "Group Event"}
            </CardTitle>
            <CardDescription>
              {event.name}
              {event.eventDate && (
                <span className="block mt-1">
                  {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="member-select">Who are you?</Label>
              <Select onValueChange={handleMemberSelect}>
                <SelectTrigger id="member-select">
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {membersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading members...
                    </SelectItem>
                  ) : groupMembers && groupMembers.length > 0 ? (
                    groupMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No members found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success screen
  if (rsvpSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-12 text-center">
            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-gray-600 mb-6">
              Your RSVP for {event.name} has been submitted.
              {rsvpResponse !== "going" && feedbackText && (
                <span className="block mt-2 text-sm">
                  Your feedback has been shared with the organizer.
                </span>
              )}
            </p>

            {/* Create Account CTA */}
            <Card className="bg-blue-50 border-blue-200 p-6 text-left">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-1">
                    Create an account to see all upcoming {event.groupName} events
                  </h3>
                  <p className="text-sm text-blue-800 mb-4">
                    View all past and future events in one place, set your preferences, and influence future scheduling.
                  </p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      // Store memberId for account linking
                      if (selectedMemberId) {
                        localStorage.setItem("linkMemberId", selectedMemberId);
                        localStorage.setItem("linkReturnPath", `/event/${eventId}/invite?member=${selectedMemberId}`);
                      }
                      // Redirect to auth with return to link page
                      window.location.href = "/auth/replit?redirect=" + encodeURIComponent("/link-member-account");
                    }}
                  >
                    Create Account
                  </Button>
                </div>
              </div>
            </Card>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main RSVP screen
  const selectedMember = member || (groupMembers?.find(m => m.id === selectedMemberId));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Event Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2 mb-1">
                  {event.groupEmoji} {event.name}
                </CardTitle>
                {event.groupName && event.groupName !== event.name && (
                  <CardDescription className="text-base">
                    {event.groupName}
                  </CardDescription>
                )}
              </div>
            </div>
            {event.eventDate && (
              <div className="flex items-center gap-2 text-lg font-medium mt-4">
                <Calendar className="h-5 w-5 text-gray-500" />
                {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Itinerary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Itinerary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event.items
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{item.venueName}</h4>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                        {item.venueType}
                      </span>
                      {item.rating && (
                        <span className="text-sm text-gray-600">⭐ {item.rating}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{item.venueAddress}</span>
                    </div>
                    {item.googleMapsUrl && (
                      <a
                        href={item.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        View on Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Who's Coming Section */}
        {attendees.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Who's Coming</CardTitle>
                  <CardDescription>
                    {goingCount > 0 && `${goingCount} going`}
                    {goingCount > 0 && maybeCount > 0 && ' · '}
                    {maybeCount > 0 && `${maybeCount} maybe`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {attendee.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate">{attendee.name}</span>
                    </div>
                    <div className="flex-shrink-0">
                      {(attendee.response === 'yes' || attendee.response === 'going') && (
                        <div className="flex items-center gap-1.5 text-green-700 text-sm px-2 py-1 rounded-full bg-green-50">
                          <Check className="h-3.5 w-3.5" />
                          <span>Going</span>
                        </div>
                      )}
                      {attendee.response === 'maybe' && (
                        <div className="flex items-center gap-1.5 text-amber-700 text-sm px-2 py-1 rounded-full bg-amber-50">
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Maybe</span>
                        </div>
                      )}
                      {(attendee.response === 'no' || attendee.response === 'not_going') && (
                        <div className="flex items-center gap-1.5 text-red-700 text-sm px-2 py-1 rounded-full bg-red-50">
                          <X className="h-3.5 w-3.5" />
                          <span>Can't go</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RSVP Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedMember?.name ? `Hey ${selectedMember.name}!` : "RSVP"}
            </CardTitle>
            <CardDescription>
              {showFeedbackForm
                ? "Help us make this work better for you"
                : "Can you make it?"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!showFeedbackForm ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  size="lg"
                  variant={rsvpResponse === "going" ? "default" : "outline"}
                  className="h-20"
                  onClick={() => handleRsvpClick("going")}
                  disabled={rsvpMutation.isPending}
                >
                  <Check className="h-5 w-5 mr-2" />
                  <span className="text-lg">I'll be there!</span>
                </Button>
                <Button
                  size="lg"
                  variant={rsvpResponse === "maybe" ? "default" : "outline"}
                  className="h-20"
                  onClick={() => handleRsvpClick("maybe")}
                  disabled={rsvpMutation.isPending}
                >
                  <HelpCircle className="h-5 w-5 mr-2" />
                  <span className="text-lg">Maybe</span>
                </Button>
                <Button
                  size="lg"
                  variant={rsvpResponse === "not_going" ? "default" : "outline"}
                  className="h-20"
                  onClick={() => handleRsvpClick("not_going")}
                  disabled={rsvpMutation.isPending}
                >
                  <X className="h-5 w-5 mr-2" />
                  <span className="text-lg">Can't make it</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="feedback">
                    {rsvpResponse === "maybe"
                      ? "What would make this work better for you?"
                      : "What would work better?"}
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder={
                      rsvpResponse === "maybe"
                        ? "e.g., Earlier time, different venue, etc."
                        : "Let us know what times or days would work better"
                    }
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>

                {rsvpResponse === "not_going" && (
                  <>
                    <div>
                      <Label htmlFor="alt-days">Would these days work instead?</Label>
                      <Textarea
                        id="alt-days"
                        placeholder="e.g., Friday or Saturday this week"
                        value={alternativeDays}
                        onChange={(e) => setAlternativeDays(e.target.value)}
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="alt-times">Would these times work better?</Label>
                      <Textarea
                        id="alt-times"
                        placeholder="e.g., 6pm instead of 8pm"
                        value={alternativeTimes}
                        onChange={(e) => setAlternativeTimes(e.target.value)}
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={rsvpMutation.isPending}
                    className="flex-1"
                  >
                    {rsvpMutation.isPending ? "Submitting..." : "Submit RSVP"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setRsvpResponse(null);
                      setFeedbackText("");
                      setAlternativeDays("");
                      setAlternativeTimes("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email CTA (for members without email) */}
        {selectedMember && !selectedMember.email && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                Help reduce the manual lift for your organizer
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                Add your email address, and we'll let you know when the next{" "}
                {event.groupName} event is directly—so your organizer doesn't have to drop
                it into the group thread every time.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/member-profile-setup?member=${selectedMemberId}`}>
                  Add Email Address
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Account CTA */}
        {!rsvpSubmitted && (
          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-1">
                    Create an account to see all upcoming events
                  </h3>
                  <p className="text-sm text-purple-800 mb-3">
                    View all past and future {event.groupName} events in one place, set
                    standing preferences, and influence future scheduling.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Store memberId for account linking
                      if (selectedMemberId) {
                        localStorage.setItem("linkMemberId", selectedMemberId);
                        localStorage.setItem("linkReturnPath", `/event/${eventId}/invite?member=${selectedMemberId}`);
                      }
                      // Redirect to auth with return to link page
                      window.location.href = "/auth/replit?redirect=" + encodeURIComponent("/link-member-account");
                    }}
                  >
                    Create Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
