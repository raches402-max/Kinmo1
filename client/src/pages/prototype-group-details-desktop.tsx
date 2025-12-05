/**
 * Prototype: Group Details Desktop - Subtle Refined Style
 *
 * Complete implementation with all group detail features:
 * - Basic Info: name, emoji, location, budget range, frequency, quorum, availability
 * - Members: full RSVP status, constraints, edit/delete, hosting, invitations
 * - Activity Preferences: novelty slider, categories, past preferences, instructions
 * - Automation: all toggles with help popovers
 * - My Preferences: personal overrides tab
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronDown,
  Settings,
  Info,
  Users,
  Layers,
  Zap,
  Calendar,
  MapPin,
  Plus,
  UserPlus,
  Search,
  Home,
  Compass,
  Hammer,
  HelpCircle,
  Edit2,
  Trash2,
  Check,
  X,
  Mail,
  Link,
  Clock,
  DollarSign,
  CheckCircle2,
  Circle,
  XCircle,
  FileText,
  Send,
  UserCheck,
  Target,
  Palette,
  Sun,
  Sunset,
  Moon,
  Sparkles,
} from "lucide-react";

// ============================================================================
// MOCK DATA - Comprehensive
// ============================================================================

type MemberRole = "owner" | "host" | "member";
type RsvpStatus = "going" | "maybe" | "not_going" | null;

interface Member {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: MemberRole;
  rsvpStatus: RsvpStatus;
  openToHosting: boolean;
  invitationSent: boolean;
  location?: string;
  constraints?: {
    scheduleConflicts: string[];
    budgetConcern: boolean;
    distanceConcern: boolean;
    notes: string;
  };
}

const mockGroup = {
  id: "1",
  name: "Friday Night Foodies",
  emoji: "🍕",
  accentColor: "#F2C94C",
  locationBase: "San Francisco, CA",
  budgetMin: 30,
  budgetMax: 80,
  frequencyNumber: 2,
  frequencyUnit: "month" as const,
  defaultQuorumThreshold: 50,
  novelty: 3, // 1-5 scale
  pastPreferences: "Trying new restaurants, outdoor activities",
  additionalInstructions: "Must be accessible by public transit",
};

const mockMembers: Member[] = [
  {
    id: "1",
    name: "Jane Doe",
    email: "jane@example.com",
    initials: "JD",
    role: "owner",
    rsvpStatus: "going",
    openToHosting: true,
    invitationSent: true,
    location: "Mission District",
  },
  {
    id: "2",
    name: "Mike Smith",
    email: "mike@example.com",
    initials: "MS",
    role: "host",
    rsvpStatus: "going",
    openToHosting: true,
    invitationSent: true,
    location: "SOMA",
    constraints: {
      scheduleConflicts: ["Wednesdays"],
      budgetConcern: false,
      distanceConcern: false,
      notes: "",
    },
  },
  {
    id: "3",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    initials: "SJ",
    role: "member",
    rsvpStatus: "maybe",
    openToHosting: false,
    invitationSent: true,
    constraints: {
      scheduleConflicts: [],
      budgetConcern: true,
      distanceConcern: false,
      notes: "Prefer places under $50",
    },
  },
  {
    id: "4",
    name: "Alex Chen",
    email: "alex@example.com",
    initials: "AC",
    role: "member",
    rsvpStatus: null,
    openToHosting: false,
    invitationSent: false,
  },
  {
    id: "5",
    name: "Emily Davis",
    email: "emily@example.com",
    initials: "ED",
    role: "member",
    rsvpStatus: "not_going",
    openToHosting: true,
    invitationSent: true,
    constraints: {
      scheduleConflicts: ["Friday evenings"],
      budgetConcern: false,
      distanceConcern: true,
      notes: "",
    },
  },
  {
    id: "6",
    name: "Chris Wilson",
    email: "chris@example.com",
    initials: "CW",
    role: "member",
    rsvpStatus: "going",
    openToHosting: false,
    invitationSent: true,
  },
];

const mockCategories = [
  { id: "meal", emoji: "🍽️", name: "Meals", enabled: true },
  { id: "cafe", emoji: "☕", name: "Cafes", enabled: true },
  { id: "drinks", emoji: "🍺", name: "Drinks", enabled: true },
  { id: "dessert", emoji: "🍰", name: "Dessert", enabled: false },
  { id: "experiences", emoji: "🎭", name: "Experiences", enabled: true },
];

const mockAutomation = {
  discoverSpots: true,
  draftPlans: true,
  autoSchedule: false,
};

const mockStats = {
  eventsThisYear: 12,
  activeMembers: 6,
  venuesExplored: 24,
};

const mockNextEvent = {
  title: "Holiday Dinner",
  month: "Dec",
  day: 14,
  daysUntil: 9,
};

// Mock availability grid (days x time periods) - for current user
const mockMyAvailability = {
  Mon: { morning: false, afternoon: true, evening: true },
  Tue: { morning: false, afternoon: true, evening: true },
  Wed: { morning: false, afternoon: false, evening: false },
  Thu: { morning: false, afternoon: true, evening: true },
  Fri: { morning: false, afternoon: true, evening: true },
  Sat: { morning: true, afternoon: true, evening: true },
  Sun: { morning: true, afternoon: true, evening: false },
};

// Mock all members' availability data for heatmap
const mockMembersAvailability = [
  {
    memberId: "1",
    memberName: "Jane Doe",
    availability: {
      Mon: { morning: false, afternoon: true, evening: true },
      Tue: { morning: false, afternoon: true, evening: true },
      Wed: { morning: false, afternoon: false, evening: false },
      Thu: { morning: false, afternoon: true, evening: true },
      Fri: { morning: true, afternoon: true, evening: true },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: true, afternoon: true, evening: false },
    },
  },
  {
    memberId: "2",
    memberName: "Mike Smith",
    availability: {
      Mon: { morning: false, afternoon: true, evening: true },
      Tue: { morning: true, afternoon: true, evening: false },
      Wed: { morning: false, afternoon: true, evening: false },
      Thu: { morning: false, afternoon: true, evening: true },
      Fri: { morning: false, afternoon: true, evening: true },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: false, afternoon: true, evening: true },
    },
  },
  {
    memberId: "3",
    memberName: "Sarah Johnson",
    availability: {
      Mon: { morning: false, afternoon: false, evening: true },
      Tue: { morning: false, afternoon: true, evening: true },
      Wed: { morning: false, afternoon: false, evening: false },
      Thu: { morning: false, afternoon: true, evening: true },
      Fri: { morning: false, afternoon: true, evening: true },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: true, afternoon: true, evening: false },
    },
  },
  {
    memberId: "4",
    memberName: "Alex Chen",
    availability: {
      Mon: { morning: false, afternoon: true, evening: false },
      Tue: { morning: false, afternoon: false, evening: true },
      Wed: { morning: false, afternoon: false, evening: false },
      Thu: { morning: false, afternoon: false, evening: true },
      Fri: { morning: false, afternoon: true, evening: true },
      Sat: { morning: false, afternoon: true, evening: true },
      Sun: { morning: false, afternoon: false, evening: false },
    },
  },
  {
    memberId: "5",
    memberName: "Emily Davis",
    availability: {
      Mon: { morning: false, afternoon: true, evening: true },
      Tue: { morning: false, afternoon: true, evening: true },
      Wed: { morning: false, afternoon: false, evening: true },
      Thu: { morning: false, afternoon: true, evening: false },
      Fri: { morning: false, afternoon: false, evening: false },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: true, afternoon: true, evening: true },
    },
  },
  {
    memberId: "6",
    memberName: "Chris Wilson",
    availability: {
      Mon: { morning: false, afternoon: true, evening: true },
      Tue: { morning: false, afternoon: true, evening: true },
      Wed: { morning: false, afternoon: true, evening: true },
      Thu: { morning: false, afternoon: true, evening: true },
      Fri: { morning: false, afternoon: true, evening: true },
      Sat: { morning: true, afternoon: true, evening: true },
      Sun: { morning: true, afternoon: true, evening: true },
    },
  },
];

const mockMyPreferences = {
  budgetOverrideEnabled: false,
  budgetMin: 20,
  budgetMax: 60,
  categoryOverrideEnabled: false,
  categories: ["meal", "cafes", "drinks"],
  frequencyOverrideEnabled: false,
  frequencyNumber: 1,
  frequencyUnit: "week",
};

// ============================================================================
// MOCK EVENTS DATA
// ============================================================================

type EventStatus = "confirmed" | "planning" | "draft";

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  month: string;
  day: number;
  venue: string;
  status: EventStatus;
  attendees: number;
}

interface PastEvent {
  id: string;
  title: string;
  date: string;
  venue: string;
  attendees: number;
}

const mockUpcomingEvents: UpcomingEvent[] = [
  { id: "1", title: "Holiday Dinner", date: "Dec 14", month: "Dec", day: 14, venue: "Flour + Water", status: "confirmed", attendees: 5 },
  { id: "2", title: "New Year's Brunch", date: "Jan 1", month: "Jan", day: 1, venue: "TBD", status: "planning", attendees: 3 },
  { id: "3", title: "Game Night", date: "Jan 15", month: "Jan", day: 15, venue: "TBD", status: "draft", attendees: 0 },
];

const mockPastEvents: PastEvent[] = [
  { id: "4", title: "Thanksgiving Feast", date: "Nov 23", venue: "Foreign Cinema", attendees: 5 },
  { id: "5", title: "Halloween Party", date: "Oct 31", venue: "Trick Dog", attendees: 6 },
  { id: "6", title: "Summer BBQ", date: "Aug 15", venue: "Dolores Park", attendees: 4 },
  { id: "7", title: "Birthday Celebration", date: "Jul 20", venue: "Lazy Bear", attendees: 5 },
  { id: "8", title: "Spring Picnic", date: "Apr 10", venue: "Golden Gate Park", attendees: 6 },
];

// ============================================================================
// TABS DATA
// ============================================================================

const mainTabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "settings", label: "Settings", icon: Settings },
];

const settingsSubTabs = [
  { id: "group", label: "Group Settings" },
  { id: "my", label: "My Preferences" },
];

// ============================================================================
// NOVELTY LABELS
// ============================================================================

const noveltyLabels: Record<number, string> = {
  1: "We like our usual spots",
  2: "Leaning familiar",
  3: "Open sometimes",
  4: "Pretty adventurous",
  5: "Always up for new things!",
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

function RefinedTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: React.ElementType }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-[hsl(35,25%,93%)] rounded-xl max-w-[600px] mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
              "text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-white text-[hsl(25,30%,14%)] shadow-sm"
                : "text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)]"
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function RefinedSubTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-6 border-b border-[hsl(32,20%,88%)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px",
              isActive
                ? "text-[hsl(25,30%,14%)] border-[hsl(44,87%,63%)]"
                : "text-[hsl(25,15%,45%)] border-transparent hover:text-[hsl(25,30%,14%)]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function RefinedCollapsibleCard({
  icon: Icon,
  title,
  badge,
  badgeVariant = "default",
  children,
  defaultExpanded = false,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "purple";
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "rounded-2xl border bg-white overflow-hidden",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isExpanded
          ? "border-[hsl(44,70%,75%)] shadow-[0_4px_16px_rgba(242,201,76,0.12)]"
          : "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        badgeVariant === "purple" && isExpanded && "border-[hsl(280,50%,75%)]"
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full relative px-5 py-4 flex items-center justify-between",
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isExpanded ? "bg-[hsl(35,40%,95%)]" : "bg-white hover:bg-[hsl(38,50%,99%)]"
        )}
        style={
          isExpanded
            ? {
                background:
                  badgeVariant === "purple"
                    ? "linear-gradient(135deg, hsla(280, 60%, 60%, 0.06) 0%, hsla(280, 60%, 60%, 0.02) 50%, hsl(35, 40%, 95%) 100%)"
                    : "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              isExpanded
                ? badgeVariant === "purple"
                  ? "bg-[hsl(280,60%,60%)] text-white shadow-[0_2px_8px_rgba(147,112,219,0.3)] scale-105"
                  : "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(242,201,76,0.3)] scale-105"
                : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-[13px] font-bold uppercase tracking-[0.08em]",
              "transition-colors duration-300",
              isExpanded ? "text-[hsl(25,30%,14%)]" : "text-[hsl(25,15%,45%)]"
            )}
          >
            {title}
          </span>
          {badge && (
            <Badge
              className={cn(
                "text-[11px] px-2 py-0.5 font-medium",
                badgeVariant === "purple"
                  ? "bg-[hsl(280,60%,95%)] text-[hsl(280,60%,40%)] border-[hsl(280,50%,80%)]"
                  : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)] border-[hsl(32,20%,88%)]"
              )}
              variant="outline"
            >
              {badge}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-[hsl(25,15%,45%)] transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-5 py-5 border-t border-[hsl(32,20%,88%)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RefinedMemberCard({
  member,
  isOrganizer,
  onEdit,
  onDelete,
  onToggleHosting,
}: {
  member: Member;
  isOrganizer: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleHosting?: () => void;
}) {
  const roleColors = {
    owner: "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
    host: "bg-[hsl(110,40%,90%)] text-[hsl(110,40%,30%)]",
    member: "",
  };

  const rsvpConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    going: { icon: CheckCircle2, label: "Going", color: "text-[hsl(145,50%,40%)] bg-[hsl(145,40%,95%)]" },
    maybe: { icon: Circle, label: "Maybe", color: "text-[hsl(38,70%,45%)] bg-[hsl(38,50%,95%)]" },
    not_going: { icon: XCircle, label: "Can't make it", color: "text-[hsl(350,60%,50%)] bg-[hsl(350,50%,95%)]" },
  };

  const avatarColors = [
    "bg-[hsl(44,87%,63%)]",
    "bg-[hsl(200,70%,60%)]",
    "bg-[hsl(280,60%,60%)]",
    "bg-[hsl(350,60%,60%)]",
    "bg-[hsl(160,50%,50%)]",
    "bg-[hsl(30,70%,55%)]",
  ];

  const colorIndex = parseInt(member.id) % avatarColors.length;
  const rsvp = member.rsvpStatus ? rsvpConfig[member.rsvpStatus] : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-[hsl(38,50%,98%)] rounded-xl group">
      <Avatar className="h-10 w-10">
        <AvatarFallback className={cn("text-sm font-semibold text-white", avatarColors[colorIndex])}>
          {member.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[hsl(25,30%,14%)]">{member.name}</span>
          {member.role !== "member" && (
            <Badge className={cn("text-[10px] px-1.5 py-0 font-medium", roleColors[member.role])}>
              {member.role === "owner" ? "Owner" : "Host"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[hsl(25,15%,45%)]">
          <span className="truncate">{member.email}</span>
          {member.location && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {member.location}
              </span>
            </>
          )}
        </div>
        {/* Constraints indicators */}
        {member.constraints && (
          <div className="flex items-center gap-2 mt-1">
            {member.constraints.scheduleConflicts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="flex items-center gap-1 text-[10px] text-[hsl(38,70%,45%)] bg-[hsl(38,50%,95%)] px-1.5 py-0.5 rounded">
                      <Clock className="h-3 w-3" />
                      Schedule
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Conflicts: {member.constraints.scheduleConflicts.join(", ")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {member.constraints.budgetConcern && (
              <span className="flex items-center gap-1 text-[10px] text-[hsl(38,70%,45%)] bg-[hsl(38,50%,95%)] px-1.5 py-0.5 rounded">
                <DollarSign className="h-3 w-3" />
                Budget
              </span>
            )}
            {member.constraints.distanceConcern && (
              <span className="flex items-center gap-1 text-[10px] text-[hsl(38,70%,45%)] bg-[hsl(38,50%,95%)] px-1.5 py-0.5 rounded">
                <MapPin className="h-3 w-3" />
                Distance
              </span>
            )}
          </div>
        )}
      </div>

      {/* RSVP Status */}
      {rsvp && (
        <Badge className={cn("text-[10px] px-2 py-0.5 font-medium border-0", rsvp.color)}>
          <rsvp.icon className="h-3 w-3 mr-1" />
          {rsvp.label}
        </Badge>
      )}
      {!member.rsvpStatus && !member.invitationSent && (
        <Badge className="text-[10px] px-2 py-0.5 font-medium bg-[hsl(220,15%,95%)] text-[hsl(220,10%,45%)]">
          Not invited
        </Badge>
      )}
      {!member.rsvpStatus && member.invitationSent && (
        <Badge className="text-[10px] px-2 py-0.5 font-medium bg-[hsl(220,15%,95%)] text-[hsl(220,10%,45%)]">
          No response
        </Badge>
      )}

      {/* Hosting checkbox */}
      {member.role !== "owner" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Checkbox
                  checked={member.openToHosting}
                  onCheckedChange={onToggleHosting}
                  className="data-[state=checked]:bg-[hsl(44,87%,63%)] data-[state=checked]:border-[hsl(44,87%,63%)]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Volunteer to host events</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Edit/Delete buttons */}
      {isOrganizer && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,90%)] hover:text-[hsl(25,30%,14%)] transition-all"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {member.role !== "owner" && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-[hsl(350,60%,50%)] hover:bg-[hsl(350,50%,95%)] transition-all"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RefinedCategoryPill({
  category,
  onToggle,
}: {
  category: { id: string; emoji: string; name: string; enabled: boolean };
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
        "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        category.enabled
          ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
          : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]",
        "hover:scale-[1.02] active:scale-[0.98]"
      )}
    >
      <span>{category.emoji}</span>
      <span>{category.name}</span>
    </button>
  );
}

function RefinedToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  helpContent,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  helpContent?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-[hsl(38,50%,98%)] rounded-xl hover:bg-[hsl(38,50%,96%)] transition-colors">
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
          checked ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]" : "bg-[hsl(35,25%,90%)] text-[hsl(25,15%,45%)]"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[hsl(25,30%,14%)]">{label}</span>
          {helpContent && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-[hsl(25,15%,60%)] hover:text-[hsl(25,15%,45%)] transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm">
                <p>{helpContent}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="text-xs text-[hsl(25,15%,45%)]">{description}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[hsl(44,87%,63%)]"
      />
    </div>
  );
}

function RefinedStatCard({
  icon: Icon,
  value,
  label,
  iconBg = "bg-[hsl(44,87%,63%)]",
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg text-white", iconBg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-bold text-[hsl(25,30%,14%)]">{value}</div>
        <div className="text-xs text-[hsl(25,15%,45%)]">{label}</div>
      </div>
    </div>
  );
}

function RefinedBudgetSlider({
  min,
  max,
  onChange,
  memberBudgets,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  memberBudgets?: number[];
}) {
  const percentage = (value: number) => ((value - 0) / (250 - 0)) * 100;

  return (
    <div className="p-4 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold text-[hsl(25,30%,14%)]">Budget Range per Person</span>
        <span className="text-sm font-bold text-[hsl(25,30%,14%)]">
          ${min} - {max >= 200 ? "$200+" : `$${max}`}
        </span>
      </div>
      <div className="relative h-2 bg-[hsl(35,25%,90%)] rounded-full mb-4">
        {/* Active range */}
        <div
          className="absolute h-full bg-[hsl(44,87%,63%)] rounded-full"
          style={{ left: `${percentage(min)}%`, width: `${percentage(max) - percentage(min)}%` }}
        />
        {/* Member budget dots */}
        {memberBudgets?.map((budget, i) => (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[hsl(280,60%,60%)] rounded-full border-2 border-white shadow-sm"
                  style={{ left: `calc(${percentage(budget)}% - 6px)` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Member budget: ${budget}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Min thumb */}
        <input
          type="range"
          min={0}
          max={250}
          step={10}
          value={min}
          onChange={(e) => onChange(Math.min(parseInt(e.target.value), max - 10), max)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[hsl(44,87%,63%)] rounded-full shadow-md"
          style={{ left: `calc(${percentage(min)}% - 10px)` }}
        />
        {/* Max thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[hsl(44,87%,63%)] rounded-full shadow-md"
          style={{ left: `calc(${percentage(max)}% - 10px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[hsl(25,15%,45%)]">
        <span>$0</span>
        <span>$250+</span>
      </div>
    </div>
  );
}

function RefinedNoveltySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="p-4 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold text-[hsl(25,30%,14%)]">Openness to New Things</span>
        <span className="text-sm font-medium text-[hsl(44,70%,45%)]">{noveltyLabels[value]}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={5}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-[hsl(35,25%,90%)] rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[hsl(44,87%,63%)]
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-[hsl(25,15%,45%)]">
        <span>Familiar</span>
        <span>Adventurous</span>
      </div>
    </div>
  );
}

function RefinedQuorumSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="p-4 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold text-[hsl(25,30%,14%)]">Default Quorum Threshold</span>
        <span className="text-sm font-bold text-[hsl(25,30%,14%)]">{value}%</span>
      </div>
      <input
        type="range"
        min={10}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-[hsl(35,25%,90%)] rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[hsl(44,87%,63%)]
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between mt-2 text-xs text-[hsl(25,15%,45%)]">
        <span>10%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// Heatmap constants
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const TIMES = ["morning", "afternoon", "evening"] as const;
type Day = typeof DAYS[number];
type TimeSlot = typeof TIMES[number];

const TIME_ICONS: Record<TimeSlot, React.ElementType> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

const TIME_LABELS: Record<TimeSlot, { label: string; range: string }> = {
  morning: { label: "Morning", range: "6am–12pm" },
  afternoon: { label: "Afternoon", range: "12pm–6pm" },
  evening: { label: "Evening", range: "6pm–12am" },
};

function RefinedAvailabilityHeatmap({
  membersAvailability,
  myAvailability,
  onChange,
  currentMemberId = "1",
}: {
  membersAvailability: typeof mockMembersAvailability;
  myAvailability: typeof mockMyAvailability;
  onChange: (day: string, period: string) => void;
  currentMemberId?: string;
}) {
  const [hoveredCell, setHoveredCell] = useState<{ day: Day; time: TimeSlot } | null>(null);
  const totalMembers = membersAvailability.length;

  // Calculate aggregate availability for each cell
  const aggregateAvailability = useMemo(() => {
    const aggregate: Record<string, Record<TimeSlot, { count: number; members: string[] }>> = {};

    DAYS.forEach((day) => {
      aggregate[day] = {
        morning: { count: 0, members: [] },
        afternoon: { count: 0, members: [] },
        evening: { count: 0, members: [] },
      };
    });

    membersAvailability.forEach(({ memberName, availability }) => {
      DAYS.forEach((day) => {
        TIMES.forEach((time) => {
          if (availability[day]?.[time]) {
            aggregate[day][time].count++;
            aggregate[day][time].members.push(memberName);
          }
        });
      });
    });

    return aggregate;
  }, [membersAvailability]);

  // Find sweet spots - times when everyone is available
  const sweetSpots = useMemo(() => {
    const spots: { day: Day; time: TimeSlot }[] = [];
    DAYS.forEach((day) => {
      TIMES.forEach((time) => {
        if (aggregateAvailability[day][time].count === totalMembers && totalMembers > 0) {
          spots.push({ day, time });
        }
      });
    });
    return spots;
  }, [aggregateAvailability, totalMembers]);

  // Get heat background color based on availability ratio (amber tones matching Kinmo style)
  const getHeatBg = (count: number) => {
    const ratio = totalMembers > 0 ? count / totalMembers : 0;
    if (ratio === 0) return "bg-[hsl(35,25%,93%)]";
    if (ratio <= 0.2) return "bg-amber-50";
    if (ratio <= 0.4) return "bg-amber-100";
    if (ratio <= 0.6) return "bg-amber-200";
    if (ratio <= 0.8) return "bg-amber-300";
    return "bg-amber-400";
  };

  // Get text color based on ratio for better contrast
  const getHeatText = (count: number) => {
    const ratio = totalMembers > 0 ? count / totalMembers : 0;
    if (ratio <= 0.4) return "text-[hsl(25,30%,30%)]";
    return "text-white";
  };

  return (
    <div className="p-4 bg-[hsl(38,50%,98%)] rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[hsl(44,87%,50%)]" />
          <span className="text-sm font-semibold text-[hsl(25,30%,14%)]">Group Availability</span>
          <span className="text-xs text-[hsl(25,15%,45%)]">({totalMembers} members)</span>
        </div>
        {sweetSpots.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(44,80%,45%)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{sweetSpots.length} perfect time{sweetSpots.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
        {/* Day headers */}
        <div /> {/* Empty corner */}
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-[hsl(25,15%,45%)] py-1">
            {day}
          </div>
        ))}

        {/* Time rows */}
        {TIMES.map((time) => {
          const TimeIcon = TIME_ICONS[time];
          return (
            <div key={time} className="contents">
              {/* Time label */}
              <div className="flex items-center gap-2 pr-2">
                <TimeIcon className="h-4 w-4 text-[hsl(25,15%,55%)]" />
                <span className="text-xs font-medium text-[hsl(25,15%,45%)]">
                  {TIME_LABELS[time].label}
                </span>
              </div>

              {/* Day cells */}
              {DAYS.map((day) => {
                const { count, members } = aggregateAvailability[day][time];
                const isMySlot = myAvailability[day]?.[time];
                const isSweetSpot = count === totalMembers && totalMembers > 0;
                const isHovered = hoveredCell?.day === day && hoveredCell?.time === time;

                return (
                  <TooltipProvider key={`${day}-${time}`}>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onChange(day, time)}
                          onMouseEnter={() => setHoveredCell({ day, time })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={cn(
                            "h-12 rounded-lg transition-all duration-200 flex items-center justify-center relative",
                            getHeatBg(count),
                            isMySlot && "ring-2 ring-violet-500 ring-inset",
                            isSweetSpot && "ring-2 ring-[hsl(44,87%,55%)] ring-offset-1",
                            isHovered && "scale-105 shadow-md z-10"
                          )}
                        >
                          <span className={cn("text-sm font-bold", getHeatText(count))}>
                            {count}
                          </span>
                          {isSweetSpot && (
                            <Sparkles className="absolute top-1 right-1 h-3 w-3 text-[hsl(44,87%,50%)]" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-white border border-[hsl(32,20%,88%)] shadow-lg max-w-[200px]"
                      >
                        <div className="text-xs">
                          <div className="font-semibold text-[hsl(25,30%,14%)] mb-1">
                            {day} {TIME_LABELS[time].label}
                          </div>
                          <div className="text-[hsl(25,15%,45%)] mb-1">
                            {TIME_LABELS[time].range}
                          </div>
                          <div className="font-medium text-[hsl(25,30%,20%)]">
                            {count} of {totalMembers} available
                          </div>
                          {members.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-[hsl(32,20%,90%)]">
                              <div className="text-[hsl(25,15%,45%)]">
                                {members.join(", ")}
                              </div>
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-[hsl(32,20%,90%)]">
        <div className="flex items-center gap-2 text-xs text-[hsl(25,15%,45%)]">
          <span className="font-medium">Heat:</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded bg-[hsl(35,25%,93%)] border border-[hsl(32,20%,88%)]" title="0" />
            <div className="w-4 h-4 rounded bg-amber-100" title="Low" />
            <div className="w-4 h-4 rounded bg-amber-200" title="Medium" />
            <div className="w-4 h-4 rounded bg-amber-400" title="High" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[hsl(25,15%,45%)]">
          <span className="font-medium">You:</span>
          <div className="w-4 h-4 rounded bg-amber-200 ring-2 ring-violet-500 ring-inset" />
        </div>
        <div className="flex items-center gap-2 text-xs text-[hsl(25,15%,45%)]">
          <span className="font-medium">Perfect:</span>
          <div className="w-4 h-4 rounded bg-amber-400 ring-2 ring-[hsl(44,87%,55%)] ring-offset-1 flex items-center justify-center">
            <Sparkles className="h-2.5 w-2.5 text-[hsl(44,87%,50%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RefinedActionButton({
  icon: Icon,
  children,
  variant = "secondary",
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
        "text-sm font-semibold transition-all duration-200",
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(44,87%,55%)] shadow-[0_4px_12px_rgba(242,201,76,0.3)]",
        variant === "secondary" && "bg-[hsl(35,25%,93%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,88%)]",
        variant === "outline" &&
          "bg-white border border-[hsl(32,20%,88%)] text-[hsl(25,30%,14%)] hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function SidebarCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[hsl(32,20%,88%)] rounded-2xl p-5 mb-4">
      {title && (
        <div className="text-sm font-bold uppercase tracking-[0.05em] text-[hsl(25,15%,45%)] mb-4">{title}</div>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// EVENT COMPONENTS (for Home tab)
// ============================================================================

function RefinedEventCard({ event }: { event: UpcomingEvent }) {
  const statusConfig: Record<EventStatus, { label: string; className: string }> = {
    confirmed: {
      label: "Confirmed",
      className: "bg-[hsl(145,40%,92%)] text-[hsl(145,50%,30%)] border-[hsl(145,35%,80%)]",
    },
    planning: {
      label: "Planning",
      className: "bg-[hsl(44,70%,92%)] text-[hsl(44,70%,30%)] border-[hsl(44,60%,75%)]",
    },
    draft: {
      label: "Draft",
      className: "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)] border-[hsl(32,20%,85%)]",
    },
  };

  const status = statusConfig[event.status];

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={cn(
        "flex items-stretch gap-4 p-4 bg-white rounded-xl border border-[hsl(32,20%,88%)]",
        "transition-all duration-200 cursor-pointer",
        "hover:border-[hsl(44,70%,75%)] hover:shadow-[0_4px_12px_rgba(242,201,76,0.15)]"
      )}
    >
      {/* Date Badge */}
      <div className="flex flex-col items-center justify-center min-w-[60px] px-3 py-2 bg-[hsl(44,87%,63%)] rounded-xl text-[hsl(25,30%,14%)]">
        <span className="text-xs font-semibold uppercase">{event.month}</span>
        <span className="text-2xl font-bold leading-none">{event.day}</span>
      </div>

      {/* Event Info */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[hsl(25,30%,14%)]">{event.title}</span>
          <Badge className={cn("text-[10px] px-1.5 py-0", status.className)} variant="outline">
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-[hsl(25,15%,45%)]">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.venue}
          </span>
          {event.attendees > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {event.attendees} going
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center text-[hsl(25,15%,55%)]">
        <ChevronDown className="h-5 w-5 -rotate-90" />
      </div>
    </motion.div>
  );
}

function RefinedPastEventRow({ event }: { event: PastEvent }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-[hsl(38,50%,98%)] transition-colors cursor-pointer group">
      <div className="text-sm font-medium text-[hsl(25,15%,45%)] min-w-[60px]">{event.date}</div>
      <div className="flex-1">
        <span className="font-medium text-[hsl(25,30%,14%)] group-hover:text-[hsl(44,70%,40%)] transition-colors">
          {event.title}
        </span>
      </div>
      <div className="flex items-center gap-1 text-sm text-[hsl(25,15%,50%)]">
        <MapPin className="h-3.5 w-3.5" />
        <span>{event.venue}</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-[hsl(25,15%,50%)] min-w-[60px]">
        <Users className="h-3.5 w-3.5" />
        <span>{event.attendees}</span>
      </div>
    </div>
  );
}

function RefinedEventsSection({
  title,
  icon: Icon,
  children,
  defaultExpanded = true,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  action?: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-2xl border border-[hsl(32,20%,88%)] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[hsl(38,50%,99%)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-[hsl(25,15%,45%)] transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-5 pb-5 border-t border-[hsl(32,20%,90%)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PrototypeGroupDetailsDesktop() {
  const [activeTab, setActiveTab] = useState("home");
  const [settingsTab, setSettingsTab] = useState("group");
  const [group, setGroup] = useState(mockGroup);
  const [members, setMembers] = useState(mockMembers);
  const [categories, setCategories] = useState(mockCategories);
  const [automation, setAutomation] = useState(mockAutomation);
  const [myAvailability, setMyAvailability] = useState(mockMyAvailability);
  const [membersAvailability] = useState(mockMembersAvailability);
  const [myPreferences, setMyPreferences] = useState(mockMyPreferences);

  const toggleCategory = (id: string) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, enabled: !cat.enabled } : cat)));
  };

  const toggleMyAvailability = (day: string, period: string) => {
    setMyAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day as keyof typeof prev],
        [period]: !prev[day as keyof typeof prev][period as keyof typeof prev.Mon],
      },
    }));
  };

  const toggleMemberHosting = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, openToHosting: !m.openToHosting } : m))
    );
  };

  const enabledCategoriesCount = categories.filter((c) => c.enabled).length;
  const rsvpSummary = {
    going: members.filter((m) => m.rsvpStatus === "going").length,
    maybe: members.filter((m) => m.rsvpStatus === "maybe").length,
    notGoing: members.filter((m) => m.rsvpStatus === "not_going").length,
    noResponse: members.filter((m) => !m.rsvpStatus).length,
  };
  const pendingInvites = members.filter((m) => !m.invitationSent).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[hsl(38,50%,98%)]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-[hsl(32,20%,88%)]">
          <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,93%)] hover:text-[hsl(25,30%,14%)] transition-all">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{group.emoji}</span>
                <span className="text-lg font-semibold text-[hsl(25,30%,14%)]">{group.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,93%)] hover:text-[hsl(25,30%,14%)] transition-all">
                <Link className="h-4 w-4" />
                Copy Join Link
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,93%)] hover:text-[hsl(25,30%,14%)] transition-all">
                <Settings className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1200px] mx-auto px-6 py-6">
          {/* Breadcrumbs */}
          <div className="text-sm text-[hsl(25,15%,45%)] mb-4">
            <a href="#" className="hover:text-[hsl(25,30%,14%)] transition-colors">
              Groups
            </a>
            <span className="mx-2">/</span>
            <span>{group.name}</span>
          </div>

          {/* Main Tabs */}
          <RefinedTabs tabs={mainTabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Home Tab Content */}
          {activeTab === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              {/* Main Content Column */}
              <div className="space-y-5">
                {/* Upcoming Events */}
                <RefinedEventsSection
                  title="Upcoming Events"
                  icon={Calendar}
                  defaultExpanded={true}
                  action={
                    <span className="text-xs font-medium text-[hsl(44,70%,45%)] hover:text-[hsl(44,70%,35%)] transition-colors">
                      View All →
                    </span>
                  }
                >
                  <div className="space-y-3 pt-4">
                    {mockUpcomingEvents.map((event) => (
                      <RefinedEventCard key={event.id} event={event} />
                    ))}
                    {mockUpcomingEvents.length === 0 && (
                      <div className="text-center py-8 text-[hsl(25,15%,50%)]">
                        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No upcoming events</p>
                        <p className="text-xs mt-1">Create an event to get started!</p>
                      </div>
                    )}
                  </div>
                </RefinedEventsSection>

                {/* Past Events */}
                <RefinedEventsSection
                  title="Past Events"
                  icon={Clock}
                  defaultExpanded={false}
                  action={
                    <Badge className="bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)] border-[hsl(32,20%,88%)]" variant="outline">
                      {mockPastEvents.length} events
                    </Badge>
                  }
                >
                  <div className="divide-y divide-[hsl(32,20%,92%)] pt-2">
                    {mockPastEvents.map((event) => (
                      <RefinedPastEventRow key={event.id} event={event} />
                    ))}
                  </div>
                </RefinedEventsSection>
              </div>

              {/* Sidebar Column */}
              <div className="space-y-4">
                <SidebarCard title="Quick Stats">
                  <div className="space-y-2">
                    <RefinedStatCard
                      icon={Calendar}
                      value={mockStats.eventsThisYear}
                      label="Events this year"
                      iconBg="bg-[hsl(44,87%,63%)]"
                    />
                    <RefinedStatCard
                      icon={Users}
                      value={mockStats.activeMembers}
                      label="Active members"
                      iconBg="bg-[hsl(110,50%,50%)]"
                    />
                    <RefinedStatCard
                      icon={MapPin}
                      value={mockStats.venuesExplored}
                      label="Venues explored"
                      iconBg="bg-[hsl(280,60%,60%)]"
                    />
                  </div>
                </SidebarCard>

                <SidebarCard title="Next Event">
                  <div className="flex gap-4 p-4 bg-white border border-[hsl(32,20%,88%)] rounded-xl mb-3">
                    <div className="text-center px-3 py-2 bg-[hsl(38,50%,98%)] rounded-lg border border-[hsl(32,20%,88%)]">
                      <div className="text-[11px] uppercase font-semibold text-[hsl(25,15%,45%)]">
                        {mockNextEvent.month}
                      </div>
                      <div className="text-2xl font-bold text-[hsl(25,30%,14%)]">{mockNextEvent.day}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[hsl(25,30%,14%)]">{mockNextEvent.title}</div>
                      <div className="text-sm text-[hsl(25,15%,45%)]">In {mockNextEvent.daysUntil} days</div>
                    </div>
                  </div>
                  <RefinedActionButton icon={Calendar} variant="primary">
                    View Details
                  </RefinedActionButton>
                </SidebarCard>

                <SidebarCard title="Quick Actions">
                  <div className="space-y-2">
                    <RefinedActionButton icon={Plus} variant="primary">
                      Create Event
                    </RefinedActionButton>
                    <a href="/places" className="block">
                      <RefinedActionButton icon={Compass} variant="outline">
                        Discover Venues
                      </RefinedActionButton>
                    </a>
                  </div>
                </SidebarCard>
              </div>
            </div>
          )}

          {/* Settings Tab Content */}
          {activeTab === "settings" && (
            <>
              {/* Sub Tabs */}
              <RefinedSubTabs tabs={settingsSubTabs} activeTab={settingsTab} onTabChange={setSettingsTab} />

              {settingsTab === "group" ? (
                /* GROUP SETTINGS */
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                  {/* Main Content Column */}
                  <div className="space-y-5">
                    {/* Basic Info Card */}
                    <RefinedCollapsibleCard icon={Info} title="Basic Info" badge="For Everyone" defaultExpanded={true}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                              Group Name
                            </label>
                            <Input
                              value={group.name}
                              onChange={(e) => setGroup({ ...group, name: e.target.value })}
                              className="bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                              Group Icon
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="text-4xl">{group.emoji}</div>
                              <Button variant="outline" size="sm" className="text-xs">
                                Change
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">Location</label>
                            <Input
                              value={group.locationBase}
                              onChange={(e) => setGroup({ ...group, locationBase: e.target.value })}
                              className="bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                              Accent Color
                            </label>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg border border-[hsl(32,20%,88%)]"
                                style={{ backgroundColor: group.accentColor }}
                              />
                              <Input
                                value={group.accentColor}
                                onChange={(e) => setGroup({ ...group, accentColor: e.target.value })}
                                className="flex-1 bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                            Meeting Frequency
                          </label>
                          <div className="flex gap-3">
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={group.frequencyNumber}
                              onChange={(e) => setGroup({ ...group, frequencyNumber: parseInt(e.target.value) || 1 })}
                              className="w-20 bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                            />
                            <select
                              value={group.frequencyUnit}
                              onChange={(e) => setGroup({ ...group, frequencyUnit: e.target.value as any })}
                              className="flex-1 px-3 py-2 rounded-lg bg-[hsl(38,50%,98%)] border border-[hsl(32,20%,88%)] text-sm text-[hsl(25,30%,14%)] focus:border-[hsl(44,87%,63%)] focus:outline-none focus:ring-2 focus:ring-[hsl(44,87%,63%)]/20"
                            >
                              <option value="day">times per day</option>
                              <option value="week">times per week</option>
                              <option value="month">times per month</option>
                              <option value="year">times per year</option>
                            </select>
                          </div>
                        </div>

                        <RefinedBudgetSlider
                          min={group.budgetMin}
                          max={group.budgetMax}
                          onChange={(min, max) => setGroup({ ...group, budgetMin: min, budgetMax: max })}
                          memberBudgets={[25, 40, 55, 70, 90]}
                        />

                        <RefinedQuorumSlider
                          value={group.defaultQuorumThreshold}
                          onChange={(value) => setGroup({ ...group, defaultQuorumThreshold: value })}
                        />

                        <RefinedAvailabilityHeatmap
                          membersAvailability={membersAvailability}
                          myAvailability={myAvailability}
                          onChange={toggleMyAvailability}
                          currentMemberId="1"
                        />
                      </div>
                    </RefinedCollapsibleCard>

                    {/* Members Card */}
                    <RefinedCollapsibleCard
                      icon={Users}
                      title="Members"
                      badge={`${members.length} members`}
                      defaultExpanded={true}
                    >
                      <div className="space-y-4">
                        {/* RSVP Summary */}
                        <div className="flex flex-wrap gap-2 p-3 bg-[hsl(35,25%,95%)] rounded-xl">
                          <Badge className="bg-[hsl(145,40%,95%)] text-[hsl(145,50%,35%)] border-[hsl(145,35%,80%)]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {rsvpSummary.going} going
                          </Badge>
                          <Badge className="bg-[hsl(38,50%,95%)] text-[hsl(38,70%,40%)] border-[hsl(38,45%,80%)]">
                            <Circle className="h-3 w-3 mr-1" />
                            {rsvpSummary.maybe} maybe
                          </Badge>
                          <Badge className="bg-[hsl(350,50%,96%)] text-[hsl(350,60%,45%)] border-[hsl(350,40%,85%)]">
                            <XCircle className="h-3 w-3 mr-1" />
                            {rsvpSummary.notGoing} can't make it
                          </Badge>
                          {rsvpSummary.noResponse > 0 && (
                            <Badge className="bg-[hsl(220,15%,95%)] text-[hsl(220,10%,45%)] border-[hsl(220,10%,85%)]">
                              {rsvpSummary.noResponse} no response
                            </Badge>
                          )}
                        </div>

                        {/* Member List */}
                        <div className="space-y-2">
                          {members.map((member) => (
                            <RefinedMemberCard
                              key={member.id}
                              member={member}
                              isOrganizer={true}
                              onToggleHosting={() => toggleMemberHosting(member.id)}
                            />
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 pt-2">
                          <RefinedActionButton icon={UserPlus} variant="outline">
                            Add Member
                          </RefinedActionButton>
                          {pendingInvites > 0 && (
                            <RefinedActionButton icon={Mail} variant="primary">
                              Send {pendingInvites} Invitation{pendingInvites > 1 ? "s" : ""}
                            </RefinedActionButton>
                          )}
                          <RefinedActionButton icon={Link} variant="outline">
                            Copy Group Join Link
                          </RefinedActionButton>
                        </div>
                      </div>
                    </RefinedCollapsibleCard>

                    {/* Activity Preferences Card */}
                    <RefinedCollapsibleCard
                      icon={Target}
                      title="Activity Preferences"
                      badge={`${enabledCategoriesCount} categories`}
                      defaultExpanded={false}
                    >
                      <div className="space-y-5">
                        <RefinedNoveltySlider
                          value={group.novelty}
                          onChange={(value) => setGroup({ ...group, novelty: value })}
                        />

                        <div>
                          <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-3">Categories</label>
                          <div className="flex flex-wrap gap-2 p-3 bg-[hsl(35,25%,95%)] rounded-xl">
                            {categories.map((category) => (
                              <RefinedCategoryPill
                                key={category.id}
                                category={category}
                                onToggle={() => toggleCategory(category.id)}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                            Past Preferences
                          </label>
                          <Textarea
                            value={group.pastPreferences}
                            onChange={(e) => setGroup({ ...group, pastPreferences: e.target.value })}
                            placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                            className="h-24 resize-none bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                            Additional Instructions
                          </label>
                          <Textarea
                            value={group.additionalInstructions}
                            onChange={(e) => setGroup({ ...group, additionalInstructions: e.target.value })}
                            placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating..."
                            className="h-24 resize-none bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                          />
                        </div>
                      </div>
                    </RefinedCollapsibleCard>

                    {/* Automation Card */}
                    <RefinedCollapsibleCard icon={Zap} title="Automation" badge="Smart Features" defaultExpanded={false}>
                      <div className="space-y-3">
                        <RefinedToggleRow
                          icon={Compass}
                          label="Auto Discover New Spots"
                          description="AI finds venues matching your preferences weekly"
                          checked={automation.discoverSpots}
                          onCheckedChange={(checked) => setAutomation({ ...automation, discoverSpots: checked })}
                          helpContent="Kinmo will automatically search for new venues that match your group's preferences and add them to your discovery queue each week."
                        />
                        <RefinedToggleRow
                          icon={FileText}
                          label="Auto Draft Event Plans"
                          description="Auto-generate ready-to-send itineraries"
                          checked={automation.draftPlans}
                          onCheckedChange={(checked) => setAutomation({ ...automation, draftPlans: checked })}
                          helpContent="Kinmo will create draft event itineraries based on your group's preferences, selected venues, and availability patterns."
                        />
                        <RefinedToggleRow
                          icon={Send}
                          label="Auto Send Invites"
                          description="Schedule and send based on group availability"
                          checked={automation.autoSchedule}
                          onCheckedChange={(checked) => setAutomation({ ...automation, autoSchedule: checked })}
                          helpContent="10 days before your next event is due, Kinmo will select a time and send invites. If no responses within 48 hours, it will finalize and send the event."
                        />

                        {automation.autoSchedule && (
                          <div className="p-3 bg-[hsl(44,87%,95%)] rounded-xl border border-[hsl(44,70%,80%)]">
                            <div className="text-sm font-medium text-[hsl(25,30%,14%)]">
                              Next event due: <span className="font-bold">Dec 20</span>
                            </div>
                            <div className="text-xs text-[hsl(25,15%,45%)] mt-1">
                              Based on meeting {group.frequencyNumber}x per {group.frequencyUnit}
                            </div>
                          </div>
                        )}
                      </div>
                    </RefinedCollapsibleCard>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button className="bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(44,87%,55%)] px-8">
                        <Check className="h-4 w-4 mr-2" />
                        Save Group Settings
                      </Button>
                    </div>
                  </div>

                  {/* Sidebar Column */}
                  <div className="space-y-4">
                    <SidebarCard title="Quick Stats">
                      <div className="space-y-2">
                        <RefinedStatCard
                          icon={Calendar}
                          value={mockStats.eventsThisYear}
                          label="Events this year"
                          iconBg="bg-[hsl(44,87%,63%)]"
                        />
                        <RefinedStatCard
                          icon={Users}
                          value={mockStats.activeMembers}
                          label="Active members"
                          iconBg="bg-[hsl(110,50%,50%)]"
                        />
                        <RefinedStatCard
                          icon={MapPin}
                          value={mockStats.venuesExplored}
                          label="Venues explored"
                          iconBg="bg-[hsl(280,60%,60%)]"
                        />
                      </div>
                    </SidebarCard>

                    <SidebarCard title="Next Event">
                      <div className="flex gap-4 p-4 bg-white border border-[hsl(32,20%,88%)] rounded-xl mb-3">
                        <div className="text-center px-3 py-2 bg-[hsl(38,50%,98%)] rounded-lg border border-[hsl(32,20%,88%)]">
                          <div className="text-[11px] uppercase font-semibold text-[hsl(25,15%,45%)]">
                            {mockNextEvent.month}
                          </div>
                          <div className="text-2xl font-bold text-[hsl(25,30%,14%)]">{mockNextEvent.day}</div>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-[hsl(25,30%,14%)]">{mockNextEvent.title}</div>
                          <div className="text-sm text-[hsl(25,15%,45%)]">In {mockNextEvent.daysUntil} days</div>
                        </div>
                      </div>
                      <RefinedActionButton icon={Calendar} variant="primary">
                        View Details
                      </RefinedActionButton>
                    </SidebarCard>

                    <SidebarCard title="Quick Actions">
                      <div className="space-y-2">
                        <RefinedActionButton icon={Plus} variant="primary">
                          Create Event
                        </RefinedActionButton>
                        <a href="/places" className="block">
                          <RefinedActionButton icon={Compass} variant="outline">
                            Discover Venues
                          </RefinedActionButton>
                        </a>
                      </div>
                    </SidebarCard>
                  </div>
                </div>
              ) : (
                /* MY PREFERENCES TAB */
                <div className="max-w-3xl">
                  <RefinedCollapsibleCard
                    icon={UserCheck}
                    title="My Preferences"
                    badge="Just For Me"
                    badgeVariant="purple"
                    defaultExpanded={true}
                  >
                    <div className="space-y-6">
                      {/* Info box */}
                      <div className="p-4 bg-[hsl(280,60%,97%)] rounded-xl border border-[hsl(280,50%,90%)]">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-[hsl(280,60%,50%)] mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-[hsl(280,60%,30%)]">Personal overrides</div>
                            <div className="text-xs text-[hsl(280,40%,45%)] mt-1">
                              These preferences override group settings for AI suggestions just for you. They won't affect
                              other members.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Budget Override */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={myPreferences.budgetOverrideEnabled}
                            onCheckedChange={(checked) =>
                              setMyPreferences({ ...myPreferences, budgetOverrideEnabled: !!checked })
                            }
                            className="data-[state=checked]:bg-[hsl(280,60%,60%)] data-[state=checked]:border-[hsl(280,60%,60%)]"
                          />
                          <label className="text-sm font-semibold text-[hsl(25,30%,14%)]">
                            Override budget range{" "}
                            <span className="font-normal text-[hsl(25,15%,45%)]">
                              (Group: ${group.budgetMin}-${group.budgetMax})
                            </span>
                          </label>
                        </div>
                        {myPreferences.budgetOverrideEnabled && (
                          <RefinedBudgetSlider
                            min={myPreferences.budgetMin}
                            max={myPreferences.budgetMax}
                            onChange={(min, max) => setMyPreferences({ ...myPreferences, budgetMin: min, budgetMax: max })}
                          />
                        )}
                      </div>

                      {/* Category Override */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={myPreferences.categoryOverrideEnabled}
                            onCheckedChange={(checked) =>
                              setMyPreferences({ ...myPreferences, categoryOverrideEnabled: !!checked })
                            }
                            className="data-[state=checked]:bg-[hsl(280,60%,60%)] data-[state=checked]:border-[hsl(280,60%,60%)]"
                          />
                          <label className="text-sm font-semibold text-[hsl(25,30%,14%)]">
                            Override category preferences{" "}
                            <span className="font-normal text-[hsl(25,15%,45%)]">(Using group categories by default)</span>
                          </label>
                        </div>
                        {myPreferences.categoryOverrideEnabled && (
                          <div className="flex flex-wrap gap-2 p-3 bg-[hsl(35,25%,95%)] rounded-xl">
                            {categories.map((category) => {
                              const isEnabled = myPreferences.categories.includes(category.id);
                              return (
                                <button
                                  key={category.id}
                                  onClick={() => {
                                    setMyPreferences({
                                      ...myPreferences,
                                      categories: isEnabled
                                        ? myPreferences.categories.filter((c) => c !== category.id)
                                        : [...myPreferences.categories, category.id],
                                    });
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                                    "transition-all duration-200",
                                    isEnabled
                                      ? "bg-[hsl(280,60%,60%)] text-white"
                                      : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]",
                                    "hover:scale-[1.02] active:scale-[0.98]"
                                  )}
                                >
                                  <span>{category.emoji}</span>
                                  <span>{category.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Frequency Override */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={myPreferences.frequencyOverrideEnabled}
                            onCheckedChange={(checked) =>
                              setMyPreferences({ ...myPreferences, frequencyOverrideEnabled: !!checked })
                            }
                            className="data-[state=checked]:bg-[hsl(280,60%,60%)] data-[state=checked]:border-[hsl(280,60%,60%)]"
                          />
                          <label className="text-sm font-semibold text-[hsl(25,30%,14%)]">
                            Override meeting frequency{" "}
                            <span className="font-normal text-[hsl(25,15%,45%)]">
                              (Group: {group.frequencyNumber}x per {group.frequencyUnit})
                            </span>
                          </label>
                        </div>
                        {myPreferences.frequencyOverrideEnabled && (
                          <div className="flex gap-3 p-4 bg-[hsl(38,50%,98%)] rounded-xl">
                            <Input
                              type="number"
                              min={1}
                              value={myPreferences.frequencyNumber}
                              onChange={(e) =>
                                setMyPreferences({ ...myPreferences, frequencyNumber: parseInt(e.target.value) || 1 })
                              }
                              className="w-20 bg-white border-[hsl(32,20%,88%)] focus:border-[hsl(280,60%,60%)] focus:ring-[hsl(280,60%,60%)]/20"
                            />
                            <select
                              value={myPreferences.frequencyUnit}
                              onChange={(e) => setMyPreferences({ ...myPreferences, frequencyUnit: e.target.value })}
                              className="flex-1 px-3 py-2 rounded-lg bg-white border border-[hsl(32,20%,88%)] text-sm text-[hsl(25,30%,14%)] focus:border-[hsl(280,60%,60%)] focus:outline-none focus:ring-2 focus:ring-[hsl(280,60%,60%)]/20"
                            >
                              <option value="days">times per day</option>
                              <option value="weeks">times per week</option>
                              <option value="months">times per month</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-4">
                        <Button className="bg-[hsl(280,60%,60%)] text-white hover:bg-[hsl(280,60%,50%)] px-8">
                          <Check className="h-4 w-4 mr-2" />
                          Save My Preferences
                        </Button>
                      </div>
                    </div>
                  </RefinedCollapsibleCard>
                </div>
              )}
            </>
          )}

          {/* Other tabs placeholder */}
          {activeTab !== "settings" && (
            <div className="text-center py-20 text-[hsl(25,15%,45%)]">
              <div className="text-6xl mb-4">
                {activeTab === "home" && "🏠"}
                {activeTab === "explore" && "🧭"}
                {activeTab === "build" && "🔨"}
              </div>
              <div className="text-lg font-medium">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tab</div>
              <div className="text-sm mt-1">This tab content would go here</div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
