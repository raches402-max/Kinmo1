# Simplified Navigation & User Flow Proposal

**Status:** Design Proposal
**Created:** 2025-11-27
**Problem:** Current tab structure is clunky with too many nested levels and confusing user flow

---

## The Core Problem

Users are getting lost in:
1. **Dashboard** → My Events / My Groups tabs
2. **Group Detail** → Home / Group / Activities / Create Event / Insights (5 tabs!)
3. **Activities** → AI Suggested / Search / Favorites (3 more sub-tabs!)
4. **AI Suggested** → Location, Radius, 5 Categories, Multi-venue toggle, Instructions, Generate button

That's potentially **4 levels deep** before a user can do anything useful.

---

## Proposed Solution: "Action-First" Design

### Philosophy
Instead of organizing by **data type** (events, groups, activities), organize by **user intent**:
- "I want to **plan something**" → One clear path
- "I want to **see what's happening**" → One clear path
- "I want to **manage my group**" → One clear path

---

## New Structure

### Level 1: Dashboard (Global Home)

```
┌─────────────────────────────────────────────────────────────────┐
│  Kinmo                                    🔔  [Avatar]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Action Required Banner - if any]                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  UPCOMING                                                   ││
│  │  ═══════════════════════════════════════════════════════════││
│  │  [Event Card] [Event Card] [Event Card]                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  YOUR GROUPS                              [+ New Group]     ││
│  │  ═══════════════════════════════════════════════════════════││
│  │  [Group] [Group] [Group]                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Changes:**
- Remove tabs entirely on Dashboard
- Show both events AND groups on the same page (scrollable)
- Events take priority (first section)
- Groups below with clear "New Group" action

---

### Level 2: Group Detail (Simplified to 3 Tabs)

**Current:** 5 tabs (Home, Group, Activities, Create Event, Insights)
**Proposed:** 3 tabs (Overview, Explore, Settings)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    🍕 Friday Dinner Club                   ⚙️  Share    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Overview   │  │   Explore    │  │   Settings   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
```

#### Tab 1: Overview (was "Home")
- Upcoming events for THIS group
- Quick actions: "Schedule Event" button
- Group stats (insights summary)
- Recent activity feed

#### Tab 2: Explore (replaces "Activities" + "Create Event")
- **Single unified experience** for discovering and planning
- See "Explore Tab Redesign" below

#### Tab 3: Settings (was "Group" + "Insights")
- Group settings
- Member management
- Your preferences
- Learning insights (collapsible section)

---

## Explore Tab Redesign (The Big Change)

### Current Problem
The Activities tab has:
- 3 sub-tabs (AI Suggested, Search, Favorites)
- Complex AI generation controls
- Confusing flow: "Do I generate first? Search? Check favorites?"

### Proposed: Single-Screen "Explore" Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPLORE                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🔍 Search or describe what you're looking for...           ││
│  │  ──────────────────────────────────────────────────────────  ││
│  │  📍 San Francisco  •  10 mi  •  ⚙️                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐            │
│  │ 🍽️   │ │ ☕    │ │ 🍺    │ │ 🍰    │ │ 🎭    │            │
│  │ Meals │ │ Cafes │ │ Drinks│ │Dessert│ │ Fun   │            │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘            │
│                                                                 │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  ❤️ YOUR FAVORITES (12)                           [View All →] │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│  │ [img]   │ │ [img]   │ │ [img]   │  →                       │
│  │ Kokkari │ │ Zuni    │ │ Tosca   │                          │
│  └─────────┘ └─────────┘ └─────────┘                          │
│                                                                 │
│  ✨ SUGGESTED FOR YOU                             [Refresh ↻]  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│  │ [img]   │ │ [img]   │ │ [img]   │  →                       │
│  │ New Spot│ │ Trendy  │ │ Hidden  │                          │
│  └─────────┘ └─────────┘ └─────────┘                          │
│                                                                 │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  [        🎯 Plan an Event with Selected (0)        ]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Unified Search Bar**
   - Text input for natural language ("romantic dinner spot")
   - OR tap a category chip for quick filtering
   - Location/radius as subtle secondary controls

2. **Favorites First**
   - Show your saved venues prominently
   - These are "trusted" - the group already likes them
   - Horizontal scroll with "View All" to expand

3. **AI Suggestions Below**
   - Pre-generated suggestions (no button needed!)
   - "Refresh" to get new ones
   - Based on group preferences + what you haven't tried

4. **Sticky Action Bar**
   - "Plan an Event with Selected (N)"
   - Appears when user selects venues
   - One tap to create itinerary

5. **No Sub-Tabs**
   - Everything on one screen
   - Scroll to see more
   - Clean, focused experience

---

## Mobile Bottom Nav (Simplified)

**Current:** Home, Groups, Events, Alerts, Profile (5 items, "Events" is redundant)

**Proposed:** Home, Explore, Alerts, Profile (4 items)

```
┌─────────────────────────────────────────────────────────────────┐
│   🏠        🧭        🔔        👤                              │
│  Home    Explore   Alerts   Profile                             │
└─────────────────────────────────────────────────────────────────┘
```

- **Home:** Dashboard (events + groups)
- **Explore:** If in a group context → Group's Explore tab. If not → prompt to pick a group
- **Alerts:** Notifications
- **Profile:** User settings

---

## User Flow Comparison

### Current Flow (Confusing)
```
Dashboard → My Groups tab → Click Group → Activities tab → AI Suggested sub-tab
→ Select categories → Enter location → Click Generate → Wait → Select venues
→ Go to Create Event tab → Build itinerary
```
**Steps: 10+**

### Proposed Flow (Simple)
```
Dashboard → Click Group → Explore tab → Tap category OR search
→ Tap venues to select → Tap "Plan Event"
```
**Steps: 5**

---

## Implementation Priority

### Phase 1: Quick Wins (2-3 hours)
1. Remove "Events" from mobile bottom nav (it's redundant)
2. Rename "Activities" to "Explore" (clearer intent)
3. Merge "Home" and "Create Event" tabs into single "Overview" tab

### Phase 2: Explore Tab Redesign (4-6 hours)
1. Create unified Explore component
2. Remove sub-tabs (AI/Search/Favorites → single screen)
3. Add sticky selection bar
4. Favorites section with horizontal scroll

### Phase 3: Dashboard Simplification (2-3 hours)
1. Remove tabs from Dashboard
2. Single scrollable page with events + groups sections
3. Clean up mobile header

---

## Visual Direction

Matching the existing "Warm Gathering" palette:

- **Search bar:** Cream background (`--card`), sunflower gold focus ring
- **Category chips:** Outlined by default, filled with activity color when selected
- **Favorites section:** Subtle sage accent background
- **Suggestions section:** Clean white/cream cards
- **Action bar:** Sunflower gold primary button, sticky at bottom

---

## Questions to Resolve

1. **Should "Explore" work at dashboard level?**
   - Option A: Explore is always group-scoped (current)
   - Option B: Global explore that lets you save to any group (more complex)

2. **What happens to "Insights" tab?**
   - Option A: Move to Settings as a collapsible section
   - Option B: Keep as separate tab (4 tabs total)
   - Option C: Move to Overview as "Group Health" card

3. **How to handle empty Favorites?**
   - Show prominent "Start Discovering" CTA
   - Or auto-show AI suggestions as primary content

---

*Ready for review and feedback!*
