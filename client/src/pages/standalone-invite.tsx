import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { Check, HelpCircle, X, Calendar, Clock, Users } from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { cn } from "@/lib/utils";

type StandaloneInviteData = {
  invitee: {
    id: string;
    inviteeName: string;
    rsvpStatus: "yes" | "maybe" | "no" | null;
    inviteToken: string;
  };
  event: {
    id: string;
    name: string;
    eventDate: string | null;
    timezone: string | null;
  };
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string | null;
    photoUrl: string | null;
    rating: string | null;
    googlePlaceId: string | null;
    googleMapsUrl: string | null;
    arrivalTime?: string | null;
    departureTime?: string | null;
    travelNotes?: string | null;
    notes?: string | null;
  }>;
  attendees: Array<{
    name: string;
    response: "yes" | "maybe" | "no" | null;
  }>;
};

export default function StandaloneInvitePage() {
  const [, params] = useRoute("/standalone-invite/:inviteToken");
  const inviteToken = params?.inviteToken;
  const { toast } = useToast();
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);

  const { data, isLoading } = useQuery<StandaloneInviteData>({
    queryKey: ["/api/standalone-invite", inviteToken],
    enabled: !!inviteToken,
  });

  const updateRsvpMutation = useMutation({
    mutationFn: async (rsvpStatus: string) => {
      return await apiRequest("POST", `/api/standalone-invite/${inviteToken}/rsvp`, { rsvpStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standalone-invite", inviteToken] });
      setSelectedResponse(null);
      toast({
        title: "RSVP updated",
        description: "Got it — your response is saved.",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(38,35%,97%)]">
        <div className="text-[hsl(25,20%,40%)]">Loading invite...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(38,35%,97%)] p-4">
        <div className="max-w-md w-full rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <h2 className="text-xl font-semibold text-[hsl(25,30%,14%)]">Invite not found</h2>
            <p className="text-sm text-[hsl(25,20%,40%)] mt-1">
              This standalone invite link is invalid or expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentResponse = selectedResponse || data.invitee.rsvpStatus || "";
  const goingCount = data.attendees.filter((attendee) => attendee.response === "yes").length;
  const maybeCount = data.attendees.filter((attendee) => attendee.response === "maybe").length;

  return (
    <div className="min-h-screen bg-[hsl(38,35%,97%)] p-4">
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center mx-auto shadow-[0_2px_8px_rgba(242,201,76,0.3)]">
            <Calendar className="h-8 w-8 text-[hsl(44,87%,63%)]" />
          </div>
          <h1 className="text-3xl font-bold text-[hsl(25,30%,14%)]">{data.event.name || "Event Invite"}</h1>
          <p className="text-[hsl(25,20%,40%)]">You&apos;re invited.</p>
        </div>

        <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[hsl(44,87%,63%)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Event details</h3>
                {data.event.eventDate && (
                  <p className="text-sm text-[hsl(25,20%,40%)] font-medium">
                    {format(new Date(data.event.eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <h3 className="font-semibold text-sm text-[hsl(25,20%,40%)]">The plan</h3>
            <ItineraryTimeline
              items={data.items.map((item) => ({
                ...item,
                venueAddress: item.venueAddress || "",
              }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Your RSVP</h3>
            <p className="text-sm text-[hsl(25,20%,40%)] mt-1">
              Hi {data.invitee.inviteeName}! Can you make it?
            </p>
          </div>

          <div className="p-5 space-y-5">
            {[
              {
                value: "yes",
                title: "Yes, I&apos;m in",
                subtitle: "See you there",
                icon: Check,
                activeClass: "bg-[hsl(145,50%,95%)] border-[hsl(145,50%,50%)]",
                idleClass: "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]",
                iconClass: currentResponse === "yes" ? "bg-[hsl(145,50%,50%)] text-white" : "bg-[hsl(145,50%,85%)] text-[hsl(145,50%,35%)]",
              },
              {
                value: "maybe",
                title: "Maybe",
                subtitle: "I&apos;ll try",
                icon: HelpCircle,
                activeClass: "bg-[hsl(44,60%,95%)] border-[hsl(44,70%,55%)]",
                idleClass: "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]",
                iconClass: currentResponse === "maybe" ? "bg-[hsl(44,70%,55%)] text-white" : "bg-[hsl(44,70%,85%)] text-[hsl(44,70%,35%)]",
              },
              {
                value: "no",
                title: "Can&apos;t make it",
                subtitle: "Not this time",
                icon: X,
                activeClass: "bg-[hsl(350,60%,95%)] border-[hsl(350,60%,55%)]",
                idleClass: "bg-[hsl(35,40%,95%)] border-transparent hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,50%,96%)]",
                iconClass: currentResponse === "no" ? "bg-[hsl(350,60%,55%)] text-white" : "bg-[hsl(350,60%,85%)] text-[hsl(350,60%,35%)]",
              },
            ].map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedResponse(option.value)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                    currentResponse === option.value ? option.activeClass : option.idleClass
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", option.iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-[hsl(25,30%,14%)]">{option.title}</div>
                    <div className="text-xs text-[hsl(25,20%,40%)]">{option.subtitle}</div>
                  </div>
                  {currentResponse === option.value && (
                    <div className="w-6 h-6 rounded-full bg-[hsl(44,87%,63%)] flex items-center justify-center">
                      <Check className="h-4 w-4 text-[hsl(25,30%,14%)]" />
                    </div>
                  )}
                </button>
              );
            })}

            {selectedResponse && selectedResponse !== data.invitee.rsvpStatus && (
              <Button
                onClick={() => updateRsvpMutation.mutate(selectedResponse)}
                disabled={updateRsvpMutation.isPending}
                className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold"
              >
                {updateRsvpMutation.isPending ? "Saving..." : "Update RSVP"}
              </Button>
            )}

            {(!selectedResponse || selectedResponse === data.invitee.rsvpStatus) && data.invitee.rsvpStatus && (
              <div className="text-center py-2 px-4 rounded-lg text-sm bg-[hsl(35,40%,95%)] text-[hsl(25,20%,40%)]">
                <span className="font-medium">Current response: {data.invitee.rsvpStatus}</span>
              </div>
            )}
          </div>
        </div>

        {data.attendees.length > 0 && (
          <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-[hsl(44,87%,63%)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Who&apos;s coming</h3>
                  <p className="text-sm text-[hsl(25,20%,40%)]">
                    {goingCount > 0 && `${goingCount} going`}
                    {goingCount > 0 && maybeCount > 0 && " · "}
                    {maybeCount > 0 && `${maybeCount} maybe`}
                    {goingCount === 0 && maybeCount === 0 && "No RSVPs yet"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {data.attendees.map((attendee, index) => (
                <div key={`${attendee.name}-${index}`} className="flex items-center justify-between rounded-lg bg-[hsl(35,40%,95%)] px-4 py-3">
                  <span className="font-medium text-[hsl(25,30%,14%)]">{attendee.name}</span>
                  <div className="flex items-center gap-2 text-sm text-[hsl(25,20%,40%)]">
                    {!attendee.response && <Clock className="h-4 w-4" />}
                    <span>{attendee.response || "Pending"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
