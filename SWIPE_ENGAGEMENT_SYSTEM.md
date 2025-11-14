# Swipe Engagement & Calibration System

Complete implementation of the smart swipe trigger system for member engagement and AI calibration.

## Overview

The system automatically triggers swipe sessions at strategic moments to:
1. **Increase member engagement** - Gather feedback when it matters most
2. **Accelerate AI learning** - More swipe data → faster calibration → better predictions
3. **Prevent notification fatigue** - Smart cooldowns and thresholds

## Architecture

### Core Components

#### 1. Swipe Trigger Manager (`server/swipe-trigger-manager.ts`)
Intelligent trigger system that decides when to create swipe sessions.

**Trigger Types:**
- **Post-AI Generation** - Fires after auto-scheduler creates events with AI-generated venues
  - Cooldown: 12 hours
  - Threshold: 3+ venues required
  - Purpose: Validate AI venue selections immediately

- **Favorites Overflow** - Fires when group has many venues with consensus data
  - Cooldown: 24 hours
  - Threshold: 15+ venues with swipe data
  - Purpose: Help narrow down popular venues

- **Weekly Digest** - Regular check-in for feedback on new venues
  - Cooldown: 7 days
  - Threshold: 5+ venues needing feedback
  - Purpose: Maintain engagement between events

- **Manual Trigger** - Organizer-initiated sessions (no cooldown)

**Frequency Caps:**
```typescript
const TRIGGER_COOLDOWNS = {
  post_ai: 12 * 60 * 60 * 1000,         // 12 hours
  favorites_overflow: 24 * 60 * 60 * 1000, // 24 hours
  weekly_digest: 7 * 24 * 60 * 60 * 1000,  // 7 days
  manual: 0,                              // No cooldown
};
```

#### 2. Background Worker (`server/swipe-digest-worker.ts`)
Weekly cron job for automated digest triggers.

**Usage:**
```bash
# Run weekly via cron
npx tsx server/swipe-digest-worker.ts

# Or call from cron:
0 9 * * 1 cd /app && npx tsx server/swipe-digest-worker.ts
```

#### 3. UI Components

**SwipeTriggerDashboard** (`client/src/components/SwipeTriggerDashboard.tsx`)
- Shows organizers current trigger status
- Displays cooldowns and opportunities
- Manual trigger button for weekly digest
- Real-time updates

**Integration:** Added to Group Detail page Feedback tab

### Integration Points

#### 1. Auto-Scheduler Integration (`server/reminder-scheduler.ts`)
Post-AI trigger fires automatically after event creation.

**New Flow (3 Options):**
```typescript
// After creating auto-event with 3 itinerary options
const triggerResult = await triggerSwipeSession({
  groupId: group.id,
  triggerType: 'post_ai',
  activityIds: allActivityIds,
  expiresInHours: 48,
});
```

**Old Flow (Single Itinerary):**
```typescript
// After creating auto-event with single itinerary
const triggerResult = await triggerSwipeSession({
  groupId: group.id,
  triggerType: 'post_ai',
  activityIds,
  expiresInHours: 48,
});
```

#### 2. Swipe Recording Integration (`server/routes.ts`)
Favorites overflow trigger fires after auto-promotion.

```typescript
// After auto-promoting activity (70%+ consensus)
if (autoAction?.action === 'promoted') {
  const triggerResult = await triggerSwipeSession({
    groupId,
    triggerType: 'favorites_overflow',
  });
}
```

### API Endpoints

#### GET `/api/groups/:groupId/swipe-triggers/status`
Check trigger opportunities for a group.

**Response:**
```json
{
  "postAI": {
    "available": true,
    "reason": "Ready to trigger after AI generation"
  },
  "favoritesOverflow": {
    "available": false,
    "reason": "10/15 venues with feedback"
  },
  "weeklyDigest": {
    "available": true,
    "reason": "Ready for weekly digest"
  }
}
```

#### POST `/api/groups/:groupId/swipe-triggers/manual`
Manually trigger swipe session (organizer only).

**Request:**
```json
{
  "activityIds": ["id1", "id2", "id3"],
  "reason": "Custom message for members",
  "expiresInHours": 72
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-id",
  "message": "Manual swipe session created"
}
```

#### POST `/api/groups/:groupId/swipe-triggers/weekly-digest`
Trigger weekly digest (organizer only or cron).

**Response:**
```json
{
  "success": true,
  "sessionId": "session-id",
  "message": "📅 Weekly digest: 8 venues to rate"
}
```

## Data Flow

### 1. Post-AI Generation Flow
```
Auto-Scheduler creates event
  ↓
AI generates 3-5 venues
  ↓
Post-AI trigger checks cooldown (12hr)
  ↓
Creates swipe session (activity_curation type)
  ↓
Members swipe on venues
  ↓
Session completes → validates confidence predictions
  ↓
System calibrates (if 50+ predictions)
  ↓
Weights improve → better future predictions
```

### 2. Favorites Overflow Flow
```
Member swipes right (loves venue)
  ↓
Consensus reaches 70%+ → auto-promote
  ↓
Favorites overflow trigger checks:
  - Cooldown (24hr)
  - Threshold (15+ venues with data)
  ↓
If conditions met → create triage session
  ↓
Members narrow down favorites
  ↓
High-consensus venues become top candidates
```

### 3. Weekly Digest Flow
```
Cron job runs weekly (Monday 9am)
  ↓
For each active group:
  - Check cooldown (7 days)
  - Find venues needing feedback (<3 swipes)
  - Minimum 5 venues required
  ↓
Create weekly_digest session
  ↓
Members provide feedback over 7 days
  ↓
New swipe data → better calibration
```

## Configuration

### Thresholds
```typescript
const TRIGGER_THRESHOLDS = {
  favorites_overflow: 15,  // Trigger when 15+ venues with feedback
  post_ai_min_venues: 3,   // Only trigger if AI generated 3+ venues
  weekly_digest_min: 5,    // Need 5+ venues for digest
};
```

### Session Parameters
- **Post-AI**: 5 swipes, expires in 48 hours
- **Favorites Overflow**: 10 swipes, expires in 72 hours
- **Weekly Digest**: 5 swipes, expires in 168 hours (7 days)
- **Manual**: 5 swipes, custom expiration

## Benefits

### For Members
- ✅ No notification spam (smart cooldowns)
- ✅ Timely feedback requests (right after AI generates ideas)
- ✅ Clear impact (see how swipes improve predictions)
- ✅ Optional participation (sessions auto-complete)

### For Organizers
- ✅ Full transparency (dashboard shows trigger status)
- ✅ Manual override (can trigger sessions anytime)
- ✅ Engagement metrics (see participation rates)
- ✅ Hands-off automation (triggers work automatically)

### For the AI System
- ✅ Faster calibration (more swipe volume)
- ✅ Better predictions (fresh feedback data)
- ✅ Continuous learning (regular weekly digests)
- ✅ Validated confidence scores (swipe consensus validates predictions)

## Monitoring

### Dashboard Metrics
The SwipeTriggerDashboard shows:
- Current cooldown status for each trigger type
- Number of venues ready for feedback
- Next available trigger times
- Trigger history

### Logs
All triggers log to console:
```
[SwipeTrigger] 🎯 5 new AI-generated venues ready to swipe
[FavoritesOverflow] 📚 18 venues to curate!
[WeeklyDigest] 📅 Weekly digest: 7 venues to rate
```

## Future Enhancements

### Possible Additions
1. **Smart Timing** - Trigger digests at optimal times based on member activity patterns
2. **Personalized Triggers** - Individual member engagement based on participation history
3. **Push Notifications** - Email/SMS alerts when new swipe sessions available
4. **Gamification** - Leaderboards, streaks, badges for active swipers
5. **A/B Testing** - Experiment with different trigger strategies per group

### Analytics to Track
- Average time to complete sessions
- Participation rate by trigger type
- Correlation between swipe volume and calibration improvement
- Member engagement trends over time

## Testing

### Manual Testing
1. Create a group and enable auto-scheduling
2. Wait for AI to generate events → Post-AI trigger should fire
3. Swipe right on multiple venues → Check favorites overflow trigger
4. Run weekly digest manually: `POST /api/groups/:id/swipe-triggers/weekly-digest`

### Automated Testing
```bash
# Test trigger opportunities
curl http://localhost:5000/api/groups/{groupId}/swipe-triggers/status

# Test manual trigger
curl -X POST http://localhost:5000/api/groups/{groupId}/swipe-triggers/manual \
  -H "Content-Type: application/json" \
  -d '{"activityIds": ["id1"], "reason": "Test session"}'

# Test weekly digest trigger
curl -X POST http://localhost:5000/api/groups/{groupId}/swipe-triggers/weekly-digest
```

## Deployment Checklist

- [x] Swipe trigger manager implemented
- [x] Background worker created
- [x] Auto-scheduler integration complete
- [x] Swipe recording integration complete
- [x] API endpoints added
- [x] UI dashboard created
- [x] Frequency caps configured
- [ ] Set up cron job for weekly digests
- [ ] Monitor trigger logs in production
- [ ] Track calibration improvements

## Related Files

### Server
- `server/swipe-trigger-manager.ts` - Core trigger logic
- `server/swipe-digest-worker.ts` - Weekly digest worker
- `server/reminder-scheduler.ts` - Auto-scheduler integration
- `server/routes.ts` - API endpoints + swipe recording integration

### Client
- `client/src/components/SwipeTriggerDashboard.tsx` - UI component
- `client/src/pages/group-detail.tsx` - Integration point

### Schema
- `shared/schema.ts` - swipeSessions, confidencePredictions tables

### Related Systems
- `server/confidence-scoring.ts` - Confidence calculation with swipe consensus
- `server/confidence-calibration.ts` - Self-learning weight optimization
- `server/swipe-consensus.ts` - Auto-promote/reject logic
- `server/swipe-session-manager.ts` - Session lifecycle management
