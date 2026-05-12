# Kinmo V2 — Master Plan

_Last updated: 2026-05-12 (rev 7 — W3 cost control shipped through tier 4; Batch API was reverted in `6d618ac`; W6 sub-tracks A/B/C/F done; migration 0014 live on Neon + Railway; migration 0015 applied but currently orphan after revert)_

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
| 3 | API cost control | ✅ **DONE** through tier 4 (`0583809..ccf5928`). Batch API (`ac78be8`) was reverted in `6d618ac`; the `ai_batch_requests` table created by migration `0015` is **orphan on both Neon and Railway** until that work is reattempted. |
| 4 | Architecture cleanup | 🔄 **In progress** — Slice 2 (split routes.ts) **COMMITTED** (`7506c88`); slices 1/3/4 remain |
| 5 | Code hygiene | 🔄 Ongoing — Sentry on 3 RSVP fire-and-forget catches done (`771f1f7`); frontend Sentry verified by Franky; env validation + advisory lock TTL remain |
| 6 | Security & data-integrity hardening | 🔄 In progress — sub-tracks A (`67b286f`), B (admin fallback, `771f1f7`), C (vote unique constraints, `0d1b819`), F (`dc8f207`) shipped; D/E/G/H remain |

**Production cost:** ~$10/mo on Railway (app + Postgres). API keys (OpenAI, Resend, Google Places) currently set to placeholders — features depending on them won't work until real keys are added.

---

## Guiding principle: fix in place, delete aggressively first

We're not rewriting. The schema, product logic, AI prompts, and stack are all worth keeping. The mess is surface-level — accumulated code, not foundational rot.

**Operating rules:**
- Before refactoring any file, ask "should this exist at all?" If no, delete it.
- A working `git revert` and "no live users yet" is permission to delete liberally. Bias toward deletion when in doubt.
- Don't refactor things on the way out the door. Better to delete than reorganize.

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

**Reverted:** the Batch API integration (`ac78be8`, tier 4 #9) was rolled back in `6d618ac` later the same day. The supporting migration `0015_add_ai_batch_requests.sql` (`2aeddd8`) had already been applied to both Neon and Railway — the `ai_batch_requests` table now exists in both DBs with no code referencing it. **Orphan-table cleanup options:** (a) leave it, harmless; (b) `DROP TABLE ai_batch_requests` if/when we want a clean slate. Re-attempting Batch API later can re-use migration 0015 (it's idempotent).

Tool-use batching for auto-scheduler + activity-refresh batching also still open — they were the deferred follow-ups from Franky's reverted commit, not yet attempted.

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

**Slice 4: Standardize error responses**

Routes today return three inconsistent shapes: `{ message }`, `{ success: true, data }`, and `{ success: false, error }`. Pick one (recommend `{ success, data?, error? }` since it's already the majority) and add a wrapper middleware. Also stop leaking raw `error.message` in 500 responses — they can include Drizzle SQL fragments (`server/routes.ts:563, 575, 590, 610`).

(Dead code audit and `as any` cleanup were moved to Workstream 0. By the time we reach this workstream, the codebase is already smaller and tighter.)

---

## Workstream 5 — Code hygiene (ongoing, not a phase)

- **Delete what you don't need.** Every time you open a file to change something, check if neighbors are still used.
- **Fix the OpenAI key.** `.env` is missing a working `OPENAI_API_KEY` — currently every background job throws 401. Either set a real key or guard those features behind a "if no key, skip" check so logs stay clean.
- **Tighten env validation** in `server/config.ts` — fail loudly at startup if a required key is missing, not silently at runtime.
- **Fire-and-forget `.catch()` calls** at `server/routes.ts:4961, 4968, 4974` log errors but never report to Sentry. Add `Sentry.captureException(err)` inside each. Same anti-pattern on the client: `CopyGuestInviteLink.tsx:43–44` and `CopyEventInviteLink.tsx:61` silently `console.error` without toasting.
- **Advisory lock TTL:** `server/auto-scheduler.ts:1213` uses `pg_try_advisory_lock` but if a process dies mid-job the lock can sit for 24+ hours. Either switch to `pg_advisory_lock_shared(lock_id, timeout)` semantics or add a periodic `pg_advisory_unlock_all()` cleanup.
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

### Sub-track D: Missing indexes 🟡 Partial

Vote-table indexes were added in migration `0014` (W6 Sub-track C). Still open:
- `members.userId` — no index, full-table scans on user lookup
- `rsvps.userId` — same
- `deletedAt` columns — only `curatedVenues` has one; add for `groups`, `members`, etc.

### Sub-track E: Soft-delete consistency

`groups` use `deletedAt` but `storage.getMembers(groupId)` (`server/storage.ts:593`) doesn't filter out members of deleted groups. Audit every `storage.*` function that reads child records to ensure they join against the parent's `deletedAt`.

### Sub-track F: Sensitive request bodies in logs

`server/routes.ts:4832, 5121, 9010, 9021` log full `req.body` as JSON. This will dump emails and preferences into Vercel/Railway log retention.

**Action:** Replace with structured logs that include only IDs and outcomes.

### Sub-track G: Account deletion flow

No `/api/user/delete` endpoint exists. Users can't delete their account or data. Not urgent for solo-dev stage, but should exist before any public exposure (privacy/GDPR posture).

**Action:** Defer until pre-launch. Add endpoint that cascades user → sessions → memberships, or soft-deletes user and anonymizes.

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

1. ⏭️ **Add real API keys to Railway** — `OPENAI_API_KEY` (replace `stub_not_used`), `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`. Stops the log spam, unlocks AI/email/venue features.
2. ✅ ~~Verify Google OAuth login works locally~~ — works in production; localhost support added in `e37fb58`
3. ✅ ~~Pull 30-day API cost report~~ — done as part of W3 diagnosis (drove the tier 0-4 implementation)
4. ✅ ~~Spike a Railway deploy~~ — way past spiking, fully deployed
5. ✅ ~~Fix hardcoded admin fallback~~ (`server/authorization.ts:339`) — completed in Franky Task 4a (`771f1f7`)
6. ✅ ~~Add unique constraints to vote tables~~ — shipped in `0d1b819` + migration `0014` applied to Neon and Railway
7. ✅ ~~Run `npx knip`~~ — done, drove W0
8. ✅ ~~Commit the routes.ts split WIP~~ — shipped in `7506c88` (W4 Slice 2)
9. ⏭️ **Apply 0014 + 0015 migrations whenever a new DB is provisioned** — both are hand-written SQL with idempotent applier scripts (`scripts/apply-migration-0014.ts`, `scripts/apply-migration-0015.ts`). Run via `railway run --service=Postgres -- bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/apply-migration-NNNN.ts'`.

---

## What this plan deliberately does NOT include

- New features. We're stabilizing first.
- Mobile app / native — out of scope.
- Public launch / marketing — out of scope until infra is solid.
- Anything that doesn't reduce risk, cost, or maintenance burden.
- **Comprehensive test suite.** Acknowledging the gap: there are zero `vitest`/`jest`/`playwright` test files in this repo. We're deferring rather than denying. When the codebase stabilizes post-refactor, add at minimum: scheduler integration tests, auth flow tests, and storage-layer tests.

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
