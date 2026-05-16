import { useState } from "react";
import { format, isPast, isToday, isTomorrow, differenceInDays, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
  Send,
  Edit3,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Timer,
  Loader2,
  Plus,
  Zap,
  Coffee,
  Utensils,
  Wine,
  PartyPopper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { didEventHappen } from "@/lib/events";

interface ItineraryItem {
  id: string;
  venueName: string;
  venueAddress?: string;
  venueType?: string;
  photoUrl?: string;
}

interface Itinerary {
  id: string;
  name?: string;
  status: string; // draft, saved, proposed, scheduled, rejected
  eventDate?: string;
  inviteSentAt?: string;
  hostMemberName?: string;
  items: ItineraryItem[];
  rsvpCount?: {
    yes: number;
    maybe: number;
    no: number;
    pending: number;
  };
  confidenceScore?: number;
  autoSendAt?: string;
}

interface EventTimelineProps {
  groupId: string;
  groupName: string;
  groupTimezone?: string;
  itineraries: Itinerary[];
  onCreateEvent?: () => void;
  onEditItinerary?: (itineraryId: string) => void;
  onSendInvites?: (itineraryId: string) => void;
  isAutoScheduleEnabled?: boolean;
}

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <Edit3 className="h-3 w-3" />,
  },
  saved: {
    label: "Saved",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  proposed: {
    label: "Voting",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <Users className="h-3 w-3" />,
  },
  scheduled: {
    label: "Confirmed",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  past: {
    label: "Completed",
    color: "bg-slate-100 text-slate-500 border-slate-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

// Quick create options
const QUICK_CREATE_OPTIONS = [
  { id: "surprise", label: "Surprise Me", icon: <Sparkles className="h-5 w-5" />, desc: "AI picks everything" },
  { id: "dinner", label: "Dinner", icon: <Utensils className="h-5 w-5" />, desc: "Restaurant night" },
  { id: "drinks", label: "Drinks", icon: <Wine className="h-5 w-5" />, desc: "Bar hopping" },
  { id: "coffee", label: "Coffee", icon: <Coffee className="h-5 w-5" />, desc: "Casual meetup" },
  { id: "activity", label: "Activity", icon: <PartyPopper className="h-5 w-5" />, desc: "Something fun" },
];

export function EventTimeline({
  groupId,
  groupName,
  groupTimezone,
  itineraries,
  onCreateEvent,
  onEditItinerary,
  onSendInvites,
  isAutoScheduleEnabled = false,
}: EventTimelineProps) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Send invites mutation
  const sendInvitesMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/send-invites`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/itineraries`] });
      toast({
        title: "Invites Sent!",
        description: "Group members have been notified about this event.",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Quick create mutation
  const quickCreateMutation = useMutation({
    mutationFn: async (eventType: string) => {
      return await apiRequest("POST", `/api/groups/${groupId}/quick-event`, {
        eventType,
        useAI: eventType === "surprise",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/itineraries`] });
      toast({
        title: "Event Created!",
        description: data.message || "Your event is ready to customize.",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Determine effective status (handle past events)
  const getEffectiveStatus = (itinerary: Itinerary): string => {
    if (itinerary.eventDate && isPast(new Date(itinerary.eventDate))) {
      return "past";
    }
    return itinerary.status;
  };

  // Get relative date label
  const getDateLabel = (dateStr?: string): string => {
    if (!dateStr) return "Date TBD";
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";

    const daysUntil = differenceInDays(date, new Date());
    if (daysUntil < 7) {
      return groupTimezone
        ? formatInTimeZone(date, groupTimezone, "EEEE")
        : format(date, "EEEE");
    }
    return groupTimezone
      ? formatInTimeZone(date, groupTimezone, "MMM d")
      : format(date, "MMM d");
  };

  // Get time string
  const getTimeString = (dateStr?: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return groupTimezone
      ? formatInTimeZone(date, groupTimezone, "h:mm a")
      : format(date, "h:mm a");
  };

  // Determine if action is needed
  const needsAction = (itinerary: Itinerary): boolean => {
    const status = getEffectiveStatus(itinerary);
    // Draft with date but no invites sent
    if (status === "draft" && itinerary.eventDate && !itinerary.inviteSentAt) {
      return true;
    }
    // Low confidence auto-scheduled events
    if (itinerary.confidenceScore && itinerary.confidenceScore < 60) {
      return true;
    }
    return false;
  };

  // Sort itineraries: upcoming first, then by date
  const sortedItineraries = [...itineraries].sort((a, b) => {
    const aDate = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
    const bDate = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
    const aPast = a.eventDate ? isPast(new Date(a.eventDate)) : false;
    const bPast = b.eventDate ? isPast(new Date(b.eventDate)) : false;

    // Non-past events come first
    if (aPast !== bPast) return aPast ? 1 : -1;
    // Sort by date
    return aDate - bDate;
  });

  // Separate upcoming and past
  const upcomingEvents = sortedItineraries.filter(
    (i) => !i.eventDate || !isPast(new Date(i.eventDate))
  );
  // Past events only count if they actually happened (>=1 "yes" RSVP, not
  // cancelled). Past-dated events that didn't happen are dropped entirely.
  const pastEvents = sortedItineraries.filter(
    (i) => i.eventDate && isPast(new Date(i.eventDate)) && didEventHappen(i)
  ).slice(0, 3); // Show only last 3 past events

  const renderTimelineItem = (itinerary: Itinerary) => {
    const status = getEffectiveStatus(itinerary);
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const showActions = needsAction(itinerary);
    const isExpanded = expandedId === itinerary.id;

    return (
      <div key={itinerary.id} className="timeline-item relative pl-8 pb-6 last:pb-0">
        {/* Timeline dot */}
        <div
          className={`absolute left-0 top-1 w-4 h-4 rounded-full border-[3px] bg-background
            ${status === "scheduled" ? "border-green-500" : ""}
            ${status === "proposed" ? "border-amber-500" : ""}
            ${status === "draft" ? "border-slate-300 border-dashed" : ""}
            ${status === "past" ? "border-slate-300" : ""}
            ${showActions ? "border-rose-400" : ""}
          `}
        />

        {/* Event card */}
        <div
          className={`rounded-lg border bg-card p-4 transition-all hover:shadow-md cursor-pointer
            ${showActions ? "border-l-4 border-l-rose-400" : ""}
          `}
          onClick={() => setExpandedId(isExpanded ? null : itinerary.id)}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              {/* Date & Status */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {getDateLabel(itinerary.eventDate)}
                </span>
                {itinerary.eventDate && (
                  <span className="text-xs text-muted-foreground">
                    {getTimeString(itinerary.eventDate)}
                  </span>
                )}
                <Badge variant="outline" className={`text-2xs px-1.5 py-0 ${statusConfig.color}`}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </div>

              {/* Title */}
              <h4 className="font-semibold text-sm">
                {itinerary.name || `${groupName} Event`}
              </h4>

              {/* Venues preview */}
              {itinerary.items.length > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {itinerary.items.length === 1
                    ? itinerary.items[0].venueName
                    : `${itinerary.items[0].venueName} + ${itinerary.items.length - 1} more`}
                </p>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {/* RSVP counts */}
                {itinerary.rsvpCount && itinerary.status === "proposed" && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {itinerary.rsvpCount.yes} yes, {itinerary.rsvpCount.maybe} maybe
                  </span>
                )}

                {/* Auto-send countdown */}
                {itinerary.autoSendAt && !itinerary.inviteSentAt && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Timer className="h-3 w-3" />
                    Auto-sends {getDateLabel(itinerary.autoSendAt)}
                  </span>
                )}

                {/* Host info */}
                {itinerary.hostMemberName && (
                  <span>Host: {itinerary.hostMemberName}</span>
                )}

                {/* Confidence score for auto events */}
                {itinerary.confidenceScore !== undefined && (
                  <Badge
                    variant="outline"
                    className={`text-2xs ${
                      itinerary.confidenceScore >= 80
                        ? "bg-green-50 text-green-700 border-green-200"
                        : itinerary.confidenceScore >= 60
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    {itinerary.confidenceScore}% confidence
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Primary action based on status */}
              {status === "draft" && !itinerary.inviteSentAt && (
                <Button
                  size="sm"
                  onClick={() => onSendInvites?.(itinerary.id) || sendInvitesMutation.mutate(itinerary.id)}
                  disabled={sendInvitesMutation.isPending}
                  className="h-7 text-xs"
                >
                  {sendInvitesMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              )}

              {/* More actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditItinerary?.(itinerary.id)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Event
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/event/${itinerary.id}`}>
                      <ChevronRight className="h-4 w-4 mr-2" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  {status === "proposed" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-green-600">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Finalize Event
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && itinerary.items.length > 1 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {itinerary.items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{item.venueName}</span>
                  {item.venueType && (
                    <span className="text-xs text-muted-foreground">({item.venueType})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Event Timeline</CardTitle>
          {isAutoScheduleEnabled && (
            <Badge variant="outline" className="text-2xs bg-amber-50 text-amber-700 border-amber-200">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              Auto-scheduling on
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={onCreateEvent} className="gap-1">
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Quick Create Section */}
        {upcomingEvents.length === 0 && (
          <div className="mb-6 p-6 rounded-lg border-2 border-dashed bg-muted/30 text-center">
            <h3 className="font-semibold mb-1">No upcoming events</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your next gathering with one click
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_CREATE_OPTIONS.slice(0, 4).map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  onClick={() => quickCreateMutation.mutate(option.id)}
                  disabled={quickCreateMutation.isPending}
                  className="gap-1.5"
                >
                  {option.icon}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {upcomingEvents.length > 0 && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary via-muted to-transparent" />

            {/* Events */}
            <div className="space-y-0">
              {upcomingEvents.map(renderTimelineItem)}
            </div>
          </div>
        )}

        {/* Past Events Section */}
        {pastEvents.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Recent Events
            </h4>
            <div className="space-y-2">
              {pastEvents.map((itinerary) => (
                <Link key={itinerary.id} href={`/event/${itinerary.id}`}>
                  <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{itinerary.name || "Event"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {itinerary.eventDate &&
                        (groupTimezone
                          ? formatInTimeZone(new Date(itinerary.eventDate), groupTimezone, "MMM d")
                          : format(new Date(itinerary.eventDate), "MMM d"))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
