/**
 * Prototype: Create Event — redesigned
 *
 * Drops the upfront "Manual vs AI" chooser. Opens straight to a single
 * editor where every field is optional and AI shows up as a soft helper
 * next to each field, not as a chosen path. Voice: helpful friend.
 *
 * Route: /prototype/create-event
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Send,
  Bookmark,
  Calendar,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Sample data ──────────────────────────────────────────────────────────
const GROUP = {
  name: "Eric & Rachel",
  emoji: "🌿",
  memberCount: 2,
};

const SUGGESTED_TIMES = [
  { label: "Saturday afternoon", sub: "you've both been free Sat 2–6pm last 3 weeks" },
  { label: "Friday evening", sub: "matches your usual rhythm" },
  { label: "Next Wednesday", sub: "Rachel mentioned she's free midweek" },
];

const SUGGESTED_VENUES = [
  {
    name: "Tartine Manufactory",
    type: "Cafe · Mission",
    reason: "You went here in March — Eric loved it",
    photoUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop",
  },
  {
    name: "Devil's Teeth Baking",
    type: "Bakery · Outer Sunset",
    reason: "Saved to favorites · never tried",
    photoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop",
  },
  {
    name: "Trick Dog",
    type: "Bar · Mission",
    reason: "Pattern: you like cozy bars after dinner",
    photoUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200&h=200&fit=crop",
  },
];

const QUICK_TIMES = ["Tonight", "This weekend", "Next week", "Pick a date"];

// ─── Component ─────────────────────────────────────────────────────────────
export default function PrototypeCreateEvent() {
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");

  const [whenHelperOpen, setWhenHelperOpen] = useState(false);
  const [whenHelperLoading, setWhenHelperLoading] = useState(false);

  const [whereHelperOpen, setWhereHelperOpen] = useState(false);
  const [whereHelperLoading, setWhereHelperLoading] = useState(false);

  const [sent, setSent] = useState(false);

  // Cmd+Enter to send
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ─── Helpers ────────────────────────────────────────────────────────────
  const askGroupWhen = () => {
    setWhenHelperOpen(true);
    setWhenHelperLoading(true);
    setTimeout(() => setWhenHelperLoading(false), 1100);
  };

  const suggestPlaces = () => {
    setWhereHelperOpen(true);
    setWhereHelperLoading(true);
    setTimeout(() => setWhereHelperLoading(false), 900);
  };

  const handleSend = () => {
    setSent(true);
    setTimeout(() => setSent(false), 2600);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Soft atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 -left-20 w-[560px] h-[560px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-secondary/[0.06] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-accent/[0.04] blur-3xl" />
      </div>

      {/* Sent confirmation toast */}
      <AnimatePresence>
        {sent && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2.5 bg-card/95 backdrop-blur-sm border border-card-border shadow-warm-lg rounded-pill px-4 py-2.5">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-foreground" strokeWidth={3} />
              </div>
              <span className="text-sm font-medium text-foreground">
                Sent to {GROUP.name}
              </span>
              <span className="text-sm text-muted-foreground">
                they'll let you know
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main composition */}
      <div className="relative mx-auto max-w-2xl px-6 pt-20 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70 mb-3">
            Create an event
          </div>
          <h1
            className="text-[2.5rem] leading-[1.05] tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            What are you thinking for{" "}
            <span className="italic text-foreground/90">{GROUP.name}</span>?
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-md">
            Drop in whatever you've got. We'll help with the rest.
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
          }}
          className="space-y-7"
        >
          {/* WHEN ─────────────────────────────────────────────────────── */}
          <FieldRow
            label="When"
            helperLabel="ask the group when they're free"
            helperOnClick={askGroupWhen}
            helperLoading={whenHelperLoading}
            helperOpen={whenHelperOpen}
          >
            <Input
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="anytime this week?"
              className="bg-card border-card-border rounded-soft h-12 text-base placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
            />
            {!when && (
              <div className="flex flex-wrap gap-2 mt-3">
                {QUICK_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setWhen(t)}
                    className="px-3 py-1.5 rounded-pill text-xs text-foreground/70 bg-muted/70 hover:bg-muted hover:text-foreground border border-transparent hover:border-card-border transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {whenHelperOpen && (
                <SuggestionPanel
                  loading={whenHelperLoading}
                  loadingLabel="checking who's around…"
                  onClose={() => setWhenHelperOpen(false)}
                >
                  {SUGGESTED_TIMES.map((t, i) => (
                    <SuggestionRow
                      key={t.label}
                      index={i}
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      title={t.label}
                      sub={t.sub}
                      onPick={() => {
                        setWhen(t.label);
                        setWhenHelperOpen(false);
                      }}
                    />
                  ))}
                </SuggestionPanel>
              )}
            </AnimatePresence>
          </FieldRow>

          {/* WHERE ────────────────────────────────────────────────────── */}
          <FieldRow
            label="Where"
            helperLabel="suggest places we'd like"
            helperOnClick={suggestPlaces}
            helperLoading={whereHelperLoading}
            helperOpen={whereHelperOpen}
          >
            <Input
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="somewhere in the Mission?"
              className="bg-card border-card-border rounded-soft h-12 text-base placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
            />

            <AnimatePresence>
              {whereHelperOpen && (
                <SuggestionPanel
                  loading={whereHelperLoading}
                  loadingLabel="looking through your history…"
                  onClose={() => setWhereHelperOpen(false)}
                >
                  {SUGGESTED_VENUES.map((v, i) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => {
                        setWhere(v.name);
                        setWhereHelperOpen(false);
                      }}
                      className="group w-full text-left"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.3 }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-soft hover:bg-muted/60 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                          <img
                            src={v.photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {v.name}
                            </span>
                            <span className="text-xs text-muted-foreground/70">·</span>
                            <span className="text-xs text-muted-foreground/80 truncate">
                              {v.type}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground/80 mt-0.5 italic">
                            {v.reason}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground">
                          pick →
                        </div>
                      </motion.div>
                    </button>
                  ))}
                </SuggestionPanel>
              )}
            </AnimatePresence>
          </FieldRow>

          {/* NOTE ─────────────────────────────────────────────────────── */}
          <FieldRow label="Say something" optional>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="what would you say?"
              rows={3}
              className="bg-card border-card-border rounded-soft text-base placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 resize-none"
            />
          </FieldRow>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-10 flex items-center justify-between"
        >
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Save for later
          </button>

          <Button
            onClick={handleSend}
            size="lg"
            className="rounded-pill px-7 h-12 bg-primary hover:bg-primary text-primary-foreground shadow-gold hover:shadow-gold-lg hover:-translate-y-px transition-all group"
          >
            <span className="text-base font-medium">Send to {GROUP.name}</span>
            <Send className="ml-2 w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Button>
        </motion.div>

        <p className="mt-4 text-xs text-muted-foreground/60 text-right">
          press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘↵</kbd> to send
        </p>
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  optional?: boolean;
  helperLabel?: string;
  helperOnClick?: () => void;
  helperLoading?: boolean;
  helperOpen?: boolean;
  children: React.ReactNode;
}

function FieldRow({
  label,
  optional,
  helperLabel,
  helperOnClick,
  helperLoading,
  helperOpen,
  children,
}: FieldRowProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
      }}
      className="space-y-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground/90">
          {label}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground/70">
              optional
            </span>
          )}
        </label>

        {helperLabel && helperOnClick && (
          <button
            type="button"
            onClick={helperOnClick}
            disabled={helperLoading || helperOpen}
            className={cn(
              "group inline-flex items-center gap-1.5 text-xs transition-colors",
              "text-muted-foreground hover:text-foreground",
              "disabled:opacity-60",
            )}
          >
            <SparklesIcon spinning={helperLoading} />
            <span className="border-b border-dashed border-muted-foreground/40 group-hover:border-foreground/60 transition-colors">
              {helperLabel}
            </span>
          </button>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function SparklesIcon({ spinning }: { spinning?: boolean }) {
  return (
    <motion.span
      animate={
        spinning
          ? { rotate: [0, 12, -8, 0], scale: [1, 1.15, 0.95, 1] }
          : { rotate: 0, scale: 1 }
      }
      transition={
        spinning
          ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
      className="inline-block"
    >
      <Sparkles className="w-3.5 h-3.5 text-primary/90" />
    </motion.span>
  );
}

interface SuggestionPanelProps {
  loading?: boolean;
  loadingLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}

function SuggestionPanel({
  loading,
  loadingLabel,
  onClose,
  children,
}: SuggestionPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-soft border border-card-border bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-card-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <ShimmerDots />
            ) : (
              <Sparkles className="w-3 h-3 text-primary" />
            )}
            <span>{loading ? loadingLabel : "what we'd suggest"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground p-1 rounded-md hover:bg-muted/60 transition-colors"
            aria-label="Close suggestions"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="px-2 py-6 flex items-center justify-center">
              <ShimmerLines />
            </div>
          ) : (
            <div className="space-y-0.5">{children}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SuggestionRow({
  index,
  icon,
  title,
  sub,
  onPick,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="group w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-soft hover:bg-muted/60 transition-colors"
    >
      <div className="mt-0.5 w-7 h-7 rounded-md bg-secondary/30 text-foreground/70 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground/80 mt-0.5">{sub}</div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground self-center">
        pick →
      </div>
    </motion.button>
  );
}

// Pulsing dots for the "loading" state — softer than a spinner
function ShimmerDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-primary"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -1, 0] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function ShimmerLines() {
  return (
    <div className="w-full max-w-xs space-y-2">
      {[100, 84, 92].map((w, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-pill bg-gradient-to-r from-muted via-muted/60 to-muted"
          style={{ width: `${w}%`, backgroundSize: "200% 100%" }}
          animate={{ backgroundPosition: ["0% 0%", "-200% 0%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
