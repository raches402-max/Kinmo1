# Routes Split Plan

## Problem
`server/routes.ts` is 17,644 lines with 261 route handlers — unmaintainable monolith.

## Goal
Split into focused modules under `server/routes/`, each owning a logical domain.
The `registerRoutes()` function in `routes.ts` remains the entry point and delegates to modules.

---

## Proposed Modules

| File | Routes | Description |
|------|--------|-------------|
| `auth.ts` | `GET /api/auth/user` | Auth state routes (OAuth handled in `googleAuth.ts`) |
| `health.ts` | `GET /api/health`, `GET /api/debug/paths` | Health + debug endpoints |
| `og-image.ts` | `GET /api/og-image/:type/:id` | OG image generation for social shares |
| `user.ts` | `GET/PATCH /api/user/profile`, `GET/PATCH /api/user/preferences`, `GET /api/user/groups`, `GET /api/user/events`, etc. | User profile, prefs, collections, dashboard, events (~20 routes) |
| `groups.ts` | `GET/POST/PATCH/DELETE /api/groups/*` | Group CRUD, automation, scheduling (~30 routes) |
| `members.ts` | `GET/PATCH/DELETE /api/members/*` | Member management, constraints, favorites, RSVPs (~15 routes) |
| `itineraries.ts` | `GET/POST/PATCH /api/itineraries/*` | Itinerary lifecycle, send, finalize, RSVPs (~25 routes) |
| `voting.ts` | `GET/POST/PATCH /api/voting-events/*` + `/api/groups/:id/voting-events` | Voting sessions and ballots |
| `swipe.ts` | `POST /api/groups/:groupId/swipe-sessions`, `GET /api/swipe-sessions/*`, etc. | Activity swipe feature |
| `venues.ts` | `GET /api/venues/search`, `/api/photos/*`, refresh-photo, etc. | Venue search, photos, places |
| `auto-events.ts` | `/api/auto-events/*`, `/api/auto-schedule/*`, `/api/groups/:id/trigger-auto-schedule` | AI auto-scheduling |
| `availability.ts` | `/api/availability-pulse/*`, `/api/groups/:groupId/members-availability`, etc. | Availability tracking |
| `notifications.ts` | `/api/notifications/*` | Notification CRUD |
| `standalone-events.ts` | `/api/standalone-events/*`, `/api/standalone-invite/*` | Events outside groups |
| `insights.ts` | `/api/groups/:groupId/insights`, `/api/planning-insights/*`, `/api/groups/:groupId/analyze` | Group insights & analysis |
| `admin.ts` | `/api/admin/*` | All admin endpoints (~25 routes) |
| `cron.ts` | `/api/cron/*` | Cron job trigger endpoints |
| `geocode.ts` | `/api/geocode` | Geocoding utility |

---

## Migration Strategy

### Phase 1 ✅ Auth (this PR)
- Extract `GET /api/auth/user` → `auth.ts`
- Create `index.ts` as integration shim

### Phase 2 — Health + OG Image (quick wins, no deps)
- Extract `health.ts` and `og-image.ts`

### Phase 3 — User routes
- Extract all `/api/user/*` routes → `user.ts`

### Phase 4 — Groups + Members
- Extract `/api/groups/*` and `/api/members/*` (high-traffic core)

### Phase 5 — Itineraries
- Extract itinerary routes (largest chunk)

### Phase 6 — Everything else
- Venues, voting, swipe, auto-events, notifications, admin, cron

---

## File Structure (end state)

```
server/
  routes.ts              # Original (shrinks to near-empty over time)
  routes/
    index.ts             # Registers all sub-routers
    SPLIT_PLAN.md        # This file
    auth.ts              # ✅ Done
    health.ts
    og-image.ts
    user.ts
    groups.ts
    members.ts
    itineraries.ts
    voting.ts
    swipe.ts
    venues.ts
    auto-events.ts
    availability.ts
    notifications.ts
    standalone-events.ts
    insights.ts
    admin.ts
    cron.ts
    geocode.ts
```

---

## Key Dependencies (shared across modules)
All modules will need:
- `storage` from `../storage`
- `db` from `../db`
- `isAuthenticated`, `getUserId` from `../googleAuth` / `../authorization`
- Various authorization middleware from `../authorization`
- `zod` + `safeParse`/`validate` from `../validation-middleware`
