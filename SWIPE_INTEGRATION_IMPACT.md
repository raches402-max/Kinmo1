# Swipe Integration - Impact on Existing Flows

## Overview
This document explains how adding swipe-based multi-option selection will change the existing "Schedule Now" flow, including non-obvious impacts you should be aware of.

---

## Current Flow (What Users Do Now)

### Step-by-Step
1. User clicks "Schedule Now" button on group page
2. Backend generates 3 itinerary options (each with 3-5 venues)
3. Frontend shows 3 cards side-by-side
4. User selects ONE option (or members vote on one)
5. Selected option becomes a draft itinerary
6. **The other 2 options are discarded** ❌

### What Happens to Data
- **Kept:** 1 option (3-5 venues) → becomes itinerary
- **Lost forever:** 2 options (6-10 venues) → deleted
- **No saving:** Can't save good venues for later

---

## New Flow (After Swipe Integration)

### Step-by-Step
1. User clicks "Schedule Now" button on group page
2. Backend generates 3 itinerary options (each with 3-5 venues)
3. **NEW:** Backend flattens all venues into swipe deck (~9-15 cards)
4. **NEW:** User swipes through each venue individually:
   - Swipe right: "I want this in our event"
   - Swipe left: "Skip this one"
   - Save button: "Good idea, but save for later"
5. **NEW:** After all swipes, AI analyzes approved venues and suggests groupings
6. **NEW:** Confirmation screen shows: "You approved 6 venues. AI suggests 2 events:"
   - Event 1: Dinner + Dessert on Nov 20
   - Event 2: Bar + Activity on Nov 27
7. User confirms or adjusts the groupings
8. System creates itinerary/itineraries based on approval

### What Happens to Data
- **Kept:** All approved venues → become itineraries
- **Saved for later:** All "save" swipes → added to Favorites
- **Rejected:** Left swipes → discarded
- **Nothing wasted:** Good venues are either scheduled or saved

---

## Key Changes to Existing Behaviors

### 1. **The 3 Options Are No Longer Visible as Cards** 🔄
**Before:** User sees 3 distinct options and picks one.
**After:** User sees individual venues and approves/rejects each.

**Impact:**
- User can't compare "Option 1 vs Option 2" side-by-side anymore
- **Benefit:** User gets more granular control (venue-by-venue decisions)
- **Trade-off:** Slightly more work (15 swipes vs 1 click)

---

### 2. **Multiple Itineraries Can Be Created** 🆕
**Before:** Only ONE itinerary is created per "Schedule Now" click.
**After:** AI can suggest creating MULTIPLE itineraries from approved venues.

**Example Scenario:**
- User approves: Dinner, Dessert, Bar, Activity, Coffee
- AI clusters:
  - Itinerary 1 (Nov 20): Dinner → Dessert → Bar
  - Itinerary 2 (Nov 27): Activity → Coffee

**Impact:**
- Group calendar now shows 2 events instead of 1
- Members get invited to 2 separate events
- **Benefit:** More efficient use of approved venues
- **Potential confusion:** "I clicked Schedule Now once, why do I have 2 events?"
  - **Solution:** Confirmation screen clearly explains the AI's suggestion

---

### 3. **"Save for Later" Venues Go to Favorites** 🆕
**Before:** No way to save venues from options for future use.
**After:** Saved venues automatically added to group's Favorites (voting_events table).

**Database Impact:**
- New rows in `voting_events` table (one per saved venue)
- These venues now appear in Favorites tab
- Group members can upvote/downvote them later

**Potential Issue:**
- Favorites tab could get cluttered if users save 10+ venues per swipe session
- **Solution:** Add a "From Swipe Session" tag to track origin

---

### 4. **The ItineraryOptions Component Will Be Replaced** 🔄
**Before:** `ItineraryOptions.tsx` component shows 3 cards.
**After:** Component replaced entirely with `SwipeSession.tsx`.

**Frontend Impact:**
- Any page that imports `ItineraryOptions` needs to be updated
- CSS/styling for 3-card layout is no longer needed
- **Files affected:**
  - `client/src/pages/group-detail.tsx` (main import)
  - `client/src/components/ItineraryOptions.tsx` (replaced)

---

### 5. **Swipe Sessions Are Created for Schedule Now** 🆕
**Before:** Swipe sessions only used during group creation onboarding.
**After:** New swipe session created every time user clicks "Schedule Now".

**Database Impact:**
- More rows in `swipeSessions` table
- More rows in `activitySwipes` table (one per swipe action)
- **Storage consideration:** If 100 users Schedule Now per day with 15 swipes each = 1,500 rows/day

**Session Lifecycle:**
- Created when user clicks "Schedule Now"
- Active during swiping
- Completed when user confirms groupings
- **Expired:** if user abandons (leaves page) → cleanup needed

---

### 6. **AI Validation Runs on Approved Venues (Not Options)** 🔄
**Before:** AI validates each of the 3 options separately (already implemented).
**After:** AI validates only the APPROVED venues from swiping.

**What Changes:**
- AI validation happens AFTER swipe finalization (not before swipes)
- AI gets a custom set of venues (based on user approvals) instead of pre-generated options
- **Cost:** Still ~$0.01 per validation call, but might run multiple times if AI suggests multiple events

---

### 7. **User Can Approve 0 Venues (Edge Case)** ⚠️
**Before:** User must select 1 of 3 options (forced choice).
**After:** User could theoretically reject all venues.

**Handling:**
- Frontend shows warning: "You haven't approved any venues. Schedule Now requires at least 1 approval."
- Backend validates: `if (approvedVenues.length === 0) return 400 error`
- **User experience:** More freedom, but needs guardrails

---

### 8. **Deduplication Logic Required** 🆕
**Before:** Each option is independent (venues don't overlap).
**After:** Same venue could appear in multiple options.

**Example:**
- Option 1: [Venue A, Venue B, Venue C]
- Option 2: [Venue A, Venue D, Venue E]
- Option 3: [Venue A, Venue F, Venue G]
- **Venue A appears 3 times!**

**Solution:**
- Backend deduplicates before creating swipe deck
- Show badge on card: "In 3 options" → signals high AI confidence
- **Benefit:** Users know which venues AI strongly recommends

---

### 9. **Analytics Will Change** 📊
**Before:** Track which option was selected (1, 2, or 3).
**After:** Track:
- Total swipes per session
- Approval rate (% right swipes)
- Save rate (% save actions)
- Which venues appear in multiple options (consensus)
- Clustering accuracy (did AI groupings match user intent?)

**New Metrics:**
- "Avg swipes per Schedule Now session"
- "Approval rate per venue type" (bars approved more than museums?)
- "AI clustering acceptance rate" (users confirm vs adjust?)

---

### 10. **Member Voting Is Affected** 🔄
**Before:** Members can vote for 1 of 3 options.
**After:** ??? (Not yet defined)

**Options for member participation:**
- **A)** Only organizer swipes (simpler)
- **B)** All members swipe, consensus determines approval (democratic)
- **C)** Members swipe on their own deck, organizer sees aggregated results

**Decision needed:** Which approach aligns with your vision?
- If **A**: No changes to member flow
- If **B**: Need consensus logic (50%+ right swipes = approved?)
- If **C**: Need per-member swipe session tracking

---

## Non-Obvious Downstream Impacts

### Impact 1: Notifications Change
**Before:** "Your group has 1 proposed event"
**After:** "Your group has 2 proposed events" (if AI suggests multiple)

**Email templates need updating:**
- Subject line might need to handle plural ("events" vs "event")
- Body text: "We've created X itineraries based on your approvals"

---

### Impact 2: Auto-Schedule Logic Interactions
**Current state:** Auto-scheduler creates pending events automatically.
**After swipe integration:** What happens?

**Scenario:**
- Auto-scheduler creates pending event with 3 options
- User swipes and creates 2 new itineraries
- **Question:** Does the original pending event get replaced? Merged? Deleted?

**Recommendation:** Keep auto-scheduler separate from manual "Schedule Now"
- Auto-schedule → Creates 1 itinerary (as it does now)
- Manual "Schedule Now" → Uses swipe flow

---

### Impact 3: RSVP Flow Might Get Confusing
**Scenario:**
- User swipes and creates 2 events
- Both events send RSVP invites to all members
- Members now have to RSVP to 2 events instead of 1

**Potential member confusion:**
- "Why am I getting 2 invites? I thought we schedule 1 event per week?"

**Solution:**
- Clearly indicate on confirmation screen: "This will create 2 events"
- Add explainer in RSVP email: "Your group approved venues for 2 events this month"

---

### Impact 4: Event Calendar Gets Busier
**Before:** Clicking "Schedule Now" once = 1 event on calendar.
**After:** Clicking "Schedule Now" once = potentially 2-3 events on calendar.

**User perception:**
- Might feel like "too many events scheduled at once"
- **Benefit:** More efficient use of approved venues
- **Trade-off:** Group frequency might feel higher

**Solution:**
- AI should respect group's `meetingFrequency` when suggesting dates
- If group is "weekly", don't suggest 3 events in the same week
- Space out suggested dates intelligently

---

### Impact 5: Favorites Tab Behavior Changes
**Before:** Favorites manually curated (organizer adds via "Love" button).
**After:** Favorites also includes "saved from swipe sessions".

**Favorites tab will now have:**
- Manually loved venues (existing behavior)
- Swipe-saved venues (new)

**Potential issue:** Favorites could grow quickly (10+ saved per swipe session).

**Solutions:**
- Add filtering: "Show: All | Manually Added | Saved from Swipes"
- Add bulk actions: "Remove all swipe-saved venues"
- Add metadata: `savedFrom: 'swipe_session' | 'manual'`

---

## What Stays the Same

### 1. **Event Creation Flow** ✅
Once itineraries are created (from approved venues), the rest of the flow is identical:
- Send RSVP invites
- Time slot voting
- Member responses
- Post-event feedback

### 2. **AI Activity Generation** ✅
The backend still generates 3 options using the same AI logic:
- Venue scoring
- Preference matching
- Budget constraints
- Distance filtering

**Only change:** What happens AFTER generation (swipes vs pick-one).

### 3. **Database Schema (Mostly)** ✅
Most tables are unaffected. Only additions:
- `swipeSessions` (already exists, just used more)
- `activitySwipes` (already exists, just used more)
- Optional: `swipe_action` column (new)

---

## Migration Strategy

### Phase 1: Feature Flag (Recommended)
- Add feature flag: `ENABLE_SWIPE_OPTIONS = true/false`
- Test with small group of users first
- Collect feedback before full rollout

### Phase 2: Gradual Rollout
- Week 1: 10% of users see swipe interface
- Week 2: 50% of users
- Week 3: 100% of users

### Phase 3: Remove Old Code
- After 2 weeks, if no major issues:
  - Delete old ItineraryOptions component
  - Remove feature flag
  - Archive old code

---

## Questions to Consider Before Implementation

1. **Should members also swipe, or just the organizer?**
   - Pro (members swipe): Democratic, everyone has input
   - Con (members swipe): More complex, requires consensus logic

2. **What if AI suggests 5 events from approved venues?**
   - Should we cap at 2-3 events max?
   - Or trust AI to space them out intelligently?

3. **Should "Save for Later" be a separate action or just a button variant?**
   - Current plan: Separate save button
   - Alternative: Long-press to save, swipe to approve/reject

4. **How long should swipe sessions stay active?**
   - 24 hours? 48 hours? 7 days?
   - What happens if user abandons mid-swipe?

5. **Should we show "unsaved" changes warning?**
   - If user swipes halfway and closes tab, should we warn them?
   - Or auto-save swipes as they go?

---

## Testing Checklist

Before deploying this feature, test:

### Happy Path
- [ ] Generate 3 options → flatten to swipe deck
- [ ] Swipe through all venues (mix of approve/reject/save)
- [ ] AI clustering suggests 2 events
- [ ] Confirm groupings → events created successfully
- [ ] Saved venues appear in Favorites

### Edge Cases
- [ ] Reject all venues → show error message
- [ ] Approve all venues → AI clusters intelligently
- [ ] Approve only 1 venue → create single-venue event
- [ ] Save all venues → Favorites updates correctly
- [ ] Abandon mid-swipe → session expires gracefully

### Error Handling
- [ ] AI clustering fails → fallback to single event
- [ ] Network error during swipes → retry mechanism
- [ ] Duplicate venues → deduplicated correctly
- [ ] Invalid swipe action → validation catches it

### Performance
- [ ] 15+ swipes → no lag
- [ ] Large Favorites list → pagination works
- [ ] Multiple concurrent swipe sessions → no conflicts

---

## Summary of Impacts

| Aspect | Before | After | Impact Level |
|--------|--------|-------|--------------|
| User interface | 3-card selection | Swipe deck | 🔴 High |
| Number of itineraries | Always 1 | 1-3 (AI decides) | 🟡 Medium |
| Favorites integration | Manual only | Manual + auto-saved | 🟡 Medium |
| Wasted venues | 6-10 per session | 0 (all saved or rejected) | 🟢 Low (positive) |
| Swipe sessions | Onboarding only | Every Schedule Now | 🟡 Medium |
| Database rows | ~10 per event | ~30-50 per event | 🟡 Medium |
| AI validation timing | Before user sees options | After user approves | 🟡 Medium |
| Member participation | Vote on 3 options | TBD (organizer vs members swipe?) | 🔴 High (decision needed) |

---

**Last updated:** 2025-11-14
**Status:** Planning phase - not yet implemented
