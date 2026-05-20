# Kinmo V2 — Master Plan

_Last updated: 2026-05-20 (rev 18 — W8 Sub-track A fully closed: deploy went out (after a Railway GCP-account-suspension outage held it up overnight) and the backfill ran lax (≥1 yes-RSVP) against prod. `venue_visit_history` went 0→6 rows; `itineraries.completed` went 1→7 of 56. Added `--remove` mode to the backfill script (`37a74ef`) as a corrective mechanism for false positives. Live job uses ≥2 threshold (`e2bf7ca`); backfill uses ≥1 with removability — asymmetry by design (adding signal is cheap, removing it is easy via --remove). Follow-ups A.5/A.6/A.7 still ahead. W9 Sub-track A was the prior milestone, `7f33c47..df0f5cf`.)_

## Context

This document is the working plan for getting Kinmo V2 production-ready: off Replit, on a sustainable hosting stack, with API costs under control and a codebase we can actually maintain. No live users yet — we can move fast and break things, then stabilize.

**Working sequence:** Dead code purge → hosting migration → finish auth → API cost control → architecture cleanup. Deletion happens BEFORE refactor — every line deleted is one we don't migrate, refactor, or test.

---

## Status snapshot

| # | Workstream | Status |
|---|---|---|
| 0 | Dead code purge | ✅ **DONE** (2026-05-11; 47 files, 13,341 LOC, 14 npm deps removed) |
| 1 | Hosting migration off Replit | ✅ **DONE** (2026-05-12; live on Railway at https://kinmo-production.up.railway.app, Postgres + Google OAuth + 8,800 rows migrated) |
| 2 | Finish auth migration | ✅ **DONE** (production OAuth works; Replit script/env cleanup shipped in `9c6fef0`; only manual logout flow test remains) |
| 3 | API cost control | ✅ **DONE** through tier 4 (`0583809..ccf5928`). Batch API (`ac78be8`) was reverted in `6d618ac` as a scope/coordination rollback (per Franky, not a known bug). **Status: paused, not abandoned.** The `ai_batch_requests` table from migration `0015` is kept on Neon + Railway intentionally — if Batch API is reopened, the migration is reusable as-is. If later abandoned, do it via a tracked DROP migration, not an ad-hoc DB change. **Do not touch this area until explicitly reopened.** |
| 4 | Architecture cleanup | 🔄 **In progress** — Slices 2 (`7506c88`) + 4 (`7dfbe21` safeError sweep on 391 callsites) done; slices 1 (group server/ by domain) + 3 (split storage.ts) remain |
| 5 | Code hygiene | 🔄 Ongoing — Sentry on 3 RSVP fire-and-forget catches done (`771f1f7`); frontend Sentry verified by Franky; events.ts refactor fixed (`9d239d8`); advisory lock verified OK in 2026-05-12 audit; env validation hardened in `f457eac` (Zod superRefine with NODE_ENV-aware required checks) |
| 6 | Security & data-integrity hardening | 🔄 In progress — sub-tracks A (`67b286f` + `79292b7` finishing touches), B (`771f1f7`), C (`0d1b819`), D (`920cf6b` + migration 0016 — apply to Railway pending), E (`2a17050` member-read soft-delete fix), F (`dc8f207`) shipped; G/H remain |
| 7 | Quorum & auto-reschedule system | ✅ **DONE** (2026-05-15) — proactive deadline-based quorum checks, adaptive timing by cadence, skip-vs-reschedule by cycle length, check-in flow for partial engagement, notification over-send fixes. See details below. |
| 8 | Recommendation foundations | 🔄 **In progress** — Sub-track A fully closed (`e2bf7ca` live job + `37a74ef` --remove mode for backfill); deploy went out + backfill applied 2026-05-20, `venue_visit_history` 0→6, `itineraries.completed` 1→7. Follow-ups A.5 (auto-promote proposed→scheduled on quorum), A.6 (per-member past-events view), A.7 (feedback collection rework) still ahead. Sub-track B (manual curation of ~5,300 venues) + C (data-driven refinement) further out. See W8 below. |
| 9 | Scheduler reliability | 🔄 **In progress** — Sub-track A done (`7f33c47` dedupe WeeklyDigest, `06c3db9` 30s timeouts on OpenAI + Google Places, `bf3fd29` staggered 14 jobs across the hour, `df0f5cf` removed the esbuild-incompatible CLI block that was the actual outage root cause). Sub-track B (urgent-timeline fix, in-job concurrency caps, scheduler heartbeats) + C (split worker from web) remain. See W9 below. |

**Production cost:** ~$10/mo on Railway (app + Postgres). API keys (OpenAI, Resend, Google Places) currently set to placeholders — features depending on them won't work until real keys are added.

---

## In focus right now

1. ✅ ~~**Run the W8 backfill dry-run + apply against prod**~~ — done 2026-05-20. 7 candidates of 42 had yes-RSVPs; apply flipped 2 statuses and logged 6 venue_visit_history rows (rest had no trackable venues). The W8 daily job (`completedItineraries` with `>=2` threshold + 60-min stagger offset) is also already firing in prod. Corrective mechanism: `npx tsx scripts/backfill-completed-itineraries.ts --remove --itinerary <id> --apply` reverts a false-positive backfill.
2. **W8 Sub-track A.5 — Auto-promote `proposed → scheduled` on quorum met** — today the only proposed→scheduled trigger is the organizer manually calling `POST /api/itineraries/:id/finalize`. User wants the system to flip automatically when `defaultQuorumThreshold` (group setting, percentage) is met by the RSVP deadline. Extend the existing `processQuorumChecks` job in `server/reminder-scheduler.ts` which already evaluates quorum for the negative (cancel) case. ~1-2 hours.
3. **W8 Sub-track A.6 — Per-member past-events view** — surface only the events each member actually attended. Derive from `rsvps WHERE response='yes'` joined to `itineraries WHERE status='completed'`. No new tables needed. Eventually layer feedback overrides (member can mark "I didn't end up going" to exclude). Server query + UI list. ~2-3 hours.
4. **W8 Sub-track A.7 — Feedback collection improvements** — post-event feedback fills 4/50 today; needs a lower-friction 1-tap "did you go?" prompt with reliable morning-after trigger for completed events. Feeds the override path in A.6.
5. **W4 remaining** — Architecture cleanup: Slice 1 (group `server/` by domain), Slice 3 (split `storage.ts`)
6. **W6 remaining** — Sub-track H (background-job healthchecks). G (account deletion flow) shipped in `d1d7471`. Pairs naturally with W9 — a healthcheck that watches scheduler heartbeats would have surfaced today's hang.
7. **W5 ongoing** — Code hygiene: fire-and-forget `.catch()` Sentry wiring, frontend Sentry client init
8. **Apply migration 0016** to Railway (missing indexes for `members.userId`, `rsvps.userId`, cache tables)
9. **Add real API keys to Railway** — `OPENAI_API_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `ADMIN_EMAILS`

---

## Future product considerations

These are product-level decisions to revisit when the time is right — not current priorities.

### Notification channel: SMS / phone numbers

Current approach: email only. This works for the current no-real-users stage.

**The decision when we revisit:** Move to SMS as the primary notification channel for time-sensitive RSVP nudges and event reminders, similar to Partiful. Phone number is a higher-trust ask than email — it should be offered as an optional upgrade after a member has already had a good experience with Kinmo, not required upfront.

**Proposed sequencing:**
1. Email only through initial launch — prove the product doesn't spam
2. After members have attended at least one event, offer "add your phone for event reminders as texts" — totally optional
3. SMS replaces (or augments) email for `day_before` and `gentle_nudge` reminder types
4. Native app comes even later, only if there's a clear reason beyond notifications — PWA ("add to home screen") is the bridge if needed

**Why not now:** We need to earn trust before asking for phone numbers. The email pipeline also needs to be battle-tested first to ensure notification quality is good before adding a higher-friction channel.

**Implementation note when ready:** Twilio is the obvious choice. The schema already has a `phone_number` column that was dropped from Neon schema drift (noted in W1 gotchas) — will need to be re-added with proper opt-in flow.

### Rituals: layered cadences for varied event types (brainstorm 2026-05-16)

**The problem this is trying to solve.** AI-generated venue and timing suggestions don't feel that good. The strongest suggestions come from *warm* signal — places the group has been, things members have said they want to do — not cold AI discovery against `curated_venues`. Groups also have multiple "modes" they get together in (family dinners + occasional bar nights + once-in-a-while winery), and today the product treats every event as the same kind of thing, which makes the AI prompts vague and the planner blind to these differences.

**The reframe.** Kinmo's edge isn't smarter AI suggestions — it's better *structured memory* of what this specific group is like. The AI is just a surface on top of that memory. Most groups can be planned for "the middle 80%" without modeling every exception.

**The proposed model: rituals as an additive layer.**

- Every group keeps its current default rhythm (today's behavior — e.g. "dinners, twice a month, walking distance, family-friendly"). This is the primary ritual.
- Optionally, a group can add **side rituals** on top, each with its own cadence + vibe + who's-usually-in + radius + wishlist + history. Examples: bar nights (every couple months, no kids, loud is fine), winery trips (quarterly, willing to drive).
- Side rituals are mostly *different flavors of going out*, not different domains. They hit the same venue universe (Google Places) — just with different config. No new external integrations needed for v1.
- Concerts / live events were considered and **deferred** — they depend on external artist availability and would need a Ticketmaster/Songkick-style integration. Not v1.

**The planner becomes unified, not parallel.** The most important shift. Instead of N independent cadence-triggered schedulers running side by side, there's one planner that:

- Looks at the next ~4-6 weeks
- Looks at what events already happened recently (don't overload the group's social budget)
- Draws from the group's menu of ritual templates
- Proposes 1-2 events that fit, substituting between rituals as needed ("a winery trip this fortnight counts as the dinner; skip the regular Saturday")
- Cadence is a *target*, not a *trigger* — "roughly 2x/month" means aim for that, allow substitutions, allow skips when life is busy

This matches how a real human planner thinks ("we already did something last weekend, let's give people a break") rather than mechanically firing on schedule.

**Why rituals beats refactoring the whole group model.**

- Zero migration pain — existing groups are unchanged, the side-ritual surface is hidden until used.
- Onboarding doesn't get heavier — defaults flow from the primary ritual; adding a second is opt-in and ~30 seconds.
- Matches the "practical over tidy" preference — extension, not restructure.
- The single-ritual case stays as clean as it is today.

**Decisions still open (to revisit before building):**

1. **Substitution rules.** Does any ritual fire the group's "social budget," or do we tag explicitly which rituals substitute for which? Lean toward the simpler model: all rituals contribute to one shared cadence pool.
2. **No-candidates behavior.** When a ritual fires but nothing in the venue pool fits the vibe, does Kinmo say "nothing great right now" or loosen the filter? Lean toward "say nothing" to match the no-pressure tone — but worth pressure-testing.
3. **Per-ritual member subsets.** The bar night excludes the people who can't get a sitter. UX question: how do members opt in/out of a ritual without it feeling like exclusion? Probably the trickiest surface.
4. **How rituals show in existing surfaces.** Group home tags each proposed event with its ritual; member view shows which rituals each person is in; wishlist entry asks which ritual it belongs to (or Kinmo guesses from text).
5. **Wishlist as standalone v0.** A "drop an idea" surface could ship *before* ritual support and immediately start collecting warm data the planner uses today. Likely the highest-ROI first step.

**Suggested sequencing if this gets prioritized:**

1. **Wishlist surface first** — attached to the primary group, no ritual concept yet. Lowest risk, immediate value, starts feeding the planner better warm signal regardless of whether rituals ever ship.
2. **Ritual templates + unified planner** — restructure the auto-scheduler to think "menu of options for the next month" instead of "fire the cadence trigger." This is the real meat of the change. Restaurant-type events only at first; reuses existing venue search.
3. **Per-ritual member subsets** — the bar-night-excludes-the-parents case. Last because it's the hardest UX.
4. **Concerts / aspirational external-availability rituals** — much later, only if there's pull. Different problem (Ticketmaster-class integration, fandom data), don't conflate with the rituals-as-config work above.

**Why not now:** Recommendation foundations (W8) need to land first — the planner can't get smarter at picking from group history if `venue_visit_history` is empty and post-event feedback is at 4/50. The wishlist piece could potentially be sequenced alongside W8 Sub-track A since it's also a warm-signal capture surface — worth revisiting when W8 is closer to done.

**Revisit trigger:** When W8 Sub-track A ships (outcome instrumentation gap closed) and the recommender has real history to learn from. At that point, decide whether to start with the wishlist surface (lowest cost), commit to the full unified-planner restructure (highest payoff), or hold for more user signal.

---

## Guiding principle: fix in place, delete aggressively first

We're not rewriting. The schema, product logic, AI prompts, and stack are all worth keeping. The mess is surface-level — accumulated code, not foundational rot.

**Operating rules:**
- Before refactoring any file, ask "should this exist at all?" If no, delete it.
- A working `git revert` and "no live users yet" is permission to delete liberally. Bias toward deletion when in doubt.
- Don't refactor things on the way out the door. Better to delete than reorganize.

---

---

## Archive — Completed workstreams

_Details kept for reference. See the status snapshot above for current state._

---

## Workstream 0 — Dead code purge ✅ DONE

**Completed 2026-05-11** in commit `224b3fa`. Removed 47 unused files + 14 npm deps (44 packages incl. transitive). Net: −13,341 LOC. Knip used to identify candidates; each spot-checked before deletion. App still builds and runs.

**What was kept that knip flagged:** `scripts/audit-route-split.mjs` (useful for W4), `server/google-places-stub.ts` (useful for W3 cost testing).

**What was NOT delete-able despite suspicion:** the 8 `ai-*` server files — they ARE imported into the runtime, so they're product features, not dead code. Decision to retire them is a product call deferred to W4 or later.

**Original goal:** Shrink the codebase by 20-30% before touching anything else.

### Phase 0.1 — Suspect modules (verify each before deleting)

These look exploratory or Replit-era. For each, grep usages and confirm it's actually dead before removing:

- `server/agent-mcp-server.ts` (1,221 LOC) — MCP server experiment; check if any runtime path imports it
- `server/ai-agent-chat.ts` (17K) — AI agent chat experiment
- `server/ai-event-agent.ts` (30K) — event agent
- `server/ai-event-validator.ts` (8K)
- `server/ai-itinerary-naming.ts` (4K)
- `server/ai-scheduling.ts` (6K)
- `server/ai-time-picker.ts` (52K)
- `server/ai-venue-selector.ts` (6K)
- `server/replitAuth.ts` — already replaced by googleAuth, keep around only if there's a reason
- Replit-era plugins in `package.json`: `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`
- Any `*backfill*.ts`, `*migration*.ts` one-shot scripts that have already run

### Phase 0.2 — Mechanical audit

1. Run `npx knip` (or `npx ts-unused-exports`) — get a list of unreferenced files and exports
2. Manually review the list — there will be false positives (entrypoints, dynamic imports)
3. Delete with a single sweeping commit per area; small commits make reverts cheap

### Phase 0.3 — Frontend audit

Same pattern for `client/src/`:
- Prototype pages: `client/src/pages/prototype-*.tsx` — are these dev-only? Move to a `prototype/` folder or delete
- Unused shadcn components in `components/ui/`

### Success criteria
- `wc -l $(find server -name "*.ts")` drops by ≥20%
- `npm run dev` still starts
- Basic flows (login, view groups, create event) still work

**After this:** the rest of the workstreams operate on a smaller, more understandable codebase.

---

## Workstream 1 — Hosting migration off Replit ✅ DONE

**Completed 2026-05-12.** Production live at https://kinmo-production.up.railway.app.

**Final stack:**
- Hosting: **Railway** (project `affectionate-passion`, ~$5/mo Hobby plan)
- Database: **Railway Postgres** (~$5/mo) — chose over Supabase for simplicity (one bill, one dashboard, auto-wired DATABASE_URL)
- Auth: **Google OAuth** via Passport (production OAuth client in Google Cloud `Kinmo.ai Auth`)
- Migration: 8,800 rows copied via `scripts/migrate-neon-to-railway.ts` (kept in repo for reference)

**Real gotchas hit + fixed in this workstream:**
1. `vercel.json` was prepped but won't work — Kinmo has 10 long-running `setInterval` schedulers incompatible with serverless. Railway runs Express as a long-lived process, no refactor needed.
2. PORT was hardcoded to 5000 in `package.json` `start` script — broke Railway's port assignment. Fixed in commit `350657a`.
3. `scripts/postprocess-index.mjs` was referenced by the build script but never committed. Fixed in `aef6af4`.
4. Code used `@neondatabase/serverless` (WebSocket-based) — won't connect to Railway TCP Postgres. Swapped to `pg` + `drizzle-orm/node-postgres` in `e085d95`.
5. OAuth strategies only registered for `kinmo.ai`, not the Railway URL — added `CUSTOM_DOMAINS=kinmo-production.up.railway.app` env var.
6. Frontend was hitting `/api/login` (Replit-era), server only exposed `/api/auth/google`. Added redirect alias in `e37fb58`.
7. OpenAI SDK crashed on missing API key — added placeholder `OPENAI_API_KEY=stub_not_used` (server's optional check passes empty strings but not undefined).
8. Schema drift between Neon and Railway — Neon had columns no longer in `shared/schema.ts` (`disengagement_strikes`, `quorum_threshold`, `phone_number`). Migration script filters to common columns. ~100 rows skipped on JSON parse errors (acceptable).

**Still pending in this workstream area** (deferred but documented):
- Hook up `kinmo.ai` custom domain (Railway → Networking → Custom Domain + DNS CNAME + Google OAuth additional redirect URI)
- Add real API keys to Railway: `OPENAI_API_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`
- ~~Delete leftover `vercel.json` from working tree~~ — completed in Franky Task 2
- Switch from `drizzle-kit push` to versioned migrations — punted to a later workstream

**Original goal:** Run Kinmo on infrastructure we own, with a DB we control.

### Decision needed first: Vercel vs. Railway (vs. hybrid)

| Option | Frontend | Backend (Express) | Cron jobs / schedulers | DB | Tradeoff |
|---|---|---|---|---|---|
| **Vercel + Supabase** | Vercel (great) | Vercel serverless functions | Vercel Cron (limited, max 5min, separate endpoint per job) | Supabase Postgres | Best DX, free tier generous. Problem: current code has many long-running background loops (auto-scheduler, reminder-scheduler, planning-agent, activity-refresh-worker). Serverless timeout = needs rewrite into cron-triggered endpoints. |
| **Railway + Supabase** | Railway static or Vercel | Railway (Express runs as long-lived process) | Native — cron just works as it does today | Supabase Postgres | Code mostly runs as-is. ~$5–20/mo always-on cost. Less polished DX than Vercel. |
| **Hybrid: Vercel (frontend) + Railway (backend) + Supabase (DB)** | Vercel | Railway | Native on Railway | Supabase | Best of both. Most moving parts. CORS / API routing needs setup. |

**Recommendation pending evaluation:** Hybrid is most realistic given how much background-job logic exists. But if we're willing to refactor schedulers into discrete cron endpoints, full Vercel is simpler and cheaper.

**Decision criteria:**
- How much rewrite work do the schedulers need to fit a serverless model?
- What's the actual monthly cost on each option at our (low) traffic?
- DX: how much friction is "deploy to two services" vs. "deploy to one"?

### Phase 1.1 — Database migration: Neon → Supabase
1. Create Supabase project, copy `DATABASE_URL`
2. Export schema with `drizzle-kit` (we already use it)
3. `npm run db:push` against Supabase to recreate schema
4. Dump + restore data from Neon (`pg_dump | pg_restore`)
5. Swap `DATABASE_URL` in `.env`, verify locally
6. Decommission Neon
7. **Switch from `drizzle-kit push` to versioned migrations** during the cutover. Push-based dev is fine on Neon, but Supabase + production needs reviewable migration files. Auditor flagged drift risk.
8. **Add missing indexes** (also cross-listed in Workstream 6 Sub-track D):
   - `members.userId`, `rsvps.userId`, `votes.userId` — currently full-table scan on user lookups
   - `deletedAt` columns on `groups`, `members`, etc. — only `curatedVenues` has one today
   - `apiCallLogs.created_at`, `placesCache.expires_at`, `searchCache.expires_at` — needed for the cleanup job in Workstream 3 Sub-track D

### Phase 1.2 — Choose hosting (Vercel vs. Railway vs. hybrid)
1. Spike: deploy a "hello world" version of just the Express server to Railway. Time it. Note cost.
2. Spike: deploy current `vercel.json` config to Vercel. Identify what breaks (almost certainly the schedulers).
3. Pick a stack. Document the decision in `DECISIONS.md`.

### Phase 1.3 — First production deploy
1. Configure env vars in chosen platform
2. Wire up custom domain (if any)
3. Deploy main branch, verify auth + DB connection + basic flows
4. Update `vercel.json` or add `railway.json` as needed
5. **Add `CRON_SECRET=` to `.env.example`** with a comment noting it's required for production cron endpoints. Used by `server/routes.ts:3356`. Without it, scheduled jobs on Vercel/Railway will fail silently.

---

## Workstream 2 — Finish auth migration 🟡 Mostly done

**Status update 2026-05-12:** Production OAuth fully working on Railway. Replit cleanup tasks are complete; only functional follow-up testing remains.

### Remaining tasks
1. ✅ ~~Verify `setupGoogleAuth` is wired correctly~~ — done in `e37fb58`, also added localhost support + graceful fallback
2. ✅ ~~Remove `REPLIT_DOMAINS`, `REPL_ID`, `ISSUER_URL` from `server/config.ts`~~ — completed in Franky Task 2
3. ✅ ~~Delete `server/replitAuth.ts`~~ — done in `224b3fa`
4. ✅ ~~Set up Google OAuth credentials~~ — `Kinmo.ai Auth` OAuth client created, Railway URL + localhost both registered
5. ⏭️ Test full login → session → **logout** flow on localhost (login confirmed working in prod; logout untested)
6. ✅ ~~Test on first production deploy~~ — login works at https://kinmo-production.up.railway.app

---

## Workstream 3 — API cost control ✅ DONE

**Status update 2026-05-12:** Shipped through tier 4 by Franky in 5 commits — `0583809` (tier 0+1 env-gate kill switch + activity-gate cron jobs), `f45eed8` (tier 2 per-call cost cuts), `7fabc61` (tier 3 observability + cache normalization), `2038af3` (tier 4 architecture review), `ccf5928` (tier 4 daily budget tripwire).

**Batch API paused (not abandoned):** the Batch API integration (`ac78be8`, tier 4 #9) was rolled back in `6d618ac` later the same day. The supporting migration `0015_add_ai_batch_requests.sql` (`2aeddd8`) had already been applied to both Neon and Railway, so the `ai_batch_requests` table exists in both DBs with no code referencing it currently.

Per Franky (2026-05-12), the revert was a scope/coordination rollback — no specific bug was recorded. Treat the planning agent as staying synchronous indefinitely unless we make a deliberate call to reopen this work. **The orphan table is kept on purpose.** If Batch API is reopened, migration 0015 is reusable as-is (the SQL is idempotent). If we later decide Batch is off the roadmap entirely, clean up via a tracked DROP migration (not an ad-hoc DB change).

**Do not touch this area until explicitly reopened** — that's the coordination rule.

Tool-use batching for auto-scheduler + activity-refresh batching are out of scope while Batch is paused.

**Goal:** Cut monthly API spend significantly without losing user-visible quality.

### Sub-track A: Google Places audit

**Investigation tasks (do FIRST before optimizing):**
1. Pull the last 30 days of `apiCallLogs` table — group by endpoint, count calls, estimate cost
2. Identify the top 3 cost drivers. Suspected:
   - Text Search (most expensive Places call)
   - Place Details refreshes on `placesCache` rows
   - Activity refresh worker calling Places on every cycle
3. Find every place in code that calls Google Places — list them

**Optimization tactics (after we know what to cut):**
- **Increase cache TTL** — currently aggressive refresh; for static fields (name, address, types), refresh quarterly not weekly
- **Move to "lazy refresh"** — only refresh place details when a user actually views the venue, not on cron
- **Curated-venue-first** — `curatedVenues` table already exists. Lean on it more before falling back to live Places API
- **Replace Places where possible** — for venue discovery, we could try: OpenStreetMap/Overpass (free), Foursquare (cheaper), or just curated lists per city
- **Drop autocomplete entirely** if it's a top cost — replace with static search over curated list

**Decision point:** Once we have data, decide whether to optimize Places usage or actually swap providers.

### Sub-track B: OpenAI cost audit

**Investigation:**
1. Same approach — query `apiCallLogs` for OpenAI calls, group by feature, estimate cost
2. List every `openai.chat.completions.create` call site

**Likely wins:**
- Swap `gpt-4o` → `gpt-4o-mini` everywhere except where quality demonstrably matters (we should A/B before assuming this)
- Add prompt caching for repeated system prompts (Anthropic-style, OpenAI supports this differently — investigate)
- Aggressive result caching for deterministic queries (same group preferences + same date range → reuse output for N hours)
- Batch operations where multiple groups need the same analysis

### Sub-track C: Background-job frequency

**Currently in the logs I've seen, these run on a tight loop:**
- Activity refresh worker — refreshing activities for every group repeatedly
- Auto-scheduler — generating events far into the future (saw it create events for 2027)
- Planning agent

**Tactics:**
- Reduce cron frequency (e.g., hourly → daily where possible)
- Skip groups with `automationPaused` earlier in the pipeline
- Stop generating events more than ~3 months out

### Sub-track D: Cap log/cache table growth

Several tables grow without bound and will tank query performance over time:
- `apiCallLogs` — every API call logged forever (`shared/schema.ts:790–805`)
- `placesCache` and `searchCache` — `expiresAt` is set but never enforced; expired rows are only deleted on cache miss (`server/google-places.ts:553–627`)

**Actions:**
1. Add a daily cleanup job to `server/reminder-scheduler.ts` that runs:
   - `DELETE FROM api_call_logs WHERE created_at < now() - interval '90 days'`
   - `DELETE FROM places_cache WHERE expires_at < now()`
   - `DELETE FROM search_cache WHERE expires_at < now()`
2. Indexes for these deletes are added in Workstream 1 Phase 1.1 step 8.

---

## Workstream 4 — Architecture cleanup 🔄 In progress

**Status update 2026-05-12:** Slice 2 (split `routes.ts`) **committed in `7506c88`** — 31 route modules now live in `server/routes/`. Slices 1 (group server/ by domain), 3 (split storage.ts), and 4 (standardize error responses) still open.

**Goal:** Make `server/` and `routes.ts` modifiable without dread.

### Current pain points
- `server/` has 60+ files flat, no domain grouping
- `server/routes.ts` is ~600KB — every endpoint in one file
- `server/storage.ts` is ~130KB — every DB query in one file
- ~20 files prefixed `ai-*` are siblings rather than grouped
- Lots of legacy / probably-dead code from Replit-era experiments

### Refactor in slices (NOT one big PR)

**Slice 1: Group server/ by domain**
```
server/
├── auth/        # googleAuth, authorization, session middleware
├── ai/          # all ai-*.ts files, openai.ts, prompts
├── scheduling/  # auto-scheduler, reminder-scheduler, auto-time-selector
├── venues/      # google-places, curated-venues, places-cache
├── events/      # event-pipeline, auto-reschedule, itinerary generation
├── db/          # db.ts, storage.ts (split further later)
├── lib/         # retry, utils
├── routes/      # split routes.ts here (next slice)
└── index.ts
```
Move files into folders, fix imports, ensure `npm run dev` still works.

**Slice 2: Split routes.ts**
Break `server/routes.ts` into `server/routes/<domain>.ts` files:
- `routes/groups.ts`
- `routes/events.ts`
- `routes/itineraries.ts`
- `routes/rsvp.ts`
- `routes/venues.ts`
- `routes/admin.ts`
- ... etc.
Each file exports a `Router`. Main `index.ts` mounts them.

**Slice 3: Split storage.ts**
Same pattern — break into `storage/groups.ts`, `storage/events.ts`, etc.

**Slice 4: Standardize error responses ✅ Partial (leak-fix done)**

**Shipped in `7dfbe21`.** Added `server/lib/safe-error.ts` and swept 391 `res.status(500).json({ message: error.message })` callsites across `routes.ts` and the split `routes/*.ts` files. Production now returns "Internal server error" instead of raw `error.message`; dev still returns the real message for debugging. Errors can opt-in to being client-visible via `(err as any).safe === true`.

Still remaining for this slice:
- Standardize response shape (`{ success, data?, error? }`) — currently mixed
- Apply the same leak-fix to 4xx callsites if any leak details (most use static messages or Zod-formatted output)

(Dead code audit and `as any` cleanup were moved to Workstream 0. By the time we reach this workstream, the codebase is already smaller and tighter.)

---

## Workstream 5 — Code hygiene (ongoing, not a phase)

- **Delete what you don't need.** Every time you open a file to change something, check if neighbors are still used.
- **Fix the OpenAI key.** `.env` is missing a working `OPENAI_API_KEY` — currently every background job throws 401. Either set a real key or guard those features behind a "if no key, skip" check so logs stay clean.
- ~~**Tighten env validation**~~ ✅ Shipped in `f457eac` — `server/config.ts` now uses Zod `superRefine` with NODE_ENV-aware required checks (Google OAuth pair both-or-neither, both required in prod, SENTRY_DSN required when SENTRY_ENABLED=true). New env vars (`VITE_GOOGLE_MAPS_API_KEY`, `ADMIN_EMAILS`, `BASE_URL`, `CRON_SECRET`) typed in the schema; previously unknown to the validator.
- **Fire-and-forget `.catch()` calls** at `server/routes.ts:4961, 4968, 4974` log errors but never report to Sentry. Add `Sentry.captureException(err)` inside each. Same anti-pattern on the client: `CopyGuestInviteLink.tsx:43–44` and `CopyEventInviteLink.tsx:61` silently `console.error` without toasting.
- ~~**Advisory lock TTL:**~~ ✅ Verified OK by 2026-05-12 audit. The lock at `server/auto-scheduler.ts:1213` is correctly released in a `finally` block (`:1440`), and Postgres session advisory locks auto-release on connection drop — so a dead process doesn't leave the lock stuck.
- **Sentry not wired on frontend** (`client/src/main.tsx`). Server has it; client doesn't. Add `@sentry/react` init to capture client errors.

---

## Workstream 6 — Security & data-integrity hardening

**Goal:** Close real security gaps and prevent data corruption before any real users land.

### Sub-track A: Auth/authorization gaps ✅ DONE

**Shipped in `67b286f` (2026-05-12).** All 6 unprotected GETs locked down with `isAuthenticated + requireGroupAccess()` (or `requireVotingEventAccess()` for the by-vote-id route). The dead global `GET /api/voting-events` handler was deleted — no frontend read callers, couldn't be safely scoped.

### Sub-track B: Hardcoded admin fallback ✅ DONE

**Shipped in `771f1f7` (2026-05-12; Franky Task 4a).** `getAdminEmails()` in `server/authorization.ts` now returns `[]` when `ADMIN_EMAILS` is unset — fails closed instead of granting access to `raches402@gmail.com`. Set `ADMIN_EMAILS` in env to restore admin access.

### Sub-track C: Data integrity — duplicate-vote race ✅ DONE

**Shipped in `0d1b819` (2026-05-12).** Migration `0014_add_vote_unique_constraints.sql` adds 1 plain + 4 partial unique indexes covering both logged-in (`userId`) and anonymous (`memberId`) voting paths. `castVote()` and `voteForTimeSlot()` converted to race-free upserts. Pre-flight clean on both Neon and Railway; indexes live on both. `memberName`-only votes intentionally not constrained at DB level — see name-resolution feature for the upstream fix.

### Sub-track D: Missing indexes ✅ DONE (code) — pending Railway apply

**Shipped in `920cf6b` + migration `0016_add_missing_user_and_cache_indexes.sql`.** Adds 4 indexes: `members.userId`, `rsvps.userId`, `places_cache.expires_at`, `search_cache.expires_at`. Schema + applier script committed; needs to be run against Railway via `railway run --service=Postgres -- bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/apply-migration-0016.ts'`.

`deletedAt` indexes are still **not added** — partial remainder. Only `curatedVenues.deletedAt` is indexed today. Soft-delete checks are infrequent enough that this is low-urgency.

### Sub-track E: Soft-delete consistency ✅ DONE (member reads)

**Shipped in `2a17050`.** Four member-read storage functions now `innerJoin groups + isNull(groups.deletedAt)` — `getGroupMembers`, `getGroupMemberByUserId`, `getHostingAvailableMembers`, `getNextHostVolunteer`. Single-member-by-id lookups, admin stats, and backups intentionally left alone (different semantics).

Other child-record reads (rsvps, votes, etc.) have NOT been audited for the same pattern. If/when a soft-deleted group surfaces stale child data, expand here.

### Sub-track F: Sensitive request bodies in logs

`server/routes.ts:4832, 5121, 9010, 9021` log full `req.body` as JSON. This will dump emails and preferences into Vercel/Railway log retention.

**Action:** Replace with structured logs that include only IDs and outcomes.

### Sub-track G: Account deletion flow ✅ DONE

Shipped in `d1d7471` (2026-05-15). `POST /api/user/delete` requires `{ confirmation: "DELETE" }`, rejects with `ACTIVE_GROUPS_EXIST` if user organizes any non-soft-deleted groups (no transfer-ownership flow in v1 — must delete those groups first), then anonymizes the `users` row (PII → null, email → `deleted-{id}@deleted.kinmo.local`, `deletedAt` → now), deletes `userProfiles` outright, destroys all sessions for that user, and logs them out. Hard-delete was rejected because all user FKs cascade — would destroy groups other members depend on. Migration `0017_add_users_deleted_at.sql` adds the tombstone column with a partial index.

**Pending:** Apply migration 0017 to Railway (queue with 0016).

### Sub-track H: Background-job healthchecks

`/api/health` only checks DB connectivity. If `reminder-scheduler` or `auto-scheduler` crashes silently, no signal.

**Action:** Add a `job_heartbeats` table or in-memory map, write a heartbeat from each scheduler on each tick, surface a "stale heartbeat" check in `/api/health`. Defer if hosting platform offers process-level monitoring.

---

## Decisions to make (track these in `../DECISIONS.md`)

| # | Decision | Status | Notes |
|---|---|---|---|
| 1 | Hosting: Vercel / Railway / hybrid | ✅ **Decided: Railway** | Code's long-running schedulers made Vercel infeasible; deployed 2026-05-12 |
| 2 | Keep Google Places or replace it | Open | Decide after API audit (W3 Sub-track A) |
| 3 | gpt-4o vs gpt-4o-mini per feature | Open | A/B test before flipping |
| 4 | Keep curated venues as primary, Places as fallback? | Open | Likely yes |
| 5 | Drop `replitAuth.ts` entirely or keep as reference | ✅ **Decided: Dropped** | Deleted in commit `224b3fa` (W0 purge) |
| 6 | Drop `drizzle-kit push` in favor of versioned migrations | Open | Deferred (W1 used push); revisit before public launch |
| 7 | Pick one canonical API response shape | Open | Recommend `{ success, data?, error? }` |
| 8 | Acceptable retention window for `apiCallLogs` | Open | Suggest 90 days; depends on cost analysis in W3 |

---

## Quick wins (do this week)

1. ⏭️ **Add real API keys to Railway** — `OPENAI_API_KEY` (replace `stub_not_used`), `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`. Stops the log spam, unlocks AI/email/venue features. **Also set `ADMIN_EMAILS=raches402@gmail.com`** (or similar) so admin endpoints don't 403 — required after the hardcoded admin fallback was removed in `771f1f7`.
2. ✅ ~~Verify Google OAuth login works locally~~ — works in production; localhost support added in `e37fb58`
3. ✅ ~~Pull 30-day API cost report~~ — done as part of W3 diagnosis (drove the tier 0-4 implementation)
4. ✅ ~~Spike a Railway deploy~~ — way past spiking, fully deployed
5. ✅ ~~Fix hardcoded admin fallback~~ (`server/authorization.ts:339`) — completed in Franky Task 4a (`771f1f7`)
6. ✅ ~~Add unique constraints to vote tables~~ — shipped in `0d1b819` + migration `0014` applied to Neon and Railway
7. ✅ ~~Run `npx knip`~~ — done, drove W0
8. ✅ ~~Commit the routes.ts split WIP~~ — shipped in `7506c88` (W4 Slice 2)
9. ⏭️ **Apply 0014 + 0015 migrations whenever a new DB is provisioned** — both are hand-written SQL with idempotent applier scripts (`scripts/apply-migration-0014.ts`, `scripts/apply-migration-0015.ts`). Run via `railway run --service=Postgres -- bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/apply-migration-NNNN.ts'`.
10. ⏭️ **Delete dead duplicate helpers in `server/routes.ts`** (~5 min). Three helpers at the top of `routes.ts` are unused or duplicated elsewhere: `calculateNameSimilarity` (dupe of `server/google-places.ts:354`), `getQualityThresholds` (dupe of `server/routes/generation.ts:54`), `parsePriceLevel` (zero references). Delete leaves `routes.ts` as the `registerRoutes` shim + the `generateAndStoreActivities` worker (legitimately shared by 3 callers).
11. ⏭️ **Refresh stale CLAUDE.md file-size claims** (~2 min). Lines 30 and 142 still describe `routes.ts` as "~600KB, very large" — outdated since W4 Slice 2 split it down to ~38KB. `storage.ts` size note is still accurate (~130KB / 4156 lines).
12. ⏭️ **Decide on prototype pages** (decision needed). 14 files in `client/src/pages/prototype-*.tsx` (~700KB of source) wired into `App.tsx` as public routes at `/prototype/*` with no env or auth gate. Originally flagged at line 116. Options: (a) delete entirely, (b) gate behind `NODE_ENV !== "production"`, or (c) move to a separate Vite entry that's not in the prod bundle. Currently shipping in production bundle and reachable by anyone who guesses a URL.
13. ⏭️ **Delete 9 unused `Input` types in `server/validation-schemas.ts:544-552`** (~5 min). `AddAdHocVenueInput`, `CreateCollectionInput`, `CreateGroupInput`, `CreateRsvpInput`, `GenerateCategoryInput`, `ImportVenuesInput`, `PostEventFeedbackInput`, `SendItineraryInput`, `UpdateAutomationInput` — each appears only at its own definition (grep-verified). ~10 lines.
14. ⏭️ **Archive or delete `server/routes/SPLIT_PLAN.md`** (~2 min). Documents the routes.ts split that W4 Slice 2 completed (13,433 → 864 lines). Stale work-doc, signals "this is still happening" when it isn't.
15. ⏭️ **Consolidate 6 duplicate prototype `<Route>` registrations in `client/src/App.tsx`** (~5 min). Six prototype paths (`/prototype/kinmo-text`, `/prototype/headline-layouts`, `/prototype/group-details-desktop`, `/prototype/feedback-mockup`, `/prototype/dashboard-redesign`, `/prototype/dashboard-v2`) are registered in *both* the unauth `<Switch>` (lines 133-138) and the auth `<Switch>` (lines 181-186). The other ~15 path-overlaps in App.tsx are intentional dual-tree routing; these 6 prototypes are not. Pairs with #12 — if prototype pages get gated/deleted, this disappears anyway.
16. ⏭️ **Triage 2 active TODO comments** (~5 min). Decide if real bugs or dead notes:
    - `server/auto-scheduler.ts:502` — "TODO: Pass actual event date when available"
    - `server/routes/standalone-events.ts:273` — "TODO: Send actual email notifications to invitees" — this one sounds load-bearing; standalone events may not actually be emailing invitees at all. Investigate before deleting the comment.

---

## What this plan deliberately does NOT include

- New features. We're stabilizing first.
- Mobile app / native — out of scope.
- Public launch / marketing — out of scope until infra is solid.
- Anything that doesn't reduce risk, cost, or maintenance burden.
- **Comprehensive test suite.** Acknowledging the gap: vitest is configured (`npm test` runs `vitest run`) but only one test file exists today (`server/trust-state.test.ts`). The harness is there, almost nothing uses it. We're deferring rather than denying. When the codebase stabilizes post-refactor, add at minimum: scheduler integration tests, auth flow tests, and storage-layer tests.

---

## Workstream 7 — Quorum & auto-reschedule system ✅ DONE

**Completed 2026-05-15.** Fixed the root cause of zero-RSVP events aging past their event date without rescheduling, and redesigned the full quorum/notification lifecycle.

**Root cause fixed:** `checkAndReschedule()` was only called reactively on RSVP submission, with an early return for zero responses. No cron job ever checked "deadline passed, did we get enough yes votes?" Zero-RSVP events silently became past events.

**What was built:**

- **`server/auto-reschedule.ts`** — added `options.forceReschedule` flag to bypass the zero-response early return and the threshold check. Lets the daily quorum cron force a reschedule even with no RSVPs.

- **`server/reminder-scheduler.ts`** — several additions:
  - `calculateScheduleConfig(meetingFrequency)` — adaptive timing per group cadence (3-day cycle → 3-day invite advance; monthly → 14-day invite advance). Replaces hardcoded `inviteAdvanceDays = 21`.
  - `processQuorumChecks()` — daily cron: checks deadlines + 24h grace, skips standalone events, routes to check-in flow for 2+ respondents below quorum, skip vs reschedule by cycle length (≤7 days → skip; ≥14 days → reschedule).
  - `processQuorumCheckinResults()` — daily cron: resolves pending check-ins (majority keep → proceed; majority reschedule → reschedule; tie → keep; no replies → follow default quorum rule).
  - Notification fixes in `sendReminderEmails`: skip `gentle_nudge`/`final_call` for members who already RSVPed; `day_before` only to yes-RSVPs; rescheduled events skip nudges entirely.
  - Post-event feedback only sent to yes-RSVP members (not all group members).

- **`server/email-service.ts`** — `sendQuorumCheckinEmail()` — two-button email ("Yeah, I'm in" / "Let's find another time") in Kinmo voice (no guilt, friendly).

- **`server/routes/rsvps.ts`** — `GET /api/itineraries/:id/quorum-checkin/:inviteToken` — no-auth endpoint; validates invite token, records keep/reschedule response, redirects to app.

- **`shared/schema.ts`** — added `quorumCheckinSentAt` (timestamp) and `quorumCheckinResponses` (jsonb) to itineraries table. `db:push` applied.

**Key product rules enforced:**
- Quorum threshold always reads from `group.defaultQuorumThreshold` — never hardcoded.
- Standalone events (`isStandalone = true`) are never auto-rescheduled — organizer's deliberate choice.
- 2+ keep votes beats 1 reschedule vote in a check-in.
- No guilt language anywhere in notifications.

---

## Workstream 8 — Recommendation foundations 🔄 In progress

**Goal:** Make Kinmo recommend from what groups actually like, not from a 5,300-venue cache the AI keeps recycling the same handful of suggestions from. Per project principle: *build for memory, not discovery* (see `[[kinmo-recommendations-philosophy]]`).

**Why now:** dev DB analysis on 2026-05-15 surfaced four foundational gaps:
- Only **1 itinerary marked `completed`** out of 54 — events happen but the status never flips.
- **`venue_visit_history` table is empty** (0 rows) — the "we went here" table exists but isn't being written to.
- **Post-event feedback was filled 4 times** out of ~50 events — gold-standard signal almost never captured. The form is too easy to skip.
- `voting_events.trust_source` was backfilled to `'backfill'` for all 101 rows — historical data can't separate user-added from AI-suggested venues. New rows can populate it correctly going forward, but ~544 existing rows are ambiguous.

Net effect: of 5,300 curated venues, only ~10-15 have any positive engagement signal. AI repeatedly surfaces the same venues (Bambu Dessert Drinks appears in 7 proposed itineraries the group never actually went to, Burma Silver Star in 7, Curry Hyuga in 7) because that's all it has signal on.

The right end state for the cache is ~100-200 venues per metro that match patterns from real group data — but the data-driven prune can't run until the outcome signals are actually being collected.

### Sub-track A — Close the outcome instrumentation gap ✅ DONE (2026-05-19)

Shipped in `e2bf7ca` (+ adjacent improvements in `03a2e86`). Two of three original items done:

1. ✅ **Itinerary status flip to `completed`** — new `processCompletedItineraries` daily job in `server/reminder-scheduler.ts` flips past-eventDate itineraries from `proposed`/`scheduled` to `completed` when they have ≥2 yes-RSVPs. Registered via `scheduleStaggered(..., 60 * MINUTE_MS)` per W9 #3 convention. Threshold rationale: a single yes-RSVP is more likely a no-show or solo plan than a real attended event; group-size-aware percentage thresholds deferred (current dogfood groups are small enough that ≥2 is a reasonable universal floor).

2. ✅ **Populate `venue_visit_history`** — the completion job calls `storage.logVenueVisits` immediately after flipping status. Idempotency guard added to `logVenueVisits` so re-running the job (or the backfill) doesn't double-log. Also removed the *premature* `logVenueVisits` call in `processAutoSend` that was firing on invite-send instead of attendance. One-time backfill script (`scripts/backfill-completed-itineraries.ts`) added with `--dry-run`/`--apply` modes for retroactively populating history from months of dogfood data — **dry-run + apply against prod is the next concrete action** (see "In focus" #1).

3. 🔄 **Surface post-event feedback consistently** — split into its own sub-track A.7 below since it's a UX/UI piece that deserves separate scoping. The instrumentation prerequisite (events being marked `completed`) is now in place.

### Sub-track A.5 — Auto-promote `proposed → scheduled` on quorum met (2026-05-19)

Today the only proposed→scheduled trigger is the organizer manually calling `POST /api/itineraries/:id/finalize` (server/routes/itinerary-extras.ts:1283). No quorum check. User wants the system to flip automatically when `groups.defaultQuorumThreshold` (percentage, 0-100) is met by yes-RSVPs from group members by the RSVP deadline.

The existing `processQuorumChecks` job in `server/reminder-scheduler.ts` already evaluates quorum for the *negative* case (below quorum → cancel or reschedule per W7). Extend it to handle the positive case: above quorum → flip to `scheduled`. Watch out for double-firing with the manual finalize endpoint (probably just update status only if still `proposed`).

Estimate: ~1-2 hours.

### Sub-track A.6 — Per-member past-events view (2026-05-19)

Today's "past events" listing surfaces every group event to every group member. User correctly observed that an event with 3 of 5 members attending should only appear in those 3 members' past-events list, not for the 2 who didn't go.

Data is already there: `rsvps WHERE response='yes'` joined to `itineraries WHERE status='completed'` gives the per-member attendance set. No new tables needed.

Attendance source rule (decided 2026-05-19): start with `RSVP='yes'` as the attendance proxy. Layer post-event-feedback overrides on top — if a member marks "I didn't end up going," exclude them. Feedback stays **optional**: it doesn't block the RSVP=yes default from counting.

Touches: server query (new storage function), UI list (Past Events surface in client).

Estimate: ~2-3 hours.

### Sub-track A.7 — Feedback collection rework (2026-05-19)

Spun out from the original Sub-track A item #3. Post-event feedback fills 4/50 today. Two real problems:

1. **Trigger reliability** — was tied to the broken status='completed' assumption. Now that status flips happen daily, the existing feedback-request job (`processPostEventFeedbackRequests`) will start firing reliably. Watch fill rate for ~2 weeks and decide if it's enough.
2. **Form friction** — current form is multi-field. User direction: replace with a 1-tap "did you go? 👍/👎" prompt as the default; multi-field details only on opt-in.

Estimate: ~2-3 hours (mostly UI work). Pair this with A.6 since the feedback flow is what feeds the A.6 attendance-override path.

### Sub-track B — Manually curate the starter venue pool (important, this month)

`curated_venues` has ~5,300 rows, overwhelmingly Bay Area / Peninsula / East Bay. The path:

1. Filter to the actual served metro (SF, Oakland, Berkeley, Peninsula).
2. Manual review with Rachel — mark ~100-200 as "yes, this is the kind of place we'd actually go." Combines places she's been to, places she wants to try, and places matching those patterns.
3. The rest get archived (mirror `server/routes/admin.ts` archive-then-delete pattern: row goes to `deleted_venues` with reason, then hard-delete from `curated_venues`).
4. Recommendation engine then picks from the curated 100-200 instead of the full 5,300. Diversity problem (AI surfacing the same handful) goes away because the candidate pool is intentional, not "the few venues with any data on them."

The `scripts/validate-curated-venues.ts` tool (built 2026-05-15) supports this manual review with `pull`/`apply` subcommands and an `update` action for fixing renames/moves in-place.

### Sub-track C — Data-driven refinement (nice-to-have, after A + B)

Once new outcomes are flowing AND the cache is sized down to the curated pool:

1. Surface "venues with positive `venue_visit_history` + positive `post_event_feedback`" as the strongest layer of the recommendation candidate set per group.
2. For new groups, seed recommendations from "venues that similar groups liked" — collaborative filtering on group preference overlap + venue overlap. Works once warm-core data is dense enough.
3. Treat fresh Google Places API discovery as a rare-fallback path (novelty / no good match in pool), not the default. Lazy refresh of numeric fields (rating/hours/price/photo) on venues users actually view — only Sub-track C work that touches the paid API.

### Out of scope
- Building a sophisticated discovery engine. The product principle is memory, not discovery.
- Bulk refreshing numeric fields (rating, hours, price, photo) on the whole cache — those need Google Places API and only make sense for venues users actually see. Defer to lazy-refresh in Sub-track C.

### Done when
- ✅ Itineraries reliably move to `completed` after events happen; `venue_visit_history` has rows for past events. (Shipped 2026-05-19 in `e2bf7ca`; one-time backfill against prod still pending.)
- Proposed itineraries auto-promote to scheduled when quorum is met (A.5).
- Past-events surface is per-member, derived from RSVP=yes minus feedback no-shows (A.6).
- Post-event feedback fill rate is meaningfully higher (target: ≥50% of completed events get any feedback) (A.7).
- `curated_venues` is sized to the served-metro starter pool (~100-200 venues per metro), with archived rows accessible in `deleted_venues` (Sub-track B).
- Recommendation flow leans on the curated pool + group history before going to fresh API discovery (Sub-track C).

---

## Workstream 9 — Scheduler reliability 🆕 New

**Goal:** Stop cron-burst outages. Web requests should keep being served even when the background scheduler is doing heavy work.

**Triggering incident (2026-05-18, 23:13–23:25 UTC):** kinmo.ai returned Cloudflare 502s for ~12 minutes. Root cause traced through Railway logs:

- At `23:13:00.555` UTC, ~10 cron jobs fired in the same millisecond (Planning Agent, WeeklyDigest ×2, Auto-Draft, Pipeline Gap Detection, Activity Refresh, Database Backup, Event Cleanup, Rejected Dates Cleanup, Time Selection).
- Pipeline Gap Detection found Golden Girls had 0 future events and synchronously kicked off 4 full event generations (each = chain of OpenAI + Google Places calls).
- All log output stopped at `23:13:00.561`. No errors, no exits. Process alive but unresponsive.
- Starting at `23:24:06`, every HTTP request started returning 502 with exactly `15001ms` latency — Railway's edge timeout. Web requests queued behind exhausted DB pool / outbound socket pool.
- Restarting the Railway service cleared it.

**Why this isn't a one-time thing:** the cron scheduler always fires every job on the same second, there are no timeouts on outbound OpenAI/Google calls, heavy generation work runs inline in the web process, and `WeeklyDigest` is registered twice (visible as duplicate "Starting weekly digest processing…" log lines and duplicate "Complete: 0 triggered, 7 skipped"). With 7 active dogfood groups it was a matter of time; with real users the threshold gets lower.

### Sub-track A — Critical ✅ DONE (2026-05-19)

All three items shipped on the same day as the incident.

1. ✅ ~~**Find and remove the duplicate `WeeklyDigest` registration.**~~ Shipped in `7f33c47`. Removed the in-process scheduler in `reminder-scheduler.ts` (was Monday-gated, mirrored the dedicated cron worker). Detection trick: the production logs showed only ONE `[WeeklyDigest] Job complete` line versus TWO `[WeeklyDigest] Complete: 0 triggered, 7 skipped`, which originally suggested two callers — but see #4: it was actually one trigger that fanned out via an esbuild bundling quirk.

2. ✅ ~~**Add timeouts to outbound OpenAI + Google Places calls.**~~ Shipped in `06c3db9`. All 7 OpenAI client constructors now pass `timeout: 30_000, maxRetries: 1` (SDK default was 10-minute timeout, 2 retries — way too generous). All 4 Google Places `fetch()` call sites in `server/google-places.ts` now pass `signal: AbortSignal.timeout(30_000)`. The OpenAI SDK handles cancellation via AbortController internally; no call-site changes needed. Trade-off as predicted: legitimate slow GPT-4o calls (45-60s on long prompts) will now fail — single retry + loud Sentry logging keeps it observable.

3. ✅ ~~**Stagger cron jobs across the hour.**~~ Shipped in `bf3fd29`. Introduced a `scheduleStaggered(job, intervalMs, offsetMs)` helper in `server/reminder-scheduler.ts` that delays the first run by `offsetMs`, then starts the interval — so offsets persist forever. Daily jobs (11) now spread 0/5/10/.../55 min apart; hourly jobs (3) spread 0/15/30 within the hour. 5-min reminder loop stays eager (lightweight). Also cleaned up a latent bug where `planningAgent`/`databaseBackup`/`costReport` had `setTimeout(60s)` first-run delays but `setInterval` still fired on its own clock — meaning the "delay" only applied to the first run and the actual cadence was unaffected by it.

4. ✅ **Actual root-cause fix — remove the esbuild-incompatible CLI entrypoint in `swipe-digest-worker.ts`.** Shipped in `df0f5cf`. Investigation reveal: there was *no external pinger*. Railway HTTP logs across the outage deployment and several prior had **zero** `/api/cron/weekly-digest` traffic. The duplicate fire was entirely internal — the worker had `if (import.meta.url === file://${process.argv[1]}) { processWeeklyDigests().then(() => process.exit(0)) }` at the bottom, intended as a "run as CLI" entrypoint. In the esbuild bundle, both sides of that comparison resolve to the bundle path, so the check evaluated true on every import. **That's what killed the process on May 18:** the Monday-gated in-process scheduler imported the worker, the bundled CLI block fired `process.exit(0)`, Railway restart-looped until midnight UTC when the Monday gate stopped passing. Items #1-3 were valuable defense-in-depth but didn't touch the actual bug.

**No source-level ordering dependencies found** — jobs share data (groups, itineraries) but didn't require any specific run order. Existing system tolerated full concurrency at startup; staggering just spreads them out.

**Audit follow-up:** grepped the whole `server/` tree for `import.meta.url` — only the `swipe-digest-worker.ts` warning comment remains; no other CLI-check landmines exist.

### Sub-track B — Important (do this month)

4. **Fix "urgent timeline for events in -159 days" logic** in `server/auto-scheduler.ts` (or wherever Auto-Draft / Pipeline Gap decide timeline). Past events shouldn't trigger pipeline work at all — today they do, wasting OpenAI spend and adding load. Verify against `server/event-pipeline.ts` flow.
5. **Cap concurrency inside heavy jobs.** When Pipeline Gap needs to generate N events for a group, do them sequentially (or `pLimit(2)`), not all at once. Same idea for Activity Refresh across groups. The goal is "no single tick can fully drain the connection pool."
6. **Pair with W6 Sub-track H (scheduler heartbeats).** A healthcheck that watches "last successful tick per scheduler" and flips `/api/health` to unhealthy on stale heartbeats would have alerted today before users noticed. Worth doing alongside the above so Railway has a signal to act on.

### Sub-track C — Architectural (later, only if A+B aren't enough)

7. **Split the worker from the web server** — run background cron in a second Railway service that reads/writes the same DB. Web stays responsive even under arbitrary scheduler load. This is the "real" fix but it's a meaningful refactor (separate deploy target, careful split of which code each side imports, advisory-lock semantics review). Don't do it until Sub-tracks A and B stop being sufficient — or when onboarding real paying users, whichever comes first.

### Drawbacks to be honest about

- All of Sub-track A is a *mitigation*, not a *fix*. The real architectural problem is "web and worker share a process." After A+B, you'll see fewer total outages but more partial failures (timed-out venue generations instead of full 502s) — net much better, but don't mistake it for solved.
- Timeout numbers (30s) are best-guess; expect to tune after seeing logs for a week.
- Staggering changes the mental model — debugging requires looking at multiple times in logs instead of "everything at :13."

### Done when

- One full week passes with no `>=15s` HTTP latency spikes correlating to cron job ticks.
- No duplicate scheduler registrations (grep-verifiable).
- All outbound OpenAI / Google Places calls go through a wrapper with a hard timeout.
- Cron job start times are spread across the hour; cron file is the single source of truth.
- (Stretch) Scheduler heartbeat surfaces in `/api/health` per W6 Sub-track H.

---

## Franky notes — delete later / review later candidates (added 2026-05-12)

> These are my cleanup notes from the Task 5 AI-file inventory. They are intentionally annotated as **Franky notes** so it's clear these are my suggestions, not settled product decisions.

### Likely removable later

- **[Franky note] `server/ai-event-validator.ts`**
  - Best delete-later candidate.
  - Only used by `server/smart-event-pairing.ts` as a legacy AI validation layer.
  - Likely removable or mergeable into `smart-event-pairing.ts` once Rachel decides that extra AI validation is not a must-have feature.

- **[Franky note] `server/ai-venue-selector.ts`**
  - Good delete-later candidate.
  - Only used by `server/auto-scheduler.ts` as a fallback after the newer `ai-event-agent` path.
  - If we keep the main agent path + algorithmic fallback, this middle fallback layer may be unnecessary.

### Product-dependent delete-later candidates

- **[Franky note] `server/ai-agent-chat.ts`**
  - Remove only if the conversational AI chat feature is not a product priority.
  - Powers `/api/itineraries/:id/ai-chat`.
  - Depends on Anthropic rather than the main OpenAI flow, which makes it a reasonable simplification candidate if we want fewer AI surfaces.

- **[Franky note] `server/agent-mcp-server.ts`**
  - Treat as paired with `server/ai-agent-chat.ts`.
  - If AI chat is cut, this tool layer is probably removable too.

### Keep for now

- **[Franky note] Keep `server/ai-event-agent.ts`** — central to real planning flows; high-risk to remove.
- **[Franky note] Keep `server/ai-time-picker.ts`** — used across scheduling, rescheduling, reminders; high-risk to remove.
- **[Franky note] Keep `server/ai-itinerary-naming.ts` and `server/ai-scheduling.ts` for now** — smaller, but still wired into live user-facing flows.
  - _Stale annotation (Claude, rev 9):_ `ai-itinerary-naming.ts` no longer makes an AI call as of `2038af3` — `generateItineraryName` was swapped to return the existing deterministic `generateFallbackName`. The file is now a thin wrapper; could be inlined into callers or kept as the export boundary if any callers rely on the function name. No AI cost from this module anymore._
