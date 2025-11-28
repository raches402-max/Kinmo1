# Pre-Launch Checklist for Kinmo.ai Production

**Status:** 📋 In Progress
**Priority:** 🔴 High - Required before production launch
**Created:** 2025-11-21
**Last Updated:** 2025-11-28

This checklist covers all critical tasks needed before deploying Kinmo.ai to production on the custom domain.

---

## 🔐 Environment & Security Configuration

### Environment Variables
- [x] Review and secure all environment variables for production
  - ✅ Zod schema validates all required env vars at startup (server/config.ts)
- [x] Verify DATABASE_URL points to production Neon PostgreSQL database
- [x] Generate and set strong SESSION_SECRET (min 32 chars) - use `openssl rand -base64 32`
  - ✅ Current: 88 chars (exceeds requirement)
- [ ] Update REPLIT_DOMAINS with production Kinmo.ai domain
- [ ] Configure ALLOWED_ORIGINS with production domains only (remove localhost)
- [ ] Set NODE_ENV to 'production'
- [ ] Set FRONTEND_URL to https://kinmo.ai

### API Keys & External Services
- [x] Verify OpenAI API key has sufficient credits and rate limits
- [x] Verify Google Places API keys and enable billing/quotas
- [x] Consider adding GOOGLE_PLACES_API_KEY_2 for load balancing
  - ✅ GOOGLE_PLACES_API_KEY_2 is configured
- [ ] Configure Resend API with verified sending domain (@kinmo.ai)
- [ ] Test Resend email deliverability (check spam folders)

### Security Hardening
- [x] Review and adjust rate limiting thresholds for production load
  - ✅ Current: 100 req/15min (API), 5 req/15min (auth) - appropriate for launch
- [x] Enable Content Security Policy in production (currently disabled in dev)
  - ✅ CSP enabled in production mode (server/index.ts:60-77)
- [x] Audit all API endpoints for authentication/authorization
  - ✅ Fixed /api/admin/ai-stats (was missing auth, now secured)
  - ✅ All admin endpoints use isAuthenticated + requireAdmin()
- [x] Remove or secure all debug endpoints and test scripts
  - ✅ No debug-*.ts, test-*.ts, or check-*.ts files in server/
- [x] Review CORS configuration for production
  - ✅ Dev mode allows all; production uses ALLOWED_ORIGINS allowlist

---

## 🗄️ Database Configuration

- [x] Run database migrations with `npm run db:push`
  - ✅ drizzle-kit check: "Everything's fine"
- [x] Test database connection and verify all tables exist
- [ ] Set up database backups and point-in-time recovery (Neon feature)
- [ ] Verify connection pooling settings are production-ready
- [ ] Test database failover and connection retry logic
- [ ] Review database indexes for query performance
- [ ] Check database storage limits and plan for growth

---

## 🔨 Build & Testing

### Production Build
- [x] Run production build with `npm run build` and verify success
  - ✅ Builds in ~15s, outputs to dist/
- [ ] Test production build locally with `npm run start`
- [x] Verify all assets are properly bundled
  - ⚠️ Bundle is 2.1MB (consider code splitting later)
- [x] Check that Replit-specific dev plugins are disabled in production

### Functional Testing
- [ ] Test Replit Auth integration with production domain
- [ ] Verify email notifications work in production environment
- [ ] Test AI features (event validation, time picker, venue selection)
- [ ] Test Google Places API integration and venue discovery
- [ ] Perform end-to-end testing of critical user flows:
  - [ ] User signup and authentication
  - [ ] Create group and invite members
  - [ ] Create event and vote on venues
  - [ ] Auto-scheduling and itinerary generation
  - [ ] RSVP and itinerary viewing
  - [ ] Swipe engagement system
- [ ] Test auto-scheduling and reminder scheduler functionality
- [ ] Test websocket connections for real-time updates
- [ ] Verify mobile responsiveness and touch interactions

### Performance Testing
- [ ] Load test API endpoints to verify performance under stress
- [ ] Test concurrent user sessions (authentication)
- [ ] Optimize bundle size and check for unused dependencies
  - Current size: Check with `npm run build`
- [ ] Configure CDN or caching for static assets if needed
- [ ] Test cold start performance (Replit autoscale)

---

## 🌐 Domain & Infrastructure

- [ ] Set up custom domain (Kinmo.ai) on Replit
  - Docs: https://docs.replit.com/hosting/deployments/custom-domains
- [ ] Configure DNS records (A/AAAA or CNAME)
- [ ] Verify SSL certificate is active and auto-renewing
- [ ] Test domain redirects (www → non-www or vice versa)
- [ ] Configure Replit autoscale deployment settings
  - Located in: .replit deployment section
- [x] Set up health check endpoint
  - ✅ GET /api/health exists with DB connectivity check
- [ ] Test deployment rollback procedure

---

## 📊 Monitoring & Observability

### Error Tracking
- [x] Set up error monitoring service (e.g., Sentry, LogRocket)
  - ✅ Sentry integrated (server + client)
  - ✅ React Error Boundary with fallback UI
  - ✅ Global uncaughtException/unhandledRejection handlers
  - ⚠️ Add SENTRY_DSN + VITE_SENTRY_DSN to Replit Secrets to activate
- [ ] Configure error alerting (email/Slack)
  - Configure in Sentry dashboard after adding DSN
- [ ] Set up source map upload for production debugging
- [ ] Test error reporting flow

### Logging & Metrics
- [ ] Configure logging for production (consider log aggregation service)
- [ ] Review and clean up console.log statements
  - Keep error logs, remove debug logs
- [ ] Set up application performance monitoring (APM)
- [ ] Configure database query performance monitoring

### Uptime & Availability
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- [ ] Configure uptime alerting (email/SMS)
- [ ] Set up automated health checks endpoint monitoring
- [ ] Create status page (optional)

### Analytics
- [ ] Set up analytics (e.g., Google Analytics, Plausible)
- [ ] Configure conversion tracking for key events
- [ ] Set up user behavior tracking (events, features used)

---

## 📄 Legal & Documentation

### Legal Pages
- [x] Create or update Privacy Policy page
  - ✅ /privacy - comprehensive policy covering data collection, OpenAI, Google Places
- [x] Create or update Terms of Service page
  - ✅ /terms - covers user conduct, liability, age requirements
- [x] Add legal page links to footer
  - ✅ Links in landing page footer
- [ ] Review GDPR compliance (if applicable)
- [ ] Review CCPA compliance (if applicable)

### User Documentation
- [ ] Add user documentation or onboarding guide
- [ ] Create FAQ page
- [ ] Write help documentation for key features
- [ ] Create video tutorials (optional)

---

## 🧹 Code Cleanup

- [ ] Review and clean up git history (remove sensitive data if any)
  - Use: `git log --all -- .env` to check
- [ ] Remove development debug files and console.logs from production code
  - Files to remove/gitignore: server/debug-*.ts, server/test-*.ts
- [ ] Remove unused dependencies
  - Check with: `npx depcheck`
- [ ] Remove commented-out code
- [ ] Update package.json with accurate metadata
- [ ] Remove DIAGNOSIS.md and other debug documents
- [ ] Clean up attached_assets folder (if not needed in production)

---

## 🚨 Incident Response

- [ ] Create incident response plan for production issues
  - Document: Who to contact, escalation procedures
- [ ] Set up emergency contact list
- [ ] Document rollback procedure
- [ ] Create runbook for common issues
- [ ] Set up backup communication channels (if main app is down)

---

## 🎉 Launch Preparation

- [ ] Create launch announcement and marketing materials
- [ ] Prepare social media posts
- [ ] Set up support email (support@kinmo.ai)
- [ ] Prepare launch day monitoring schedule
- [ ] Create post-launch bug triage process
- [ ] Plan for first user onboarding

---

## ✅ Final Checks

- [ ] Perform final security audit before launch
- [ ] Run full test suite one more time
- [ ] Verify all environment variables are set in Replit Secrets
- [ ] Back up current development database (if needed)
- [ ] Review all TODO items above
- [ ] Deploy to production and monitor for first 24 hours

---

## 📋 Post-Launch Monitoring (First 24 Hours)

- [ ] Monitor error rates in error tracking service
- [ ] Watch database performance and query times
- [ ] Check uptime monitor status
- [ ] Review application logs for issues
- [ ] Monitor API rate limits and costs
- [ ] Check user signup and authentication flow
- [ ] Verify email deliverability
- [ ] Monitor server resource usage (CPU, memory)
- [ ] Check for any security alerts
- [ ] Gather initial user feedback

---

## 💡 Nice-to-Have (Optional)

- [ ] Set up staging environment for testing
- [ ] Configure automated database backups
- [ ] Set up CI/CD pipeline for automated testing
- [ ] Create load testing suite
- [ ] Set up blue-green deployment strategy
- [ ] Configure feature flags system
- [ ] Set up A/B testing infrastructure

---

## 📝 Notes

**Deployment Environment:**
- Platform: Replit with autoscale
- Database: Neon PostgreSQL (configured in DATABASE_URL)
- Auth: Replit Auth (OIDC)
- Email: Resend
- AI: OpenAI GPT-4
- Maps: Google Places API

**Target Launch Date:** TBD

---

*Checklist created: 2025-11-21*
*Last updated: 2025-11-23*
