# TODO & Backlog

This file tracks future tasks, deferred items, and improvement ideas for the project.

## Legend

- 🔴 **High Priority** - Critical features or bugs
- 🟡 **Medium Priority** - Important but not urgent
- 🟢 **Low Priority** - Nice to have
- 💰 **Has API Cost** - Requires paid API calls
- ⏰ **Scheduled/Deferred** - Ready to execute when needed

---

## 🚀 Ready to Deploy

### Swipe Engagement & Calibration System
**Status:** ✅ Complete - Ready for deployment
**Priority:** 🔴 High - Core automation feature
**Date Completed:** 2025-11-13

**What was built:**
Complete swipe-based engagement and AI calibration system with 8 modules (3,072 lines, 89.4KB):
- ✅ Smart trigger manager with frequency caps (12hr/24hr/7day cooldowns)
- ✅ Gradient descent calibration algorithm (self-learning weights)
- ✅ Auto-promote/reject based on consensus (70%/30% thresholds)
- ✅ Auto-approval for high confidence events (≥80%)
- ✅ Full transparency dashboards (real-time AI learning)
- ✅ Complete automation loop (10 steps tested)

**Next steps to deploy:**
1. **Run database migrations** → `npx drizzle-kit push`
2. **Set up weekly digest cron** → `0 9 * * 1 npx tsx server/swipe-digest-worker.ts`
3. **Test with real groups** (checklist in DEPLOYMENT_GUIDE.md)
4. **Monitor dashboards** (Group Detail → Feedback tab)

**Documentation:**
- 📖 **QUICK_START.md** - 5 minute setup guide
- 📋 **DEPLOYMENT_GUIDE.md** - Complete deployment instructions
- 📊 **SWIPE_ENGAGEMENT_SYSTEM.md** - System architecture & how it works
- ✅ **TEST_RESULTS.md** - All 58/58 tests passed

**Test Results:**
- ✅ Module validation: 8/8 modules
- ✅ Configuration: 13/13 parameters validated
- ✅ Logic tests: 15/15 scenarios passed
- ✅ Integration: 22/22 points verified
- ✅ Complete data flow: 10/10 steps working

**Impact:**
The complete automation loop is now production-ready:
1. Auto-scheduler creates events → logs predictions
2. Post-AI trigger fires → members swipe
3. Session completes → validates 50+ predictions
4. Auto-calibration runs → weights optimize
5. Weights improve → better future predictions
6. High confidence (≥80%) → auto-approves immediately
7. Members RSVP → feedback validates accuracy
8. Weekly digest → maintains engagement

See your **todo list** for deployment checklist, or start with **QUICK_START.md**!

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

### 🎴 Discover Venues + Smart Schedule Now from Favorites
**Priority:** 🔴 High
**Status:** Not started
**Date Added:** 2025-11-14
**Estimated Time:** 7-8 hours total

**Vision:**
Let users swipe to discover and curate Favorites anytime. Then Schedule Now intelligently pulls from Favorites to create high-quality itineraries with venues the group already loves.

**Current Problem:**
- Schedule Now generates 3 completely new options each time
- Picks 1 option, wastes the other 2 (6-10 venues lost)
- No ongoing curation - starts from scratch every time
- Can't build a trusted pool of venues over time
- Group has no control over what gets suggested

**New Approach:**
1. **Discover Venues** → Swipe anytime to build Favorites list
2. **Schedule Now** → AI prioritizes Favorites, creates 1 smart itinerary
3. **Fill gaps** → AI adds suggestions only if Favorites is empty/insufficient
4. **Fallback** → If Favorites is empty, use current 3-option flow

---

#### Phase 1: Add "Discover Venues" Swipe Feature (3 hours)

**Goal:** Let users swipe anytime to build Favorites list

**1.1 Add "Discover Venues" button**
- **Location:** Group detail page, near Favorites tab
- **UI:** Button with "🔍 Discover Venues" text
- **Access:** Any member can discover (not just organizer)
- **Action:** Opens swipe session with ~20 venue suggestions

**1.2 Backend: Create discovery endpoint**
- **File:** `server/routes.ts`
- **Endpoint:** `POST /api/groups/:groupId/discover-venues`
- **Logic:**
  - Generate 20 venues based on group preferences
  - Mix of categories (restaurants, bars, cafes, activities)
  - Exclude: already in Favorites, recently rejected
  - Create swipe session with `sessionType: 'activity_curation'`
  - Return session ID + venue deck

**1.3 Wire swipe actions to Favorites**
- **Right swipe:** Add venue to Favorites (voting_events table)
- **Left swipe:** Mark as seen (don't show again in future discovery)
- **After session:** Show "Added 8 venues to Favorites!" with link to Favorites tab

---

#### Phase 2: Make Schedule Now Use Favorites (3-4 hours)

**Goal:** Schedule Now prioritizes Favorites and creates 1 smart itinerary

**2.1 Modify auto-scheduler logic**
- **File:** `server/auto-scheduler.ts`
- **Function:** `selectBestItineraryForAutoSchedule()`

**New Logic:**
```
Step 1: Get Favorites (voting_events for this group)

Step 2: Filter for suitable venues
  - NOT visited in last 60 days (use venueVisitHistory table)
  - Appropriate for event context (time of day, season)
  - Within budget constraints
  - Not in group's rejectedVenues

Step 3: Rank by quality
  - Upvote count (most important - group consensus)
  - Post-event ratings (5-star > 3-star)
  - Recency of upvote (recent = current interest)
  - Avoid over-visiting (rotate through Favorites)

Step 4: Generate itinerary based on Favorites size

  If ≥5 suitable Favorites:
    - AI clusters 3-5 venues into 1 logical itinerary
    - Prioritize geographic proximity (nearby venues)
    - Ensure logical flow (dinner → dessert → bar)
    - Mark all venues as "⭐ From Favorites"
    - Return 1 optimized itinerary

  If 1-4 suitable Favorites:
    - Use Favorites PLUS AI gap-fillers
    - Example: 2 restaurants + AI adds dessert venue
    - Mark which venues are "⭐ From Favorites" vs "✨ AI Suggestion"
    - Return 1 hybrid itinerary

  If 0 suitable Favorites (empty or all recently visited):
    - Fall back to current 3-option AI generation
    - Show prompt: "Build your Favorites first for better suggestions"
    - Link to Discover Venues flow
```

**2.2 Use existing visit history**
- **Table:** `venueVisitHistory` (already implemented!)
- **Cooldown:** 60 days for all venue types
- **Benefit:** Ensures variety and rotation through Favorites

**2.3 Show 1 itinerary (not 3 options)**
- Remove multi-option generation when using Favorites
- Display: "Created from your Favorites" with AI reasoning
- Show badges on each venue:
  - "⭐ From Favorites" (group already loves this)
  - "✨ AI Suggestion" (new venue to try)
- **Transparency:** Users see what's trusted vs experimental

**2.4 Add "Try Again" button**
- If organizer doesn't like the generated itinerary
- Regenerates different combination from Favorites
- After 2-3 tries, offer: "See AI options instead?" (fall back to 3-option flow)

---

#### Phase 3: Testing & Polish (1 hour)

**3.1 Empty Favorites handling**
- Show prompt: "Your Favorites is empty. Discover venues first?"
- **Button A:** "Discover Venues" → launch swipe session
- **Button B:** "Skip" → fall back to current 3-option flow

**3.2 Edge cases**
- All Favorites visited recently → use AI suggestions instead
- Only 1 Favorite → add AI-generated venues to round out itinerary
- Favorites has no variety (all restaurants) → AI adds activities/dessert
- Favorites too large (50+ venues) → prioritize by upvotes + recency

**3.3 End-to-end testing**
- Discover flow: Swipe → venues added to Favorites
- Schedule Now: Uses Favorites → creates good itinerary
- Visit tracking: Recently visited venues excluded correctly
- Quality ranking: Most-upvoted Favorites prioritized
- Fallback: Empty Favorites → 3-option flow

---

**Related Files:**
- `server/routes.ts` (new discover-venues endpoint)
- `server/auto-scheduler.ts` (modify selectBestItineraryForAutoSchedule)
- `server/swipe-session-manager.ts` (might already support discovery)
- `client/src/pages/group-detail.tsx` (add Discover Venues button)
- `client/src/components/ItineraryOptions.tsx` (modify to show 1 result from Favorites)
- `client/src/components/SwipeSession.tsx` (existing swipe UI - reuse)
- `shared/schema.ts` (no changes - uses existing tables)

**Database:**
- ✅ No schema changes needed! Uses existing tables:
  - `voting_events` (Favorites)
  - `swipeSessions` (discovery sessions)
  - `activitySwipes` (swipe records)
  - `venueVisitHistory` (visit tracking)

---

**Impact:**
- **Democratic curation:** Whole group builds Favorites together
- **Trusted venues:** Schedule Now uses group-vetted venues
- **No waste:** Every swiped venue goes to Favorites (reusable)
- **Less decision fatigue:** 1 smart itinerary vs 3 options
- **Better rotation:** Visit history prevents repetition
- **Quality signals:** Upvotes + ratings guide AI

---

**Success Criteria:**
After implementation:
1. ✅ Members can discover venues anytime (democratic curation)
2. ✅ Favorites list grows organically with group input
3. ✅ Schedule Now prioritizes group-loved venues
4. ✅ Visit history ensures variety (60-day cooldown)
5. ✅ 1 smart itinerary reduces decision paralysis
6. ✅ Graceful fallback when Favorites is empty

---

**Implementation Checklist:**
- [ ] 1.1: Add "Discover Venues" button to group page
- [ ] 1.2: Create discovery endpoint (POST /api/groups/:id/discover-venues)
- [ ] 1.3: Wire swipe actions to Favorites (right = add, left = skip)
- [ ] 2.1: Modify auto-scheduler to check Favorites first
- [ ] 2.2: Implement venue filtering (visit history, quality ranking)
- [ ] 2.3: Update UI to show 1 itinerary with source badges
- [ ] 2.4: Add "Try Again" regeneration button
- [ ] 3.1: Handle empty Favorites edge case
- [ ] 3.2: Test all edge cases (small Favorites, all visited, etc.)
- [ ] 3.3: End-to-end testing

---

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
**Current Status:** ⚠️ INFRASTRUCTURE BUILT - Core features not connected yet
**Date Added:** 2025-11-07
**Last Updated:** 2025-11-13

**What exists (Foundation ✅):**
- ✅ Auto-scheduler creates pending events 10 days before due date (`server/auto-scheduler.ts`)
- ✅ Auto-send mechanism sends invites if no host volunteers within 48hrs
- ✅ AI can select best itinerary and suggest optimal times
- ✅ Schema has automation flags: `autoItineraryEnabled`, `autoScheduleEnabled`
- ✅ Itinerary validation logic exists (`server/itinerary-validation.ts`)
- ✅ Activity selection and scheduling AI exists (`server/ai-scheduling.ts`)

**Critical Gap:** Events still require manual organizer approval at multiple points. The infrastructure exists but isn't wired together for true automation.

---

#### 1. Auto-Create Itineraries from Activities
**Status:** ❌ Not implemented (flag exists but not wired up)
**Priority:** 🔴 High - Required for automation to work

**Task:** Wire up `autoItineraryEnabled` flag to automatically create itineraries
- Check if group has enough approved activities (saved/loved)
- Use AI to select complementary activities (meal + drinks, or cafe + experience)
- Validate itinerary using existing `validateItinerary()` function
- Mark as "AI-created" for confidence tracking
- **Related files:**
  - `server/auto-scheduler.ts:223-289` (createPendingEvent - where auto-creation should trigger)
  - `server/routes.ts:4800-5000` (itinerary creation logic)
  - `server/ai-scheduling.ts:1-140` (scheduling config generation)
  - `server/itinerary-validation.ts` (validation logic)

---

#### 2. Confidence-Based Auto-Approval ⭐ CRITICAL
**Status:** ❌ Not implemented - THIS IS THE MAIN BLOCKER
**Priority:** 🔴 High - Without this, events still need manual approval

**Task:** Add confidence scoring to auto-approve "safe" events
- Calculate confidence based on:
  - Activity ratings (activities with high votes)
  - Time slot consensus (>70% availability)
  - Group history (successful past events)
  - Member engagement (high RSVP rates)
  - Venue visit frequency (avoid over-repeating venues)
- Auto-approve events with confidence > 80%
- Flag uncertain events (<60% confidence) for organizer review
- Add `confidenceScore` field to `itineraries` table
- **Related files:**
  - Create new file: `server/confidence-scoring.ts`
  - `server/auto-scheduler.ts` (integrate confidence calculation)
  - `shared/schema.ts:288-324` (add confidenceScore to itineraries table)

---

#### 3. Auto-Select Time Slots
**Status:** ❌ Not implemented
**Priority:** 🔴 High - Required to close the scheduling loop

**Task:** Automatically select time slot after voting closes
- Wait for RSVP deadline
- Select time slot with most "yes" votes
- If tie, use AI to pick based on group preferences
- If insufficient "yes" votes (<50% of group), trigger auto-reschedule
- **Related files:**
  - `server/auto-scheduler.ts` (add time selection logic)
  - `server/routes.ts:5500-5700` (time slot voting logic)
  - `server/reminder-scheduler.ts` (add job to check RSVP deadline)

---

**Impact:**
Once all 3 pieces are implemented, organizers can truly "set it and forget it" - groups will self-schedule without any manual intervention.

**Current Reality:**
Right now, automation creates *pending* events and sends *invites*, but organizers must still:
- Manually approve itineraries before they're sent
- Manually finalize time slots after voting
- Review low-confidence events

---

### 📱 Swipe-Based Curation & Democratic Decision Making
**Vision:** Transform swiping from one-time onboarding to ongoing group curation tool
**Current Status:** Swipe UI exists but only used during group creation
**Priority:** 🔴 High - Enables confidence validation AND solves "20+ Favorites paralysis"
**Date Added:** 2025-11-13

**Current State:**
- ✅ SwipeSession component exists (`client/src/components/SwipeSession.tsx`)
- ✅ Swipe cards with gesture support
- ✅ Backend generates swipe decks (10 venues)
- ❌ Only triggered during group creation onboarding
- ❌ No group-wide swipe sessions
- ❌ No consensus tracking across members
- ❌ No swipe-based triage for Favorites

**Problem:**
- Favorites tab accumulates 20+ venues with no good way to narrow down
- Only organizer can add to Favorites (via "Love" button)
- Group voting (upvote/downvote) feels disconnected from actual selection
- No lightweight way to get democratic input on AI-generated activities
- Can't validate AI confidence predictions without member input

**Solution: Two-Fold Swipe System**

#### 1. Swipe to Curate AI Activities (Democratic Triage)
**Status:** ❌ Not started
**What:** Replace Love/More/Less buttons with group-wide swipe sessions

**Tasks:**
- Create `activitySwipes` table to track individual member swipes
- Add swipe consensus logic: (right swipes / total swipes) × 100
- Create endpoint: POST /api/groups/:id/activities/:activityId/swipe
- When AI generates activities, create "swipe session" for the group
- Notify all members: "5 new restaurant ideas - swipe to vote"
- Auto-add to Favorites if activity gets 60%+ right swipes
- Mark as "seen" if activity gets <40% right swipes

**Impact:**
- Democratic filtering before adding to Favorites
- Reduces organizer burden (not just their choice anymore)
- Keeps Favorites list curated and high-quality

#### 2. Swipe to Shortlist Favorites (Itinerary Prep)
**Status:** ❌ Not started
**What:** Add "Swipe to Shortlist" mode when Favorites > 10 venues

**Tasks:**
- Add "Swipe to Shortlist" button to Favorites tab
- Support swiping on votingEvents (not just activities)
- Create endpoint: POST /api/groups/:id/favorites/:eventId/swipe
- Track consensus per Favorite venue
- Show results: "8 venues have 70%+ approval"
- Sort Favorites by consensus % (in addition to Rating/Votes)
- Filter to "shortlist" before building itinerary

**Impact:**
- Solves "20+ Favorites paralysis" when building itineraries
- Democratic decision-making (not just organizer's preference)
- Faster itinerary creation from pre-validated shortlist

#### 3. Swipe-Validated Confidence for Automation
**Status:** ❌ Not started
**What:** Use member swipes to validate AI's confidence predictions

**Tasks:**
- Auto-scheduler generates 3 itinerary options with predicted confidence scores
- Send swipe session to group: "Event coming up - which option looks best?"
- Members swipe through 3 itinerary options
- Compare: predicted 80% confidence vs actual 65% approval
- If actual ≥ predicted → Auto-approve event (skip organizer review)
- If actual < predicted → Flag for organizer + learn from discrepancy
- Track prediction accuracy over time to improve confidence algorithm

**Impact:**
- Enables true automation (validated confidence = auto-approval)
- Self-correcting system (learns from swipe vs prediction mismatches)
- Members feel heard and in control

#### 4. Ongoing Swipe Triggers
**Status:** ❌ Not started
**What:** Make swiping a regular, lightweight engagement mechanism

**Triggers to implement:**
- "Refine Ideas" button on group detail page (already exists at line 4339, not wired up)
- Empty Favorites tab → "Discover Venues" button
- Every 10 feedback actions → "Quick taste check: 5 swipes"
- Post-event → "Find more like this" swipe session
- New member joins → Personal preference onboarding

**Related files:**
- `client/src/components/SwipeSession.tsx` (existing swipe UI)
- `client/src/components/SwipeCard.tsx` (card component)
- `server/routes.ts` (swipe-deck endpoint at line ~3600)
- Create new: `server/swipe-consensus.ts` (consensus calculation logic)
- `shared/schema.ts` (add activitySwipes table)

**Database Changes:**
```sql
CREATE TABLE activity_swipes (
  id VARCHAR PRIMARY KEY,
  group_id VARCHAR REFERENCES groups(id),
  activity_id VARCHAR REFERENCES activities(id), -- nullable
  voting_event_id VARCHAR REFERENCES voting_events(id), -- nullable
  user_id VARCHAR REFERENCES users(id),
  member_id VARCHAR REFERENCES members(id),
  swipe_direction TEXT NOT NULL, -- 'right' | 'left'
  swipe_session_id VARCHAR, -- batch swipes together
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE activities ADD COLUMN swipe_consensus INTEGER DEFAULT NULL; -- 0-100%
ALTER TABLE voting_events ADD COLUMN swipe_consensus INTEGER DEFAULT NULL; -- 0-100%
```

**Implementation Priority:**
1. Core swipe infrastructure (table + endpoints)
2. AI activities swipe flow (Phase 2 from plan)
3. Favorites triage flow (Phase 3 from plan)
4. Automation confidence validation (Phase 4 from plan)
5. Ongoing engagement triggers (Phase 5 from plan)

---

## 🟡 Medium Priority

### 🎰 Slot-Based Itinerary Builder (Swipeable Carousel UI)
**Priority:** 🟡 Medium (Future Enhancement)
**Status:** Not started
**Date Added:** 2025-11-14
**Estimated Time:** 6-8 hours
**Depends On:** Discover Venues + Schedule Now from Favorites (must be implemented first)

**Vision:**
Advanced itinerary builder where each "slot" (dinner, drinks, dessert, activity) can be swiped through to see alternatives from Favorites.

**User Experience:**
```
Current Itinerary:
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   DINNER    │→ │   DRINKS    │→ │   DESSERT   │
│  [← → →]    │  │  [← → →]    │  │  [← → →]    │
│ Esperpento  │  │  Rudi's     │  │ La Copa Loca│
└─────────────┘  └─────────────┘  └─────────────┘
    Swipe             Swipe            Swipe
   through           through          through
   dinner            bar              dessert
  Favorites        Favorites        Favorites

[Delete Slot] [+ Add Activity] [+ Add Movie]
```

**Features:**
- **Horizontal scrolling per slot:** Swipe left/right to see alternatives
- **Category-aware:** Only shows relevant Favorites for each slot
  - Dinner slot → restaurants from Favorites
  - Drinks slot → bars from Favorites
  - Dessert slot → ice cream, bakeries from Favorites
  - Activity slot → museums, parks, theaters from Favorites
- **Dynamic slots:** Add/remove slots (e.g., replace dessert with movie)
- **Smart filtering:** Each slot only shows venues that fit (time, location, budget)
- **Visual feedback:** Snap-to-grid carousel with smooth transitions

**Why This is Phase 2:**
- Requires Favorites to be populated first (via Discover Venues)
- Needs category tagging on Favorites (restaurant vs bar vs activity)
- More complex UX than simple list editing
- Nice-to-have, not critical for MVP

**Implementation Notes:**
- Build on top of existing Favorites system
- Use existing venue categories from Google Places
- Carousel library: Swiper.js or Embla Carousel
- Mobile-friendly: Touch gestures + button fallbacks

**Tasks:**
1. Add category classification to Favorites (use venue type)
2. Build slot-based itinerary editor component
3. Implement horizontal scrolling/swiping per slot
4. Add dynamic slot management (add/remove)
5. Filter Favorites by category for each slot
6. Save itinerary changes

**Related Files:**
- New: `client/src/components/SlotBasedItineraryBuilder.tsx`
- Modify: `client/src/components/ItineraryEditor.tsx`
- Backend: No changes needed (uses existing Favorites)

**Impact:**
- **Fine-grained control:** Mix-and-match from Favorites without regenerating
- **Faster editing:** "I like dinner but not the bar" → just swap the bar
- **Flexibility:** Add/remove event segments dynamically
- **Reduced AI dependency:** Users curate their own perfect combo

---

### Refine User Flow & Navigation
**Priority:** 🟡 Medium
**Status:** Not started
**Date Added:** 2025-11-13

**What:**
Improve the overall user experience and make navigation more intuitive throughout the app.

**Tasks:**
1. **Navigation Analysis**
   - Map out current user flows for key tasks (create group, schedule event, RSVP, etc.)
   - Identify pain points and confusing transitions
   - Gather user feedback on navigation difficulties

2. **Simplify Key Flows**
   - Streamline group creation process
   - Make event scheduling more intuitive
   - Simplify RSVP and feedback submission
   - Reduce number of clicks to complete common tasks

3. **Improve Information Architecture**
   - Reorganize menu structure
   - Add breadcrumbs or clear navigation indicators
   - Better back button behavior
   - Consistent navigation patterns across pages

4. **Add Onboarding/Tutorials**
   - First-time user walkthrough
   - Contextual help/tooltips for complex features
   - Quick start guide for organizers

**Related files:**
- `client/src/pages/*` (all page components)
- Navigation components
- Routing configuration

**Impact:**
Users will find it easier to accomplish tasks and understand how to use the app effectively.

---

### Update Design & Theme
**Priority:** 🟡 Medium
**Status:** Not started
**Date Added:** 2025-11-13

**What:**
Refresh the visual design and create a more distinctive brand identity. Current design resembles StubHub - needs its own personality.

**Tasks:**
1. **Design System Audit**
   - Document current colors, typography, spacing
   - Identify inconsistencies in design application
   - Review component library usage

2. **Create New Design Direction**
   - Define brand personality (fun, social, organized, etc.)
   - Select new color palette that reflects group hangout/social planning
   - Choose typography that's friendly but readable
   - Design new logo/icon system

3. **Component Redesign**
   - Redesign card components (events, groups, activities)
   - Update button styles and interactions
   - Refresh form inputs and controls
   - Modernize navigation and header

4. **Implement Design System**
   - Set up design tokens (colors, spacing, typography)
   - Update Tailwind config or CSS variables
   - Apply new design across all pages systematically
   - Ensure consistency and accessibility

5. **Add Personality**
   - Custom illustrations for empty states
   - Animations and micro-interactions
   - Unique visual elements (not generic bootstrap/material)
   - Fun loading states and transitions

**Related files:**
- `client/src/index.css` (global styles)
- `tailwind.config.js` (if using Tailwind)
- All component files in `client/src/components/*`
- All page files in `client/src/pages/*`

**Impact:**
App will have a distinct, memorable identity that better reflects the social and fun nature of group planning.

---

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

### 🤖 AI Orchestration & Quality System
**Priority:** 🟢 Low (Strategic Future Enhancement)
**Status:** Planning phase - Not yet approved for implementation
**Date Added:** 2025-11-14
**Estimated Time:** 12-16 hours total across 4 phases
**Cost Impact:** 💰 Minimal - mostly leverages existing AI calls

**Vision:**
Add an AI orchestration layer that bridges the gap between individual components, reducing organizer workload and ensuring quality before execution.

**Current Problem:**
Individual components (swipe system, confidence scoring, feedback loops, auto-scheduler) operate in silos:
- **Swipe system exists** but barely used (not wired to confidence scoring)
- **Venues get wasted** - 3 options generated, 2 thrown away (6-10 venues lost)
- **Member input doesn't flow back** consistently to improve future suggestions
- **"Auto-schedule" still requires manual review** - not truly automated
- **Scheduling feels disjointed** from event quality
- **No proactive quality checks** - errors caught reactively after execution

**Proposed Solution:**
Create a Smart Event Coordinator that stitches components together intelligently and validates quality before execution.

---

#### Phase 1: Smart Event Coordinator Core (4-5 hours)

**Goal:** Create orchestration layer that connects existing components

**What to Build:**
- **File:** Create `server/smart-event-coordinator.ts`
- **Purpose:** Central brain that coordinates between auto-scheduler, swipe system, confidence scoring
- **Key Functions:**
  - `coordinateEventCreation()` - Main orchestrator
  - `validateEventQuality()` - Pre-flight checks before creating events
  - `suggestVsAutoApprove()` - Decide whether to auto-approve or flag for review
  - `gatherContextFromAllSources()` - Pull data from swipes, feedback, visit history

**Logic Flow:**
```
1. Auto-scheduler triggers new event
2. Coordinator gathers context:
   - Recent swipe data (what venues got right swipes?)
   - Visit history (avoid over-repeating)
   - Feedback patterns (what worked/didn't work?)
   - Member constraints (auto-learned preferences)
3. Coordinator validates quality:
   - Check venue cooldown (60-day rule)
   - Verify time slot availability
   - Confirm budget alignment
   - Validate geographic proximity
4. Coordinator calculates confidence:
   - 80%+ confidence → Auto-approve
   - 60-80% confidence → Suggest to organizer
   - <60% confidence → Flag for review with specific issues
5. Coordinator decides action:
   - Auto-approve: Create event immediately
   - Suggest: Send to organizer with AI reasoning
   - Flag: Alert organizer with specific problems to fix
```

**Integration Points:**
- `server/auto-scheduler.ts` - Call coordinator instead of direct event creation
- `server/confidence-scoring.ts` - Coordinator uses confidence scores
- `server/swipe-consensus.ts` - Coordinator checks recent swipe patterns
- `server/member-learning.ts` - Coordinator respects auto-learned constraints

**Impact:**
- Events validated before creation (fewer errors)
- Confidence scores actually used for decision-making
- Organizers only see high-quality suggestions
- System self-improves by learning from all data sources

---

#### Phase 2: Wire Swipe System to Confidence Loop (3-4 hours)

**Goal:** Make swipe data flow into confidence scoring and event validation

**Current State:**
- ✅ Swipe sessions exist (`swipeSessions`, `activitySwipes` tables)
- ✅ Swipe UI works (`client/src/components/SwipeSession.tsx`)
- ❌ Swipe data NOT used in confidence calculations
- ❌ Swipe data NOT used in auto-scheduler venue selection

**What to Build:**
- **Enhance:** `server/confidence-scoring.ts`
  - Add swipe consensus factor to confidence calculation
  - Weight: Venues with 70%+ right swipes get +20 confidence boost
  - Weight: Venues with <40% right swipes get -30 confidence penalty
- **Enhance:** `server/auto-scheduler.ts`
  - Check swipe data when selecting venues
  - Prioritize venues with high swipe consensus
  - Exclude venues with low swipe consensus (<30%)
- **Create:** `server/swipe-analytics.ts`
  - `getRecentSwipeConsensus(groupId, venueId)` → Returns % right swipes
  - `getSwipeTrends(groupId)` → What categories are trending?
  - `getMemberSwipeAlignment(memberId)` → Does member align with group?

**Integration:**
```
Before: Auto-scheduler → Generates options (no swipe data)
After:  Auto-scheduler → Checks swipe consensus → Prioritizes high-consensus venues
```

**Impact:**
- Member input (swipes) directly influences event quality
- Confidence scores reflect democratic preferences
- Reduces organizer burden (group has already "pre-approved" venues via swipes)

---

#### Phase 3: Progressive Trust System (2-3 hours)

**Goal:** Groups graduate from "suggest mode" to "auto mode" based on track record

**Current State:**
- Groups have `autoScheduleEnabled` flag (binary on/off)
- No concept of "trust level" or gradual automation

**What to Build:**
- **Schema:** Add `trustLevel` field to groups table
  - Values: 0 (manual), 1 (suggest), 2 (auto-low), 3 (auto-high)
- **File:** Create `server/trust-manager.ts`
  - `calculateTrustLevel(groupId)` → Returns 0-3 based on:
    - Event success rate (% events that had good attendance)
    - Feedback quality (avg post-event ratings)
    - RSVP consistency (% members who follow through)
    - Feedback loop health (% events that get feedback)
  - `upgradeTrustLevel(groupId)` → Promote after 5 successful events
  - `downgradeTrustLevel(groupId)` → Demote after 3 failed events
- **Integration:** `server/smart-event-coordinator.ts`
  - Trust Level 0 (Manual): All events need organizer approval
  - Trust Level 1 (Suggest): AI suggests, organizer approves
  - Trust Level 2 (Auto-Low): Auto-approve if confidence ≥75%
  - Trust Level 3 (Auto-High): Auto-approve if confidence ≥60%

**Impact:**
- New groups start conservative (suggest mode)
- Proven groups unlock full automation (auto mode)
- Self-correcting: Poor outcomes → downgrade trust → more oversight
- Organizer workload decreases as group proves itself

---

#### Phase 4: Unified Preference Orchestrator (Optional, 3-4 hours)

**Goal:** Single source of truth for all preference data (swipes + feedback + constraints)

**Current State:**
- Preferences scattered across multiple tables:
  - `memberConstraints` (budgets, locations)
  - `activitySwipes` (swipe history)
  - `feedback` (post-event ratings)
  - `rejectedVenues` (blacklist)
- No unified view of "what does this group actually want?"

**What to Build:**
- **File:** Create `server/unified-preferences.ts`
- **Function:** `getUnifiedPreferences(groupId)`
  - Returns comprehensive preference profile:
    - Favorite venue types (based on swipes + feedback)
    - Budget sweet spot (based on constraints + event success)
    - Preferred times (based on RSVP patterns)
    - Geographic preferences (based on attendance rates)
    - Variety preferences (adventurous vs safe)
- **Function:** `updatePreferencesFromEvent(eventId)`
  - After each event, update unified preference profile
  - Learn: "This group loves breweries" (80% positive feedback)
  - Learn: "This group hates long distances" (low attendance for far venues)
- **Integration:** All AI systems query unified preferences instead of scattered data

**Impact:**
- AI has complete picture of group preferences
- No contradictory data (swipes say yes, constraints say no)
- Single place to update when preferences change
- Better AI suggestions from richer context

---

#### AI Quality Validation System (Future Enhancement)

**Goal:** Use AI to validate logic quality before executing actions

**Concept:**
Before executing high-impact actions (creating events, sending invites, updating preferences), ask AI to validate:
- "Does this event make sense given recent group history?"
- "Are these venues logically compatible (geography, timing, budget)?"
- "Is this time slot reasonable given member availability?"
- "Should we really auto-approve this 65% confidence event?"

**Implementation Ideas:**
- **Pre-flight validation:** `validateWithAI(action, context) → { approved: boolean, concerns: string[] }`
- **Example check:** Before creating 3 events in one week, AI validates: "Group is weekly, creating 3 events violates cadence - flag for review"
- **Example check:** Before sending invite, AI validates: "2 venues are 15 miles apart, flagging for organizer review"
- **Cost:** ~$0.01 per validation (only for high-impact actions)
- **Benefit:** Catch edge cases that rule-based logic misses

**Use Cases:**
1. Validate auto-scheduler suggestions before creating events
2. Check itinerary quality before sending invites
3. Verify member constraint updates make sense
4. Flag unusual patterns (sudden change in preferences)
5. Detect data quality issues (duplicate venues, missing info)

**Integration:**
- Add validation step in `server/smart-event-coordinator.ts`
- Optional feature (can be disabled to save costs)
- Only runs for "uncertain" cases (60-75% confidence range)

---

**Related Files:**
- Create: `server/smart-event-coordinator.ts` (Phase 1)
- Create: `server/swipe-analytics.ts` (Phase 2)
- Create: `server/trust-manager.ts` (Phase 3)
- Create: `server/unified-preferences.ts` (Phase 4)
- Enhance: `server/auto-scheduler.ts` (integration)
- Enhance: `server/confidence-scoring.ts` (swipe integration)
- Update: `shared/schema.ts` (add trustLevel field)

**Decision Points:**
1. Should members also swipe on auto-generated options, or just organizer?
   - **Recommend:** Members swipe (democratic), requires consensus logic
2. What if AI suggests 5 events from approved venues?
   - **Recommend:** Cap at 2-3 events max, respect meeting frequency
3. How long should swipe sessions stay active?
   - **Recommend:** 48 hours, then auto-expire
4. Should we show "unsaved changes" warning mid-swipe?
   - **Recommend:** Auto-save swipes as they go (no warning needed)

**Testing Checklist:**
- [ ] Phase 1: Coordinator creates events with quality validation
- [ ] Phase 1: Confidence thresholds work (80%+ auto, 60-80% suggest, <60% flag)
- [ ] Phase 2: Swipe data flows into confidence calculation
- [ ] Phase 2: High-consensus venues prioritized in auto-scheduler
- [ ] Phase 3: Trust levels upgrade after successful events
- [ ] Phase 3: Trust levels downgrade after failed events
- [ ] Phase 4: Unified preferences aggregate all data sources
- [ ] Phase 4: Preferences update after each event
- [ ] Integration: All components talk to coordinator
- [ ] Edge cases: No swipe data, conflicting preferences, new groups

**Success Criteria:**
After implementation:
1. ✅ Organizer workload reduced by 60%+ (fewer manual approvals)
2. ✅ Event quality improves (higher post-event ratings)
3. ✅ Member input flows consistently (swipes → confidence → events)
4. ✅ Scheduling feels coherent (not disjointed components)
5. ✅ AI self-improves (learns from feedback loops)
6. ✅ Progressive automation (new groups start supervised, proven groups run autonomously)

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

### Venue Visit History & Fair Rotation System (2025-11-12)
**Completed:** 2025-11-12
**Commit:** df26188

**What was done:**
1. ✅ Added `venueVisitHistory` table to track all venue visits per group
2. ✅ Implemented venue rotation logic to prevent over-visiting same venues
3. ✅ AI now considers visit frequency when suggesting activities
4. ✅ Tracks denormalized venue data (name, type) for deleted venues
5. ✅ Links visits to activities, voting events, and itineraries

**Implementation:**
- New table: `venueVisitHistory` in `shared/schema.ts:403-415`
- Visit tracking: `server/auto-scheduler.ts` (getVenueVisitStats function)
- Integration with AI activity selection
- Cascade deletes when groups are removed

**Impact:**
Groups will now see better variety in venue suggestions. AI ensures fair rotation and prevents suggesting recently visited venues.

---

### Volunteer to Host Functionality (2025-11-12)
**Completed:** 2025-11-12
**Commit:** df26188

**What was done:**
1. ✅ Members can volunteer to host events for their group
2. ✅ Hosting rotation system tracks who has hosted
3. ✅ Integration with itinerary planning flow
4. ✅ Host information displayed on event invites

**Implementation:**
- Endpoint: POST `/api/itineraries/:id/volunteer-host` in `server/routes.ts:2015`
- Function: `storage.volunteerToHost()` in `server/storage.ts`
- Auto-assignment when member volunteers during scheduling
- UI integration in `client/src/pages/group-detail.tsx`

**Impact:**
Members can now take ownership of hosting events, making groups more democratic and reducing organizer burden.

---

### Virtual Event Placeholders (2025-11-11)
**Completed:** 2025-11-11
**Commit:** e6e671f

**What was done:**
1. ✅ Dashboard shows placeholder "virtual events" for recurring groups
2. ✅ Calculates and displays next 2 future event dates based on meeting frequency
3. ✅ Prevents duplicate virtual events when real events exist
4. ✅ Visual indicators help users anticipate upcoming events
5. ✅ Only shown for groups with `autoScheduleEnabled = true`

**Implementation:**
- Logic: `server/routes.ts:988-1044` (dashboard endpoint)
- Calculation: `server/auto-scheduler.ts` (calculateFutureEventDates function)
- Frontend: `client/src/pages/dashboard.tsx` (virtual event rendering)
- Special status: `status: 'virtual'` to distinguish from real events

**Impact:**
Users can now see their recurring group schedule at a glance. Reduces uncertainty about when next events will occur.

---

### Enhanced AI Time Suggestions (2025-11-12)
**Completed:** 2025-11-12
**Commit:** 9574be6

**What was done:**
1. ✅ AI considers existing scheduled events when suggesting times
2. ✅ Calculates availability density to avoid over-scheduling
3. ✅ Prevents proposing events too close to recent events
4. ✅ Smarter scheduling for high-cadence groups (weekly/biweekly)
5. ✅ New utility functions for density and time period analysis

**Implementation:**
- Enhanced: `server/ai-time-picker.ts:suggestOptimalTime()` now accepts densityScores and existingEvents
- New functions in `server/availability-utils.ts`:
  - `calculateDayDensity()` - Measures how busy each day is
  - `inferTimePeriod()` - Determines morning/afternoon/evening
- Auto-scheduler: `server/auto-scheduler.ts:shouldTriggerAutoSchedule()` now async and checks for existing events
- Storage methods: `hasExistingProposedEvents()`, `getUserUpcomingEventsWithTimeSlots()`

**Impact:**
Groups won't get bombarded with too many event proposals. AI now spaces events intelligently and respects existing commitments.

---

### Port Management Improvements (2025-11-12)
**Completed:** 2025-11-12
**Commit:** 6540b24

**What was done:**
1. ✅ Server automatically finds available ports if preferred port is in use
2. ✅ Fallback mechanism tries next available port
3. ✅ Reduces startup errors on Replit and other shared environments

**Implementation:**
- Logic: `server/index.ts` (findAvailablePort function)
- Automatic port detection and assignment
- Better error handling for port conflicts

**Impact:**
Server starts reliably even when default ports are occupied. Improves development experience on Replit.

---

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

*Last updated: 2025-11-14 - Added AI orchestration & quality system documentation (planning phase)*
