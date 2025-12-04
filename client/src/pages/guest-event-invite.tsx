/**
 * Guest Event Invite Page - Phase 3: Guest vs Member Distinction
 *
 * For one-time guests invited to a specific event
 * Guests are NOT added to the recurring member list
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MapPin, Check, X, HelpCircle, ExternalLink, User } from "lucide-react";
import { format } from "date-fns";

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

type GuestRsvpData = {
  guestName: string;
  guestEmail?: string;
  response: "going" | "maybe" | "not_going";
  feedbackText?: string;
  alternativeDays?: string;
  alternativeTimes?: string;
};

export default function GuestEventInvitePage() {
  const [, params] = useRoute("/event/:eventId/guest");
  const eventId = params?.eventId;
  const search = useSearch();
  const guestToken = new URLSearchParams(search).get("token");
  const { toast } = useToast();

  // Guest info state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestInfoComplete, setGuestInfoComplete] = useState(false);

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

  // Check if guest has already RSVP'd (using guestToken)
  const { data: existingRsvp } = useQuery<{ guestName: string; guestEmail: string; response: string } | null>({
    queryKey: [`/api/guest-rsvp/${guestToken}`],
    enabled: !!guestToken && guestInfoComplete,
  });

  // Initialize from existing RSVP
  useEffect(() => {
    if (existingRsvp) {
      setGuestName(existingRsvp.guestName || "");
      setGuestEmail(existingRsvp.guestEmail || "");
      setRsvpResponse(existingRsvp.response as "going" | "maybe" | "not_going");
      setGuestInfoComplete(true);
    }
  }, [existingRsvp]);

  // RSVP submission mutation
  const rsvpMutation = useMutation({
    mutationFn: async (data: GuestRsvpData) => {
      const response = await fetch(`/api/itineraries/${eventId}/guest-rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestToken,
          guestName: data.guestName,
          guestEmail: data.guestEmail || null,
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
        description: `Thanks for letting us know, ${guestName}!`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleGuestInfoSubmit = () => {
    if (!guestName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to continue",
        variant: "destructive",
      });
      return;
    }
    setGuestInfoComplete(true);
  };

  const handleRsvpClick = (response: "going" | "maybe" | "not_going") => {
    setRsvpResponse(response);

    // Show feedback form for "maybe" and "not_going"
    if (response === "maybe" || response === "not_going") {
      setShowFeedbackForm(true);
    } else {
      // For "going", submit immediately
      rsvpMutation.mutate({
        guestName,
        guestEmail: guestEmail || undefined,
        response,
      });
    }
  };

  const handleFeedbackSubmit = () => {
    if (!rsvpResponse) return;

    rsvpMutation.mutate({
      guestName,
      guestEmail: guestEmail || undefined,
      response: rsvpResponse,
      feedbackText,
      alternativeDays,
      alternativeTimes,
    });
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

  // Guest info collection screen
  if (!guestInfoComplete) {
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
              <Label htmlFor="guest-name">Your Name *</Label>
              <Input
                id="guest-name"
                type="text"
                placeholder="Enter your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="guest-email">Email (Optional)</Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="your@email.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional, but helpful for the organizer to contact you
              </p>
            </div>
            <Button onClick={handleGuestInfoSubmit} className="w-full">
              Continue to RSVP
            </Button>
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
            <h2 className="text-2xl font-bold mb-2">Thanks for your RSVP!</h2>
            <p className="text-gray-600 mb-2">
              We've received your response for {event.name}.
            </p>
            {rsvpResponse !== "going" && feedbackText && (
              <p className="text-sm text-gray-500 mt-2">
                Your feedback has been shared with the organizer.
              </p>
            )}
            <p className="text-sm text-gray-500 mt-4">
              You can close this page now. See you there!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main RSVP screen
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
                <CardDescription className="text-base">
                  {event.groupName}
                </CardDescription>
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

        {/* Guest Info Display */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <User className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">{guestName}</p>
              {guestEmail && (
                <p className="text-sm text-blue-700">{guestEmail}</p>
              )}
            </div>
          </CardContent>
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

        {/* RSVP Section */}
        <Card>
          <CardHeader>
            <CardTitle>Can you make it?</CardTitle>
            <CardDescription>
              {showFeedbackForm
                ? "Help us make this work better for you"
                : "Let us know if you can join"}
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
      </div>
    </div>
  );
}
