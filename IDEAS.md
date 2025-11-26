# Future Ideas & Enhancements

This file contains brainstorming ideas, future enhancements, and features that may be implemented later.

*Last Updated: 2025-11-23*

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

---

### 🤖 AI Orchestration & Quality System
**Priority:** 🟢 Low (Strategic Future Enhancement)
**Status:** Planning phase - Not yet approved for implementation
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

*Ideas document created: 2025-11-23*
*Review periodically to promote ideas to active development*
