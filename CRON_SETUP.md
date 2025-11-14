# Weekly Digest Cron Job Setup

The Swipe Engagement System includes a weekly digest worker that should run once a week to maintain engagement. This document explains how to set it up.

## What It Does

The weekly digest checks all active groups and triggers swipe sessions when:
- There are 5+ AI-generated venues that need member feedback (< 3 swipes each)
- No trigger has occurred in the last 7 days
- The group has auto-scheduling enabled

## Setup Options

### Option 1: API Endpoint (Recommended for Replit)

The system includes an API endpoint that can be triggered by external cron services.

**Endpoint:** `POST /api/cron/weekly-digest`

**Authentication:** Pass `CRON_SECRET` as query parameter or header

**Example:**
```bash
curl -X POST "https://your-app.replit.app/api/cron/weekly-digest?secret=YOUR_SECRET_HERE"
```

**External Cron Services:**
- [cron-job.org](https://cron-job.org) - Free, reliable
- [EasyCron](https://www.easycron.com) - Free tier available
- [Cronitor](https://cronitor.io) - Monitoring included

**Setup Steps:**
1. Set `CRON_SECRET` environment variable in Replit Secrets
2. Create a new cron job on external service
3. Schedule: Every Monday at 9:00 AM
4. URL: `https://your-app.replit.app/api/cron/weekly-digest?secret=YOUR_SECRET`
5. Method: POST

---

### Option 2: Manual Script Execution

You can run the worker script directly:

```bash
npx tsx server/swipe-digest-worker.ts
```

This is useful for:
- Testing the system
- One-off manual triggers
- Running via custom schedulers

---

### Option 3: Linux/Mac Crontab

If deploying on a VPS or server with crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9am)
0 9 * * 1 cd /path/to/your/app && npx tsx server/swipe-digest-worker.ts
```

---

### Option 4: Heroku Scheduler

If deploying on Heroku:

```bash
# Install add-on
heroku addons:create scheduler:standard

# Open scheduler dashboard
heroku addons:open scheduler

# Add job:
# Command: npx tsx server/swipe-digest-worker.ts
# Frequency: Daily at 9:00 AM
# Note: You'll need to add day-of-week logic in the script for Monday-only
```

---

## Testing

Test that the cron job works:

```bash
# Test the API endpoint
curl -X POST "http://localhost:5000/api/cron/weekly-digest?secret=dev-secret-change-in-production"

# Or run the script directly
npx tsx server/swipe-digest-worker.ts
```

**Expected output:**
```
[WeeklyDigest] Starting weekly digest processing...
[WeeklyDigest] Found X active groups
[WeeklyDigest] ✅ GroupName: Triggered swipe session (Y venues need feedback)
[WeeklyDigest] ⏭️  GroupName: Only Z venues need feedback (need 5+)
[WeeklyDigest] Complete: A triggered, B skipped
```

---

## Security

**Important:** Change the default `CRON_SECRET` in production!

1. Generate a secure random secret:
   ```bash
   openssl rand -hex 32
   ```

2. Set it in your environment:
   - Replit: Add to Secrets tab
   - Heroku: `heroku config:set CRON_SECRET=your-secret-here`
   - VPS: Add to `.env` file

3. Use the secret in your cron requests

---

## Monitoring

Check that the weekly digest is working:

1. **Check logs:** Look for `[WeeklyDigest]` messages
2. **Monitor API:** Track `/api/cron/weekly-digest` endpoint calls
3. **Database:** Query `swipe_sessions` table for new sessions:
   ```sql
   SELECT * FROM swipe_sessions
   WHERE session_type = 'weekly_digest'
   ORDER BY created_at DESC;
   ```

---

## Troubleshooting

**No sessions triggered:**
- Check if groups have `autoScheduleEnabled = true`
- Verify there are 5+ venues with < 3 swipes each
- Check if a trigger already occurred in last 7 days

**Unauthorized errors:**
- Verify `CRON_SECRET` matches in environment and request
- Check headers or query parameter spelling

**Timeout errors:**
- Increase timeout on cron service (recommended: 60 seconds)
- Check database connection

---

## Recommended Schedule

**Best practice:** Monday mornings at 9:00 AM (in your timezone)

Why Monday?
- Start of work week - higher engagement
- Gives members all week to swipe
- Aligns with weekly event planning cadence

Cron expression: `0 9 * * 1` (9am every Monday)

---

*Last updated: 2025-11-14*
