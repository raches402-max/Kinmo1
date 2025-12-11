/**
 * Event Invite Page - Unified RSVP flow for members and guests
 *
 * Supports:
 * 1. Personalized: /event/:eventId/invite?member=:memberId
 * 2. Generic: /event/:eventId/invite (select name or join as guest)
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useSearch, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Users,
  Star,
  Clock,
  ChevronRight,
  UserPlus,
  ArrowLeft,
  CalendarPlus,
} from "lucide-react";
import { format } from "date-fns";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";
import { useKinmoConfetti } from "@/hooks/useKinmoConfetti";

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
  googlePlaceId: string | null;
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
  guestName?: string;
  response: string;
};

type Attendee = {
  name: string;
  initials: string;
  response: string;
  isGuest: boolean;
};

// Helper to generate Google Maps URL
function getGoogleMapsUrl(item: ItineraryItem): string | null {
  if (item.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.venueName || item.venueAddress || 'Location')}&query_place_id=${item.googlePlaceId}`;
  }
  if (item.googleMapsUrl) {
    return item.googleMapsUrl;
  }
  if (item.venueAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.venueAddress)}`;
  }
  return null;
}

// Get initials from name
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function EventInvitePage() {
  const [, params] = useRoute("/event/:eventId/invite");
  const eventId = params?.eventId;
  const search = useSearch();
  const memberId = new URLSearchParams(search).get("member");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selection mode: 'choose' | 'member' | 'guest'
  const [mode, setMode] = useState<'choose' | 'member' | 'guest'>(memberId ? 'member' : 'choose');

  // Member selection state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(memberId);

  // Guest state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  // RSVP state
  const [rsvpResponse, setRsvpResponse] = useState<"going" | "maybe" | "not_going" | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [alternativeDays, setAlternativeDays] = useState("");
  const [alternativeTimes, setAlternativeTimes] = useState("");
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  // Stored RSVP token for returning users
  const [storedRsvpToken, setStoredRsvpToken] = useState<string | null>(null);

  // Kinmo confetti celebration - auto-fires when RSVP is submitted
  useKinmoConfetti({ autoFire: rsvpSubmitted, autoFireDelay: 150 });

  // Check for stored RSVP token on mount
  useEffect(() => {
    if (eventId) {
      const token = localStorage.getItem(`rsvp_token_${eventId}`);
      if (token) {
        setStoredRsvpToken(token);
      }
    }
  }, [eventId]);

  // Fetch event/itinerary
  const { data: event, isLoading: eventLoading, error: eventError } = useQuery<Itinerary>({
    queryKey: [`/api/itineraries/${eventId}`],
    enabled: !!eventId,
  });

  // Fetch group members (for name selection)
  const { data: groupMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: [`/api/groups/${event?.groupId}/members`],
    enabled: !!event?.groupId && !memberId,
  });

  // Fetch selected member details
  const { data: member } = useQuery<Member>({
    queryKey: [`/api/members/${selectedMemberId}`],
    enabled: !!selectedMemberId,
  });

  // Fetch all RSVPs for this event
  const { data: rsvps } = useQuery<RsvpRecord[]>({
    queryKey: [`/api/itineraries/${eventId}/rsvps`],
    enabled: !!eventId && mode !== 'choose',
  });

  // Fetch existing RSVP by stored token (for returning users)
  type StoredRsvpData = {
    id: string;
    response: string;
    guestName?: string;
    guestEmail?: string;
    memberId?: string;
    memberName?: string;
  };
  const { data: storedRsvp, isLoading: storedRsvpLoading } = useQuery<StoredRsvpData>({
    queryKey: [`/api/guest-rsvp/${storedRsvpToken}`],
    enabled: !!storedRsvpToken && mode === 'choose',
  });

  // Get existing RSVP from the RSVPs list
  const existingRsvp = useMemo(() => {
    if (!rsvps || !selectedMemberId) return null;
    const myRsvp = rsvps.find(r => r.memberId === selectedMemberId);
    return myRsvp ? { response: myRsvp.response } : null;
  }, [rsvps, selectedMemberId]);

  // Transform RSVPs to attendees format
  const attendees = useMemo((): Attendee[] => {
    if (!rsvps) return [];
    return rsvps
      .filter(r => r.response && r.response !== 'pending')
      .map(r => {
        const name = r.memberName || r.guestName || 'Unknown';
        return {
          name,
          initials: getInitials(name),
          response: r.response === 'going' ? 'yes' : r.response === 'not_going' ? 'no' : r.response,
          isGuest: !r.memberId,
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

  // Save member selection to localStorage
  useEffect(() => {
    if (selectedMemberId && event?.groupId) {
      localStorage.setItem(`lastMemberSelection_${event.groupId}`, selectedMemberId);
    }
  }, [selectedMemberId, event?.groupId]);

  // Restore member selection from localStorage
  useEffect(() => {
    if (!memberId && event?.groupId && !selectedMemberId && mode === 'choose') {
      const lastSelection = localStorage.getItem(`lastMemberSelection_${event.groupId}`);
      if (lastSelection && groupMembers?.some(m => m.id === lastSelection)) {
        // Don't auto-select, but we could highlight the last selection
      }
    }
  }, [event?.groupId, memberId, selectedMemberId, groupMembers, mode]);

  // Member RSVP mutation
  const memberRsvpMutation = useMutation({
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
    onSuccess: (data) => {
      setRsvpSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/itineraries/${eventId}/rsvps`] });
      // Store RSVP token for returning users
      if (data?.guestToken && eventId) {
        localStorage.setItem(`rsvp_token_${eventId}`, data.guestToken);
      }
      toast({
        title: "RSVP Submitted!",
        description: `You're all set for ${event?.name || "this event"}!`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Guest RSVP mutation
  const guestRsvpMutation = useMutation({
    mutationFn: async (data: RsvpResponse) => {
      if (!guestName.trim()) {
        throw new Error("Please enter your name");
      }

      const response = await fetch(`/api/itineraries/${eventId}/guest-rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || null,
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
    onSuccess: (data) => {
      setRsvpSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/itineraries/${eventId}/rsvps`] });
      // Store RSVP token for returning users
      if (data?.guestToken && eventId) {
        localStorage.setItem(`rsvp_token_${eventId}`, data.guestToken);
      }
      toast({
        title: "RSVP Submitted!",
        description: `Thanks for letting us know, ${guestName}!`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const isPending = memberRsvpMutation.isPending || guestRsvpMutation.isPending;

  const handleMemberSelect = (id: string) => {
    setSelectedMemberId(id);
    setMode('member');
  };

  const handleGuestMode = () => {
    setMode('guest');
  };

  const handleBack = () => {
    setMode('choose');
    setSelectedMemberId(null);
    setGuestName("");
    setGuestEmail("");
    setRsvpResponse(null);
    setShowFeedbackForm(false);
  };

  const handleRsvpClick = (response: "going" | "maybe" | "not_going") => {
    setRsvpResponse(response);

    if (response === "maybe" || response === "not_going") {
      setShowFeedbackForm(true);
    } else {
      // Submit immediately for "going"
      if (mode === 'member') {
        memberRsvpMutation.mutate({ response });
      } else if (mode === 'guest') {
        if (!guestName.trim()) {
          toast({
            title: "Name required",
            description: "Please enter your name to RSVP",
            variant: "destructive",
          });
          return;
        }
        guestRsvpMutation.mutate({ response });
      }
    }
  };

  const handleFeedbackSubmit = () => {
    if (!rsvpResponse) return;

    const data = {
      response: rsvpResponse,
      feedbackText,
      alternativeDays,
      alternativeTimes,
    };

    if (mode === 'member') {
      memberRsvpMutation.mutate(data);
    } else if (mode === 'guest') {
      if (!guestName.trim()) {
        toast({
          title: "Name required",
          description: "Please enter your name to RSVP",
          variant: "destructive",
        });
        return;
      }
      guestRsvpMutation.mutate(data);
    }
  };

  // Loading state
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <X className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
            <p className="text-muted-foreground">This event invite link may be invalid or expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Member/Guest selection screen
  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1 bg-primary" />

        <div className="max-w-md mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
              <span className="text-3xl">{event.groupEmoji || '🎉'}</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
            {event.groupName && (
              <p className="text-muted-foreground">{event.groupName}</p>
            )}
            {event.eventDate && (
              <p className="text-muted-foreground mt-2">
                {format(new Date(event.eventDate), "EEEE, MMMM d 'at' h:mm a")}
              </p>
            )}
          </div>

          {/* Existing RSVP found - show status */}
          {storedRsvp && (
            <Card className="mb-4 border-success/30 bg-success/5">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="h-6 w-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-success">You've already RSVP'd!</p>
                    <p className="text-sm text-muted-foreground">
                      {storedRsvp.guestName || storedRsvp.memberName || 'You'} responded: {' '}
                      <span className="font-medium">
                        {storedRsvp.response === 'going' || storedRsvp.response === 'yes' ? 'Going' :
                         storedRsvp.response === 'maybe' ? 'Maybe' : "Can't go"}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Want to change your response? Select your name below.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Who are you? */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-center">
                {storedRsvp ? "Change your RSVP" : "Who are you?"}
              </CardTitle>
              <CardDescription className="text-center">
                {storedRsvp ? "Select your name to update your response" : "Tap your name to RSVP"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {membersLoading || storedRsvpLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Member buttons */}
                  {groupMembers && groupMembers.length > 0 && (
                    <div className="space-y-2">
                      {groupMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMemberSelect(m.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium flex-1">{m.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  {/* Guest option */}
                  <button
                    onClick={handleGuestMode}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">I'm someone else</span>
                      <p className="text-xs text-muted-foreground">Join as a guest for this event</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              Powered by <span className="font-semibold text-primary">Kinmo</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (rsvpSubmitted) {
    const displayName = mode === 'member' ? member?.name : guestName;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="mb-6">
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-success flex items-center justify-center animate-pulse"
              style={{
                boxShadow: '0 0 30px rgba(242, 201, 76, 0.4), 0 0 60px rgba(242, 201, 76, 0.2)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <Check className="h-10 w-10 text-success-foreground" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-bold mb-2">You're All Set!</h1>
            <p className="text-muted-foreground">
              {displayName && `Thanks ${displayName.split(' ')[0]}! `}
              Your RSVP for <span className="font-semibold text-foreground">{event.name}</span> has been submitted.
            </p>
            {rsvpResponse !== "going" && feedbackText && (
              <p className="text-muted-foreground text-sm mt-2">
                Your feedback has been shared with the organizer.
              </p>
            )}
          </div>

          {/* Event summary */}
          <Card className="mb-6 text-left">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{event.groupEmoji || '📅'}</span>
                <div>
                  <h3 className="font-semibold">{event.name}</h3>
                  {event.eventDate && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.eventDate), "EEEE, MMMM d 'at' h:mm a")}
                    </p>
                  )}
                </div>
              </div>
              {/* Add to Calendar link */}
              {event.eventDate && (
                <div className="mt-4 pt-4 border-t">
                  <a
                    href={generateCalendarUrlFromItinerary({
                      groupName: event.groupName || 'Event',
                      eventName: event.name,
                      eventDate: event.eventDate,
                      venues: event.items?.map(item => ({
                        venueName: item.venueName,
                        venueAddress: item.venueAddress,
                      })) || [],
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Add to Google Calendar
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Account CTA - only for members */}
          {mode === 'member' && (
            <Card className="bg-accent/10 border-accent/20 text-left">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      Find your {event.groupName} events
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Create an account to see all upcoming events in one place and get notified when new plans are made.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (selectedMemberId) {
                          localStorage.setItem("linkMemberId", selectedMemberId);
                          localStorage.setItem("linkReturnPath", `/event/${eventId}/invite?member=${selectedMemberId}`);
                        }
                        window.location.href = "/api/login?returnTo=" + encodeURIComponent("/link-member-account");
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

  // Main RSVP screen (for both member and guest modes)
  const selectedMember = member || (groupMembers?.find(m => m.id === selectedMemberId));
  const eventDate = event.eventDate ? new Date(event.eventDate) : null;
  const displayName = mode === 'member' ? selectedMember?.name : guestName;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1 bg-primary" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back button (if not from personalized link) */}
        {!memberId && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Change selection
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <span className="text-3xl">{event.groupEmoji || '🎉'}</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">{event.name}</h1>
          {event.groupName && event.groupName !== event.name && (
            <p className="text-muted-foreground">{event.groupName}</p>
          )}
        </div>

        {/* Guest name input (only in guest mode) */}
        {mode === 'guest' && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="guest-name" className="text-sm font-medium">Your name *</Label>
                    <Input
                      id="guest-name"
                      type="text"
                      placeholder="Enter your name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-email" className="text-sm font-medium">Email (optional)</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      placeholder="your@email.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      So the organizer can reach you if plans change
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date/Time Card */}
        {eventDate && (
          <Card className="mb-4">
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-primary uppercase">
                    {format(eventDate, "MMM")}
                  </span>
                  <span className="text-xl font-bold">
                    {format(eventDate, "d")}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">
                    {format(eventDate, eventDate < new Date() ? "EEEE, MMMM d, yyyy" : "EEEE, MMMM d")}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {format(eventDate, "h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Itinerary */}
        {event.items && event.items.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                The Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.items
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index) => {
                  const mapsUrl = getGoogleMapsUrl(item);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{item.venueName}</h3>
                          {item.rating && (
                            <span className="flex items-center gap-0.5 text-sm text-muted-foreground">
                              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                              {item.rating}
                            </span>
                          )}
                        </div>
                        {item.venueType && (
                          <span className="inline-block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1">
                            {item.venueType}
                          </span>
                        )}
                        {item.venueAddress && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{item.venueAddress}</p>
                        )}
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium mt-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View on Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}

        {/* Who's Coming */}
        {attendees.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Who's Coming
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {goingCount > 0 && `${goingCount} going`}
                  {goingCount > 0 && maybeCount > 0 && ' · '}
                  {maybeCount > 0 && `${maybeCount} maybe`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {attendees.map((attendee, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-sm font-semibold ${attendee.isGuest ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                      {attendee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium">
                    {attendee.name}
                    {attendee.isGuest && <span className="text-xs text-muted-foreground ml-1">(guest)</span>}
                  </span>
                  <div className="flex-shrink-0">
                    {(attendee.response === 'yes' || attendee.response === 'going') && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                        <Check className="h-3 w-3" />
                        Going
                      </span>
                    )}
                    {attendee.response === 'maybe' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                        <HelpCircle className="h-3 w-3" />
                        Maybe
                      </span>
                    )}
                    {(attendee.response === 'no' || attendee.response === 'not_going') && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                        <X className="h-3 w-3" />
                        Can't go
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* RSVP Section */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            {!showFeedbackForm ? (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">
                    {mode === 'member' && displayName
                      ? `Hey ${displayName.split(' ')[0]}!`
                      : "Can you make it?"}
                  </h2>
                  <p className="text-muted-foreground">
                    {existingRsvp ? "Tap to change your response" : "Let us know if you can join"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleRsvpClick("going")}
                    disabled={isPending || (mode === 'guest' && !guestName.trim())}
                    className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      rsvpResponse === "going"
                        ? "border-success bg-success/10"
                        : "border-border hover:border-success/50 hover:bg-success/5"
                    } ${isPending || (mode === 'guest' && !guestName.trim()) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      rsvpResponse === "going"
                        ? "bg-success text-success-foreground"
                        : "bg-success/10 text-success group-hover:bg-success/20"
                    }`}>
                      <Check className="h-6 w-6" />
                    </div>
                    <span className={`font-semibold ${rsvpResponse === "going" ? "text-success" : ""}`}>
                      Going
                    </span>
                  </button>

                  <button
                    onClick={() => handleRsvpClick("maybe")}
                    disabled={isPending || (mode === 'guest' && !guestName.trim())}
                    className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      rsvpResponse === "maybe"
                        ? "border-warning bg-warning/10"
                        : "border-border hover:border-warning/50 hover:bg-warning/5"
                    } ${isPending || (mode === 'guest' && !guestName.trim()) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      rsvpResponse === "maybe"
                        ? "bg-warning text-warning-foreground"
                        : "bg-warning/10 text-warning group-hover:bg-warning/20"
                    }`}>
                      <HelpCircle className="h-6 w-6" />
                    </div>
                    <span className={`font-semibold ${rsvpResponse === "maybe" ? "text-warning" : ""}`}>
                      Maybe
                    </span>
                  </button>

                  <button
                    onClick={() => handleRsvpClick("not_going")}
                    disabled={isPending || (mode === 'guest' && !guestName.trim())}
                    className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      rsvpResponse === "not_going"
                        ? "border-destructive bg-destructive/10"
                        : "border-border hover:border-destructive/50 hover:bg-destructive/5"
                    } ${isPending || (mode === 'guest' && !guestName.trim()) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      rsvpResponse === "not_going"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-destructive/10 text-destructive group-hover:bg-destructive/20"
                    }`}>
                      <X className="h-6 w-6" />
                    </div>
                    <span className={`font-semibold ${rsvpResponse === "not_going" ? "text-destructive" : ""}`}>
                      Can't Go
                    </span>
                  </button>
                </div>

                {mode === 'guest' && !guestName.trim() && (
                  <p className="text-center mt-4 text-sm text-muted-foreground">
                    Enter your name above to RSVP
                  </p>
                )}

                {isPending && (
                  <div className="text-center mt-4 text-muted-foreground">
                    Submitting your RSVP...
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold">
                    {rsvpResponse === "maybe" ? "What would help?" : "What would work better?"}
                  </h2>
                  <p className="text-sm text-muted-foreground">Your feedback helps us plan better events</p>
                </div>

                <div>
                  <Label htmlFor="feedback">
                    {rsvpResponse === "maybe" ? "What's holding you back?" : "Any feedback? (optional)"}
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder={
                      rsvpResponse === "maybe"
                        ? "e.g., Earlier time would work better, or different location..."
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
                      <Label htmlFor="alt-days">Different days that work?</Label>
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
                      <Label htmlFor="alt-times">Different times that work?</Label>
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

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={isPending}
                    className="flex-1"
                  >
                    {isPending ? "Submitting..." : "Submit RSVP"}
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
                    Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Account CTA */}
        {mode === 'member' && !rsvpSubmitted && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">
                    Never miss an {event.groupName} event
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Create an account to find your groups and see all upcoming events in one place.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedMemberId) {
                        localStorage.setItem("linkMemberId", selectedMemberId);
                        localStorage.setItem("linkReturnPath", `/event/${eventId}/invite?member=${selectedMemberId}`);
                      }
                      window.location.href = "/api/login?returnTo=" + encodeURIComponent("/link-member-account");
                    }}
                  >
                    Create Account
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pb-4">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold text-primary">Kinmo</span>
          </p>
        </div>
      </div>
    </div>
  );
}
