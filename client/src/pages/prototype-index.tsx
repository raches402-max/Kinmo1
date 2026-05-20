/**
 * Prototype Index
 *
 * Lists every /prototype/* route shipping in the app. These are visual
 * mockups with hardcoded data — no real API calls, no auth, public.
 *
 * To remove all prototypes from prod: delete the block in App.tsx
 * marked "PROTOTYPE ROUTES" and delete the prototype-*.tsx files.
 */

import { Link } from "wouter";

interface PrototypeEntry {
  path: string;
  title: string;
  note?: string;
  // Approximate vintage so old experiments are easy to spot
  added?: string;
}

const PROTOTYPES: PrototypeEntry[] = [
  // Most recent first
  { path: "/prototype/waitlist", title: "Waitlist / invite code", note: "code redemption + waitlist signup states", added: "2026-05" },
  { path: "/prototype/create-event", title: "Create Event (redesigned)", note: "single-screen editor, contextual AI helpers", added: "2026-05" },
  { path: "/prototype/dashboard-v2", title: "Dashboard v2" },
  { path: "/prototype/dashboard-redesign", title: "Dashboard redesign" },
  { path: "/prototype/feedback-mockup", title: "Feedback mockup" },
  { path: "/prototype/headline-layouts", title: "Headline layouts" },
  { path: "/prototype/kinmo-text", title: "Kinmo text treatments" },
  { path: "/prototype/nav", title: "Bottom nav concepts" },
  { path: "/prototype/timeline-info", title: "Timeline info" },
  { path: "/prototype/availability-grid", title: "Availability grid" },
  { path: "/prototype/places", title: "Places" },
  { path: "/prototype/group-details-desktop", title: "Group details (desktop)" },
  { path: "/prototype/event-details-desktop", title: "Event details (desktop)" },
  { path: "/prototype/event-details-mobile", title: "Event details (mobile)" },
  { path: "/prototype/event-cards", title: "Event cards" },
  { path: "/prototype/group-cards-mobile", title: "Group cards (mobile)" },
  { path: "/prototype/group-cards", title: "Group cards" },
  { path: "/prototype/group-tiles", title: "Group tiles" },
];

export default function PrototypeIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70 mb-3">
            Kinmo prototypes
          </div>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            Design experiments
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Visual mockups with fake data. Not wired to anything real.
            Shippable for preview-from-anywhere — delete when no longer useful.
          </p>
        </div>

        <ul className="divide-y divide-card-border/60">
          {PROTOTYPES.map((p) => (
            <li key={p.path}>
              <Link href={p.path}>
                <a className="group flex items-baseline gap-4 py-4 hover:bg-muted/40 -mx-3 px-3 rounded-soft transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-foreground group-hover:text-foreground">
                      {p.title}
                    </div>
                    {p.note && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.note}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground/70 font-mono">
                    {p.added ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground/50 font-mono truncate max-w-[200px]">
                    {p.path}
                  </div>
                </a>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-xs text-muted-foreground/70">
          To remove all prototypes: delete the <code className="font-mono text-foreground/80">PROTOTYPE ROUTES</code> block in <code className="font-mono text-foreground/80">client/src/App.tsx</code> and the <code className="font-mono text-foreground/80">client/src/pages/prototype-*.tsx</code> files.
        </p>
      </div>
    </div>
  );
}
