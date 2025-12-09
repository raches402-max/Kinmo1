import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  Clock,
  Link as LinkIcon,
  Navigation,
  Edit,
  Trash2,
  CheckCircle2,
  MinusCircle,
  GripVertical,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { TimeSlotVoting } from "@/components/TimeSlotVoting";
import { EditVenueDialog } from "@/components/EditVenueDialog";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventSummaryStrip } from "@/components/EventSummaryStrip";
import { MobileEventDetails, DesktopEventDetails } from "@/components/event-detail";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn, formatDateTimeWithTimezone } from "@/lib/utils";

interface SortableVenueCardProps {
  venue: any;
  idx: number;
  isOrganizer: boolean;
  toast: any;
  queryClient: any;
  onEdit?: (venue: any) => void;
}

function SortableVenueCard({ venue, idx, isOrganizer, toast, queryClient, onEdit }: SortableVenueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: venue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = async () => {
    if (confirm(`Remove "${venue.venueName}" from itinerary?`)) {
      try {
        const response = await fetch(`/api/itinerary-items/${venue.id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to delete: ${response.status}`);
        }

        queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
        toast({
          title: "Removed",
          description: `${venue.venueName} has been removed`,
        });
      } catch (error: any) {
        console.error("[Delete Venue] Error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to remove venue",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50 z-50" : ""}>
      {/* Mobile: Simplified compact card */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{idx + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{venue.venueName}</h4>
              {venue.rating && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {venue.rating}
                </span>
              )}
            </div>
            {venue.venueAddress && (
              <p className="text-xs text-muted-foreground truncate">{venue.venueAddress}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {venue.googlePlaceId && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-primary"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {isOrganizer && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(venue)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Full card with all details */}
      <Card className="p-4 hover:shadow-md transition-shadow hidden sm:block">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          {isOrganizer && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm font-semibold text-primary">{idx + 1}</span>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-lg truncate">{venue.venueName}</h4>
                {venue.venueAddress && (
                  <div className="flex items-start gap-1 text-sm text-muted-foreground mt-0.5">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{venue.venueAddress}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {venue.sourceType === 'ad_hoc' && (
                  <Badge variant="secondary" className="text-xs px-1.5">Custom</Badge>
                )}
                {isOrganizer && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onEdit?.(venue)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Timing & Details */}
            {(venue.arrivalTime || venue.departureTime || venue.travelNotes || venue.notes) && (
              <div className="space-y-1 text-sm">
                {(venue.arrivalTime || venue.departureTime) && (
                  <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                    <Clock className="h-4 w-4 shrink-0" />
                    {venue.arrivalTime && <span>{format(new Date(venue.arrivalTime), 'h:mm a')}</span>}
                    {venue.arrivalTime && venue.departureTime && <span>–</span>}
                    {venue.departureTime && <span>{format(new Date(venue.departureTime), 'h:mm a')}</span>}
                  </div>
                )}
                {venue.travelNotes && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Navigation className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{venue.travelNotes}</span>
                  </div>
                )}
                {venue.notes && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <span className="text-xs">📝</span>
                    <span className="line-clamp-2">{venue.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              {venue.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{venue.rating}</span>
                </div>
              )}
              {venue.googlePlaceId && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                  data-testid={`link-maps-${venue.id}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Maps
                </a>
              )}
              {venue.googleMapsUrl && !venue.googlePlaceId && (
                <a
                  href={venue.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Link
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function EventDetailsPage() {
  const [, params] = useRoute("/event/:id");
  const eventId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [guestName, setGuestName] = useState("");
  const [isAttendeesExpanded, setIsAttendeesExpanded] = useState(false);
  const [isGuestsExpanded, setIsGuestsExpanded] = useState(false);
  const [showAddVenueDialog, setShowAddVenueDialog] = useState(false);
  const [showEditVenueDialog, setShowEditVenueDialog] = useState(false);
  const [venueToEdit, setVenueToEdit] = useState<any>(null);
  const [schedulingPreferences, setSchedulingPreferences] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);
  const [isTimeSlotExpanded, setIsTimeSlotExpanded] = useState(false);
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);
  const [mobileDatePickerDate, setMobileDatePickerDate] = useState<Date | null>(null);
  const [showAddInviteeDialog, setShowAddInviteeDialog] = useState(false);
  const [newInviteeName, setNewInviteeName] = useState("");

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch all events and use select to extract the one we need
  // This leverages React Query's caching - if events are already cached, no network request
  const { data: eventFromList, isLoading } = useQuery<any>({
    queryKey: ["/api/user/events"],
    select: (events) => {
      // Find the event matching this eventId
      const foundEvent = events?.find((e: any) => e.itineraryId === eventId);
      return foundEvent || null;
    },
  });

  // Fallback: If event not found in user events (e.g., proposed itinerary without invites, or standalone events),
  // fetch directly from itinerary endpoint
  const { data: fallbackItinerary, isLoading: fallbackLoading } = useQuery<any>({
    queryKey: ["/api/itineraries/:id", eventId],
    enabled: !!eventId && !eventFromList && !isLoading,
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${eventId}`);
      if (!response.ok) return null;
      const itinerary = await response.json();

      if (itinerary) {
        // Transform itinerary to match event structure
        // Handle both group-based and standalone events
        return {
          itineraryId: itinerary.id,
          itineraryName: itinerary.name,
          eventDate: itinerary.eventDate,
          groupId: itinerary.groupId || null,
          groupName: itinerary.group?.name || null,
          groupEmoji: itinerary.group?.emoji || (itinerary.isStandalone ? "📅" : null),
          groupTimezone: itinerary.group?.timezone || null,
          groupAccentColor: itinerary.group?.accentColor || "#6366f1",
          items: itinerary.items || [],
          isOrganizer: true, // Assume organizer for proposed/standalone itineraries
          members: itinerary.members || [],
          rsvp: itinerary.rsvp || null,
          invitees: itinerary.invitees || [], // For standalone events
          isStandalone: itinerary.isStandalone || false,
          status: itinerary.status || 'draft',
        };
      }
      return null;
    },
  });

  // Use fallback if main event not found
  const event = eventFromList || fallbackItinerary;

  // Fetch full itinerary details including time slots for proposed itineraries
  const { data: itineraryDetails } = useQuery<any>({
    queryKey: ["/api/itineraries/:id", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${eventId}`);
      if (!response.ok) throw new Error('Failed to fetch itinerary');
      return response.json();
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
      console.log('[organizerRsvpMutation] Sending RSVP:', { eventId, response });
      const result = await apiRequest("POST", `/api/itineraries/${eventId}/organizer-rsvp`, {
        response,
      });
      console.log('[organizerRsvpMutation] Response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[organizerRsvpMutation] Success! Data:', data);
      // Invalidate both endpoints to ensure the RSVP is reflected
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "RSVP updated",
        description: "Your response has been recorded",
      });
    },
    onError: (error: any) => {
      console.error('[organizerRsvpMutation] Error:', error);
      toast({
        title: "Failed to update RSVP",
        description: error.message || "Please try again",
        variant: "destructive",
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

  const updateGuestMutation = useMutation({
    mutationFn: async ({ guestId, guestName }: { guestId: string; guestName: string }) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}/guest-invites/${guestId}`, {
        guestName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id/guest-invites", eventId] });
      toast({
        title: "Guest updated",
        description: "Guest name has been updated",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const deleteGuestMutation = useMutation({
    mutationFn: async (guestId: string) => {
      return apiRequest("DELETE", `/api/itineraries/${eventId}/guest-invites/${guestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id/guest-invites", eventId] });
      toast({
        title: "Guest removed",
        description: "Guest has been removed from this event",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const finalizeItineraryMutation = useMutation({
    mutationFn: async (timeSlotId: string) => {
      const selectedSlot = itineraryDetails?.proposedTimeSlots?.find((s: any) => s.id === timeSlotId);
      if (!selectedSlot) throw new Error("Time slot not found");

      return apiRequest("PUT", `/api/itineraries/${eventId}`, {
        eventDate: selectedSlot.proposedDateTime,
        sendInvites: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "Event finalized!",
        description: "Invites have been sent to all members",
      });
      // Navigate to event details page (will now show as confirmed event)
      setLocation(`/event/${eventId}`);
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const sendToGroupMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventDate) throw new Error("Event date is required");
      return apiRequest("POST", `/api/itineraries/${eventId}/send`, {
        isPrimary: true,
        eventDate: event.eventDate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "Event sent to group!",
        description: "Group members will receive notifications about this event."
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    }
  });

  const sendStandaloneInvitesMutation = useMutation({
    mutationFn: async () => {
      if (!event?.eventDate) throw new Error("Event date is required");
      return apiRequest("POST", `/api/standalone-events/${eventId}/send-invites`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "Invites sent!",
        description: "Your invitees will receive notifications about this event."
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    }
  });

  const reorderVenuesMutation = useMutation({
    mutationFn: async (proposedOrder: string[]) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}/order`, {
        proposedOrder,
      });
    },
    onMutate: async (proposedOrder) => {
      // Cancel any outgoing refetches - use correct query key (the events list, not individual event)
      await queryClient.cancelQueries({ queryKey: ["/api/user/events"] });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData(["/api/user/events"]) as any[] | undefined;

      // Optimistically update to the new value
      if (previousEvents) {
        const updatedEvents = previousEvents.map((evt: any) => {
          if (evt.itineraryId !== eventId) return evt;
          // Reorder items for this specific event
          const idToItem = new Map(evt.items.map((item: any) => [item.id, item]));
          const newItems = proposedOrder.map(id => idToItem.get(id)).filter(Boolean);
          return { ...evt, items: newItems };
        });

        queryClient.setQueryData(["/api/user/events"], updatedEvents);
      }

      // Return context with the snapshot
      return { previousEvents };
    },
    onError: (err, proposedOrder, context) => {
      // Rollback to the previous value on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["/api/user/events"], context.previousEvents);
      }
      toast(getErrorToast(err));
    },
    onSuccess: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Order updated",
        description: "Venue order has been updated",
      });
    },
  });

  const regenerateVenuesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/itineraries/${eventId}/decide-now`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Venues regenerated!",
        description: `AI selected ${data.venueCount} new venue${data.venueCount > 1 ? 's' : ''} for your event.`
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    }
  });

  const updateEventDateMutation = useMutation({
    mutationFn: async (eventDate: Date) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}`, {
        eventDate: eventDate.toISOString(),
      });
    },
    onMutate: async (newDate: Date) => {
      // Cancel outgoing refetches - use correct query key (events list)
      await queryClient.cancelQueries({ queryKey: ["/api/user/events"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(["/api/user/events"]) as any[] | undefined;

      // Optimistically update to the new value
      if (previousEvents) {
        const updatedEvents = previousEvents.map((evt: any) => {
          if (evt.itineraryId !== eventId) return evt;
          return { ...evt, eventDate: newDate.toISOString() };
        });
        queryClient.setQueryData(["/api/user/events"], updatedEvents);
      }

      return { previousEvents };
    },
    onError: (err, newDate, context: any) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["/api/user/events"], context.previousEvents);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Date updated",
        description: "Event date has been updated",
      });
    },
  });

  const updateMemberRsvpMutation = useMutation({
    mutationFn: async ({ memberId, response }: { memberId: string; response: 'yes' | 'maybe' | 'no' }) => {
      // Find the RSVP for this member
      const rsvp = event?.detailedRsvps?.find((r: any) => r.memberId === memberId);

      if (rsvp?.rsvpId) {
        // Update existing RSVP
        return apiRequest("PATCH", `/api/rsvps/${rsvp.rsvpId}`, { response });
      } else {
        // Create new RSVP
        return apiRequest("POST", `/api/itineraries/${eventId}/rsvps`, {
          memberId,
          response,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "RSVP updated",
        description: "Member RSVP has been updated",
      });
    },
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      // Find the invite for this member
      const inviteToRemove = event?.members?.find((m: any) => m.id === memberId);
      if (!inviteToRemove || !inviteToRemove.inviteId) {
        throw new Error("Invite not found");
      }
      const response = await fetch(`/api/itinerary-invites/${inviteToRemove.inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete invite: ${response.status}`);
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Invite removed",
        description: "Member has been removed from this event",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateSchedulingPreferencesMutation = useMutation({
    mutationFn: async (preferences: string) => {
      if (!event?.groupId) throw new Error("Group ID not found");
      return apiRequest("PATCH", `/api/groups/${event.groupId}`, {
        schedulingPreferences: preferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Preferences saved",
        description: "AI will use these scheduling preferences for future events",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/itineraries/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Update itinerary name or note
  const updateItineraryMutation = useMutation({
    mutationFn: async (updates: { name?: string; note?: string }) => {
      return await apiRequest("PATCH", `/api/itineraries/${eventId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: [`/api/itineraries/${eventId}`] });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Add invitee to standalone event
  const addStandaloneInviteeMutation = useMutation({
    mutationFn: async (invitees: { memberId?: string; name?: string; email?: string }[]) => {
      return apiRequest("POST", `/api/standalone-events/${eventId}/invitees`, { invitees });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "Invitee added",
        description: "The person has been added to this event",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Remove invitee from standalone event
  const removeStandaloneInviteeMutation = useMutation({
    mutationFn: async (inviteeId: string) => {
      const response = await fetch(`/api/standalone-events/${eventId}/invitees/${inviteeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to remove invitee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", eventId] });
      toast({
        title: "Invitee removed",
        description: "The person has been removed from this event",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
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

  const handleDragEnd = (dragEvent: DragEndEvent) => {
    const { active, over } = dragEvent;

    if (!event || !over || active.id === over.id) return;

    const oldIndex = event.items.findIndex((item: any) => item.id === active.id);
    const newIndex = event.items.findIndex((item: any) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate the new order and send to server
    // The optimistic update will be handled by the mutation's onMutate
    // Use item.id instead of sourceId because ad-hoc items have null sourceId
    const newItems = arrayMove(event.items, oldIndex, newIndex);
    const proposedOrder = newItems.map((item: any) => item.id);
    reorderVenuesMutation.mutate(proposedOrder);
  };

  // Compute RSVP summary for the summary strip - must be before early returns
  const rsvpSummary = useMemo(() => {
    if (!event) return { yes: 0, maybe: 0, pending: 0 };

    const members = event.members || [];
    const rsvps = itineraryDetails?.rsvps || [];

    let yes = 0, maybe = 0, pending = 0;

    members.forEach((member: any) => {
      const rsvp = rsvps.find((r: any) => r.memberId === member.id);
      const response = rsvp?.response || 'pending';
      if (response === 'yes') yes++;
      else if (response === 'maybe') maybe++;
      else pending++;
    });

    // Also count the organizer's RSVP if they have one
    if (event.rsvp?.response === 'yes') yes++;
    else if (event.rsvp?.response === 'maybe') maybe++;

    return { yes, maybe, pending };
  }, [event, itineraryDetails?.rsvps]);

  // Show loading state while either query is loading
  if (isLoading || (fallbackLoading && !eventFromList)) {
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
    if (rsvp.name) return rsvp.name;
    if (rsvp.memberName) return rsvp.memberName;
    if (rsvp.firstName && rsvp.lastName) return `${rsvp.firstName} ${rsvp.lastName}`;
    if (rsvp.firstName) return rsvp.firstName;
    return rsvp.email || 'Anonymous';
  };

  // Current user's RSVP for mobile view
  const currentUserRsvp = rsvpResponse as 'yes' | 'maybe' | 'no' | 'pending' | undefined;

  // Share event functionality
  const handleShare = async () => {
    const link = `${window.location.origin}/event/${event.itineraryId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.itineraryName,
          text: `Check out this event: ${event.itineraryName}`,
          url: link,
        });
      } catch (err) {
        // User cancelled or share failed, copy to clipboard instead
        navigator.clipboard.writeText(link);
        toast({
          title: "Link copied!",
          description: "Share this link with others",
        });
      }
    } else {
      navigator.clipboard.writeText(link);
      toast({
        title: "Link copied!",
        description: "Share this link with others",
      });
    }
  };

  // Mobile view - render MobileEventDetails component
  if (isMobile) {
    return (
      <>
        <MobileEventDetails
          event={{
            itineraryId: event.itineraryId,
            itineraryName: event.itineraryName,
            eventDate: event.eventDate,
            eventEndTime: event.eventEndTime,
            groupId: event.groupId,
            groupName: event.groupName || null,
            groupEmoji: event.groupEmoji,
            groupTimezone: event.groupTimezone,
            groupAccentColor: event.groupAccentColor,
            items: event.items || [],
            members: event.members || [],
            detailedRsvps: itineraryDetails?.rsvps || event.detailedRsvps || [],
            inviteSentAt: event.inviteSentAt,
            inviteToken: event.inviteToken,
            isOrganizer: event.isOrganizer,
            rsvp: event.rsvp,
            organizerRsvp: event.organizerRsvp,
            hostMemberId: event.hostMemberId,
            note: event.note,
            quorumThreshold: event.quorumThreshold,
            rsvpDeadline: event.rsvpDeadline,
            isStandalone: event.isStandalone || false,
            invitees: event.invitees || itineraryDetails?.invitees || [],
          }}
          itineraryDetails={itineraryDetails}
          user={user}
          isOrganizer={isOrganizer}
          currentUserRsvp={currentUserRsvp}
          onChangeMyRsvp={(response) => {
            if (isOrganizer) {
              organizerRsvpMutation.mutate(response as 'yes' | 'maybe' | 'no');
            } else if (event.currentUserMemberId) {
              updateMemberRsvpMutation.mutate({
                memberId: event.currentUserMemberId,
                response: response as 'yes' | 'maybe' | 'no'
              });
            } else {
              toast({
                title: "Unable to RSVP",
                description: "Could not find your member profile",
                variant: "destructive",
              });
            }
          }}
          onSendToGroup={() => sendToGroupMutation.mutate()}
          onShare={handleShare}
          onEditDate={() => {
            // Open mobile date picker
            setMobileDatePickerDate(event.eventDate ? new Date(event.eventDate) : new Date());
            setShowMobileDatePicker(true);
          }}
          onAddVenue={() => setShowAddVenueDialog(true)}
          onEditVenue={(venue) => {
            setVenueToEdit(venue);
            setShowEditVenueDialog(true);
          }}
          onRemoveVenue={async (venue) => {
            if (confirm(`Remove "${venue.venueName}" from itinerary?`)) {
              try {
                const response = await fetch(`/api/itinerary-items/${venue.id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (!response.ok) throw new Error("Failed to delete");
                queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
                toast({ title: "Removed", description: `${venue.venueName} has been removed` });
              } catch {
                toast({ title: "Error", description: "Failed to remove venue", variant: "destructive" });
              }
            }
          }}
          onMoveVenue={async (fromIndex, toIndex) => {
            // Get current items and reorder
            const items = event.items || [];
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;

            const newItems = [...items];
            const [moved] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, moved);
            const newOrder = newItems.map((item: any) => item.id);

            try {
              const response = await fetch(`/api/itineraries/${event.itineraryId}/order`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIds: newOrder }),
              });
              if (!response.ok) throw new Error("Failed to reorder");
              queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
            } catch {
              toast({ title: "Error", description: "Failed to reorder venues", variant: "destructive" });
            }
          }}
          guestInvites={guestInvites}
          onAddGuest={(name) => addGuestMutation.mutate(name)}
          onUpdateGuest={(guestId, guestName) => updateGuestMutation.mutate({ guestId, guestName })}
          onDeleteGuest={(guestId) => deleteGuestMutation.mutate(guestId)}
          onInviteGuest={() => {
            if (event.isStandalone) {
              // Open add invitee dialog for standalone events
              setShowAddInviteeDialog(true);
            } else {
              // Copy link for group events
              copyInviteLink();
            }
          }}
          onRemindAll={() => {
            toast({
              title: "Reminders sent",
              description: "All pending members have been reminded",
            });
          }}
          onMakeHost={(attendee) => {
            if (attendee.memberId) {
              handOffHostMutation.mutate(attendee.memberId);
            }
          }}
          onRemoveAttendee={(attendee) => {
            if (event.isStandalone) {
              // Remove invitee from standalone event
              if (confirm(`Remove "${attendee.name}" from this event?`)) {
                removeStandaloneInviteeMutation.mutate(attendee.id);
              }
            } else if (attendee.memberId) {
              // For group events, use the existing remove invite mutation
              removeInviteMutation.mutate(attendee.memberId);
            }
          }}
          onDeleteEvent={() => setShowDeleteConfirm(true)}
          onDuplicateEvent={() => {
            toast({
              title: "Coming soon",
              description: "Duplicate event feature is coming soon",
            });
          }}
          onUpdateName={(name) => updateItineraryMutation.mutate({ name })}
          onUpdateNote={(note) => updateItineraryMutation.mutate({ note })}
          onVolunteerToHost={() => volunteerToHostMutation.mutate()}
          canVolunteerToHost={canVolunteerToHost}
          onBack={() => setLocation(event.groupId ? `/group/${event.groupId}` : '/')}
          isSending={sendToGroupMutation.isPending || sendStandaloneInvitesMutation.isPending}
          onSendInvites={() => sendStandaloneInvitesMutation.mutate()}
        />

        {/* Dialogs for mobile */}
        <EditVenueDialog
          open={showAddVenueDialog}
          onOpenChange={setShowAddVenueDialog}
          venue={null}
          itineraryId={event.itineraryId}
          groupId={event.groupId || undefined}
          itineraryItems={event.items || []}
          mode="add"
        />

        {venueToEdit && (
          <EditVenueDialog
            open={showEditVenueDialog}
            onOpenChange={(open) => {
              setShowEditVenueDialog(open);
              if (!open) {
                queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
                setVenueToEdit(null);
              }
            }}
            venue={venueToEdit}
            itineraryId={event.itineraryId}
            groupId={event.groupId}
            itineraryItems={event.items || []}
          />
        )}

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this event.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteEventMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Mobile Date Picker Drawer */}
        <Drawer open={showMobileDatePicker} onOpenChange={setShowMobileDatePicker}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit Date & Time</DrawerTitle>
              <DrawerDescription>
                Choose when this event will take place
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              {/* Calendar */}
              <div className="flex justify-center mb-4">
                <DatePicker
                  mode="single"
                  selected={mobileDatePickerDate || undefined}
                  onSelect={(date) => {
                    if (date) {
                      // Preserve the time from the current selection
                      const currentTime = mobileDatePickerDate || new Date();
                      date.setHours(currentTime.getHours());
                      date.setMinutes(currentTime.getMinutes());
                      setMobileDatePickerDate(date);
                    }
                  }}
                  className="rounded-md border"
                />
              </div>

              {/* Time Picker */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Time</Label>
                <div className="flex items-center gap-2 justify-center">
                  <select
                    value={mobileDatePickerDate ? (mobileDatePickerDate.getHours() % 12 || 12).toString() : "12"}
                    onChange={(e) => {
                      if (mobileDatePickerDate) {
                        const newDate = new Date(mobileDatePickerDate);
                        const currentHour = newDate.getHours();
                        const isPM = currentHour >= 12;
                        let hour = parseInt(e.target.value);
                        if (isPM && hour !== 12) hour += 12;
                        if (!isPM && hour === 12) hour = 0;
                        newDate.setHours(hour);
                        setMobileDatePickerDate(newDate);
                      }
                    }}
                    className="px-3 py-2 border rounded-md text-base bg-background"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h.toString()}>{h}</option>
                    ))}
                  </select>
                  <span className="text-lg font-medium">:</span>
                  <select
                    value={mobileDatePickerDate ? (() => {
                      const minutes = mobileDatePickerDate.getMinutes();
                      const rounded = Math.round(minutes / 15) * 15;
                      return (rounded === 60 ? 0 : rounded).toString().padStart(2, '0');
                    })() : "00"}
                    onChange={(e) => {
                      if (mobileDatePickerDate) {
                        const newDate = new Date(mobileDatePickerDate);
                        newDate.setMinutes(parseInt(e.target.value));
                        setMobileDatePickerDate(newDate);
                      }
                    }}
                    className="px-3 py-2 border rounded-md text-base bg-background"
                  >
                    {["00", "15", "30", "45"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={mobileDatePickerDate ? (mobileDatePickerDate.getHours() >= 12 ? "PM" : "AM") : "PM"}
                    onChange={(e) => {
                      if (mobileDatePickerDate) {
                        const newDate = new Date(mobileDatePickerDate);
                        const currentHour = newDate.getHours();
                        if (e.target.value === "AM" && currentHour >= 12) {
                          newDate.setHours(currentHour - 12);
                        } else if (e.target.value === "PM" && currentHour < 12) {
                          newDate.setHours(currentHour + 12);
                        }
                        setMobileDatePickerDate(newDate);
                      }
                    }}
                    className="px-3 py-2 border rounded-md text-base bg-background"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <Button
                onClick={() => {
                  if (mobileDatePickerDate) {
                    updateEventDateMutation.mutate(mobileDatePickerDate);
                    setShowMobileDatePicker(false);
                  }
                }}
                disabled={!mobileDatePickerDate || updateEventDateMutation.isPending}
              >
                {updateEventDateMutation.isPending ? "Saving..." : "Save Date & Time"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Add Invitee Drawer for Standalone Events */}
        <Drawer open={showAddInviteeDialog} onOpenChange={setShowAddInviteeDialog}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Add Guest</DrawerTitle>
              <DrawerDescription>
                Add someone to this event
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitee-name">Name</Label>
                <Input
                  id="invitee-name"
                  placeholder="Enter guest name"
                  value={newInviteeName}
                  onChange={(e) => setNewInviteeName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DrawerFooter>
              <Button
                onClick={() => {
                  if (newInviteeName.trim()) {
                    addStandaloneInviteeMutation.mutate([{ name: newInviteeName.trim() }]);
                    setNewInviteeName("");
                    setShowAddInviteeDialog(false);
                  }
                }}
                disabled={!newInviteeName.trim() || addStandaloneInviteeMutation.isPending}
              >
                {addStandaloneInviteeMutation.isPending ? "Adding..." : "Add Guest"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" onClick={() => setNewInviteeName("")}>Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop view
  return (
    <>
      <DesktopEventDetails
        event={event}
        itineraryDetails={itineraryDetails}
        user={user}
        isOrganizer={isOrganizer}
        rsvpResponse={rsvpResponse as 'yes' | 'maybe' | 'pending' | 'no' | undefined}
        guestInvites={guestInvites}
        isLoadingGuests={isLoadingGuests}
        onOrganizerRsvp={(response) => organizerRsvpMutation.mutate(response)}
        onUpdateMemberRsvp={(memberId, response) => updateMemberRsvpMutation.mutate({ memberId, response })}
        onUpdateEventDate={(date) => updateEventDateMutation.mutate(date)}
        onCopyInviteLink={copyInviteLink}
        onCopyGuestLink={copyGuestLink}
        onAddGuest={(name) => addGuestMutation.mutate(name)}
        onUpdateGuest={(guestId, guestName) => updateGuestMutation.mutate({ guestId, guestName })}
        onDeleteGuest={(guestId) => deleteGuestMutation.mutate(guestId)}
        onRemoveInvite={(memberId) => removeInviteMutation.mutate(memberId)}
        onVolunteerToHost={() => volunteerToHostMutation.mutate()}
        onHandOffHost={(memberId) => handOffHostMutation.mutate(memberId)}
        onSendToGroup={() => sendToGroupMutation.mutate()}
        onDeleteEvent={() => setShowDeleteConfirm(true)}
        onAddVenue={() => setShowAddVenueDialog(true)}
        onEditVenue={(venue) => {
          setVenueToEdit(venue);
          setShowEditVenueDialog(true);
        }}
        onDeleteVenue={async (venue) => {
          if (confirm(`Remove "${venue.venueName}" from itinerary?`)) {
            try {
              const response = await fetch(`/api/itinerary-items/${venue.id}`, {
                method: "DELETE",
                credentials: "include",
              });
              if (!response.ok) throw new Error("Failed to delete");
              queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
              toast({ title: "Removed", description: `${venue.venueName} has been removed` });
            } catch {
              toast({ title: "Error", description: "Failed to remove venue", variant: "destructive" });
            }
          }
        }}
        onReorderVenues={(newOrder) => reorderVenuesMutation.mutate(newOrder)}
        onUpdateName={(name) => updateItineraryMutation.mutate({ name })}
        onUpdateNote={(note) => updateItineraryMutation.mutate({ note })}
        onDuplicateEvent={() => {
          toast({
            title: "Coming soon",
            description: "Duplicate event feature is coming soon",
          });
        }}
        onRemindAll={() => {
          toast({
            title: "Reminders sent",
            description: "All pending members have been reminded",
          });
        }}
        isPending={{
          organizerRsvp: organizerRsvpMutation.isPending,
          updateMemberRsvp: updateMemberRsvpMutation.isPending,
          updateEventDate: updateEventDateMutation.isPending,
          addGuest: addGuestMutation.isPending,
          updateGuest: updateGuestMutation.isPending,
          deleteGuest: deleteGuestMutation.isPending,
          volunteerToHost: volunteerToHostMutation.isPending,
          handOffHost: handOffHostMutation.isPending,
          sendToGroup: sendToGroupMutation.isPending,
          deleteEvent: deleteEventMutation.isPending,
        }}
        canVolunteerToHost={canVolunteerToHost}
        isCurrentHost={isCurrentHost}
        hostableMembers={hostableMembers}
      />

      {/* Dialogs stay here since they need the mutations */}

      {/* Add Venue Dialog */}
      {event?.itineraryId && (
        <EditVenueDialog
          open={showAddVenueDialog}
          onOpenChange={setShowAddVenueDialog}
          venue={null}
          itineraryId={event.itineraryId}
          groupId={event.groupId || undefined}
          itineraryItems={event.items || []}
          mode="add"
        />
      )}

      {/* Edit Venue Dialog */}
      {event?.itineraryId && (
        <EditVenueDialog
          open={showEditVenueDialog}
          onOpenChange={setShowEditVenueDialog}
          venue={venueToEdit}
          itineraryId={event.itineraryId}
          groupId={event.groupId}
          itineraryItems={event.items || []}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
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
                deleteEventMutation.mutate();
              }}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
