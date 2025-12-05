/**
 * Prototype: Event Details Desktop - Subtle Refined Style
 *
 * Aesthetic: Warm, elegant, and inviting
 * - Golden accent borders and glows
 * - Warm beige backgrounds (hsl 35, 40%, 95%)
 * - Smooth cubic-bezier transitions
 * - Subtle gradient overlays
 * - Refined shadows with golden tints
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft,
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
  ExternalLink,
  Navigation,
  Copy,
  X,
  GripVertical,
  Sparkles,
} from "lucide-react";

// Event status type
type EventStatus = "draft" | "sent" | "finalized";
type RsvpStatus = "yes" | "maybe" | "pending" | "no";

// Mock data for the prototype
const mockEvent = {
  name: "Ladles Wicked To",
  groupName: "sweatshorts",
  groupEmoji: "🩳",
  status: "sent" as EventStatus,
  date: "2024-12-15",
  dateDisplay: "Saturday, December 14",
  startTime: "7:00 PM",
  endTime: "10:00 PM",
  timezone: "America/Los_Angeles",
  timezoneDisplay: "PST",
  isOrganizer: true,
  hostMemberId: "1",
  venues: [
    {
      id: "1",
      name: "Ladles",
      type: "Restaurant",
      rating: 4.6,
      address: "1192 Folsom St, San Francisco, CA",
      mapsUrl: "https://maps.google.com/?q=Ladles+San+Francisco",
      photoUrl: null,
    },
  ],
  attendees: [
    { id: "1", name: "Rachel", email: "rachel@email.com", status: "yes" as RsvpStatus, isHost: true, isGuest: false, initials: "R" },
    { id: "2", name: "Eric", email: "eric@email.com", status: "yes" as RsvpStatus, isHost: false, isGuest: false, initials: "E" },
    { id: "3", name: "John", email: "john@email.com", status: "maybe" as RsvpStatus, isHost: false, isGuest: false, initials: "J" },
    { id: "4", name: "Sarah", email: "sarah@email.com", status: "pending" as RsvpStatus, isHost: false, isGuest: false, initials: "S" },
  ],
};

const rsvpLabels: Record<RsvpStatus, string> = {
  yes: "Going",
  maybe: "Maybe",
  pending: "Pending",
  no: "Can't Go",
};

// Refined Card wrapper with Subtle Refined styling
function RefinedCard({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "rounded-2xl border bg-white overflow-hidden",
        "border-[hsl(32,20%,88%)]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        hover && "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        hover && "hover:border-[hsl(44,70%,75%)] hover:shadow-[0_4px_16px_rgba(242,201,76,0.12)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Refined section header with warm expanded state
function RefinedSectionHeader({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative px-5 py-4",
        "bg-[hsl(35,40%,95%)]",
        "border-b border-[hsl(32,20%,88%)]"
      )}
      style={{
        background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
              "shadow-[0_2px_8px_rgba(242,201,76,0.3)]",
              "transform scale-105"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">
            {title}
          </span>
          {children}
        </div>
        {action}
      </div>
    </div>
  );
}

// Venue Card with refined styling
function VenueCard({ venue }: { venue: typeof mockEvent.venues[0] }) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4",
        "border-[hsl(32,20%,88%)] bg-[hsl(38,50%,98%)]",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:border-[hsl(44,70%,75%)] hover:shadow-[0_4px_12px_rgba(242,201,76,0.1)]"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="mt-1 cursor-grab text-[hsl(25,15%,70%)] hover:text-[hsl(25,15%,45%)] transition-colors">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Venue Photo */}
        <div
          className={cn(
            "w-20 h-20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
            "bg-[hsl(35,25%,90%)] border border-[hsl(32,20%,85%)]"
          )}
        >
          {venue.photoUrl ? (
            <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover" />
          ) : (
            <MapPin className="h-8 w-8 text-[hsl(25,15%,65%)]" />
          )}
        </div>

        {/* Venue Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-lg text-[hsl(25,30%,14%)]">{venue.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[hsl(25,15%,45%)]">{venue.type}</span>
                {venue.rating && (
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-[hsl(44,87%,63%)] text-[hsl(44,87%,63%)]" />
                    <span className="text-[hsl(25,15%,45%)]">{venue.rating}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Edit/Delete Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,90%)]"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[hsl(350,65%,50%)] hover:text-[hsl(350,65%,40%)] hover:bg-[hsl(350,50%,95%)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address */}
          <a
            href={venue.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1.5 mt-2 text-sm",
              "text-[hsl(25,15%,45%)] hover:text-[hsl(44,87%,45%)]",
              "transition-colors duration-200"
            )}
          >
            <Navigation className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venue.address}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}

// Attendee Card with refined warm styling
function AttendeeCard({
  attendee,
  isCurrentUser,
}: {
  attendee: typeof mockEvent.attendees[0];
  isCurrentUser: boolean;
}) {
  const statusStyles: Record<RsvpStatus, { bg: string; border: string; text: string; avatar: string; icon: string }> = {
    yes: {
      bg: "bg-[hsl(145,40%,96%)]",
      border: "border-[hsl(145,35%,80%)]",
      text: "text-[hsl(145,45%,35%)]",
      avatar: "bg-[hsl(145,40%,90%)] text-[hsl(145,45%,35%)]",
      icon: "bg-[hsl(145,50%,45%)] text-white",
    },
    maybe: {
      bg: "bg-[hsl(38,50%,96%)]",
      border: "border-[hsl(38,45%,80%)]",
      text: "text-[hsl(38,60%,35%)]",
      avatar: "bg-[hsl(38,50%,88%)] text-[hsl(38,60%,35%)]",
      icon: "bg-[hsl(38,70%,50%)] text-white",
    },
    pending: {
      bg: "bg-[hsl(220,15%,96%)]",
      border: "border-[hsl(220,10%,85%)]",
      text: "text-[hsl(220,10%,45%)]",
      avatar: "bg-[hsl(220,15%,90%)] text-[hsl(220,10%,45%)]",
      icon: "bg-[hsl(220,10%,70%)] text-[hsl(220,10%,35%)]",
    },
    no: {
      bg: "bg-[hsl(350,50%,97%)]",
      border: "border-[hsl(350,40%,85%)]",
      text: "text-[hsl(350,50%,40%)]",
      avatar: "bg-[hsl(350,45%,92%)] text-[hsl(350,50%,40%)]",
      icon: "bg-[hsl(350,60%,55%)] text-white",
    },
  };

  const styles = statusStyles[attendee.status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        styles.bg,
        styles.border,
        isCurrentUser && "ring-2 ring-[hsl(44,87%,63%)]/25 ring-offset-1"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn("text-sm font-semibold", styles.avatar)}>
          {attendee.initials}
        </AvatarFallback>
      </Avatar>

      {/* Name + Host badge */}
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
        <span className={cn("text-xs font-medium", styles.text)}>{rsvpLabels[attendee.status]}</span>
      </div>

      {/* RSVP Status Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full",
          "shadow-sm",
          styles.icon
        )}
      >
        {attendee.status === "yes" && <Check className="h-3.5 w-3.5" />}
        {attendee.status === "maybe" && <span className="text-xs font-bold">?</span>}
        {attendee.status === "pending" && <Clock className="h-3.5 w-3.5" />}
        {attendee.status === "no" && <X className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}

// Refined Action Button
function RefinedActionButton({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
        "border border-[hsl(32,20%,88%)] bg-white",
        "text-[hsl(25,30%,14%)] text-sm font-medium",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
        "hover:shadow-[0_2px_8px_rgba(242,201,76,0.1)]",
        "active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]">
        <Icon className="h-4 w-4" />
      </div>
      {children}
    </button>
  );
}

export default function PrototypeEventDetailsDesktop() {
  const [event] = useState(mockEvent);
  const [userRsvp, setUserRsvp] = useState<RsvpStatus>("yes");

  // Calculate RSVP summary
  const rsvpSummary = {
    yes: event.attendees.filter((a) => a.status === "yes").length,
    maybe: event.attendees.filter((a) => a.status === "maybe").length,
    pending: event.attendees.filter((a) => a.status === "pending").length,
    no: event.attendees.filter((a) => a.status === "no").length,
  };

  return (
    <div className="min-h-screen bg-[hsl(38,50%,98%)]">
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b",
          "border-[hsl(32,20%,88%)] bg-white/95 backdrop-blur",
          "supports-[backdrop-filter]:bg-white/80"
        )}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,93%)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {event.groupName}
          </Button>

          <div className="flex items-center gap-2">
            {event.status === "draft" && (
              <Badge
                className={cn(
                  "bg-[hsl(38,70%,92%)] text-[hsl(38,60%,35%)]",
                  "border border-[hsl(38,50%,75%)]"
                )}
              >
                Draft
              </Badge>
            )}
            {event.status === "draft" && (
              <Button
                size="sm"
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
            {event.isOrganizer && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[hsl(350,65%,50%)] hover:text-[hsl(350,65%,40%)] hover:bg-[hsl(350,50%,95%)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 },
            },
          }}
        >
          {/* Left Column - Event Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Header Card */}
            <RefinedCard>
              <RefinedSectionHeader
                icon={Calendar}
                title="Event Details"
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,90%)]"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                }
              />
              <div className="p-5 space-y-4">
                {/* Group + Event Name */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-[hsl(25,15%,45%)] mb-1">
                    <span className="text-lg">{event.groupEmoji}</span>
                    <span>{event.groupName}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-[hsl(25,30%,14%)]">{event.name}</h1>
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
                  <div>
                    <div className="font-semibold text-[hsl(25,30%,14%)]">{event.dateDisplay}</div>
                    <div className="text-sm text-[hsl(25,15%,45%)]">
                      {event.startTime} - {event.endTime} {event.timezoneDisplay}
                    </div>
                  </div>
                </div>
              </div>
            </RefinedCard>

            {/* Venues Section */}
            <RefinedCard>
              <RefinedSectionHeader
                icon={MapPin}
                title="Venues"
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-2 border-[hsl(32,20%,85%)] text-[hsl(25,15%,45%)]",
                        "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)] hover:text-[hsl(25,30%,14%)]"
                      )}
                    >
                      <Sparkles className="h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-2 border-[hsl(32,20%,85%)] text-[hsl(25,15%,45%)]",
                        "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)] hover:text-[hsl(25,30%,14%)]"
                      )}
                    >
                      <Plus className="h-4 w-4" />
                      Add Location
                    </Button>
                  </div>
                }
              />
              <div className="p-5 space-y-3">
                {event.venues.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
              </div>
            </RefinedCard>
          </div>

          {/* Right Column - Attendees & Actions */}
          <div className="space-y-6">
            {/* Your RSVP */}
            <RefinedCard>
              <RefinedSectionHeader icon={Check} title="Your Response" />
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2">
                  {(["yes", "maybe", "no"] as RsvpStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setUserRsvp(status)}
                      className={cn(
                        "h-11 rounded-xl font-medium text-sm",
                        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        "border",
                        userRsvp === status
                          ? status === "yes"
                            ? "bg-[hsl(145,50%,45%)] text-white border-[hsl(145,50%,40%)] shadow-[0_2px_8px_rgba(76,175,80,0.3)]"
                            : status === "maybe"
                            ? "bg-[hsl(38,70%,50%)] text-white border-[hsl(38,70%,45%)] shadow-[0_2px_8px_rgba(255,193,7,0.3)]"
                            : "bg-[hsl(350,60%,55%)] text-white border-[hsl(350,60%,50%)] shadow-[0_2px_8px_rgba(244,67,54,0.3)]"
                          : "bg-white border-[hsl(32,20%,88%)] text-[hsl(25,15%,45%)] hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
                        "active:scale-[0.97]"
                      )}
                    >
                      {status === "yes" && userRsvp === status && (
                        <Check className="h-4 w-4 inline mr-1" />
                      )}
                      {rsvpLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </RefinedCard>

            {/* Attendees */}
            <RefinedCard>
              <RefinedSectionHeader icon={Users} title="Attendees">
                <div className="flex items-center gap-1.5 ml-3 text-sm text-[hsl(25,15%,45%)]">
                  <span className="text-[hsl(44,87%,45%)] font-semibold">{rsvpSummary.yes}</span>
                  <span>/</span>
                  <span>{event.attendees.length}</span>
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

                {/* Attendee List */}
                <div className="space-y-2">
                  {event.attendees.map((attendee) => (
                    <AttendeeCard
                      key={attendee.id}
                      attendee={attendee}
                      isCurrentUser={attendee.id === "1"}
                    />
                  ))}
                </div>
              </div>
            </RefinedCard>

            {/* Quick Actions */}
            <RefinedCard hover={false}>
              <RefinedSectionHeader icon={Share2} title="Share & Manage" />
              <div className="p-5 space-y-2">
                <RefinedActionButton icon={Copy}>Copy Invite Link</RefinedActionButton>
                <RefinedActionButton icon={UserPlus}>Invite Guest</RefinedActionButton>
                <RefinedActionButton icon={Share2}>Hand Off Host</RefinedActionButton>
              </div>
            </RefinedCard>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
