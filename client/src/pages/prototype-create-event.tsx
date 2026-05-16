/**
 * Prototype: Create Event — redesigned
 *
 * Patterned on EditItineraryDialog (the existing edit-event experience):
 * same Dialog wrapper, same Label/Input rhythm, same Cancel/primary
 * footer. Two paths per field: type it in OR tap a contextual AI helper.
 *
 * Layered "When" helper ("help us find a time"):
 *  1. If we know the group's rhythm (default): show 3 AI-picked times
 *     based on their patterns, with a subtle "check with the group
 *     instead" link for weeks that might be unusual.
 *  2. If no history yet: skip the suggestions and offer a pulse
 *     ("we don't know your rhythm yet — want to ask the group?").
 *
 * Route: /prototype/create-event
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Send, Calendar, MapPin, X, Check, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Build 15-minute time slots from 7:00 AM through 11:45 PM
const TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 7; h <= 23; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const display12h = ((h + 11) % 12) + 1;
      const period = h < 12 ? "AM" : "PM";
      const label = `${display12h}:${mm} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

const GROUP_TIMEZONE_LABEL = "Pacific time (San Francisco)";

// ─── Sample data ──────────────────────────────────────────────────────────
const GROUP = { name: "Eric & Rachel" };

const SUGGESTED_TIMES = [
  { label: "Saturday, May 24 · 2:00 PM", sub: "you usually meet weekends in the afternoon" },
  { label: "Tuesday, May 27 · 6:30 PM", sub: "Tuesday evenings work most weeks" },
  { label: "Thursday, May 29 · 7:00 PM", sub: "Eric prefers later in the week" },
];

const SUGGESTED_VENUES = [
  {
    name: "Tartine Manufactory",
    type: "Cafe · Mission",
    reason: "You went here in March — Eric loved it",
  },
  {
    name: "Devil's Teeth Baking",
    type: "Bakery · Outer Sunset",
    reason: "Saved to favorites · never tried",
  },
  {
    name: "Trick Dog",
    type: "Bar · Mission",
    reason: "Pattern: you like cozy bars after dinner",
  },
];

// ─── Component ────────────────────────────────────────────────────────────
type WhenPanelState =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "suggestions" }
  | { kind: "pulse-sent" }
  | { kind: "no-history" };

export default function PrototypeCreateEvent() {
  const [open, setOpen] = useState(true);
  const [previewEmpty, setPreviewEmpty] = useState(false); // demo toggle

  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [venue, setVenue] = useState("");
  const [note, setNote] = useState("");

  const [whenPanel, setWhenPanel] = useState<WhenPanelState>({ kind: "closed" });
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

  // ─── Helpers ──────────────────────────────────────────────────────────
  const helpFindTime = () => {
    setWhenPanel({ kind: "loading" });
    setTimeout(() => {
      setWhenPanel(previewEmpty ? { kind: "no-history" } : { kind: "suggestions" });
    }, 1000);
  };

  const checkWithGroup = () => {
    setWhenPanel({ kind: "pulse-sent" });
  };

  const suggestPlaces = () => {
    setWhereHelperOpen(true);
    setWhereHelperLoading(true);
    setTimeout(() => setWhereHelperLoading(false), 900);
  };

  const handleSend = () => {
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1800);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/40">
      {/* Prototype chrome */}
      <div className="px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">
            Prototype
          </p>
          <h2 className="text-lg font-medium text-foreground/80">
            Create Event — redesigned
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Mirrors the Edit Plan dialog. The "When" helper is layered: AI
            suggests times based on what we know about the group, with a
            "check with the group" escape hatch for unusual weeks.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {!open && (
              <Button onClick={() => setOpen(true)}>Reopen modal</Button>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={previewEmpty}
                onChange={(e) => setPreviewEmpty(e.target.checked)}
                className="rounded border-muted-foreground/40"
              />
              Preview the "no history yet" empty state
            </label>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create event for {GROUP.name}</DialogTitle>
            <DialogDescription>
              Drop in a date and a place, or tap a helper to figure it out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* WHEN ───────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="create-event-date">Event Date & Time</Label>
                <HelperLink
                  label="help us find a time"
                  onClick={helpFindTime}
                  loading={whenPanel.kind === "loading"}
                  disabled={whenPanel.kind !== "closed"}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                <Input
                  id="create-event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  data-testid="input-create-event-date"
                />
                <Select value={eventTime} onValueChange={setEventTime}>
                  <SelectTrigger
                    id="create-event-time"
                    data-testid="select-create-event-time"
                    className="w-full"
                  >
                    <SelectValue placeholder="Pick a time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TIME_SLOTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Times in {GROUP_TIMEZONE_LABEL}. Members in other time zones
                will see this converted to theirs.
              </p>

              <AnimatePresence>
                {whenPanel.kind !== "closed" && (
                  <WhenPanel
                    state={whenPanel}
                    onClose={() => setWhenPanel({ kind: "closed" })}
                    onPickTime={(_label) => {
                      setEventDate("2026-05-24");
                      setEventTime("14:00");
                      setWhenPanel({ kind: "closed" });
                    }}
                    onCheckWithGroup={checkWithGroup}
                    onAskGroup={checkWithGroup}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* WHERE ──────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="create-event-venue">Venue</Label>
                <HelperLink
                  label="suggest places we'd like"
                  onClick={suggestPlaces}
                  loading={whereHelperLoading}
                  disabled={whereHelperOpen}
                />
              </div>
              <Input
                id="create-event-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g., Tartine Manufactory"
                data-testid="input-create-event-venue"
              />

              <AnimatePresence>
                {whereHelperOpen && (
                  <SuggestionPanel
                    loading={whereHelperLoading}
                    loadingLabel="looking through your history…"
                    onClose={() => setWhereHelperOpen(false)}
                  >
                    {SUGGESTED_VENUES.map((v, i) => (
                      <SuggestionRow
                        key={v.name}
                        index={i}
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        title={v.name}
                        sub={`${v.type} — ${v.reason}`}
                        onPick={() => {
                          setVenue(v.name);
                          setWhereHelperOpen(false);
                        }}
                      />
                    ))}
                  </SuggestionPanel>
                )}
              </AnimatePresence>
            </div>

            {/* NOTE ───────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <Label htmlFor="create-event-note">Note (optional)</Label>
              <Textarea
                id="create-event-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to say to the group?"
                className="min-h-[80px]"
                data-testid="textarea-create-event-note"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="bg-primary hover:bg-primary text-primary-foreground shadow-gold group"
            >
              <Send className="mr-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              Send to {GROUP.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sent confirmation — soft pill from top */}
      <AnimatePresence>
        {sent && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]"
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
    </div>
  );
}

// ─── When panel (layered) ─────────────────────────────────────────────────

function WhenPanel({
  state,
  onClose,
  onPickTime,
  onCheckWithGroup,
  onAskGroup,
}: {
  state: WhenPanelState;
  onClose: () => void;
  onPickTime: (label: string) => void;
  onCheckWithGroup: () => void;
  onAskGroup: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="rounded-md border border-card-border bg-muted/30">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-card-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {state.kind === "loading" ? (
              <>
                <ShimmerDots />
                <span>checking what we know about the group…</span>
              </>
            ) : state.kind === "suggestions" ? (
              <>
                <Sparkles className="w-3 h-3 text-primary" />
                <span>based on what we know about your group</span>
              </>
            ) : state.kind === "pulse-sent" ? (
              <>
                <Users className="w-3 h-3 text-primary" />
                <span>asked {GROUP.name}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-primary" />
                <span>no history yet</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground p-1 rounded-md hover:bg-muted/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Body */}
        <div className="p-2">
          {state.kind === "loading" && (
            <div className="px-2 py-6 flex items-center justify-center">
              <ShimmerLines />
            </div>
          )}

          {state.kind === "suggestions" && (
            <>
              <div className="space-y-0.5">
                {SUGGESTED_TIMES.map((t, i) => (
                  <SuggestionRow
                    key={t.label}
                    index={i}
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    title={t.label}
                    sub={t.sub}
                    onPick={() => onPickTime(t.label)}
                  />
                ))}
              </div>
              {/* Escape hatch */}
              <div className="border-t border-card-border/60 mt-2 px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground/80">
                  This week feel unusual?
                </span>
                <button
                  type="button"
                  onClick={onCheckWithGroup}
                  className="inline-flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground"
                >
                  <Users className="w-3 h-3" />
                  <span className="border-b border-dashed border-muted-foreground/40 hover:border-foreground/60 transition-colors">
                    check with the group
                  </span>
                </button>
              </div>
            </>
          )}

          {state.kind === "no-history" && (
            <div className="px-3 py-5 text-center">
              <p className="text-sm text-foreground/80">
                We don't know your rhythm yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Want to ask the group when they're free?
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={onAskGroup}
                className="gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Ask {GROUP.name}
              </Button>
            </div>
          )}

          {state.kind === "pulse-sent" && (
            <div className="px-3 py-5 text-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="mx-auto w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center mb-3"
              >
                <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
              </motion.div>
              <p className="text-sm font-medium text-foreground">
                We'll ask {GROUP.name} which of these works best
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                You'll see their responses here. No pressure on them to
                reply right away.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Generic suggestion panel (used for Venue) ────────────────────────────

function SuggestionPanel({
  loading,
  loadingLabel,
  onClose,
  children,
}: {
  loading?: boolean;
  loadingLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="rounded-md border border-card-border bg-muted/30">
        <div className="flex items-center justify-between px-3 py-2 border-b border-card-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? <ShimmerDots /> : <Sparkles className="w-3 h-3 text-primary" />}
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

// ─── Shared bits ──────────────────────────────────────────────────────────

function HelperLink({
  label,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "group inline-flex items-center gap-1.5 text-xs transition-colors",
        "text-muted-foreground hover:text-foreground",
        "disabled:opacity-60",
      )}
    >
      <SparklesIcon spinning={loading} />
      <span className="border-b border-dashed border-muted-foreground/40 group-hover:border-foreground/60 transition-colors">
        {label}
      </span>
    </button>
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
      className="group w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-card transition-colors"
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
