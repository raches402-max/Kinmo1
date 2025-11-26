import { format, differenceInHours, differenceInDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronDown, ChevronUp, MapPin, ExternalLink, Bot, Check, X, HelpCircle, Loader2, Trash2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getRsvpColor } from "@/lib/tokens";

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to format name with last initial
function formatNameWithLastInitial(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName; // Single name, return as-is

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}

// Helper function to get pill color classes based on response
// Now uses centralized tokens from @/lib/tokens
const getResponsePillColor = getRsvpColor;

// Helper function to get RSVP counts
function getRsvpCounts(event: Event): { yes: number; maybe: number; no: number; pending: number } {
  const yesCount = event.rsvpSummary?.yes?.length || 0;
  const maybeCount = event.rsvpSummary?.maybe?.length || 0;
  const noCount = event.rsvpSummary?.no?.length || 0;

  // Calculate pending: total members minus those who responded
  const totalMembers = event.members?.length || 0;
  const respondedCount = yesCount + maybeCount + noCount;
  const pendingCount = Math.max(0, totalMembers - respondedCount);

  return { yes: yesCount, maybe: maybeCount, no: noCount, pending: pendingCount };
}

// Helper function to get members who haven't responded
function getMembersWithoutRsvp(event: Event): string[] {
  if (!event.members || !event.rsvpSummary) return [];

  const allRespondents = new Set([
    ...(event.rsvpSummary.yes || []),
    ...(event.rsvpSummary.maybe || []),
    ...(event.rsvpSummary.no || [])
  ]);

  return event.members
    .map(m => m.name || m.email || 'Unknown')
    .filter(name => !allRespondents.has(name));
}

type EventItem = {
  id: string;
  venueName: string;
  venueType: string;
  venueAddress: string;
  photoUrl: string | null;
  rating: string | null;
  googlePlaceId: string | null;
};

type Event = {
  inviteId: string;
  itineraryId: string | null;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  groupTimezone: string | null;
  eventDate: string | null;
  isOrganizer: boolean;
  isVirtual?: boolean;
  hostMemberId: string | null;
  hostMemberName: string | null;
  currentUserMemberId: string | null;
  items: EventItem[];
  rsvp: {
    response: string;
  } | null;
  // Auto-schedule properties
  isAutoScheduled?: boolean;
  status?: string;
  autoSendAt?: string;
  confidenceScore?: number;
  requiresReview?: boolean;
  // RSVP attendance data
  rsvpSummary?: {
    yes: string[];
    maybe: string[];
    no: string[];
  };
  detailedRsvps?: Array<{
    name: string;
    response: string;
    additionalAttendees: any[];
    numberOfKids: number;
    isGuest: boolean;
  }>;
  members?: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
};

type EventsTableProps = {
  events: Event[];
  expandedEvents: Set<string>;
  onToggleExpand: (eventId: string) => void;
  currentUserId?: string;
  isPastEvents?: boolean;
  onLeaveFeedback?: (event: Event) => void;
};

export default function EventsTable({
  events,
  expandedEvents,
  onToggleExpand,
  isPastEvents = false,
  onLeaveFeedback
}: EventsTableProps) {
  const { toast } = useToast();
  const [rsvpDropdownOpen, setRsvpDropdownOpen] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null);
  const [expandedAttendance, setExpandedAttendance] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // Toggle attendance expansion for a specific event
  const toggleAttendanceExpand = (eventId: string) => {
    setExpandedAttendance(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, response, notes }: { itineraryId: string; response: string; notes?: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/organizer-rsvp`, {
        response,
        notes: notes || undefined
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "RSVP updated",
        description: variables.response === "going" ? "See you there!" :
                     variables.response === "maybe" ? "Thanks for letting us know" :
                     "Thanks for the update"
      });
      setRsvpDropdownOpen(null);
      setFeedbackDialogOpen(null);
      setPendingResponse("");
      setFeedbackNote("");
    },
    onError: (error: any) => {
      toast({
        title: "Error updating RSVP",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventIdOrBulk: string | string[]) => {
      const eventIds = Array.isArray(eventIdOrBulk) ? eventIdOrBulk : [eventIdOrBulk];

      // Separate virtual from real events
      const virtualEventIds = eventIds.filter(id => id.startsWith('virtual-'));
      const realEventIds = eventIds.filter(id => !id.startsWith('virtual-'));

      // Process real event deletions
      if (realEventIds.length > 0) {
        await Promise.all(
          realEventIds.map(async (eventId) => {
            // Determine if this is an itinerary or an invite
            const event = events.find(e => e.itineraryId === eventId || e.inviteId === eventId);
            if (!event) throw new Error("Event not found");

            // Use the appropriate endpoint based on whether it's an itinerary or invite
            const endpoint = event.itineraryId
              ? `/api/itineraries/${event.itineraryId}`
              : `/api/itinerary-invites/${event.inviteId}`;

            await apiRequest("DELETE", endpoint);
          })
        );
      }

      return { virtualEventIds, realEventIds };
    },
    onMutate: async (eventIdOrBulk) => {
      const eventIds = Array.isArray(eventIdOrBulk) ? eventIdOrBulk : [eventIdOrBulk];
      const virtualEventIds = eventIds.filter(id => id.startsWith('virtual-'));
      const realEventIds = eventIds.filter(id => !id.startsWith('virtual-'));

      // For any events being deleted, optimistically remove from UI
      if (eventIds.length > 0) {
        await queryClient.cancelQueries({ queryKey: ["/api/user/events"] });
        const previousEvents = queryClient.getQueryData(["/api/user/events"]);

        queryClient.setQueryData(["/api/user/events"], (old: any) => {
          if (!old) return old;
          return old.filter((e: any) => {
            const id = e.itineraryId || e.inviteId;
            return !eventIds.includes(id);
          });
        });

        return { previousEvents, virtualEventIds, realEventIds };
      }
    },
    onSuccess: (data, variables, context: any) => {
      // Only invalidate queries if we deleted real events
      // Virtual events are already removed optimistically and shouldn't refetch
      if (context?.realEventIds && context.realEventIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      }

      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully"
      });
      setDeleteConfirmOpen(null);
      setSelectedEvents(new Set());
    },
    onError: (error: any, eventIdOrBulk, context: any) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(["/api/user/events"], context.previousEvents);
      }
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Determine border style based on event status
  const getEventBorderStyle = (event: Event): { borderColor: string; borderWidth: string; backgroundColor?: string } => {
    if (!event.isAutoScheduled) {
      // Regular event - thin border with group accent color
      return {
        borderColor: event.groupAccentColor || '#94A3B8',
        borderWidth: '2px'
      };
    }

    // Auto-scheduled event - determine status
    const status = event.status;
    const confidenceScore = event.confidenceScore || 0;
    const requiresReview = event.requiresReview;

    // Red: Blocked (low confidence, requires review, or other blocking issue)
    if (requiresReview || confidenceScore < 60 || status === 'blocked') {
      return {
        borderColor: '#ef4444', // red-500
        borderWidth: '4px',
        backgroundColor: 'rgba(254, 242, 242, 0.3)' // red-50/30
      };
    }

    // Green: Approved or auto-approved
    if (status === 'approved' || status === 'auto_approved' || status === 'scheduled') {
      return {
        borderColor: '#22c55e', // green-500
        borderWidth: '2px'
      };
    }

    // Yellow: Pending approval (will auto-send)
    return {
      borderColor: '#f59e0b', // amber-500
      borderWidth: '4px',
      backgroundColor: 'rgba(254, 243, 199, 0.3)' // amber-50/30
    };
  };

  // Get countdown text for auto-send deadline
  const getAutoSendCountdown = (event: Event): string | null => {
    if (!event.isAutoScheduled || !event.autoSendAt) return null;

    const now = new Date();
    const autoSendDate = new Date(event.autoSendAt);
    const hoursUntil = differenceInHours(autoSendDate, now);
    const daysUntil = differenceInDays(autoSendDate, now);

    if (hoursUntil < 0) return null; // Already auto-sent

    if (hoursUntil < 24) {
      return `Auto-sends in ${hoursUntil}h`;
    } else {
      return `Auto-sends in ${daysUntil}d`;
    }
  };

  const getGoogleMapsUrl = (venue: EventItem) => {
    if (venue.googlePlaceId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`;
    }
    if (venue.venueAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueAddress)}`;
    }
    return null;
  };

  const getRoleBadge = (event: Event) => {
    // Only show role info if user is hosting
    if (event.hostMemberId === event.currentUserMemberId && event.hostMemberName) {
      return (
        <span className="text-xs text-muted-foreground">
          Host: {event.hostMemberName}
        </span>
      );
    }
    // Don't show organizer or member badges - reduces clutter
    return null;
  };

  const getHostInfo = (event: Event) => {
    // Don't show host info if current user is the host (already shown in getRoleBadge)
    if (event.hostMemberId === event.currentUserMemberId) {
      return null;
    }

    if (event.hostMemberId && event.hostMemberName) {
      return (
        <span className="text-xs text-muted-foreground">
          hosts: {event.hostMemberName}
        </span>
      );
    }
    if (!event.hostMemberId) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="h-3 w-3" />
          Auto-scheduled
        </span>
      );
    }
    return null;
  };

  const handleRsvpResponse = (event: Event, response: string) => {
    const itineraryId = event.itineraryId;
    if (!itineraryId) return;

    // If selecting Maybe or Can't go, close dropdown and show feedback dialog
    if (response === "maybe" || response === "no") {
      setPendingResponse(response);
      setRsvpDropdownOpen(null); // Close the dropdown
      setFeedbackDialogOpen(itineraryId); // Open feedback dialog
      return;
    }

    // For "going", save immediately
    rsvpMutation.mutate({ itineraryId, response });
  };

  const handleSaveFeedback = (event: Event) => {
    const itineraryId = event.itineraryId;
    if (!itineraryId) return;

    rsvpMutation.mutate({
      itineraryId,
      response: pendingResponse,
      notes: feedbackNote.trim() || undefined
    });
  };

  const getRsvpDropdown = (event: Event) => {
    const currentResponse = event.rsvp?.response;
    const itineraryId = event.itineraryId;
    const isLoading = rsvpMutation.isPending && rsvpMutation.variables?.itineraryId === itineraryId;
    // Ensure dropdown is only open if itineraryId is not null and matches the open dropdown
    const isOpen = itineraryId !== null && rsvpDropdownOpen === itineraryId;

    // Determine display text and style
    const getDisplayInfo = () => {
      if (isLoading) return { text: "Updating...", className: "text-xs text-muted-foreground" };

      if (!currentResponse) return { text: "", className: "text-xs text-muted-foreground" };

      switch (currentResponse) {
        case "going":
        case "yes":
          return { text: "Attended", className: "text-xs text-green-600 font-medium" };
        case "maybe":
          return { text: "Maybe", className: "text-xs text-yellow-600 font-medium" };
        case "no":
          return { text: "Declined", className: "text-xs text-gray-500 font-medium" };
        default:
          return { text: currentResponse, className: "text-xs text-muted-foreground" };
      }
    };

    const displayInfo = getDisplayInfo();

    // For past events, show static text only
    if (isPastEvents) {
      return (
        <span className={displayInfo.className}>
          {displayInfo.text}
        </span>
      );
    }

    // Don't render dropdown for events without itineraryId
    if (!itineraryId) {
      return (
        <span className={displayInfo.className}>
          {displayInfo.text}
        </span>
      );
    }

    return (
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRsvpDropdownOpen(null);
          } else {
            setRsvpDropdownOpen(itineraryId);
          }
        }}
      >
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            className="h-auto p-1 hover:bg-muted w-full justify-between"
            disabled={isLoading || !itineraryId}
          >
            <span className={displayInfo.className}>
              {isLoading ? (
                <><Loader2 className="h-3 w-3 inline mr-1 animate-spin" />Updating...</>
              ) : (
                <>
                  {currentResponse === "going" || currentResponse === "yes" ? "Going ✓" :
                   currentResponse === "maybe" ? "Maybe" :
                   currentResponse === "no" ? "Can't go" :
                   "RSVP"}
                </>
              )}
            </span>
            {!isLoading && <span className="text-xs text-muted-foreground ml-2">▼</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleRsvpResponse(event, "going");
            }}
            className={currentResponse === "going" ? "bg-muted" : ""}
          >
            <Check className="h-4 w-4 mr-2 text-green-600" />
            <span>Going</span>
            {currentResponse === "going" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleRsvpResponse(event, "maybe");
            }}
            className={currentResponse === "maybe" ? "bg-muted" : ""}
          >
            <HelpCircle className="h-4 w-4 mr-2 text-yellow-600" />
            <span>Maybe</span>
            {currentResponse === "maybe" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleRsvpResponse(event, "no");
            }}
            className={currentResponse === "no" ? "bg-muted" : ""}
          >
            <X className="h-4 w-4 mr-2 text-gray-500" />
            <span>Can't go</span>
            {currentResponse === "no" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          {itineraryId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/event/${itineraryId}`} className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>View Details</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* Delete button bar */}
      {!isPastEvents && selectedEvents.size > 0 && (
        <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteConfirmOpen('bulk-delete');
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="space-y-3 sm:space-y-1">
        {/* Table Header - hidden on mobile, shown on sm+ */}
      <div className="hidden sm:grid grid-cols-[120px_minmax(150px,1fr)_150px_80px_60px] md:grid-cols-[150px_minmax(180px,1fr)_180px_100px_80px] lg:grid-cols-[40px_180px_minmax(200px,1fr)_250px_120px_280px_80px] gap-2 lg:gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
        <div className="hidden lg:flex items-center justify-center">
          {!isPastEvents && (
            <Checkbox
              checked={selectedEvents.size === events.length && events.length > 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedEvents(new Set(events.map(e => e.itineraryId || e.inviteId)));
                } else {
                  setSelectedEvents(new Set());
                }
              }}
            />
          )}
        </div>
        <div>DATE/TIME</div>
        <div>EVENT</div>
        <div>MEETING AT</div>
        <div>RSVP</div>
        <div className="hidden lg:block">ATTENDANCE</div>
        <div></div>
      </div>

      {/* Event Rows */}
      {events.map((event) => {
        const eventId = event.itineraryId || event.inviteId;
        const isExpanded = expandedEvents.has(eventId);
        const hasMultipleVenues = event.items && event.items.length > 1;
        const borderStyle = getEventBorderStyle(event);
        const countdown = getAutoSendCountdown(event);

        // Get relative date label for mobile cards
        const getRelativeDateLabel = (eventDate: string | null, timezone: string | null): string => {
          if (!eventDate) return 'TBD';
          const date = new Date(eventDate);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const diffDays = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 0) return 'Today';
          if (diffDays === 1) return 'Tomorrow';
          return timezone
            ? formatInTimeZone(date, timezone, "EEE, MMM d")
            : format(date, "EEE, MMM d");
        };

        // Get RSVP pill styling
        const getRsvpPillStyle = () => {
          const response = event.rsvp?.response;
          if (!response) return { bg: 'bg-muted', text: 'text-muted-foreground', label: 'RSVP' };
          switch (response) {
            case 'going':
            case 'yes':
              return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Going' };
            case 'maybe':
              return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Maybe' };
            case 'no':
              return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', label: 'Declined' };
            default:
              return { bg: 'bg-muted', text: 'text-muted-foreground', label: response };
          }
        };

        const rsvpStyle = getRsvpPillStyle();

        // Mobile card view (shown on xs screens only) - Warm & Friendly redesign
        const mobileCardContent = (
          <div
            className="sm:hidden p-4 bg-card rounded-soft shadow-warm hover:shadow-warm-hover transition-all cursor-pointer"
            style={{
              borderLeft: `4px solid ${borderStyle.borderColor}`,
              backgroundColor: borderStyle.backgroundColor || 'hsl(var(--card))'
            }}
          >
            {/* Top row: Group emoji/name + RSVP status */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-3xl flex-shrink-0">
                  {event.isAutoScheduled ? '🤖' : event.groupEmoji}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {event.groupName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getRelativeDateLabel(event.eventDate, event.groupTimezone)}
                    {event.eventDate && (
                      <span className="ml-1">
                        · {event.groupTimezone
                          ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "h:mm a")
                          : format(new Date(event.eventDate), "h:mm a")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={`rounded-pill px-3 py-1 text-xs font-medium ${rsvpStyle.bg} ${rsvpStyle.text} border-0`}
              >
                {rsvpStyle.label}
              </Badge>
            </div>

            {/* Venue info */}
            {event.items && event.items.length > 0 && !event.isVirtual && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {event.items.length === 1
                    ? event.items[0].venueName
                    : `${event.items[0].venueName} + ${event.items.length - 1} more`}
                </span>
              </div>
            )}

            {/* Bottom row: host info + countdown */}
            {(getHostInfo(event) || countdown) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                {getHostInfo(event)}
                {countdown && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium ml-auto">
                    {countdown}
                  </span>
                )}
              </div>
            )}
          </div>
        );

        // Desktop/tablet grid view (hidden on xs screens)
        const rowContent = (
          <div
            className="hidden sm:grid grid-cols-[120px_minmax(150px,1fr)_150px_80px_60px] md:grid-cols-[150px_minmax(180px,1fr)_180px_100px_80px] lg:grid-cols-[40px_180px_minmax(200px,1fr)_250px_120px_280px_80px] gap-2 lg:gap-4 px-3 py-3 hover:bg-muted/50 transition-colors items-center cursor-pointer"
            style={{
              borderLeft: `${borderStyle.borderWidth} solid ${borderStyle.borderColor}`,
              backgroundColor: borderStyle.backgroundColor
            }}
          >
                {/* Checkbox Column - Hidden on tablet/mobile */}
                <div
                  className="hidden lg:flex items-center justify-center"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {!isPastEvents && (
                    <Checkbox
                      checked={selectedEvents.has(eventId)}
                      onCheckedChange={(checked) => {
                        setSelectedEvents(prev => {
                          const newSet = new Set(prev);
                          if (checked) {
                            newSet.add(eventId);
                          } else {
                            newSet.delete(eventId);
                          }
                          return newSet;
                        });
                      }}
                    />
                  )}
                </div>

                {/* Date/Time Column */}
                <div className="text-sm">
                  {event.eventDate ? (
                    <>
                      <div className="font-medium">
                        {event.groupTimezone
                          ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "MMM d, h:mm a")
                          : format(new Date(event.eventDate), "MMM d, h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.groupTimezone
                          ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "EEEE")
                          : format(new Date(event.eventDate), "EEEE")}
                      </div>
                      {event.groupTimezone && (
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "zzz")}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">TBD</div>
                  )}
                </div>

                {/* Event Column */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl flex-shrink-0">
                    {event.isAutoScheduled ? '🤖' : event.groupEmoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Badge
                      variant="secondary"
                      className="font-semibold text-sm mb-1"
                      style={{
                        backgroundColor: event.groupAccentColor
                          ? hexToRgba(event.groupAccentColor, 0.15)
                          : 'rgba(148, 163, 184, 0.15)',
                        borderColor: event.groupAccentColor || '#94A3B8',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        color: event.groupAccentColor || 'inherit'
                      }}
                    >
                      {event.groupName}
                    </Badge>
                    <div className="flex gap-2 mt-1 items-center flex-wrap">
                      {getRoleBadge(event)}
                      {getHostInfo(event)}
                      {countdown && (
                        <span className="text-xs text-amber-600 font-medium">
                          ⏰ {countdown}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meeting At Column */}
                <div className="text-sm" onClick={(e) => e.stopPropagation()}>
                  {event.isVirtual ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-auto p-1 text-muted-foreground hover:text-foreground text-sm font-normal justify-start"
                        >
                          {(() => {
                            // Use autoSendAt if available, otherwise calculate 7 days before event
                            if (event.autoSendAt) {
                              return `Will be decided on ${format(new Date(event.autoSendAt), "MMM d")} ▼`;
                            } else if (event.eventDate) {
                              const planDate = new Date(event.eventDate);
                              planDate.setDate(planDate.getDate() - 7); // Changed from 3 to 7 days
                              return `Will be decided on ${format(planDate, "MMM d")} ▼`;
                            }
                            return "Planning in progress ▼";
                          })()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href={`/group/${event.groupId}?action=schedule`} className="flex items-center">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Decide Now
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : !event.items || event.items.length === 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-auto p-1 text-muted-foreground hover:text-foreground text-sm font-normal justify-start"
                        >
                          TBD ▼
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href={`/group/${event.groupId}?action=schedule`} className="flex items-center">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Decide Now
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div>
                      {(() => {
                        const mapsUrl = getGoogleMapsUrl(event.items[0]);
                        const venueName = event.items.length === 1 ? event.items[0].venueName : `${event.items[0].venueName} + ${event.items.length - 1}`;

                        return mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium truncate hover:underline hover:text-primary flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {venueName}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <div className="font-medium truncate">{venueName}</div>
                        );
                      })()}
                      {event.items[0].venueAddress && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {event.items[0].venueAddress}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* RSVP Column */}
                <div className="text-sm">
                  {getRsvpDropdown(event)}
                </div>

                {/* Attendance Column - Hidden on tablet/mobile */}
                <div className="hidden lg:block text-sm" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const counts = getRsvpCounts(event);
                    const isAttendanceExpanded = expandedAttendance.has(eventId);
                    const hasRsvpData = event.rsvpSummary || event.members;

                    if (!hasRsvpData) {
                      return <span className="text-muted-foreground">—</span>;
                    }

                    // Collapsed view: Show pills
                    if (!isAttendanceExpanded) {
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAttendanceExpand(eventId);
                          }}
                          className="flex flex-wrap gap-1.5 items-center hover:opacity-80 transition-opacity"
                        >
                          {counts.yes > 0 && (
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getResponsePillColor('yes')}`}>
                              ✅ {counts.yes} yes
                            </Badge>
                          )}
                          {counts.maybe > 0 && (
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getResponsePillColor('maybe')}`}>
                              ❓ {counts.maybe} maybe
                            </Badge>
                          )}
                          {counts.no > 0 && (
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getResponsePillColor('no')}`}>
                              ❌ {counts.no} no
                            </Badge>
                          )}
                          {counts.pending > 0 && (
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getResponsePillColor('pending')}`}>
                              ⏳ {counts.pending} pending
                            </Badge>
                          )}
                          <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                        </button>
                      );
                    }

                    // Expanded view: Show detailed list
                    const pendingMembers = getMembersWithoutRsvp(event);

                    return (
                      <div className="space-y-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAttendanceExpand(eventId);
                          }}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors mb-1"
                        >
                          <ChevronUp className="h-3 w-3" />
                          <span className="text-xs font-medium">Hide details</span>
                        </button>

                        {counts.yes > 0 && (
                          <div>
                            <div className="text-xs font-medium text-green-700 mb-1">
                              ✅ Yes ({counts.yes})
                            </div>
                            <div className="text-xs text-green-600">
                              {event.rsvpSummary?.yes?.map(name => formatNameWithLastInitial(name)).join(', ')}
                            </div>
                          </div>
                        )}

                        {counts.maybe > 0 && (
                          <div>
                            <div className="text-xs font-medium text-yellow-700 mb-1">
                              ❓ Maybe ({counts.maybe})
                            </div>
                            <div className="text-xs text-yellow-600">
                              {event.rsvpSummary?.maybe?.map(name => formatNameWithLastInitial(name)).join(', ')}
                            </div>
                          </div>
                        )}

                        {counts.no > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">
                              ❌ No ({counts.no})
                            </div>
                            <div className="text-xs text-gray-500">
                              {event.rsvpSummary?.no?.map(name => formatNameWithLastInitial(name)).join(', ')}
                            </div>
                          </div>
                        )}

                        {counts.pending > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-900 mb-1">
                              ⏳ No Response ({counts.pending})
                            </div>
                            <div className="text-xs text-gray-700">
                              {pendingMembers.map(name => formatNameWithLastInitial(name)).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Actions Column - Expand Arrow & Delete */}
                <div className="flex items-center gap-1 justify-end">
                  {isPastEvents && onLeaveFeedback && (event.rsvp?.response === 'yes' || event.isOrganizer) && !(event.rsvp as any)?.postEventFeedback && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLeaveFeedback(event);
                      }}
                      className="h-7 text-xs"
                    >
                      Feedback
                    </Button>
                  )}
                  <div
                    onClick={(e) => {
                      if (hasMultipleVenues) {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleExpand(eventId);
                      }
                    }}
                  >
                    {hasMultipleVenues && (
                      <button className="p-1 hover:bg-muted rounded">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
        );

        return (
          <div key={eventId} className="border-b last:border-b-0">
            {/* Main Row - Mobile card + Desktop grid */}
            <Link href={event.itineraryId ? `/event/${event.itineraryId}` : `/group/${event.groupId}`}>
              {mobileCardContent}
              {rowContent}
            </Link>

            {/* Expanded Venue List */}
            {isExpanded && hasMultipleVenues && (
              <div className="bg-muted/30 px-3 py-2 space-y-2">
                {event.items.map((venue, idx) => {
                  const mapsUrl = getGoogleMapsUrl(venue);
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm sm:pl-[120px] md:pl-[150px] lg:pl-[220px]">
                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="text-xs text-muted-foreground min-w-0 sm:min-w-[100px] md:min-w-[150px] truncate">
                        {venue.venueAddress || "Address not available"}
                      </div>
                      <div className="font-medium truncate">→ {venue.venueName}</div>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 ml-auto flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="hidden sm:inline">Maps</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Delete/Skip Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmOpen === 'bulk-delete'
                ? `Delete ${selectedEvents.size} Event${selectedEvents.size > 1 ? 's' : ''}`
                : (() => {
                    const event = events.find(e => e.itineraryId === deleteConfirmOpen || e.inviteId === deleteConfirmOpen);
                    return event?.isOrganizer ? "Delete Event" : "Skip This Event";
                  })()
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmOpen === 'bulk-delete'
                ? `Are you sure you want to delete ${selectedEvents.size} event${selectedEvents.size > 1 ? 's' : ''}? This action cannot be undone.`
                : (() => {
                    const event = events.find(e => e.itineraryId === deleteConfirmOpen || e.inviteId === deleteConfirmOpen);
                    if (event?.isOrganizer) {
                      return "Are you sure you want to delete this event? This action cannot be undone. All invites and RSVPs will be permanently removed.";
                    } else {
                      return "Are you sure you want to skip this event? This will remove it from your events list.";
                    }
                  })()
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirmOpen === 'bulk-delete') {
                  deleteEventMutation.mutate(Array.from(selectedEvents));
                } else if (deleteConfirmOpen) {
                  deleteEventMutation.mutate(deleteConfirmOpen);
                }
              }}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? "Deleting..." :
                deleteConfirmOpen === 'bulk-delete' ? "Delete All" :
                (() => {
                  const event = events.find(e => e.itineraryId === deleteConfirmOpen || e.inviteId === deleteConfirmOpen);
                  return event?.isOrganizer ? "Delete" : "Skip";
                })()
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* RSVP Feedback Dialog */}
      <AlertDialog open={!!feedbackDialogOpen} onOpenChange={(open) => !open && setFeedbackDialogOpen(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingResponse === "maybe" ? "Maybe attending?" : "Can't make it?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your feedback helps us plan better events (optional)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="e.g., Can't make it this week..."
              className="min-h-24"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                // Skip feedback - just submit the RSVP without notes
                if (feedbackDialogOpen) {
                  rsvpMutation.mutate({
                    itineraryId: feedbackDialogOpen,
                    response: pendingResponse
                  });
                }
                setFeedbackDialogOpen(null);
                setPendingResponse("");
                setFeedbackNote("");
              }}
              disabled={rsvpMutation.isPending}
            >
              Skip
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (feedbackDialogOpen) {
                  const event = events.find(e => e.itineraryId === feedbackDialogOpen);
                  if (event) {
                    handleSaveFeedback(event);
                  }
                }
              }}
              disabled={rsvpMutation.isPending}
            >
              {rsvpMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                "Save"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
  );
}
