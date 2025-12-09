import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Check, X, HelpCircle, Users, Crown, Clock, CalendarPlus, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";
import { cn } from "@/lib/utils";

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
      <div className="min-h-screen flex items-center justify-center bg-[hsl(38,35%,97%)]">
        <div className="text-[hsl(25,20%,40%)]">Loading event details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(38,35%,97%)] p-4">
        <div className="max-w-md w-full rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <h2 className="text-xl font-semibold text-[hsl(25,30%,14%)]">Event Not Found</h2>
            <p className="text-sm text-[hsl(25,20%,40%)] mt-1">
              This RSVP link is invalid or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { guestInvite, itinerary, items, group, attendees = [] } = data;
  const currentResponse = selectedResponse || guestInvite.rsvpStatus || '';

  // Count RSVPs
  const goingCount = attendees.filter(a => a.response === 'yes').length;
  const maybeCount = attendees.filter(a => a.response === 'maybe').length;

  return (
    <div className="min-h-screen bg-[hsl(38,35%,97%)] p-4">
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          {group && (
            <div className="w-16 h-16 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center mx-auto shadow-[0_2px_8px_rgba(242,201,76,0.3)]">
              <span className="text-3xl">{group.emoji}</span>
            </div>
          )}
          {group && <h1 className="text-3xl font-bold text-[hsl(25,30%,14%)]">{group.name}</h1>}
          <p className="text-[hsl(25,20%,40%)]">You're invited to join us!</p>
        </div>

        {/* Event Details Card */}
        <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden" data-testid="card-event-details">
          {/* Card Header with gradient */}
          <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[hsl(44,87%,63%)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">{itinerary.name || "Group Event"}</h3>
                {itinerary.eventDate && (
                  <p className="text-sm text-[hsl(25,20%,40%)] font-medium">
                    {format(new Date(itinerary.eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-[hsl(25,20%,40%)]">Event Details</h3>
              {items.map((item, idx) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-[hsl(35,40%,95%)] border border-[hsl(44,70%,75%)]/50" data-testid={`venue-${item.id}`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(44,87%,63%)]/30 flex items-center justify-center text-sm font-bold text-[hsl(25,30%,14%)]">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[hsl(25,30%,14%)]">{item.venueName}</div>
                    <div className="text-sm text-[hsl(25,20%,40%)]">{item.venueType}</div>
                    {item.venueAddress && (
                      <div className="text-xs text-[hsl(25,20%,40%)] flex items-start gap-1 mt-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-[hsl(44,87%,63%)]" />
                        <span>{item.venueAddress}</span>
                      </div>
                    )}
                    {item.rating && (
                      <div className="text-xs text-[hsl(25,20%,40%)] mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 text-[hsl(44,87%,63%)] fill-[hsl(44,87%,63%)]" />
                        <span>{item.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RSVP Card */}
        <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden" data-testid="card-rsvp">
          {/* Card Header with gradient */}
          <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Your RSVP</h3>
            <p className="text-sm text-[hsl(25,20%,40%)] mt-1">
              Hi {guestInvite.guestName}! Will you be able to join us?
            </p>
          </div>

          {/* Card Content */}
          <div className="p-5 space-y-5">
            {/* RSVP Options */}
            <div className="space-y-3" data-testid="radio-rsvp-response">
              {/* Yes option */}
              <button
                type="button"
                onClick={() => setSelectedResponse('yes')}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                  currentResponse === 'yes'
                    ? "bg-[hsl(145,50%,95%)] border-[hsl(145,50%,50%)]"
                    : "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]"
                )}
                data-testid="option-yes"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  currentResponse === 'yes' ? "bg-[hsl(145,50%,50%)]" : "bg-[hsl(145,50%,85%)]"
                )}>
                  <Check className={cn("h-5 w-5", currentResponse === 'yes' ? "text-white" : "text-[hsl(145,50%,35%)]")} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-[hsl(25,30%,14%)]">Yes, I'll be there!</div>
                  <div className="text-xs text-[hsl(25,20%,40%)]">Looking forward to it</div>
                </div>
                {currentResponse === 'yes' && (
                  <div className="w-6 h-6 rounded-full bg-[hsl(145,50%,50%)] flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>

              {/* Maybe option */}
              <button
                type="button"
                onClick={() => setSelectedResponse('maybe')}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                  currentResponse === 'maybe'
                    ? "bg-[hsl(44,60%,95%)] border-[hsl(44,70%,55%)]"
                    : "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]"
                )}
                data-testid="option-maybe"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  currentResponse === 'maybe' ? "bg-[hsl(44,70%,55%)]" : "bg-[hsl(44,70%,85%)]"
                )}>
                  <HelpCircle className={cn("h-5 w-5", currentResponse === 'maybe' ? "text-white" : "text-[hsl(44,70%,35%)]")} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-[hsl(25,30%,14%)]">Maybe</div>
                  <div className="text-xs text-[hsl(25,20%,40%)]">I'll try to make it</div>
                </div>
                {currentResponse === 'maybe' && (
                  <div className="w-6 h-6 rounded-full bg-[hsl(44,70%,55%)] flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>

              {/* No option */}
              <button
                type="button"
                onClick={() => setSelectedResponse('no')}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                  currentResponse === 'no'
                    ? "bg-[hsl(350,60%,95%)] border-[hsl(350,60%,55%)]"
                    : "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]"
                )}
                data-testid="option-no"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  currentResponse === 'no' ? "bg-[hsl(350,60%,55%)]" : "bg-[hsl(350,60%,85%)]"
                )}>
                  <X className={cn("h-5 w-5", currentResponse === 'no' ? "text-white" : "text-[hsl(350,60%,35%)]")} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-[hsl(25,30%,14%)]">Can't make it</div>
                  <div className="text-xs text-[hsl(25,20%,40%)]">Sorry, have to skip this one</div>
                </div>
                {currentResponse === 'no' && (
                  <div className="w-6 h-6 rounded-full bg-[hsl(350,60%,55%)] flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            </div>

            {/* Submit button */}
            {selectedResponse && selectedResponse !== guestInvite.rsvpStatus && (
              <Button
                onClick={handleSubmit}
                disabled={updateRsvpMutation.isPending}
                className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold shadow-[0_2px_8px_rgba(242,201,76,0.3)] transition-all duration-200"
                data-testid="button-submit-rsvp"
              >
                {updateRsvpMutation.isPending ? "Saving..." : "Update RSVP"}
              </Button>
            )}

            {/* Current response badge */}
            {(!selectedResponse || selectedResponse === guestInvite.rsvpStatus) && guestInvite.rsvpStatus ? (
              <div className={cn(
                "text-center py-2 px-4 rounded-lg text-sm",
                guestInvite.rsvpStatus === 'yes' && "bg-[hsl(145,50%,95%)] text-[hsl(145,50%,30%)]",
                guestInvite.rsvpStatus === 'maybe' && "bg-[hsl(44,60%,95%)] text-[hsl(44,60%,25%)]",
                guestInvite.rsvpStatus === 'no' && "bg-[hsl(350,60%,95%)] text-[hsl(350,50%,35%)]"
              )}>
                <span className="font-medium">Your response: {
                  guestInvite.rsvpStatus === 'yes' ? "Going" :
                  guestInvite.rsvpStatus === 'maybe' ? "Maybe" :
                  "Can't make it"
                }</span>
              </div>
            ) : null}

            {/* Add to Calendar button - shown when RSVP is yes */}
            {guestInvite.rsvpStatus === 'yes' && itinerary.eventDate && (
              <div className="pt-4 border-t border-[hsl(44,70%,75%)]">
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
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-dashed border-[hsl(44,70%,75%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(44,87%,63%)]/10 hover:border-[hsl(44,87%,63%)] transition-all duration-200"
                >
                  <CalendarPlus className="h-5 w-5 text-[hsl(44,87%,63%)]" />
                  <span className="font-medium">Add to Google Calendar</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Who's Coming Card */}
        {attendees.length > 0 && (
          <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden" data-testid="card-whos-coming">
            {/* Card Header with gradient */}
            <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-[hsl(44,87%,63%)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Who's Coming</h3>
                  <p className="text-sm text-[hsl(25,20%,40%)]">
                    {goingCount > 0 && `${goingCount} going`}
                    {goingCount > 0 && maybeCount > 0 && ' · '}
                    {maybeCount > 0 && `${maybeCount} maybe`}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-5">
              <div className="space-y-3">
                {attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(35,40%,95%)] transition-colors">
                    <Avatar className="h-8 w-8 border border-[hsl(44,70%,75%)]">
                      <AvatarFallback className="text-xs bg-[hsl(44,87%,63%)]/20 text-[hsl(25,30%,14%)]">
                        {attendee.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[hsl(25,30%,14%)] truncate">{attendee.name}</span>
                        {attendee.isHost && (
                          <Crown className="h-3.5 w-3.5 text-[hsl(44,87%,63%)] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {attendee.response === 'yes' && (
                        <div className="flex items-center gap-1.5 text-[hsl(145,50%,35%)] text-sm px-2 py-1 rounded-full bg-[hsl(145,50%,95%)]">
                          <Check className="h-3.5 w-3.5" />
                          <span>Going</span>
                        </div>
                      )}
                      {attendee.response === 'maybe' && (
                        <div className="flex items-center gap-1.5 text-[hsl(44,70%,30%)] text-sm px-2 py-1 rounded-full bg-[hsl(44,60%,95%)]">
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Maybe</span>
                        </div>
                      )}
                      {attendee.response === 'no' && (
                        <div className="flex items-center gap-1.5 text-[hsl(350,50%,40%)] text-sm px-2 py-1 rounded-full bg-[hsl(350,60%,95%)]">
                          <X className="h-3.5 w-3.5" />
                          <span>Can't go</span>
                        </div>
                      )}
                      {!attendee.response && (
                        <div className="flex items-center gap-1.5 text-[hsl(25,20%,40%)] text-sm px-2 py-1 rounded-full bg-[hsl(35,40%,95%)]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
