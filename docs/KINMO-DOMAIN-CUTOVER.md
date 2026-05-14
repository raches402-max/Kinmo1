# kinmo.ai cutover checklist

Rachel is transferring DNS for `kinmo.ai` from GoDaddy → Railway. Once DNS
resolves, run through this checklist to flip the cutover. Most of the code
is already kinmo.ai-aware (see "Already wired" below).

---

## When DNS has resolved — the cutover steps

### 1. Railway: add Custom Domain

Railway dashboard → `Kinmo1` service → **Networking** → **Custom Domain**.

- Add `kinmo.ai` as the custom domain.
- Optional: also add `www.kinmo.ai` if you want both to work.
- Railway will show a target value (usually a `<random>.up.railway.app` CNAME or a static IP for the apex). DNS at the registrar should already point there from the transfer.

Wait for Railway to show "✓ active" or the green check next to the domain.

### 2. Railway: set the BASE_URL env vars

Railway dashboard → `Kinmo1` service → **Variables**.

```
BASE_URL=https://kinmo.ai
FRONTEND_URL=https://kinmo.ai
```

These are read by `server/og-meta.ts` (line 58) and the Replit-cleanup-era
URL generation. The code already falls back to `https://kinmo.ai` if both
are unset, so these are belt-and-suspenders — but set them explicitly so
future env audits don't flag the fallback.

### 3. Google Cloud Console: add OAuth redirect URI

Google Cloud Console → APIs & Services → Credentials → **Kinmo.ai Auth**
OAuth 2.0 Client → **Authorized redirect URIs**.

Add:

```
https://kinmo.ai/api/auth/google/callback
```

Also keep the existing Railway URL entry (`https://kinmo-production.up.railway.app/api/auth/google/callback`) for a few days as fallback in case anyone hits the Railway URL directly.

### 4. Smoke test

- Open `https://kinmo.ai` in an incognito window
- Click "Sign in with Google"
- Confirm the OAuth consent screen shows kinmo.ai (not Railway)
- Confirm you land back on `https://kinmo.ai/` authenticated
- Hit `https://kinmo.ai/api/health` — should return `{ ok: true }` or similar
- Open dashboard, load a group, confirm photos + venue data render

### 5. Optional follow-ups (do later, not at cutover)

- Update `CUSTOM_DOMAINS` env var if you want it to *also* list `www.kinmo.ai`.
- Once kinmo.ai is stable for ~1 week, remove the Railway URL from Google OAuth Authorized redirect URIs (cleanup).
- Update any docs/screenshots/marketing that reference `kinmo-production.up.railway.app`.

---

## Already wired (no action needed — the code is kinmo.ai-aware today)

These read as "already correct" — listing so future-you can grep for
where the domain shows up:

- `server/googleAuth.ts:9` — `HARDCODED_CUSTOM_DOMAINS = ["kinmo.ai"]` ensures OAuth strategy is registered for kinmo.ai on every server boot
- `server/routes.ts:9524` — invite link generation uses `primaryDomain = 'kinmo.ai'`
- `server/og-meta.ts:58` — production fallback is `https://kinmo.ai`
- `server/email-service.ts` — all `from:` lines are `invites@kinmo.ai`; footer links are `kinmo.ai`
- `server/reminder-scheduler.ts:115` — availability pulse links fall back to `https://kinmo.ai` if `REPLIT_DEPLOYMENT_URL` is unset (and it is, post-Replit)

---

## If the cutover goes sideways

Rollback is dead-simple: just delete the Custom Domain from Railway and
remove the kinmo.ai redirect URI from Google OAuth. The Railway URL
(`kinmo-production.up.railway.app`) keeps working the whole time.
