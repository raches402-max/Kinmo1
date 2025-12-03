import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  MoreVertical,
  Calendar,
  MapPin,
  Users,
  ChevronDown,
  Clock,
  Star,
  Plus,
  Edit2,
  Trash2,
  Check,
  HelpCircle,
  Send,
  Share2,
  UserPlus,
  RefreshCw,
  CheckCircle,
  Bell,
  GripVertical,
  X,
  ArrowUpDown,
  CalendarClock,
  Globe,
  Crown,
  Mail,
  MessageSquare,
  ExternalLink,
  Navigation,
  PenLine,
  Copy,
} from "lucide-react";

// Event status type
type EventStatus = "draft" | "sent" | "finalized";
type RsvpStatus = "yes" | "maybe" | "pending" | "no";

// Mock data for the prototype
const initialMockEvent = {
  name: "Dinner with Friends",
  groupName: "Friday Night Crew",
  groupEmoji: "🍕",
  status: "sent" as EventStatus,
  date: "2024-12-15",
  dateDisplay: "Friday, December 15",
  relativeDate: "in 2 weeks", // Relative to "today"
  startTime: "6:00 PM",
  endTime: "10:00 PM",
  timezone: "America/Los_Angeles",
  timezoneDisplay: "Pacific Time",
  rsvpDeadline: "December 8, 2024",
  note: "Let's try that new restaurant everyone's been talking about! Dress code is smart casual.", // Event description/note
  quorumThreshold: 50, // Percentage needed for quorum
  currentUserId: "1", // Sarah M. is the current user (and host in this demo)
  // For the mini-map
  mapCenter: { lat: 37.7749, lng: -122.4194 }, // San Francisco
  venues: [
    {
      id: "1",
      name: "The Cozy Bistro",
      type: "Restaurant",
      rating: 4.5,
      arrivalTime: "6:00 PM",
      departureTime: "8:00 PM",
      address: "123 Main St, San Francisco",
      mapsUrl: "https://maps.google.com/?q=123+Main+St+San+Francisco",
      distance: "0.8 mi",
      notes: "",
    },
    {
      id: "2",
      name: "Moonlight Lounge",
      type: "Bar",
      rating: 4.2,
      arrivalTime: "8:30 PM",
      departureTime: "10:00 PM",
      address: "456 Oak Ave, San Francisco",
      mapsUrl: "https://maps.google.com/?q=456+Oak+Ave+San+Francisco",
      distance: null,
      notes: "Great cocktails!",
    },
  ],
  attendees: [
    { id: "1", name: "Sarah M.", email: "sarah@email.com", status: "yes" as RsvpStatus, isHost: true, isGuest: false },
    { id: "2", name: "John D.", email: "john@email.com", status: "yes" as RsvpStatus, isHost: false, isGuest: false },
    { id: "3", name: "Mike R.", email: "mike@email.com", status: "yes" as RsvpStatus, isHost: false, isGuest: false },
    { id: "4", name: "Emma L.", email: "emma@email.com", status: "pending" as RsvpStatus, isHost: false, isGuest: false },
    { id: "5", name: "Chris P.", email: "chris@email.com", status: "pending" as RsvpStatus, isHost: false, isGuest: true },
  ],
};

// Accordion Section Component
function AccordionSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  children,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-subtle">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          isExpanded && "bg-primary/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
              isExpanded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider transition-colors",
              isExpanded ? "text-primary" : "text-muted-foreground"
            )}
          >
            {title}
          </span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="px-4 pb-4 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Editable Field Component
function EditableField({
  icon: Icon,
  label,
  value,
  onEdit,
  compact = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onEdit: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onEdit}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border border-transparent",
        "hover:bg-muted/50 hover:border-border transition-all group text-left"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={cn("font-medium text-foreground truncate", compact && "text-sm")}>
          {value}
        </div>
      </div>
      <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// Timeline Venue Card - cleaner design with address always visible
function TimelineVenueCard({
  venue,
  isLast,
  isExpanded,
  onToggle,
  onEdit,
  onRemove,
  onSwap,
  onEditTime,
  onEditNotes,
  isOrganizer = true,
}: {
  venue: typeof initialMockEvent.venues[0];
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onSwap: () => void;
  onEditTime: () => void;
  onEditNotes: () => void;
  isOrganizer?: boolean;
}) {
  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[3px] top-4 bottom-0 w-0.5 bg-border" />
      )}

      <div className="flex items-start gap-3">
        {/* Timeline dot with time label */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
        </div>

        {/* Content */}
        <div className="flex-1 pb-5">
          {/* Time label */}
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            {venue.arrivalTime}
          </div>
          <div
            className={cn(
              "rounded-xl border transition-all",
              isExpanded
                ? "border-primary bg-primary/5"
                : "border-card-border bg-card"
            )}
          >
            {/* Main content - always visible */}
            <div className="p-3">
              {/* Header row with name and edit button */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{venue.name}</h4>
                    {venue.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {venue.rating}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{venue.type}</div>
                </div>
                {isOrganizer && (
                  <button
                    onClick={onToggle}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isExpanded
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Address with Google Maps link - always visible */}
              <a
                href={venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors group"
              >
                <Navigation className="h-3 w-3 shrink-0" />
                <span className="truncate">{venue.address}</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 shrink-0" />
              </a>

              {/* Note if exists */}
              {venue.notes && (
                <div className="mt-2 text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-2 py-1.5">
                  "{venue.notes}"
                </div>
              )}
            </div>

            {/* Expanded edit options */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 pt-2 border-t border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); onEditTime(); }}
                      >
                        <Clock className="h-3 w-3" />
                        Edit Time
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); onSwap(); }}
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        Swap Venue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); onEditNotes(); }}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {venue.notes ? "Edit Note" : "Add Note"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5"
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Distance to next venue */}
          {venue.distance && (
            <div className="flex items-center gap-2 mt-2 ml-1 text-xs text-muted-foreground">
              <span className="w-px h-3 bg-border" />
              <span>{venue.distance} to next stop</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Attendee Row with edit options
function AttendeeRow({
  attendee,
  onEditRsvp,
  onMakeHost,
  onRemove,
  onSendReminder,
  isOrganizer = true,
}: {
  attendee: typeof initialMockEvent.attendees[0];
  onEditRsvp: () => void;
  onMakeHost: () => void;
  onRemove: () => void;
  onSendReminder: () => void;
  isOrganizer?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    yes: { icon: Check, bg: "bg-success", text: "text-success-foreground" },
    maybe: { icon: HelpCircle, bg: "bg-warning", text: "text-warning-foreground" },
    pending: { icon: Clock, bg: "bg-muted", text: "text-muted-foreground" },
    no: { icon: X, bg: "bg-destructive", text: "text-destructive-foreground" },
  };

  const config = statusConfig[attendee.status];
  const StatusIcon = config.icon;

  return (
    <div className="relative">
      {isOrganizer ? (
        <button
          onClick={() => setShowActions(!showActions)}
          className={cn(
            "w-full flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors",
            showActions ? "bg-muted/50" : "hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", config.bg, config.text)}>
              <StatusIcon className="h-3 w-3" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{attendee.name}</span>
                {attendee.isHost && (
                  <span className="text-2xs text-muted-foreground flex items-center gap-1">
                    <Crown className="h-2.5 w-2.5" />
                    Host
                  </span>
                )}
                {attendee.isGuest && (
                  <span className="text-2xs text-muted-foreground">
                    Guest
                  </span>
                )}
              </div>
              <div className="text-2xs text-muted-foreground">{attendee.email}</div>
            </div>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            showActions && "rotate-180"
          )} />
        </button>
      ) : (
        // Member view - read-only attendee display
        <div className="flex items-center gap-3 py-3 px-2 -mx-2">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", config.bg, config.text)}>
            <StatusIcon className="h-3 w-3" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{attendee.name}</span>
              {attendee.isHost && (
                <span className="text-2xs text-muted-foreground flex items-center gap-1">
                  <Crown className="h-2.5 w-2.5" />
                  Host
                </span>
              )}
              {attendee.isGuest && (
                <span className="text-2xs text-muted-foreground">
                  Guest
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons - organizer only */}
      <AnimatePresence>
        {showActions && isOrganizer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pb-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={onEditRsvp}
              >
                <Edit2 className="h-3 w-3" />
                Change RSVP
              </Button>
              {!attendee.isHost && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={onMakeHost}
                >
                  <Crown className="h-3 w-3" />
                  Make Host
                </Button>
              )}
              {attendee.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={onSendReminder}
                >
                  <Mail className="h-3 w-3" />
                  Send Reminder
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Status badge config
const statusConfig = {
  draft: { label: "Draft", className: "bg-warning/10 text-warning border-warning/30" },
  sent: { label: "Sent", className: "bg-success/10 text-success border-success/30" },
  finalized: { label: "Confirmed", className: "bg-primary/10 text-primary border-primary/30" },
};

// Floating Action Bar Component
function FloatingActionBar({
  status,
  hasUnsavedChanges,
  hasMinorChanges,
  onDiscard,
  isOrganizer = true,
}: {
  status: EventStatus;
  hasUnsavedChanges: boolean;
  hasMinorChanges?: boolean;
  onDiscard: () => void;
  isOrganizer?: boolean;
}) {
  // Member view - just show share option
  if (!isOrganizer) {
    return (
      <div className="flex gap-3 p-4">
        <Button variant="outline" className="flex-1 h-12 gap-2 text-sm font-semibold">
          <Share2 className="h-4 w-4" />
          Share Event
        </Button>
      </div>
    );
  }

  if (status === "draft") {
    return (
      <div className="flex gap-3 p-4">
        <Button className="flex-1 h-12 gap-2 text-sm font-semibold">
          <Send className="h-4 w-4" />
          Send to Group
        </Button>
        <Button variant="outline" className="h-12 w-12 p-0">
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  if (status === "sent") {
    // Major changes (date, time, venues) - need to send update to group
    if (hasUnsavedChanges) {
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg">
            <RefreshCw className="h-4 w-4 text-warning" />
            <span className="text-xs text-warning font-medium">Changes to date/time/venue require notifying the group</span>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 h-12 gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4" />
              Send Update
            </Button>
            <Button variant="outline" className="h-12 px-4 text-sm" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      );
    }
    // Minor changes (quorum, notes) - auto-saved
    if (hasMinorChanges) {
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-success" />
            <span>Settings saved</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 gap-2 text-sm font-semibold">
              <Share2 className="h-4 w-4" />
              Share Invite Link
            </Button>
            <Button variant="outline" className="h-12 w-12 p-0">
              <UserPlus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex gap-3 p-4">
        <Button variant="outline" className="flex-1 h-12 gap-2 text-sm font-semibold">
          <Share2 className="h-4 w-4" />
          Share Invite Link
        </Button>
        <Button variant="outline" className="h-12 w-12 p-0">
          <UserPlus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-4">
      <Button variant="outline" className="flex-1 h-12 gap-2 text-sm font-semibold">
        <Share2 className="h-4 w-4" />
        Share Details
      </Button>
      <Button variant="outline" className="h-12 px-4 gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-success" />
        Confirmed
      </Button>
    </div>
  );
}

// Main Page Component
export default function PrototypeEventDetailsMobile() {
  const [mockEvent, setMockEvent] = useState(initialMockEvent);
  const [expandedSections, setExpandedSections] = useState({
    when: true,
    where: true,
    who: true,
  });
  const [expandedVenue, setExpandedVenue] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [demoStatus, setDemoStatus] = useState<EventStatus>(mockEvent.status);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(mockEvent.name);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(mockEvent.note);
  const [isEditingQuorum, setIsEditingQuorum] = useState(false);
  const [isMemberView, setIsMemberView] = useState(false); // Toggle between organizer and member view
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track which type of changes have been made
  const [hasMajorChanges, setHasMajorChanges] = useState(false); // Date, time, venues - requires notification
  const [hasMinorChanges, setHasMinorChanges] = useState(false); // Quorum, notes, deadline - saves silently

  // Demo toggle for empty states
  const [showEmptyStates, setShowEmptyStates] = useState(false);

  const toggleSection = (section: "when" | "where" | "who") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Major changes require sending an update to the group (date, time, venues)
  const simulateMajorChange = () => {
    setHasMajorChanges(true);
    setHasUnsavedChanges(true);
  };

  // Minor changes save silently without notifying the group (quorum, notes, deadline)
  const simulateMinorChange = () => {
    setHasMinorChanges(true);
    // Don't set hasUnsavedChanges - these save automatically
  };

  // Legacy function for backwards compatibility
  const simulateChange = simulateMajorChange;

  const rsvpCounts = {
    yes: mockEvent.attendees.filter((a) => a.status === "yes").length,
    maybe: mockEvent.attendees.filter((a) => a.status === "maybe").length,
    pending: mockEvent.attendees.filter((a) => a.status === "pending").length,
    no: mockEvent.attendees.filter((a) => a.status === "no").length,
  };

  // Current user's RSVP
  const currentUser = mockEvent.attendees.find(a => a.id === mockEvent.currentUserId);
  const isOrganizer = Boolean(currentUser?.isHost) && !isMemberView;

  // Quorum calculation
  const totalInvited = mockEvent.attendees.length;
  const quorumNeeded = Math.ceil(totalInvited * (mockEvent.quorumThreshold / 100));
  const quorumProgress = Math.min(100, (rsvpCounts.yes / quorumNeeded) * 100);
  const hasQuorum = rsvpCounts.yes >= quorumNeeded;

  const statusBadge = statusConfig[demoStatus];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
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
                  setMockEvent(prev => ({ ...prev, name: editingName }));
                  setIsEditingName(false);
                  simulateChange();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setMockEvent(prev => ({ ...prev, name: editingName }));
                    setIsEditingName(false);
                    simulateChange();
                  }
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="font-semibold text-foreground truncate max-w-[180px] hover:text-primary transition-colors"
            >
              {mockEvent.name}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showDeleteConfirm && (
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
                          // Duplicate event action
                          setShowDeleteConfirm(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate Event
                      </button>
                      <div className="h-px bg-border" />
                      <button
                        onClick={() => {
                          // Cancel/delete event action
                          setShowDeleteConfirm(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        {demoStatus === "draft" ? "Delete Event" : "Cancel Event"}
                      </button>
                    </>
                  )}
                  {!isOrganizer && (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
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
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Demo Controls */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground font-medium">Status:</span>
          {(["draft", "sent", "finalized"] as EventStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => {
                setDemoStatus(status);
                setHasUnsavedChanges(false);
              }}
              className={cn(
                "px-2 py-1 rounded-md transition-colors capitalize",
                demoStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted"
              )}
            >
              {status}
            </button>
          ))}
          <span className="text-muted-foreground mx-1">|</span>
          <span className="text-muted-foreground font-medium">View:</span>
          <button
            onClick={() => setIsMemberView(false)}
            className={cn(
              "px-2 py-1 rounded-md transition-colors",
              !isMemberView
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted"
            )}
          >
            Organizer
          </button>
          <button
            onClick={() => setIsMemberView(true)}
            className={cn(
              "px-2 py-1 rounded-md transition-colors",
              isMemberView
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted"
            )}
          >
            Member
          </button>
          {demoStatus === "sent" && !isMemberView && (
            <>
              <button
                onClick={() => {
                  setHasUnsavedChanges(!hasUnsavedChanges);
                  setHasMajorChanges(!hasMajorChanges);
                  if (hasUnsavedChanges) setHasMinorChanges(false);
                }}
                className={cn(
                  "px-2 py-1 rounded-md transition-colors ml-2",
                  hasUnsavedChanges
                    ? "bg-warning text-warning-foreground"
                    : "bg-card hover:bg-muted"
                )}
              >
                {hasUnsavedChanges ? "Major ✓" : "+ Major"}
              </button>
              <button
                onClick={() => {
                  setHasMinorChanges(!hasMinorChanges);
                  if (hasMinorChanges) setHasUnsavedChanges(false);
                }}
                className={cn(
                  "px-2 py-1 rounded-md transition-colors",
                  hasMinorChanges
                    ? "bg-success/20 text-success"
                    : "bg-card hover:bg-muted"
                )}
              >
                {hasMinorChanges ? "Minor ✓" : "+ Minor"}
              </button>
            </>
          )}
          <span className="text-muted-foreground mx-1">|</span>
          <button
            onClick={() => setShowEmptyStates(!showEmptyStates)}
            className={cn(
              "px-2 py-1 rounded-md transition-colors",
              showEmptyStates
                ? "bg-muted-foreground text-background"
                : "bg-card hover:bg-muted"
            )}
          >
            {showEmptyStates ? "Empty ✓" : "Empty"}
          </button>
        </div>
      </div>

      {/* Event Meta */}
      <div className="px-4 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{mockEvent.groupEmoji}</span>
          <span className="font-medium text-foreground">{mockEvent.groupName}</span>
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
        {currentUser && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Your RSVP:</span>
              <span className={cn(
                "text-sm font-semibold capitalize",
                currentUser.status === "yes" && "text-success",
                currentUser.status === "maybe" && "text-warning",
                currentUser.status === "pending" && "text-muted-foreground",
                currentUser.status === "no" && "text-destructive"
              )}>
                {currentUser.status === "yes" ? "Going" :
                 currentUser.status === "maybe" ? "Maybe" :
                 currentUser.status === "pending" ? "Not responded" : "Can't go"}
              </span>
            </div>
            <div className="flex gap-1">
              {(["yes", "maybe", "no"] as RsvpStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setMockEvent(prev => ({
                      ...prev,
                      attendees: prev.attendees.map(a =>
                        a.id === currentUser.id ? { ...a, status } : a
                      )
                    }));
                    simulateChange();
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    currentUser.status === status
                      ? status === "yes" ? "bg-success text-success-foreground" :
                        status === "maybe" ? "bg-warning text-warning-foreground" :
                        "bg-destructive text-destructive-foreground"
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
        )}
      </div>

      {/* Main Content */}
      <main className="p-4 space-y-4 pb-32">
        {/* Event Note/Description (if exists) */}
        {(mockEvent.note || isOrganizer) && (
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
                      setMockEvent(prev => ({ ...prev, note: editingNote }));
                      setIsEditingNote(false);
                      simulateMinorChange();
                    }}
                  />
                ) : mockEvent.note ? (
                  <button
                    onClick={() => isOrganizer && setIsEditingNote(true)}
                    className={cn(
                      "w-full text-left text-sm text-foreground",
                      isOrganizer && "hover:text-primary transition-colors"
                    )}
                  >
                    {mockEvent.note}
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

        {/* WHEN Section */}
        <AccordionSection
          icon={Calendar}
          title="When"
          isExpanded={expandedSections.when}
          onToggle={() => toggleSection("when")}
          badge={
            !showEmptyStates && mockEvent.relativeDate ? (
              <span className="text-2xs text-muted-foreground ml-2">
                {mockEvent.relativeDate}
              </span>
            ) : null
          }
        >
          {showEmptyStates ? (
            // Empty state for no date set
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No date set yet</p>
              {isOrganizer && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={simulateChange}
                >
                  <Plus className="h-4 w-4" />
                  Pick a date
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main date/time - the hero info */}
              <button
                onClick={() => isOrganizer && simulateChange()}
                className={cn("w-full text-left", isOrganizer && "group")}
                disabled={!isOrganizer}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">
                        {mockEvent.dateDisplay}
                      </span>
                      {mockEvent.relativeDate && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {mockEvent.relativeDate}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {mockEvent.startTime} – {mockEvent.endTime}
                      <span className="text-muted-foreground/60 ml-1">
                        {mockEvent.timezoneDisplay}
                      </span>
                    </div>
                  </div>
                  {isOrganizer && (
                    <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  )}
                </div>
              </button>

              {/* RSVP deadline - secondary info */}
              <button
                onClick={() => isOrganizer && simulateChange()}
                className={cn(
                  "w-full flex items-center justify-between text-left py-2 px-3 -mx-3 rounded-lg transition-colors",
                  isOrganizer && "hover:bg-muted/50 group"
                )}
                disabled={!isOrganizer}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  <span>RSVP by {mockEvent.rsvpDeadline}</span>
                </div>
                {isOrganizer && (
                  <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          )}
        </AccordionSection>

        {/* WHERE Section */}
        <AccordionSection
          icon={MapPin}
          title="Where"
          isExpanded={expandedSections.where}
          onToggle={() => toggleSection("where")}
          badge={
            !showEmptyStates && mockEvent.venues.length > 0 ? (
              <span className="text-2xs text-muted-foreground ml-2">
                {mockEvent.venues.length} {mockEvent.venues.length === 1 ? "stop" : "stops"}
              </span>
            ) : null
          }
        >
          {showEmptyStates || mockEvent.venues.length === 0 ? (
            // Empty state
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No stops planned yet</p>
              {isOrganizer && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={simulateChange}
                >
                  <Plus className="h-4 w-4" />
                  Add a venue
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mini-map preview */}
              <a
                href={`https://www.google.com/maps/dir/${mockEvent.venues.map(v => encodeURIComponent(v.address)).join('/')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative rounded-xl overflow-hidden border border-border group"
              >
                <div className="aspect-[2/1] bg-muted relative">
                  {/* Static map placeholder - in production, use Google Static Maps API */}
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?size=400x200&scale=2&maptype=roadmap${mockEvent.venues.map((v, i) => `&markers=color:${i === 0 ? 'green' : i === mockEvent.venues.length - 1 ? 'red' : 'blue'}%7Clabel:${i + 1}%7C${encodeURIComponent(v.address)}`).join('')}&key=YOUR_API_KEY`}
                    alt="Route map"
                    className="w-full h-full object-cover opacity-80"
                    onError={(e) => {
                      // Fallback if API key not set - show placeholder
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Fallback gradient placeholder */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-8 w-8 text-primary/40 mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">View route</span>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3" />
                    Open in Maps
                  </div>
                </div>
              </a>

              {/* Venue timeline */}
              <div className="space-y-0">
                {mockEvent.venues.map((venue, index) => (
                  <TimelineVenueCard
                    key={venue.id}
                    venue={venue}
                    isLast={index === mockEvent.venues.length - 1}
                    isExpanded={isOrganizer && expandedVenue === venue.id}
                    onToggle={() => {
                      if (isOrganizer) {
                        setExpandedVenue(expandedVenue === venue.id ? null : venue.id);
                      }
                    }}
                    onEdit={simulateChange}
                    onRemove={simulateChange}
                    onSwap={simulateChange}
                    onEditTime={simulateChange}
                    onEditNotes={simulateChange}
                    isOrganizer={isOrganizer}
                  />
                ))}

                {/* Add stop button - organizer only */}
                {isOrganizer && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center">
                      <Plus className="h-3 w-3 text-primary" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/5"
                      onClick={simulateChange}
                    >
                      Add another stop
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </AccordionSection>

        {/* WHO Section */}
        <AccordionSection
          icon={Users}
          title="Who"
          isExpanded={expandedSections.who}
          onToggle={() => toggleSection("who")}
          badge={
            !showEmptyStates && mockEvent.attendees.length > 0 ? (
              <span className="text-2xs text-muted-foreground ml-2">
                {mockEvent.attendees.length} invited
              </span>
            ) : null
          }
        >
          {showEmptyStates ? (
            // Empty state
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No one invited yet</p>
              {isOrganizer && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={simulateChange}
                >
                  <UserPlus className="h-4 w-4" />
                  Invite members
                </Button>
              )}
            </div>
          ) : (
          <div className="space-y-4">
            {/* RSVP Summary */}
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="font-medium">{rsvpCounts.yes} yes</span>
              </div>
              {rsvpCounts.maybe > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="font-medium">{rsvpCounts.maybe} maybe</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-muted" />
                <span className="font-medium">{rsvpCounts.pending} pending</span>
              </div>
              {rsvpCounts.no > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="font-medium">{rsvpCounts.no} no</span>
                </div>
              )}
            </div>

            {/* Subtle quorum indicator */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    hasQuorum ? "bg-success" : "bg-primary/60"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${quorumProgress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => isOrganizer && setIsEditingQuorum(!isEditingQuorum)}
                  className={cn(
                    "text-2xs text-muted-foreground flex items-center gap-1",
                    isOrganizer && "hover:text-foreground cursor-pointer"
                  )}
                >
                  {hasQuorum ? (
                    <CheckCircle className="h-3 w-3 text-success" />
                  ) : null}
                  <span>{rsvpCounts.yes}/{quorumNeeded} for quorum</span>
                </button>
                <div className="relative group">
                  <HelpCircle className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-popover border border-border rounded-lg shadow-lg text-2xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    Quorum is the minimum number of confirmed attendees needed for this event to happen.
                  </div>
                </div>
              </div>
            </div>

            {/* Quorum threshold editor - organizer only */}
            <AnimatePresence>
              {isEditingQuorum && isOrganizer && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xs text-muted-foreground">Threshold:</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={mockEvent.quorumThreshold}
                        onChange={(e) => {
                          setMockEvent(prev => ({
                            ...prev,
                            quorumThreshold: parseInt(e.target.value)
                          }));
                          simulateMinorChange();
                        }}
                        className="flex-1 accent-primary h-1"
                      />
                      <span className="text-2xs font-medium w-8 text-right">
                        {mockEvent.quorumThreshold}%
                      </span>
                    </div>
                    {!hasQuorum && (
                      <button
                        onClick={() => {
                          // Override quorum - confirm event anyway
                          simulateMinorChange();
                          setIsEditingQuorum(false);
                        }}
                        className="w-full text-2xs text-primary hover:text-primary/80 hover:underline text-left"
                      >
                        Override: Confirm event without quorum →
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attendee List */}
            <div className="divide-y divide-border">
              {mockEvent.attendees.map((attendee) => (
                <AttendeeRow
                  key={attendee.id}
                  attendee={attendee}
                  onEditRsvp={simulateChange}
                  onMakeHost={simulateChange}
                  onRemove={simulateChange}
                  onSendReminder={simulateChange}
                  isOrganizer={isOrganizer}
                />
              ))}
            </div>

            {/* Add buttons - organizer only */}
            {isOrganizer && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-10 text-xs gap-2">
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite Guest
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-10 text-xs gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Remind All
                </Button>
              </div>
            )}
          </div>
          )}
        </AccordionSection>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border safe-area-pb">
        <FloatingActionBar
          status={demoStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          hasMinorChanges={hasMinorChanges}
          onDiscard={() => {
            setHasUnsavedChanges(false);
            setHasMajorChanges(false);
          }}
          isOrganizer={isOrganizer}
        />
      </div>
    </div>
  );
}
