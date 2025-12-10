import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  MoreVertical,
  Copy,
  Trash2,
  Share2,
  Check,
  HelpCircle,
  X,
  PenLine,
  Info,
  CalendarDays,
  Mail,
  Clock,
  Hand,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

import { WhenSection } from "./WhenSection";
import { WhereSection } from "./WhereTimeline";
import { WhoSection } from "./WhoSection";
import { PendingRsvpPrompt } from "./PendingRsvpPrompt";
import type { EventData, EventAttendee, EventStatus, RsvpStatus, RsvpCounts, EventVenue, HeadcountSummary } from "./types";

interface MobileEventDetailsProps {
  event: EventData;
  itineraryDetails?: any;
  user?: any;
  isOrganizer: boolean;
  currentUserRsvp?: RsvpStatus;
  onChangeMyRsvp?: (response: RsvpStatus) => void;
  onSendToGroup?: () => void;
  onShare?: () => void;
  onEditDate?: () => void;
  onEditDeadline?: () => void;
  onAddVenue?: () => void;
  onEditVenue?: (venue: EventVenue) => void;
  onRemoveVenue?: (venue: EventVenue) => void;
  onMoveVenue?: (fromIndex: number, toIndex: number) => void;
  guestInvites?: any[];
  onAddGuest?: (name: string) => void;
  onUpdateGuest?: (guestId: string, guestName: string) => void;
  onDeleteGuest?: (guestId: string) => void;
  onInviteGuest?: () => void;
  onRemindAll?: () => void;
  onMakeHost?: (attendee: EventAttendee) => void;
  onRemoveAttendee?: (attendee: EventAttendee) => void;
  onDeleteEvent?: () => void;
  onDuplicateEvent?: () => void;
  onUpdateName?: (name: string) => void;
  onUpdateNote?: (note: string) => void;
  onVolunteerToHost?: () => void;
  canVolunteerToHost?: boolean;
  onBack?: () => void;
  isSending?: boolean;
  onSendInvites?: () => void;
}

// Status badge config
const statusConfig = {
  draft: { label: "Draft", className: "bg-warning/10 text-warning border-warning/30" },
  sent: { label: "Sent", className: "bg-success/10 text-success border-success/30" },
  finalized: { label: "Confirmed", className: "bg-primary/10 text-primary border-primary/30" },
};

interface TimelineInfoProps {
  eventDate: Date;
  inviteSentAt: Date | null;
  rsvpDeadline: Date | null;
  autoScheduleConfig: {
    inviteAdvanceDays: number;
    rsvpWindowDays: number;
    timelineType: string;
  } | null;
}

function TimelineInfoTooltip({ info }: { info: TimelineInfoProps }) {
  const { eventDate, inviteSentAt, rsvpDeadline, autoScheduleConfig } = info;
  const now = new Date();
  const isPastDeadline = rsvpDeadline ? rsvpDeadline < now : false;
  const inviteSendDate = inviteSentAt ||
    (autoScheduleConfig ? subDays(eventDate, autoScheduleConfig.inviteAdvanceDays) : null);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted/50 transition-colors cursor-help">
          <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[280px] p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span>
              <span className="text-muted-foreground">Event:</span>{" "}
              <span className="font-medium">{format(eventDate, "EEE, MMM d")}</span>
            </span>
          </div>

          {inviteSendDate && (
            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span>
                <span className="text-muted-foreground">
                  {inviteSentAt ? "Invites sent:" : "Invites send:"}
                </span>{" "}
                <span className="font-medium">{format(inviteSendDate, "EEE, MMM d")}</span>
              </span>
            </div>
          )}

          {rsvpDeadline && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${isPastDeadline ? "text-muted-foreground" : "text-amber-500"}`} />
              <span>
                <span className="text-muted-foreground">RSVPs due:</span>{" "}
                <span className={`font-medium ${isPastDeadline ? "line-through text-muted-foreground" : ""}`}>
                  {format(rsvpDeadline, "EEE, MMM d")}
                </span>
                {isPastDeadline && (
                  <span className="text-muted-foreground/70 ml-1">(closed)</span>
                )}
              </span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function MobileEventDetails({
  event,
  itineraryDetails,
  user,
  isOrganizer,
  currentUserRsvp,
  onChangeMyRsvp,
  onSendToGroup,
  onShare,
  onEditDate,
  onEditDeadline,
  onAddVenue,
  onEditVenue,
  onRemoveVenue,
  onMoveVenue,
  guestInvites,
  onAddGuest,
  onUpdateGuest,
  onDeleteGuest,
  onInviteGuest,
  onRemindAll,
  onMakeHost,
  onRemoveAttendee,
  onSendInvites,
  onDeleteEvent,
  onDuplicateEvent,
  onUpdateName,
  onUpdateNote,
  onVolunteerToHost,
  canVolunteerToHost,
  onBack,
  isSending,
}: MobileEventDetailsProps) {
  const [, setLocation] = useLocation();

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    when: true,
    where: true,
    who: true,
  });
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(event.itineraryName);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(event.note || "");

  // Guest editing state
  const [showAddGuestDrawer, setShowAddGuestDrawer] = useState(false);
  const [showEditGuestDrawer, setShowEditGuestDrawer] = useState(false);
  const [editingGuest, setEditingGuest] = useState<{ id: string; name: string } | null>(null);
  const [newGuestName, setNewGuestName] = useState("");

  // Determine event status
  const eventStatus: EventStatus = useMemo(() => {
    if (!event.inviteSentAt) return "draft";
    // TODO: Check if finalized based on quorum or deadline
    return "sent";
  }, [event.inviteSentAt]);

  // Build attendees list
  const attendees: EventAttendee[] = useMemo(() => {
    const result: EventAttendee[] = [];

    // For standalone events, use invitees instead of members
    if (event.isStandalone) {
      // Add organizer first for standalone events
      if (user && isOrganizer) {
        const organizerName = user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.email || "You";
        const initials = organizerName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        result.push({
          id: `organizer-${user.id}`,
          name: `${organizerName} (You)`,
          email: user.email,
          initials,
          response: (event.rsvp?.response || event.organizerRsvp || "pending") as RsvpStatus,
          isGuest: false,
          isOrganizer: true,
          isHost: true,
          memberId: undefined,
        });
      }

      // Add invitees
      if (event.invitees && event.invitees.length > 0) {
        event.invitees.forEach((invitee: any) => {
          const baseName = invitee.inviteeName || invitee.inviteeEmail || "Guest";
          const initials = baseName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          result.push({
            id: invitee.id,
            name: baseName,
            email: invitee.inviteeEmail || undefined,
            initials,
            response: (invitee.rsvpStatus || "pending") as RsvpStatus,
            isGuest: false,
            isOrganizer: false,
            isHost: false,
            memberId: invitee.memberId,
          });
        });
      }
      return result;
    }

    // For group events, use members
    const members = event.members || itineraryDetails?.members || [];
    const rsvps = event.detailedRsvps || itineraryDetails?.rsvps || [];

    // Add members (backend already includes organizer with isOrganizer flag)
    members.forEach((member: any) => {
      // Check if this member is the current user (organizer or linked member)
      const isCurrentUser = member.isOrganizer || member.userId === user?.id;

      const rsvp = rsvps.find(
        (r: any) =>
          r.memberId === member.id ||
          r.name === (member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim())
      );

      // For organizer, use their RSVP from event.rsvp
      const response = member.isOrganizer
        ? (event.rsvp?.response || event.organizerRsvp || "pending")
        : (rsvp?.response || "pending");

      const baseName =
        member.name ||
        `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
        member.email ||
        "Member";
      const memberName = isCurrentUser ? `${baseName} (You)` : baseName;
      const initials = baseName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      result.push({
        id: member.id,
        name: memberName,
        email: member.email,
        initials,
        response: response as RsvpStatus,
        isGuest: false,
        isOrganizer: member.isOrganizer || false,
        isHost: member.isOrganizer || member.id === event.hostMemberId,
        memberId: member.isOrganizer ? undefined : member.id,
        additionalAttendees: rsvp?.additionalAttendees || [],
        numberOfKids: rsvp?.numberOfKids || 0,
      });
    });

    // Add guests for group events
    if (guestInvites && guestInvites.length > 0) {
      guestInvites.forEach((guest: any) => {
        const initials = guest.guestName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        result.push({
          id: guest.id,
          name: guest.guestName,
          initials,
          response: (guest.rsvpStatus || "pending") as RsvpStatus,
          isGuest: true,
          isOrganizer: false,
          isHost: false,
        });
      });
    }

    return result;
  }, [event, itineraryDetails, user, guestInvites]);

  // Calculate RSVP counts
  const rsvpCounts: RsvpCounts = useMemo(() => {
    return attendees.reduce(
      (acc, a) => {
        acc[a.response] = (acc[a.response] || 0) + 1;
        return acc;
      },
      { yes: 0, maybe: 0, pending: 0, no: 0 } as RsvpCounts
    );
  }, [attendees]);

  // Calculate "Gang's all here" - all non-guest members RSVPed yes
  const gangsAllHere = useMemo(() => {
    const nonGuestMembers = attendees.filter(a => !a.isGuest);
    if (nonGuestMembers.length === 0) return false;
    return nonGuestMembers.every(a => a.response === "yes");
  }, [attendees]);

  // Headcount summary (includes +1s and kids)
  const headcountSummary: HeadcountSummary = useMemo(() => {
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

  // Build timeline info for tooltip
  const timelineInfo = useMemo(() => {
    if (!event.eventDate) return undefined;

    const eventDate = new Date(event.eventDate);
    const inviteSentAt = event.inviteSentAt ? new Date(event.inviteSentAt) : null;
    const rsvpDeadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;
    const autoScheduleConfig = itineraryDetails?.autoScheduleConfig || event.autoScheduleConfig || null;

    return {
      eventDate,
      inviteSentAt,
      rsvpDeadline,
      autoScheduleConfig,
    };
  }, [event.eventDate, event.inviteSentAt, event.rsvpDeadline, event.autoScheduleConfig, itineraryDetails?.autoScheduleConfig]);

  // Transform venues for the WhereSection
  const venues: EventVenue[] = useMemo(() => {
    return (event.items || []).map((item: any) => ({
      id: item.id,
      sourceId: item.sourceId,
      venueName: item.venueName,
      venueType: item.venueType,
      rating: item.rating,
      arrivalTime: item.arrivalTime,
      departureTime: item.departureTime,
      address: item.venueAddress, // Fixed: Use venueAddress from database
      googlePlaceId: item.googlePlaceId,
      latitude: item.latitude,
      longitude: item.longitude,
      notes: item.notes,
      photoUrl: item.photoUrl,
    }));
  }, [event.items]);

  const toggleSection = (section: "when" | "where" | "who") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const statusBadge = statusConfig[eventStatus];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation(`/group/${event.groupId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </button>

          {/* Editable event name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-8 w-40 text-center text-sm font-semibold"
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
                    setEditingName(event.itineraryName);
                    setIsEditingName(false);
                  }
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => isOrganizer && setIsEditingName(true)}
              className={cn(
                "font-semibold text-foreground truncate max-w-[180px]",
                isOrganizer && "hover:text-primary transition-colors"
              )}
            >
              {event.itineraryName}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  {isOrganizer && (
                    <>
                      <button
                        onClick={() => {
                          onDuplicateEvent?.();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate Event
                      </button>
                      <div className="h-px bg-border" />
                      <button
                        onClick={() => {
                          onDeleteEvent?.();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        {eventStatus === "draft" ? "Delete Event" : "Cancel Event"}
                      </button>
                    </>
                  )}
                  {!isOrganizer && (
                    <button
                      onClick={() => {
                        onShare?.();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors"
                    >
                      <Share2 className="h-4 w-4" />
                      Share Event
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Click overlay to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}

      {/* Event Meta */}
      <div className="px-4 py-4 border-b border-border bg-card/50">
        {/* Only show group name for group events, not standalone */}
        {event.groupId && event.groupName && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{event.groupEmoji || "📅"}</span>
            <span className="font-medium text-foreground">{event.groupName}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="outline" className={cn("text-xs", statusBadge.className)}>
            {statusBadge.label}
          </Badge>
          {/* Show timeline info tooltip next to Draft badge when invites not sent */}
          {eventStatus === "draft" && timelineInfo && (
            <TimelineInfoTooltip info={timelineInfo} />
          )}
          <span className="text-xs text-muted-foreground">
            <span className="text-success font-medium">{rsvpCounts.yes} going</span>
            {rsvpCounts.maybe > 0 && <span> • {rsvpCounts.maybe} maybe</span>}
            {rsvpCounts.pending > 0 && <span> • {rsvpCounts.pending} pending</span>}
          </span>
        </div>

        {/* Current user's RSVP status */}
        {currentUserRsvp !== undefined && (
          currentUserRsvp === "pending" ? (
            /* Prominent RSVP prompt for pending users */
            <PendingRsvpPrompt
              onChangeMyRsvp={onChangeMyRsvp}
              eventName={event.itineraryName}
            />
          ) : (
            /* Compact display for users who have already responded */
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your RSVP:</span>
                <span
                  className={cn(
                    "text-sm font-semibold capitalize",
                    currentUserRsvp === "yes" && "text-success",
                    currentUserRsvp === "maybe" && "text-warning",
                    currentUserRsvp === "no" && "text-destructive"
                  )}
                >
                  {currentUserRsvp === "yes"
                    ? "Going"
                    : currentUserRsvp === "maybe"
                    ? "Maybe"
                    : "Can't go"}
                </span>
              </div>
              <div className="flex gap-1">
                {(["yes", "maybe", "no"] as RsvpStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => onChangeMyRsvp?.(status)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      currentUserRsvp === status
                        ? status === "yes"
                          ? "bg-success text-success-foreground"
                          : status === "maybe"
                          ? "bg-warning text-warning-foreground"
                          : "bg-destructive text-destructive-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {status === "yes" && <Check className="h-4 w-4" />}
                    {status === "maybe" && <HelpCircle className="h-4 w-4" />}
                    {status === "no" && <X className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Main Content */}
      <main className="p-4 space-y-4 pb-32">
        {/* WHEN Section */}
        <WhenSection
          isExpanded={expandedSections.when}
          onToggle={() => toggleSection("when")}
          eventDate={event.eventDate}
          eventEndTime={event.eventEndTime}
          timezone={event.groupTimezone}
          rsvpDeadline={event.rsvpDeadline}
          isOrganizer={isOrganizer}
          onEditDate={onEditDate}
          onEditDeadline={onEditDeadline}
        />

        {/* WHERE Section */}
        <WhereSection
          isExpanded={expandedSections.where}
          onToggle={() => toggleSection("where")}
          venues={venues}
          isOrganizer={isOrganizer}
          onAddVenue={onAddVenue}
          onEditVenue={onEditVenue}
          onRemoveVenue={onRemoveVenue}
          onMoveVenue={onMoveVenue}
        />

        {/* WHO Section */}
        <WhoSection
          isExpanded={expandedSections.who}
          onToggle={() => toggleSection("who")}
          attendees={attendees}
          rsvpCounts={rsvpCounts}
          quorumThreshold={event.quorumThreshold || 50}
          isOrganizer={isOrganizer}
          currentUserRsvp={currentUserRsvp}
          onChangeMyRsvp={onChangeMyRsvp}
          onInviteGuest={() => {
            if (!event.isStandalone && onAddGuest) {
              // For group events, open add guest drawer
              setShowAddGuestDrawer(true);
            } else {
              // For standalone events, use original handler
              onInviteGuest?.();
            }
          }}
          onRemindAll={onRemindAll}
          onMakeHost={onMakeHost}
          onRemoveAttendee={(attendee) => {
            if (attendee.isGuest && onDeleteGuest) {
              // Delete guest
              onDeleteGuest(attendee.id);
            } else {
              // Regular member removal
              onRemoveAttendee?.(attendee);
            }
          }}
          onEditGuestName={(attendee) => {
            if (attendee.isGuest) {
              setEditingGuest({ id: attendee.id, name: attendee.name });
              setShowEditGuestDrawer(true);
            }
          }}
          onShareInvite={eventStatus !== "draft" ? onShare : undefined}
          headcountSummary={headcountSummary}
          gangsAllHere={gangsAllHere}
        />

        {/* Event Note/Description - at the bottom */}
        {(event.note || isOrganizer) && (
          <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-subtle p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 text-muted-foreground">
                <PenLine className="h-4 w-4" />
              </div>
              <div className="flex-1">
                {isEditingNote ? (
                  <textarea
                    value={editingNote}
                    onChange={(e) => setEditingNote(e.target.value)}
                    className="w-full min-h-[80px] text-sm bg-transparent border-0 focus:outline-none resize-none placeholder:text-muted-foreground"
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
                  <button
                    onClick={() => isOrganizer && setIsEditingNote(true)}
                    className={cn(
                      "w-full text-left text-sm text-foreground",
                      isOrganizer && "hover:text-primary transition-colors"
                    )}
                  >
                    {event.note}
                  </button>
                ) : isOrganizer ? (
                  <button
                    onClick={() => setIsEditingNote(true)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    + Add a note or description...
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Volunteer to Host - for non-organizers who can volunteer */}
        {canVolunteerToHost && onVolunteerToHost && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden shadow-subtle p-4">
            <button
              onClick={onVolunteerToHost}
              className="w-full flex items-center justify-center gap-2 text-primary font-medium"
            >
              <Hand className="h-4 w-4" />
              Volunteer to Host
            </button>
          </div>
        )}
      </main>

      {/* Add Guest Drawer */}
      <Drawer open={showAddGuestDrawer} onOpenChange={setShowAddGuestDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Guest</DrawerTitle>
            <DrawerDescription>
              Add a guest to this event. They'll receive a unique invite link.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Name</Label>
              <Input
                id="guest-name"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder="Guest name"
                autoFocus
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={() => {
                if (newGuestName.trim() && onAddGuest) {
                  onAddGuest(newGuestName.trim());
                  setNewGuestName("");
                  setShowAddGuestDrawer(false);
                }
              }}
              disabled={!newGuestName.trim()}
            >
              Add Guest
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Edit Guest Name Drawer */}
      <Drawer open={showEditGuestDrawer} onOpenChange={(open) => {
        setShowEditGuestDrawer(open);
        if (!open) setEditingGuest(null);
      }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Guest Name</DrawerTitle>
            <DrawerDescription>
              Update the name for this guest.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-guest-name">Name</Label>
              <Input
                id="edit-guest-name"
                value={editingGuest?.name || ""}
                onChange={(e) => setEditingGuest(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Guest name"
                autoFocus
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={() => {
                if (editingGuest && editingGuest.name.trim() && onUpdateGuest) {
                  onUpdateGuest(editingGuest.id, editingGuest.name.trim());
                  setEditingGuest(null);
                  setShowEditGuestDrawer(false);
                }
              }}
              disabled={!editingGuest?.name.trim()}
            >
              Save
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
