import { format, differenceInHours, differenceInDays } from "date-fns";
import { ChevronDown, ChevronUp, MapPin, ExternalLink, Bot, Check, X, HelpCircle, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
};

type EventsTableProps = {
  events: Event[];
  expandedEvents: Set<string>;
  onToggleExpand: (eventId: string) => void;
  currentUserId?: string;
};

export default function EventsTable({
  events,
  expandedEvents,
  onToggleExpand
}: EventsTableProps) {
  const { toast } = useToast();
  const [rsvpDropdownOpen, setRsvpDropdownOpen] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null);

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
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully"
      });
      setDeleteConfirmOpen(null);
    },
    onError: (error: any) => {
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
      return `https://www.google.com/maps/search/?api=1&query_place_id=${venue.googlePlaceId}`;
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
          AI scheduling
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
          return { text: "Going ✓", className: "text-xs text-green-600 font-medium" };
        case "maybe":
          return { text: "Maybe", className: "text-xs text-yellow-600 font-medium" };
        case "no":
          return { text: "Can't go", className: "text-xs text-gray-500 font-medium" };
        default:
          return { text: currentResponse, className: "text-xs text-muted-foreground" };
      }
    };

    const displayInfo = getDisplayInfo();

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
                <><Loader2 className="h-3 w-3 inline mr-1 animate-spin" />{displayInfo.text}</>
              ) : (
                displayInfo.text
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
              <Link href={`/event/${itineraryId}`} onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>View Details</span>
                </DropdownMenuItem>
              </Link>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-1">
      {/* Table Header */}
      <div className="grid grid-cols-[180px_1fr_200px_120px_80px] gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
        <div>DATE/TIME</div>
        <div>EVENT</div>
        <div>MEETING AT</div>
        <div>RSVP</div>
        <div></div>
      </div>

      {/* Event Rows */}
      {events.map((event) => {
        const eventId = event.itineraryId || event.inviteId;
        const isExpanded = expandedEvents.has(eventId);
        const hasMultipleVenues = event.items && event.items.length > 1;
        const borderStyle = getEventBorderStyle(event);
        const countdown = getAutoSendCountdown(event);

        const rowContent = (
          <div
            className="grid grid-cols-[180px_1fr_200px_120px_80px] gap-4 px-3 py-3 hover:bg-muted/50 transition-colors items-center cursor-pointer"
            style={{
              borderLeft: `${borderStyle.borderWidth} solid ${borderStyle.borderColor}`,
              backgroundColor: borderStyle.backgroundColor
            }}
          >
                {/* Date/Time Column */}
                <div className="text-sm">
                  {event.eventDate ? (
                    <>
                      <div className="font-medium">
                        {format(new Date(event.eventDate), "MMM d, h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.eventDate), "EEEE")}
                      </div>
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
                    <div className="font-bold text-base truncate">{event.groupName}</div>
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
                <div className="text-sm">
                  {event.isVirtual ? (
                    <div className="text-muted-foreground">
                      {event.eventDate ? (() => {
                        const planDate = new Date(event.eventDate);
                        planDate.setDate(planDate.getDate() - 3);
                        return `Will be decided on ${format(planDate, "MMM d")}`;
                      })() : "Planning in progress"}
                    </div>
                  ) : !event.items || event.items.length === 0 ? (
                    <div className="text-muted-foreground">TBD</div>
                  ) : (
                    <div>
                      <div className="font-medium truncate">
                        {event.items.length === 1 ? event.items[0].venueName : `${event.items[0].venueName} + ${event.items.length - 1}`}
                      </div>
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

                {/* Actions Column - Expand Arrow & Delete */}
                <div className="flex items-center gap-1 justify-end">
                  {event.isOrganizer && event.itineraryId && (
                    <button
                      className="p-1 hover:bg-destructive/10 rounded text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteConfirmOpen(event.itineraryId);
                      }}
                      title="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
            {/* Main Row */}
            <Link href={event.itineraryId ? `/event/${event.itineraryId}` : `/group/${event.groupId}`}>
              {rowContent}
            </Link>

            {/* Expanded Venue List */}
            {isExpanded && hasMultipleVenues && (
              <div className="bg-muted/30 px-3 py-2 space-y-2">
                {event.items.map((venue, idx) => {
                  const mapsUrl = getGoogleMapsUrl(venue);
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm pl-[180px]">
                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="text-xs text-muted-foreground min-w-[150px]">
                        {venue.venueAddress || "Address not available"}
                      </div>
                      <div className="font-medium">→ {venue.venueName}</div>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Maps
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
              All invites and RSVPs will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirmOpen) {
                  deleteEventMutation.mutate(deleteConfirmOpen);
                }
              }}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
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
  );
}
