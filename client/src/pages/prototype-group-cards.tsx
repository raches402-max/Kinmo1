/**
 * Group Card Mockups - Refined Glass Variations
 *
 * Aesthetic: Warm Sophistication
 * - Soft, layered shadows that create depth
 * - Warm neutral palette with vibrant accent pops
 * - Refined typography with clear hierarchy
 * - Micro-interactions that feel tactile
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Users, ChevronRight, Sparkles, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Sample data for mockups
const sampleGroups = [
  {
    id: "1",
    name: "Wine & Dine Club",
    emoji: "🍷",
    accentColor: "#9333EA", // Vivid purple
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
    accentColor: "#059669", // Emerald
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
    accentColor: "#D97706", // Amber
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
    accentColor: "#DC2626", // Red
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
    accentColor: "#2563EB", // Blue
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
  {
    id: "6",
    name: "Tennis Crew",
    emoji: "🎾",
    accentColor: "#0891B2", // Cyan
    locationBase: "Golden Gate Park",
    meetingFrequency: "Weekly",
    nextEventDate: "Sunday",
    members: [
      { id: "1", name: "Alex Rivera" },
      { id: "2", name: "Sam Kim" },
      { id: "3", name: "Jordan Chen" },
      { id: "4", name: "Morgan Lee" },
      { id: "5", name: "Taylor Wu" },
    ]
  },
];

// Helper functions
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatNameWithInitial(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}

// Soften a color for backgrounds
function softenColor(hex: string, amount: number = 0.08): string {
  return `${hex}${Math.round(amount * 255).toString(16).padStart(2, '0')}`;
}

// ============================================================
// PREMIUM CARD: The flagship design - refined and distinctive
// ============================================================
function PremiumCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.23, 1, 0.32, 1]
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative cursor-pointer"
    >
      {/* Ambient glow on hover */}
      <motion.div
        className="absolute -inset-2 rounded-3xl opacity-0 blur-xl transition-opacity duration-500"
        style={{ backgroundColor: softenColor(group.accentColor, 0.3) }}
        animate={{ opacity: isHovered ? 1 : 0 }}
      />

      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          background: 'linear-gradient(165deg, rgba(255,255,255,0.95) 0%, rgba(250,250,249,0.98) 100%)',
          boxShadow: isHovered
            ? `0 20px 40px -12px ${softenColor(group.accentColor, 0.25)}, 0 8px 16px -8px rgba(0,0,0,0.1)`
            : '0 4px 20px -4px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        {/* Top accent line */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${group.accentColor} 0%, ${group.accentColor}90 100%)`
          }}
        />

        {/* Main content */}
        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start gap-4">
            {/* Emoji container with subtle animation */}
            <motion.div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                backgroundColor: softenColor(group.accentColor, 0.12),
                boxShadow: `inset 0 -2px 8px ${softenColor(group.accentColor, 0.1)}`
              }}
              animate={{
                rotate: isHovered ? [0, -5, 5, 0] : 0,
                scale: isHovered ? 1.05 : 1
              }}
              transition={{ duration: 0.4 }}
            >
              {group.emoji}
            </motion.div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="font-semibold text-[1.1rem] text-stone-900 tracking-tight truncate">
                {group.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: softenColor(group.accentColor, 0.1),
                    color: group.accentColor
                  }}
                >
                  <Clock className="w-3 h-3" />
                  {group.meetingFrequency}
                </div>
                <span className="text-xs text-stone-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {group.locationBase}
                </span>
              </div>
            </div>

            {/* Next event badge */}
            {group.nextEventDate && (
              <motion.div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{
                  backgroundColor: group.accentColor,
                  color: 'white',
                  boxShadow: `0 4px 12px -2px ${softenColor(group.accentColor, 0.4)}`
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles className="w-3 h-3" />
                {group.nextEventDate}
              </motion.div>
            )}
          </div>
        </div>

        {/* Member section with refined styling */}
        <div
          className="px-5 py-4 border-t"
          style={{
            backgroundColor: softenColor(group.accentColor, 0.03),
            borderColor: softenColor(group.accentColor, 0.08)
          }}
        >
          <div className="flex items-center gap-3">
            {/* Stacked avatars */}
            <div className="flex -space-x-2">
              {group.members.slice(0, 4).map((member, idx) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 + idx * 0.05 }}
                >
                  <Avatar
                    className="w-8 h-8 ring-2 ring-white"
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
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
                </motion.div>
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

            {/* Member names */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-600 truncate">
                {group.members.slice(0, 3).map((m, i) => (
                  <span key={m.id}>
                    <span className="font-medium text-stone-700">{formatNameWithInitial(m.name)}</span>
                    {i < Math.min(2, group.members.length - 1) && (
                      <span className="text-stone-400">, </span>
                    )}
                  </span>
                ))}
                {group.members.length > 3 && (
                  <span className="text-stone-400"> +{group.members.length - 3}</span>
                )}
              </p>
            </div>

            {/* Arrow indicator */}
            <motion.div
              animate={{ x: isHovered ? 4 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-5 h-5 text-stone-300" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CHIP CARD: Members shown as interactive pills
// ============================================================
function ChipCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="group cursor-pointer"
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
        style={{
          background: 'white',
          boxShadow: '0 4px 24px -6px rgba(0,0,0,0.1), 0 2px 8px -4px rgba(0,0,0,0.04)',
          border: `1px solid ${softenColor(group.accentColor, 0.15)}`
        }}
      >
        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: softenColor(group.accentColor, 0.12),
                boxShadow: `0 4px 12px ${softenColor(group.accentColor, 0.15)}`
              }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-stone-900 tracking-tight">
                {group.name}
              </h3>
              <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: group.accentColor }} />
                {group.locationBase}
                <span className="text-stone-300 mx-1">·</span>
                {group.meetingFrequency}
              </p>
            </div>

            {group.nextEventDate && (
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-transform duration-200 hover:scale-105"
                style={{
                  backgroundColor: group.accentColor,
                  color: 'white'
                }}
              >
                {group.nextEventDate}
              </div>
            )}
          </div>
        </div>

        {/* Member chips */}
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: softenColor(group.accentColor, 0.04),
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          <div className="flex flex-wrap gap-2">
            {group.members.slice(0, 5).map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 + idx * 0.04 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: 'white',
                  border: `1.5px solid ${softenColor(group.accentColor, 0.2)}`,
                  color: 'rgb(68, 64, 60)', // stone-700
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: group.accentColor }}
                >
                  {getInitial(member.name)}
                </div>
                {formatNameWithInitial(member.name)}
              </motion.div>
            ))}
            {group.members.length > 5 && (
              <div
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: softenColor(group.accentColor, 0.1),
                  color: group.accentColor
                }}
              >
                +{group.members.length - 5} more
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// ROSTER CARD: Two-column member list, structured layout
// ============================================================
function RosterCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="group cursor-pointer"
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
        style={{
          background: 'white',
          boxShadow: '0 4px 20px -4px rgba(0,0,0,0.08)'
        }}
      >
        {/* Colored top bar */}
        <div
          className="h-1.5"
          style={{ backgroundColor: group.accentColor }}
        />

        {/* Header */}
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: softenColor(group.accentColor, 0.12) }}
            >
              {group.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-stone-900 truncate">
                {group.name}
              </h3>
              <p className="text-sm text-stone-500">
                {group.meetingFrequency} · {group.locationBase}
              </p>
            </div>

            {group.nextEventDate && (
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                style={{
                  backgroundColor: group.accentColor,
                  boxShadow: `0 4px 12px ${softenColor(group.accentColor, 0.35)}`
                }}
              >
                <Calendar className="w-3 h-3" />
                {group.nextEventDate}
              </div>
            )}
          </div>

          {/* Two-column member grid */}
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4"
            style={{ borderTop: `1px solid ${softenColor(group.accentColor, 0.1)}` }}
          >
            {group.members.slice(0, 6).map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 + idx * 0.03 }}
                className="flex items-center gap-2 py-1"
              >
                <Avatar className="w-6 h-6">
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.15),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-stone-700 truncate font-medium">
                  {formatNameWithInitial(member.name)}
                </span>
              </motion.div>
            ))}
          </div>
          {group.members.length > 6 && (
            <p
              className="text-xs mt-3 font-medium"
              style={{ color: group.accentColor }}
            >
              +{group.members.length - 6} more members
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// SOCIAL CARD: Horizontal avatar row, Instagram-style
// ============================================================
function SocialCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="group cursor-pointer"
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl"
        style={{
          background: `linear-gradient(160deg, white 0%, ${softenColor(group.accentColor, 0.06)} 100%)`,
          boxShadow: '0 8px 32px -8px rgba(0,0,0,0.12)',
          border: `1px solid ${softenColor(group.accentColor, 0.1)}`
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                style={{
                  backgroundColor: softenColor(group.accentColor, 0.12),
                  boxShadow: `0 8px 24px ${softenColor(group.accentColor, 0.2)}`
                }}
                whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
              >
                {group.emoji}
              </motion.div>
              <div>
                <h3 className="font-bold text-xl text-stone-900 tracking-tight">
                  {group.name}
                </h3>
                <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {group.locationBase}
                </p>
              </div>
            </div>

            {group.nextEventDate && (
              <div
                className="flex flex-col items-center px-4 py-2.5 rounded-xl"
                style={{
                  backgroundColor: softenColor(group.accentColor, 0.1),
                  border: `1px solid ${softenColor(group.accentColor, 0.15)}`
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Next</span>
                <span className="text-sm font-bold" style={{ color: group.accentColor }}>
                  {group.nextEventDate}
                </span>
              </div>
            )}
          </div>

          {/* Horizontal member avatars with names */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {group.members.map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 + idx * 0.05 }}
                className="flex flex-col items-center gap-2 flex-shrink-0"
              >
                <Avatar
                  className="w-12 h-12 ring-3 ring-white transition-transform duration-200 hover:scale-110"
                  style={{ boxShadow: `0 4px 12px ${softenColor(group.accentColor, 0.2)}` }}
                >
                  <AvatarFallback
                    className="text-sm font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${group.accentColor} 0%, ${group.accentColor}cc 100%)`,
                      color: 'white'
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-stone-600 font-medium whitespace-nowrap">
                  {formatNameWithInitial(member.name)}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between mt-4 pt-4"
            style={{ borderTop: `1px solid ${softenColor(group.accentColor, 0.1)}` }}
          >
            <span className="text-xs text-stone-400 font-medium">
              {group.meetingFrequency}
            </span>
            <motion.div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: group.accentColor }}
              whileHover={{ x: 4 }}
            >
              View group <ChevronRight className="w-4 h-4" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// MINIMAL CARD: Clean, compact, text-focused
// ============================================================
function MinimalCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      className="group cursor-pointer"
    >
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg"
        style={{
          background: 'white',
          boxShadow: '0 2px 12px -3px rgba(0,0,0,0.08)',
          borderLeft: `3px solid ${group.accentColor}`
        }}
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
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
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.15),
                      color: group.accentColor
                    }}
                  >
                    {group.nextEventDate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
                <Users className="w-3 h-3" />
                <span>{group.members.length}</span>
                <span className="text-stone-300">·</span>
                <span>{group.meetingFrequency}</span>
                <span className="text-stone-300">·</span>
                <MapPin className="w-3 h-3" />
                <span className="truncate">{group.locationBase}</span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-400 transition-colors flex-shrink-0" />
          </div>

          {/* Inline member names */}
          <div
            className="mt-3 pt-3"
            style={{ borderTop: `1px solid ${softenColor(group.accentColor, 0.1)}` }}
          >
            <p className="text-xs text-stone-600 leading-relaxed">
              {group.members.slice(0, 4).map((m, i) => (
                <span key={m.id}>
                  <span className="font-medium text-stone-700">{formatNameWithInitial(m.name)}</span>
                  {i < Math.min(3, group.members.length - 1) && (
                    <span className="text-stone-400">, </span>
                  )}
                </span>
              ))}
              {group.members.length > 4 && (
                <span className="text-stone-400"> +{group.members.length - 4} more</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// STRIP CARD: Avatar strip at bottom, clean separation
// ============================================================
function StripCard({ group, index = 0 }: { group: typeof sampleGroups[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="group cursor-pointer"
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
        style={{
          background: 'white',
          boxShadow: '0 4px 24px -6px rgba(0,0,0,0.1)'
        }}
      >
        {/* Header area */}
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{
                  backgroundColor: softenColor(group.accentColor, 0.1),
                  boxShadow: `inset 0 -3px 8px ${softenColor(group.accentColor, 0.08)}`
                }}
                whileHover={{ scale: 1.08 }}
              >
                {group.emoji}
              </motion.div>
              <div>
                <h3 className="font-bold text-lg text-stone-900">
                  {group.name}
                </h3>
                <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5">
                  {group.meetingFrequency}
                  <span className="text-stone-300">·</span>
                  <MapPin className="w-3.5 h-3.5" />
                  {group.locationBase}
                </p>
              </div>
            </div>

            {group.nextEventDate && (
              <div
                className="px-4 py-2 rounded-full text-xs font-bold text-white"
                style={{
                  backgroundColor: group.accentColor,
                  boxShadow: `0 4px 12px ${softenColor(group.accentColor, 0.35)}`
                }}
              >
                {group.nextEventDate}
              </div>
            )}
          </div>
        </div>

        {/* Member strip */}
        <div
          className="px-5 py-4"
          style={{
            background: `linear-gradient(180deg, ${softenColor(group.accentColor, 0.04)} 0%, ${softenColor(group.accentColor, 0.08)} 100%)`,
            borderTop: `1px solid ${softenColor(group.accentColor, 0.08)}`
          }}
        >
          <div className="flex gap-5 overflow-x-auto">
            {group.members.slice(0, 5).map((member, idx) => (
              <motion.div
                key={member.id}
                className="flex flex-col items-center gap-2 flex-shrink-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 + idx * 0.04 }}
              >
                <Avatar
                  className="w-11 h-11 ring-2 ring-white transition-transform duration-200 hover:scale-110"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                >
                  <AvatarFallback
                    className="text-sm font-bold"
                    style={{
                      backgroundColor: softenColor(group.accentColor, 0.2),
                      color: group.accentColor
                    }}
                  >
                    {getInitial(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-stone-700 font-medium text-center max-w-[56px] truncate">
                  {formatNameWithInitial(member.name)}
                </span>
              </motion.div>
            ))}
            {group.members.length > 5 && (
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white"
                  style={{
                    backgroundColor: softenColor(group.accentColor, 0.12),
                    color: group.accentColor
                  }}
                >
                  +{group.members.length - 5}
                </div>
                <span className="text-xs text-stone-400">more</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function PrototypeGroupCards() {
  const [selectedStyle, setSelectedStyle] = useState<string>("premium");

  const styles = [
    { id: "all", label: "All Styles" },
    { id: "premium", label: "Premium" },
    { id: "chips", label: "Chips" },
    { id: "roster", label: "Roster" },
    { id: "social", label: "Social" },
    { id: "minimal", label: "Minimal" },
    { id: "strip", label: "Strip" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-orange-50/30">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-stone-200/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <motion.h1
            className="text-2xl font-bold text-stone-900 tracking-tight"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Group Card Designs
          </motion.h1>
          <motion.p
            className="text-sm text-stone-500 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Refined glass cards with member names. Each shows "FirstName L." format.
          </motion.p>

          {/* Style selector pills */}
          <motion.div
            className="flex gap-2 mt-5 overflow-x-auto pb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {styles.map((style, idx) => (
              <motion.button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                  selectedStyle === style.id
                    ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.03 }}
              >
                {style.label}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Premium Cards */}
          {(selectedStyle === "all" || selectedStyle === "premium") && (
            <motion.section
              key="premium"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Premium</h2>
                <p className="text-sm text-stone-500">
                  Polished hover effects, ambient glow, stacked avatars with inline names.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sampleGroups.map((group, idx) => (
                  <PremiumCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Chip Cards */}
          {(selectedStyle === "all" || selectedStyle === "chips") && (
            <motion.section
              key="chips"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Member Chips</h2>
                <p className="text-sm text-stone-500">
                  Pill-shaped badges for each member. Great for quick visual scanning.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sampleGroups.map((group, idx) => (
                  <ChipCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Roster Cards */}
          {(selectedStyle === "all" || selectedStyle === "roster") && (
            <motion.section
              key="roster"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Member Roster</h2>
                <p className="text-sm text-stone-500">
                  Two-column grid layout. Structured and organized for larger groups.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sampleGroups.map((group, idx) => (
                  <RosterCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Social Cards */}
          {(selectedStyle === "all" || selectedStyle === "social") && (
            <motion.section
              key="social"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Social Style</h2>
                <p className="text-sm text-stone-500">
                  Large avatars in horizontal row with names. Instagram-inspired.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {sampleGroups.map((group, idx) => (
                  <SocialCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Minimal Cards */}
          {(selectedStyle === "all" || selectedStyle === "minimal") && (
            <motion.section
              key="minimal"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Minimal</h2>
                <p className="text-sm text-stone-500">
                  Compact with accent stripe. Space-efficient for long lists.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sampleGroups.map((group, idx) => (
                  <MinimalCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Strip Cards */}
          {(selectedStyle === "all" || selectedStyle === "strip") && (
            <motion.section
              key="strip"
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-bold text-stone-800">Avatar Strip</h2>
                <p className="text-sm text-stone-500">
                  Clean header with dedicated member strip footer. Balanced layout.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sampleGroups.map((group, idx) => (
                  <StripCard key={group.id} group={group} index={idx} />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Design Notes */}
        <motion.section
          className="mt-16 p-6 bg-white rounded-2xl shadow-sm border border-stone-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-lg font-bold text-stone-800 mb-4">Design Improvements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-stone-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Previous Issues
              </h3>
              <ul className="text-stone-600 space-y-1.5">
                <li>· Pastel backgrounds reduced text contrast</li>
                <li>· Text color derived from accent could clash</li>
                <li>· Only showed initials, not member names</li>
                <li>· Generic styling across all groups</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-stone-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                New Approach
              </h3>
              <ul className="text-stone-600 space-y-1.5">
                <li>· White/neutral backgrounds for readability</li>
                <li>· Accent color for borders, badges, highlights</li>
                <li>· Full names shown: "FirstName L." format</li>
                <li>· Polished micro-interactions and depth</li>
              </ul>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
