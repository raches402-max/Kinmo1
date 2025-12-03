/**
 * Event Card Design - MOBILE OPTIMIZED v9
 * RSVP status as card border color
 * Venue + city visible, generous spacing
 */

import { useState } from "react";
import { MapPin, Clock, ExternalLink, ChevronDown, Lock, ChevronRight, Users, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// WARM, INVITING PALETTE - less saturated for readability
const PARTY_COLORS = {
  hotPink: "#E91E8C",
  electricBlue: "#0099CC",
  sunshineYellow: "#F5A623",
  mintPop: "#00B377",
  lavenderDream: "#9B6FD9",
  coralPunch: "#E85A5A",
  tangerine: "#E87B35",
  limeZest: "#7CB518",
};

// Mock data
const mockEvents = [
  {
    id: "1",
    groupName: "Friday Dinner Club",
    emoji: "🍕",
    accentColor: PARTY_COLORS.coralPunch,
    venue: "Pizzeria Luna",
    address: "1847 E 1st St, Los Angeles, CA 90033",
    googleMapsUrl: "https://maps.google.com/?q=Pizzeria+Luna+Los+Angeles",
    time: "7:00 PM",
    dayOfWeek: "Friday",
    dateLabel: "Today",
    dateNum: "29",
    month: "NOV",
    rsvp: "going",
    isUrgent: true,
    attendees: {
      going: ["Sarah", "Mike", "Emma", "You"],
      maybe: ["Alex"],
      no: ["Jordan"],
      pending: ["Chris", "Taylor"],
    },
  },
  {
    id: "2",
    groupName: "Book Club",
    emoji: "📚",
    accentColor: PARTY_COLORS.lavenderDream,
    venue: "Café Stories",
    address: "2936 Sunset Blvd, Los Angeles, CA 90026",
    googleMapsUrl: "https://maps.google.com/?q=Cafe+Stories+Los+Angeles",
    time: "2:00 PM",
    dayOfWeek: "Saturday",
    dateLabel: "Tomorrow",
    dateNum: "30",
    month: "NOV",
    rsvp: "maybe",
    isUrgent: true,
    attendees: {
      going: ["Nina", "Ben"],
      maybe: ["You", "Lisa"],
      no: [],
      pending: ["Sam"],
    },
  },
  {
    id: "3",
    groupName: "Hiking Crew",
    emoji: "🥾",
    accentColor: PARTY_COLORS.mintPop,
    venue: "Runyon Canyon",
    address: "2000 N Fuller Ave, Los Angeles, CA 90046",
    googleMapsUrl: "https://maps.google.com/?q=Runyon+Canyon+Los+Angeles",
    time: "8:00 AM",
    dayOfWeek: "Sunday",
    dateLabel: "Dec 1",
    dateNum: "1",
    month: "DEC",
    rsvp: null,
    isUrgent: false,
    attendees: {
      going: ["Jake", "Maria", "Tom", "Anna", "Dave"],
      maybe: ["Lucy"],
      no: ["Pete"],
      pending: ["You"],
    },
  },
  {
    id: "4",
    groupName: "Wine Tasters",
    emoji: "🍷",
    accentColor: PARTY_COLORS.hotPink,
    venue: "The Wine Bar",
    address: "4212 W Sunset Blvd, Los Angeles, CA 90029",
    googleMapsUrl: "https://maps.google.com/?q=The+Wine+Bar+Los+Angeles",
    time: "6:30 PM",
    dayOfWeek: "Wednesday",
    dateLabel: "Dec 4",
    dateNum: "4",
    month: "DEC",
    rsvp: "going",
    isUrgent: false,
    attendees: {
      going: ["You", "Rachel", "Mark"],
      maybe: ["Sophie"],
      no: [],
      pending: ["Dan"],
    },
  },
  {
    id: "5",
    groupName: "Board Game Night",
    emoji: "🎲",
    accentColor: PARTY_COLORS.tangerine,
    venue: "Mike's Place",
    address: "1523 Griffith Park Blvd, Los Angeles, CA 90026",
    googleMapsUrl: "https://maps.google.com/?q=1523+Griffith+Park+Blvd+Los+Angeles",
    time: "7:30 PM",
    dayOfWeek: "Thursday",
    dateLabel: "Dec 5",
    dateNum: "5",
    month: "DEC",
    rsvp: "no",
    isUrgent: false,
    attendees: {
      going: ["Mike", "Kevin", "Jess", "Amy"],
      maybe: ["Robin"],
      no: ["You"],
      pending: [],
    },
  },
  {
    id: "6",
    groupName: "Yoga Class",
    emoji: "🧘",
    accentColor: PARTY_COLORS.mintPop,
    venue: "Zen Studio",
    address: "456 Serenity Lane",
    googleMapsUrl: "https://maps.google.com/?q=Zen+Studio",
    time: "9:00 AM",
    dayOfWeek: "Saturday",
    dateLabel: "Dec 7",
    dateNum: "7",
    month: "DEC",
    rsvp: "going",
    isUrgent: false,
    attendees: {
      going: ["You", "Amy", "Zen"],
      maybe: [],
      no: [],
      pending: ["Kate"],
    },
  },
];

// RSVP styling - cleaner, more readable
const getRsvpStyle = (rsvp: string | null) => {
  switch (rsvp) {
    case "going":
    case "yes":
      return { bg: "bg-emerald-500", text: "text-white", label: "Going", icon: "✓" };
    case "maybe":
      return { bg: "bg-amber-500", text: "text-white", label: "Maybe", icon: "?" };
    case "no":
      return { bg: "bg-stone-400", text: "text-white", label: "No", icon: "✕" };
    default:
      return { bg: "bg-stone-800", text: "text-white", label: "RSVP", icon: null };
  }
};

// Helper to get city from address
const getCityFromAddress = (address: string) => {
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[1].trim().split(' ')[0];
  }
  return '';
};

// RSVP Dropdown - Large, readable touch targets
function RsvpDropdown({
  currentRsvp,
  onRsvpChange,
  accentColor,
  size = "default"
}: {
  currentRsvp: string | null;
  onRsvpChange: (rsvp: string) => void;
  accentColor: string;
  size?: "default" | "large";
}) {
  const rsvp = getRsvpStyle(currentRsvp);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className={cn(
            "rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all",
            size === "large"
              ? "px-6 py-3 text-base min-w-[100px]"
              : "px-4 py-2.5 text-sm min-w-[80px] min-h-[44px]",
            rsvp.bg,
            rsvp.text
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {rsvp.icon && <span className="font-bold">{rsvp.icon}</span>}
          {rsvp.label}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-xl border-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-emerald-700 font-semibold text-base hover:bg-emerald-50 cursor-pointer"
          onClick={() => onRsvpChange("going")}
        >
          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">✓</span>
          I'm going!
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-amber-700 font-semibold text-base hover:bg-amber-50 cursor-pointer"
          onClick={() => onRsvpChange("maybe")}
        >
          <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">?</span>
          Maybe
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-3 py-4 px-4 rounded-xl text-stone-600 font-semibold text-base hover:bg-stone-100 cursor-pointer"
          onClick={() => onRsvpChange("no")}
        >
          <span className="w-8 h-8 rounded-full bg-stone-400 text-white flex items-center justify-center text-sm font-bold">✕</span>
          Can't make it
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// FEATURED CARD - RSVP border + generous layout
// ============================================
function FeaturedEventCard({ event }: { event: typeof mockEvents[0] }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;
  const city = getCityFromAddress(event.address);

  // Featured card uses thicker borders for emphasis
  const getFeaturedBorderStyle = () => {
    switch (currentRsvp) {
      case "going":
      case "yes":
        return "border-[3px] border-emerald-400 bg-gradient-to-br from-emerald-50 to-white";
      case "maybe":
        return "border-[3px] border-amber-400 bg-gradient-to-br from-amber-50 to-white";
      case "no":
        return "border-2 border-stone-200 bg-stone-50 opacity-70";
      default:
        return "border-[3px] border-stone-300 border-dashed bg-white";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl overflow-hidden shadow-sm transition-all",
        getFeaturedBorderStyle()
      )}
    >
      <div className="p-5">
        {/* Top row: UP NEXT badge + Large date display */}
        <div className="flex items-start justify-between mb-5">
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: event.accentColor }}
          >
            UP NEXT
          </span>
          <div className="text-right">
            <div className="text-3xl font-bold text-stone-800 leading-none">{event.dateNum}</div>
            <div className="text-sm font-semibold text-stone-500 uppercase">{event.month}</div>
            <div className="text-sm text-stone-500 mt-1">{event.dayOfWeek} · {event.time}</div>
          </div>
        </div>

        {/* Main content: Large emoji + Group name + Venue */}
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-sm"
            style={{ backgroundColor: `${event.accentColor}18` }}
          >
            {event.emoji}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="font-bold text-xl text-stone-800 leading-tight mb-2">{event.groupName}</h2>
            <a
              href={event.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: event.accentColor }} />
              <span className="text-base font-medium">{event.venue}</span>
              {city && (
                <>
                  <span className="text-stone-300">·</span>
                  <span className="text-sm text-stone-500">{city}</span>
                </>
              )}
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/60 my-4" />

        {/* Footer: Simple count + RSVP */}
        <div className="flex items-center justify-between">
          {hasRsvped ? (
            <span className="text-base text-stone-600">
              <span className="font-bold text-stone-800">{goingCount}</span> going
              {event.attendees.maybe.length > 0 && (
                <span className="text-amber-600 font-semibold"> · {event.attendees.maybe.length} maybe</span>
              )}
            </span>
          ) : (
            <span className="text-base text-stone-400">RSVP to see who's going</span>
          )}

          <RsvpDropdown
            currentRsvp={currentRsvp}
            onRsvpChange={setCurrentRsvp}
            accentColor={event.accentColor}
            size="large"
          />
        </div>
      </div>
    </motion.div>
  );
}


// Get border/outline style based on RSVP status
const getRsvpBorderStyle = (rsvp: string | null) => {
  switch (rsvp) {
    case "going":
    case "yes":
      return "border-2 border-emerald-400 bg-emerald-50/50";
    case "maybe":
      return "border-2 border-amber-400 bg-amber-50/30";
    case "no":
      return "border border-stone-200 bg-stone-50/50 opacity-60";
    default:
      return "border-2 border-stone-300 border-dashed bg-white";
  }
};

// ============================================
// SIMPLE CARD - Clean single-column layout
// Everything stacks vertically, nothing cramped
// ============================================
function SimpleEventCard({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl transition-all active:scale-[0.995]",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Main content area */}
      <div className="p-4">
        {/* Line 1: Group name with emoji */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-2xl">{event.emoji}</span>
          <h3 className="font-bold text-lg text-stone-800">{event.groupName}</h3>
        </div>

        {/* Line 2: When */}
        <p className="text-base text-stone-700 mb-2">
          <span className="font-semibold">{event.dateLabel}</span>
          <span className="text-stone-400"> · </span>
          {event.dayOfWeek} at {event.time}
        </p>

        {/* Line 3: Clickable venue + address */}
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-500 hover:text-stone-700 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1">
            <span className="text-sm group-hover:underline">{event.venue}</span>
            <span className="text-xs text-stone-400 block">{event.address}</span>
          </div>
          <ExternalLink className="h-3 w-3 mt-1 opacity-30 group-hover:opacity-60 flex-shrink-0" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 bg-stone-50 border-t border-stone-100"
        >
          <div className="space-y-2">
            {event.attendees.going.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Going ({event.attendees.going.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.going.join(", ")}</p>
              </div>
            )}
            {event.attendees.maybe.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Maybe ({event.attendees.maybe.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.maybe.join(", ")}</p>
              </div>
            )}
            {event.attendees.pending.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-stone-400 mb-1">Pending ({event.attendees.pending.length})</p>
                <p className="text-sm text-stone-500">{event.attendees.pending.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50/50 rounded-b-2xl border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1"
          >
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && (
              <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}

        <RsvpDropdown
          currentRsvp={currentRsvp}
          onRsvpChange={setCurrentRsvp}
          accentColor={event.accentColor}
        />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V1 - Group first with badge date style
// ============================================
function BoldCard({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;
  const isRelativeDate = event.dateLabel === "Today" || event.dateLabel === "Tomorrow";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.995]",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Colored header with emoji */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${event.accentColor}15` }}
      >
        <span className="text-3xl">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-stone-800">{event.groupName}</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-base font-medium text-stone-700">
            {event.dayOfWeek}, {event.time}
          </p>
          {isRelativeDate && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${event.accentColor}20`,
                color: event.accentColor
              }}
            >
              {event.dateLabel}
            </span>
          )}
        </div>
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-600 hover:text-stone-800 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium group-hover:underline">{event.venue}</p>
            <p className="text-xs text-stone-400">{event.address}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-40 group-hover:opacity-70 flex-shrink-0" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 bg-stone-50 border-t border-stone-100"
        >
          <div className="space-y-2">
            {event.attendees.going.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Going ({event.attendees.going.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.going.join(", ")}</p>
              </div>
            )}
            {event.attendees.maybe.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Maybe ({event.attendees.maybe.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.maybe.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1"
          >
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && (
              <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V1B - Date/time typography: Option A
// "Today" as tiny uppercase label above main time
// ============================================
function BoldCardDateFirst({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  // Check if it's a relative date (Today, Tomorrow) vs absolute (Dec 1)
  const isRelativeDate = event.dateLabel === "Today" || event.dateLabel === "Tomorrow";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.995]",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Colored header - clean date typography */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${event.accentColor}15` }}
      >
        <span className="text-2xl">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          {/* Tiny relative label if applicable */}
          {isRelativeDate && (
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
              style={{ color: event.accentColor }}
            >
              {event.dateLabel}
            </p>
          )}
          {/* Main: Day + Time */}
          <h3 className="font-bold text-lg text-stone-800">
            {event.dayOfWeek}, {event.time}
          </h3>
          <p className="text-sm text-stone-500">{event.groupName}</p>
        </div>
      </div>

      {/* Content - just venue */}
      <div className="p-4 bg-white">
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-600 hover:text-stone-800 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium group-hover:underline">{event.venue}</p>
            <p className="text-xs text-stone-400">{event.address}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-40 group-hover:opacity-70 flex-shrink-0" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 bg-stone-50 border-t border-stone-100"
        >
          <div className="space-y-2">
            {event.attendees.going.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Going ({event.attendees.going.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.going.join(", ")}</p>
              </div>
            )}
            {event.attendees.maybe.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Maybe ({event.attendees.maybe.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.maybe.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1"
          >
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && (
              <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V1C - Date first, tappable card, bottom sheet for attendees
// ============================================
function BoldCardDateBadge({
  event,
  index,
  onCardTap,
  onShowAttendees
}: {
  event: typeof mockEvents[0];
  index: number;
  onCardTap?: (eventId: string) => void;
  onShowAttendees?: (event: typeof mockEvents[0]) => void;
}) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  const isRelativeDate = event.dateLabel === "Today" || event.dateLabel === "Tomorrow";

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    onCardTap?.(event.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={handleCardClick}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.98] cursor-pointer",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Colored header - clean, no badge */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${event.accentColor}15` }}
      >
        <span className="text-2xl">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-stone-800">
            {event.dayOfWeek}, {event.time}
          </h3>
          <p className="text-sm text-stone-500">{event.groupName}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-stone-300 flex-shrink-0" />
      </div>

      {/* Content - just venue */}
      <div className="p-4 bg-white">
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-600 hover:text-stone-800 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium group-hover:underline">{event.venue}</p>
            <p className="text-xs text-stone-400">{event.address}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-40 group-hover:opacity-70 flex-shrink-0" />
        </a>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowAttendees?.(event);
            }}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1 min-h-[44px] -my-2"
          >
            <Users className="h-4 w-4 text-stone-400" />
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && (
              <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>
            )}
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// ATTENDEE BOTTOM SHEET (positioned within phone frame)
// ============================================
function AttendeeBottomSheet({
  event,
  isOpen,
  onClose
}: {
  event: typeof mockEvents[0] | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 z-40 transition-opacity rounded-[2rem]",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: isOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70%] overflow-hidden"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 flex items-center justify-between border-b border-stone-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{event.emoji}</span>
            <div>
              <h3 className="font-bold text-lg text-stone-800">{event.groupName}</h3>
              <p className="text-sm text-stone-500">{event.dayOfWeek}, {event.time}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors"
          >
            <X className="h-5 w-5 text-stone-500" />
          </button>
        </div>

        {/* Attendee lists */}
        <div className="px-5 py-4 overflow-y-auto max-h-[50vh] space-y-5">
          {/* Going */}
          {event.attendees.going.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-sm font-semibold text-stone-700">
                  Going ({event.attendees.going.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.attendees.going.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maybe */}
          {event.attendees.maybe.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-sm font-semibold text-stone-700">
                  Maybe ({event.attendees.maybe.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.attendees.maybe.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not going */}
          {event.attendees.no.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-stone-400" />
                <p className="text-sm font-semibold text-stone-700">
                  Can't make it ({event.attendees.no.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.attendees.no.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 bg-stone-100 text-stone-500 rounded-full text-sm font-medium"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {event.attendees.pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-stone-300 border border-dashed border-stone-400" />
                <p className="text-sm font-semibold text-stone-700">
                  Waiting for response ({event.attendees.pending.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.attendees.pending.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 bg-stone-50 text-stone-400 rounded-full text-sm font-medium border border-dashed border-stone-200"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Safe area padding for bottom */}
        <div className="h-8" />
      </motion.div>
    </>
  );
}

// ============================================
// BOLD V1D - Date/time typography: Option C
// No "Today/Tomorrow" - just clean day + time
// Relative date only on urgent items (subtle dot)
// ============================================
function BoldCardCleanTime({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.995]",
        getRsvpBorderStyle(currentRsvp)
      )}
    >
      {/* Colored header - super clean, no relative date */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${event.accentColor}15` }}
      >
        <span className="text-2xl">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-stone-800">
            {event.dayOfWeek}, {event.time}
          </h3>
          <p className="text-sm text-stone-500">{event.groupName}</p>
        </div>
        {/* Urgent dot for today/tomorrow */}
        {event.isUrgent && (
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: event.accentColor }}
          />
        )}
      </div>

      {/* Content - just venue */}
      <div className="p-4 bg-white">
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-600 hover:text-stone-800 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium group-hover:underline">{event.venue}</p>
            <p className="text-xs text-stone-400">{event.address}</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-40 group-hover:opacity-70 flex-shrink-0" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 bg-stone-50 border-t border-stone-100"
        >
          <div className="space-y-2">
            {event.attendees.going.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Going ({event.attendees.going.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.going.join(", ")}</p>
              </div>
            )}
            {event.attendees.maybe.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Maybe ({event.attendees.maybe.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.maybe.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1"
          >
            <span className="font-semibold text-stone-700">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && (
              <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V2 - Left accent bar + clean white
// ============================================
function BoldV2Card({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  const getRsvpAccent = () => {
    switch (currentRsvp) {
      case "going": case "yes": return "border-l-emerald-500 bg-emerald-50/30";
      case "maybe": return "border-l-amber-500 bg-amber-50/30";
      case "no": return "border-l-stone-300 bg-stone-50/50 opacity-60";
      default: return "border-l-stone-300 border-dashed";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-xl overflow-hidden border border-stone-200 border-l-4 bg-white transition-all active:scale-[0.995]",
        getRsvpAccent()
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-stone-100">
        <span className="text-2xl">{event.emoji}</span>
        <h3 className="font-bold text-base text-stone-800 flex-1">{event.groupName}</h3>
        <div
          className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ backgroundColor: `${event.accentColor}15`, color: event.accentColor }}
        >
          {event.dateLabel}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-sm text-stone-700 mb-2">
          <span className="font-medium">{event.dayOfWeek}</span> at {event.time}
        </p>
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-stone-500 hover:text-stone-700 hover:underline flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-3.5 w-3.5" style={{ color: event.accentColor }} />
          {event.venue} · {event.address.split(',')[1]?.trim()}
          <ExternalLink className="h-3 w-3 opacity-40" />
        </a>
      </div>

      {/* Attendees */}
      {showAttendees && hasRsvped && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs">
          {event.attendees.going.length > 0 && (
            <p><span className="font-semibold text-emerald-600">Going:</span> {event.attendees.going.join(", ")}</p>
          )}
          {event.attendees.maybe.length > 0 && (
            <p className="mt-1"><span className="font-semibold text-amber-600">Maybe:</span> {event.attendees.maybe.join(", ")}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50/80 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            {goingCount} going{event.attendees.maybe.length > 0 && ` · ${event.attendees.maybe.length} maybe`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-xs text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V3 - Full color top bar + shadow
// ============================================
function BoldV3Card({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden bg-white transition-all active:scale-[0.995]",
        currentRsvp === 'no' ? "opacity-50" : "shadow-md"
      )}
      style={{
        boxShadow: currentRsvp === 'going' ? `0 4px 12px ${event.accentColor}25` : undefined
      }}
    >
      {/* Solid color bar */}
      <div
        className="h-1.5"
        style={{ backgroundColor: event.accentColor }}
      />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <span className="text-2xl">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-stone-800">{event.groupName}</h3>
          <p className="text-xs text-stone-500">{event.dateLabel} · {event.dayOfWeek} at {event.time}</p>
        </div>
      </div>

      {/* Venue */}
      <a
        href={event.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors hover:bg-stone-50 group"
        style={{ backgroundColor: `${event.accentColor}08` }}
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: event.accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-700 group-hover:underline">{event.venue}</p>
          <p className="text-xs text-stone-400">{event.address}</p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500" />
      </a>

      {/* Attendees */}
      {showAttendees && hasRsvped && (
        <div className="mx-4 mb-3 p-3 bg-stone-50 rounded-lg text-xs space-y-1">
          {event.attendees.going.length > 0 && (
            <p><span className="font-semibold text-emerald-600">Going:</span> {event.attendees.going.join(", ")}</p>
          )}
          {event.attendees.maybe.length > 0 && (
            <p><span className="font-semibold text-amber-600">Maybe:</span> {event.attendees.maybe.join(", ")}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm text-stone-600 hover:text-stone-800 flex items-center gap-1"
          >
            <span className="font-semibold">{goingCount}</span> going
            {event.attendees.maybe.length > 0 && <span className="text-amber-600"> · {event.attendees.maybe.length} maybe</span>}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// BOLD V4 - Compact with inline date + floating badge
// ============================================
function BoldV4Card({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-2xl overflow-hidden transition-all active:scale-[0.995] border-2",
        currentRsvp === 'going' ? "border-emerald-400 bg-white" :
        currentRsvp === 'maybe' ? "border-amber-400 bg-white" :
        currentRsvp === 'no' ? "border-stone-200 bg-stone-50 opacity-60" :
        "border-stone-200 border-dashed bg-white"
      )}
    >
      {/* Header with date block */}
      <div className="flex items-stretch">
        {/* Date block */}
        <div
          className="w-16 flex flex-col items-center justify-center py-3"
          style={{ backgroundColor: `${event.accentColor}12` }}
        >
          <span className="text-2xl font-black" style={{ color: event.accentColor }}>{event.dateNum}</span>
          <span className="text-[10px] font-bold text-stone-500 uppercase">{event.month}</span>
        </div>

        {/* Title area */}
        <div className="flex-1 px-3 py-3 flex items-center gap-2">
          <span className="text-2xl">{event.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-stone-800">{event.groupName}</h3>
            <p className="text-xs text-stone-500">{event.dayOfWeek} at {event.time}</p>
          </div>
        </div>
      </div>

      {/* Venue */}
      <a
        href={event.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-4 py-2 border-t border-stone-100 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-medium">{event.venue}</span>
        <span className="text-stone-400"> · </span>
        <span className="text-stone-400">{event.address.split(',')[1]?.trim()}</span>
      </a>

      {/* Attendees */}
      {showAttendees && hasRsvped && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs space-y-1">
          {event.attendees.going.length > 0 && (
            <p><span className="font-semibold text-emerald-600">Going:</span> {event.attendees.going.join(", ")}</p>
          )}
          {event.attendees.maybe.length > 0 && (
            <p><span className="font-semibold text-amber-600">Maybe:</span> {event.attendees.maybe.join(", ")}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-100">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            {goingCount} going{event.attendees.maybe.length > 0 && ` · ${event.attendees.maybe.length} maybe`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-xs text-stone-400">RSVP to see who's coming</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// PLAYFUL CARD - Big date, bouncy emoji, fun colors
// ============================================
function PlayfulCard({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300 }}
      className={cn(
        "rounded-3xl overflow-hidden transition-all active:scale-[0.98]",
        getRsvpBorderStyle(currentRsvp)
      )}
      style={{
        boxShadow: currentRsvp === 'going' ? `0 4px 20px ${event.accentColor}30` : undefined
      }}
    >
      <div className="p-5">
        {/* Top: Big emoji + date */}
        <div className="flex items-start justify-between mb-3">
          <motion.span
            className="text-5xl"
            animate={{ rotate: [0, -3, 3, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            {event.emoji}
          </motion.span>
          <div className="text-right">
            <div
              className="text-3xl font-black leading-none"
              style={{ color: event.accentColor }}
            >
              {event.dateNum}
            </div>
            <div className="text-xs font-bold text-stone-500 uppercase">{event.month}</div>
          </div>
        </div>

        {/* Group name - big and bold */}
        <h3 className="font-extrabold text-xl text-stone-800 mb-2">{event.groupName}</h3>

        {/* When */}
        <p className="text-base text-stone-600 mb-2">
          {event.dayOfWeek} at {event.time}
        </p>

        {/* Where - clickable */}
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-stone-500 hover:text-stone-700 transition-colors group"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor }} />
          <div className="flex-1">
            <span className="text-sm font-medium group-hover:underline">{event.venue}</span>
            <span className="text-xs text-stone-400 block">{event.address}</span>
          </div>
          <ExternalLink className="h-3 w-3 mt-1 opacity-30 group-hover:opacity-60" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-5 py-3 bg-white border-t border-stone-100"
        >
          <div className="space-y-2">
            {event.attendees.going.length > 0 && (
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-1">Going ({event.attendees.going.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.going.join(", ")}</p>
              </div>
            )}
            {event.attendees.maybe.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 mb-1">Maybe ({event.attendees.maybe.length})</p>
                <p className="text-sm text-stone-600">{event.attendees.maybe.join(", ")}</p>
              </div>
            )}
            {event.attendees.pending.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-400 mb-1">Waiting ({event.attendees.pending.length})</p>
                <p className="text-sm text-stone-500">{event.attendees.pending.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Fun action bar */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: `${event.accentColor}08` }}
      >
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-sm font-medium text-stone-600 hover:text-stone-800 flex items-center gap-1"
          >
            {goingCount} going{event.attendees.maybe.length > 0 && ` · ${event.attendees.maybe.length} maybe`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-sm text-stone-400">Who's coming?</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// MINIMAL CARD - Ultra clean, typography focused
// ============================================
function MinimalCard({ event, index }: { event: typeof mockEvents[0]; index: number }) {
  const [currentRsvp, setCurrentRsvp] = useState(event.rsvp);
  const [showAttendees, setShowAttendees] = useState(false);
  const hasRsvped = currentRsvp !== null;
  const goingCount = event.attendees.going.length;

  const getBorderColor = () => {
    switch (currentRsvp) {
      case "going": case "yes": return "border-l-emerald-500";
      case "maybe": return "border-l-amber-500";
      case "no": return "border-l-stone-300";
      default: return "border-l-stone-200";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "bg-white rounded-xl border border-stone-100 border-l-4 transition-all overflow-hidden",
        getBorderColor(),
        currentRsvp === 'no' && "opacity-50"
      )}
    >
      <div className="p-4">
        {/* Single line: emoji + name + date badge */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{event.emoji}</span>
          <h3 className="font-semibold text-base text-stone-800 flex-1">{event.groupName}</h3>
          <span
            className="text-xs font-bold px-2 py-1 rounded"
            style={{ backgroundColor: `${event.accentColor}15`, color: event.accentColor }}
          >
            {event.dateLabel}
          </span>
        </div>

        {/* When */}
        <p className="text-sm text-stone-600 mb-1">
          {event.dayOfWeek} at {event.time}
        </p>

        {/* Where - clickable */}
        <a
          href={event.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-stone-500 hover:text-stone-700 hover:underline transition-colors flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {event.venue}, {event.address.split(',').slice(1).join(',').trim()}
          <ExternalLink className="h-3 w-3 opacity-40" />
        </a>
      </div>

      {/* Attendees popover */}
      {showAttendees && hasRsvped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-3 bg-stone-50 border-t border-stone-100"
        >
          <div className="space-y-1.5 text-xs">
            {event.attendees.going.length > 0 && (
              <p><span className="font-semibold text-emerald-600">Going:</span> {event.attendees.going.join(", ")}</p>
            )}
            {event.attendees.maybe.length > 0 && (
              <p><span className="font-semibold text-amber-600">Maybe:</span> {event.attendees.maybe.join(", ")}</p>
            )}
            {event.attendees.pending.length > 0 && (
              <p><span className="font-semibold text-stone-400">Pending:</span> {event.attendees.pending.join(", ")}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Inline action */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-50">
        {hasRsvped ? (
          <button
            onClick={() => setShowAttendees(!showAttendees)}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            {goingCount} going
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAttendees && "rotate-180")} />
          </button>
        ) : (
          <span className="text-xs text-stone-400">RSVP to see who's going</span>
        )}
        <RsvpDropdown currentRsvp={currentRsvp} onRsvpChange={setCurrentRsvp} accentColor={event.accentColor} />
      </div>
    </motion.div>
  );
}

// ============================================
// MOBILE PHONE FRAME - Realistic iPhone styling
// ============================================
function PhoneFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-semibold text-stone-500 mb-4 tracking-wide uppercase">{title}</p>
      <div
        className="relative bg-stone-900 rounded-[2.5rem] p-2.5 shadow-2xl"
        style={{ width: "375px" }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-8 bg-black rounded-full z-20" />

        {/* Screen */}
        <div className="bg-stone-50 rounded-[2rem] overflow-hidden" style={{ height: "750px" }}>
          {/* Status bar area */}
          <div className="h-14" />

          {/* Content */}
          <div className="h-[calc(100%-56px)] overflow-y-auto overscroll-contain">
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-stone-600 rounded-full" />
      </div>
    </div>
  );
}

// ============================================
// Interactive Phone Demo with Bottom Sheet
// ============================================
function InteractivePhoneDemo() {
  const [selectedEvent, setSelectedEvent] = useState<typeof mockEvents[0] | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

  const handleCardTap = (eventId: string) => {
    const event = mockEvents.find(e => e.id === eventId);
    setNavigatedTo(event?.groupName || null);
    // In real app: navigate to /events/{eventId}
    setTimeout(() => setNavigatedTo(null), 2000);
  };

  const handleShowAttendees = (event: typeof mockEvents[0]) => {
    setSelectedEvent(event);
    setShowSheet(true);
  };

  return (
    <div className="relative">
      <PhoneFrame title="Interactive Demo">
        <div className="bg-stone-50 min-h-full relative">
          <div className="px-5 pt-2 pb-4">
            <h1 className="text-2xl font-bold text-stone-800">Your Events</h1>
            <p className="text-sm text-stone-500 mt-1">6 upcoming</p>
          </div>
          <div className="px-4 pb-8 space-y-3">
            {mockEvents.map((event, i) => (
              <BoldCardDateBadge
                key={event.id}
                event={event}
                index={i}
                onCardTap={handleCardTap}
                onShowAttendees={handleShowAttendees}
              />
            ))}
          </div>

          {/* Navigation toast */}
          {navigatedTo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-4 left-4 right-4 bg-stone-800 text-white px-4 py-3 rounded-xl text-sm font-medium text-center shadow-lg"
            >
              → Navigating to {navigatedTo} details...
            </motion.div>
          )}

          {/* Bottom sheet (inside phone frame) */}
          <AttendeeBottomSheet
            event={selectedEvent}
            isOpen={showSheet}
            onClose={() => setShowSheet(false)}
          />
        </div>
      </PhoneFrame>
    </div>
  );
}

// ============================================
// Main Page - Bold Variations
// ============================================
export default function PrototypeEventCards() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 to-stone-200 py-12">
      {/* Header */}
      <div className="text-center mb-10 px-4">
        <h1 className="text-3xl font-bold text-stone-800 tracking-tight">
          Event Card - Final Design
        </h1>
        <p className="text-stone-500 mt-2 text-lg">
          Tap card to navigate, tap attendees for bottom sheet
        </p>
      </div>

      {/* Interactive demo */}
      <div className="flex justify-center px-4">
        <InteractivePhoneDemo />
      </div>

      {/* Design notes */}
      <div className="max-w-4xl mx-auto mt-14 px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200">
          <h2 className="font-bold text-xl text-stone-800 mb-6">Interaction Design</h2>

          {/* Try it */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="font-semibold text-blue-800 mb-2">Try the Demo</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Tap the card</strong> → navigates to event details</li>
              <li>• <strong>Tap "X going"</strong> → opens attendee bottom sheet</li>
              <li>• <strong>Tap venue</strong> → opens Google Maps (external link)</li>
              <li>• <strong>Tap RSVP button</strong> → change your response</li>
            </ul>
          </div>

          {/* Tap zones */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-stone-50">
              <h3 className="font-bold text-stone-800 mb-2">Tap Zones</h3>
              <p className="text-sm text-stone-600">
                Card body → Event details page<br/>
                Venue row → Google Maps<br/>
                "X going" → Attendee sheet<br/>
                RSVP button → Dropdown menu
              </p>
            </div>
            <div className="p-4 rounded-xl bg-stone-50">
              <h3 className="font-bold text-stone-800 mb-2">Bottom Sheet</h3>
              <p className="text-sm text-stone-600">
                Shows all attendees grouped by status<br/>
                Tap backdrop or X to close<br/>
                Spring animation for natural feel<br/>
                Max 70% screen height, scrollable
              </p>
            </div>
          </div>

          {/* RSVP Legend */}
          <div className="mb-8 p-4 bg-stone-50 rounded-xl">
            <p className="font-semibold text-stone-700 mb-3">RSVP Status Indicators</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-emerald-400 bg-emerald-50" />
                <span className="text-sm text-stone-600">Going</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-amber-400 bg-amber-50" />
                <span className="text-sm text-stone-600">Maybe</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-stone-200 bg-stone-100 opacity-60" />
                <span className="text-sm text-stone-600">Not going</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-dashed border-stone-300 bg-white" />
                <span className="text-sm text-stone-600">No response</span>
              </div>
            </div>
          </div>

          {/* All features */}
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="font-semibold text-emerald-800 mb-2">All Versions Include</p>
            <ul className="text-sm text-emerald-700 space-y-1">
              <li>• Clickable venue → opens Google Maps</li>
              <li>• Full address visible</li>
              <li>• Tap "X going" → see attendee names</li>
              <li>• RSVP dropdown to change your response</li>
              <li>• Declined events faded to 60% opacity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
