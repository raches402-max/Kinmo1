import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Check, X, HelpCircle, Users, Crown, Clock, CalendarPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";

type GuestRsvpData = {
  guestInvite: {
    id: string;
    guestName: string;
    rsvpStatus: string | null;
    guestToken: string;
  };
  itinerary: {
    id: string;
    name: string;
    eventDate: string | null;
  };
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
    rating: string | null;
    googlePlaceId: string | null;
  }>;
  group: {
    name: string;
    emoji: string;
  } | null;
  attendees?: Array<{
    name: string;
    initials: string;
    response: string;
    isHost: boolean;
  }>;
};

export default function GuestRsvpPage() {
  const [, params] = useRoute("/guest-rsvp/:guestToken");
  const guestToken = params?.guestToken;
  const { toast } = useToast();

  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);

  // Fetch guest RSVP and event details
  const { data, isLoading } = useQuery<GuestRsvpData>({
    queryKey: ["/api/guest-rsvp", guestToken],
    enabled: !!guestToken,
  });

  // Update RSVP mutation
  const updateRsvpMutation = useMutation({
    mutationFn: async (response: string) => {
      return await apiRequest("POST", `/api/guest-rsvp/${guestToken}`, { response });
    },
    onSuccess: () => {
      // Invalidate and refetch the guest RSVP data
      queryClient.invalidateQueries({ queryKey: ["/api/guest-rsvp", guestToken] });
      // Reset selected response to match saved response
      setSelectedResponse(null);
      toast({
        title: "RSVP Updated",
        description: "Your response has been saved successfully!",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const handleSubmit = () => {
    if (selectedResponse) {
      updateRsvpMutation.mutate(selectedResponse);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading event details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>
              This RSVP link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { guestInvite, itinerary, items, group, attendees = [] } = data;
  const currentResponse = selectedResponse || guestInvite.rsvpStatus || '';

  // Count RSVPs
  const goingCount = attendees.filter(a => a.response === 'yes').length;
  const maybeCount = attendees.filter(a => a.response === 'maybe').length;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {group && <div className="text-4xl mb-2">{group.emoji}</div>}
          {group && <h1 className="text-3xl font-bold">{group.name}</h1>}
          <p className="text-muted-foreground">You're invited to join us!</p>
        </div>


        {/* Event Details Card */}
        <Card data-testid="card-event-details">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {itinerary.name || "Group Event"}
            </CardTitle>
            {itinerary.eventDate && (
              <CardDescription className="text-base font-medium">
                {format(new Date(itinerary.eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Event Details</h3>
              {items.map((item, idx) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-muted/50" data-testid={`venue-${item.id}`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/25 flex items-center justify-center text-sm font-semibold text-primary">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.venueName}</div>
                    <div className="text-sm text-muted-foreground">{item.venueType}</div>
                    {item.venueAddress && (
                      <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{item.venueAddress}</span>
                      </div>
                    )}
                    {item.rating && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ⭐ {item.rating}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RSVP Card */}
        <Card data-testid="card-rsvp">
          <CardHeader>
            <CardTitle>Your RSVP</CardTitle>
            <CardDescription>
              Hi {guestInvite.guestName}! Will you be able to join us?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={currentResponse} onValueChange={setSelectedResponse} data-testid="radio-rsvp-response">
              <div className="flex items-center space-x-2 p-4 rounded-lg border hover-elevate cursor-pointer" data-testid="option-yes">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="font-medium">Yes, I'll be there!</div>
                    <div className="text-sm text-muted-foreground">Looking forward to it</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 rounded-lg border hover-elevate cursor-pointer" data-testid="option-maybe">
                <RadioGroupItem value="maybe" id="maybe" />
                <Label htmlFor="maybe" className="flex items-center gap-2 cursor-pointer flex-1">
                  <HelpCircle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <div className="font-medium">Maybe</div>
                    <div className="text-sm text-muted-foreground">I'll try to make it</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-4 rounded-lg border hover-elevate cursor-pointer" data-testid="option-no">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no" className="flex items-center gap-2 cursor-pointer flex-1">
                  <X className="h-4 w-4 text-red-600" />
                  <div>
                    <div className="font-medium">Can't make it</div>
                    <div className="text-sm text-muted-foreground">Sorry, have to skip this one</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {selectedResponse && selectedResponse !== guestInvite.rsvpStatus && (
              <Button
                onClick={handleSubmit}
                disabled={updateRsvpMutation.isPending}
                className="w-full"
                data-testid="button-submit-rsvp"
              >
                {updateRsvpMutation.isPending ? "Saving..." : "Update RSVP"}
              </Button>
            )}

            {(!selectedResponse || selectedResponse === guestInvite.rsvpStatus) && guestInvite.rsvpStatus ? (
              <div className="text-center text-sm text-muted-foreground">
                Your current response: <span className="font-medium text-foreground">
                  {guestInvite.rsvpStatus === 'yes' ? "Yes, I'll be there!" : guestInvite.rsvpStatus === 'maybe' ? 'Maybe' : "Can't make it"}
                </span>
              </div>
            ) : null}

            {/* Add to Calendar button - shown when RSVP is yes */}
            {guestInvite.rsvpStatus === 'yes' && itinerary.eventDate && (
              <div className="pt-4 border-t">
                <a
                  href={generateCalendarUrlFromItinerary({
                    groupName: group?.name || 'Event',
                    eventName: itinerary.name || group?.name || 'Event',
                    eventDate: itinerary.eventDate,
                    venues: items.map(item => ({
                      venueName: item.venueName,
                      venueAddress: item.venueAddress,
                    })),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                >
                  <CalendarPlus className="h-5 w-5" />
                  <span className="font-medium">Add to Google Calendar</span>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Who's Coming Card */}
        {attendees.length > 0 && (
          <Card data-testid="card-whos-coming">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Who's Coming
              </CardTitle>
              <CardDescription>
                {goingCount > 0 && `${goingCount} going`}
                {goingCount > 0 && maybeCount > 0 && ' · '}
                {maybeCount > 0 && `${maybeCount} maybe`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {attendee.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{attendee.name}</span>
                        {attendee.isHost && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {attendee.response === 'yes' && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <Check className="h-4 w-4" />
                          <span>Going</span>
                        </div>
                      )}
                      {attendee.response === 'maybe' && (
                        <div className="flex items-center gap-1 text-yellow-600 text-sm">
                          <HelpCircle className="h-4 w-4" />
                          <span>Maybe</span>
                        </div>
                      )}
                      {attendee.response === 'no' && (
                        <div className="flex items-center gap-1 text-red-600 text-sm">
                          <X className="h-4 w-4" />
                          <span>Can't go</span>
                        </div>
                      )}
                      {!attendee.response && (
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Clock className="h-4 w-4" />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
