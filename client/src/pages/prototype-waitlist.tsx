/**
 * Prototype: Waitlist / Invite-code redemption
 *
 * Visual mockup — no real API. Lets us preview the four states of the
 * "you're not on the allowlist yet" flow before wiring anything up.
 *
 * Flow concept:
 *   - Kinmo is invite-only. Friends/family get a code (e.g. "frands", "gold24").
 *   - Code redemption page captures the code, validates it client-side
 *     against a fake list for now, then prompts Google sign-in.
 *   - People without a code can leave their email for a manual review.
 *
 * State switcher at the top — flip between idle / valid / invalid / waitlist
 * / success to compare.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, KeyRound, Mail, Sparkles, X } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

const VALID_CODES: Record<string, { label: string; remaining: number }> = {
  frands: { label: "Frands", remaining: 18 },
  gold24: { label: "Gold list 2024", remaining: 7 },
  haas: { label: "Haas family", remaining: 42 },
};

type View = "code" | "no-code" | "success" | "submitted-waitlist";

export default function PrototypeWaitlist() {
  const [view, setView] = useState<View>("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const codeKey = code.trim().toLowerCase();
  const match = codeKey ? VALID_CODES[codeKey] : null;
  const codeState: "idle" | "valid" | "invalid" =
    !touched || !codeKey ? "idle" : match ? "valid" : "invalid";

  const handleContinue = () => {
    if (codeState === "valid") setView("success");
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setView("submitted-waitlist");
  };

  return (
    <div className="min-h-screen bg-[#FBF7EF] text-foreground antialiased">
      {/* Prototype state switcher — visible only on prototype */}
      <PrototypeControls view={view} setView={setView} />

      <div className="mx-auto max-w-xl px-6 pt-16 pb-24">
        {/* Logo / brand */}
        <div className="mb-12 flex items-center gap-2.5">
          <KinmoIcon className="h-7 w-7" />
          <span
            className="text-xl tracking-tight"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            Kinmo
          </span>
        </div>

        <AnimatePresence mode="wait">
          {view === "code" && (
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Eyebrow>Private beta</Eyebrow>
              <Headline>
                We're so <em className="not-italic" style={{ color: "#F5C030" }}>glad</em> you're here.
              </Headline>
              <Subhead>
                Drop in your invite code and we'll help you get&nbsp;started.
              </Subhead>

              <div className="mt-10 space-y-5">
                <div>
                  <Label htmlFor="code" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Invite code
                  </Label>
                  <div className="relative mt-2">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setTouched(true);
                      }}
                      placeholder="e.g. frands"
                      className="h-12 pl-10 pr-10 text-base bg-white border-card-border/80 focus:border-[#F5C030] focus:ring-[#F5C030]/20"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <AnimatePresence>
                      {codeState === "valid" && (
                        <motion.span
                          key="check"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-[#F5C030] text-white"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                      {codeState === "invalid" && (
                        <motion.span
                          key="x"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-rose-100 text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {codeState === "valid" && match && (
                      <motion.p
                        key="ok"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-sm text-muted-foreground"
                      >
                        Nice — <span className="text-foreground font-medium">{match.label}</span>. Welcome in.
                      </motion.p>
                    )}
                    {codeState === "invalid" && (
                      <motion.p
                        key="no"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-sm text-rose-600/90"
                      >
                        Hmm, we don't recognize that one. Double-check with whoever invited you?
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={codeState !== "valid"}
                  className="h-12 w-full text-base font-medium shadow-sm"
                  style={{
                    backgroundColor: codeState === "valid" ? "#F5C030" : undefined,
                    color: codeState === "valid" ? "#1a1a1a" : undefined,
                  }}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <Divider />

              <button
                onClick={() => setView("no-code")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Don't have a code yet? <span className="underline underline-offset-2">Here's our waitlist</span>
              </button>

              <p className="mt-8 text-xs text-muted-foreground/70">
                Already signed in before? <a href="/api/login" className="underline underline-offset-2 hover:text-foreground">Sign in with Google</a>.
              </p>
            </motion.div>
          )}

          {view === "no-code" && (
            <motion.div
              key="no-code"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Eyebrow>Waitlist</Eyebrow>
              <Headline>
                We'll <em className="not-italic" style={{ color: "#F5C030" }}>save you</em> a seat.
              </Headline>
              <Subhead>
                Leave your email and we'll reach out as we open up more spots. No spam — just a note when it's your turn.
              </Subhead>

              <form onSubmit={handleWaitlistSubmit} className="mt-10 space-y-5">
                <div>
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Your email
                  </Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="h-12 pl-10 text-base bg-white border-card-border/80 focus:border-[#F5C030] focus:ring-[#F5C030]/20"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full text-base font-medium shadow-sm"
                  style={{ backgroundColor: "#F5C030", color: "#1a1a1a" }}
                >
                  Join the waitlist
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <Divider />

              <button
                onClick={() => setView("code")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Got a code after all? <span className="underline underline-offset-2">Enter it</span>
              </button>
            </motion.div>
          )}

          {view === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                className="mb-8 grid h-14 w-14 place-items-center rounded-full"
                style={{ backgroundColor: "#F5C030" }}
              >
                <Check className="h-7 w-7 text-white" strokeWidth={2.5} />
              </motion.div>

              <Eyebrow>You're in</Eyebrow>
              <Headline>
                Welcome to <em className="not-italic" style={{ color: "#F5C030" }}>Kinmo</em>.
              </Headline>
              <Subhead>
                One last step — sign in with Google so we can save your account.
              </Subhead>

              <div className="mt-10">
                <Button
                  asChild
                  className="h-12 w-full text-base font-medium shadow-sm bg-white hover:bg-white/90 text-foreground border border-card-border"
                >
                  <a href="/api/login">
                    <GoogleMark className="mr-2.5 h-4 w-4" />
                    Sign in with Google
                  </a>
                </Button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground/70">
                We'll only use your name and email — nothing else.
              </p>
            </motion.div>
          )}

          {view === "submitted-waitlist" && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                className="mb-8 grid h-14 w-14 place-items-center rounded-full bg-white border border-card-border"
              >
                <Mail className="h-6 w-6" style={{ color: "#F5C030" }} />
              </motion.div>

              <Eyebrow>You're on the list</Eyebrow>
              <Headline>Talk soon.</Headline>
              <Subhead>
                We'll email <span className="text-foreground font-medium">{email || "you"}</span> as we open up more spots. In the meantime, ask around — someone in your circles might already have a code.
              </Subhead>

              <Divider />

              <Link href="/">
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Back to home
                </a>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───── helpers ───── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-xs uppercase tracking-[0.22em] text-muted-foreground/80">
      {children}
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-4xl sm:text-5xl tracking-tight leading-[1.05]"
      style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
    >
      {children}
    </h1>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-8 h-px bg-card-border/50" />;
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/* Prototype-only floating state switcher */
function PrototypeControls({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  const states: { value: View; label: string }[] = useMemo(
    () => [
      { value: "code", label: "Code entry" },
      { value: "no-code", label: "Waitlist signup" },
      { value: "success", label: "Code accepted" },
      { value: "submitted-waitlist", label: "Waitlist submitted" },
    ],
    []
  );
  return (
    <div className="sticky top-0 z-50 bg-[#FBF7EF]/80 backdrop-blur border-b border-card-border/40">
      <div className="mx-auto max-w-xl px-6 py-2.5 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground/70 mr-1">Preview:</span>
        {states.map((s) => (
          <button
            key={s.value}
            onClick={() => setView(s.value)}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              view === s.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-card-border/30"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-muted-foreground/50 ml-auto hidden sm:inline">
          try codes: frands · gold24 · haas
        </span>
      </div>
    </div>
  );
}
