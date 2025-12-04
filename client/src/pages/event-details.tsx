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
import { AddAdHocVenueDialog } from "@/components/AddAdHocVenueDialog";
import { EditVenueDialog } from "@/components/EditVenueDialog";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventSummaryStrip } from "@/components/EventSummaryStrip";
import { MobileEventDetails } from "@/components/event-detail";
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
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to remove venue",
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

  // Fallback: If event not found in user events (e.g., proposed itinerary without invites),
  // fetch directly from itinerary endpoint
  const { data: fallbackItinerary } = useQuery<any>({
    queryKey: ["/api/itineraries/:id", eventId],
    enabled: !!eventId && !eventFromList && !isLoading,
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${eventId}`);
      if (!response.ok) return null;
      const itinerary = await response.json();

      if (itinerary) {
        // Transform itinerary to match event structure
        return {
          itineraryId: itinerary.id,
          itineraryName: itinerary.name,
          eventDate: itinerary.eventDate,
          groupId: itinerary.groupId,
          groupName: itinerary.group?.name,
          groupEmoji: itinerary.group?.emoji,
          groupTimezone: itinerary.group?.timezone,
          groupAccentColor: itinerary.group?.accentColor,
          items: itinerary.items || [],
          isOrganizer: true, // Assume organizer for proposed itineraries
          members: itinerary.members || [], // Use members from API response
          rsvp: itinerary.rsvp || null, // Include organizer's RSVP
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

  const reorderVenuesMutation = useMutation({
    mutationFn: async (proposedOrder: string[]) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}/order`, {
        proposedOrder,
      });
    },
    onMutate: async (proposedOrder) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/user/events", eventId] });

      // Snapshot the previous value
      const previousEvent = queryClient.getQueryData(["/api/user/events", eventId]);

      // Optimistically update to the new value
      if (previousEvent) {
        const currentEvent = previousEvent as any;
        const sourceIdToItem = new Map(currentEvent.items.map((item: any) => [item.sourceId, item]));
        const newItems = proposedOrder.map(sourceId => sourceIdToItem.get(sourceId)).filter(Boolean);

        queryClient.setQueryData(["/api/user/events", eventId], {
          ...currentEvent,
          items: newItems,
        });
      }

      // Return context with the snapshot
      return { previousEvent };
    },
    onError: (err, proposedOrder, context) => {
      // Rollback to the previous value on error
      if (context?.previousEvent) {
        queryClient.setQueryData(["/api/user/events", eventId], context.previousEvent);
      }
      toast(getErrorToast(err));
    },
    onSuccess: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/user/events", eventId] });

      // Snapshot previous value
      const previousEvent = queryClient.getQueryData(["/api/user/events", eventId]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/user/events", eventId], (old: any) => {
        if (!old) return old;
        return { ...old, eventDate: newDate.toISOString() };
      });

      return { previousEvent };
    },
    onError: (err, newDate, context: any) => {
      // Rollback on error
      if (context?.previousEvent) {
        queryClient.setQueryData(["/api/user/events", eventId], context.previousEvent);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
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
    const newItems = arrayMove(event.items, oldIndex, newIndex);
    const proposedOrder = newItems.map((item: any) => item.sourceId);
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
            groupName: event.groupName,
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
          onInviteGuest={() => {
            // Open guest invite - for now copy link
            copyInviteLink();
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
          onDeleteEvent={() => setShowDeleteConfirm(true)}
          onDuplicateEvent={() => {
            toast({
              title: "Coming soon",
              description: "Duplicate event feature is coming soon",
            });
          }}
          onUpdateName={(name) => updateItineraryMutation.mutate({ name })}
          onUpdateNote={(note) => updateItineraryMutation.mutate({ note })}
          onBack={() => setLocation(event.groupId ? `/group/${event.groupId}` : '/')}
          isSending={sendToGroupMutation.isPending}
        />

        {/* Dialogs for mobile */}
        <AddAdHocVenueDialog
          open={showAddVenueDialog}
          onOpenChange={setShowAddVenueDialog}
          itineraryId={event.itineraryId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
          }}
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
      </>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className={cn(
        "max-w-4xl mx-auto px-4 py-4 sm:p-6 space-y-4 sm:space-y-6",
        isMobile && event.status !== 'draft' && event.inviteSentAt && "pb-24"
      )}>
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={event.groupId ? [
            { label: event.groupName || "Group", href: `/group/${event.groupId}` },
            { label: event.itineraryName || "Event" }
          ] : [
            { label: "Dashboard", href: "/" },
            { label: event.itineraryName || "Event" }
          ]}
          className="mb-2"
        />

        {/* WHO / WHERE / WHEN Summary Strip */}
        <EventSummaryStrip
          groups={event.groupId ? [{
            id: event.groupId,
            name: event.groupName || "Group",
            emoji: event.groupEmoji || "👥",
            memberCount: event.members?.length,
          }] : [{
            id: "standalone",
            name: event.itineraryName || "Event",
            emoji: "📅",
            memberCount: itineraryDetails?.invitees?.length || 0,
          }]}
          venues={(event.items || []).map((item: any) => ({
            name: item.venueName || item.adHocVenue?.name || "Venue",
            type: item.venueType || "Venue",
          }))}
          eventDate={event.eventDate || null}
          timezone={event.groupTimezone}
          occasionNote={event.itineraryName}
          expandable={true}
          defaultExpanded={false}
          editable={isOrganizer}
          onAddVenue={() => setShowAddVenueDialog(true)}
          variant="full"
          rsvpSummary={rsvpSummary}
        />

        <Card data-testid="event-details-card">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl flex-shrink-0">{event.groupEmoji || "📅"}</span>
                  <span className="truncate">{event.itineraryName}</span>
                </CardTitle>
                {event.groupName && (
                  <CardDescription className="mt-1 sm:mt-2 text-sm sm:text-base">
                    {event.groupName}
                  </CardDescription>
                )}
                {event.eventDate && (
                  <div className="flex items-center gap-2 mt-2 sm:mt-3">
                    {isOrganizer ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              "justify-start text-left font-medium text-muted-foreground hover:text-foreground h-auto p-2",
                              !event.eventDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            <div className="flex flex-col">
                              <span>
                                {event.groupTimezone
                                  ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "EEEE, MMMM d, yyyy • h:mm a")
                                  : format(new Date(event.eventDate), "EEEE, MMMM d, yyyy • h:mm a")}
                              </span>
                              {event.groupTimezone && (
                                <span className="text-2xs text-muted-foreground/70">
                                  {formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "zzz")}
                                </span>
                              )}
                            </div>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2">
                            <DatePicker
                              mode="single"
                              selected={event.eventDate ? new Date(event.eventDate) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  // Preserve the time from the original date
                                  const originalDate = new Date(event.eventDate);
                                  date.setHours(originalDate.getHours());
                                  date.setMinutes(originalDate.getMinutes());
                                  updateEventDateMutation.mutate(date);
                                }
                              }}
                              initialFocus
                              className="text-sm"
                            />
                          </div>
                          <div className="px-3 py-2 border-t">
                            <div className="text-sm font-medium mb-2">Time</div>
                            <div className="flex items-center gap-2">
                              <select
                                value={event.eventDate ? (new Date(event.eventDate).getHours() % 12 || 12).toString() : ""}
                                onChange={(e) => {
                                  const newDate = new Date(event.eventDate);
                                  const currentHour = newDate.getHours();
                                  const isPM = currentHour >= 12;
                                  let hour = parseInt(e.target.value);
                                  if (isPM && hour !== 12) hour += 12;
                                  if (!isPM && hour === 12) hour = 0;
                                  newDate.setHours(hour);
                                  updateEventDateMutation.mutate(newDate);
                                }}
                                className="px-2 py-1.5 border rounded-md text-sm"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                  <option key={h} value={h.toString()}>{h}</option>
                                ))}
                              </select>
                              <span className="text-sm">:</span>
                              <select
                                value={event.eventDate ? (() => {
                                  const minutes = new Date(event.eventDate).getMinutes();
                                  const rounded = Math.round(minutes / 15) * 15;
                                  return (rounded === 60 ? 0 : rounded).toString().padStart(2, '0');
                                })() : ""}
                                onChange={(e) => {
                                  const newDate = new Date(event.eventDate);
                                  newDate.setMinutes(parseInt(e.target.value));
                                  updateEventDateMutation.mutate(newDate);
                                }}
                                className="px-2 py-1.5 border rounded-md text-sm"
                              >
                                {["00", "15", "30", "45"].map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <select
                                value={event.eventDate ? (new Date(event.eventDate).getHours() >= 12 ? "PM" : "AM") : ""}
                                onChange={(e) => {
                                  const newDate = new Date(event.eventDate);
                                  const currentHour = newDate.getHours();
                                  if (e.target.value === "AM" && currentHour >= 12) {
                                    newDate.setHours(currentHour - 12);
                                  } else if (e.target.value === "PM" && currentHour < 12) {
                                    newDate.setHours(currentHour + 12);
                                  }
                                  updateEventDateMutation.mutate(newDate);
                                }}
                                className="px-2 py-1.5 border rounded-md text-sm"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {event.groupTimezone
                              ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "EEEE, MMMM d, yyyy • h:mm a")
                              : format(new Date(event.eventDate), "EEEE, MMMM d, yyyy • h:mm a")}
                          </span>
                          {event.groupTimezone && (
                            <span className="text-2xs text-muted-foreground/70">
                              {formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "zzz")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Scheduling Preferences (organizer only, hidden on mobile, not for standalone events) */}
                {isOrganizer && event.groupId && (
                  <div className="hidden sm:flex items-center gap-2 mt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Clock className="h-4 w-4" />
                          Scheduling Preferences
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96" align="start">
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="scheduling-preferences" className="text-sm font-semibold">
                              AI Scheduling Instructions
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Tell the AI when to schedule events for {event.groupName}
                            </p>
                          </div>
                          <Textarea
                            id="scheduling-preferences"
                            placeholder="e.g., 'Always start dinner at 6pm' or 'This group can only meet at 7:30pm'"
                            value={schedulingPreferences}
                            onChange={(e) => setSchedulingPreferences(e.target.value)}
                            className="min-h-[100px] resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                updateSchedulingPreferencesMutation.mutate(schedulingPreferences);
                              }}
                              disabled={updateSchedulingPreferencesMutation.isPending}
                            >
                              {updateSchedulingPreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
                            </Button>
                            {event.groupSchedulingPreferences && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSchedulingPreferences(event.groupSchedulingPreferences || "")}
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 sm:gap-2 flex-wrap items-center">
                {/* Condensed badges - hide draft badge on mobile since we have prominent banner */}
                {isOrganizer && (
                  <Badge variant="default" className="gap-1 text-xs sm:text-sm">
                    <Sparkles className="h-3 w-3" />
                    <span className="hidden sm:inline">Organizer</span>
                  </Badge>
                )}
                {event.hostMemberId && event.hostMemberName && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="gap-1 text-xs sm:text-sm hidden sm:flex cursor-help">
                        <UserCheck className="h-3 w-3" />
                        <span>{isCurrentHost ? "You're hosting" : `Hosted by ${event.hostMemberName}`}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">The host sends out event details and coordinates the group. Any member who's "open to hosting" can volunteer.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {!event.hostMemberId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="gap-1 text-xs sm:text-sm hidden sm:flex cursor-help">
                        <Bot className="h-3 w-3" />
                        <span>AI-hosted</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">No one has volunteered to host yet. The AI will send event details automatically, or a member can still volunteer to take over.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Draft badge - desktop only, mobile has prominent banner */}
                {event.status === 'draft' && !event.inviteSentAt && (
                  <Badge variant="outline" className="gap-1 bg-orange-50 text-orange-700 border-orange-300 text-xs sm:text-sm hidden sm:flex">
                    📝 Draft - Not sent
                  </Badge>
                )}
                {/* Desktop-only Send to Group button - mobile uses banner */}
                {isOrganizer && event.status === 'draft' && !event.inviteSentAt && event.eventDate && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => sendToGroupMutation.mutate()}
                    disabled={sendToGroupMutation.isPending}
                    className="gap-1 h-8 text-sm hidden sm:flex"
                  >
                    <Send className="h-4 w-4" />
                    {sendToGroupMutation.isPending ? 'Sending...' : 'Send to Group'}
                  </Button>
                )}
                {isOrganizer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Prominent Draft Banner - Mobile-first, full width */}
          {isOrganizer && event.status === 'draft' && !event.inviteSentAt && (
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 sm:py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <Send className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">Ready to invite your group?</p>
                    <p className="text-xs sm:text-sm text-white/80 hidden sm:block">Send invites so members can RSVP</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sendToGroupMutation.mutate()}
                  disabled={sendToGroupMutation.isPending || !event.eventDate}
                  className="bg-white hover:bg-gray-100 text-orange-700 font-semibold shrink-0"
                >
                  {sendToGroupMutation.isPending ? 'Sending...' : 'Send Invites'}
                </Button>
              </div>
              {!event.eventDate && (
                <p className="text-xs text-white/70 mt-2">Set a date first before sending invites</p>
              )}
            </div>
          )}

          <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Time Slot Selection for Proposed Itineraries - Collapsible */}
            {itineraryDetails?.status === 'proposed' && itineraryDetails?.proposedTimeSlots?.length > 0 && (
              <Collapsible open={isTimeSlotExpanded} onOpenChange={setIsTimeSlotExpanded}>
                <Card className="bg-amber-50 border-amber-200">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-amber-100/50 transition-colors p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                          <CardTitle className="text-sm sm:text-base">Choose Your Preferred Time</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                            {itineraryDetails.proposedTimeSlots.length} option{itineraryDetails.proposedTimeSlots.length > 1 ? 's' : ''}
                          </Badge>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isTimeSlotExpanded && "rotate-180"
                          )} />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 p-3 sm:p-4 space-y-3">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Select a time and click "Finalize" to confirm this event
                      </p>
                      <div className="space-y-2">
                        {itineraryDetails.proposedTimeSlots.map((slot: any) => (
                          <label
                            key={slot.id}
                            className={cn(
                              "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg cursor-pointer transition-colors text-sm",
                              selectedTimeSlotId === slot.id
                                ? "bg-amber-100 border-amber-400"
                                : "bg-white hover:bg-amber-50 border-gray-200"
                            )}
                          >
                            <input
                              type="radio"
                              name="timeSlot"
                              value={slot.id}
                              checked={selectedTimeSlotId === slot.id}
                              onChange={() => setSelectedTimeSlotId(slot.id)}
                              className="h-4 w-4 text-amber-600"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-xs sm:text-sm">
                                {formatDateTimeWithTimezone(
                                  slot.proposedDateTime,
                                  itineraryDetails.group?.timezone || 'America/Los_Angeles'
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <Button
                        onClick={() => {
                          if (!selectedTimeSlotId && itineraryDetails.proposedTimeSlots[0]) {
                            setSelectedTimeSlotId(itineraryDetails.proposedTimeSlots[0].id);
                          }
                          finalizeItineraryMutation.mutate(selectedTimeSlotId || itineraryDetails.proposedTimeSlots[0].id);
                        }}
                        disabled={finalizeItineraryMutation.isPending}
                        className="w-full bg-amber-600 hover:bg-amber-700 h-9 text-sm"
                      >
                        {finalizeItineraryMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Finalize & Send Invites
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Venues */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="font-semibold text-base sm:text-lg">Venues</h3>
                {isOrganizer && (
                  <div className="flex items-center gap-2">
                    {event.items && event.items.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateVenuesMutation.mutate()}
                        disabled={regenerateVenuesMutation.isPending}
                        className="gap-1.5 h-8 text-xs sm:text-sm"
                      >
                        {regenerateVenuesMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span className="hidden sm:inline">AI Selecting...</span>
                            <span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Regenerate</span>
                            <span className="sm:hidden">Regen</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddVenueDialog(true)}
                      className="gap-1.5 h-8 text-xs sm:text-sm"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Add Location</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>
                )}
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={event.items.map((item: any) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 group">
                    {event.items.map((venue: any, idx: number) => (
                      <SortableVenueCard
                        key={venue.id}
                        venue={venue}
                        idx={idx}
                        isOrganizer={isOrganizer}
                        toast={toast}
                        queryClient={queryClient}
                        onEdit={(venue) => {
                          setVenueToEdit(venue);
                          setShowEditVenueDialog(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Time Slot Voting */}
            {/* <TimeSlotVoting
              itineraryId={event.itineraryId}
              userId={user?.id}
              isOrganizer={isOrganizer}
            /> */}

            {/* Attendee List */}
            <Collapsible
              open={isMobile ? isAttendeesExpanded : true}
              onOpenChange={setIsAttendeesExpanded}
              className="space-y-3 sm:space-y-4"
            >
              {(() => {
                // Create a comprehensive attendee list with organizer, members, and guests
                const attendees: Array<{
                  id: string;
                  name: string;
                  initials: string;
                  response: 'yes' | 'maybe' | 'no' | 'pending';
                  isGuest: boolean;
                  isOrganizer?: boolean;
                  additionalAttendees?: number;
                  numberOfKids?: number;
                }> = [];

                // Add the organizer first (they're not in the members list)
                if (event.isOrganizer && user) {
                  const organizerName = user.displayName ||
                    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                    user.email || 'You';
                  const initials = organizerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                  attendees.push({
                    id: 'organizer',
                    name: `${organizerName} (You)`,
                    initials,
                    response: event.rsvp?.response || 'pending',
                    isGuest: false,
                    isOrganizer: true,
                  });
                }

                // Add all members - use event.members or fallback to itineraryDetails.members
                const members = (event.members?.length > 0 ? event.members : itineraryDetails?.members) || [];
                console.log('[EventDetails] members:', members, 'event.members:', event.members, 'itineraryDetails?.members:', itineraryDetails?.members);
                if (members.length > 0) {
                  members.forEach((member: any) => {
                    // Find this member's RSVP from detailedRsvps
                    const rsvp = event.detailedRsvps?.find((r: any) =>
                      r.memberId === member.id ||
                      r.name === (member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim())
                    );
                    const memberResponse = rsvp?.response || 'pending';

                    const name = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                    attendees.push({
                      id: member.id,
                      name,
                      initials,
                      response: memberResponse,
                      isGuest: false,
                      additionalAttendees: rsvp?.additionalAttendees?.length || 0,
                      numberOfKids: rsvp?.numberOfKids || 0,
                    });
                  });
                }

                // Add guests
                if (guestInvites && guestInvites.length > 0) {
                  guestInvites.forEach((guest: any) => {
                    const initials = guest.guestName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    attendees.push({
                      id: guest.id,
                      name: guest.guestName,
                      initials,
                      response: guest.rsvpStatus || 'pending',
                      isGuest: true,
                    });
                  });
                }

                // Sort: Going first, then Maybe, then Pending, then No
                const order = { yes: 1, maybe: 2, pending: 3, no: 4 };
                attendees.sort((a, b) => order[a.response] - order[b.response]);

                const goingCount = attendees.filter(a => a.response === 'yes').length;
                const maybeCount = attendees.filter(a => a.response === 'maybe').length;
                const noCount = attendees.filter(a => a.response === 'no').length;
                const pendingCount = attendees.filter(a => a.response === 'pending').length;
                const previewAttendees = attendees.slice(0, 4);

                return (
                  <>
                    {/* Collapsible Header - clickable on mobile */}
                    <CollapsibleTrigger asChild className="sm:pointer-events-none">
                      <div className="flex items-center justify-between cursor-pointer sm:cursor-default">
                        <h3 className="font-semibold text-base sm:text-lg">Who's Coming</h3>
                        <div className="flex items-center gap-2">
                          {/* Summary Stats - compact on mobile when collapsed */}
                          <div className="flex gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm">
                            <span className="font-medium text-green-600">{goingCount} going</span>
                            {maybeCount > 0 && <span className="font-medium text-yellow-600">{maybeCount} maybe</span>}
                            {pendingCount > 0 && <span className="font-medium text-muted-foreground">{pendingCount} pending</span>}
                          </div>
                          <ChevronRight className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform sm:hidden",
                            isAttendeesExpanded && "rotate-90"
                          )} />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Avatar Stack Preview - Mobile only, when collapsed */}
                    {isMobile && !isAttendeesExpanded && (
                      <div className="flex items-center gap-1 -mt-1">
                        <div className="flex -space-x-2">
                          {previewAttendees.map((attendee) => (
                            <div
                              key={attendee.id}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-background",
                                attendee.response === 'yes' && 'bg-green-100 text-green-700',
                                attendee.response === 'maybe' && 'bg-yellow-100 text-yellow-700',
                                attendee.response === 'no' && 'bg-red-100 text-red-700',
                                attendee.response === 'pending' && 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {attendee.initials}
                            </div>
                          ))}
                          {attendees.length > 4 && (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-muted text-muted-foreground border-2 border-background">
                              +{attendees.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground ml-2">Tap to expand</span>
                      </div>
                    )}

                    {/* Attendee Grid - collapsible on mobile */}
                    <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {attendees.map((attendee) => (
                        <div
                          key={attendee.id}
                          className="group relative flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          {/* Avatar */}
                          <div className={`
                            w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0
                            ${attendee.response === 'yes' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                            ${attendee.response === 'maybe' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                            ${attendee.response === 'no' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : ''}
                            ${attendee.response === 'pending' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : ''}
                          `}>
                            {attendee.initials}
                          </div>

                          {/* Name and Status */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs sm:text-sm truncate flex items-center gap-1">
                              {attendee.name}
                              {attendee.isOrganizer && (
                                <Badge variant="default" className="text-2xs sm:text-xs py-0 h-3.5 sm:h-4 bg-primary">Organizer</Badge>
                              )}
                              {attendee.isGuest && (
                                <Badge variant="outline" className="text-2xs sm:text-xs py-0 h-3.5 sm:h-4">Guest</Badge>
                              )}
                            </div>

                            {/* RSVP Controls for Organizer to change member RSVPs (not for organizer's own entry) */}
                            {isOrganizer && !attendee.isGuest && !attendee.isOrganizer ? (
                              <div className="flex items-center gap-0.5 mt-1">
                                <Button
                                  variant={attendee.response === 'yes' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'yes' })}
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                </Button>
                                <Button
                                  variant={attendee.response === 'maybe' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'maybe' })}
                                >
                                  <HelpCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                </Button>
                                <Button
                                  variant={attendee.response === 'no' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'no' })}
                                >
                                  <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 mt-0.5 text-2xs sm:text-xs">
                                {attendee.response === 'yes' && (
                                  <>
                                    <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" />
                                    <span className="text-green-600 dark:text-green-400">Going</span>
                                  </>
                                )}
                                {attendee.response === 'maybe' && (
                                  <>
                                    <HelpCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-600" />
                                    <span className="text-yellow-600 dark:text-yellow-400">Maybe</span>
                                  </>
                                )}
                                {attendee.response === 'no' && (
                                  <>
                                    <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-600" />
                                    <span className="text-red-600 dark:text-red-400 hidden sm:inline">Can't Make It</span>
                                    <span className="text-red-600 dark:text-red-400 sm:hidden">No</span>
                                  </>
                                )}
                                {attendee.response === 'pending' && (
                                  <>
                                    <MinusCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-500" />
                                    <span className="text-muted-foreground">Invited</span>
                                  </>
                                )}
                                {(attendee.additionalAttendees || 0) > 0 && (
                                  <span className="text-muted-foreground">+{attendee.additionalAttendees}</span>
                                )}
                                {(attendee.numberOfKids || 0) > 0 && (
                                  <span className="text-muted-foreground hidden sm:inline">({attendee.numberOfKids} kids)</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Remove Button for Organizer */}
                          {isOrganizer && !attendee.isGuest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (confirm(`Remove ${attendee.name} from this event?`)) {
                                  removeInviteMutation.mutate(attendee.id);
                                }
                              }}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    </CollapsibleContent>
                  </>
                );
              })()}
            </Collapsible>

            {/* Actions */}
            <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
              {/* Your Response - hidden on mobile when floating bar is shown (sent events) */}
              {isOrganizer && (
                <div className={cn(
                  isMobile && event.status !== 'draft' && event.inviteSentAt && "hidden"
                )}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <h3 className="font-semibold text-xs sm:text-sm">Your Response</h3>
                    {rsvpResponse && (
                      <Badge
                        variant={rsvpResponse === 'yes' ? 'default' : rsvpResponse === 'maybe' ? 'secondary' : 'outline'}
                        className={cn(
                          "text-2xs sm:text-xs",
                          rsvpResponse === 'yes' && "bg-green-600",
                          rsvpResponse === 'maybe' && "bg-yellow-500 text-yellow-950",
                          rsvpResponse === 'no' && "bg-red-100 text-red-700 border-red-300"
                        )}
                      >
                        {rsvpResponse === 'yes' && 'Going'}
                        {rsvpResponse === 'maybe' && 'Maybe'}
                        {rsvpResponse === 'no' && "Can't Make It"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <Button
                      variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('yes')}
                      disabled={organizerRsvpMutation.isPending}
                      className={cn(
                        "gap-1 h-8 text-xs sm:text-sm",
                        rsvpResponse === 'yes' && "bg-green-600 hover:bg-green-700"
                      )}
                      data-testid="button-organizer-yes"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Going
                    </Button>
                    <Button
                      variant={rsvpResponse === 'maybe' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('maybe')}
                      disabled={organizerRsvpMutation.isPending}
                      className={cn(
                        "gap-1 h-8 text-xs sm:text-sm",
                        rsvpResponse === 'maybe' && "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                      )}
                      data-testid="button-organizer-maybe"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Maybe
                    </Button>
                    <Button
                      variant={rsvpResponse === 'no' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => organizerRsvpMutation.mutate('no')}
                      disabled={organizerRsvpMutation.isPending}
                      className={cn(
                        "gap-1 h-8 text-xs sm:text-sm",
                        rsvpResponse === 'no' && "bg-red-600 hover:bg-red-700"
                      )}
                      data-testid="button-organizer-no"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Can't Make It</span>
                      <span className="sm:hidden">No</span>
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">Share & Manage</h3>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInviteLink}
                    className="gap-1.5 h-8 text-xs sm:text-sm"
                    data-testid="button-copy-link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copy Invite Link</span>
                    <span className="sm:hidden">Copy Link</span>
                  </Button>

                  {canVolunteerToHost && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => volunteerToHostMutation.mutate()}
                      disabled={volunteerToHostMutation.isPending}
                      className="gap-1.5 h-8 text-xs sm:text-sm"
                      data-testid="button-volunteer-host"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Volunteer to Host</span>
                      <span className="sm:hidden">Host</span>
                    </Button>
                  )}

                  {isCurrentHost && hostableMembers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8 text-xs sm:text-sm"
                          data-testid="button-hand-off"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Hand Off Host</span>
                          <span className="sm:hidden">Transfer</span>
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

                </div>
              </div>

              {/* Guest Invites Section */}
              {isOrganizer && (
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">
                    Guests ({guestInvites.length})
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
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
                        className="flex-1 h-8 sm:h-9 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddGuest}
                        disabled={!guestName.trim() || addGuestMutation.isPending}
                        className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
                        data-testid="button-add-guest"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Add Guest</span>
                        <span className="sm:hidden">Add</span>
                      </Button>
                    </div>

                    {isLoadingGuests ? (
                      <div className="text-xs sm:text-sm text-muted-foreground">Loading guests...</div>
                    ) : guestInvites.length > 0 ? (
                      <div className="space-y-1.5 sm:space-y-2">
                        {guestInvites.map((guest: any) => (
                          <Card key={guest.id} className="p-2 sm:p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                <span className="font-medium text-xs sm:text-sm truncate">{guest.guestName}</span>
                                {guest.rsvpStatus && (
                                  <Badge
                                    variant={
                                      guest.rsvpStatus === "yes"
                                        ? "default"
                                        : guest.rsvpStatus === "maybe"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="gap-0.5 text-2xs sm:text-xs flex-shrink-0"
                                  >
                                    {guest.rsvpStatus === "yes" && (
                                      <CheckCircle className="h-2.5 w-2.5" />
                                    )}
                                    {guest.rsvpStatus === "maybe" && (
                                      <HelpCircle className="h-2.5 w-2.5" />
                                    )}
                                    {guest.rsvpStatus === "no" && (
                                      <XCircle className="h-2.5 w-2.5" />
                                    )}
                                    <span className="hidden sm:inline">
                                      {guest.rsvpStatus === "yes" && "Yes"}
                                      {guest.rsvpStatus === "maybe" && "Maybe"}
                                      {guest.rsvpStatus === "no" && "No"}
                                    </span>
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyGuestLink(guest.guestToken, guest.guestName)}
                                className="gap-1 h-7 text-xs flex-shrink-0"
                                data-testid={`button-copy-guest-link-${guest.id}`}
                              >
                                <Copy className="h-3 w-3" />
                                <span className="hidden sm:inline">Copy Link</span>
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">
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

      {/* Add Ad-hoc Venue Dialog */}
      {event?.itineraryId && (
        <AddAdHocVenueDialog
          open={showAddVenueDialog}
          onOpenChange={setShowAddVenueDialog}
          itineraryId={event.itineraryId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
          }}
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

      {/* Floating RSVP Bar - Mobile only, when event is sent */}
      {isMobile && isOrganizer && event.status !== 'draft' && event.inviteSentAt && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground shrink-0">
              {rsvpResponse ? 'Your RSVP:' : 'RSVP'}
            </span>
            <div className="flex gap-2">
              <Button
                variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => organizerRsvpMutation.mutate('yes')}
                disabled={organizerRsvpMutation.isPending}
                className={cn(
                  "flex-1 h-9",
                  rsvpResponse === 'yes' && "bg-green-600 hover:bg-green-700"
                )}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Going
              </Button>
              <Button
                variant={rsvpResponse === 'maybe' ? 'default' : 'outline'}
                size="sm"
                onClick={() => organizerRsvpMutation.mutate('maybe')}
                disabled={organizerRsvpMutation.isPending}
                className={cn(
                  "flex-1 h-9",
                  rsvpResponse === 'maybe' && "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                )}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Maybe
              </Button>
              <Button
                variant={rsvpResponse === 'no' ? 'default' : 'outline'}
                size="sm"
                onClick={() => organizerRsvpMutation.mutate('no')}
                disabled={organizerRsvpMutation.isPending}
                className={cn(
                  "flex-1 h-9",
                  rsvpResponse === 'no' && "bg-red-600 hover:bg-red-700"
                )}
              >
                <XCircle className="h-4 w-4 mr-1" />
                No
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
