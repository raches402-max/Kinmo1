# Discover Venues + Smart Schedule Now from Favorites

**Status:** ✅ Phase 1 & 2 COMPLETE - Phase 3 Testing Recommended
**Priority:** 🟡 Medium (Testing)
**Created:** 2025-11-14
**Last Updated:** 2025-11-24

---

## Vision

Let users swipe to discover and curate Favorites anytime. Then Schedule Now intelligently pulls from Favorites to create high-quality itineraries with venues the group already loves.

---

## Current Problem

- Schedule Now generates 3 completely new options each time
- Picks 1 option, wastes the other 2 (6-10 venues lost)
- No ongoing curation - starts from scratch every time
- Can't build a trusted pool of venues over time
- Group has no control over what gets suggested

---

## New Approach

1. **Discover Venues** → Swipe anytime to build Favorites list
2. **Schedule Now** → AI prioritizes Favorites, creates 1 smart itinerary
3. **Fill gaps** → AI adds suggestions only if Favorites is empty/insufficient
4. **Fallback** → If Favorites is empty, use current 3-option flow

---

## Phase 1: Add "Discover Venues" Swipe Feature ✅ COMPLETE

**Goal:** Let users swipe anytime to build Favorites list

### 1.1 Add "Discover Venues" button ✅ COMPLETE
- **Location:** Group detail page, near Favorites tab
- **UI:** Button with "🔍 Discover Venues" text
- **Access:** Any member can discover (not just organizer)
- **Action:** Opens swipe session with ~20 venue suggestions

### 1.2 Backend: Create discovery endpoint ✅ COMPLETE
- **File:** `server/routes.ts`
- **Endpoint:** `POST /api/groups/:groupId/discover-venues`
- **Logic:**
  - Generate 20 venues based on group preferences
  - Mix of categories (restaurants, bars, cafes, activities)
  - Exclude: already in Favorites, recently rejected
  - Create swipe session with `sessionType: 'activity_curation'`
  - Return session ID + venue deck

### 1.3 Wire swipe actions to Favorites ✅ COMPLETE
- **Right swipe:** Add venue to Favorites (voting_events table)
- **Left swipe:** Mark as seen (don't show again in future discovery)
- **After session:** Show "Added 8 venues to Favorites!" with link to Favorites tab

**Phase 1 Status:** ✅ COMPLETE (2025-11-18)

---

## Phase 2: Make Schedule Now Use Favorites (3-4 hours)

**Goal:** Schedule Now prioritizes Favorites and creates 1 smart itinerary

### 2.1 Modify auto-scheduler logic
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

### 2.2 Use existing visit history
- **Table:** `venueVisitHistory` (already implemented!)
- **Cooldown:** 60 days for all venue types
- **Benefit:** Ensures variety and rotation through Favorites

### 2.3 Show 1 itinerary (not 3 options)
- Remove multi-option generation when using Favorites
- Display: "Created from your Favorites" with AI reasoning
- Show badges on each venue:
  - "⭐ From Favorites" (group already loves this)
  - "✨ AI Suggestion" (new venue to try)
- **Transparency:** Users see what's trusted vs experimental

### 2.4 Add "Try Again" button
- If organizer doesn't like the generated itinerary
- Regenerates different combination from Favorites
- After 2-3 tries, offer: "See AI options instead?" (fall back to 3-option flow)

---

## Phase 3: Testing & Polish (1 hour)

### 3.1 Empty Favorites handling
- Show prompt: "Your Favorites is empty. Discover venues first?"
- **Button A:** "Discover Venues" → launch swipe session
- **Button B:** "Skip" → fall back to current 3-option flow

### 3.2 Edge cases
- All Favorites visited recently → use AI suggestions instead
- Only 1 Favorite → add AI-generated venues to round out itinerary
- Favorites has no variety (all restaurants) → AI adds activities/dessert
- Favorites too large (50+ venues) → prioritize by upvotes + recency

### 3.3 End-to-end testing
- Discover flow: Swipe → venues added to Favorites
- Schedule Now: Uses Favorites → creates good itinerary
- Visit tracking: Recently visited venues excluded correctly
- Quality ranking: Most-upvoted Favorites prioritized
- Fallback: Empty Favorites → 3-option flow

---

## Related Files

- `server/routes.ts` (new discover-venues endpoint)
- `server/auto-scheduler.ts` (modify selectBestItineraryForAutoSchedule)
- `server/swipe-session-manager.ts` (might already support discovery)
- `client/src/pages/group-detail.tsx` (add Discover Venues button)
- `client/src/components/ItineraryOptions.tsx` (modify to show 1 result from Favorites)
- `client/src/components/SwipeSession.tsx` (existing swipe UI - reuse)
- `shared/schema.ts` (no changes - uses existing tables)

---

## Database

✅ No schema changes needed! Uses existing tables:
- `voting_events` (Favorites)
- `swipeSessions` (discovery sessions)
- `activitySwipes` (swipe records)
- `venueVisitHistory` (visit tracking)

---

## Impact

- **Democratic curation:** Whole group builds Favorites together
- **Trusted venues:** Schedule Now uses group-vetted venues
- **No waste:** Every swiped venue goes to Favorites (reusable)
- **Less decision fatigue:** 1 smart itinerary vs 3 options
- **Better rotation:** Visit history prevents repetition
- **Quality signals:** Upvotes + ratings guide AI

---

## Success Criteria

After implementation:
1. ✅ Members can discover venues anytime (democratic curation)
2. ✅ Favorites list grows organically with group input
3. ✅ Schedule Now prioritizes group-loved venues
4. ✅ Visit history ensures variety (60-day cooldown)
5. ✅ 1 smart itinerary reduces decision paralysis
6. ✅ Graceful fallback when Favorites is empty

---

## Implementation Checklist

**Phase 1: Discover Venues**
- [x] 1.1: Add "Discover Venues" button to group page
- [x] 1.2: Create discovery endpoint (POST /api/groups/:id/discover-venues)
- [x] 1.3: Wire swipe actions to Favorites (right = add, left = skip)

**Phase 2: Schedule Now Integration** ✅ COMPLETE
- [x] 2.1: Modify auto-scheduler to check Favorites first
- [x] 2.2: Implement venue filtering (visit history, quality ranking)
- [x] 2.3: Update UI to show 1 itinerary with source badges
- [x] 2.4: Hybrid mode when 1-2 Favorites (gap-fillers)
- [x] 2.5: Fallback to 3-option mode when 0 Favorites

**Phase 3: Testing & Edge Cases** (Recommended)
- [ ] 3.1: End-to-end test with real group data
- [ ] 3.2: Verify badges display correctly in UI
- [ ] 3.3: Test edge cases (empty Favorites, all visited, etc.)

---

*Document created: 2025-11-23*
*For TODO.md link reference only - detailed specs kept here*
