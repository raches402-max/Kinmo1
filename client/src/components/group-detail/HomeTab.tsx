import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Compass, Plus, Sparkles, Clock, Sun, Sunrise, CalendarDays, CalendarClock } from "lucide-react";
import EventsTable from "@/components/EventsTable";

// Time-based event grouping utilities
type TimeCategory = 'Today' | 'Tomorrow' | 'This Week' | 'Next Week' | 'Later';

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  openToHosting?: boolean;
  profileCompleted?: boolean;
};

type UserEvent = {
  inviteId: string;
  inviteToken: string;
  itineraryId: string | null;
  itineraryName: string;
  eventDate: string | null;
  status: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  groupTimezone: string | null;
  isOrganizer: boolean;
  isVirtual?: boolean;
  meetingFrequency?: string;
  hostMemberId: string | null;
  hostMemberName: string | null;
  currentUserMemberId: string | null;
  currentUserOpenToHosting: boolean;
  members: SafeMember[];
  rsvp: {
    response: string;
    rsvpFeedback: any;
    postEventFeedback: any;
  } | null;
  rsvpSummary: {
    yes: string[];
    maybe: string[];
    no: string[];
  };
  detailedRsvps: Array<{
    name: string;
    response: string;
    additionalAttendees: any[];
    numberOfKids: number;
    isGuest: boolean;
  }>;
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
    rating: string | null;
    googlePlaceId: string | null;
  }>;
  pendingGuestRsvps: Array<{
    id: string;
    guestName: string;
    response: string;
    additionalAttendees: any;
    numberOfKids: number;
  }>;
};

interface HomeTabProps {
  eventsLoading: boolean;
  allGroupEvents: UserEvent[];
  pendingInvites: UserEvent[];
  guestApprovalEvents: UserEvent[];
  upcomingEvents: UserEvent[];
  pastEvents: UserEvent[];
  groupedUpcomingEvents: Map<TimeCategory, UserEvent[]>;
  expandedEvents: Set<string>;
  onToggleExpand: (eventId: string) => void;
  onOpenEventCreation: () => void;
  onOpenDiscoverVenues: () => void;
}

// Category styling config
const categoryConfig: Record<TimeCategory, { icon: typeof Sun; color: string; bgColor: string }> = {
  'Today': { icon: Sun, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  'Tomorrow': { icon: Sunrise, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  'This Week': { icon: CalendarDays, color: 'text-primary', bgColor: 'bg-primary/5' },
  'Next Week': { icon: CalendarClock, color: 'text-secondary-foreground', bgColor: 'bg-secondary/20' },
  'Later': { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
};

export function HomeTab({
  eventsLoading,
  allGroupEvents,
  pendingInvites,
  guestApprovalEvents,
  upcomingEvents,
  pastEvents,
  groupedUpcomingEvents,
  expandedEvents,
  onToggleExpand,
  onOpenEventCreation,
  onOpenDiscoverVenues,
}: HomeTabProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Action Section - More distinctive */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 sm:p-8 border border-primary/20">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Ready for your next gathering?</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Plan something memorable with your group
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onOpenEventCreation}
              size="lg"
              className="gap-2 glow-primary press-scale shadow-lg"
              data-testid="button-schedule-event"
            >
              <Calendar className="h-5 w-5" />
              Schedule Event
            </Button>
            <Button
              onClick={onOpenDiscoverVenues}
              size="lg"
              variant="outline"
              className="gap-2 hover-lift bg-background/80 backdrop-blur-sm"
              data-testid="button-discover-venues"
            >
              <Compass className="h-5 w-5" />
              Discover Venues
            </Button>
          </div>
        </div>
      </div>

      {/* Events Overview - Empty State */}
      {!eventsLoading && allGroupEvents.length === 0 && (
        <Card className="border-dashed border-2 bg-gradient-to-b from-muted/30 to-background">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Events Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Your group is ready! Create your first event and start making memories together.
            </p>
            <Button
              onClick={onOpenEventCreation}
              className="glow-primary"
              data-testid="button-create-first-event"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Event
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Invites Section - Alert styling */}
      {!eventsLoading && pendingInvites.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Pending Invites</h3>
              <p className="text-sm text-muted-foreground">{pendingInvites.length} event{pendingInvites.length !== 1 ? 's' : ''} awaiting your response</p>
            </div>
          </div>
          <EventsTable
            events={pendingInvites}
            expandedEvents={expandedEvents}
            onToggleExpand={onToggleExpand}
          />
        </section>
      )}

      {/* Guest Approval Section */}
      {!eventsLoading && guestApprovalEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Guest Approvals</h3>
              <p className="text-sm text-muted-foreground">{guestApprovalEvents.length} guest request{guestApprovalEvents.length !== 1 ? 's' : ''} need your attention</p>
            </div>
          </div>
          <EventsTable
            events={guestApprovalEvents}
            expandedEvents={expandedEvents}
            onToggleExpand={onToggleExpand}
          />
        </section>
      )}

      {/* Upcoming Events Section - Time-grouped with visual distinction */}
      {!eventsLoading && upcomingEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Upcoming Events</h3>
            <span className="text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted">
              {upcomingEvents.length} total
            </span>
          </div>

          <div className="space-y-6">
            {(['Today', 'Tomorrow', 'This Week', 'Next Week', 'Later'] as TimeCategory[]).map(category => {
              const categoryEvents = groupedUpcomingEvents.get(category) || [];
              if (categoryEvents.length === 0) return null;

              const config = categoryConfig[category];
              const Icon = config.icon;

              return (
                <div key={category} className="relative">
                  {/* Category Header - More distinctive */}
                  <div className={`flex items-center gap-2.5 mb-3 py-2 px-3 rounded-lg ${config.bgColor} border border-transparent`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={`text-sm font-semibold ${config.color}`}>
                      {category}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {categoryEvents.length} event{categoryEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <EventsTable
                    events={categoryEvents}
                    expandedEvents={expandedEvents}
                    onToggleExpand={onToggleExpand}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Past Events Section - Subdued styling */}
      {!eventsLoading && pastEvents.length > 0 && (
        <section className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-muted-foreground">Past Events</h3>
              <p className="text-sm text-muted-foreground/70">{pastEvents.length} completed</p>
            </div>
          </div>
          <div className="opacity-60 hover:opacity-80 transition-opacity">
            <EventsTable
              events={pastEvents}
              expandedEvents={expandedEvents}
              onToggleExpand={onToggleExpand}
            />
          </div>
        </section>
      )}
    </div>
  );
}
