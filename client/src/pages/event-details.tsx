import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import {
  Calendar,
  MapPin,
  Star,
  CheckCircle,
  HelpCircle,
  XCircle,
  Copy,
  Users,
  ArrowLeft,
  UserCheck,
  Bot,
  UserPlus,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimeSlotVoting } from "@/components/TimeSlotVoting";
import { Link } from "wouter";

export default function EventDetailsPage() {
  const [, params] = useRoute("/event/:id");
  const eventId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [guestName, setGuestName] = useState("");

  const { data: event, isLoading } = useQuery<any>({
    queryKey: ["/api/user/events", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const events = await fetch(`/api/user/events`).then(r => r.json());
      return events.find((e: any) => e.itineraryId === eventId);
    },
  });

  const { data: guestInvites = [], isLoading: isLoadingGuests } = useQuery<any[]>({
    queryKey: ["/api/itineraries/:id/guest-invites", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${eventId}/guest-invites`);
      if (!response.ok) throw new Error('Failed to fetch guest invites');
      return response.json();
    },
  });

  const organizerRsvpMutation = useMutation({
    mutationFn: async (response: 'yes' | 'maybe' | 'no') => {
      return apiRequest("POST", `/api/itineraries/${eventId}/organizer-rsvp`, {
        response,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "RSVP updated",
        description: "Your response has been recorded",
      });
    },
  });

  const volunteerToHostMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/itineraries/${eventId}/volunteer-host`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "You're now hosting!",
        description: "Your RSVP has been automatically set to 'Going'",
      });
    },
  });

  const handOffHostMutation = useMutation({
    mutationFn: async (newHostMemberId: string) => {
      return apiRequest("POST", `/api/itineraries/${eventId}/hand-off-host`, {
        newHostMemberId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Host transferred",
        description: "The new host has been notified",
      });
    },
  });

  const addGuestMutation = useMutation({
    mutationFn: async (guestName: string) => {
      return apiRequest("POST", `/api/itineraries/${eventId}/guest-invites`, {
        guestName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id/guest-invites", eventId] });
      setGuestName("");
      toast({
        title: "Guest invited",
        description: "Guest invite link created successfully",
      });
    },
  });

  const copyInviteLink = () => {
    if (!event) return;
    const link = `${window.location.origin}/rsvp/${event.itineraryId}/${event.inviteToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied!",
      description: "Share this link to invite others",
    });
  };

  const copyGuestLink = (guestToken: string, guestName: string) => {
    const link = `${window.location.origin}/guest-rsvp/${guestToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Guest link copied!",
      description: `Link for ${guestName} copied to clipboard`,
    });
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) return;
    addGuestMutation.mutate(guestName.trim());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Event Not Found</h3>
              <p className="text-muted-foreground mb-4">
                This event doesn't exist or you don't have access to it
              </p>
              <Link href="/">
                <Button>Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isOrganizer = event.isOrganizer;
  const rsvpResponse = event.organizerRsvp || event.rsvp?.response;
  const isCurrentHost = event.hostMemberId === event.currentUserMemberId;
  const canVolunteerToHost = !event.isOrganizer && event.currentUserOpenToHosting && !event.hostMemberId && event.currentUserMemberId;
  const hostableMembers = event.members?.filter((m: any) => m.openToHosting && m.id !== event.currentUserMemberId) || [];

  const formatRsvpName = (rsvp: any) => {
    if (rsvp.memberName) return rsvp.memberName;
    if (rsvp.firstName && rsvp.lastName) return `${rsvp.firstName} ${rsvp.lastName}`;
    if (rsvp.firstName) return rsvp.firstName;
    return rsvp.email || 'Anonymous';
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card data-testid="event-details-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="text-3xl">{event.groupEmoji}</span>
                  {event.itineraryName}
                </CardTitle>
                <CardDescription className="mt-2 text-base">
                  {event.groupName}
                </CardDescription>
                {event.eventDate && (
                  <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy • h:mm a")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {isOrganizer && (
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Organizer
                  </Badge>
                )}
                {event.hostMemberId && event.hostMemberName && (
                  <Badge variant="default" className="gap-1">
                    <UserCheck className="h-3 w-3" />
                    {isCurrentHost ? "You're hosting" : `Hosted by ${event.hostMemberName}`}
                  </Badge>
                )}
                {!event.hostMemberId && (
                  <Badge variant="secondary" className="gap-1">
                    <Bot className="h-3 w-3" />
                    AI-hosted
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Venues */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Venues</h3>
              {event.items.map((venue: any, idx: number) => (
                <Card key={venue.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="h-6 shrink-0 mt-1">{idx + 1}</Badge>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-lg">{venue.venueName}</h4>
                      {venue.venueAddress && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{venue.venueAddress}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        {venue.rating && (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{venue.rating}</span>
                          </div>
                        )}
                        {venue.googlePlaceId && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                            data-testid={`link-maps-${venue.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View on Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Time Slot Voting */}
            {/* <TimeSlotVoting
              itineraryId={event.itineraryId}
              userId={user?.id}
              isOrganizer={isOrganizer}
            /> */}

            {/* RSVP Summary */}
            {event.detailedRsvps && event.detailedRsvps.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">RSVPs ({event.detailedRsvps.length})</h3>
                <div className="space-y-2">
                  {event.detailedRsvps.filter((r: any) => r.response === 'yes').length > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-md border border-green-500/20">
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">Going ({event.detailedRsvps.filter((r: any) => r.response === 'yes').length})</div>
                        <div className="text-sm text-muted-foreground">
                          {event.detailedRsvps.filter((r: any) => r.response === 'yes').map(formatRsvpName).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                  {event.detailedRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-500/5 rounded-md border border-yellow-500/20">
                      <HelpCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">Maybe ({event.detailedRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length})</div>
                        <div className="text-sm text-muted-foreground">
                          {event.detailedRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').map(formatRsvpName).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                  {event.detailedRsvps.filter((r: any) => r.response === 'no').length > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md border">
                      <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">Can't Make It ({event.detailedRsvps.filter((r: any) => r.response === 'no').length})</div>
                        <div className="text-sm text-muted-foreground">
                          {event.detailedRsvps.filter((r: any) => r.response === 'no').map(formatRsvpName).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4 pt-4 border-t">
              {isOrganizer && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Your Response</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('yes')}
                      disabled={organizerRsvpMutation.isPending}
                      className="gap-1"
                      data-testid="button-organizer-yes"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Going
                    </Button>
                    <Button
                      variant={rsvpResponse === 'maybe' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('maybe')}
                      disabled={organizerRsvpMutation.isPending}
                      className="gap-1"
                      data-testid="button-organizer-maybe"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Maybe
                    </Button>
                    <Button
                      variant={rsvpResponse === 'no' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('no')}
                      disabled={organizerRsvpMutation.isPending}
                      className="gap-1"
                      data-testid="button-organizer-no"
                    >
                      <XCircle className="h-4 w-4" />
                      Can't Make It
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm mb-3">Share & Manage</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInviteLink}
                    className="gap-2"
                    data-testid="button-copy-link"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Invite Link
                  </Button>

                  {canVolunteerToHost && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => volunteerToHostMutation.mutate()}
                      disabled={volunteerToHostMutation.isPending}
                      className="gap-2"
                      data-testid="button-volunteer-host"
                    >
                      <UserPlus className="h-4 w-4" />
                      Volunteer to Host
                    </Button>
                  )}

                  {isCurrentHost && hostableMembers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          data-testid="button-hand-off"
                        >
                          <Users className="h-4 w-4" />
                          Hand Off Host
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Select New Host</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {hostableMembers.map((member: any) => (
                          <DropdownMenuItem
                            key={member.id}
                            onClick={() => handOffHostMutation.mutate(member.id)}
                            data-testid={`menu-hand-off-${member.id}`}
                          >
                            {member.name || member.email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {isOrganizer && (
                    <Link href={`/group/${event.groupId}?edit=${event.itineraryId}`}>
                      <Button variant="outline" size="sm" className="gap-2" data-testid="button-manage">
                        <Users className="h-4 w-4" />
                        Manage Event
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Guest Invites Section */}
              {isOrganizer && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">
                    Guests ({guestInvites.length})
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Guest name..."
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddGuest();
                          }
                        }}
                        data-testid="input-guest-name"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddGuest}
                        disabled={!guestName.trim() || addGuestMutation.isPending}
                        className="gap-2"
                        data-testid="button-add-guest"
                      >
                        <UserPlus className="h-4 w-4" />
                        Add Guest
                      </Button>
                    </div>

                    {isLoadingGuests ? (
                      <div className="text-sm text-muted-foreground">Loading guests...</div>
                    ) : guestInvites.length > 0 ? (
                      <div className="space-y-2">
                        {guestInvites.map((guest: any) => (
                          <Card key={guest.id} className="p-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="font-medium">{guest.guestName}</span>
                                {guest.rsvpStatus && (
                                  <Badge
                                    variant={
                                      guest.rsvpStatus === "yes"
                                        ? "default"
                                        : guest.rsvpStatus === "maybe"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="gap-1"
                                  >
                                    {guest.rsvpStatus === "yes" && (
                                      <CheckCircle className="h-3 w-3" />
                                    )}
                                    {guest.rsvpStatus === "maybe" && (
                                      <HelpCircle className="h-3 w-3" />
                                    )}
                                    {guest.rsvpStatus === "no" && (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    {guest.rsvpStatus === "yes" && "Yes"}
                                    {guest.rsvpStatus === "maybe" && "Maybe"}
                                    {guest.rsvpStatus === "no" && "No"}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyGuestLink(guest.guestToken, guest.guestName)}
                                className="gap-2"
                                data-testid={`button-copy-guest-link-${guest.id}`}
                              >
                                <Copy className="h-4 w-4" />
                                Copy Link
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No guests invited yet. Add guests to generate shareable invite links.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
