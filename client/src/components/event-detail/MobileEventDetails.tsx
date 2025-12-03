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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { WhenSection } from "./WhenSection";
import { WhereSection } from "./WhereTimeline";
import { WhoSection } from "./WhoSection";
import { FloatingActionBar } from "./FloatingActionBar";
import { PendingRsvpPrompt } from "./PendingRsvpPrompt";
import type { EventData, EventAttendee, EventStatus, RsvpStatus, RsvpCounts, EventVenue } from "./types";

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
  onInviteGuest?: () => void;
  onRemindAll?: () => void;
  onMakeHost?: (attendee: EventAttendee) => void;
  onDeleteEvent?: () => void;
  onDuplicateEvent?: () => void;
  onUpdateName?: (name: string) => void;
  onUpdateNote?: (note: string) => void;
  onBack?: () => void;
  isSending?: boolean;
}

// Status badge config
const statusConfig = {
  draft: { label: "Draft", className: "bg-warning/10 text-warning border-warning/30" },
  sent: { label: "Sent", className: "bg-success/10 text-success border-success/30" },
  finalized: { label: "Confirmed", className: "bg-primary/10 text-primary border-primary/30" },
};

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
  onInviteGuest,
  onRemindAll,
  onMakeHost,
  onDeleteEvent,
  onDuplicateEvent,
  onUpdateName,
  onUpdateNote,
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

  // Determine event status
  const eventStatus: EventStatus = useMemo(() => {
    if (!event.inviteSentAt) return "draft";
    // TODO: Check if finalized based on quorum or deadline
    return "sent";
  }, [event.inviteSentAt]);

  // Build attendees list
  const attendees: EventAttendee[] = useMemo(() => {
    const result: EventAttendee[] = [];
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
      });
    });

    return result;
  }, [event, itineraryDetails, user]);

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
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{event.groupEmoji || "📅"}</span>
          <span className="font-medium text-foreground">{event.groupName}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="outline" className={cn("text-xs", statusBadge.className)}>
            {statusBadge.label}
          </Badge>
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
          onInviteGuest={onInviteGuest}
          onRemindAll={onRemindAll}
          onMakeHost={onMakeHost}
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
      </main>

      {/* Floating Action Bar - positioned above BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <FloatingActionBar
          status={eventStatus}
          hasUnsavedChanges={false}
          hasMinorChanges={false}
          isOrganizer={isOrganizer}
          isSending={isSending}
          onSendToGroup={onSendToGroup}
          onShare={onShare}
          onInviteGuest={onInviteGuest}
        />
      </div>
    </div>
  );
}
