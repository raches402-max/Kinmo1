# Event Creation Simplification Plan

## Problem Statement

The current `UnifiedEventCreationModal` presents 4 options that appear as equal choices:
1. Quick AI Plan
2. Build Custom
3. From Favorites
4. (Discovery redirect when no favorites)

This creates confusion because:
- "From Favorites" is really just a shortcut into manual creation with a pre-filter
- If user has no favorites, clicking it opens discovery (not event creation at all)
- Venue discovery and event creation are conceptually different but get blurred here

## New Mental Model

```
┌─────────────────────────────────────────────────────────┐
│                    VENUE MANAGEMENT                      │
│  (Discover → Swipe → Build your Favorites library)      │
│  Separate flow, accessed via "Discover Venues" button   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ feeds into (but not required)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    EVENT CREATION                        │
│           Two clear paths: Manual or AI                 │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed UI Flow

### Step 1: Path Selection Modal

```
┌────────────────────────────────────────┐
│   How do you want to plan?             │
│                                        │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ 🔨 Manual    │  │   🤖 AI      │   │
│  │  (default)   │  │              │   │
│  │              │  │              │   │
│  │  You pick    │  │  AI picks    │   │
│  │  everything  │  │  venue+time  │   │
│  │  2-3 min     │  │  30 seconds  │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

- **Manual is default** (left position, pre-selected)
- **AI is secondary** (right position)
- Clean, simple choice

---

### Step 2a: Manual Path → Venue Selection

```
┌────────────────────────────────────────┐
│  Select Venues                    [X]  │
│                                        │
│  ┌────────┬────────────┬─────────┐    │
│  │ Search │ Favorites  │ History │    │
│  └────────┴────────────┴─────────┘    │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ 🔍 Search for any venue...      │  │
│  └─────────────────────────────────┘  │
│                                        │
│  [venue grid / list here]              │
│                                        │
│  ────────────────────────────────────  │
│  Selected: 2 venues      [Continue →]  │
└────────────────────────────────────────┘
```

**Tabs:**
- **Search** (default) - Look up any venue, even if not in favorites
- **Favorites** - Quick access to group's saved venues
- **History** - Venues used in past events

**Key behaviors:**
- Search is first-class - users can find any venue without adding to favorites
- Can mix sources (search for one, pick another from favorites)
- Selection persists across tab switches
- "Continue" leads to date/time selection

---

### Step 2b: AI Path → Signal Check

```
Click "🤖 AI"
       │
       ▼
┌─ Has enough signal? ─────────────────────────────────────┐
│                                                          │
│  YES ──────────────────────────────────────────────────► │
│       Proceed directly to AI scheduling                  │
│       (date/time selection, AI generates itinerary)      │
│                                                          │
│  NO ───────────────────────────────────────────────────► │
│       Show guided setup (see below)                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### What defines "enough signal"?

AI needs enough information to make good venue picks. Check for:

| Signal | Required? | How to check |
|--------|-----------|--------------|
| Group location set | Yes | `group.location` exists |
| At least 1 activity category | Yes | `group.activityTypes.length > 0` |
| Budget range set | No (has default) | `group.budgetMin/Max` exists |
| Swipe history OR favorites | Yes | `votingEvents.length >= 5` OR swipe count >= 10 |
| Member availability | No (nice to have) | Any member has availability set |

**Minimum requirements:**
- Location + categories + (favorites OR swipe history)

---

### Step 2b (continued): Guided Setup Flow

When AI prerequisites aren't met:

```
┌────────────────────────────────────────┐
│  Let's help AI understand your group   │
│                                        │
│  AI needs a bit more information to    │
│  pick great venues for you.            │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 📍 Location                      │ │
│  │    [Set group location]     [✓]  │ │
│  ├──────────────────────────────────┤ │
│  │ 🎯 Activities                    │ │
│  │    [Pick what you like]     [✓]  │ │
│  ├──────────────────────────────────┤ │
│  │ 💡 Preferences                   │ │
│  │    [Quick swipe: 5 venues]  [ ]  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [Complete Setup →]                    │
└────────────────────────────────────────┘
```

**Flow:**
1. Show checklist of what's needed
2. Completed items show checkmark
3. Clicking incomplete item opens inline form or swipe session
4. "Quick swipe" = mini swipe session (5-10 venues)
5. Once all required items complete → "AI is ready!" → proceed to scheduling

**Quick swipe session:**
```
┌────────────────────────────────────────┐
│  Quick preferences (5 of 10)           │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │                                  │ │
│  │         [Venue Card]             │ │
│  │                                  │ │
│  │    Restaurant Name               │ │
│  │    ⭐ 4.5 · $$ · Italian         │ │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                        │
│      👎 Skip          Like 👍         │
│                                        │
│  ──────────────────────────────────── │
│  [Skip for now - use Manual instead]   │
└────────────────────────────────────────┘
```

- Swipe through 5-10 AI-suggested venues
- Each swipe teaches AI preferences
- Can bail out to Manual path anytime
- After completion: "Great! AI is ready to help plan your event"

---

## Component Changes Required

### 1. `UnifiedEventCreationModal.tsx`
**Current:** 4-option grid with Quick AI, Build Custom, From Favorites, (Discovery redirect)
**New:** 2-option selector (Manual default, AI secondary)

Changes:
- Remove "From Favorites" as separate option
- Remove discovery redirect logic
- Simplify to binary choice
- Add AI signal check before proceeding

### 2. New: `VenueSelectionPanel.tsx` (or modify existing)
**Purpose:** Tabbed venue picker for Manual path

Features:
- Three tabs: Search, Favorites, History
- Search as default/first tab
- Unified selection state across tabs
- "Continue" button with selection count

### 3. New: `AISetupWizard.tsx`
**Purpose:** Guided setup when AI prerequisites not met

Features:
- Checklist UI showing what's needed
- Inline forms for location/categories
- Embedded mini swipe session
- Progress tracking
- "Skip to Manual" escape hatch

### 4. `SwipeSession.tsx` (modify)
**Current:** Full swipe experience
**New:** Support "mini" mode for quick 5-10 venue session

Add prop: `mode?: 'full' | 'quick'`
- Quick mode: Limited venue count, simplified UI, "done" callback

### 5. Signal check utility
**New:** `lib/aiReadinessCheck.ts`

```typescript
interface AIReadiness {
  ready: boolean;
  missing: ('location' | 'categories' | 'preferences')[];
  message: string;
}

function checkAIReadiness(group: Group): AIReadiness {
  // Check location, categories, swipe/favorites count
}
```

---

## Migration Path

### Phase 1: Simplify modal (low risk) ✅ COMPLETED
- Update `UnifiedEventCreationModal` to 2 options
- "From Favorites" → becomes Favorites tab in Manual flow
- AI path checks readiness, falls back to current behavior if not ready

### Phase 2: Add guided setup (medium effort) ✅ COMPLETED
- Built `AISetupWizard` component with checklist UI
- Created `MiniSwipeSession` for quick preference gathering
- Created `aiReadinessCheck` utility for consistent readiness checks
- Connected AI path to wizard when prerequisites not met

### Phase 3: Polish & iterate
- Refine "enough signal" thresholds based on usage
- Add analytics to track path selection
- A/B test guided setup vs. disabled state

---

## Open Questions

1. **What's the minimum swipe count for "enough signal"?**
   - Suggestion: 10 swipes OR 5 favorites

2. **Should History tab show venues from ALL past events or just successful ones?**
   - Suggestion: All events, but highlight "worked well" venues

3. **Can users skip the guided setup and still use AI?**
   - Suggestion: Yes, with warning "Results may not match your preferences"

4. **Should we show AI confidence level?**
   - e.g., "AI is 80% confident it understands your group"
   - Might be overkill for v1

---

## Success Metrics

- **Reduced drop-off** at event creation modal
- **Increased AI path usage** (currently underused due to prerequisites)
- **Faster time to first event** for new groups
- **User feedback:** "Easier to understand" in surveys
