# Deployment Guide - Swipe Engagement System

**Status:** Ready for deployment
**Date:** 2025-11-13

---

## Step 1: Database Setup 🗄️

### Create New Tables

```bash
# Review the migration first (recommended)
npx drizzle-kit generate

# Apply the migration to your database
npx drizzle-kit push
```

**Tables Created:**
- `swipe_sessions` - Tracks member swipe sessions
- `confidence_predictions` - AI predictions vs actual results
- `group_confidence_weights` - Calibrated weights per group

**New Columns Added:**
- `activities.swipeConsensus` - 0-100% approval rate from swipes
- Other fields for tracking predictions and weights

**⚠️ Staging First:** Test on staging database before production

---

## Step 2: Set Up Weekly Digest Cron Job ⏰

### Option A: Linux/Mac Crontab

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9am)
0 9 * * 1 cd /path/to/your/app && npx tsx server/swipe-digest-worker.ts
```

### Option B: Replit

Create `.replit` scheduled task:
```toml
[deployment]
run = ["sh", "-c", "npm run dev"]

[[ports]]
localPort = 5000
externalPort = 80

# Add cron job
[cron]
weekly = "npx tsx server/swipe-digest-worker.ts"
schedule = "0 9 * * 1"
```

### Option C: Heroku Scheduler

1. Install add-on: `heroku addons:create scheduler:standard`
2. Open scheduler: `heroku addons:open scheduler`
3. Add job: `npx tsx server/swipe-digest-worker.ts`
4. Frequency: Daily at 9:00 AM (Monday only via app logic)

### Option D: Vercel Cron Jobs

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/weekly-digest",
    "schedule": "0 9 * * 1"
  }]
}
```

Then create API route that calls the worker.

### Manual Testing

```bash
# Test the worker manually
npx tsx server/swipe-digest-worker.ts

# Should output:
# [WeeklyDigest] Starting weekly digest processing...
# [WeeklyDigest] Found X active groups
# [WeeklyDigest] Complete: Y triggered, Z skipped
```

---

## Step 3: Testing Checklist 🧪

### Test 1: Auto-Scheduler + Post-AI Trigger

**Steps:**
1. Create a test group
2. Enable auto-scheduling in group settings
3. Wait for auto-scheduler to run (or trigger manually)
4. Check server logs for:
   ```
   [Auto-Schedule] Created auto-event with 3 options for group...
   [SwipeTrigger] 🎯 5 new AI-generated venues ready to swipe
   ```

**Expected Behavior:**
- ✅ Event created with 3 itinerary options
- ✅ Post-AI trigger fires (if no trigger in last 12 hours)
- ✅ Swipe session created for member feedback

**If it doesn't work:**
- Check: Group has `autoScheduleEnabled: true`
- Check: At least 3 venues were generated
- Check: No post-AI trigger in last 12 hours

---

### Test 2: Swipe Consensus + Auto-Promote

**Steps:**
1. Have 3+ members swipe on the same activity
2. Swipe RIGHT (love it) on same venue
3. Get consensus ≥70%

**Expected Behavior:**
- ✅ Activity consensus updates (check `activities.swipeConsensus`)
- ✅ At 70%+ consensus: Activity auto-promotes
- ✅ Favorites overflow trigger checks (fires if 15+ venues)

**Check with API:**
```bash
# Get swipe stats for an activity
curl http://localhost:5000/api/groups/{groupId}/activities/{activityId}/stats

# Should show:
{
  "consensus": 85,
  "totalSwipes": 5,
  "rightSwipes": 4,
  "shouldAutoApprove": true
}
```

---

### Test 3: Calibration System

**Steps:**
1. Complete several swipe sessions (need 50+ predictions total)
2. Run calibration test:
   ```bash
   npx tsx server/test-calibration.ts {groupId}
   ```

**Expected Output:**
```
🔍 Checking calibration status for group: abc123
Can calibrate: ✅ Yes

📊 Current weights:
  Venue Quality:    25%
  Time Consensus:   25%
  Group Engagement: 20%
  Pattern Match:    20%
  Swipe Consensus:  10%

🔄 Running calibration...

✅ Calibration complete!
📈 Results:
  Predictions analyzed: 52
  MAE: 18.5 → 14.2
  Improvement: 23.2%

🎯 New weights:
  Venue Quality:    23% (was 25%)
  Swipe Consensus:  12% (was 10%)  ← Learning!
```

**If "Can calibrate: No":**
- Need 50+ validated predictions
- Complete more swipe sessions
- Check prediction validation is working

---

### Test 4: Auto-Approval (High Confidence)

**Steps:**
1. Create event with well-rated venues
2. Choose optimal time with good availability
3. Check event status

**Expected Behavior:**
- ✅ Confidence calculated: `[Confidence] Score: 85`
- ✅ No review required: `[Review] Required: false`
- ✅ Auto-approved: Status = `auto_approved` (not `pending`)
- ✅ Sends immediately: `[AutoApproval] Event auto-sent`

**Check in database:**
```sql
SELECT status, confidence_score, requires_review
FROM auto_scheduled_events
WHERE group_id = 'your-group-id'
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `status: 'auto_approved'` or `'auto_sent'`
- `confidence_score: 80+`
- `requires_review: false`

---

## Step 4: Monitor the System 📊

### A. Check Dashboards (UI)

**Where:** Group Detail Page → Feedback Tab

**Confidence Weights Dashboard:**
- Calibration count (increases with each run)
- Mean Absolute Error (want ≤15 points)
- Accuracy rate (want ≥75%)
- Weight distribution (watch swipeConsensus increase)

**Swipe Trigger Dashboard:**
- Trigger status (Ready/On Cooldown)
- Venues needing feedback count
- Manual trigger buttons

### B. Server Logs to Watch

**Good signs:**
```
[SwipeTrigger] 🎯 5 new AI-generated venues ready to swipe
[Confidence] Score: 85, Summary: High confidence event
[AutoApproval] Confidence 85% >= threshold, auto-sending event
[Calibration] ✅ Calibration complete! MAE: 18.5 → 14.2
```

**Warning signs:**
```
[Calibration] ❌ Calibration failed
[SwipeTrigger] Skipped: Not enough venues
[Confidence] Score: 45, Summary: Low confidence (needs review)
```

### C. Key Metrics to Track

**Daily:**
- Swipe sessions created
- Participation rate (% members who swipe)
- Auto-approval rate (% events that auto-send)

**Weekly:**
- Calibration count increase
- MAE trend (should decrease)
- Accuracy rate trend (should increase)

**Monthly:**
- Total predictions validated
- Weight evolution (track how they change)
- Event confidence average

---

## Step 5: Troubleshooting Guide 🔧

### Issue: Post-AI Trigger Not Firing

**Symptoms:** Event created but no swipe session

**Check:**
1. Cooldown status (12 hours between triggers)
   ```bash
   curl http://localhost:5000/api/groups/{groupId}/swipe-triggers/status
   ```
2. Venue count (need 3+ venues)
3. Server logs for `[SwipeTrigger]` messages

**Fix:**
- Wait for cooldown to elapse
- Ensure AI generates enough venues
- Check trigger manager is imported

---

### Issue: Calibration Won't Run

**Symptoms:** "Can calibrate: No" in test script

**Check:**
1. Prediction count:
   ```sql
   SELECT COUNT(*) FROM confidence_predictions
   WHERE group_id = 'your-group-id'
   AND validated_at IS NOT NULL
   AND used_for_calibration = false;
   ```
   Should be ≥50

2. Swipe sessions completed
3. Predictions validated on session completion

**Fix:**
- Complete more swipe sessions
- Check session completion triggers validation
- Manually run: `npx tsx server/test-calibration.ts {groupId}`

---

### Issue: Auto-Approval Not Working

**Symptoms:** High confidence events still show "pending"

**Check:**
1. Confidence score in logs: `[Confidence] Score: XX`
2. Review decision: `[Review] Required: true/false`
3. Automation settings:
   ```sql
   SELECT automation_level, confidence_threshold
   FROM groups WHERE id = 'your-group-id';
   ```

**Fix:**
- Ensure confidence ≥80%
- Check `automationLevel` = 'smart' or 'full'
- Verify `confidenceThreshold` ≤ 80
- Check `automationPaused` = false

---

### Issue: Weekly Digest Not Triggering

**Symptoms:** No digest on Monday mornings

**Check:**
1. Cron job running: `crontab -l`
2. Worker executes: `npx tsx server/swipe-digest-worker.ts`
3. Groups have autoSchedule enabled
4. Venues need feedback (< 3 swipes each)

**Fix:**
- Verify cron setup
- Check worker logs
- Manually test worker
- Ensure groups are active

---

## Quick Reference Commands

### Testing & Debugging

```bash
# Test calibration for specific group
npx tsx server/test-calibration.ts {groupId}

# Test calibration for all groups
npx tsx server/test-calibration.ts --all

# Run weekly digest manually
npx tsx server/swipe-digest-worker.ts

# Check TypeScript compilation
npx tsc --noEmit

# Run system tests
npx tsx test-swipe-system.ts
npx tsx test-integration.ts
```

### API Testing

```bash
# Check trigger status
curl http://localhost:5000/api/groups/{groupId}/swipe-triggers/status

# Manual trigger
curl -X POST http://localhost:5000/api/groups/{groupId}/swipe-triggers/manual \
  -H "Content-Type: application/json" \
  -d '{"activityIds": ["id1"], "reason": "Test"}'

# Weekly digest
curl -X POST http://localhost:5000/api/groups/{groupId}/swipe-triggers/weekly-digest

# Get confidence weights
curl http://localhost:5000/api/groups/{groupId}/confidence-weights

# Manual calibration
curl -X POST http://localhost:5000/api/groups/{groupId}/calibrate
```

### Database Queries

```sql
-- Check swipe sessions
SELECT * FROM swipe_sessions
WHERE group_id = 'your-group-id'
ORDER BY created_at DESC;

-- Check predictions
SELECT * FROM confidence_predictions
WHERE group_id = 'your-group-id'
ORDER BY predicted_at DESC;

-- Check calibrated weights
SELECT * FROM group_confidence_weights
WHERE group_id = 'your-group-id';

-- Check activity consensus
SELECT venue_name, swipe_consensus
FROM activities
WHERE group_id = 'your-group-id'
AND swipe_consensus IS NOT NULL
ORDER BY swipe_consensus DESC;
```

---

## Production Checklist ✅

Before deploying to production:

- [ ] Database migrations tested on staging
- [ ] Cron job configured and tested
- [ ] Server logs configured (file or service)
- [ ] Error monitoring set up (Sentry, etc.)
- [ ] Dashboards accessible to organizers
- [ ] Test group created and validated
- [ ] Calibration tested with 50+ predictions
- [ ] Auto-approval tested (≥80% confidence)
- [ ] Documentation reviewed by team
- [ ] Rollback plan prepared

---

## Success Metrics 📈

**Week 1:**
- ✅ System deployed without errors
- ✅ First swipe sessions created
- ✅ Post-AI triggers firing after events
- ✅ Members participating in swipes

**Week 2:**
- ✅ 50+ predictions collected
- ✅ First calibration runs successfully
- ✅ MAE baseline established
- ✅ Auto-promote/reject working

**Month 1:**
- ✅ MAE improved by 10%+
- ✅ Accuracy rate ≥70%
- ✅ Auto-approval rate ≥30%
- ✅ Weekly digests running

**Month 3:**
- ✅ MAE ≤15 points
- ✅ Accuracy rate ≥80%
- ✅ Auto-approval rate ≥50%
- ✅ Member engagement stable

---

## Support & Documentation

**Key Files:**
- `SWIPE_ENGAGEMENT_SYSTEM.md` - System overview
- `TEST_RESULTS.md` - Test results
- `DEPLOYMENT_GUIDE.md` - This file

**Test Scripts:**
- `test-swipe-system.ts` - Module & logic tests
- `test-integration.ts` - Integration tests
- `server/test-calibration.ts` - Calibration testing

**Background Workers:**
- `server/swipe-digest-worker.ts` - Weekly digest cron job

**Need Help?**
Check the test results and system documentation for detailed information about how each component works.

---

*Last Updated: 2025-11-13*
*Version: 1.0*
*Status: Production Ready*
