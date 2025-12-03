import { motion } from "framer-motion";
import { Check, HelpCircle, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RsvpStatus } from "./types";

interface PendingRsvpPromptProps {
  onChangeMyRsvp?: (response: RsvpStatus) => void;
  eventName?: string;
}

export function PendingRsvpPrompt({ onChangeMyRsvp, eventName }: PendingRsvpPromptProps) {
  const rsvpOptions = [
    {
      status: "yes" as RsvpStatus,
      label: "I'm in!",
      emoji: "🎉",
      bgClass: "bg-gradient-to-br from-emerald-500 to-green-600",
      hoverClass: "hover:from-emerald-400 hover:to-green-500",
      shadowClass: "shadow-emerald-500/25",
    },
    {
      status: "maybe" as RsvpStatus,
      label: "Maybe",
      emoji: "🤔",
      bgClass: "bg-gradient-to-br from-amber-500 to-orange-500",
      hoverClass: "hover:from-amber-400 hover:to-orange-400",
      shadowClass: "shadow-amber-500/25",
    },
    {
      status: "no" as RsvpStatus,
      label: "Can't make it",
      emoji: "😢",
      bgClass: "bg-gradient-to-br from-rose-500 to-red-600",
      hoverClass: "hover:from-rose-400 hover:to-red-500",
      shadowClass: "shadow-rose-500/25",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary via-violet-500 to-primary bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite] p-[2px]">
        <div className="absolute inset-[2px] rounded-[14px] bg-card" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5">
        {/* Header with sparkle */}
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </motion.div>
          <span className="text-base font-semibold text-foreground">
            Are you coming?
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground mb-5">
          Let everyone know if you can make it{eventName ? ` to ${eventName}` : ""}
        </p>

        {/* RSVP Buttons - large and tappable */}
        <div className="flex gap-3">
          {rsvpOptions.map((option, index) => (
            <motion.button
              key={option.status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.1, duration: 0.3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChangeMyRsvp?.(option.status)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl",
                "text-white font-medium shadow-lg transition-all duration-200",
                "active:shadow-md",
                option.bgClass,
                option.hoverClass,
                option.shadowClass
              )}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="text-sm font-semibold">{option.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}
