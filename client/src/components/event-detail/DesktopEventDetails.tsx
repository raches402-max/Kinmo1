/**
 * Desktop Event Details - Subtle Refined Style
 *
 * Clean 3-column layout with warm, elegant styling.
 * No duplicate information (removes EventSummaryStrip redundancy).
 */

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Users,
  Clock,
  Star,
  Plus,
  Edit2,
  Trash2,
  Check,
  Send,
  Share2,
  UserPlus,
  UserMinus,
  ExternalLink,
  Navigation,
  Copy,
  X,
  GripVertical,
  Sparkles,
  CheckCircle,
  HelpCircle,
  XCircle,
  MoreVertical,
  Crown,
  PenLine,
  Bell,
  CopyPlus,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RefinedCard, RefinedSectionHeader, RefinedActionButton, RefinedVenueCard, RefinedAttendeeCard } from "./RefinedCard";
import type { AdditionalAttendeeInfo, HeadcountSummary } from "./types";

type RsvpStatus = "yes" | "maybe" | "pending" | "no";

interface AvailabilityInsight {
  declinedWithAvailability: number;
  totalDeclined: number;
  totalMaybe: number;
  declinersAvailability: Record<string, { morning: number; afternoon: number; evening: number }>;
  rescheduleSuggestion: {
    suggested: boolean;
    bestSlot: string | null;
    matchCount: number;
    totalDeclined: number;
    confidence: number;
    reason: string;
  } | null;
  summary: string;
}

interface DesktopEventDetailsProps {
  event: any;
  itineraryDetails: any;
  user: any;
  isOrganizer: boolean;
  rsvpResponse: RsvpStatus | undefined;
  guestInvites: any[];
  isLoadingGuests: boolean;
  availabilityInsights?: AvailabilityInsight;
  // Mutations
  onOrganizerRsvp: (response: "yes" | "maybe" | "no") => void;
  onUpdateMemberRsvp: (memberId: string, response: "yes" | "maybe" | "no") => void;
  onUpdateEventDate: (date: Date) => void;
  onCopyInviteLink: () => void;
  onCopyGuestLink: (guestToken: string, guestName: string) => void;
  onAddGuest: (name: string) => void;
  onUpdateGuest: (guestId: string, guestName: string) => void;
  onDeleteGuest: (guestId: string) => void;
  onRemoveInvite: (memberId: string) => void;
  onVolunteerToHost: () => void;
  onHandOffHost: (memberId: string) => void;
  onSendToGroup: () => void;
  onDeleteEvent: () => void;
  onAddVenue: () => void;
  onEditVenue: (venue: any) => void;
  onDeleteVenue: (venue: any) => void;
  onReorderVenues: (newOrder: string[]) => void;
  // New feature parity props
  onUpdateName?: (name: string) => void;
  onUpdateNote?: (note: string) => void;
  onDuplicateEvent?: () => void;
  onRemindAll?: () => void;
  // State
  isPending: {
    organizerRsvp: boolean;
    updateMemberRsvp: boolean;
    updateEventDate: boolean;
    addGuest: boolean;
    updateGuest: boolean;
    deleteGuest: boolean;
    volunteerToHost: boolean;
    handOffHost: boolean;
    sendToGroup: boolean;
    deleteEvent: boolean;
  };
  canVolunteerToHost: boolean;
  isCurrentHost: boolean;
  hostableMembers: any[];
}

// Sortable Venue Card for drag-and-drop
function SortableVenueCard({
  venue,
  idx,
  isOrganizer,
  onEdit,
  onDelete,
}: {
  venue: any;
  idx: number;
  isOrganizer: boolean;
  onEdit: (venue: any) => void;
  onDelete: (venue: any) => void;
}) {
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
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <RefinedVenueCard>
        <div className="flex items-start gap-4">
          {/* Drag Handle */}
          {isOrganizer && (
            <div
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab text-[hsl(25,15%,70%)] hover:text-[hsl(25,15%,45%)] transition-colors"
            >
              <GripVertical className="h-5 w-5" />
            </div>
          )}

          {/* Venue Photo */}
          <div
            className={cn(
              "w-20 h-20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
              "bg-[hsl(35,25%,90%)] border border-[hsl(32,20%,85%)]"
            )}
          >
            {venue.photoUrl ? (
              <img src={venue.photoUrl} alt={venue.venueName} className="w-full h-full object-cover" />
            ) : (
              <MapPin className="h-8 w-8 text-[hsl(25,15%,65%)]" />
            )}
          </div>

          {/* Venue Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg text-[hsl(25,30%,14%)]">{venue.venueName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-[hsl(25,15%,45%)]">{venue.venueType}</span>
                  {venue.rating && (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="h-3.5 w-3.5 fill-[hsl(44,87%,63%)] text-[hsl(44,87%,63%)]" />
                      <span className="text-[hsl(25,15%,45%)]">{venue.rating}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Edit/Delete Actions */}
              {isOrganizer && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(venue)}
                    className="h-8 w-8 text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,90%)]"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(venue)}
                    className="h-8 w-8 text-[hsl(350,65%,50%)] hover:text-[hsl(350,65%,40%)] hover:bg-[hsl(350,50%,95%)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Address */}
            {venue.venueAddress && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(venue.venueAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-1.5 mt-2 text-sm",
                  "text-[hsl(25,15%,45%)] hover:text-[hsl(44,87%,45%)]",
                  "transition-colors duration-200"
                )}
              >
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{venue.venueAddress}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>
        </div>
      </RefinedVenueCard>
    </div>
  );
}

export function DesktopEventDetails({
  event,
  itineraryDetails,
  user,
  isOrganizer,
  rsvpResponse,
  guestInvites,
  isLoadingGuests,
  availabilityInsights,
  onOrganizerRsvp,
  onUpdateMemberRsvp,
  onUpdateEventDate,
  onCopyInviteLink,
  onCopyGuestLink,
  onAddGuest,
  onUpdateGuest,
  onDeleteGuest,
  onRemoveInvite,
  onVolunteerToHost,
  onHandOffHost,
  onSendToGroup,
  onDeleteEvent,
  onAddVenue,
  onEditVenue,
  onDeleteVenue,
  onReorderVenues,
  onUpdateName,
  onUpdateNote,
  onDuplicateEvent,
  onRemindAll,
  isPending,
  canVolunteerToHost,
  isCurrentHost,
  hostableMembers,
}: DesktopEventDetailsProps) {
  const [guestName, setGuestName] = useState("");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingGuestName, setEditingGuestName] = useState("");

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(event.itineraryName || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(event.note || "");
  const [isNoteExpanded, setIsNoteExpanded] = useState(!!event.note);

  // Sync editing state when event changes
  useEffect(() => {
    setEditingName(event.itineraryName || "");
    setEditingNote(event.note || "");
  }, [event.itineraryName, event.note]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (dragEvent: DragEndEvent) => {
    const { active, over } = dragEvent;
    if (!event || !over || active.id === over.id) return;

    const oldIndex = event.items.findIndex((item: any) => item.id === active.id);
    const newIndex = event.items.findIndex((item: any) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(event.items, oldIndex, newIndex);
    // Use item.id (itinerary item ID), not sourceId - API validates against item IDs
    const proposedOrder = newItems.map((item: any) => item.id);
    onReorderVenues(proposedOrder);
  };

  // Build attendees list
  const attendees = useMemo(() => {
    const result: Array<{
      id: string;
      name: string;
      initials: string;
      response: RsvpStatus;
      isGuest: boolean;
      isOrganizer?: boolean;
      isHost?: boolean;
      additionalAttendees?: AdditionalAttendeeInfo[];
      numberOfKids?: number;
    }> = [];

    // Add organizer first
    if (event.isOrganizer && user) {
      const organizerName = user.displayName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email || "You";
      const initials = organizerName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

      // Find organizer's RSVP to get +1/kids data
      const organizerRsvp = event.detailedRsvps?.find((r: any) =>
        r.name === organizerName || r.name === organizerName.replace(" (You)", "")
      );

      result.push({
        id: "organizer",
        name: `${organizerName} (You)`,
        initials,
        response: (event.rsvp?.response || "pending") as RsvpStatus,
        isGuest: false,
        isOrganizer: true,
        isHost: true,
        additionalAttendees: organizerRsvp?.additionalAttendees || [],
        numberOfKids: organizerRsvp?.numberOfKids || 0,
      });
    }

    // Add members (skip organizer if already added above)
    const members = (event.members?.length > 0 ? event.members : itineraryDetails?.members) || [];
    members.forEach((member: any) => {
      // Skip if this is the organizer (already added above)
      if (member.isOrganizer) return;

      const rsvp = event.detailedRsvps?.find((r: any) =>
        r.memberId === member.id ||
        r.name === (member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim())
      );
      const memberResponse = rsvp?.response || "pending";

      const name = member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email;
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

      result.push({
        id: member.id,
        name,
        initials,
        response: memberResponse as RsvpStatus,
        isGuest: false,
        isHost: member.id === event.hostMemberId,
        additionalAttendees: rsvp?.additionalAttendees || [],
        numberOfKids: rsvp?.numberOfKids || 0,
      });
    });

    // Add guests
    if (guestInvites && guestInvites.length > 0) {
      guestInvites.forEach((guest: any) => {
        const initials = guest.guestName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
        result.push({
          id: guest.id,
          name: guest.guestName,
          initials,
          response: (guest.rsvpStatus || "pending") as RsvpStatus,
          isGuest: true,
        });
      });
    }

    // Sort: Going first, then Maybe, then Pending, then No
    const order = { yes: 1, maybe: 2, pending: 3, no: 4 };
    result.sort((a, b) => order[a.response] - order[b.response]);

    return result;
  }, [event, itineraryDetails, user, guestInvites]);

  // RSVP summary
  const rsvpSummary = useMemo(() => ({
    yes: attendees.filter(a => a.response === "yes").length,
    maybe: attendees.filter(a => a.response === "maybe").length,
    pending: attendees.filter(a => a.response === "pending").length,
    no: attendees.filter(a => a.response === "no").length,
  }), [attendees]);

  // Headcount summary (includes +1s and kids)
  const headcountSummary = useMemo((): HeadcountSummary => {
    const goingAttendees = attendees.filter(a => a.response === "yes");
    let totalAdults = 0;
    let totalKids = 0;

    goingAttendees.forEach(attendee => {
      // Count the member themselves
      totalAdults += 1;
      // Count their +1s
      if (attendee.additionalAttendees && attendee.additionalAttendees.length > 0) {
        totalAdults += attendee.additionalAttendees.length;
      }
      // Count kids
      if (attendee.numberOfKids && attendee.numberOfKids > 0) {
        totalKids += attendee.numberOfKids;
      }
    });

    return {
      totalAdults,
      totalKids,
      grandTotal: totalAdults + totalKids,
      hasCompanions: totalAdults > goingAttendees.length || totalKids > 0,
    };
  }, [attendees]);

  const rsvpLabels: Record<RsvpStatus, string> = {
    yes: "Going",
    maybe: "Maybe",
    pending: "Pending",
    no: "Can't Go",
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) return;
    onAddGuest(guestName.trim());
    setGuestName("");
  };

  const isDraft = !event.inviteSentAt;

  return (
    <div className="min-h-screen bg-[hsl(38,50%,98%)]">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={event.groupId ? [
            { label: event.groupName || "Group", href: `/group/${event.groupId}` },
            { label: event.itineraryName || "Event" }
          ] : [
            { label: "Dashboard", href: "/" },
            { label: event.itineraryName || "Event" }
          ]}
          className="mb-6"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Event Details + Venues */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Header Card */}
            <RefinedCard>
              <RefinedSectionHeader
                icon={Calendar}
                title="Event Details"
                action={
                  <div className="flex items-center gap-2">
                    {isDraft && (
                      <Badge
                        className={cn(
                          "bg-[hsl(38,70%,92%)] text-[hsl(38,60%,35%)]",
                          "border border-[hsl(38,50%,75%)]"
                        )}
                      >
                        Draft
                      </Badge>
                    )}
                    {isDraft && (
                      <Button
                        size="sm"
                        onClick={onSendToGroup}
                        disabled={isPending.sendToGroup}
                        className={cn(
                          "gap-2 bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                          "hover:bg-[hsl(44,87%,58%)]",
                          "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                        )}
                      >
                        <Send className="h-4 w-4" />
                        Send to Group
                      </Button>
                    )}
                    {isOrganizer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDeleteEvent}
                        className="h-8 w-8 text-[hsl(350,65%,50%)] hover:text-[hsl(350,65%,40%)] hover:bg-[hsl(350,50%,95%)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isOrganizer && onDuplicateEvent && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(38,30%,93%)]"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={onDuplicateEvent}>
                            <CopyPlus className="h-4 w-4 mr-2" />
                            Duplicate Event
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                }
              />
              <div className="p-5 space-y-4">
                {/* Group + Event Name */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-[hsl(25,15%,45%)] mb-1">
                    <span className="text-lg">{event.groupEmoji || "📅"}</span>
                    <span>{event.groupName}</span>
                  </div>
                  {isEditingName ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="text-2xl font-bold h-auto py-1 px-2 -ml-2 border-[hsl(44,70%,75%)] focus:border-[hsl(44,87%,63%)]"
                      autoFocus
                      onBlur={() => {
                        if (editingName.trim() && editingName !== event.itineraryName) {
                          onUpdateName?.(editingName.trim());
                        }
                        setIsEditingName(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingName.trim() && editingName !== event.itineraryName) {
                            onUpdateName?.(editingName.trim());
                          }
                          setIsEditingName(false);
                        } else if (e.key === "Escape") {
                          setEditingName(event.itineraryName || "");
                          setIsEditingName(false);
                        }
                      }}
                    />
                  ) : (
                    <h1
                      className={cn(
                        "text-2xl font-bold text-[hsl(25,30%,14%)]",
                        isOrganizer && onUpdateName && "cursor-pointer hover:text-[hsl(44,87%,45%)] transition-colors"
                      )}
                      onClick={() => isOrganizer && onUpdateName && setIsEditingName(true)}
                    >
                      {event.itineraryName}
                    </h1>
                  )}
                </div>

                {/* Date & Time */}
                <div
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl",
                    "bg-[hsl(35,40%,96%)] border border-[hsl(32,20%,90%)]"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl",
                      "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                      "shadow-[0_2px_8px_rgba(242,201,76,0.25)]"
                    )}
                  >
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    {event.eventDate ? (
                      isOrganizer ? (
                        <div className="space-y-2">
                          {/* Date row */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-left hover:text-[hsl(44,87%,45%)] transition-colors group">
                                <div className="font-semibold text-[hsl(25,30%,14%)] group-hover:text-[hsl(44,70%,40%)] transition-colors">
                                  {event.groupTimezone
                                    ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "EEEE, MMMM d, yyyy")
                                    : format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}
                                </div>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <DatePicker
                                mode="single"
                                selected={event.eventDate ? new Date(event.eventDate) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const originalDate = new Date(event.eventDate);
                                    date.setHours(originalDate.getHours());
                                    date.setMinutes(originalDate.getMinutes());
                                    onUpdateEventDate(date);
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>

                          {/* Time picker row */}
                          <TimePicker
                            value={{
                              hours: new Date(event.eventDate).getHours(),
                              minutes: new Date(event.eventDate).getMinutes()
                            }}
                            onChange={(time) => {
                              const newDate = new Date(event.eventDate);
                              newDate.setHours(time.hours);
                              newDate.setMinutes(time.minutes);
                              onUpdateEventDate(newDate);
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-[hsl(25,30%,14%)]">
                            {event.groupTimezone
                              ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "EEEE, MMMM d, yyyy")
                              : format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}
                          </div>
                          <div className="text-sm text-[hsl(25,15%,45%)]">
                            {event.groupTimezone
                              ? formatInTimeZone(new Date(event.eventDate), event.groupTimezone, "h:mm a zzz")
                              : format(new Date(event.eventDate), "h:mm a")}
                          </div>
                        </>
                      )
                    ) : (
                      <div className="text-[hsl(25,15%,45%)]">Date not set</div>
                    )}
                  </div>
                </div>

                {/* Collapsible Note Section */}
                <div className="border-t border-[hsl(32,20%,88%)] pt-4">
                  <button
                    onClick={() => {
                      if (!isNoteExpanded && isOrganizer && onUpdateNote) {
                        setIsNoteExpanded(true);
                        setIsEditingNote(true);
                      } else {
                        setIsNoteExpanded(!isNoteExpanded);
                      }
                    }}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    <PenLine className="h-4 w-4 text-[hsl(25,15%,45%)]" />
                    <span className="text-sm font-medium text-[hsl(25,15%,45%)] group-hover:text-[hsl(44,87%,45%)] transition-colors">
                      {event.note ? "Note" : "+ Add a note"}
                    </span>
                    {event.note && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-[hsl(25,15%,45%)] ml-auto transition-transform",
                          isNoteExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </button>

                  {isNoteExpanded && (
                    <div className="mt-3">
                      {isEditingNote ? (
                        <Textarea
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          className="min-h-[80px] text-sm border-[hsl(44,70%,75%)] focus:border-[hsl(44,87%,63%)]"
                          placeholder="Add a note or description for this event..."
                          autoFocus
                          onBlur={() => {
                            if (editingNote !== (event.note || "")) {
                              onUpdateNote?.(editingNote);
                            }
                            setIsEditingNote(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setEditingNote(event.note || "");
                              setIsEditingNote(false);
                            }
                          }}
                        />
                      ) : event.note ? (
                        <p
                          onClick={() => isOrganizer && onUpdateNote && setIsEditingNote(true)}
                          className={cn(
                            "text-sm text-[hsl(25,20%,35%)] whitespace-pre-wrap",
                            isOrganizer && onUpdateNote && "hover:text-[hsl(44,87%,45%)] transition-colors cursor-pointer"
                          )}
                        >
                          {event.note}
                        </p>
                      ) : isOrganizer && onUpdateNote ? (
                        <button
                          onClick={() => setIsEditingNote(true)}
                          className="text-sm text-[hsl(25,15%,55%)] hover:text-[hsl(44,87%,45%)] transition-colors"
                        >
                          Click to add a note...
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </RefinedCard>

            {/* Venues Section */}
            <RefinedCard>
              <RefinedSectionHeader
                icon={MapPin}
                title="Venues"
                action={
                  isOrganizer && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddVenue}
                      className={cn(
                        "gap-2 border-[hsl(32,20%,85%)] text-[hsl(25,15%,45%)]",
                        "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)] hover:text-[hsl(25,30%,14%)]"
                      )}
                    >
                      <Plus className="h-4 w-4" />
                      Add Location
                    </Button>
                  )
                }
              />
              <div className="p-5 space-y-3">
                {event.items && event.items.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={event.items.map((item: any) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {event.items.map((venue: any, idx: number) => (
                        <SortableVenueCard
                          key={venue.id}
                          venue={venue}
                          idx={idx}
                          isOrganizer={isOrganizer}
                          onEdit={onEditVenue}
                          onDelete={onDeleteVenue}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="text-center py-8 text-[hsl(25,15%,45%)]">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No venues added yet</p>
                    {isOrganizer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddVenue}
                        className="mt-3"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add a venue
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </RefinedCard>
          </div>

          {/* Right Column - RSVP + Attendees + Actions */}
          <div className="space-y-6">
            {/* Your Response */}
            {isOrganizer && (
              <RefinedCard>
                <RefinedSectionHeader icon={Check} title="Your Response" />
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-2">
                    {(["yes", "maybe", "no"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => onOrganizerRsvp(status)}
                        disabled={isPending.organizerRsvp}
                        className={cn(
                          "h-11 rounded-xl font-medium text-sm",
                          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                          "border disabled:opacity-50",
                          rsvpResponse === status
                            ? status === "yes"
                              ? "bg-[hsl(145,50%,45%)] text-white border-[hsl(145,50%,40%)] shadow-[0_2px_8px_rgba(76,175,80,0.3)]"
                              : status === "maybe"
                              ? "bg-[hsl(38,70%,50%)] text-white border-[hsl(38,70%,45%)] shadow-[0_2px_8px_rgba(255,193,7,0.3)]"
                              : "bg-[hsl(350,60%,55%)] text-white border-[hsl(350,60%,50%)] shadow-[0_2px_8px_rgba(244,67,54,0.3)]"
                            : "bg-white border-[hsl(32,20%,88%)] text-[hsl(25,15%,45%)] hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
                          "active:scale-[0.97]"
                        )}
                      >
                        {status === "yes" && rsvpResponse === status && (
                          <Check className="h-4 w-4 inline mr-1" />
                        )}
                        {rsvpLabels[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </RefinedCard>
            )}

            {/* Members */}
            <RefinedCard>
              <RefinedSectionHeader icon={Users} title="Members">
                <div className="flex items-center gap-1.5 ml-3 text-sm text-[hsl(25,15%,45%)]">
                  <span className="text-[hsl(44,87%,45%)] font-semibold">{rsvpSummary.yes}</span>
                  <span>/</span>
                  <span>{attendees.length}</span>
                </div>
              </RefinedSectionHeader>
              <div className="p-5 space-y-4">
                {/* RSVP Summary Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "bg-[hsl(44,87%,63%)]/15 text-[hsl(44,70%,35%)]",
                      "border border-[hsl(44,87%,63%)]/30"
                    )}
                  >
                    {rsvpSummary.yes} going
                  </Badge>
                  {rsvpSummary.maybe > 0 && (
                    <Badge
                      className={cn(
                        "bg-[hsl(38,50%,94%)] text-[hsl(38,60%,35%)]",
                        "border border-[hsl(38,45%,80%)]"
                      )}
                    >
                      {rsvpSummary.maybe} maybe
                    </Badge>
                  )}
                  {rsvpSummary.pending > 0 && (
                    <Badge
                      className={cn(
                        "bg-[hsl(220,15%,95%)] text-[hsl(220,10%,45%)]",
                        "border border-[hsl(220,10%,85%)]"
                      )}
                    >
                      {rsvpSummary.pending} pending
                    </Badge>
                  )}
                </div>

                {/* Headcount Summary Strip - only show if there are companions */}
                {headcountSummary.hasCompanions && rsvpSummary.yes > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-[hsl(35,40%,96%)] rounded-lg border border-[hsl(32,20%,90%)]">
                    <span className="text-sm text-[hsl(25,15%,45%)]">
                      <span className="font-semibold text-[hsl(25,30%,25%)]">{headcountSummary.totalAdults}</span>
                      {' '}adult{headcountSummary.totalAdults !== 1 ? 's' : ''}
                    </span>
                    {headcountSummary.totalKids > 0 && (
                      <>
                        <span className="text-[hsl(25,15%,65%)]">·</span>
                        <span className="text-sm text-[hsl(25,15%,45%)]">
                          <span className="font-semibold text-[hsl(25,30%,25%)]">{headcountSummary.totalKids}</span>
                          {' '}kid{headcountSummary.totalKids !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                    <span className="text-[hsl(25,15%,65%)]">·</span>
                    <span className="text-sm font-medium text-[hsl(44,70%,35%)]">
                      {headcountSummary.grandTotal} total
                    </span>
                  </div>
                )}

                {/* Attendee List */}
                <div className="space-y-2">
                  {attendees.map((attendee) => (
                    <RefinedAttendeeCard
                      key={attendee.id}
                      status={attendee.response}
                      isCurrentUser={attendee.isOrganizer}
                    >
                      {/* Avatar */}
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-sm font-semibold",
                            attendee.response === "yes" && "bg-[hsl(145,40%,90%)] text-[hsl(145,45%,35%)]",
                            attendee.response === "maybe" && "bg-[hsl(38,50%,88%)] text-[hsl(38,60%,35%)]",
                            attendee.response === "pending" && "bg-[hsl(220,15%,90%)] text-[hsl(220,10%,45%)]",
                            attendee.response === "no" && "bg-[hsl(350,45%,92%)] text-[hsl(350,50%,40%)]"
                          )}
                        >
                          {attendee.initials}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[hsl(25,30%,14%)] truncate">{attendee.name}</span>
                          {attendee.isHost && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-4 font-semibold",
                                "bg-[hsl(44,87%,63%)]/10 border-[hsl(44,87%,63%)]/30 text-[hsl(44,70%,35%)]"
                              )}
                            >
                              Host
                            </Badge>
                          )}
                          {attendee.isGuest && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 font-medium text-[hsl(25,15%,45%)] border-[hsl(32,20%,80%)]"
                            >
                              Guest
                            </Badge>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            attendee.response === "yes" && "text-[hsl(145,45%,35%)]",
                            attendee.response === "maybe" && "text-[hsl(38,60%,35%)]",
                            attendee.response === "pending" && "text-[hsl(220,10%,45%)]",
                            attendee.response === "no" && "text-[hsl(350,50%,40%)]"
                          )}
                        >
                          {rsvpLabels[attendee.response]}
                        </span>

                        {/* Companion info - only show for confirmed attendees with +1s or kids */}
                        {attendee.response === "yes" && (
                          (attendee.additionalAttendees && attendee.additionalAttendees.length > 0) ||
                          (typeof attendee.numberOfKids === 'number' && attendee.numberOfKids > 0)
                        ) && (
                          <div className="text-xs text-[hsl(25,15%,55%)] mt-0.5">
                            Bringing: {[
                              attendee.additionalAttendees && attendee.additionalAttendees.length > 0
                                ? attendee.additionalAttendees[0].name
                                  ? `${attendee.additionalAttendees[0].name} (+1)`
                                  : '+1 guest'
                                : null,
                              typeof attendee.numberOfKids === 'number' && attendee.numberOfKids > 0
                                ? `${attendee.numberOfKids} kid${attendee.numberOfKids !== 1 ? 's' : ''}`
                                : null
                            ].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* RSVP Status Icon */}
                      <div
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full shadow-sm",
                          attendee.response === "yes" && "bg-[hsl(145,50%,45%)] text-white",
                          attendee.response === "maybe" && "bg-[hsl(38,70%,50%)] text-white",
                          attendee.response === "pending" && "bg-[hsl(220,10%,70%)] text-[hsl(220,10%,35%)]",
                          attendee.response === "no" && "bg-[hsl(350,60%,55%)] text-white"
                        )}
                      >
                        {attendee.response === "yes" && <Check className="h-3.5 w-3.5" />}
                        {attendee.response === "maybe" && <span className="text-xs font-bold">?</span>}
                        {attendee.response === "pending" && <Clock className="h-3.5 w-3.5" />}
                        {attendee.response === "no" && <X className="h-3.5 w-3.5" />}
                      </div>

                      {/* Actions dropdown for organizer (non-organizer attendees only) */}
                      {isOrganizer && !attendee.isOrganizer && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[hsl(25,15%,55%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,90%)]"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change RSVP</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => onUpdateMemberRsvp(attendee.id, "yes")}
                              disabled={attendee.response === "yes"}
                            >
                              <Check className="h-4 w-4 mr-2 text-[hsl(145,50%,45%)]" />
                              Going
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateMemberRsvp(attendee.id, "maybe")}
                              disabled={attendee.response === "maybe"}
                            >
                              <HelpCircle className="h-4 w-4 mr-2 text-[hsl(38,70%,50%)]" />
                              Maybe
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateMemberRsvp(attendee.id, "no")}
                              disabled={attendee.response === "no"}
                            >
                              <X className="h-4 w-4 mr-2 text-[hsl(350,60%,55%)]" />
                              Can't Go
                            </DropdownMenuItem>
                            {!attendee.isGuest && !attendee.isHost && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onHandOffHost(attendee.id)}>
                                  <Crown className="h-4 w-4 mr-2 text-[hsl(44,70%,50%)]" />
                                  Make Host
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => attendee.isGuest ? onDeleteGuest(attendee.id) : onRemoveInvite(attendee.id)}
                              className="text-[hsl(350,60%,50%)] focus:text-[hsl(350,60%,50%)]"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </RefinedAttendeeCard>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="border-t border-[hsl(32,20%,88%)] pt-4 mt-4 space-y-2">
                  <RefinedActionButton icon={Copy} onClick={onCopyInviteLink}>
                    Copy Invite Link
                  </RefinedActionButton>
                  {isOrganizer && onRemindAll && (
                    <RefinedActionButton icon={Bell} onClick={onRemindAll}>
                      Remind All
                    </RefinedActionButton>
                  )}
                  {canVolunteerToHost && (
                    <RefinedActionButton
                      icon={UserPlus}
                      onClick={onVolunteerToHost}
                      disabled={isPending.volunteerToHost}
                    >
                      Volunteer to Host
                    </RefinedActionButton>
                  )}
                  {isCurrentHost && hostableMembers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div>
                          <RefinedActionButton icon={Share2}>
                            Hand Off Host
                          </RefinedActionButton>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Select New Host</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {hostableMembers.map((member: any) => (
                          <DropdownMenuItem
                            key={member.id}
                            onClick={() => onHandOffHost(member.id)}
                          >
                            {member.name || member.email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </RefinedCard>

            {/* Availability Insights (Organizer only, when there are declines) */}
            {isOrganizer && availabilityInsights && (availabilityInsights.totalDeclined > 0 || availabilityInsights.totalMaybe > 0) && (
              <RefinedCard hover={false}>
                <RefinedSectionHeader icon={Lightbulb} title="Availability Insights" />
                <div className="p-5 space-y-3">
                  <p className="text-sm text-[hsl(25,15%,45%)]">
                    {availabilityInsights.summary}
                  </p>

                  {availabilityInsights.rescheduleSuggestion?.suggested && (
                    <div className="bg-[hsl(44,87%,63%)]/10 border border-[hsl(44,87%,63%)]/30 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-[hsl(44,70%,35%)] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[hsl(25,30%,14%)]">
                            Consider rescheduling
                          </p>
                          <p className="text-sm text-[hsl(25,15%,45%)] mt-0.5">
                            {availabilityInsights.rescheduleSuggestion.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Only show if there's availability data but no strong suggestion */}
                  {availabilityInsights.declinedWithAvailability > 0 && !availabilityInsights.rescheduleSuggestion?.suggested && (
                    <p className="text-xs text-[hsl(25,15%,55%)]">
                      {availabilityInsights.declinedWithAvailability} {availabilityInsights.declinedWithAvailability === 1 ? 'person' : 'people'} shared availability info
                    </p>
                  )}
                </div>
              </RefinedCard>
            )}

            {/* Guest Invites (Organizer only) */}
            {isOrganizer && (
              <RefinedCard hover={false}>
                <RefinedSectionHeader icon={UserPlus} title={`Guests (${guestInvites.length})`} />
                <div className="p-5 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Guest name..."
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddGuest();
                      }}
                      className="flex-1 h-9 text-sm border-[hsl(32,20%,88%)] focus:border-[hsl(44,70%,75%)]"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddGuest}
                      disabled={!guestName.trim() || isPending.addGuest}
                      className={cn(
                        "gap-1.5 h-9 bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                        "hover:bg-[hsl(44,87%,58%)]"
                      )}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>

                  {isLoadingGuests ? (
                    <div className="text-sm text-[hsl(25,15%,45%)]">Loading guests...</div>
                  ) : guestInvites.length > 0 ? (
                    <div className="space-y-2">
                      {guestInvites.map((guest: any) => (
                        <div
                          key={guest.id}
                          className={cn(
                            "flex items-center justify-between gap-2 p-3 rounded-xl",
                            "border border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)]"
                          )}
                        >
                          {editingGuestId === guest.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingGuestName}
                                onChange={(e) => setEditingGuestName(e.target.value)}
                                className="flex-1 h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editingGuestName.trim()) {
                                    onUpdateGuest(guest.id, editingGuestName.trim());
                                    setEditingGuestId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingGuestId(null);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                disabled={isPending.updateGuest}
                                onClick={() => {
                                  if (editingGuestName.trim()) {
                                    onUpdateGuest(guest.id, editingGuestName.trim());
                                    setEditingGuestId(null);
                                  }
                                }}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingGuestId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-medium text-sm text-[hsl(25,30%,14%)] truncate">
                                  {guest.guestName}
                                </span>
                                {guest.rsvpStatus && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      guest.rsvpStatus === "yes" && "bg-[hsl(145,40%,96%)] text-[hsl(145,45%,35%)] border-[hsl(145,35%,80%)]",
                                      guest.rsvpStatus === "maybe" && "bg-[hsl(38,50%,96%)] text-[hsl(38,60%,35%)] border-[hsl(38,45%,80%)]",
                                      guest.rsvpStatus === "no" && "bg-[hsl(350,50%,97%)] text-[hsl(350,50%,40%)] border-[hsl(350,40%,85%)]"
                                    )}
                                  >
                                    {guest.rsvpStatus === "yes" && "Going"}
                                    {guest.rsvpStatus === "maybe" && "Maybe"}
                                    {guest.rsvpStatus === "no" && "No"}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingGuestId(guest.id);
                                    setEditingGuestName(guest.guestName);
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onCopyGuestLink(guest.guestToken, guest.guestName)}
                                  className="gap-1 h-7 text-xs border-[hsl(32,20%,88%)] hover:border-[hsl(44,70%,75%)]"
                                >
                                  <Copy className="h-3 w-3" />
                                  Link
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Guest?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will remove "{guest.guestName}" from this event. Their invite link will no longer work.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => onDeleteGuest(guest.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[hsl(25,15%,45%)]">
                      No guests invited yet. Add guests to generate shareable invite links.
                    </p>
                  )}
                </div>
              </RefinedCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
