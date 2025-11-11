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

### UI Integration for Learning Insights
**Priority:** 🔴 High
**Status:** Not started
**Date Added:** 2025-11-11

**What:**
Create user-facing dashboards and UI to surface the learning system's insights.

**Tasks:**
1. **Organizer Dashboard - Auto-Blacklisted Venues**
   - Display list of rejected venues with reasons (low rating, "would not do again")
   - Allow manual removal from blacklist
   - Show when venue was blacklisted

2. **Organizer Dashboard - Member Constraints**
   - Show auto-learned member constraints (budget, location, schedule conflicts)
   - Highlight which constraints were auto-detected vs manually set
   - Allow organizer to override or confirm auto-learned constraints

3. **Engagement Scores Dashboard**
   - Display member engagement metrics (active/at-risk/inactive status)
   - Show RSVP response rate and attendance rate per member
   - Alert organizers when members transition to "at-risk" or "inactive" status
   - Suggest actions: "3 members at risk - review their preferences?"

4. **Member View - Learning Transparency**
   - Show members what the system has learned about their preferences
   - Allow members to confirm or reject auto-learned constraints
   - Privacy controls for constraint visibility

**Related files:**
- Create new file: `client/src/pages/GroupInsights.tsx`
- Update: `server/routes.ts` (learning insights endpoint already exists at line 6757)
- Use existing endpoint: GET `/api/groups/:groupId/learning-insights`

**Impact:**
Makes the learning system visible and actionable for both organizers and members.

---

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

### Member Notifications for Auto-Learning
**Priority:** 🟡 Medium
**Status:** Not started
**Date Added:** 2025-11-11

**What:**
Notify members when the system auto-learns their preferences and give them control.

**Tasks:**
1. **Constraint Update Notifications**
   - Send notification when member constraints are auto-updated
   - Example: "We noticed you often decline Thursday events. We've updated your availability preferences."
   - Provide link to review/confirm/reject the change

2. **Proactive Preference Prompts**
   - After 2-3 consistent RSVP patterns, ask member to confirm before auto-updating
   - Example: "You've declined 3 events due to budget concerns. Should we adjust your preferences?"
   - Respect member choice (opt-in vs auto-apply)

3. **Learning Transparency**
   - Show members what patterns were detected
   - Example: "Based on your last 5 RSVPs, we noticed: 4 budget concerns, 3 Thursday conflicts"
   - Allow members to disable auto-learning per preference type

**Related files:**
- `server/member-learning.ts` (add notification triggers)
- `server/email-service.ts` (create notification templates)
- Create new endpoint: POST `/api/members/:memberId/confirm-constraints`

**Impact:**
Members stay informed and in control of their learned preferences, building trust in the automation.

---

### Testing for Member Learning System
**Priority:** 🟡 Medium
**Status:** Not started
**Date Added:** 2025-11-11

**What:**
Comprehensive test coverage for the member learning system to ensure reliability.

**Tasks:**
1. **Unit Tests for Pattern Detection**
   - Test threshold logic (4+ occurrences OR 50%)
   - Test edge cases: new members, sparse RSVP history
   - Test pattern aggregation (multiple concern types)

2. **Integration Tests for Auto-Updates**
   - Test constraint updates flow end-to-end
   - Test that constraints are properly passed to AI
   - Test that blacklisted venues are excluded from suggestions

3. **Engagement Scoring Tests**
   - Test engagement calculations with various RSVP patterns
   - Test status transitions (active → at-risk → inactive)
   - Test edge cases: no RSVPs, all "yes", all "no"

4. **API Endpoint Tests**
   - Test learning insights endpoint authorization
   - Test engagement scores endpoint
   - Test constraint update endpoint

**Related files:**
- Create: `server/member-learning.test.ts`
- Add tests to existing test suite

**Impact:**
Ensures learning system works reliably and doesn't make incorrect assumptions about member preferences.

---

### Custom Venue Enhancements
**Priority:** 🟡 Medium
**Status:** Partially complete (basic functionality done)
**Date Added:** 2025-11-11

**Current State:**
- ✅ Can add custom venues to itineraries
- ✅ Google Maps URL parsing works
- ✅ Enhanced itinerary editing with custom venue details
- ❌ Cannot edit custom venue details after creation
- ❌ No bulk import for custom venues
- ❌ No venue sharing across groups

**Tasks:**
1. **Edit Custom Venues**
   - Allow users to edit custom venue name, address, description
   - Add ability to add photos to custom venues
   - Update price level and category after creation

2. **Bulk Import Custom Venues**
   - CSV import for multiple custom venues
   - Import from Google Maps saved lists
   - Import from shared spreadsheets

3. **Cross-Group Venue Sharing** (optional)
   - Allow sharing custom venues across user's groups
   - Create "My Favorite Venues" library per user
   - Import from another group's custom venues

**Related files:**
- `server/routes.ts` (custom venue endpoints)
- `client/src/components/itinerary/*` (custom venue UI)

**Impact:**
Makes custom venues a first-class feature with full CRUD operations and bulk management.

---

### 🤖 "Set It and Forget It" Automation - Phase 2: Learning Loops
**Vision:** AI learns from feedback and automatically improves suggestions
**Current Status:** ✅ Core learning loops implemented! UI integration pending.
**Date Added:** 2025-11-07
**Last Updated:** 2025-11-11

#### 1. Venue Ratings → Auto-Blacklist Low-Rated Venues
**Status:** ✅ COMPLETE (moved to Completed section)

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
**Status:** ✅ COMPLETE (moved to Completed section)

#### 4. Attendance Tracking → Member Engagement Monitoring
**Status:** ✅ COMPLETE (moved to Completed section)

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

### Learning System Analytics
**Priority:** 🟢 Low
**Status:** Not started
**Date Added:** 2025-11-11

**What:**
Track and measure the effectiveness of the member learning system.

**Tasks:**
1. **Constraint Accuracy Tracking**
   - Track how often auto-learned constraints lead to "yes" RSVPs
   - Compare RSVP rates before vs after constraint updates
   - Measure false positives (constraints that don't reflect actual preferences)

2. **Re-engagement Metrics**
   - Track re-engagement success after constraint updates
   - Measure how many "at-risk" members become "active" after updates
   - Track how many "inactive" members return after nudges

3. **Blacklist Effectiveness**
   - Track how often blacklisted venues would have been suggested
   - Measure satisfaction improvement after venue blacklisting
   - Identify patterns in low-rated venue types

4. **Analytics Dashboard**
   - Admin view showing learning system performance across all groups
   - Metrics: constraint update frequency, accuracy, re-engagement rates
   - Identify groups that benefit most from auto-learning

**Related files:**
- Create: `server/learning-analytics.ts`
- Add analytics endpoints to `server/routes.ts`
- Create admin dashboard component

**Impact:**
Data-driven insights to continuously improve the learning system's accuracy and effectiveness.

---

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

### 🤖 Learning Loop #1: Auto-Blacklist Low-Rated Venues (2025-11-11)
**Completed:** 2025-11-11
**Part of:** Phase 2 Learning Loops automation

**What was done:**
1. ✅ Implemented auto-blacklisting for venues with ≤2 star ratings
2. ✅ Auto-blacklist venues marked "would not do again" regardless of rating
3. ✅ Integration with post-event feedback flow
4. ✅ Blacklisted venues automatically excluded from future AI suggestions

**Implementation:**
- Added auto-blacklist logic in `server/routes.ts:6437-6453`
- Triggers after post-event feedback submission
- Uses existing `storage.addRejectedVenue()` method
- Extracts venue names from itinerary items and adds to `groups.rejectedVenues`

**Impact:**
Groups will never receive suggestions for venues they rated poorly or marked as "would not do again."

---

### 🤖 Learning Loop #3: RSVP Patterns → Auto-Update Member Constraints (2025-11-11)
**Completed:** 2025-11-11
**Part of:** Phase 2 Learning Loops automation

**What was done:**
1. ✅ Created comprehensive member learning system (`server/member-learning.ts`)
2. ✅ Pattern analysis for last 10 RSVPs per member
3. ✅ Auto-detects budget, location, and time concerns
4. ✅ Conservative threshold: 4+ occurrences OR 50% of last 10 RSVPs
5. ✅ Auto-updates `members.memberConstraints` when patterns detected
6. ✅ Integration with RSVP flow

**Implementation:**
- New file: `server/member-learning.ts` (370 lines)
- Functions: `analyzeRSVPPatterns()`, `autoUpdateMemberConstraints()`
- Integration: `server/routes.ts:2454-2459` (triggers after RSVP submission)
- Tracks: `budgetConcern`, `distanceConcern`, `scheduleConflicts`

**Impact:**
AI automatically learns member preferences from behavior and stops suggesting incompatible activities.

---

### 🤖 Learning Loop #4: Engagement Scoring & Monitoring (2025-11-11)
**Completed:** 2025-11-11
**Part of:** Phase 2 Learning Loops automation

**What was done:**
1. ✅ Built engagement scoring system for all members
2. ✅ Calculates RSVP response rate (% of invites responded to)
3. ✅ Calculates attendance rate (% of "yes" RSVPs actually attended)
4. ✅ Status classification: active (≥60%), at-risk (30-60%), inactive (<30%)
5. ✅ Group-level engagement analysis
6. ✅ API endpoint for learning insights

**Implementation:**
- Functions in `server/member-learning.ts`:
  - `calculateEngagement()` - Individual member scoring
  - `calculateGroupEngagement()` - All members in group
  - `getInactiveMembers()` - Filter for disengaged members
  - `logEngagementSummary()` - Debug/monitoring
- New endpoint: GET `/api/groups/:groupId/learning-insights` (`server/routes.ts:6757+`)

**Impact:**
Organizers can identify disengaged members and proactively intervene before members ghost the group.

---

### Custom Venue Features (2025-11-06 to 2025-11-11)
**Completed:** 2025-11-11
**Recent commits:** 2f26b86, 4f09fa6

**What was done:**
1. ✅ Add custom venues to itineraries
2. ✅ Google Maps URL parsing capabilities
3. ✅ Enhanced itinerary planning with custom venue details
4. ✅ Editing functionality for itinerary venue details

**Files changed:**
- Itinerary planning components
- Venue search and selection UI
- Server routes for custom venue handling

**Impact:**
Users can now add any venue to itineraries, not just curated database venues. Enables fully customized event planning.

---

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

*Last updated: 2025-11-11*
