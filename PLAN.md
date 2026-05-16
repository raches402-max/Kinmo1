# Kinmo V2 — Master Plan

_Last updated: 2026-05-15 (rev 13 — added W8 recommendation foundations: outcome instrumentation gap + cache prune. Driven by dev DB analysis showing only 1 completed itinerary, empty `venue_visit_history`, and ~10-15 of 5,300 curated venues with any positive engagement signal.)_

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
| 8 | Recommendation foundations | 🆕 **New** (2026-05-15) — close outcome instrumentation gap (itinerary status, `venue_visit_history`, post-event feedback) so the recommender can learn from real group history; then manually curate `curated_venues` down from ~5,300 to a ~100-200/metro starter pool. See W8 below. |

**Production cost:** ~$10/mo on Railway (app + Postgres). API keys (OpenAI, Resend, Google Places) currently set to placeholders — features depending on them won't work until real keys are added.

---

## In focus right now

1. **W8 Sub-track A** — Close the outcome instrumentation gap: itineraries flip to `completed` after events, `venue_visit_history` gets populated, post-event feedback fill rate goes up from 4/50. Unblocks every "learn from group history" recommendation strategy.
2. **W4 remaining** — Architecture cleanup: Slice 1 (group `server/` by domain), Slice 3 (split `storage.ts`)
3. **W6 remaining** — Sub-track H (background-job healthchecks). G (account deletion flow) shipped in `d1d7471`.
4. **W5 ongoing** — Code hygiene: fire-and-forget `.catch()` Sentry wiring, frontend Sentry client init
5. **Apply migration 0016** to Railway (missing indexes for `members.userId`, `rsvps.userId`, cache tables)
6. **Add real API keys to Railway** — `OPENAI_API_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `ADMIN_EMAILS`

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

## Workstream 8 — Recommendation foundations 🆕 New

**Goal:** Make Kinmo recommend from what groups actually like, not from a 5,300-venue cache the AI keeps recycling the same handful of suggestions from. Per project principle: *build for memory, not discovery* (see `[[kinmo-recommendations-philosophy]]`).

**Why now:** dev DB analysis on 2026-05-15 surfaced four foundational gaps:
- Only **1 itinerary marked `completed`** out of 54 — events happen but the status never flips.
- **`venue_visit_history` table is empty** (0 rows) — the "we went here" table exists but isn't being written to.
- **Post-event feedback was filled 4 times** out of ~50 events — gold-standard signal almost never captured. The form is too easy to skip.
- `voting_events.trust_source` was backfilled to `'backfill'` for all 101 rows — historical data can't separate user-added from AI-suggested venues. New rows can populate it correctly going forward, but ~544 existing rows are ambiguous.

Net effect: of 5,300 curated venues, only ~10-15 have any positive engagement signal. AI repeatedly surfaces the same venues (Bambu Dessert Drinks appears in 7 proposed itineraries the group never actually went to, Burma Silver Star in 7, Curry Hyuga in 7) because that's all it has signal on.

The right end state for the cache is ~100-200 venues per metro that match patterns from real group data — but the data-driven prune can't run until the outcome signals are actually being collected.

### Sub-track A — Close the outcome instrumentation gap (critical, this week)

The recommendation engine can't learn from history if history isn't recorded. Three concrete fixes:

1. **Itinerary status flip to `completed`** — audit the event lifecycle: where SHOULD status move `scheduled` → `completed`? Likely either (a) automatic after `eventDate` passes with at least one yes RSVP, or (b) a manual "did this happen?" tap from the organizer. Decide and wire it.
2. **Populate `venue_visit_history`** — when status flips to `completed`, insert one row per `itinerary_items` row into `venue_visit_history`. Backfill from past scheduled itineraries where reasonable.
3. **Surface post-event feedback consistently** — 4/50+ fill rate means the prompt isn't reaching members or is too easy to dismiss. Make it a low-friction tap (1-tap "did you go? thumbs up/down" beats a multi-field form), and trigger it reliably the morning after every completed event.

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
- Itineraries reliably move to `completed` after events happen; `venue_visit_history` has rows for past events.
- Post-event feedback fill rate is meaningfully higher (target: ≥50% of completed events get any feedback).
- `curated_venues` is sized to the served-metro starter pool (~100-200 venues per metro), with archived rows accessible in `deleted_venues`.
- Recommendation flow leans on the curated pool + group history before going to fresh API discovery.

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
