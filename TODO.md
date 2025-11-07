# TODO & Backlog

This file tracks future tasks, deferred items, and improvement ideas for the project.

## Legend

- 🔴 **High Priority** - Critical features or bugs
- 🟡 **Medium Priority** - Important but not urgent
- 🟢 **Low Priority** - Nice to have
- 💰 **Has API Cost** - Requires paid API calls
- ⏰ **Scheduled/Deferred** - Ready to execute when needed

---

## ⏰ Deferred Tasks

### 💰 Import Missing Venues (Food + Drinks)
**Status:** Ready to run
**Priority:** 🟡 Medium
**Date Deferred:** 2025-11-06

**What:**
Import 297 venues (222 food + 75 drinks) from scraped JSON data into the `curated_venues` database.

**Why:**
- Scraped data contains 610 total venues not in the database
- 297 are relevant (food/drinks), 313 are irrelevant (nail salons, gas stations, etc.)
- Would improve search coverage for restaurants and bars in SF

**Details:**
- **Cost:** ~$5.05 in Google Places API calls (297 × $0.017 per call)
- **Time:** ~1 minute (100ms delay between calls)
- **Script:** `/server/import-scraped-venues.ts`
- **What it does:**
  - Reads JSON files from `/attached_assets/`
  - Filters for food & drinks categories only
  - Fetches complete venue details (coordinates, photos, price level) from Google Places API
  - Inserts into `curated_venues` table
  - Skips duplicates automatically

**To Run:**
```bash
# Edit the script to filter for food/drinks only
# Then run:
npx tsx server/import-scraped-venues.ts
```

**Notes:**
- Supreme Dumplings and NoodlePanda are already in database
- Current database has 4,533 venues
- This would add ~297 more (6.6% increase)

---

## 🔴 High Priority

### 🤖 "Set It and Forget It" Automation - Phase 1: Close the Organizer Loop
**Vision:** Remove all manual organizer intervention from the event cycle
**Current Status:** Auto-scheduler exists but requires manual approval for each event
**Date Added:** 2025-11-07

**What exists:**
- ✅ Auto-scheduler creates pending events 10 days before due date (`server/auto-scheduler.ts`)
- ✅ Auto-send mechanism sends invites if no host volunteers within 48hrs
- ✅ AI can select best itinerary and suggest optimal times
- ✅ Schema has automation flags: `autoItineraryEnabled`, `autoScheduleEnabled`

**What's missing:**

#### 1. Auto-Create Itineraries from Activities
**Task:** Wire up `autoItineraryEnabled` flag to automatically create itineraries
- Check if group has enough approved activities (saved/loved)
- Use AI to select complementary activities (meal + drinks, or cafe + experience)
- Validate itinerary using existing `validateItinerary()` function
- Mark as "AI-created" for confidence tracking
- **Related files:**
  - `server/auto-scheduler.ts` (where auto-creation should trigger)
  - `server/routes.ts` (itinerary creation logic at lines ~4800-5000)
  - `server/ai-scheduling.ts` (scheduling config generation)

#### 2. Confidence-Based Auto-Approval
**Task:** Add confidence scoring to auto-approve "safe" events
- Calculate confidence based on:
  - Activity ratings (activities with high votes)
  - Time slot consensus (>70% availability)
  - Group history (successful past events)
  - Member engagement (high RSVP rates)
- Auto-approve events with confidence > 80%
- Flag uncertain events (<60% confidence) for organizer review
- Create `eventConfidence` field in `autoScheduledEvents` table
- **Related files:**
  - `server/auto-scheduler.ts` (add confidence calculation)
  - `shared/schema.ts` (add eventConfidence field)

#### 3. Auto-Select Time Slots
**Task:** Automatically select time slot after voting closes
- Wait for RSVP deadline
- Select time slot with most "yes" votes
- If tie, use AI to pick based on group preferences
- If insufficient "yes" votes (<50% of group), trigger auto-reschedule
- **Related files:**
  - `server/auto-scheduler.ts` (add time selection logic)
  - `server/routes.ts` (time slot voting logic at lines ~5500-5700)

**Impact:**
Once implemented, organizers can truly "set it and forget it" - groups will self-schedule without any manual intervention.

---

## 🟡 Medium Priority

### 🤖 "Set It and Forget It" Automation - Phase 2: Learning Loops
**Vision:** AI learns from feedback and automatically improves suggestions
**Current Status:** Feedback is collected but not automatically applied
**Date Added:** 2025-11-07

#### 1. Venue Ratings → Auto-Blacklist Low-Rated Venues
**Current State:**
- ✅ Post-event venue ratings (1-5 stars) are collected (`postEventFeedback.venueRating`)
- ✅ Fake venues are auto-blacklisted when Google Places can't find them
- ❌ Low-rated venues are NOT auto-blacklisted

**Task:**
- After post-event feedback is submitted, check venue rating
- If rating ≤ 2 stars, add venue to `groups.rejectedVenues` array
- If "would not do again", add to blacklist regardless of rating
- Pass blacklisted venues to AI on future activity generation
- Create `lowRatedVenues` field separate from `rejectedVenues` for tracking
- **Related files:**
  - `server/routes.ts` (post-event feedback endpoint at lines 6122-6201)
  - `server/storage.ts` (add method similar to `addRejectedVenue()` at lines 459-473)
  - `server/openai.ts` (activity generation receives rejectedVenues at lines 3075-3103)

**Impact:**
Groups will never get suggestions for venues they didn't enjoy in the past.

#### 2. Frequency Feedback → Auto-Adjust Schedule
**Current State:**
- ✅ ALREADY WORKING! Frequency feedback auto-adjusts meeting cadence
- ✅ When 50%+ members vote "more_often" or "less_often", `group.meetingFrequency` updates
- ✅ Shifts frequency up/down: weekly ↔ biweekly ↔ monthly ↔ bimonthly
- ✅ Implementation at `server/routes.ts` lines 6443-6477

**Task:**
- ✅ No action needed - this loop is complete!
- 📝 Consider: Track per-member frequency preferences (not just aggregate)
- 📝 Consider: Seasonal frequency adjustment (less frequent in summer?)

**Impact:**
Already working! Groups automatically adjust cadence based on member feedback.

#### 3. RSVP Patterns → Auto-Update Member Constraints
**Current State:**
- ✅ RSVP decline feedback is collected (`rsvps.rsvpFeedback`)
- ✅ Captures: budgetConcern, locationConcern, timeConcern, unavailableOn, etc.
- ✅ `members.memberConstraints` field exists and is passed to AI
- ❌ RSVP feedback is NOT automatically written to `memberConstraints`

**Task:**
- After 2-3 RSVPs with consistent patterns, auto-update `members.memberConstraints`
- **Budget concerns:** If budgetConcern appears 2+ times, set `budgetConcern: true`
- **Distance concerns:** If locationConcern appears 2+ times, set `distanceConcern: true`
- **Time patterns:** If "unavailableOn" shows consistent day (e.g., "Thursdays"), add to `scheduleConflicts`
- Create background job to analyze RSVP patterns and update constraints
- Show member a notification: "We noticed you often decline Thursday events. Update your availability?"
- **Related files:**
  - `server/routes.ts` (RSVP endpoint at lines 2334-2403, constraint update at 1625-1649)
  - `shared/schema.ts` (memberConstraints schema at line 139)
  - `server/openai.ts` (constraints passed to AI at lines 8146-8244)

**Implementation approach:**
```typescript
// After RSVP is saved with feedback
async function analyzeRSVPPatterns(memberId: number, groupId: number) {
  // Get last 5 RSVPs for this member in this group
  const recentRSVPs = await getRecentRSVPs(memberId, groupId, 5);

  // Count patterns
  const budgetConcerns = recentRSVPs.filter(r => r.rsvpFeedback?.budgetConcern).length;
  const locationConcerns = recentRSVPs.filter(r => r.rsvpFeedback?.locationConcern).length;

  // If 2+ consistent concerns, update constraints
  if (budgetConcerns >= 2 || locationConcerns >= 2) {
    await updateMemberConstraints(memberId, {
      budgetConcern: budgetConcerns >= 2,
      distanceConcern: locationConcerns >= 2,
      notes: "Auto-detected from RSVP patterns"
    });
  }
}
```

**Impact:**
AI will learn member preferences automatically and stop suggesting incompatible activities.

#### 4. Attendance Tracking → Member Engagement Monitoring
**Current State:**
- ✅ Post-event attendance is collected (`postEventFeedback.actuallyAttended`)
- ✅ Repeat attendance metrics are calculated (analytics only)
- ❌ No automated detection of inactive members
- ❌ No engagement scoring or nudge system

**Task:**
- Create engagement scoring system for members:
  - RSVP response rate (% of invites responded to)
  - Attendance rate (% of "yes" RSVPs that actually attended)
  - Decline rate (% of "no" RSVPs)
  - Consistency (recent activity vs historical)
- Auto-detect disengaged members (< 30% response rate over last 5 events)
- Send automated "we miss you" email with preference update prompt
- Flag to organizer: "3 members seem disengaged, review their preferences?"
- Track re-engagement success rate
- **Related files:**
  - `server/storage.ts` (add engagement scoring methods)
  - `server/routes.ts` (add engagement tracking endpoint)
  - Create new file: `server/member-engagement.ts`

**Implementation approach:**
```typescript
interface MemberEngagementScore {
  memberId: number;
  rsvpResponseRate: number;  // 0-100
  attendanceRate: number;    // 0-100
  lastActiveDate: Date;
  status: 'active' | 'at-risk' | 'inactive';
}

async function calculateEngagement(memberId: number, groupId: number): Promise<MemberEngagementScore> {
  const last10Events = await getRecentInvites(memberId, groupId, 10);
  const responded = last10Events.filter(e => e.rsvpStatus !== null);
  const attended = last10Events.filter(e => e.postEventFeedback?.actuallyAttended);

  const rsvpResponseRate = (responded.length / last10Events.length) * 100;
  const attendanceRate = responded.length > 0 ? (attended.length / responded.length) * 100 : 0;

  let status: 'active' | 'at-risk' | 'inactive';
  if (rsvpResponseRate < 30) status = 'inactive';
  else if (rsvpResponseRate < 60) status = 'at-risk';
  else status = 'active';

  return { memberId, rsvpResponseRate, attendanceRate, lastActiveDate: new Date(), status };
}
```

**Impact:**
Organizers will be alerted to member disengagement and can proactively intervene before members ghost the group.

---

### Improve Search Result Relevance
**Related to:** Today's search fixes (2025-11-06)

**Background:**
Fixed search to be user-directed (no filters on reviews, budget, distance) so users can find any venue they want. This works great for user searches but may need separate logic for AI-suggested venues.

**Task:**
- Consider creating separate endpoint for AI suggestions that applies quality filters
- Or add a parameter to toggle between "user search" vs "AI suggestions" mode
- AI suggestions should have stricter filters (50+ reviews, budget matching, etc.)

---

## 🟢 Low Priority

### 🤖 "Set It and Forget It" Automation - Phase 3: Proactive Maintenance
**Vision:** System self-maintains and self-heals without intervention
**Current Status:** Reactive only - requires manual trigger for refresh/reschedule
**Date Added:** 2025-11-07

#### 1. Auto-Refresh Stale Activities
**Current State:**
- ✅ Activity generation works well with feedback integration
- ✅ `autoActivitiesEnabled` flag exists in schema
- ❌ Activities are NOT automatically regenerated when stale

**Task:**
- Wire up `autoActivitiesEnabled` to trigger automatic activity refresh
- Detect staleness conditions:
  - All activities have been seen (in `seenActivities` table)
  - All activities have been voted on (upvote or downvote)
  - No new activities generated in 30+ days
  - Low satisfaction scores (< 3 star average)
  - New members joined (their preferences might warrant new suggestions)
- Create background job that runs daily to check for stale activity pools
- Auto-regenerate when conditions met
- Notify organizer: "Generated 20 fresh activity ideas for your group!"
- **Related files:**
  - `server/auto-scheduler.ts` (add activity refresh check)
  - `server/routes.ts` (activity generation at lines ~3000-3300)
  - `server/storage.ts` (add staleness detection methods)

**Impact:**
Groups will always have fresh activity ideas without organizer having to remember to regenerate.

#### 2. Auto-Reschedule Low-RSVP Events
**Current State:**
- ✅ Reschedule tracking exists (max 2 attempts)
- ✅ AI can suggest alternate times
- ❌ Rescheduling requires manual organizer intervention

**Task:**
- Monitor RSVP rates 48 hours before event
- If < 50% of group has responded "yes", trigger auto-reschedule
- Try backup time slot (2nd highest voted time)
- If no backup time exists, use AI to suggest new time based on who declined
- Send notification: "Low turnout - we've rescheduled to [new time] based on your availability"
- After 2 reschedule attempts, ask organizer: "Should we cancel or flip to backup itinerary?"
- **Related files:**
  - `server/auto-scheduler.ts` (add RSVP monitoring)
  - `server/routes.ts` (reschedule logic)
  - `shared/schema.ts` (itinerary has `rescheduleCount` field)

**Impact:**
Events won't fail due to low turnout - system automatically adjusts to maximize attendance.

#### 3. Flip to Backup Itinerary on Multiple Declines
**Current State:**
- ✅ Backup itinerary concept exists in schema (`backupItineraryId`)
- ❌ Backup flip logic is not implemented

**Task:**
- When primary itinerary gets 60%+ declines with activity concerns, auto-flip to backup
- Notify members: "Based on feedback, we're switching to [backup itinerary]"
- Create new RSVP round for backup itinerary
- Track flip success rate
- If backup also fails, notify organizer for manual intervention
- **Related files:**
  - `shared/schema.ts` (backupItineraryId at line ~294)
  - `server/routes.ts` (add backup flip logic)

**Impact:**
One bad itinerary won't sink the whole event - system has fallback options.

#### 4. Smart Activity Pool Management
**Current State:**
- ✅ Curated venues database (4,533 venues)
- ✅ Seen activities tracking prevents repetition
- ❌ No automated pool health monitoring

**Task:**
- Monitor "activity pool health" for each group:
  - Unseen activity count (should be > 10)
  - Unsaved activity count (activities not voted on yet)
  - Category distribution (ensure all enabled categories represented)
- Alert when pool is unhealthy:
  - < 5 unseen activities → auto-refresh now
  - Heavy concentration in one category → regenerate underrepresented categories
  - All activities seen 2+ times → expand search radius or adjust preferences
- Create admin dashboard showing pool health across all groups
- **Related files:**
  - Create new file: `server/activity-pool-health.ts`
  - `server/storage.ts` (add pool health methods)

**Impact:**
Groups never run out of fresh ideas, system self-maintains optimal activity diversity.

---

### Add Fuzzy Matching for Venue Names
Search currently uses exact token matching (all words must match). Could improve with:
- Levenshtein distance for typos
- Singular/plural handling ("dumpling" vs "dumplings")
- Common abbreviations (SF, SoMa, etc.)

### Optimize Search Caching Strategy
Current caching is aggressive. Could optimize:
- Don't cache empty results for user-directed searches ✅ (Done 2025-11-06)
- Consider shorter cache TTL for search results
- Add cache invalidation mechanism

---

## 📝 Ideas / Future Enhancements

### Democratic Group Archiving & Soft Delete
**Priority:** 🟢 Low (future feature)
**Status:** Brainstorming phase

**Concept:**
Allow groups to be archived democratically with a grace period for ownership transfer, followed by soft delete.

**Proposed Flow:**
1. **Archive Trigger**
   - Any member can propose archiving a group
   - Could require voting/consensus (prevent pranks)
   - Organizer can step down during archive period

2. **Grace Period (30 days)**
   - Group marked as "archived" but still visible
   - Members notified of pending deletion
   - Other members can volunteer to take over as organizer
   - If someone claims ownership, group is reactivated

3. **Soft Delete (after 30 days)**
   - If no one claims ownership, group is soft-deleted
   - Data preserved in database but hidden from all queries
   - Admin can restore if needed

**Implementation Considerations:**
- Voting mechanism to prevent accidental/malicious archives
- Email notifications at key points (archive proposed, 7 days left, 1 day left)
- UI for claiming ownership during grace period
- Admin restore functionality
- What happens to scheduled events during archive period?

**Current Status:**
- ✅ Hard delete functionality implemented (admin-only)
- ✅ Soft delete functionality exists (`softDeleteGroup()`)
- ⏸️  Democratic archiving system not yet designed

**Related:**
- Deleted "AFC (Asian Food Crew)" group on 2025-11-06 using new hard delete functionality

---

### Venue Data Enrichment
- Periodically refresh venue data from Google Places API
- Track when venues close or change details
- Add user-submitted venue suggestions

### Search Analytics
- Track what users search for
- Identify popular venues
- Find gaps in venue coverage

### Batch Import Tools
- Create admin UI for importing scraped venues
- Preview before import (show what will be added)
- Category filtering in UI

---

## ✅ Completed

### Hard Delete Group Functionality (2025-11-06)
**Completed:** 2025-11-06

**What was done:**
1. ✅ Added `hardDeleteGroup()` method to `server/storage.ts`
2. ✅ Created `DELETE /api/admin/groups/:id` admin endpoint
3. ✅ Created deletion script at `server/delete-group.ts`
4. ✅ Permanently deleted "AFC (Asian Food Crew)" group

**Files changed:**
- `server/storage.ts` (hardDeleteGroup method + interface)
- `server/routes.ts` (admin delete endpoint)
- `server/delete-group.ts` (new file)

**Impact:**
- Admins can now permanently delete groups
- Automatic backup created before deletion
- CASCADE deletes handle all related data
- Group restored from backup if needed

### Fix Search for User-Directed Queries (2025-11-06)
**Completed:** 2025-11-06

**What was done:**
1. ✅ Query format improved - always includes location context
2. ✅ Empty result caching disabled for user searches
3. ✅ Distance filtering relaxed for user searches
4. ✅ Review count filter (50+) disabled for user searches
5. ✅ Budget filter disabled for user searches

**Files changed:**
- `server/google-places.ts` (searchPlaces function)
- `server/routes.ts` (search endpoint)

**Impact:**
- Supreme Dumplings and NoodlePanda now searchable
- Users can find any venue regardless of filters
- Search actually works as expected for user input

---

*Last updated: 2025-11-07*
