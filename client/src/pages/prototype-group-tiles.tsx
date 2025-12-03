import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, MapPin, Calendar, ChevronRight, ChevronDown, Plus, Pencil, Trash2, FolderOpen, Check, HelpCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Mock data - including a light yellow to test contrast
const mockGroups = [
  {
    id: "1",
    name: "Wine & Dine Club",
    emoji: "🍷",
    accentColor: "#9B2335",
    location: "San Francisco",
    frequency: "Monthly",
    budget: "$40-80",
    members: [
      { name: "Sarah Mitchell", initial: "SM" },
      { name: "James Kim", initial: "JK" },
      { name: "Priya Sharma", initial: "PS" },
      { name: "Marcus Lee", initial: "ML" },
      { name: "Elena Volkov", initial: "EV" },
    ],
    nextEvent: "Dec 14",
  },
  {
    id: "2",
    name: "Brunch Squad",
    emoji: "🥞",
    accentColor: "#E8A030", // Bright yellow/gold - testing contrast
    location: "Oakland",
    frequency: "Bi-weekly",
    budget: "$20-40",
    members: [
      { name: "Alex Torres", initial: "AT" },
      { name: "Jordan Wu", initial: "JW" },
      { name: "Casey Nguyen", initial: "CN" },
    ],
    nextEvent: "Dec 8",
  },
  {
    id: "3",
    name: "Adventure Crew",
    emoji: "🏔️",
    accentColor: "#2D8B7A",
    location: "Bay Area",
    frequency: "Monthly",
    budget: "$30-100",
    members: [
      { name: "Mike Stevens", initial: "MS" },
      { name: "Lisa Park", initial: "LP" },
      { name: "David Klein", initial: "DK" },
      { name: "Nina Foster", initial: "NF" },
      { name: "Tom Bradley", initial: "TB" },
      { name: "Amy Chen", initial: "AC" },
    ],
    nextEvent: null,
  },
  {
    id: "4",
    name: "Book & Bites",
    emoji: "📚",
    accentColor: "#6B5B6E",
    location: "Berkeley",
    frequency: "Monthly",
    budget: "$15-30",
    members: [
      { name: "Rachel Green", initial: "RG" },
      { name: "Chris Harper", initial: "CH" },
      { name: "Sophie Martin", initial: "SM" },
      { name: "Ben Walsh", initial: "BW" },
    ],
    nextEvent: "Dec 20",
  },
];

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenColor(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  r = Math.min(255, Math.floor(r + (255 - r) * percent));
  g = Math.min(255, Math.floor(g + (255 - g) * percent));
  b = Math.min(255, Math.floor(b + (255 - b) * percent));

  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  r = Math.max(0, Math.floor(r * (1 - percent)));
  g = Math.max(0, Math.floor(g * (1 - percent)));
  b = Math.max(0, Math.floor(b * (1 - percent)));

  return `rgb(${r}, ${g}, ${b})`;
}

// Calculate if a color is "light" (needs darker text)
function isLightColor(hex: string): boolean {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// Get contrasting text color - darker for light accents
function getTextColor(accentColor: string, opacity: number = 1): string {
  if (isLightColor(accentColor)) {
    // For light colors like yellow, use a darkened version
    const darkened = darkenColor(accentColor, 0.55);
    return opacity < 1 ? hexToRgba(darkenColor(accentColor, 0.45), opacity) : darkened;
  }
  return hexToRgba(accentColor, opacity);
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

// ===========================================
// SPLIT V1: Tight & Efficient
// Removes wasted space, members in horizontal strip
// ===========================================
function SplitTightCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.7);
  const textColorSubtle = getTextColor(group.accentColor, 0.5);

  return (
    <div
      className="relative rounded-2xl overflow-hidden active:scale-[0.985] transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, ${lightenColor(group.accentColor, 0.88)} 0%, ${lightenColor(group.accentColor, 0.93)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(group.accentColor, 0.25)}`,
      }}
    >
      <div className="flex">
        {/* Left: Core Info - Compact */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.85)',
                boxShadow: `0 2px 6px ${hexToRgba(group.accentColor, 0.15)}`
              }}
            >
              {group.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-bold text-base truncate leading-tight"
                style={{ color: textColor }}
              >
                {group.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: textColorMuted }}>
                <span>{group.frequency}</span>
                <span style={{ color: textColorSubtle }}>·</span>
                <MapPin className="h-3 w-3" />
                <span className="truncate">{group.location}</span>
              </div>
            </div>
          </div>

          {/* Next Event - inline */}
          {group.nextEvent ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(255,255,255,0.75)',
                color: textColor
              }}
            >
              <Calendar className="h-3 w-3" />
              {group.nextEvent}
            </div>
          ) : (
            <div
              className="inline-flex text-xs px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.4)',
                color: textColorSubtle
              }}
            >
              No event scheduled
            </div>
          )}
        </div>

        {/* Right: Members - Vertical Stack */}
        <div
          className="w-24 flex flex-col justify-center py-2 px-2 gap-0.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          {group.members.slice(0, 4).map((member, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-1">
              <Avatar className="h-5 w-5 border border-white/60 flex-shrink-0">
                <AvatarFallback
                  className="text-[8px] font-bold"
                  style={{ backgroundColor: 'white', color: textColor }}
                >
                  {member.initial.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span
                className="text-[11px] font-medium truncate"
                style={{ color: textColor }}
              >
                {getFirstName(member.name)}
              </span>
            </div>
          ))}
          {group.members.length > 4 && (
            <span
              className="text-[10px] font-medium px-1 mt-0.5"
              style={{ color: textColorMuted }}
            >
              +{group.members.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================
// SPLIT V2: Bottom Members Strip
// Members as horizontal row at bottom
// ===========================================
function SplitBottomStripCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.7);
  const textColorSubtle = getTextColor(group.accentColor, 0.5);

  return (
    <div
      className="relative rounded-2xl overflow-hidden active:scale-[0.985] transition-all duration-200"
      style={{
        background: `linear-gradient(145deg, ${lightenColor(group.accentColor, 0.87)} 0%, ${lightenColor(group.accentColor, 0.92)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(group.accentColor, 0.25)}`,
      }}
    >
      {/* Top: Group Info */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              backgroundColor: 'rgba(255,255,255,0.85)',
              boxShadow: `0 2px 8px ${hexToRgba(group.accentColor, 0.12)}`
            }}
          >
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-lg truncate leading-tight"
              style={{ color: textColor }}
            >
              {group.name}
            </h3>
            <div className="flex items-center gap-2 text-xs" style={{ color: textColorMuted }}>
              <span>{group.frequency}</span>
              <span style={{ color: textColorSubtle }}>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {group.location}
              </span>
            </div>
          </div>
          {group.nextEvent && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: textColor
              }}
            >
              <Calendar className="h-3 w-3" />
              {group.nextEvent}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Member Strip */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
      >
        {group.members.slice(0, 5).map((member, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <Avatar className="h-6 w-6 border-2 border-white/70 flex-shrink-0">
              <AvatarFallback
                className="text-[9px] font-bold"
                style={{ backgroundColor: 'white', color: textColor }}
              >
                {member.initial.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span
              className="text-[11px] font-medium"
              style={{ color: textColor }}
            >
              {getFirstName(member.name)}
            </span>
          </div>
        ))}
        {group.members.length > 5 && (
          <span
            className="text-[11px] font-medium ml-auto"
            style={{ color: textColorMuted }}
          >
            +{group.members.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}

// ===========================================
// SPLIT V3: Asymmetric - Large left, tight right
// More dramatic split with emoji as hero
// ===========================================
function SplitAsymmetricCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.7);
  const textColorSubtle = getTextColor(group.accentColor, 0.5);

  return (
    <div
      className="relative rounded-2xl overflow-hidden active:scale-[0.985] transition-all duration-200 flex"
      style={{
        background: lightenColor(group.accentColor, 0.9),
        boxShadow: `0 4px 18px -6px ${hexToRgba(group.accentColor, 0.22)}`,
      }}
    >
      {/* Left: Large emoji + name */}
      <div
        className="w-20 flex flex-col items-center justify-center py-3 px-2"
        style={{
          background: `linear-gradient(180deg, ${lightenColor(group.accentColor, 0.82)} 0%, ${lightenColor(group.accentColor, 0.88)} 100%)`,
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl mb-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            boxShadow: `0 3px 10px ${hexToRgba(group.accentColor, 0.2)}`
          }}
        >
          {group.emoji}
        </div>
        {group.nextEvent && (
          <div
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(255,255,255,0.8)',
              color: textColor
            }}
          >
            {group.nextEvent}
          </div>
        )}
      </div>

      {/* Right: Name + Members */}
      <div className="flex-1 py-2.5 pr-3 pl-2 flex flex-col justify-center min-w-0">
        <h3
          className="font-bold text-base truncate leading-tight mb-0.5"
          style={{ color: textColor }}
        >
          {group.name}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] mb-2" style={{ color: textColorMuted }}>
          <span>{group.frequency}</span>
          <span style={{ color: textColorSubtle }}>·</span>
          <MapPin className="h-3 w-3" />
          <span className="truncate">{group.location}</span>
        </div>

        {/* Inline member list */}
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {group.members.slice(0, 4).map((member, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Avatar className="h-5 w-5 border border-white/50">
                <AvatarFallback
                  className="text-[8px] font-bold"
                  style={{ backgroundColor: 'white', color: textColor }}
                >
                  {member.initial.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium" style={{ color: textColor }}>
                {getFirstName(member.name)}
              </span>
            </div>
          ))}
          {group.members.length > 4 && (
            <span className="text-[11px]" style={{ color: textColorMuted }}>
              +{group.members.length - 4}
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5"
        style={{ color: textColorSubtle }}
      />
    </div>
  );
}

// ===========================================
// SPLIT V4: Card with accent sidebar
// Clean white card with colored accent edge
// ===========================================
function SplitAccentEdgeCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.75);

  return (
    <div
      className="relative rounded-2xl overflow-hidden active:scale-[0.985] transition-all duration-200 flex bg-white"
      style={{
        boxShadow: `0 2px 12px -4px ${hexToRgba(group.accentColor, 0.2)}, 0 4px 20px -8px rgba(0,0,0,0.08)`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="w-1.5 flex-shrink-0"
        style={{ backgroundColor: group.accentColor }}
      />

      {/* Main content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              backgroundColor: lightenColor(group.accentColor, 0.9),
            }}
          >
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-base truncate text-gray-900">
                {group.name}
              </h3>
              {group.nextEvent && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: lightenColor(group.accentColor, 0.85),
                    color: textColor
                  }}
                >
                  {group.nextEvent}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>{group.frequency}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {group.location}
              </span>
            </div>

            {/* Member chips */}
            <div className="flex flex-wrap gap-1">
              {group.members.slice(0, 4).map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: lightenColor(group.accentColor, 0.92) }}
                >
                  <Avatar className="h-4 w-4">
                    <AvatarFallback
                      className="text-[7px] font-bold"
                      style={{ backgroundColor: 'white', color: textColor }}
                    >
                      {member.initial.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium" style={{ color: textColor }}>
                    {getFirstName(member.name)}
                  </span>
                </div>
              ))}
              {group.members.length > 4 && (
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5"
                  style={{ color: textColorMuted }}
                >
                  +{group.members.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
    </div>
  );
}

// ===========================================
// SPLIT V5: Two-tone horizontal
// Gradient left fading to white right
// ===========================================
function SplitTwoToneCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.7);

  return (
    <div
      className="relative rounded-2xl overflow-hidden active:scale-[0.985] transition-all duration-200"
      style={{
        background: `linear-gradient(90deg, ${lightenColor(group.accentColor, 0.85)} 0%, ${lightenColor(group.accentColor, 0.85)} 35%, white 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(group.accentColor, 0.22)}`,
      }}
    >
      <div className="flex items-stretch">
        {/* Left: Emoji + Group name */}
        <div className="py-3 pl-3 pr-4 flex items-center gap-3 min-w-0" style={{ flex: '1.2' }}>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              boxShadow: `0 2px 8px ${hexToRgba(group.accentColor, 0.15)}`
            }}
          >
            {group.emoji}
          </div>
          <div className="min-w-0">
            <h3
              className="font-bold text-base truncate leading-tight"
              style={{ color: textColor }}
            >
              {group.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: textColorMuted }}>
              <span>{group.frequency}</span>
              <span>·</span>
              <MapPin className="h-3 w-3" />
              <span className="truncate">{group.location}</span>
            </div>
            {group.nextEvent && (
              <div
                className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  color: textColor
                }}
              >
                <Calendar className="h-3 w-3" />
                {group.nextEvent}
              </div>
            )}
          </div>
        </div>

        {/* Right: Members on white */}
        <div className="py-2 pr-3 pl-2 flex flex-col justify-center gap-0.5" style={{ flex: '0.8' }}>
          {group.members.slice(0, 4).map((member, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5 border border-gray-100 flex-shrink-0">
                <AvatarFallback
                  className="text-[8px] font-bold"
                  style={{ backgroundColor: lightenColor(group.accentColor, 0.9), color: textColor }}
                >
                  {member.initial.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium text-gray-700 truncate">
                {getFirstName(member.name)}
              </span>
            </div>
          ))}
          {group.members.length > 4 && (
            <span className="text-[10px] text-gray-400 ml-6">
              +{group.members.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================
// SPLIT V6: Stacked Compact
// Most space-efficient, all info visible
// ===========================================
function SplitStackedCard({ group }: { group: typeof mockGroups[0] }) {
  const textColor = getTextColor(group.accentColor);
  const textColorMuted = getTextColor(group.accentColor, 0.7);
  const textColorSubtle = getTextColor(group.accentColor, 0.5);

  return (
    <div
      className="relative rounded-xl overflow-hidden active:scale-[0.985] transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, ${lightenColor(group.accentColor, 0.88)} 0%, ${lightenColor(group.accentColor, 0.93)} 100%)`,
        boxShadow: `0 3px 14px -5px ${hexToRgba(group.accentColor, 0.25)}`,
      }}
    >
      <div className="p-3">
        {/* Row 1: Emoji + Name + Date */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
            style={{
              backgroundColor: 'rgba(255,255,255,0.85)',
              boxShadow: `0 1px 4px ${hexToRgba(group.accentColor, 0.12)}`
            }}
          >
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-[15px] truncate leading-tight"
              style={{ color: textColor }}
            >
              {group.name}
            </h3>
          </div>
          {group.nextEvent ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold flex-shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.75)',
                color: textColor
              }}
            >
              <Calendar className="h-3 w-3" />
              {group.nextEvent}
            </div>
          ) : (
            <div
              className="px-2 py-1 rounded-md text-[10px] flex-shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.4)',
                color: textColorSubtle
              }}
            >
              No event
            </div>
          )}
        </div>

        {/* Row 2: Meta + Members inline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: textColorMuted }}>
            <span>{group.frequency}</span>
            <span style={{ color: textColorSubtle }}>·</span>
            <MapPin className="h-3 w-3" />
            <span>{group.location}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex -space-x-1.5">
              {group.members.slice(0, 4).map((member, idx) => (
                <Avatar key={idx} className="h-5 w-5 border-2 ring-0" style={{ borderColor: lightenColor(group.accentColor, 0.88) }}>
                  <AvatarFallback
                    className="text-[8px] font-bold"
                    style={{ backgroundColor: 'white', color: textColor }}
                  >
                    {member.initial.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-[10px] ml-1" style={{ color: textColorMuted }}>
              {group.members.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// COLLECTION CONTAINER MOCKUPS
// ===========================================

// Collection 1: Current (Problem) - Heavy borders and padding
function CollectionCurrent({ name, groups, isOpen, onToggle }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="border border-border/50 rounded-2xl p-5 bg-gradient-to-br from-card to-muted/20 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-3">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h3 className="text-lg font-semibold">{name}</h3>
            <span className="text-sm text-muted-foreground">({groups.length})</span>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="space-y-3">
            {groups.map((group) => (
              <SplitBottomStripCard key={group.id} group={group} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Collection 2: Minimal Header - Just a thin divider with label
function CollectionMinimalHeader({ name, groups, isOpen, onToggle }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center gap-3 w-full py-2 group">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-foreground">{name}</span>
          <span className="text-sm text-muted-foreground">({groups.length})</span>
        </div>
        <div className="flex-1 h-px bg-border/50" />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pt-2">
          {groups.map((group) => (
            <SplitBottomStripCard key={group.id} group={group} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Collection 3: Pill Label - Compact floating label
function CollectionPillLabel({ name, groups, isOpen, onToggle }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center gap-2 mb-2 group">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted transition-colors">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded-full">{groups.length}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3">
          {groups.map((group) => (
            <SplitBottomStripCard key={group.id} group={group} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Collection 4: Left Accent Bar - Vertical colored bar
function CollectionAccentBar({ name, groups, isOpen, onToggle, accentColor = "#6366f1" }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
  accentColor?: string;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="flex">
        {/* Accent bar */}
        <div
          className="w-1 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 mb-2">
            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-semibold">{name}</span>
            <span className="text-sm text-muted-foreground">({groups.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3">
              {groups.map((group) => (
                <SplitBottomStripCard key={group.id} group={group} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}

// Collection 5: Inline Badge - Super minimal, just text
function CollectionInlineBadge({ name, groups, isOpen, onToggle }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center w-full mb-3">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{name}</span>
        </div>
        <div className="flex-1 border-b border-dashed border-border/40 mx-3" />
        <span className="text-xs text-muted-foreground">{groups.length} groups</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3">
          {groups.map((group) => (
            <SplitBottomStripCard key={group.id} group={group} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Collection 6: Card Stack Preview - Shows stacked previews when collapsed
function CollectionStackPreview({ name, groups, isOpen, onToggle }: {
  name: string;
  groups: typeof mockGroups;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const previewColors = groups.slice(0, 3).map(g => g.accentColor);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 py-2">
          {/* Stacked color preview */}
          <div className="relative w-8 h-8 flex-shrink-0">
            {previewColors.map((color, idx) => (
              <div
                key={idx}
                className="absolute w-6 h-6 rounded-lg border-2 border-background"
                style={{
                  backgroundColor: lightenColor(color, 0.7),
                  left: idx * 4,
                  top: idx * 2,
                  zIndex: 3 - idx,
                }}
              />
            ))}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{name}</span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">{groups.length}</span>
            </div>
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 pt-1">
          {groups.map((group) => (
            <SplitBottomStripCard key={group.id} group={group} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ===========================================
// MOCK EVENT DATA
// ===========================================

const mockEvents = [
  {
    id: "1",
    groupName: "Wine & Dine Club",
    groupEmoji: "🍷",
    accentColor: "#9B2335",
    eventDate: "Dec 14, 2024",
    eventTime: "6:30 PM",
    eventDay: "Saturday",
    venueName: "The Wine Bar",
    venueAddress: "123 Main St",
    hostName: "Sarah M.",
    rsvpStatus: "going" as const,
  },
  {
    id: "2",
    groupName: "Brunch Squad",
    groupEmoji: "🥞",
    accentColor: "#E8A030",
    eventDate: "Dec 8, 2024",
    eventTime: "10:00 AM",
    eventDay: "Sunday",
    venueName: "Sunny Side Cafe",
    venueAddress: "456 Oak Ave",
    hostName: "Alex T.",
    rsvpStatus: "maybe" as const,
  },
  {
    id: "3",
    groupName: "Adventure Crew",
    groupEmoji: "🏔️",
    accentColor: "#2D8B7A",
    eventDate: "Dec 21, 2024",
    eventTime: "9:00 AM",
    eventDay: "Saturday",
    venueName: "Hiking Trailhead",
    venueAddress: "789 Mountain Rd",
    hostName: "Mike S.",
    rsvpStatus: null,
  },
  {
    id: "4",
    groupName: "Book & Bites",
    groupEmoji: "📚",
    accentColor: "#6B5B6E",
    eventDate: "Dec 20, 2024",
    eventTime: "7:00 PM",
    eventDay: "Friday",
    venueName: "Cozy Corner Books",
    venueAddress: "321 Library Lane",
    hostName: "Rachel G.",
    rsvpStatus: "no" as const,
  },
];

type RsvpStatus = "going" | "maybe" | "no" | null;

// ===========================================
// EVENT CARD RSVP MOCKUPS
// ===========================================

// Helper to get RSVP display info
function getRsvpInfo(status: RsvpStatus) {
  switch (status) {
    case "going":
      return { label: "Going", color: "#22c55e", bgColor: "rgba(34, 197, 94, 0.15)" };
    case "maybe":
      return { label: "Maybe", color: "#eab308", bgColor: "rgba(234, 179, 8, 0.15)" };
    case "no":
      return { label: "Can't go", color: "#94a3b8", bgColor: "rgba(148, 163, 184, 0.15)" };
    default:
      return { label: "RSVP", color: "#6b7280", bgColor: "rgba(107, 114, 128, 0.1)" };
  }
}

// Option A: Bottom Strip Dropdown
function EventCardDropdown({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
      }}
    >
      {/* Main card area - tappable for navigation */}
      <div className="p-3.5">
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
          >
            {event.groupEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
              {event.groupName}
            </h3>
            <div className="text-xs" style={{ color: textColorMuted }}>
              {event.eventTime} · {event.eventDay}
            </div>
          </div>
          <div
            className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
              {event.eventDate.split(' ')[0]}
            </span>
            <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
              {event.eventDate.split(' ')[1].replace(',', '')}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
          <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
        </div>
      </div>

      {/* Bottom strip - RSVP dropdown */}
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2"
        style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: rsvpInfo.color }}
              />
              <span className="text-xs font-medium" style={{ color: textColor }}>
                {rsvpInfo.label}
              </span>
              <span className="text-xs" style={{ color: textColorMuted }}>▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onRsvpChange("going")} className={rsvpStatus === "going" ? "bg-muted" : ""}>
              <Check className="h-4 w-4 mr-2 text-green-600" />
              Going {rsvpStatus === "going" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRsvpChange("maybe")} className={rsvpStatus === "maybe" ? "bg-muted" : ""}>
              <HelpCircle className="h-4 w-4 mr-2 text-yellow-600" />
              Maybe {rsvpStatus === "maybe" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRsvpChange("no")} className={rsvpStatus === "no" ? "bg-muted" : ""}>
              <X className="h-4 w-4 mr-2 text-gray-500" />
              Can't go {rsvpStatus === "no" && "✓"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="text-xs" style={{ color: textColorMuted }}>
          Host: {event.hostName}
        </div>
      </div>
    </div>
  );
}

// Option B: Separate Button Row
function EventCardButtonRow({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  const handleRsvp = (status: RsvpStatus) => {
    onRsvpChange(status);
    setIsExpanded(false); // Collapse after selection
  };

  return (
    <div className="space-y-2">
      {/* Main card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
          boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
        }}
      >
        <div className="p-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
            >
              {event.groupEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
                {event.groupName}
              </h3>
              <div className="text-xs" style={{ color: textColorMuted }}>
                {event.eventTime} · {event.eventDay}
              </div>
            </div>
            <div
              className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
                {event.eventDate.split(' ')[0]}
              </span>
              <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
                {event.eventDate.split(' ')[1].replace(',', '')}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
            <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
          </div>
        </div>
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rsvpInfo.color }} />
            <span className="text-xs font-medium" style={{ color: textColor }}>{rsvpInfo.label}</span>
          </div>
          <div className="text-xs" style={{ color: textColorMuted }}>Host: {event.hostName}</div>
        </div>
      </div>

      {/* Collapsible RSVP button row */}
      {isExpanded ? (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <button
            onClick={() => handleRsvp("going")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              rsvpStatus === "going"
                ? "bg-green-500 text-white shadow-md"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Going
          </button>
          <button
            onClick={() => handleRsvp("maybe")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              rsvpStatus === "maybe"
                ? "bg-yellow-500 text-white shadow-md"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Maybe
          </button>
          <button
            onClick={() => handleRsvp("no")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              rsvpStatus === "no"
                ? "bg-gray-500 text-white shadow-md"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <X className="h-3.5 w-3.5" />
            Can't
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-muted/40 text-muted-foreground hover:bg-muted transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-muted/60 text-muted-foreground hover:bg-muted transition-all"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {rsvpStatus ? "Change RSVP" : "RSVP"}
        </button>
      )}
    </div>
  );
}

// Option C: Segmented Control
function EventCardSegmented({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
      }}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
          >
            {event.groupEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
              {event.groupName}
            </h3>
            <div className="text-xs" style={{ color: textColorMuted }}>
              {event.eventTime} · {event.eventDay}
            </div>
          </div>
          <div
            className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
              {event.eventDate.split(' ')[0]}
            </span>
            <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
              {event.eventDate.split(' ')[1].replace(',', '')}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
          <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
        </div>
      </div>

      {/* Segmented control in bottom strip */}
      <div
        className="px-3 py-2.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
      >
        <div className="flex gap-1.5 p-1 rounded-xl bg-white/60">
          <button
            onClick={() => onRsvpChange("going")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              rsvpStatus === "going"
                ? "bg-green-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-white/80"
            }`}
          >
            <Check className="h-3 w-3" />
            Going
          </button>
          <button
            onClick={() => onRsvpChange("maybe")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              rsvpStatus === "maybe"
                ? "bg-yellow-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-white/80"
            }`}
          >
            <HelpCircle className="h-3 w-3" />
            Maybe
          </button>
          <button
            onClick={() => onRsvpChange("no")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              rsvpStatus === "no"
                ? "bg-gray-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-white/80"
            }`}
          >
            <X className="h-3 w-3" />
            Can't
          </button>
        </div>
      </div>
    </div>
  );
}

// Option D: Floating Quick Action (FAB style)
function EventCardFloatingAction({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);
  const [showOptions, setShowOptions] = useState(false);

  const cycleRsvp = () => {
    if (!rsvpStatus) onRsvpChange("going");
    else if (rsvpStatus === "going") onRsvpChange("maybe");
    else if (rsvpStatus === "maybe") onRsvpChange("no");
    else onRsvpChange("going");
  };

  return (
    <div className="relative">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
          boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
        }}
      >
        <div className="p-3.5 pr-16">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
            >
              {event.groupEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
                {event.groupName}
              </h3>
              <div className="text-xs" style={{ color: textColorMuted }}>
                {event.eventTime} · {event.eventDay} · {event.eventDate}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
            <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-3.5 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rsvpInfo.color }} />
            <span className="text-xs font-medium" style={{ color: textColor }}>{rsvpInfo.label}</span>
          </div>
          <div className="text-xs" style={{ color: textColorMuted }}>Host: {event.hostName}</div>
        </div>
      </div>

      {/* Floating action button */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        {showOptions ? (
          <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
            <button
              onClick={() => { onRsvpChange("going"); setShowOptions(false); }}
              className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={() => { onRsvpChange("maybe"); setShowOptions(false); }}
              className="w-10 h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => { onRsvpChange("no"); setShowOptions(false); }}
              className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowOptions(true)}
            onDoubleClick={cycleRsvp}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: rsvpInfo.color }}
          >
            {rsvpStatus === "going" ? <Check className="h-6 w-6 text-white" /> :
             rsvpStatus === "maybe" ? <HelpCircle className="h-6 w-6 text-white" /> :
             rsvpStatus === "no" ? <X className="h-6 w-6 text-white" /> :
             <Sparkles className="h-6 w-6 text-white" />}
          </button>
        )}
      </div>
    </div>
  );
}

// Option E: Swipe Actions (simulated with buttons for demo)
function EventCardSwipe({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);
  const [swiped, setSwiped] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe reveal layer */}
      <div
        className={`absolute inset-y-0 right-0 flex transition-all duration-300 ${swiped ? 'w-28' : 'w-0'}`}
        style={{ backgroundColor: lightenColor(event.accentColor, 0.6) }}
      >
        <button
          onClick={() => { onRsvpChange("going"); setSwiped(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-white hover:bg-green-500/30 transition-colors"
        >
          <Check className="h-5 w-5" />
          <span className="text-[10px] font-medium">Going</span>
        </button>
        <button
          onClick={() => { onRsvpChange("maybe"); setSwiped(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-white hover:bg-yellow-500/30 transition-colors"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="text-[10px] font-medium">Maybe</span>
        </button>
        <button
          onClick={() => { onRsvpChange("no"); setSwiped(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-white hover:bg-gray-500/30 transition-colors"
        >
          <X className="h-5 w-5" />
          <span className="text-[10px] font-medium">No</span>
        </button>
      </div>

      {/* Main card - slides left */}
      <div
        className={`relative transition-transform duration-300 ${swiped ? '-translate-x-28' : 'translate-x-0'}`}
        style={{
          background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
          boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
        }}
      >
        <div className="p-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
            >
              {event.groupEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
                {event.groupName}
              </h3>
              <div className="text-xs" style={{ color: textColorMuted }}>
                {event.eventTime} · {event.eventDay}
              </div>
            </div>
            <div
              className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
                {event.eventDate.split(' ')[0]}
              </span>
              <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
                {event.eventDate.split(' ')[1].replace(',', '')}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
            <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
          </div>
        </div>
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rsvpInfo.color }} />
            <span className="text-xs font-medium" style={{ color: textColor }}>{rsvpInfo.label}</span>
          </div>
          <button
            onClick={() => setSwiped(!swiped)}
            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: textColor }}
          >
            {swiped ? '← Close' : 'RSVP →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// NEW: Prominent RSVP Bar Designs
// ===========================================

// Option F: Status Pill Bar - Full-width colored status that's tappable
function EventCardStatusPill({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  const handleRsvp = (status: RsvpStatus) => {
    onRsvpChange(status);
    setIsExpanded(false);
  };

  // Color configs for each status
  const statusColors = {
    going: { bg: 'rgb(34, 197, 94)', text: 'white' },
    maybe: { bg: 'rgb(234, 179, 8)', text: 'white' },
    no: { bg: 'rgb(156, 163, 175)', text: 'white' },
    null: { bg: 'rgba(0,0,0,0.06)', text: textColor },
  };
  const currentColors = statusColors[rsvpStatus ?? 'null'];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
      }}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
          >
            {event.groupEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
              {event.groupName}
            </h3>
            <div className="text-xs" style={{ color: textColorMuted }}>
              {event.eventTime} · {event.eventDay}
            </div>
          </div>
          <div
            className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
              {event.eventDate.split(' ')[0]}
            </span>
            <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
              {event.eventDate.split(' ')[1].replace(',', '')}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
          <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
        </div>
      </div>

      {/* Prominent RSVP Bar */}
      {isExpanded ? (
        <div
          className="flex gap-1 p-1.5 animate-in fade-in duration-150"
          style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
        >
          <button
            onClick={() => handleRsvp("going")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "going" ? "ring-2 ring-offset-1 ring-green-600" : ""
            }`}
            style={{ backgroundColor: statusColors.going.bg, color: statusColors.going.text }}
          >
            <Check className="h-4 w-4" />
            Going
          </button>
          <button
            onClick={() => handleRsvp("maybe")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "maybe" ? "ring-2 ring-offset-1 ring-yellow-600" : ""
            }`}
            style={{ backgroundColor: statusColors.maybe.bg, color: statusColors.maybe.text }}
          >
            <HelpCircle className="h-4 w-4" />
            Maybe
          </button>
          <button
            onClick={() => handleRsvp("no")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "no" ? "ring-2 ring-offset-1 ring-gray-600" : ""
            }`}
            style={{ backgroundColor: statusColors.no.bg, color: statusColors.no.text }}
          >
            <X className="h-4 w-4" />
            Can't
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            backgroundColor: currentColors.bg,
            color: currentColors.text,
          }}
        >
          {rsvpStatus === "going" && <Check className="h-4 w-4" />}
          {rsvpStatus === "maybe" && <HelpCircle className="h-4 w-4" />}
          {rsvpStatus === "no" && <X className="h-4 w-4" />}
          {!rsvpStatus && <Sparkles className="h-4 w-4" />}
          <span>{rsvpInfo.label}</span>
          <ChevronDown className="h-4 w-4 ml-1 opacity-60" />
        </button>
      )}
    </div>
  );
}

// Option G: Split Bar - RSVP on one side, Host on other, tap the status side
function EventCardSplitBar({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  const handleRsvp = (status: RsvpStatus) => {
    onRsvpChange(status);
    setIsExpanded(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
        boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
      }}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
          >
            {event.groupEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
              {event.groupName}
            </h3>
            <div className="text-xs" style={{ color: textColorMuted }}>
              {event.eventTime} · {event.eventDay}
            </div>
          </div>
          <div
            className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
              {event.eventDate.split(' ')[0]}
            </span>
            <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
              {event.eventDate.split(' ')[1].replace(',', '')}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
          <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
        </div>
      </div>

      {/* Split bottom bar */}
      {isExpanded ? (
        <div
          className="flex gap-1 p-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
        >
          <button
            onClick={() => handleRsvp("going")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "going"
                ? "bg-green-500 text-white shadow-md"
                : "bg-white/80 text-muted-foreground hover:bg-green-50 hover:text-green-700"
            }`}
          >
            <Check className="h-4 w-4" />
            Going
          </button>
          <button
            onClick={() => handleRsvp("maybe")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "maybe"
                ? "bg-yellow-500 text-white shadow-md"
                : "bg-white/80 text-muted-foreground hover:bg-yellow-50 hover:text-yellow-700"
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            Maybe
          </button>
          <button
            onClick={() => handleRsvp("no")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              rsvpStatus === "no"
                ? "bg-gray-500 text-white shadow-md"
                : "bg-white/80 text-muted-foreground hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <X className="h-4 w-4" />
            Can't
          </button>
        </div>
      ) : (
        <div className="flex" style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}>
          {/* Tappable RSVP side */}
          <button
            onClick={() => setIsExpanded(true)}
            className="flex-1 flex items-center gap-2 px-3.5 py-2.5 transition-all active:bg-white/30"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: rsvpInfo.color }}
            >
              {rsvpStatus === "going" && <Check className="h-3.5 w-3.5 text-white" />}
              {rsvpStatus === "maybe" && <HelpCircle className="h-3.5 w-3.5 text-white" />}
              {rsvpStatus === "no" && <X className="h-3.5 w-3.5 text-white" />}
              {!rsvpStatus && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <span className="text-xs font-semibold" style={{ color: textColor }}>{rsvpInfo.label}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" style={{ color: textColor }} />
          </button>

          {/* Divider */}
          <div className="w-px bg-black/10 my-2" />

          {/* Host side (not interactive) */}
          <div className="flex items-center gap-2 px-3.5 py-2.5">
            <Avatar className="h-6 w-6 border border-white/50">
              <AvatarFallback className="text-[9px] font-bold bg-white" style={{ color: textColor }}>
                {event.hostName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs" style={{ color: textColorMuted }}>Host</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Option H: Slide-Up Tray - Status shows as badge, tapping slides up options
function EventCardSlideTray({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  const handleRsvp = (status: RsvpStatus) => {
    onRsvpChange(status);
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
          boxShadow: `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
        }}
      >
        <div className="p-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
            >
              {event.groupEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
                {event.groupName}
              </h3>
              <div className="text-xs" style={{ color: textColorMuted }}>
                {event.eventTime} · {event.eventDay}
              </div>
            </div>
            <div
              className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
                {event.eventDate.split(' ')[0]}
              </span>
              <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
                {event.eventDate.split(' ')[1].replace(',', '')}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
            <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
          </div>
        </div>

        {/* Bottom bar with prominent badge */}
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
        >
          {/* Tappable RSVP badge */}
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all active:scale-95"
            style={{
              backgroundColor: rsvpInfo.color,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            {rsvpStatus === "going" && <Check className="h-3.5 w-3.5 text-white" />}
            {rsvpStatus === "maybe" && <HelpCircle className="h-3.5 w-3.5 text-white" />}
            {rsvpStatus === "no" && <X className="h-3.5 w-3.5 text-white" />}
            {!rsvpStatus && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={`text-xs font-semibold ${rsvpStatus ? 'text-white' : ''}`} style={!rsvpStatus ? { color: textColor } : {}}>
              {rsvpInfo.label}
            </span>
            <ChevronDown className={`h-3 w-3 ${rsvpStatus ? 'text-white/70' : 'opacity-50'}`} />
          </button>
          <div className="text-xs" style={{ color: textColorMuted }}>Host: {event.hostName}</div>
        </div>

        {/* Slide-up tray */}
        {isExpanded && (
          <div
            className="absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-200"
            style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Change RSVP</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRsvp("going")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "going"
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-green-50 hover:text-green-700"
                }`}
              >
                <Check className="h-5 w-5" />
                Going
              </button>
              <button
                onClick={() => handleRsvp("maybe")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "maybe"
                    ? "bg-yellow-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-yellow-50 hover:text-yellow-700"
                }`}
              >
                <HelpCircle className="h-5 w-5" />
                Maybe
              </button>
              <button
                onClick={() => handleRsvp("no")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "no"
                    ? "bg-gray-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <X className="h-5 w-5" />
                Can't
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Option I: Outlined Card - RSVP status colors the entire card border
function EventCardOutlined({ event, rsvpStatus, onRsvpChange }: {
  event: typeof mockEvents[0];
  rsvpStatus: RsvpStatus;
  onRsvpChange: (status: RsvpStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textColor = getTextColor(event.accentColor);
  const textColorMuted = getTextColor(event.accentColor, 0.7);
  const rsvpInfo = getRsvpInfo(rsvpStatus);

  const handleRsvp = (status: RsvpStatus) => {
    onRsvpChange(status);
    setIsExpanded(false);
  };

  // Border color based on RSVP status
  const borderColor = rsvpStatus === "going"
    ? "rgb(34, 197, 94)"
    : rsvpStatus === "maybe"
      ? "rgb(234, 179, 8)"
      : rsvpStatus === "no"
        ? "rgb(156, 163, 175)"
        : "transparent";

  const borderWidth = rsvpStatus ? "3px" : "0px";
  const hasStatus = !!rsvpStatus;

  return (
    <div className="relative">
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: `linear-gradient(145deg, ${lightenColor(event.accentColor, 0.87)} 0%, ${lightenColor(event.accentColor, 0.92)} 100%)`,
          boxShadow: hasStatus
            ? `0 0 0 ${borderWidth} ${borderColor}, 0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`
            : `0 4px 18px -6px ${hexToRgba(event.accentColor, 0.25)}`,
        }}
      >
        <div className="p-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: `0 2px 8px ${hexToRgba(event.accentColor, 0.12)}` }}
            >
              {event.groupEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate leading-tight" style={{ color: textColor }}>
                {event.groupName}
              </h3>
              <div className="text-xs" style={{ color: textColorMuted }}>
                {event.eventTime} · {event.eventDay}
              </div>
            </div>
            <div
              className="flex flex-col items-center px-2.5 py-1.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textColorMuted }}>
                {event.eventDate.split(' ')[0]}
              </span>
              <span className="text-lg font-bold leading-tight" style={{ color: textColor }}>
                {event.eventDate.split(' ')[1].replace(',', '')}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: textColorMuted }} />
            <span className="truncate" style={{ color: textColor }}>{event.venueName}</span>
          </div>
        </div>

        {/* Bottom bar with tappable RSVP badge */}
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
        >
          {/* Tappable RSVP badge */}
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all active:scale-95"
            style={{
              backgroundColor: rsvpInfo.color,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            {rsvpStatus === "going" && <Check className="h-3.5 w-3.5 text-white" />}
            {rsvpStatus === "maybe" && <HelpCircle className="h-3.5 w-3.5 text-white" />}
            {rsvpStatus === "no" && <X className="h-3.5 w-3.5 text-white" />}
            {!rsvpStatus && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={`text-xs font-semibold ${rsvpStatus ? 'text-white' : ''}`} style={!rsvpStatus ? { color: textColor } : {}}>
              {rsvpInfo.label}
            </span>
            <ChevronDown className={`h-3 w-3 ${rsvpStatus ? 'text-white/70' : 'opacity-50'}`} />
          </button>
          <div className="text-xs" style={{ color: textColorMuted }}>Host: {event.hostName}</div>
        </div>

        {/* Slide-up tray */}
        {isExpanded && (
          <div
            className="absolute inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-200"
            style={{ boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Change RSVP</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRsvp("going")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "going"
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-green-50 hover:text-green-700"
                }`}
              >
                <Check className="h-5 w-5" />
                Going
              </button>
              <button
                onClick={() => handleRsvp("maybe")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "maybe"
                    ? "bg-yellow-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-yellow-50 hover:text-yellow-700"
                }`}
              >
                <HelpCircle className="h-5 w-5" />
                Maybe
              </button>
              <button
                onClick={() => handleRsvp("no")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  rsvpStatus === "no"
                    ? "bg-gray-500 text-white shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <X className="h-5 w-5" />
                Can't
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// DASHBOARD EVENT MOCKUPS
// ===========================================

// Dashboard mockup event type
type DashboardEvent = {
  id: string;
  groupName: string;
  groupEmoji: string;
  groupColor: string;
  venue: string;
  neighborhood: string;
  date: string;
  dayNum: string;
  month: string;
  dayName: string;
  time: string;
  rsvp: "going" | "pending" | "maybe" | null;
};

// Helper for RSVP badge display
function getDashboardRsvpInfo(status: DashboardEvent["rsvp"]) {
  switch (status) {
    case "going":
      return { label: "Going", color: "#22c55e", textColor: "#15803d" };
    case "maybe":
      return { label: "Maybe", color: "#f59e0b", textColor: "#b45309" };
    case "pending":
      return { label: "Pending", color: "#94a3b8", textColor: "#64748b" };
    default:
      return { label: "RSVP", color: "#94a3b8", textColor: "#64748b" };
  }
}

// Mockup 1: Clean Calendar - Date-first cards with white background
function DashboardCleanCalendar({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => {
        const rsvpInfo = getDashboardRsvpInfo(event.rsvp);
        return (
          <div
            key={event.id}
            className="bg-white dark:bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm"
          >
            <div className="flex">
              {/* Left border accent */}
              <div
                className="w-1 flex-shrink-0"
                style={{ backgroundColor: event.groupColor }}
              />

              {/* Date block */}
              <div className="flex flex-col items-center justify-center px-4 py-3 border-r border-border/40 min-w-[64px]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {event.month}
                </span>
                <span className="text-2xl font-bold text-foreground leading-none">
                  {event.dayNum}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {event.dayName}
                </span>
              </div>

              {/* Main content */}
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{event.groupEmoji}</span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {event.groupName}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                    {event.time}
                  </span>
                </div>

                <div className="text-base font-medium text-foreground mb-1 truncate">
                  {event.venue}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.neighborhood}</span>
                  </div>

                  <div
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${rsvpInfo.color}20`,
                      color: rsvpInfo.textColor,
                    }}
                  >
                    {rsvpInfo.label}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Mockup 2: Grouped Timeline - Events grouped by group
function DashboardGroupedTimeline({ events }: { events: DashboardEvent[] }) {
  // Group events by groupName
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.groupName]) {
      acc[event.groupName] = {
        emoji: event.groupEmoji,
        color: event.groupColor,
        events: [],
      };
    }
    acc[event.groupName].events.push(event);
    return acc;
  }, {} as Record<string, { emoji: string; color: string; events: DashboardEvent[] }>);

  return (
    <div className="space-y-5">
      {Object.entries(groupedEvents).map(([groupName, group]) => (
        <div key={groupName}>
          {/* Group header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{group.emoji}</span>
            <span className="font-semibold text-foreground">{groupName}</span>
          </div>

          {/* Accent line */}
          <div
            className="h-0.5 rounded-full mb-3"
            style={{ backgroundColor: group.color }}
          />

          {/* Events list */}
          <div className="space-y-2 pl-2">
            {group.events.map((event) => {
              const rsvpInfo = getDashboardRsvpInfo(event.rsvp);
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-2 px-3 bg-white dark:bg-card rounded-lg border border-border/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {event.date}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{event.time}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground truncate">{event.venue}</span>
                    </div>
                  </div>

                  <div
                    className="text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                    style={{
                      backgroundColor: `${rsvpInfo.color}15`,
                      color: rsvpInfo.textColor,
                    }}
                  >
                    {rsvpInfo.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mockup 3: Date Blocks - Calendar page style blocks
function DashboardDateBlocks({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event) => {
        const rsvpInfo = getDashboardRsvpInfo(event.rsvp);
        return (
          <div key={event.id} className="flex gap-3">
            {/* Date block - calendar page style */}
            <div
              className="w-16 h-20 flex flex-col items-center justify-center rounded-xl flex-shrink-0 border-2"
              style={{
                borderColor: event.groupColor,
                backgroundColor: `${event.groupColor}08`,
              }}
            >
              <span
                className="text-2xl font-bold leading-none"
                style={{ color: event.groupColor }}
              >
                {event.dayNum}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">
                {event.month}
              </span>
              <span className="text-xs text-muted-foreground">
                {event.dayName}
              </span>
            </div>

            {/* Event details */}
            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.groupColor }}
                />
                <span className="text-sm font-medium text-muted-foreground truncate">
                  {event.groupName}
                </span>
              </div>

              <div className="text-base font-semibold text-foreground mb-1 truncate">
                {event.venue}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{event.time}</span>
                {event.neighborhood !== "TBD" && (
                  <>
                    <span>·</span>
                    <span>{event.neighborhood}</span>
                  </>
                )}
              </div>

              <div
                className="inline-flex text-xs font-medium px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: `${rsvpInfo.color}15`,
                  color: rsvpInfo.textColor,
                }}
              >
                {rsvpInfo.label}
              </div>
            </div>
          </div>
        );
      })}

      {/* Separator between days - shown between events */}
      <style>{`
        .date-blocks-container > div:not(:last-child)::after {
          content: '';
          display: block;
          height: 1px;
          background: var(--border);
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
}

// ===========================================
// Main Page
// ===========================================
export default function PrototypeGroupTiles() {
  const [activeTab, setActiveTab] = useState<'cards' | 'collections' | 'events' | 'dashboard'>('dashboard');
  const [activeOption, setActiveOption] = useState<string>('tight');
  const [activeCollectionStyle, setActiveCollectionStyle] = useState<string>('current');
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set(['col1', 'col2']));

  const toggleCollection = (id: string) => {
    setOpenCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const cardOptions = [
    { key: 'tight', label: 'Tight Split', desc: 'Compact right panel' },
    { key: 'bottom', label: 'Bottom Strip', desc: 'Members at bottom' },
    { key: 'asymmetric', label: 'Asymmetric', desc: 'Large emoji left' },
    { key: 'accent', label: 'Accent Edge', desc: 'White with color bar' },
    { key: 'twotone', label: 'Two-Tone', desc: 'Gradient to white' },
    { key: 'stacked', label: 'Stacked', desc: 'Most compact' },
  ];

  const collectionOptions = [
    { key: 'current', label: 'Current', desc: 'Heavy padding' },
    { key: 'minimal', label: 'Minimal', desc: 'Line divider' },
    { key: 'pill', label: 'Pill Label', desc: 'Floating tag' },
    { key: 'accent', label: 'Accent Bar', desc: 'Left color bar' },
    { key: 'inline', label: 'Inline', desc: 'Dashed line' },
    { key: 'stack', label: 'Stack', desc: 'Color preview' },
  ];

  const eventOptions = [
    { key: 'outlined', label: 'Outlined', desc: 'Color border' },
    { key: 'slidetray', label: 'Slide Tray', desc: 'Badge + tray' },
    { key: 'statuspill', label: 'Status Bar', desc: 'Full-width color' },
    { key: 'splitbar', label: 'Split Bar', desc: 'RSVP + Host' },
    { key: 'buttons', label: 'Button Row', desc: 'Collapsed expand' },
    { key: 'segmented', label: 'Segmented', desc: 'Inline controls' },
  ];

  const dashboardOptions = [
    { key: 'calendar', label: 'Clean Calendar', desc: 'Date-first cards' },
    { key: 'grouped', label: 'Grouped Timeline', desc: 'By group' },
    { key: 'dateblocks', label: 'Date Blocks', desc: 'Calendar style' },
  ];

  const [activeDashboardStyle, setActiveDashboardStyle] = useState<string>('calendar');

  // Mock events for dashboard mockups
  const dashboardEvents: DashboardEvent[] = [
    {
      id: "e1",
      groupName: "Wine & Dine Club",
      groupEmoji: "🍷",
      groupColor: "#9B2335",
      venue: "Kokkari Estiatorio",
      neighborhood: "Financial District",
      date: "Sat, Dec 14",
      dayNum: "14",
      month: "DEC",
      dayName: "Sat",
      time: "7:00 PM",
      rsvp: "going",
    },
    {
      id: "e2",
      groupName: "Brunch Squad",
      groupEmoji: "🥞",
      groupColor: "#E8A030",
      venue: "Tartine Manufactory",
      neighborhood: "Mission",
      date: "Sun, Dec 8",
      dayNum: "8",
      month: "DEC",
      dayName: "Sun",
      time: "11:00 AM",
      rsvp: "pending",
    },
    {
      id: "e3",
      groupName: "Adventure Crew",
      groupEmoji: "🏔️",
      groupColor: "#2D8B7A",
      venue: "TBD",
      neighborhood: "Bay Area",
      date: "Sat, Dec 21",
      dayNum: "21",
      month: "DEC",
      dayName: "Sat",
      time: "9:00 AM",
      rsvp: "maybe",
    },
    {
      id: "e4",
      groupName: "Wine & Dine Club",
      groupEmoji: "🍷",
      groupColor: "#9B2335",
      venue: "TBD",
      neighborhood: "TBD",
      date: "Sat, Dec 28",
      dayNum: "28",
      month: "DEC",
      dayName: "Sat",
      time: "6:30 PM",
      rsvp: "pending",
    },
  ];

  const [activeEventStyle, setActiveEventStyle] = useState<string>('outlined');
  const [eventRsvps, setEventRsvps] = useState<Record<string, RsvpStatus>>({
    "1": "going",
    "2": "maybe",
    "3": null,
    "4": "no",
  });

  const handleEventRsvpChange = (eventId: string, status: RsvpStatus) => {
    setEventRsvps(prev => ({ ...prev, [eventId]: status }));
  };

  // Split groups into 2 collections for demo
  const collection1Groups = mockGroups.slice(0, 2);
  const collection2Groups = mockGroups.slice(2);

  const options = activeTab === 'cards' ? cardOptions : activeTab === 'collections' ? collectionOptions : activeTab === 'events' ? eventOptions : dashboardOptions;

  const renderCollections = () => {
    const CollectionComponent = {
      current: CollectionCurrent,
      minimal: CollectionMinimalHeader,
      pill: CollectionPillLabel,
      accent: CollectionAccentBar,
      inline: CollectionInlineBadge,
      stack: CollectionStackPreview,
    }[activeCollectionStyle] || CollectionCurrent;

    return (
      <div className="space-y-6">
        <CollectionComponent
          name="Wine & Dine Clubs"
          groups={collection1Groups}
          isOpen={openCollections.has('col1')}
          onToggle={() => toggleCollection('col1')}
        />
        <CollectionComponent
          name="Weekend Warriors"
          groups={collection2Groups}
          isOpen={openCollections.has('col2')}
          onToggle={() => toggleCollection('col2')}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold">Design Mockups</h1>
            <p className="text-xs text-muted-foreground">Cards & Collections</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-lg mx-auto px-4 pb-2">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === 'cards'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === 'collections'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Collections
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === 'events'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Option Selector */}
      <div className="sticky top-[105px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {options.map((option) => {
              const isActive = activeTab === 'cards'
                ? activeOption === option.key
                : activeTab === 'collections'
                  ? activeCollectionStyle === option.key
                  : activeTab === 'events'
                    ? activeEventStyle === option.key
                    : activeDashboardStyle === option.key;

              const handleClick = () => {
                if (activeTab === 'cards') setActiveOption(option.key);
                else if (activeTab === 'collections') setActiveCollectionStyle(option.key);
                else if (activeTab === 'events') setActiveEventStyle(option.key);
                else setActiveDashboardStyle(option.key);
              };

              return (
                <button
                  key={option.key}
                  onClick={handleClick}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl text-left whitespace-nowrap transition-all min-w-[90px] ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-xs font-medium">{option.label}</span>
                  <span className={`text-[9px] ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/60'}`}>
                    {option.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {activeTab === 'cards' ? (
          <>
            {/* Info Box */}
            <div className="mb-5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Color contrast fix:</strong> Light colors (like yellow) now use darkened text for better readability while staying on-theme.
              </p>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {mockGroups.map((group) => (
                <div key={group.id}>
                  {activeOption === 'tight' && <SplitTightCard group={group} />}
                  {activeOption === 'bottom' && <SplitBottomStripCard group={group} />}
                  {activeOption === 'asymmetric' && <SplitAsymmetricCard group={group} />}
                  {activeOption === 'accent' && <SplitAccentEdgeCard group={group} />}
                  {activeOption === 'twotone' && <SplitTwoToneCard group={group} />}
                  {activeOption === 'stacked' && <SplitStackedCard group={group} />}
                </div>
              ))}
            </div>

            {/* Design Notes */}
            <div className="mt-8 p-4 bg-muted/30 rounded-xl text-sm">
              <p className="font-semibold text-foreground mb-3">What's Improved:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>No wasted space</strong> - Tighter layouts, every pixel earns its place</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Smart contrast</strong> - Light colors auto-darken for readable text</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Member visibility</strong> - Names always prominent and scannable</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>On-theme colors</strong> - Still uses accent color, just adjusted for accessibility</span>
                </li>
              </ul>
            </div>
          </>
        ) : activeTab === 'collections' ? (
          <>
            {/* Collections Info */}
            <div className="mb-5 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>The problem:</strong> Current collection containers use heavy borders and padding (p-5 = 20px), leaving less room for the group cards themselves. Compare options below.
              </p>
            </div>

            {/* Collections */}
            {renderCollections()}

            {/* Design Notes for Collections */}
            <div className="mt-8 p-4 bg-muted/30 rounded-xl text-sm">
              <p className="font-semibold text-foreground mb-3">Collection Style Comparison:</p>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span><strong>Current:</strong> 20px padding + borders eat into card width</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Minimal:</strong> Just a line divider, full-width cards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Pill:</strong> Compact floating label, modern feel</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Accent Bar:</strong> Visual grouping without boxing in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Inline:</strong> Super minimal, dashed separator</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Stack:</strong> Shows color preview when collapsed</span>
                </li>
              </ul>
            </div>
          </>
        ) : activeTab === 'events' ? (
          <>
            {/* Events Info */}
            <div className="mb-5 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                <strong>The problem:</strong> On mobile, tapping an event card navigates to details. Users can't RSVP without leaving the dashboard. These mockups show different ways to add inline RSVP.
              </p>
            </div>

            {/* Event Cards */}
            <div className="space-y-4">
              {mockEvents.map((event) => (
                <div key={event.id}>
                  {activeEventStyle === 'outlined' && (
                    <EventCardOutlined
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'statuspill' && (
                    <EventCardStatusPill
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'splitbar' && (
                    <EventCardSplitBar
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'slidetray' && (
                    <EventCardSlideTray
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'dropdown' && (
                    <EventCardDropdown
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'buttons' && (
                    <EventCardButtonRow
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                  {activeEventStyle === 'segmented' && (
                    <EventCardSegmented
                      event={event}
                      rsvpStatus={eventRsvps[event.id]}
                      onRsvpChange={(status) => handleEventRsvpChange(event.id, status)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Design Notes for Events */}
            <div className="mt-8 p-4 bg-muted/30 rounded-xl text-sm">
              <p className="font-semibold text-foreground mb-3">Prominent RSVP Designs:</p>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">★</span>
                  <span><strong>Outlined:</strong> Entire card has colored border matching RSVP status. Instantly scannable at a glance. Tap badge for slide-up tray.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">★</span>
                  <span><strong>Slide Tray:</strong> Colored pill badge that slides up a tray with large buttons. Premium feel, prevents mis-taps.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">○</span>
                  <span><strong>Status Bar:</strong> Full-width colored bar shows status prominently. Tap to expand options.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">○</span>
                  <span><strong>Split Bar:</strong> RSVP on left with colored circle, Host on right. Clear separation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">○</span>
                  <span><strong>Button Row:</strong> Collapsed by default, expands to show options.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">○</span>
                  <span><strong>Segmented:</strong> Always-visible buttons. Quick but easier to mis-tap.</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground/80">
                <strong>Outlined</strong> gives you the best of both worlds: instant visual status via border color + slide tray for safe RSVP changes.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Dashboard Info */}
            <div className="mb-5 p-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 rounded-xl">
              <p className="text-sm text-violet-800 dark:text-violet-200">
                <strong>Goals:</strong> Clean/neutral base, group accent colors as pops (not pastels), actual dates (not "tomorrow"), larger text, calendar-oriented but compact.
              </p>
            </div>

            {/* Dashboard Mockups */}
            {activeDashboardStyle === 'calendar' && (
              <DashboardCleanCalendar events={dashboardEvents} />
            )}
            {activeDashboardStyle === 'grouped' && (
              <DashboardGroupedTimeline events={dashboardEvents} />
            )}
            {activeDashboardStyle === 'dateblocks' && (
              <DashboardDateBlocks events={dashboardEvents} />
            )}

            {/* Design Notes for Dashboard */}
            <div className="mt-8 p-4 bg-muted/30 rounded-xl text-sm">
              <p className="font-semibold text-foreground mb-3">Dashboard Style Comparison:</p>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">★</span>
                  <span><strong>Clean Calendar:</strong> Date-first layout with large date block on left. White cards with group accent as left border. Most scannable by date.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">★</span>
                  <span><strong>Grouped Timeline:</strong> Events grouped under each group header. Best when you think "what's happening with my groups" rather than "what's on my calendar".</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">★</span>
                  <span><strong>Date Blocks:</strong> Calendar page style with group color as date block border. Hybrid of date-focus and group identity. Most visual impact.</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground/80">
                All mockups use: <strong>text-base/text-sm</strong> for readability, <strong>actual dates</strong> ("Sat, Dec 14"), and <strong>white/neutral backgrounds</strong> with accent color pops.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
