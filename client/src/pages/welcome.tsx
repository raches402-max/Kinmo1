/**
 * Welcome / invite-only gate.
 *
 * Public page (unauthenticated users only). Kinmo is invite-only during beta;
 * this page lets you redeem an invite code or sign up for the waitlist.
 *
 * States:
 *   - code:  primary entry, user types a code, we validate via POST /api/waitlist/redeem-code
 *   - no-code: secondary, user leaves email via POST /api/waitlist/signup
 *   - success: code was validated; "Sign in with Google" handoff
 *   - submitted-waitlist: thank-you for waitlist signups
 *
 * If Google OAuth rejects an email (?auth_error=not_invited or code_unavailable),
 * we land on this page with the relevant banner.
 */

import { useState, useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, KeyRound, Mail, Sparkles, X, AlertCircle } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

type View = "code" | "no-code" | "success" | "submitted-waitlist";

const AUTH_ERROR_COPY: Record<string, string> = {
  not_invited: "That email isn't on the invite list yet. Try a code, or join the waitlist below.",
  code_unavailable: "That code just filled up. Try another, or join the waitlist.",
  no_email: "We couldn't read your email from Google. Try again?",
};

export default function Welcome() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const authError = params.get("auth_error");

  const [view, setView] = useState<View>("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<{ label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  // Debounced validation as the user types.
  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      setValid(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setValidating(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/waitlist/redeem-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code: trimmed }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setValid({ label: data.label });
          setError(null);
        } else {
          setValid(null);
          setError(reasonCopy(data.reason));
        }
      } catch {
        if (!cancelled) {
          setValid(null);
          setError("Something went wrong. Try again?");
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code]);

  const handleContinue = () => {
    if (valid) setView("success");
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmittingWaitlist(true);
    try {
      await fetch("/api/waitlist/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      setView("submitted-waitlist");
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF7EF] text-foreground antialiased">
      <div className="mx-auto max-w-xl px-6 pt-16 pb-24">
        {/* Logo */}
        <div className="mb-12 flex items-center gap-2.5">
          <KinmoIcon className="h-7 w-7" />
          <span
            className="text-xl tracking-tight"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            Kinmo
          </span>
        </div>

        {authError && AUTH_ERROR_COPY[authError] && view === "code" && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/60 p-4 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{AUTH_ERROR_COPY[authError]}</p>
          </div>
        )}

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
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. frands"
                      className="h-12 pl-10 pr-10 text-base bg-white border-card-border/80 focus:border-[#F5C030] focus:ring-[#F5C030]/20"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <AnimatePresence>
                      {valid && (
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
                      {!valid && error && code.trim() && !validating && (
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
                    {valid && (
                      <motion.p
                        key="ok"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-sm text-muted-foreground"
                      >
                        Nice — <span className="text-foreground font-medium">{valid.label}</span>. Welcome in.
                      </motion.p>
                    )}
                    {!valid && error && code.trim() && !validating && (
                      <motion.p
                        key="no"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-sm text-rose-600/90"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={!valid || validating}
                  className="h-12 w-full text-base font-medium shadow-sm"
                  style={{
                    backgroundColor: valid ? "#F5C030" : undefined,
                    color: valid ? "#1a1a1a" : undefined,
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
                  disabled={submittingWaitlist || !email.trim()}
                  className="h-12 w-full text-base font-medium shadow-sm"
                  style={{ backgroundColor: "#F5C030", color: "#1a1a1a" }}
                >
                  {submittingWaitlist ? "Adding you…" : "Join the waitlist"}
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

function reasonCopy(reason: string): string {
  switch (reason) {
    case "not_found":
      return "Hmm, we don't recognize that one. Double-check with whoever invited you?";
    case "inactive":
      return "That code isn't active anymore. Ask whoever invited you for a fresh one?";
    case "expired":
      return "That code has expired. Ask whoever invited you for a fresh one?";
    case "full":
      return "That code just filled up. Join the waitlist below?";
    default:
      return "That code isn't working. Try another?";
  }
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
