# Explore Tab Visual Mockup

## Before vs After

### BEFORE: Activities Tab (Current - Clunky)

```
┌─────────────────────────────────────────────────────────────────┐
│  [AI Suggested]  [Search]  [Favorites]     ← 3 sub-tabs         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AI-Suggested Activities                                    ││
│  │  ───────────────────────────────────────────────────────────││
│  │  Select 1-5 venues to build your itinerary...               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ✨ AI Activity Generation                                  ││
│  │  ───────────────────────────────────────────────────────────││
│  │                                                              ││
│  │  ┌──────────────────────────┐ ┌──────┐                      ││
│  │  │ San Francisco           │ │ 10mi │   ← Location inputs   ││
│  │  └──────────────────────────┘ └──────┘                      ││
│  │                                                              ││
│  │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                   ││
│  │  │🍽️   ││☕    ││🍺    ││🍰    ││🎭    │  ← 5 toggles      ││
│  │  │Meals ││Cafes ││Drinks││Desser││Exper │                   ││
│  │  └──────┘└──────┘└──────┘└──────┘└──────┘                   ││
│  │                                                              ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ ○ Multi-venue outing                    Sorted by dist  │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  │  Perfect for bar crawls! Sorted by distance...              ││
│  │                                                              ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Refine your search... (Asian food, outdoor seating...) │││
│  │  │                                                         │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  │  [ ✨ Generate Meals ]     ← Finally, the action button     ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  (Results appear below after clicking generate...)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Problems:
- 3 sub-tabs before you can do anything
- Too many controls visible at once (9+ interactive elements!)
- Must click "Generate" to see any content
- Confusing: "Do I search? Use AI? Check favorites?"
- No clear path forward
```

---

### AFTER: Explore Tab (Proposed - Clean)

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPLORE                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🔍 Search venues or describe what you want...              ││
│  └─────────────────────────────────────────────────────────────┘│
│  📍 San Francisco • 10 mi • ⚙️    ← Subtle, expandable          │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │🍽️   │ │☕    │ │🍺    │ │🍰    │ │🎭    │   ← Quick taps   │
│  │Meals │ │Cafes │ │Drinks│ │Desser│ │ Fun  │                  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
│                                                                 │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  ❤️ YOUR FAVORITES (12)                           [View All →] │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ [photo] │ │ [photo] │ │ [photo] │ │ [photo] │  →  scroll →  │
│  │ ✓ sel  │ │ Zuni    │ │ Tosca   │ │ Burma   │               │
│  │ Kokkari │ │ Cafe    │ │ Cafe    │ │ Love    │               │
│  │ ★4.7 $$ │ │ ★4.5 $$ │ │ ★4.6 $$$│ │ ★4.4 $  │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                 │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  ✨ SUGGESTED FOR YOU                             [Refresh ↻]  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ [photo] │ │ [photo] │ │ [photo] │ │ [photo] │  →  scroll →  │
│  │ New!    │ │ Trending│ │ Hidden  │ │ Classic │               │
│  │ The Mkt │ │ Nari    │ │ La Mar  │ │ Gary D  │               │
│  │ ★4.8 $$$│ │ ★4.6 $$$│ │ ★4.5 $$$│ │ ★4.9 $$ │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Kokkari ✕                                                  ││
│  │                                                              ││
│  │  [  🎯 Plan Event with 1 Venue  ]     ← Sticky action bar   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

Benefits:
- NO sub-tabs - everything on one scrollable screen
- Content visible immediately (favorites + suggestions auto-load)
- Search when you need it, category chips for quick filter
- Tap a venue → it's selected → action bar appears
- One clear action: "Plan Event with N Venues"
- Progressive disclosure: settings hidden behind ⚙️ icon
```

---

## Interaction Flow

### Current Flow (Too Many Steps)
```
1. Land on Activities tab
2. See "AI Suggested" sub-tab (default)
3. See big control panel, no venues yet
4. Select a category (Meals)
5. Optionally: change location
6. Optionally: change radius
7. Optionally: toggle multi-venue mode
8. Optionally: type custom instructions
9. Click "Generate Meals" button
10. Wait 30-120 seconds
11. See results
12. Click venue checkboxes
13. Navigate to "Create Event" tab
14. Build itinerary there

Steps to first venue: 9-10 clicks/waits
```

### New Flow (Streamlined)
```
1. Land on Explore tab
2. See Favorites + Suggestions already loaded
3. Tap a venue to select it
4. Sticky bar appears: "Plan Event with 1 Venue"
5. Tap more venues if wanted (up to 5)
6. Tap "Plan Event" button
7. → Opens event creation modal

Steps to first venue: 1 tap to select, 1 tap to plan = 2 taps
```

---

## Mobile Experience

### Current Mobile (Cramped)
```
┌──────────────────────┐
│ [AI][Search][Faves]  │ ← Sub-tabs take up space
├──────────────────────┤
│ AI-Suggested...      │
│                      │
│ ┌──────────────────┐ │
│ │ Location input   │ │
│ └──────────────────┘ │
│ ┌──┐┌──┐┌──┐┌──┐┌──┐ │ ← Categories overflow
│ └──┘└──┘└──┘└──┘└──┘ │
│ ○ Multi-venue...     │
│                      │
│ ┌──────────────────┐ │
│ │ Custom instruct  │ │
│ │                  │ │
│ └──────────────────┘ │
│                      │
│ [ Generate Meals ]   │
│                      │
│ (No content yet...)  │
│                      │
└──────────────────────┘

Problem: All controls, no content
```

### New Mobile (Content-First)
```
┌──────────────────────┐
│ 🔍 Search...         │
│ 📍 SF • 10mi • ⚙️    │
│ 🍽️ ☕ 🍺 🍰 🎭      │ ← Scrollable chips
├──────────────────────┤
│ ❤️ FAVORITES         │
│ ┌─────┐┌─────┐┌─────┐│
│ │     ││     ││  →  ││ ← Swipe to see more
│ └─────┘└─────┘└─────┘│
│                      │
│ ✨ SUGGESTED         │
│ ┌─────┐┌─────┐┌─────┐│
│ │     ││     ││  →  ││
│ └─────┘└─────┘└─────┘│
│                      │
│                      │
├──────────────────────┤
│ Kokkari ✕            │
│ [Plan Event (1)]     │ ← Sticky bottom
└──────────────────────┘

Benefit: Content visible immediately,
action always one tap away
```

---

## Component Architecture

```
ExploreTab
├── SearchBar
│   ├── Input (unified search)
│   └── LocationBadge (subtle, expandable)
│
├── CategoryChips
│   └── Button[] (quick category filters)
│
├── FavoritesSection
│   ├── SectionHeader ("Your Favorites")
│   └── HorizontalScroll
│       └── VenueCard[] (with selection state)
│
├── SuggestionsSection
│   ├── SectionHeader ("Suggested for You")
│   └── HorizontalScroll
│       └── VenueCard[] (with selection state)
│
└── StickyActionBar (fixed bottom)
    ├── SelectedVenuesBadges
    └── PlanEventButton
```

---

## Design Tokens Used

From the existing "Warm Gathering" palette:

| Element | Token | Value |
|---------|-------|-------|
| Search bg | `--card` | Cream |
| Category default | `--muted` | Warm gray |
| Category selected | Activity color | Per category |
| Favorites accent | Rose-50 | Soft pink bg |
| Suggestions accent | Amber-50 | Warm yellow bg |
| Action button | `--primary` | Sunflower gold |
| Selection ring | `--primary` | Gold |

---

## Files Created

1. **`/docs/DESIGN-simplified-navigation.md`** - Full navigation redesign proposal
2. **`/docs/DESIGN-explore-mockup.md`** - This visual mockup document
3. **`/client/src/components/ExploreTab.tsx`** - Working React component

---

## Next Steps

1. **Review this design** - Does this feel right for the user flow?
2. **Quick wins first** - Rename Activities → Explore, remove redundant bottom nav item
3. **Swap component** - Replace current Activities tab content with ExploreTab
4. **Wire up API** - Connect to existing favorites/suggestions endpoints
5. **Test on mobile** - Ensure horizontal scrolling works smoothly

---

*Ready for your feedback!*
