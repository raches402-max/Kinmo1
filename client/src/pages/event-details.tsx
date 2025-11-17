import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState, useMemo } from "react";
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
import { AddAdHocVenueDialog } from "@/components/AddAdHocVenueDialog";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SortableVenueCardProps {
  venue: any;
  idx: number;
  isOrganizer: boolean;
  toast: any;
  queryClient: any;
}

function SortableVenueCard({ venue, idx, isOrganizer, toast, queryClient }: SortableVenueCardProps) {
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

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50 z-50" : ""}>
      <Card className="p-4 hover:shadow-md transition-shadow">
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

          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <span className="text-sm font-semibold text-primary">{idx + 1}</span>
          </div>
          <div className="flex-1 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{venue.venueName}</h4>
                {venue.venueAddress && (
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{venue.venueAddress}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {venue.sourceType === 'ad_hoc' && (
                  <Badge variant="secondary" className="text-xs">Custom</Badge>
                )}
                {isOrganizer && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        toast({
                          title: "Edit coming soon",
                          description: "Inline editing will be available shortly",
                        });
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (confirm(`Remove "${venue.venueName}" from itinerary?`)) {
                          try {
                            await fetch(`/api/itinerary-items/${venue.id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
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
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Timing & Details */}
            <div className="space-y-1.5 text-sm">
              {venue.arrivalTime && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Arrive: {format(new Date(venue.arrivalTime), 'h:mm a')}</span>
                </div>
              )}
              {venue.departureTime && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Depart: {format(new Date(venue.departureTime), 'h:mm a')}</span>
                </div>
              )}
              {venue.travelNotes && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Navigation className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{venue.travelNotes}</span>
                </div>
              )}
              {venue.notes && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <span>📝</span>
                  <span>{venue.notes}</span>
                </div>
              )}
            </div>

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
              {venue.googleMapsUrl && (
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
  const [guestName, setGuestName] = useState("");
  const [showAddVenueDialog, setShowAddVenueDialog] = useState(false);
  const [schedulingPreferences, setSchedulingPreferences] = useState("");

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const reorderVenuesMutation = useMutation({
    mutationFn: async (proposedOrder: string[]) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}/order`, {
        proposedOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
      toast({
        title: "Order updated",
        description: "Venue order has been updated",
      });
    },
  });

  const updateEventDateMutation = useMutation({
    mutationFn: async (eventDate: Date) => {
      return apiRequest("PATCH", `/api/itineraries/${eventId}`, {
        eventDate: eventDate.toISOString(),
      });
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
      return fetch(`/api/itinerary-invites/${inviteToRemove.inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", eventId] });
      toast({
        title: "Invite removed",
        description: "Member has been removed from this event",
      });
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

    // Optimistically update UI
    const newItems = arrayMove(event.items, oldIndex, newIndex);
    queryClient.setQueryData(["/api/user/events", eventId], {
      ...event,
      items: newItems,
    });

    // Send the new order to the server using sourceIds
    const proposedOrder = newItems.map((item: any) => item.sourceId);
    reorderVenuesMutation.mutate(proposedOrder);
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
    if (rsvp.name) return rsvp.name;
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
                  <div className="flex items-center gap-2 mt-3">
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
                            {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy • h:mm a")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy • h:mm a")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {/* Scheduling Preferences (organizer only) */}
                {isOrganizer && (
                  <div className="flex items-center gap-2 mt-2">
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Venues</h3>
                {isOrganizer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddVenueDialog(true)}
                    className="gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    Add Location
                  </Button>
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
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Attendees</h3>

              {(() => {
                // Create a comprehensive attendee list with all members and guests
                const attendees: Array<{
                  id: string;
                  name: string;
                  initials: string;
                  response: 'yes' | 'maybe' | 'no' | 'pending';
                  isGuest: boolean;
                  additionalAttendees?: number;
                  numberOfKids?: number;
                }> = [];

                // Add all members
                if (event.members) {
                  event.members.forEach((member: any) => {
                    const rsvp = event.detailedRsvps?.find((r: any) =>
                      r.memberId === member.id ||
                      r.memberName === (member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim())
                    );

                    const name = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                    attendees.push({
                      id: member.id,
                      name,
                      initials,
                      response: rsvp?.response || 'pending',
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

                return (
                  <>
                    {/* Summary Stats */}
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-medium">{goingCount} Going</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="font-medium">{maybeCount} Maybe</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                        <span className="font-medium">{pendingCount} Invited</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="font-medium">{noCount} Can't Make It</span>
                      </div>
                    </div>

                    {/* Attendee Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {attendees.map((attendee) => (
                        <div
                          key={attendee.id}
                          className="group relative flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          {/* Avatar */}
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                            ${attendee.response === 'yes' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                            ${attendee.response === 'maybe' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                            ${attendee.response === 'no' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : ''}
                            ${attendee.response === 'pending' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : ''}
                          `}>
                            {attendee.initials}
                          </div>

                          {/* Name and Status */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">
                              {attendee.name}
                              {attendee.isGuest && (
                                <Badge variant="outline" className="text-xs py-0 h-4">Guest</Badge>
                              )}
                            </div>

                            {/* RSVP Controls for Organizer */}
                            {isOrganizer && !attendee.isGuest ? (
                              <div className="flex items-center gap-1 mt-1">
                                <Button
                                  variant={attendee.response === 'yes' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'yes' })}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={attendee.response === 'maybe' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'maybe' })}
                                >
                                  <HelpCircle className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={attendee.response === 'no' ? 'default' : 'ghost'}
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => updateMemberRsvpMutation.mutate({ memberId: attendee.id, response: 'no' })}
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {attendee.response === 'yes' && (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    <span className="text-xs text-green-600 dark:text-green-400">Going</span>
                                  </>
                                )}
                                {attendee.response === 'maybe' && (
                                  <>
                                    <HelpCircle className="h-3 w-3 text-yellow-600" />
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400">Maybe</span>
                                  </>
                                )}
                                {attendee.response === 'no' && (
                                  <>
                                    <XCircle className="h-3 w-3 text-red-600" />
                                    <span className="text-xs text-red-600 dark:text-red-400">Can't Make It</span>
                                  </>
                                )}
                                {attendee.response === 'pending' && (
                                  <>
                                    <MinusCircle className="h-3 w-3 text-gray-500" />
                                    <span className="text-xs text-muted-foreground">Invited</span>
                                  </>
                                )}
                                {(attendee.additionalAttendees || 0) > 0 && (
                                  <span className="text-xs text-muted-foreground">+{attendee.additionalAttendees}</span>
                                )}
                                {(attendee.numberOfKids || 0) > 0 && (
                                  <span className="text-xs text-muted-foreground">({attendee.numberOfKids} kids)</span>
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
                  </>
                );
              })()}
            </div>

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
    </div>
  );
}
