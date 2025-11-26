# Production Deployment Guide

**Created:** 2025-11-24
**Status:** Ready for Production Deployment
**Estimated Time:** 2.5-4 hours

---

## Overview

This guide walks you through deploying Kinmo to production. Each step includes:
- What it is
- Why it matters
- What happens if you skip it
- How to do it

---

## Quick Reference: Priority Levels

### 🔴 MUST DO (Critical - App won't work or is illegal)
1. SESSION_SECRET - Security critical
2. Environment Variables - App won't function
3. Privacy Policy - Legally required
4. Testing - Prevents launch disasters

### 🟡 SHOULD DO (Important - App looks unprofessional)
5. Custom Domain - Branding and trust
6. Terms of Service - Legal protection

### 🟢 NICE TO HAVE (Quality of life - Fix issues faster)
7. Error Monitoring - Developer experience
8. Uptime Monitoring - Peace of mind

---

## Step 1: Content Security Policy (CSP) ✅ COMPLETE

**Status:** Already configured in `server/index.ts:58-78`

### What it is:
A security header that tells browsers which sources are allowed to load resources (scripts, styles, images, etc.) on your site.

### Why it matters:
- **Prevents XSS attacks**: If a hacker injects malicious JavaScript into your site, CSP blocks it from running
- **Blocks unauthorized tracking**: Prevents third parties from loading scripts you didn't approve
- **Industry standard**: Expected security practice for production apps

### What happens if you skip it:
- Browsers might block legitimate resources (Google Fonts, Google Maps)
- Your site is more vulnerable to cross-site scripting attacks
- Security audits will flag your site as "unsafe"

### Real example:
Without CSP, if someone manages to inject `<script src="evil.com/steal-data.js">` into your database, it would execute. With CSP, the browser blocks it.

### Current Configuration:
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'", "https://api.openai.com", "https://maps.googleapis.com", "https://places.googleapis.com"],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  }
}
```

---

## Step 2: Generate Production SESSION_SECRET 🔴 CRITICAL

**Time:** 1 minute
**Priority:** MUST DO

### What it is:
A random cryptographic key used to sign session cookies and encrypt user sessions.

### Why it matters:
- **Session security**: Prevents attackers from forging fake login sessions
- **GDPR compliance**: Protects user data in cookies
- **Authentication integrity**: Ensures users can't tamper with their session data

### What happens if you skip it:
- Using default/weak secrets → Attackers can create fake admin sessions
- Reusing dev secrets → Anyone with access to your code can hijack sessions
- All users would be logged out when you eventually change it

### Real example:
If your SESSION_SECRET is "password123", an attacker can:
1. Create a session saying "I'm user admin@kinmo.ai"
2. Sign it with "password123"
3. Access your entire admin account

### How to do it:

```bash
# Run this command in your terminal:
openssl rand -base64 32
```

**Copy the output** - you'll need it for Step 3.

### Why 32 bytes from openssl:
- Cryptographically random (not guessable)
- 256 bits of entropy (practically unbreakable)
- Industry standard for session secrets

---

## Step 3: Configure Environment Variables 🔴 CRITICAL

**Time:** 10 minutes
**Priority:** MUST DO

### What it is:
Configuration values that change between development and production environments.

### How to do it:

Go to **Replit → Tools → Secrets** and configure:

#### Required Variables:

```
NODE_ENV=production
SESSION_SECRET=[paste the value from Step 2]
DATABASE_URL=[your Neon PostgreSQL URL]
FRONTEND_URL=https://kinmo.ai
ALLOWED_ORIGINS=https://kinmo.ai
```

#### Verify These Exist:

```
OPENAI_API_KEY=[your key]
GOOGLE_PLACES_API_KEY=[your key]
RESEND_API_KEY=[your key]
```

#### Remove These (if present):

```
ALLOWED_ORIGINS=http://localhost:*
```

### Detailed Explanation of Each Variable:

#### NODE_ENV=production

**Why it matters:**
- Enables production optimizations (minification, caching)
- Disables debug features that leak information
- React/Vite run 2-3x faster in production mode
- Error messages are sanitized (don't leak code details)

**What happens if you skip it:**
- Your app runs in "dev mode" in production
- Slower performance
- Verbose error messages expose your code structure to attackers
- Larger bundle sizes (includes source maps)

#### FRONTEND_URL=https://kinmo.ai

**Why it matters:**
- Email links need to know your domain
- OAuth callbacks need the correct URL
- CORS needs to know which origin to allow

**What happens if you skip it:**
- Email links go to "localhost" (broken for users)
- Login redirects fail
- API calls from frontend get blocked by CORS

#### ALLOWED_ORIGINS=https://kinmo.ai

**Why it matters:**
- **CORS security**: Only your frontend can call your API
- Prevents other websites from stealing user data
- Blocks unauthorized API access

**What happens if you skip it:**
- If you leave `http://localhost:*`, anyone can call your API from a malicious site
- Attacker creates evil.com that makes API calls to kinmo.ai and steals user data
- No protection against CSRF attacks

**Real example without proper ALLOWED_ORIGINS:**
1. User logs into kinmo.ai
2. User visits evil.com (while still logged in)
3. evil.com makes API calls to kinmo.ai/api/user/delete-account
4. Your API accepts it because CORS allows all origins

#### DATABASE_URL

**Why it matters:**
- Can't connect to production database without it
- All data operations will fail

#### API Keys (OPENAI_API_KEY, GOOGLE_PLACES_API_KEY, RESEND_API_KEY)

**Why they matter:**
- Can't send emails without RESEND_API_KEY
- Can't use AI features without OPENAI_API_KEY
- Can't search venues without GOOGLE_PLACES_API_KEY

---

## Step 4: Custom Domain Setup 🟡 IMPORTANT

**Time:** 30 minutes
**Priority:** SHOULD DO

### What it is:
Pointing your domain name to Replit's servers so users can access your app at kinmo.ai instead of random-name.replit.app.

### Why it matters:
- **Professionalism**: kinmo.ai vs xyz-123.replit.app
- **Branding**: Users remember your domain
- **Trust**: Custom domains look legitimate; Replit subdomains look like demos
- **SEO**: Search engines rank custom domains higher
- **SSL certificate**: Gets you https://kinmo.ai (secure connection)

### What happens if you skip it:
- Your app works, but at an ugly Replit URL
- Users might think it's a demo/test site
- Harder to market and share
- Can't use it professionally

### How to do it:

#### On Replit:
1. Go to your Repl → **Deployments** tab
2. Click **Deploy**
3. Under **Domains**, click **Add custom domain**
4. Enter: `kinmo.ai`
5. Replit will provide DNS configuration instructions

#### On Your Domain Registrar (GoDaddy/Namecheap/Cloudflare):
1. Log into your domain registrar
2. Go to DNS settings
3. Add the records provided by Replit (usually CNAME or A records)
4. Wait 5-60 minutes for DNS propagation

### Cost:
- **Domain registration:** ~$10-15/year (GoDaddy, Namecheap, Cloudflare)
- **Replit hosting:** Free tier or $20/month for always-on

---

## Step 5: Privacy Policy 🔴 CRITICAL (LEGAL)

**Time:** 30 minutes (with template) or 1-2 hours (custom)
**Priority:** MUST DO

### What it is:
A legal document that explains how you handle user data.

### Why it matters:
- **Legally required** in most jurisdictions (GDPR, CCPA, etc.)
- Required by Google (for Google Maps API)
- Required by Apple/Google if you ever make a mobile app
- **Fines for missing one**: Up to €20M or 4% of revenue under GDPR

### What happens if you skip it:
- **You can be fined** thousands to millions (depending on jurisdiction)
- Google may suspend your API access
- Users can sue you more easily
- Can't operate in EU/California legally
- Investors won't touch you

### What it must explain:
- What data you collect (emails, names, preferences, availability)
- How you use it (scheduling, AI recommendations, notifications)
- Third parties with access (OpenAI, Google Maps, Resend)
- User rights (access, delete, export data)
- Cookie usage
- Data retention policies

### How to do it:

#### Quick Option (30 minutes):
1. Use a template generator:
   - **TermsFeed**: https://www.termsfeed.com/privacy-policy-generator/
   - **GetTerms**: https://getterms.io/
   - **Freeprivacypolicy**: https://www.freeprivacypolicy.com/

2. Customize with your specifics:
   - Business name: Kinmo
   - Website: kinmo.ai
   - Services: Event planning, venue recommendations
   - Third parties: OpenAI (GPT-4), Google Maps API, Resend (emails)
   - Data collected: Name, email, preferences, availability, group memberships

3. Create the file:
   - Create: `client/src/pages/privacy.tsx`
   - Copy/paste the generated policy
   - Style it with your design system

4. Add route to `client/src/main.tsx`:
   ```typescript
   { path: '/privacy', element: <PrivacyPage /> }
   ```

5. Add footer link to all pages

#### Custom Option (1-2 hours):
- Write your own based on your exact data practices
- Consider lawyer review ($500-1000) if you have funding

### Key Sections to Include:

```
1. Information We Collect
   - Email addresses
   - Names
   - Availability preferences
   - Activity preferences
   - Group memberships
   - Event RSVPs

2. How We Use Information
   - Schedule events
   - Send notifications
   - AI-powered recommendations
   - Venue discovery

3. Third-Party Services
   - OpenAI (GPT-4) - Event planning and venue selection
   - Google Maps API - Location services
   - Resend - Email notifications
   - Replit Auth - Authentication

4. Data Security
   - Encrypted connections (HTTPS)
   - Secure session management
   - Regular security audits

5. User Rights (GDPR/CCPA)
   - Right to access data
   - Right to delete data
   - Right to export data
   - Right to opt-out of emails

6. Contact Information
   - Your email for privacy inquiries
```

---

## Step 6: Terms of Service 🟡 IMPORTANT (LEGAL)

**Time:** 30 minutes (with template) or 1-2 hours (custom)
**Priority:** SHOULD DO

### What it is:
Legal document that sets rules for using your service and protects you from liability.

### Why it matters:
- **Protects you legally** from lawsuits
- Sets expectations for user behavior
- Defines liability limits (what you're NOT responsible for)
- Required if you ever charge money
- Protects your intellectual property

### What happens if you skip it:
- Users can sue you more easily for damages
- No protection if events go wrong
- Can't ban abusive users legally
- Harder to enforce rules
- Investors will require it before funding

### Real example:
If a user's event has a wrong venue and they sue you for damages:
- **With ToS**: "User agrees we provide recommendations 'as-is' without guarantee"
- **Without ToS**: You might be liable for their entire trip cost

### How to do it:

#### Quick Option (30 minutes):
1. Use a template generator:
   - **TermsFeed**: https://www.termsfeed.com/terms-conditions-generator/
   - **GetTerms**: https://getterms.io/
   - **Avodocs**: https://www.avodocs.com/

2. Customize with your specifics:
   - Service type: Event planning platform
   - Key features: AI recommendations, venue discovery, scheduling
   - Disclaimers: Venue accuracy, event outcomes, third-party data

3. Create the file:
   - Create: `client/src/pages/terms.tsx`
   - Copy/paste the generated terms
   - Style it with your design system

4. Add route to `client/src/main.tsx`:
   ```typescript
   { path: '/terms', element: <TermsPage /> }
   ```

5. Add footer link to all pages

### Key Sections to Include:

```
1. Acceptance of Terms
   - By using Kinmo, you agree to these terms

2. Service Description
   - What Kinmo does
   - What Kinmo is NOT (not a booking service, not liable for venues)

3. User Obligations
   - Must be 13+ years old
   - Accurate information
   - Respectful behavior
   - No spam or abuse

4. Liability Limitations
   - "As-is" service
   - No guarantee of venue accuracy
   - Not responsible for event outcomes
   - Not liable for third-party failures (OpenAI, Google Maps)

5. Intellectual Property
   - You retain rights to your data
   - Kinmo retains rights to platform code
   - License to use AI-generated content

6. Dispute Resolution
   - Governing law (your state/country)
   - Arbitration clause (optional)

7. Termination
   - We can suspend abusive accounts
   - You can delete your account anytime

8. Changes to Terms
   - We can update terms with notice
```

---

## Step 7: Error Monitoring 🟢 RECOMMENDED

**Time:** 30 minutes
**Priority:** NICE TO HAVE

### What it is:
Services that watch your app and alert you when errors occur.

### Why it matters:
- **See errors before users report them**
- Get stack traces, user context, and reproduction steps
- Track error frequency and impact
- Fix bugs faster (minutes vs days)

### What happens if you skip it:
- You only know about bugs when users complain
- No way to debug production issues (no stack traces)
- Users silently leave instead of reporting bugs
- You lose customers to preventable issues

### Real example:
User reports: "Event creation doesn't work"
- **Without monitoring**: You have no idea why, can't reproduce it
- **With Sentry**: See "OpenAI API timeout after 30s, user was on slow mobile connection, here's the exact request"

### Options:

#### Sentry (Recommended - Free Tier)

**Cost:** Free for 5,000 errors/month (plenty for MVP)

**Setup:**
1. Sign up at https://sentry.io
2. Create new project (React + Node.js)
3. Install SDK:
   ```bash
   npm install @sentry/react @sentry/node
   ```

4. Add to `client/src/main.tsx`:
   ```typescript
   import * as Sentry from "@sentry/react";

   Sentry.init({
     dsn: "YOUR_SENTRY_DSN",
     environment: import.meta.env.MODE,
     integrations: [
       new Sentry.BrowserTracing(),
       new Sentry.Replay(),
     ],
     tracesSampleRate: 1.0,
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,
   });
   ```

5. Add to `server/index.ts` (top of file):
   ```typescript
   import * as Sentry from "@sentry/node";

   Sentry.init({
     dsn: "YOUR_SENTRY_DSN",
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });
   ```

#### LogRocket (More expensive)

**Cost:** 14-day free trial, then $100/month
**Skip for MVP** - Use Sentry instead

---

## Step 8: Uptime Monitoring 🟢 RECOMMENDED

**Time:** 15 minutes
**Priority:** NICE TO HAVE

### What it is:
Services that ping your site every few minutes and alert you if it goes down.

### Why it matters:
- Alerts you if your site goes down
- Tracks uptime percentage (99.9% = "three nines")
- Catches issues before users complain
- Free options available

### What happens if you skip it:
- Your site could be down for hours and you wouldn't know
- Users think you're unprofessional
- Miss the Replit "sleeping" issue (if on free plan)

### Options:

#### UptimeRobot (Recommended - Free)

**Cost:** Free for 50 monitors

**Setup:**
1. Sign up at https://uptimerobot.com
2. Add New Monitor:
   - Type: HTTP(s)
   - URL: `https://kinmo.ai/api/health`
   - Interval: 5 minutes
   - Alert Contacts: Your email

#### Pingdom (Alternative)

**Cost:** Free tier available
**URL:** https://www.pingdom.com

---

## Step 9: Final Testing 🔴 CRITICAL

**Time:** 30 minutes
**Priority:** MUST DO

### What it is:
Actually using your app like a real user to make sure everything works.

### Why it matters:
- **Catches integration issues** (things that work in dev but break in prod)
- Verifies all your configuration steps actually worked
- Tests the full user flow end-to-end
- Prevents embarrassing launch day failures

### What happens if you skip it:
- Launch day: nothing works, users leave immediately
- CSP might be blocking resources (white screen)
- Email notifications broken (wrong URLs)
- Authentication fails (OAuth misconfigured)
- You scramble to fix issues while users are waiting

### Testing Checklist:

#### 1. Production Build Test (Local)

```bash
# Build for production
npx vite build --mode production

# Check for errors
# Look for: "Build completed" message
# No TypeScript errors
```

#### 2. Health Endpoint Test

```bash
# After deploying to Replit
curl https://kinmo.ai/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-24T...",
  "uptime": 123.45,
  "environment": "production"
}
```

#### 3. CSP Validation

1. Open https://kinmo.ai in Chrome
2. Open DevTools → Console
3. Look for CSP errors (should be NONE)
4. Check that:
   - Fonts load correctly
   - Images display
   - No "blocked by CSP" errors

#### 4. Authentication Flow

1. Visit https://kinmo.ai
2. Click "Log in with Replit"
3. Authorize the app
4. Verify you're logged in
5. Check that profile displays correctly

#### 5. Full User Journey

**Test as a new user:**

1. **Create Account**
   - Log in with Replit Auth
   - Set up profile

2. **Create Group**
   - Dashboard → Create Group
   - Name: "Test Group"
   - Invite: [your alternate email]
   - Verify invite email arrives

3. **Set Preferences**
   - Set availability
   - Select activities
   - Set budget

4. **Create Manual Event**
   - Select date/time
   - Choose venue
   - Verify event created

5. **Create Auto Event**
   - Dashboard → Schedule from Favorites
   - Select activities
   - Verify AI generates event

6. **RSVP Flow**
   - Check RSVP email
   - Click link in email (verify it goes to https://kinmo.ai, NOT localhost)
   - Submit RSVP
   - View itinerary

7. **Mobile Testing**
   - Open on phone
   - Test navigation (hamburger menu)
   - Test AvailabilityGrid (day tabs)
   - All pages scroll correctly

#### 6. Error Cases

Test error handling:
- Invalid login
- Network timeout
- Missing data

#### 7. Performance Check

1. Open DevTools → Network tab
2. Reload page
3. Check:
   - Page loads in < 3 seconds
   - Images are optimized
   - No 404 errors

---

## Post-Launch Monitoring (First 24-48 Hours)

### What to Watch:

1. **Error Rate**
   - Check Sentry dashboard every 2-4 hours
   - Fix critical errors immediately

2. **Uptime**
   - UptimeRobot should show 100%
   - If alerts fire, investigate immediately

3. **User Feedback**
   - Watch for support emails
   - Monitor any feedback channels

4. **Performance**
   - Page load times
   - API response times
   - Database query performance

### Emergency Rollback Plan:

If something is critically broken:

```bash
# Revert to previous deployment on Replit
# Or set NODE_ENV=development temporarily

# Fix the issue
# Re-deploy when ready
```

---

## Time Estimates Summary

| Step | Time | Priority | Can Skip? |
|------|------|----------|-----------|
| 1. CSP | ✅ Done | Critical | No |
| 2. SESSION_SECRET | 1 min | Critical | No |
| 3. Environment Variables | 10 min | Critical | No |
| 4. Custom Domain | 30 min | Important | Temporarily |
| 5. Privacy Policy | 30-120 min | Critical | No |
| 6. Terms of Service | 30-120 min | Important | Temporarily |
| 7. Error Monitoring | 30 min | Nice to have | Yes |
| 8. Uptime Monitoring | 15 min | Nice to have | Yes |
| 9. Testing | 30 min | Critical | No |

**Minimum time (critical only): 2.5 hours**
**Recommended time (all steps): 3-4 hours**

---

## Launch Checklist

Use this checklist to track your progress:

### Pre-Launch (Required)
- [x] CSP enabled (done)
- [ ] SESSION_SECRET generated and set
- [ ] NODE_ENV=production set
- [ ] FRONTEND_URL=https://kinmo.ai set
- [ ] ALLOWED_ORIGINS=https://kinmo.ai set
- [ ] DATABASE_URL set
- [ ] All API keys verified
- [ ] Privacy Policy created and linked
- [ ] Production build tested
- [ ] Health endpoint working
- [ ] CSP validation passed
- [ ] Authentication flow tested
- [ ] Full user journey tested
- [ ] Mobile testing completed

### Pre-Launch (Recommended)
- [ ] Custom domain configured
- [ ] Terms of Service created and linked
- [ ] Error monitoring set up (Sentry)
- [ ] Uptime monitoring set up (UptimeRobot)

### Post-Launch (First Week)
- [ ] Monitor error rates (first 24h)
- [ ] Monitor uptime (first 48h)
- [ ] Gather user feedback
- [ ] Fix any critical bugs
- [ ] Review analytics

---

## Support Resources

### Documentation:
- This guide: `/PRODUCTION_DEPLOYMENT_GUIDE.md`
- Security audit: `/SECURITY_AUDIT.md`
- Today's changes: `/TODAY_SUMMARY.md`
- Logging guide: `/LOGGING_GUIDE.md`

### External Resources:
- **Replit Deployments**: https://docs.replit.com/hosting/deployments
- **GDPR Compliance**: https://gdpr.eu/checklist/
- **Sentry Docs**: https://docs.sentry.io/
- **CSP Guide**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

### If You Get Stuck:

1. **Check logs**: Replit → Console/Logs
2. **Check health endpoint**: `curl https://kinmo.ai/api/health`
3. **Check browser console**: DevTools → Console
4. **Check Sentry**: https://sentry.io (if set up)
5. **Revert if needed**: Replit deployments can be rolled back

---

## Cost Summary (First Year)

| Item | Cost | Notes |
|------|------|-------|
| Domain (kinmo.ai) | $10-15/year | GoDaddy, Namecheap, Cloudflare |
| Replit Hosting | Free or $20/mo | Free tier sleeps, $20/mo always-on |
| Sentry (Error monitoring) | Free | Up to 5K errors/month |
| UptimeRobot | Free | Up to 50 monitors |
| Resend (Email) | Free | 100 emails/day free tier |
| OpenAI API | Pay-as-you-go | ~$0.03 per request, estimate $50-100/mo |
| Google Places API | Free | $200/month free credit |
| Neon (Database) | Free | 0.5GB storage free tier |

**Minimum first year: ~$10-15** (just domain)
**Recommended with always-on hosting: ~$250/year** (domain + Replit)
**With API usage: ~$300-400/year** (includes moderate OpenAI usage)

---

## Next Steps After Launch

### Week 1:
- Monitor daily for issues
- Gather user feedback
- Fix critical bugs
- Celebrate! 🎉

### Month 1:
- Review analytics
- Plan feature improvements
- Consider paid monitoring if growing
- Remove unused dependencies (see DEPENDENCY_AUDIT.md)

### Month 2-3:
- Migrate to structured logging (pino/winston)
- Set up automated backups
- Consider CDN for static assets
- Implement any feature requests

---

## Questions or Issues?

If you run into problems:
1. Check this guide first
2. Check SECURITY_AUDIT.md for security questions
3. Check TODAY_SUMMARY.md for what changed today
4. Check server logs on Replit
5. Ask Claude for help!

---

**You're ready to launch!** 🚀

*This guide was created: 2025-11-24*
*Last updated: 2025-11-24*
*Codebase status: Production-ready*
