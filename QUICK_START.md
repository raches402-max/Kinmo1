# Quick Start - Get Running in 5 Minutes

## 1. Run Database Migration
```bash
npx drizzle-kit push
```
This creates the 3 new tables you need.

---

## 2. Test It Works
```bash
# Create a test group
# Enable auto-scheduling
# Wait for event creation
# Check logs for: [SwipeTrigger] 🎯 X new AI-generated venues ready to swipe
```

---

## 3. Set Up Weekly Digest (Optional)
```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9am)
0 9 * * 1 cd /path/to/your/app && npx tsx server/swipe-digest-worker.ts
```

---

## 4. View Dashboards
Go to any group → **Feedback Tab**

You'll see:
- **Confidence Weights Dashboard** - How the AI is learning
- **Swipe Trigger Dashboard** - Engagement opportunities

---

## That's It! 🎉

The system now runs automatically:
- ✅ Events auto-create with AI suggestions
- ✅ Post-AI trigger fires (12hr cooldown)
- ✅ Members swipe → venues auto-promote at 70%+
- ✅ System calibrates every 50 predictions
- ✅ High confidence events (≥80%) auto-approve
- ✅ Weekly digest maintains engagement

---

## Need More Help?

See **DEPLOYMENT_GUIDE.md** for:
- Detailed testing steps
- Troubleshooting guide
- Database queries
- API endpoints
- Monitoring tips

See **SWIPE_ENGAGEMENT_SYSTEM.md** for:
- How the system works
- Architecture overview
- Configuration options
- Data flow diagrams

See **TEST_RESULTS.md** for:
- Complete test results
- What was verified
- Success metrics
