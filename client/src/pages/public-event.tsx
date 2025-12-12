/**
 * Public Event Page - Shows event details to anyone with the link
 *
 * For unauthenticated users who visit /event/:eventId
 * Shows event details and prompts to:
 * 1. Log in if they're a member
 * 2. Continue as a guest to RSVP
 */

import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, ExternalLink, Users, LogIn, UserPlus, Clock } from "lucide-react";
import { format } from "date-fns";

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

type PublicItinerary = {
  id: string;
  name: string;
  groupId: string | null;
  groupName?: string;
  groupEmoji?: string;
  eventDate: string | null;
  items: ItineraryItem[];
};

export default function PublicEventPage() {
  const [, params] = useRoute("/event/:id");
  const eventId = params?.id;
  const [, setLocation] = useLocation();

  // Fetch event/itinerary (uses existing public endpoint)
  const { data: event, isLoading, error } = useQuery<PublicItinerary>({
    queryKey: [`/api/itineraries/${eventId}`],
    enabled: !!eventId,
    retry: false,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - event not found or not public
  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This event doesn't exist or isn't available for public viewing.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => {
                  // Redirect to login with return URL
                  window.location.href = `/api/login?returnTo=${encodeURIComponent(`/event/${eventId}`)}`;
                }}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Log in to view
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/")}
              >
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Event Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              {event.groupEmoji && (
                <span className="text-3xl">{event.groupEmoji}</span>
              )}
              <div className="flex-1">
                <CardTitle className="text-2xl">{event.name}</CardTitle>
                {event.groupName && (
                  <CardDescription className="text-base mt-1">
                    {event.groupName}
                  </CardDescription>
                )}
              </div>
            </div>

            {event.eventDate && (
              <div className="flex items-center gap-2 text-lg font-medium mt-4 pt-4 border-t">
                <Calendar className="h-5 w-5 text-primary" />
                {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}
                <span className="text-muted-foreground mx-1">at</span>
                {format(new Date(event.eventDate), "h:mm a")}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Itinerary */}
        {event.items && event.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Venues
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.items
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{item.venueName}</h4>
                        {item.rating && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            {item.rating}
                          </span>
                        )}
                      </div>
                      {item.venueAddress && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {item.venueAddress}
                        </p>
                      )}
                      {(item.googlePlaceId || item.googleMapsUrl) && (
                        <a
                          href={item.googlePlaceId
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.venueName || item.venueAddress || 'Location')}&query_place_id=${item.googlePlaceId}`
                            : item.googleMapsUrl || '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on Maps
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center mb-2">
              <h3 className="font-semibold text-lg">Want to RSVP?</h3>
              <p className="text-muted-foreground text-sm">
                Log in to see if you're invited, or continue as a guest
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  // Redirect to login with return URL to this event
                  window.location.href = `/api/login?returnTo=${encodeURIComponent(`/event/${eventId}`)}`;
                }}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  // Go to consolidated RSVP flow
                  setLocation(`/rsvp/${eventId}`);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Continue as Guest
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kinmo Branding */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Powered by <span className="font-semibold text-primary">Kinmo</span></p>
          <p className="text-xs mt-1">AI-powered group event planning</p>
        </div>
      </div>
    </div>
  );
}
