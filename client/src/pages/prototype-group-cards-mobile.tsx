/**
 * Mobile-Optimized Group Card Variations
 *
 * Problem: On mobile, "2x week" and "Mission District" wrap awkwardly
 * because the header is too cramped with emoji + name + meta + date badge
 *
 * Solutions explored:
 * 1. Move date badge to a different location
 * 2. Stack information vertically
 * 3. Use a two-row header layout
 * 4. Integrate date into the member strip
 * 5. Use icon-only compact mode for metadata
 *
 * Theme: "Warm Gathering" - uses app CSS variables for consistency
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, ChevronRight, Sparkles, Clock, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Sample data
const sampleGroups = [
  {
    id: "1",
    name: "Wine & Dine Club",
    emoji: "🍷",
    accentColor: "#9333EA",
    locationBase: "San Francisco",
    meetingFrequency: "2x month",
    nextEventDate: "Tomorrow",
    members: [
      { id: "1", name: "Sarah Chen" },
      { id: "2", name: "Mike Johnson" },
      { id: "3", name: "Emily Davis" },
      { id: "4", name: "Alex Kim" },
    ]
  },
  {
    id: "2",
    name: "Hiking Buddies",
    emoji: "🥾",
    accentColor: "#059669",
    locationBase: "Bay Area",
    meetingFrequency: "Weekly",
    nextEventDate: "Saturday",
    members: [
      { id: "1", name: "Jordan Lee" },
      { id: "2", name: "Casey Brown" },
      { id: "3", name: "Taylor Smith" },
    ]
  },
  {
    id: "3",
    name: "Board Game Night",
    emoji: "🎲",
    accentColor: "#D97706",
    locationBase: "Oakland",
    meetingFrequency: "Monthly",
    nextEventDate: "Dec 15",
    members: [
      { id: "1", name: "Robin Garcia" },
      { id: "2", name: "Pat Wilson" },
      { id: "3", name: "Sam Martinez" },
      { id: "4", name: "Drew Anderson" },
      { id: "5", name: "Jamie Thomas" },
      { id: "6", name: "Morgan Clark" },
    ]
  },
  {
    id: "4",
    name: "Foodies Unite",
    emoji: "🍜",
    accentColor: "#DC2626",
    locationBase: "Mission District",
    meetingFrequency: "2x week",
    nextEventDate: "Today",
    members: [
      { id: "1", name: "Chris Park" },
      { id: "2", name: "Dana White" },
    ]
  },
  {
    id: "5",
    name: "Book Club",
    emoji: "📚",
    accentColor: "#2563EB",
    locationBase: "Berkeley",
    meetingFrequency: "Monthly",
    nextEventDate: null,
    members: [
      { id: "1", name: "Quinn Adams" },
      { id: "2", name: "Riley Scott" },
      { id: "3", name: "Avery Mitchell" },
      { id: "4", name: "Cameron Hall" },
    ]
  },
];

// Helpers
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatNameWithInitial(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function softenColor(hex: string, amount: number = 0.08): string {
  return `${hex}${Math.round(amount * 255).toString(16).padStart(2, '0')}`;
}

// ============================================================
// OPTION A: Date badge in member strip (frees up header space)
// ============================================================
function OptionA({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer"
    >
      <div
        className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-xl"
        style={{
          background: 'white',
          boxShadow: '0 2px 16px -4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Header - now has room to breathe */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[17px] text-stone-900 truncate">
                {group.name}
              </h3>
              {/* Meta on single line - no wrapping */}
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.accentColor }} />
                <span className="whitespace-nowrap">{group.meetingFrequency}</span>
                <span className="text-stone-300">·</span>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{group.locationBase}</span>
              </p>
            </div>

            <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0" />
          </div>
        </div>

        {/* Member strip WITH date badge integrated */}
        <div
          className="px-4 py-3"
          style={{
            background: `linear-gradient(180deg, ${softenColor(group.accentColor, 0.04)} 0%, ${softenColor(group.accentColor, 0.08)} 100%)`,
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          <div className="flex items-center gap-3">
            {/* Date badge - moved here */}
            {group.nextEventDate && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
                style={{
                  backgroundColor: group.accentColor,
                  boxShadow: `0 2px 8px ${softenColor(group.accentColor, 0.3)}`
                }}
              >
                <Sparkles className="w-3 h-3" />
                {group.nextEventDate}
              </div>
            )}

            {/* Member avatars */}
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {group.members.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center gap-1.5 flex-shrink-0">
                  <Avatar className="w-7 h-7 ring-2 ring-white">
                    <AvatarFallback
                      className="text-[10px] font-bold"
                      style={{
                        backgroundColor: softenColor(group.accentColor, 0.2),
                        color: group.accentColor
                      }}
                    >
                      {getInitial(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-stone-600 font-medium whitespace-nowrap">
                    {formatNameWithInitial(member.name)}
                  </span>
                </div>
              ))}
              {group.members.length > 4 && (
                <span className="text-xs text-stone-400 whitespace-nowrap">
                  +{group.members.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION B: Two-row header (name + badge on top, meta below)
// ============================================================
function OptionB({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer"
    >
      <div
        className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-xl"
        style={{
          background: 'white',
          boxShadow: '0 2px 16px -4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Two-row header */}
        <div className="p-4">
          {/* Row 1: Emoji + Name + Date badge */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <h3 className="font-semibold text-[17px] text-stone-900 flex-1 truncate">
              {group.name}
            </h3>

            {group.nextEventDate && (
              <div
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: group.accentColor }}
              >
                {group.nextEventDate}
              </div>
            )}
          </div>

          {/* Row 2: Meta info - full width, no competition */}
          <div className="flex items-center gap-4 ml-14 text-sm text-stone-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: group.accentColor }} />
              {group.meetingFrequency}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {group.locationBase}
            </span>
          </div>
        </div>

        {/* Member strip */}
        <div
          className="px-4 py-3"
          style={{
            background: softenColor(group.accentColor, 0.05),
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          <div className="flex items-center gap-3 overflow-x-auto">
            {group.members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-1.5 flex-shrink-0">
                <Avatar className="w-7 h-7 ring-2 ring-white">
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.2),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-stone-600 font-medium">
                  {formatNameWithInitial(member.name)}
                </span>
              </div>
            ))}
            {group.members.length > 5 && (
              <span className="text-xs text-stone-400">+{group.members.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION C: Date as accent bar at top
// ============================================================
function OptionC({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer"
    >
      <div
        className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-xl"
        style={{
          background: 'white',
          boxShadow: '0 2px 16px -4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Date bar at top - if there's an event */}
        {group.nextEventDate ? (
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ backgroundColor: group.accentColor }}
          >
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Next event</span>
            </div>
            <span className="text-sm font-bold text-white">{group.nextEventDate}</span>
          </div>
        ) : (
          <div
            className="h-1.5"
            style={{ backgroundColor: group.accentColor }}
          />
        )}

        {/* Header - now totally free of date badge */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[17px] text-stone-900 truncate">
                {group.name}
              </h3>
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.accentColor }} />
                <span>{group.meetingFrequency}</span>
                <span className="text-stone-300">·</span>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{group.locationBase}</span>
              </p>
            </div>

            <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0" />
          </div>
        </div>

        {/* Member strip */}
        <div
          className="px-4 py-3"
          style={{
            background: softenColor(group.accentColor, 0.05),
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          <div className="flex items-center gap-3 overflow-x-auto">
            {group.members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-1.5 flex-shrink-0">
                <Avatar className="w-7 h-7 ring-2 ring-white">
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.2),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-stone-600 font-medium">
                  {formatNameWithInitial(member.name)}
                </span>
              </div>
            ))}
            {group.members.length > 5 && (
              <span className="text-xs text-stone-400">+{group.members.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION D: Compact stacked avatars + text list
// ============================================================
function OptionD({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer"
    >
      <div
        className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-xl"
        style={{
          background: 'white',
          boxShadow: '0 2px 16px -4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Compact header */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg text-stone-900 leading-tight">
                  {group.name}
                </h3>
                {group.nextEventDate && (
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: group.accentColor }}
                  >
                    {group.nextEventDate}
                  </div>
                )}
              </div>

              {/* Stacked meta - each on own line */}
              <div className="mt-1.5 space-y-0.5 text-sm text-stone-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.accentColor }} />
                  <span>{group.locationBase}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.accentColor }} />
                  <span>{group.meetingFrequency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Member section - stacked avatars + text names */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{
            background: softenColor(group.accentColor, 0.05),
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          {/* Stacked avatars */}
          <div className="flex -space-x-2 flex-shrink-0">
            {group.members.slice(0, 4).map((member) => (
              <Avatar key={member.id} className="w-8 h-8 ring-2 ring-white">
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    backgroundColor: softenColor(group.accentColor, 0.2),
                    color: group.accentColor
                  }}
                >
                  {getInitial(member.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.members.length > 4 && (
              <div
                className="w-8 h-8 rounded-full ring-2 ring-white flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: softenColor(group.accentColor, 0.15),
                  color: group.accentColor
                }}
              >
                +{group.members.length - 4}
              </div>
            )}
          </div>

          {/* Names as text */}
          <p className="text-sm text-stone-600 flex-1 truncate">
            {group.members.slice(0, 3).map((m, i) => (
              <span key={m.id}>
                <span className="font-medium">{formatNameWithInitial(m.name)}</span>
                {i < Math.min(2, group.members.length - 1) && ", "}
              </span>
            ))}
            {group.members.length > 3 && (
              <span className="text-stone-400"> +{group.members.length - 3}</span>
            )}
          </p>

          <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION E: Ultra-compact single row members (no individual names)
// ============================================================
function OptionE({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer"
    >
      <div
        className="rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg"
        style={{
          background: 'white',
          boxShadow: '0 2px 12px -4px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${group.accentColor}`
        }}
      >
        <div className="p-3.5">
          {/* Single row layout */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.1) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-900 truncate">
                  {group.name}
                </h3>
                {group.nextEventDate && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.15),
                      color: group.accentColor
                    }}
                  >
                    {group.nextEventDate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {group.meetingFrequency}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{group.locationBase}</span>
                </span>
              </div>
            </div>

            {/* Compact stacked avatars */}
            <div className="flex -space-x-1.5 flex-shrink-0">
              {group.members.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="w-7 h-7 ring-2 ring-white">
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.2),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {group.members.length > 3 && (
                <div
                  className="w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: softenColor(group.accentColor, 0.12),
                    color: group.accentColor
                  }}
                >
                  +{group.members.length - 3}
                </div>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION F: Cards with date as subtle top-right corner badge
// Uses app's "Warm Gathering" theme colors
// ============================================================
function OptionF({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer relative"
    >
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200 bg-card border border-card-border hover:shadow-[var(--shadow-elevated)] active:scale-[0.98]"
      >
        {/* Floating date badge in corner */}
        {group.nextEventDate && (
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold text-white z-10"
            style={{
              backgroundColor: group.accentColor,
              boxShadow: `0 2px 8px ${softenColor(group.accentColor, 0.35)}`
            }}
          >
            {group.nextEventDate}
          </div>
        )}

        {/* Header with no date competition */}
        <div className="p-4 pr-24">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[17px] text-card-foreground truncate">
                {group.name}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.accentColor }} />
                <span>{group.meetingFrequency}</span>
                <span className="text-border">·</span>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{group.locationBase}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Member strip - warm background */}
        <div
          className="px-4 py-3 border-t border-card-border"
          style={{
            background: softenColor(group.accentColor, 0.05),
          }}
        >
          <div className="flex items-center gap-3 overflow-x-auto">
            {group.members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-1.5 flex-shrink-0">
                <Avatar className="w-7 h-7 ring-2 ring-card">
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.2),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-card-foreground font-medium">
                  {formatNameWithInitial(member.name)}
                </span>
              </div>
            ))}
            {group.members.length > 5 && (
              <span className="text-xs text-muted-foreground">+{group.members.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// OPTION G: Corner Badge - FINAL (Theme-compatible)
// This is the production-ready version using all app theme variables
// ============================================================
function OptionG({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="cursor-pointer relative group"
    >
      <div className="card-warm rounded-2xl overflow-hidden active:scale-[0.98]">
        {/* Floating date badge in corner */}
        {group.nextEventDate && (
          <div
            className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-2xs font-bold text-white z-10 flex items-center gap-1"
            style={{
              backgroundColor: group.accentColor,
              boxShadow: `0 2px 8px ${softenColor(group.accentColor, 0.4)}`
            }}
          >
            <Sparkles className="w-3 h-3" />
            {group.nextEventDate}
          </div>
        )}

        {/* Header */}
        <div className="p-4 pr-28">
          <div className="flex items-center gap-3">
            {/* Emoji with warm background */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: softenColor(group.accentColor, 0.1),
                border: `1px solid ${softenColor(group.accentColor, 0.15)}`
              }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-card-foreground truncate leading-tight">
                {group.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span>{group.meetingFrequency}</span>
                <span className="opacity-40">·</span>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="truncate">{group.locationBase}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Member strip with warm tint from accent color */}
        <div
          className="px-4 py-3 border-t border-card-border"
          style={{
            background: `linear-gradient(180deg, ${softenColor(group.accentColor, 0.03)} 0%, ${softenColor(group.accentColor, 0.06)} 100%)`,
          }}
        >
          <div className="flex items-center gap-3 overflow-x-auto pb-0.5">
            {group.members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-1.5 flex-shrink-0">
                <Avatar className="w-7 h-7 ring-2 ring-card shadow-sm">
                  <AvatarFallback
                    className="text-2xs font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.18),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-2xs text-card-foreground font-medium">
                  {formatNameWithInitial(member.name)}
                </span>
              </div>
            ))}
            {group.members.length > 5 && (
              <span className="text-2xs text-muted-foreground font-medium">
                +{group.members.length - 5}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function PrototypeGroupCardsMobile() {
  const [selectedOption, setSelectedOption] = useState<string>("G");

  const options = [
    { id: "G", label: "Final (Theme)", desc: "Corner badge using app's Warm Gathering theme" },
    { id: "F", label: "Corner Badge", desc: "Floating date badge in corner" },
    { id: "A", label: "Date in Strip", desc: "Moves date badge into member strip" },
    { id: "B", label: "Two-Row Header", desc: "Name+date on row 1, meta on row 2" },
    { id: "C", label: "Date Bar Top", desc: "Full-width colored date bar at top" },
    { id: "D", label: "Stacked Meta", desc: "Location & frequency on separate lines" },
    { id: "E", label: "Ultra Compact", desc: "Single-row card, avatars only" },
  ];

  const renderCards = () => {
    switch (selectedOption) {
      case "G": return sampleGroups.map((g, i) => <OptionG key={g.id} group={g} index={i} />);
      case "A": return sampleGroups.map((g, i) => <OptionA key={g.id} group={g} index={i} />);
      case "B": return sampleGroups.map((g, i) => <OptionB key={g.id} group={g} index={i} />);
      case "C": return sampleGroups.map((g, i) => <OptionC key={g.id} group={g} index={i} />);
      case "D": return sampleGroups.map((g, i) => <OptionD key={g.id} group={g} index={i} />);
      case "E": return sampleGroups.map((g, i) => <OptionE key={g.id} group={g} index={i} />);
      case "F": return sampleGroups.map((g, i) => <OptionF key={g.id} group={g} index={i} />);
      default: return sampleGroups.map((g, i) => <OptionG key={g.id} group={g} index={i} />);
    }
  };

  const currentOption = options.find(o => o.id === selectedOption);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-card-border sticky top-0 z-20">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Mobile Card Options</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Solving text wrapping on narrow screens
          </p>
        </div>

        {/* Option selector */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedOption(opt.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                selectedOption === opt.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {opt.id}: {opt.label}
            </button>
          ))}
        </div>

        {/* Current option description */}
        <div className="px-4 py-2 bg-muted/50 border-t border-card-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Option {selectedOption}:</span>{" "}
            {currentOption?.desc}
          </p>
        </div>
      </div>

      {/* Cards - mobile viewport simulation */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {renderCards()}
      </div>

      {/* Comparison notes */}
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="bg-card border border-card-border rounded-xl p-4 text-sm">
          <h3 className="font-semibold text-card-foreground mb-2">Quick Comparison</h3>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="font-medium text-card-foreground">G:</span> Final theme-compatible version - recommended</p>
            <p><span className="font-medium text-card-foreground">F:</span> Corner badge - original prototype</p>
            <p><span className="font-medium text-card-foreground">A:</span> Date joins members - keeps header clean</p>
            <p><span className="font-medium text-card-foreground">B:</span> Two rows - most breathing room</p>
            <p><span className="font-medium text-card-foreground">C:</span> Date bar - most prominent upcoming event</p>
            <p><span className="font-medium text-card-foreground">D:</span> Stacked - traditional card feel</p>
            <p><span className="font-medium text-card-foreground">E:</span> Compact - best for long lists</p>
          </div>
        </div>
      </div>
    </div>
  );
}
