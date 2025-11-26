import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, CheckCircle, XCircle, HelpCircle, Sparkles, Home, Users } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { TimeSlotVoting } from "@/components/TimeSlotVoting";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

type EventItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
};

type UserEvent = {
  inviteId: string;
  inviteToken: string;
  itineraryId: string;
  itineraryName: string;
  eventDate: string | null;
  status: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupTimezone?: string;
  isOrganizer: boolean;
  hostMemberId: string | null;
  hostMemberName: string | null;
  currentUserMemberId: string | null;
  currentUserOpenToHosting: boolean;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
    openToHosting: boolean;
  }>;
  rsvp: {
    response: string;
    rsvpFeedback: any;
  } | null;
  items: EventItem[];
};

export default function MemberEventsPage() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
  });

  // Fetch pending hosting requests
  const { data: hostingRequests = [] } = useQuery<Array<{
    id: string;
    itineraryId: string;
    itineraryName: string;
    groupName: string;
    groupEmoji: string;
    eventDate: string | null;
  }>>({
    queryKey: ["/api/user/hosting-requests"],
    enabled: !!user,
  });

  const requestHostMutation = useMutation({
    mutationFn: async ({ groupId, itineraryId }: { groupId: string; itineraryId: string }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/request-host`, {
        itineraryId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Host requested",
        description: "A volunteer will be asked to host this event",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const respondToHostingMutation = useMutation({
    mutationFn: async ({ assignmentId, accepted }: { assignmentId: string; accepted: boolean }) => {
      return await apiRequest("POST", `/api/host-assignments/${assignmentId}/respond`, { accepted });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/hosting-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      if (variables.accepted) {
        toast({
          title: "Hosting accepted",
          description: "You're now the host for this event and have been RSVP'd as going",
        });
      } else {
        toast({
          title: "Hosting declined",
          description: "Another volunteer will be asked to host",
        });
      }
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Categorize events
  const now = new Date();
  const pendingInvites = events.filter(e => !e.isOrganizer && !e.rsvp && (!e.eventDate || new Date(e.eventDate) > now));
  const upcomingEvents = events.filter(e => {
    const isFutureOrTBD = !e.eventDate || new Date(e.eventDate) > now;
    if (e.isOrganizer) return isFutureOrTBD;
    return e.rsvp && e.rsvp.response !== 'no' && isFutureOrTBD;
  });
  const pastEvents = events.filter(e => e.eventDate && new Date(e.eventDate) <= now);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">My Events</h1>
            <p className="text-muted-foreground mt-2">
              Loading your events...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderEventCard = (event: UserEvent, isPending: boolean = false) => {
    const firstVenue = event.items[0];
    const additionalVenues = event.items.length - 1;
    const rsvpResponse = event.rsvp?.response;

    return (
      <Card key={event.itineraryId} className="hover-elevate" data-testid={`card-event-${event.itineraryId}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl" data-testid={`emoji-${event.itineraryId}`}>
                {event.groupEmoji}
              </span>
              <CardTitle className="text-xl truncate" data-testid={`title-${event.itineraryId}`}>
                {event.itineraryName || "Event"}
              </CardTitle>
            </div>
            <CardDescription className="mt-1" data-testid={`group-${event.itineraryId}`}>
              {event.groupName}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {event.isOrganizer && (
              <Badge variant="default" className="gap-1" data-testid={`badge-organizer-${event.itineraryId}`}>
                <Sparkles className="h-3 w-3" />
                Organizer
              </Badge>
            )}
            {isPending && !event.isOrganizer && (
              <Badge variant="destructive" data-testid={`badge-pending-${event.itineraryId}`}>
                RSVP Needed
              </Badge>
            )}
            {!isPending && rsvpResponse && (
              <Badge 
                variant={rsvpResponse === 'yes' ? 'default' : rsvpResponse === 'maybe' ? 'secondary' : 'outline'}
                data-testid={`badge-rsvp-${event.itineraryId}`}
              >
                {rsvpResponse === 'yes' && <CheckCircle className="w-3 h-3 mr-1" />}
                {rsvpResponse === 'maybe' && <HelpCircle className="w-3 h-3 mr-1" />}
                {rsvpResponse === 'no' && <XCircle className="w-3 h-3 mr-1" />}
                {rsvpResponse === 'yes' ? 'Going' : rsvpResponse === 'maybe' ? 'Maybe' : 'Can\'t make it'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {event.eventDate && (
            <div className="flex items-center gap-2 text-sm" data-testid={`date-${event.itineraryId}`}>
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(event.eventDate), 'EEEE, MMMM d, yyyy')}
              </span>
              <Clock className="w-4 h-4 text-muted-foreground ml-2" />
              <span>
                {format(new Date(event.eventDate), 'h:mm a')}
              </span>
            </div>
          )}

          {/* Host Information */}
          {event.hostMemberId && event.hostMemberName ? (
            <div className="flex items-center gap-2 text-sm" data-testid={`host-${event.itineraryId}`}>
              <Home className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hosted by:</span>
              <span className="font-medium">{event.hostMemberName}</span>
              <Badge variant="outline" className="text-xs">
                Host
              </Badge>
            </div>
          ) : event.isOrganizer && event.members.some(m => m.openToHosting) ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestHostMutation.mutate({
                  groupId: event.groupId,
                  itineraryId: event.itineraryId
                })}
                disabled={requestHostMutation.isPending}
                className="gap-1"
                data-testid={`button-request-host-${event.itineraryId}`}
              >
                <Users className="w-3 h-3" />
                Request a Host
              </Button>
              <span className="text-xs text-muted-foreground">
                {event.members.filter(m => m.openToHosting).length} volunteer(s) available
              </span>
            </div>
          ) : null}

          {firstVenue && (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                {firstVenue.photoUrl && (
                  <img 
                    src={firstVenue.photoUrl} 
                    alt={firstVenue.venueName}
                    className="w-20 h-20 object-cover rounded-md"
                    data-testid={`img-venue-${event.itineraryId}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate" data-testid={`venue-name-${event.itineraryId}`}>
                    {firstVenue.venueName}
                  </h4>
                  <p className="text-sm text-muted-foreground capitalize" data-testid={`venue-type-${event.itineraryId}`}>
                    {firstVenue.venueType}
                  </p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`venue-address-${event.itineraryId}`}>
                      {firstVenue.venueAddress}
                    </p>
                  </div>
                </div>
              </div>
              {additionalVenues > 0 && (
                <p className="text-sm text-muted-foreground" data-testid={`additional-venues-${event.itineraryId}`}>
                  + {additionalVenues} more {additionalVenues === 1 ? 'venue' : 'venues'}
                </p>
              )}
            </div>
          )}

          <TimeSlotVoting
            itineraryId={event.itineraryId}
            userId={user?.id}
            isOrganizer={event.isOrganizer}
            isHost={event.hostMemberId === event.currentUserMemberId}
            timezone={event.groupTimezone}
          />

          <div className="flex gap-2 pt-2">
            {isPending ? (
              <Link href={`/rsvp/${event.itineraryId}/${event.inviteToken}`}>
                <Button variant="default" className="w-full" data-testid={`button-rsvp-${event.itineraryId}`}>
                  RSVP Now
                </Button>
              </Link>
            ) : (
              <Link href={`/rsvp/${event.itineraryId}/${event.inviteToken}`}>
                <Button variant="outline" className="w-full" data-testid={`button-view-${event.itineraryId}`}>
                  View Details
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-my-events">My Events</h1>
          <p className="text-muted-foreground mt-2" data-testid="text-description">
            All your event invitations and upcoming plans in one place
          </p>
        </div>

        {/* Hosting Requests */}
        {hostingRequests.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-hosting-requests">
                <Home className="w-6 h-6" />
                Hosting Requests
                <Badge variant="default" data-testid="badge-hosting-count">
                  {hostingRequests.length}
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                You've been asked to host these events
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {hostingRequests.map(request => (
                <Card key={request.id} className="border-primary/20 bg-primary/15" data-testid={`card-hosting-request-${request.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl" data-testid={`emoji-${request.id}`}>
                        {request.groupEmoji}
                      </span>
                      <CardTitle className="text-xl" data-testid={`title-${request.id}`}>
                        {request.itineraryName || "Event"}
                      </CardTitle>
                    </div>
                    <CardDescription data-testid={`group-${request.id}`}>
                      {request.groupName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.eventDate && (
                      <div className="flex items-center gap-2 text-sm" data-testid={`date-${request.id}`}>
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(request.eventDate), 'EEEE, MMMM d, yyyy')}
                        </span>
                        <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                        <span>
                          {format(new Date(request.eventDate), 'h:mm a')}
                        </span>
                      </div>
                    )}
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>As the host, you'll:</strong>
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Help finalize the venue and time</li>
                        <li>• Be the main point of contact for the event</li>
                        <li>• Coordinate with other attendees</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        className="flex-1 gap-1"
                        onClick={() => respondToHostingMutation.mutate({ assignmentId: request.id, accepted: true })}
                        disabled={respondToHostingMutation.isPending}
                        data-testid={`button-accept-hosting-${request.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Accept Hosting
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => respondToHostingMutation.mutate({ assignmentId: request.id, accepted: false })}
                        disabled={respondToHostingMutation.isPending}
                        data-testid={`button-decline-hosting-${request.id}`}
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-pending">
                Pending Invitations
                <Badge variant="destructive" data-testid="badge-pending-count">
                  {pendingInvites.length}
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Events waiting for your response
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map(event => renderEventCard(event, true))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold" data-testid="heading-upcoming">
                Upcoming Events
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Events you've confirmed or are considering
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingEvents.map(event => renderEventCard(event, false))}
            </div>
          </section>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold" data-testid="heading-past">
                Past Events
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Previous events and declined invitations
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pastEvents.map(event => renderEventCard(event, false))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {pendingInvites.length === 0 && upcomingEvents.length === 0 && pastEvents.length === 0 && (
          <Card className="p-12 text-center" data-testid="card-empty-state">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground">
              When you're invited to events, they'll appear here
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
