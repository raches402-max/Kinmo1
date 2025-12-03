# Pre-Launch Checklist for Kinmo.ai Production

**Status:** 📋 In Progress
**Priority:** 🔴 High - Required before production launch
**Created:** 2025-11-21
**Last Updated:** 2025-12-03

This checklist covers all critical tasks needed before deploying Kinmo.ai to production on the custom domain.

---

## 🎯 Launch Phases Overview

| Phase | Focus | Status | Est. Time |
|-------|-------|--------|-----------|
| **Phase 1** | Commit & Stabilize | ✅ Complete | 1-2 hours |
| **Phase 2** | Core Testing | ⏳ Pending | 2-3 hours |
| **Phase 3** | Email & Notifications | ⏳ Pending | 1-2 hours |
| **Phase 4** | Monitoring Setup | ⏳ Pending | 1 hour |
| **Phase 5** | Code Cleanup | 🔄 In Progress | 1-2 hours |
| **Phase 6** | Domain & Deploy | ⏳ Last Step | 1 hour |

**Total estimated time to launch:** 7-11 hours of focused work

---

## 📦 Phase 1: Commit & Stabilize (Do First!)

Get all current work committed and the codebase stable.

### Uncommitted Changes
- [x] Review current git diff (~60 modified files)
- [x] Commit standalone events feature
- [x] Commit "search near itinerary" feature
- [x] Commit bottom nav + button fix
- [x] Commit any other pending features

### TypeScript Cleanup
- [x] Fix critical TypeScript errors (currently ~30)
  - Priority: Focus on errors in core files (routes.ts, storage.ts)
  - Lower priority: Prototype files can be ignored
  - **Note (2025-12-03):** Core TS errors fixed. Some non-blocking errors remain in prototype files.
- [ ] Run `npx tsc --noEmit` with clean output

### Database Sync
- [x] Run `npx drizzle-kit push` to sync any schema changes
- [x] Verify migrations applied: `npx drizzle-kit check`

---

## 🧪 Phase 2: Core Testing (Manual E2E)

Test critical user flows manually before launch.

### Authentication Flow
- [ ] Sign up as new user (Replit Auth)
- [ ] Sign out and sign back in
- [ ] Verify session persistence

### Group Flow
- [ ] Create a new group
- [ ] Set group preferences (location, budget, schedule)
- [ ] Invite a member (test with second account or email)
- [ ] Verify invited member can join

### Event Flow
- [ ] Create event via "Schedule Now" (AI-powered)
- [ ] Create event via manual date selection
- [ ] Verify venues appear in itinerary
- [ ] Test drag-and-drop reordering of venues

### Swipe & Voting Flow
- [ ] Open swipe session for a group
- [ ] Swipe on several venues
- [ ] Verify swipe decisions save correctly
- [ ] Check that swiped venues appear in Favorites

### RSVP Flow
- [ ] Send event invite
- [ ] Open invite link (as guest or member)
- [ ] Submit RSVP response
- [ ] Verify RSVP appears on event

### Mobile Testing
- [ ] Test on actual mobile device or Chrome DevTools mobile mode
- [ ] Verify bottom nav works on all pages
- [ ] Test + button opens create event modal
- [ ] Verify swipe gestures work on cards

---

## 📧 Phase 3: Email & Notifications

### Resend Configuration
- [ ] Log in to Resend dashboard
- [ ] Add kinmo.ai domain for sending
- [ ] Add DNS records (SPF, DKIM, DMARC)
- [ ] Wait for domain verification (~5-30 min)
- [ ] Update RESEND_FROM_EMAIL env var if needed

### Test Email Delivery
- [ ] Send test invite email
- [ ] Check inbox (not spam folder)
- [ ] Send test reminder email
- [ ] Verify email links work correctly

### Notification System
- [ ] Test in-app notifications appear
- [ ] Verify notification bell shows count
- [ ] Test marking notifications as read

---

## 📊 Phase 4: Monitoring Setup

### Sentry (Error Tracking)
- [ ] Create Sentry project (if not done)
- [ ] Add SENTRY_DSN to Replit Secrets
- [ ] Add VITE_SENTRY_DSN to Replit Secrets
- [ ] Trigger a test error to verify it appears in Sentry

### Uptime Monitoring
- [ ] Sign up for UptimeRobot (free tier)
- [ ] Add monitor for https://[your-replit-url]/api/health
- [ ] Configure email alerts for downtime
- [ ] Test alert by temporarily breaking health endpoint

### Database Backups (Neon)
- [ ] Log in to Neon dashboard
- [ ] Verify Point-in-Time Recovery is enabled
- [ ] Note the backup retention period
- [ ] Test manual backup export (optional)

---

## 🧹 Phase 5: Code Cleanup

### Remove Debug Code
- [x] Search for `console.log` and remove non-essential ones
  - Keep: Error logs, important state changes
  - Remove: Debug logs, temporary logs
  - **Note (2025-12-03):** Cleaned up excessive console.log statements
- [ ] Remove any `// TODO: remove` comments
- [ ] Remove unused imports (IDE can help)

### Remove Unused Dependencies
- [ ] Run `npx depcheck` and review output
- [ ] Remove clearly unused packages
- [ ] Be careful with peer dependencies

### Clean Up Files
- [ ] Remove or archive prototype files if not needed:
  - client/src/pages/prototype-*.tsx
  - client/src/components/BottomNavConcepts.tsx
- [ ] Review attached_assets/ folder
- [ ] Clean up any temp files

### Git Hygiene
- [ ] Ensure .env files are in .gitignore
- [ ] Check `git log --all -- .env` for any committed secrets
- [ ] Consider squashing commits before deploy (optional)

---

## 🌐 Phase 6: Domain & Deploy (Last Step!)

**Do this only when everything else is ready.** Replit billing starts at deployment.

### Pre-Deploy Checks
- [ ] All Phase 1-5 items complete
- [ ] Final production build passes: `npm run build`
- [ ] All critical tests passing

### Environment Variables for Production
- [ ] Set NODE_ENV to 'production'
- [ ] Set FRONTEND_URL to https://kinmo.ai
- [ ] Update REPLIT_DOMAINS with kinmo.ai
- [ ] Configure ALLOWED_ORIGINS (kinmo.ai, remove localhost)

### Domain Setup
- [ ] Set up custom domain (Kinmo.ai) on Replit
  - Docs: https://docs.replit.com/hosting/deployments/custom-domains
- [ ] Configure DNS records (A/AAAA or CNAME)
- [ ] Wait for DNS propagation (~5-30 min)
- [ ] Verify SSL certificate is active

### Deploy
- [ ] Deploy to production via Replit
- [ ] Verify site loads on kinmo.ai
- [ ] Test authentication flow on production domain
- [ ] Monitor logs for first 30 minutes

---

## ✅ Already Completed

### Bug Fixes (2025-12-03)
- [x] Fixed duplicate events bug on Mission Amigos dashboard
  - Root cause: Events fetched from two sources (`/api/user/events` and `/api/groups/:id/auto-scheduled-events`) were both returning same itineraries
  - Fixed by deduplicating by `itineraryId` in the merge logic
- [x] Fixed TypeScript build errors (critical ones - some non-blocking remain in prototype files)

### New Features (2025-12-03)
- [x] Added compact mobile week view for Group Availability Heatmap
  - Shows all 7 days × 3 time slots in a single tappable grid
  - Used in Group Settings and My Preferences tabs
  - `mobileMode="compact-week"` prop added to `GroupAvailabilityHeatmap`
- [x] Added default quorum threshold setting per group
  - Groups can set their own default quorum (10-100%) for new events
  - New `defaultQuorumThreshold` field in groups schema
  - Slider UI in Group Settings → Basic Info section

### Security
- [x] Environment variables validated with Zod schema
- [x] DATABASE_URL points to Neon PostgreSQL
- [x] SESSION_SECRET is strong (88 chars)
- [x] Rate limiting configured (100 req/15min API, 5 req/15min auth)
- [x] CSP enabled in production mode
- [x] All admin endpoints secured
- [x] CORS configured for production

### API Keys
- [x] OpenAI API key verified
- [x] Google Places API keys configured (2 keys for load balancing)

### Database
- [x] Migrations up to date
- [x] Connection tested

### Build
- [x] Production build works (~15s)
- [x] Assets properly bundled (2.1MB)
- [x] Dev plugins disabled in production

### Infrastructure
- [x] Health check endpoint exists (/api/health)
- [x] Sentry integrated (needs DSN)
- [x] Error boundaries in React

### Legal
- [x] Privacy Policy page (/privacy)
- [x] Terms of Service page (/terms)
- [x] Footer links added

---

## 💡 Nice-to-Have (Post-Launch)

These can wait until after you have real users:

- [ ] Set up staging environment
- [ ] Configure CI/CD pipeline
- [ ] Create load testing suite
- [ ] Set up feature flags
- [ ] Add analytics (Google Analytics, Plausible)
- [ ] Create FAQ page
- [ ] Video tutorials
- [ ] Status page

---

## 📝 Notes

**Deployment Environment:**
- Platform: Replit with autoscale
- Database: Neon PostgreSQL
- Auth: Replit Auth (OIDC)
- Email: Resend
- AI: OpenAI GPT-4
- Maps: Google Places API

**Target Launch Date:** TBD

---

*Last updated: 2025-12-03*
