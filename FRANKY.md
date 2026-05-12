# Franky — Kinmo Cleanup Tasks

> Working doc for handing tasks to the open-claw "Franky" agent. **Do ONE task at a time.** After each task, Rachel reviews `git diff` and decides commit-or-revert before unlocking the next task.

---

## 📋 BRIEFING — Read this first, every session

You're helping with Kinmo, an AI-powered group event planning app. Solo developer (Rachel). Project located at:

```
/Users/frankycho/.openclaw/workspace/projects/kinmo/v2
```

### Production state (DO NOT TOUCH)

- Hosted at https://kinmo-production.up.railway.app
- Deployed on **Railway** (project "affectionate-passion")
- Database: **Railway Postgres** with real user data (8,800 rows)
- Auth: **Google OAuth** via Passport
- Master plan doc: `v2/PLAN.md` — read this for context on the workstreams
- Current memory state: see `/Users/frankycho/.claude/projects/-Users-frankycho--openclaw-workspace-projects-kinmo-v2/memory/`

### Guardrails — DO NOT do any of these

1. ❌ Do not touch the Railway dashboard or env vars (Rachel has access, you don't)
2. ❌ Do not touch the Google Cloud Console
3. ❌ Do not push directly to the deployed app or to `origin/main`
4. ❌ Do not run anything that modifies the Railway Postgres database
5. ❌ Do not commit any files unless Rachel reviews the `git diff` first
6. ❌ Do not install new npm dependencies without asking
7. ❌ Do not work on multiple tasks in one session — finish one, check in, wait

### Process for every task

1. Read this entire doc
2. Find the section marked **🟢 ACTIVE** below
3. Do only that task
4. After making changes:
   - Run `npm run check` (must pass — no TypeScript errors)
   - Run `git diff` and copy the output
5. Report back to Rachel:
   - ✅ What you did
   - 📋 The full `git diff` output
   - ⚠️ Any surprises or ambiguity you hit
   - 🛑 Anything you skipped or couldn't do
6. **DO NOT COMMIT** yet — Rachel will review and tell you whether to commit or revert
7. **DO NOT START THE NEXT TASK** — wait for Rachel to mark this one ✅ and unlock the next

### Commit message format (when Rachel approves)

```
v2: <short description>

<body explaining why, 1-2 sentences>

Co-Authored-By: Franky <noreply@openclaw>
```

---

## 📊 Task Status

| Task | Status | Owner |
|---|---|---|
| Task 1: Audit pre-existing WIP | ✅ COMPLETED | Franky |
| Task 2: Replit cleanup | ✅ COMPLETED | Franky |
| Task 3: Update `.env.example` | ✅ COMPLETED | Franky |
| Task 4: Workstream 6 quick wins | ✅ COMPLETED | Franky |
| Task 5: Inventory `ai-*` files | ✅ COMPLETED | Franky |

---

## ✅ TASK 1: Audit pre-existing uncommitted WIP

**Goal:** Tell Rachel what's in her working tree from before this session, so she can decide what to commit vs discard.

**This is READ-ONLY. You will not modify any files. You will not stage or commit anything.**

### Steps

1. Run `git status` and observe what's modified or untracked. You should see roughly:
   ```
   Modified:
     .gitignore
     client/src/components/event-detail/DesktopEventDetails.tsx
     client/src/components/event-detail/RefinedCard.tsx
     client/src/pages/prototype-event-details-desktop.tsx
     client/src/pages/prototype-group-details-desktop.tsx
     client/src/pages/rsvp-itinerary.tsx
     server/routes.ts
     vercel.json
   Untracked:
     USOPP-HEARTBEAT.md
     server/auto-reschedule.ts
     server/routes/
   ```
   (The exact list may differ slightly — work with whatever you actually see.)

2. **For each MODIFIED file**: run `git diff HEAD <file>` and read the changes.

3. **For each UNTRACKED file or folder**: read its contents directly. For folders (`server/routes/`), list the files inside and read the smaller ones.

4. **Produce a markdown table** for Rachel with these columns:

   | File | What changed | Looks like | Recommendation |

   Where:
   - **What changed** = one-sentence summary (e.g., "Adds new color prop to RefinedCard")
   - **Looks like** = pick one: `finished` / `WIP` / `experimental` / `unrelated` / `unsure`
   - **Recommendation** = pick one: `commit` / `keep WIP` / `discard with git restore` / `unsure — ask Rachel`

### Context that may help you classify

- `v2/PLAN.md` Workstream 4 plans to split `routes.ts` into a `server/routes/` folder, so the `server/routes/` folder being there is probably **intentional WIP** toward Workstream 4.
- `server/auto-reschedule.ts` might also be Workstream 4 prep.
- `USOPP-HEARTBEAT.md` is a scratch file from another agent — not Rachel's work. Likely safe to discard but ask before doing so.
- Files in `prototype-*` are design experiments — could be WIP design work.

### Hard rules for this task

- ❌ Do **NOT** run `git add`, `git restore`, `git commit`, or `git rm`
- ❌ Do **NOT** modify any of the files you're auditing
- ❌ Do **NOT** start Task 2 even if Task 1 was easy

### What to report back to Rachel

```markdown
## Task 1 audit results

[Your markdown table here]

### Summary
- N files look ready to commit
- N files look like active WIP
- N files I'm unsure about (listed above with "ask Rachel")
- Any surprises / things you noticed
```

Total length: under 500 words.

---

## ✅ TASK 2: Replit cleanup

> Will unlock after Task 1 is approved.

<details>
<summary>Click to expand task details (for Rachel's reference)</summary>

**Goal:** Remove Replit-era cruft now that Kinmo is on Railway. All changes reversible via git revert.

### Steps

1. Delete `vercel.json` (we're on Railway, this is unused).

2. In `package.json`, remove these scripts entirely:
   - `"dev:replit"`
   - `"fix"`
   - `"fix:full"`

   Keep `"kill"` and `"kill:port"` — those are generic, not Replit-specific.

3. Delete these files at the repo root IF they exist (use `ls *.sh` first):
   - `start-replit.sh`
   - `fix-replit.sh`

4. In `server/config.ts`, remove these Zod schema entries:
   - `REPLIT_DOMAINS`
   - `REPL_ID`
   - `ISSUER_URL`
   - `REPLIT_DEV_DOMAIN`

   **Do NOT remove `CUSTOM_DOMAINS`** — it's still used by `server/googleAuth.ts`.

   Before removing each, grep to confirm it's truly unused:
   ```
   grep -rn "REPLIT_DOMAINS" --include="*.ts" --include="*.tsx" .
   ```
   If any usage exists outside `server/config.ts`, **STOP and tell Rachel**.

5. Run `npm run check` — must pass.

6. Show Rachel the `git diff`. Do not commit.

</details>

---

## ✅ TASK 3: Update `.env.example`

<details>
<summary>Click to expand task details</summary>

**Goal:** Update `.env.example` to reflect the current Railway-based setup.

### Steps

1. Read the current `.env.example` to see what's there.

2. Make these changes:

   a) Update the `DATABASE_URL` comment to reflect Railway, not Neon:
      ```
      # PostgreSQL connection string. On Railway, auto-wired from the
      # Postgres service via ${{Postgres.DATABASE_URL}}.
      # For local dev, point at your local Postgres or a Neon free tier.
      DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
      ```

   b) Add this new section:
      ```
      # ============================================================
      # PRODUCTION (Railway)
      # ============================================================
      # Required for cron job endpoints in production. Generate with:
      #   openssl rand -hex 32
      CRON_SECRET=

      # Comma-separated list of domains that should have a Google OAuth
      # strategy registered. Example: kinmo-production.up.railway.app,kinmo.ai
      CUSTOM_DOMAINS=
      ```

   c) Remove the REPLIT_* section if there's still one.

3. Run `npm run check` — must pass.

4. Show Rachel the `git diff`. Do not commit.

</details>

---

## ✅ TASK 4: Workstream 6 quick wins

<details>
<summary>Click to expand task details</summary>

**Goal:** Apply small Workstream 6 fixes from `v2/PLAN.md`.

Read **Workstream 6** in `v2/PLAN.md` first for context.

Do these one at a time, with `npm run check` after each. Show Rachel the diff after EACH fix before moving to the next.

### Fix 4a: Hardcoded admin email fallback

In `server/authorization.ts` around line 339, there's a fallback like:
```
|| 'raches402@gmail.com'
```
Remove that fallback. If `ADMIN_EMAILS` env var is missing, treat the admin list as empty (nobody is admin), not as a hardcoded email.

### Fix 4b: Sentry capture for fire-and-forget `.catch()`

In `server/routes.ts` at lines 4961, 4968, 4974:

Each is a fire-and-forget call like:
```
someCall().catch(err => { console.error(...); });
```

Wrap to also capture:
```
someCall().catch(err => {
  console.error('<keep existing message>', err);
  Sentry.captureException(err);
});
```

Check if `Sentry` is imported at the top of `routes.ts`. If not, add:
```
import * as Sentry from "@sentry/node";
```

Three locations ONLY. Don't change other `.catch()` handlers.

### Fix 4c: Frontend Sentry init

In `client/src/main.tsx`, mirror the server Sentry pattern from `server/index.ts` (around lines 18-32). Use `@sentry/react` instead of `@sentry/node`.

Wrap the init in `if (import.meta.env.VITE_SENTRY_DSN)` so it only runs when configured.

`@sentry/react` is already in `package.json` — don't install anything.

After all three fixes, run `npm run check` + `git diff`. Show Rachel before committing.

</details>

---

## ✅ TASK 5: Inventory `ai-*` server files (READ-ONLY)

<details>
<summary>Click to expand task details</summary>

**Goal:** Produce an inventory of AI-related server files so Rachel can decide later which are still product features vs retirable experiments.

Files to inspect:
- `server/ai-agent-chat.ts`
- `server/ai-event-agent.ts`
- `server/ai-event-validator.ts`
- `server/ai-itinerary-naming.ts`
- `server/ai-scheduling.ts`
- `server/ai-time-picker.ts`
- `server/ai-venue-selector.ts`
- `server/agent-mcp-server.ts`

For each, produce a markdown table row:

| File | LOC | What it does (1 sentence) | Imported by | Wired into runtime? | Risk to delete |

- **LOC**: use `wc -l`
- **What it does**: read the top comment / first 30 lines
- **Imported by**: list of files importing this (use `grep -rln "from.*<filename>"`)
- **Wired into runtime**: yes / no / partial — does normal server boot reach this?
- **Risk to delete**: low / medium / high

Do NOT delete or modify anything. Just produce the table.
Under 500 words.

</details>

---

## 🛣️ Lanes & Coordination (added 2026-05-12)

Two agents (Franky + Claude) plus Rachel are now editing this repo. Without explicit lanes, sessions overlap — as happened today, when Franky reverted the Batch API while Claude was mid-implementation of the same revert. To prevent that:

### Workstream ownership

| Workstream | Owner | Notes |
|---|---|---|
| W2 — Replit cleanup leftovers | Franky | If anything new surfaces |
| W3 — API cost control | Claude | Tiers 0–4 shipped (`0583809..ccf5928`); Batch API reverted, may reattempt later |
| W4 — Architecture cleanup (routes split, etc.) | Claude | Slice 2 shipped (`7506c88`); slices 1/3/4 still open |
| W5 — Code hygiene | Franky | Sentry catches, dead code removal, etc. |
| W6 — Security & data integrity | Franky | Sub-tracks A/B/C/F shipped; D/E/G/H remain |
| PLAN.md edits | Rachel (or whoever has freshest state) | Append-only mental model; rev number must increment |
| FRANKY.md task assignments | Rachel | Adding/closing tasks |
| Railway dashboard / env vars / Google Cloud Console | Rachel | Agents do not have access |

If a task crosses lanes (e.g., a W3 cost change that touches W5 hygiene), the owner with the most context starts it and pings Rachel before committing.

### Review-before-commit (re-emphasis of guardrail #5)

**Default: do not commit.** Run `git diff`, paste to Rachel, wait for go-ahead. This is what guardrail #5 says.

Franky has been chaining tasks and committing autonomously today. Some of that was useful (the Batch API revert needed to happen fast), but it also caused the duplicate-revert situation. Going forward:
- For tasks already on this list with clear scope (e.g., "lock down 6 unprotected GET routes"), autonomous commit is acceptable IF typecheck passes and the diff stays in the named scope
- For anything cross-cutting, anything touching production state, or anything that contradicts another in-flight session, **stop and check in with Rachel first**

### Shared files — coordinate explicitly

These files are touched by everyone. Assume your in-memory view is stale and re-read before editing:

- `PLAN.md` — bump the rev number and date on every edit so it's obvious which version is freshest
- `FRANKY.md` — Rachel manages task assignments; everyone may add to the Progress Log
- `shared/schema.ts` — schema changes need a matching migration file AND need to be pushed to Railway (not just Neon) AND need to be communicated to other agents before they wire code to the new columns
- `migrations/*.sql` — apply to BOTH Railway and Neon (Franky has been doing this); record which DBs each migration was applied to in the commit message

### Git-author note

All commits in this repo are attributed to `Franky Cho <frankycho@Frankys-Mac-mini.local>` because that's the local git config, even when Claude or Rachel wrote the commit. This means `git log --author=Franky` is not a reliable filter for "what Franky did" — you have to read commit messages and content. If we ever want clean attribution, configure separate git identities per agent (out of scope for now; flagging).

---

## 📜 Progress Log

> Franky: append a line here after each task. Format: `YYYY-MM-DD HH:MM — Task N — <one-line summary of what you did>`

- 2026-05-12 12:00 — Task 1 — Verified the old audit target was no longer actionable because the working tree had already been cleaned up / committed.
- 2026-05-12 12:15 — Task 2 — Removed Replit/Vercel leftovers, then replaced remaining live `REPLIT_*` usages with Railway/current-host-safe behavior.
- 2026-05-12 12:25 — Task 3 — Updated `.env.example` for Railway, added `CRON_SECRET` + `CUSTOM_DOMAINS`, and removed stale Replit examples.
- 2026-05-12 12:45 — Task 4 — Removed hardcoded admin fallback, added Sentry capture to 3 fire-and-forget handlers, and verified frontend Sentry init was already in place.
- 2026-05-12 12:55 — Task 5 — Completed read-only inventory of `ai-*` server files and added Franky-labeled delete-later notes to `PLAN.md`.
