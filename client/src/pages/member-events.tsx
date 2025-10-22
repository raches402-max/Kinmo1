import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

type EventItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
};

type Event = {
  id: string;
  name: string;
  status: string;
  eventDate: string | null;
  inviteToken: string;
  rsvpResponse: string | null;
  rsvpFeedback: any;
  group: {
    id: string;
    name: string;
    emoji: string;
  } | null;
  items: EventItem[];
};

type EventsData = {
  pending: Event[];
  upcoming: Event[];
  past: Event[];
};

export default function MemberEventsPage() {
  // Get claim token from localStorage if present
  const claimToken = localStorage.getItem('claimToken') || undefined;

  const { data: eventsData, isLoading } = useQuery<EventsData>({
    queryKey: ["/api/members/me/events", claimToken],
    queryFn: async () => {
      const url = claimToken 
        ? `/api/members/me/events?claimToken=${encodeURIComponent(claimToken)}`
        : '/api/members/me/events';
      
      const response = await fetch(url, {
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  });

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

  const { pending = [], upcoming = [], past = [] } = eventsData || {};

  const renderEventCard = (event: Event, isPending: boolean = false) => {
    const firstVenue = event.items[0];
    const additionalVenues = event.items.length - 1;

    return (
      <Card key={event.id} className="hover-elevate" data-testid={`card-event-${event.id}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {event.group && (
                <span className="text-2xl" data-testid={`emoji-${event.id}`}>
                  {event.group.emoji}
                </span>
              )}
              <CardTitle className="text-xl truncate" data-testid={`title-${event.id}`}>
                {event.name || "Event"}
              </CardTitle>
            </div>
            {event.group && (
              <CardDescription className="mt-1" data-testid={`group-${event.id}`}>
                {event.group.name}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {isPending && (
              <Badge variant="destructive" data-testid={`badge-pending-${event.id}`}>
                RSVP Needed
              </Badge>
            )}
            {!isPending && event.rsvpResponse && (
              <Badge 
                variant={event.rsvpResponse === 'yes' ? 'default' : event.rsvpResponse === 'maybe' ? 'secondary' : 'outline'}
                data-testid={`badge-rsvp-${event.id}`}
              >
                {event.rsvpResponse === 'yes' && <CheckCircle className="w-3 h-3 mr-1" />}
                {event.rsvpResponse === 'maybe' && <HelpCircle className="w-3 h-3 mr-1" />}
                {event.rsvpResponse === 'no' && <XCircle className="w-3 h-3 mr-1" />}
                {event.rsvpResponse === 'yes' ? 'Going' : event.rsvpResponse === 'maybe' ? 'Maybe' : 'Can\'t make it'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {event.eventDate && (
            <div className="flex items-center gap-2 text-sm" data-testid={`date-${event.id}`}>
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

          {firstVenue && (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                {firstVenue.photoUrl && (
                  <img 
                    src={firstVenue.photoUrl} 
                    alt={firstVenue.venueName}
                    className="w-20 h-20 object-cover rounded-md"
                    data-testid={`img-venue-${event.id}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate" data-testid={`venue-name-${event.id}`}>
                    {firstVenue.venueName}
                  </h4>
                  <p className="text-sm text-muted-foreground capitalize" data-testid={`venue-type-${event.id}`}>
                    {firstVenue.venueType}
                  </p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`venue-address-${event.id}`}>
                      {firstVenue.venueAddress}
                    </p>
                  </div>
                </div>
              </div>
              {additionalVenues > 0 && (
                <p className="text-sm text-muted-foreground" data-testid={`additional-venues-${event.id}`}>
                  + {additionalVenues} more {additionalVenues === 1 ? 'venue' : 'venues'}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {isPending ? (
              <Link href={`/rsvp/${event.id}/${event.inviteToken}`}>
                <Button variant="default" className="w-full" data-testid={`button-rsvp-${event.id}`}>
                  RSVP Now
                </Button>
              </Link>
            ) : (
              <Link href={`/rsvp/${event.id}/${event.inviteToken}`}>
                <Button variant="outline" className="w-full" data-testid={`button-view-${event.id}`}>
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-my-events">My Events</h1>
          <p className="text-muted-foreground mt-2" data-testid="text-description">
            All your event invitations and upcoming plans in one place
          </p>
        </div>

        {/* Pending Invitations */}
        {pending.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-pending">
                Pending Invitations
                <Badge variant="destructive" data-testid="badge-pending-count">
                  {pending.length}
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Events waiting for your response
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map(event => renderEventCard(event, true))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {upcoming.length > 0 && (
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
              {upcoming.map(event => renderEventCard(event, false))}
            </div>
          </section>
        )}

        {/* Past Events */}
        {past.length > 0 && (
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
              {past.map(event => renderEventCard(event, false))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {pending.length === 0 && upcoming.length === 0 && past.length === 0 && (
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
