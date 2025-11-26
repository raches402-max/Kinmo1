# Dashboard Page Design Mockup

**Created:** 2025-11-23
**Status:** Design Proposal
**Related:** [Design System](./design-system.md)

---

## Overview

This document presents redesign mockups for the main Dashboard page - the first screen users see after logging in. The redesign focuses on clarity, visual hierarchy, and delightful interactions while maintaining all existing functionality.

---

## Current State Analysis

**Based on existing codebase:**
- Dashboard shows groups user belongs to
- Shows upcoming events across all groups
- Includes RSVP status indicators
- May include auto-scheduling features
- Likely uses card-based layout

**Current Issues (assumed):**
- May resemble StubHub (corporate feel)
- Unclear visual hierarchy
- Limited personality/warmth
- Potentially cramped on mobile

---

## Design Goals

1. **Clear at a glance** - See upcoming events immediately
2. **Action-oriented** - Easy to RSVP, create events, manage groups
3. **Warm & inviting** - Feel excited about upcoming hangouts
4. **Mobile-friendly** - Works great on phones
5. **Scannable** - Quick visual scan shows all important info

---

## Desktop Layout Mockup

### Visual Wireframe (1200px width)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Logo                    Dashboard    My Groups    Profile ▼               │ ← Header
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  👋 Hey Sarah!                                            🔔 2 new    │ │
│  │  You have 3 upcoming events                                          │ │
│  │                                                                       │ │
│  │  [+ Create Event]  [Auto-Schedule]                                   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─────────────────────────────────────────────────────┐  ┌──────────────┐ │
│  │                                                     │  │              │ │
│  │  🎯 UPCOMING EVENTS                                │  │  YOUR GROUPS │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  │              │ │
│  │                                                     │  │  ┌──────────┐ │ │
│  │  ┌───────────────────────────────────────────────┐ │  │  │ 🍕       │ │ │
│  │  │  THIS FRIDAY, 7:00 PM                     ⭐  │ │  │  │ Weekly   │ │ │
│  │  │                                                │ │  │  │ Dinners  │ │ │
│  │  │  🍽️  Team Dinner at Pizzeria Delfina       │ │  │  │ 12 members│ │ │
│  │  │  📍 Mission District                          │ │  │  │          │ │ │
│  │  │  👥 8 going, 2 maybe                          │ │  │  │ [View] → │ │ │
│  │  │                                                │ │  │  └──────────┘ │ │
│  │  │  [✓ I'm going!]  [View Details →]            │ │  │              │ │
│  │  └───────────────────────────────────────────────┘ │  │  ┌──────────┐ │ │
│  │                                                     │  │  │ 🎬       │ │ │
│  │  ┌───────────────────────────────────────────────┐ │  │  │ Movie    │ │ │
│  │  │  NEXT WEEK, SAT 8:00 PM              🔔 RSVP  │ │  │  │ Nights   │ │ │
│  │  │                                                │ │  │  │ 6 members│ │ │
│  │  │  🎬  Movie Night                              │ │  │  │          │ │ │
│  │  │  📍 Alamo Drafthouse                          │ │  │  │ [View] → │ │ │
│  │  │  ⏰ RSVP by Tomorrow                          │ │  │  └──────────┘ │ │
│  │  │                                                │  │              │ │
│  │  │  [Yes] [Maybe] [No]                           │  │  [+ New Group]│ │
│  │  └───────────────────────────────────────────────┘ │  │              │ │
│  │                                                     │  └──────────────┘ │
│  │  ┌───────────────────────────────────────────────┐ │                  │
│  │  │  DEC 15, 6:30 PM                              │ │                  │
│  │  │                                                │ │                  │
│  │  │  🍺  Brewery Crawl                            │ │                  │
│  │  │  📍 Starting at Cellarmaker                   │ │                  │
│  │  │  👥 5 going, 1 maybe                          │ │                  │
│  │  │                                                │ │                  │
│  │  │  [✓ Already responded]  [View Details →]     │ │                  │
│  │  └───────────────────────────────────────────────┘ │                  │
│  │                                                     │                  │
│  │  ─────────────────────────────────────────────────  │                  │
│  │                                                     │                  │
│  │  📅 PAST EVENTS (3)                          [→]  │                  │
│  │                                                     │                  │
│  └─────────────────────────────────────────────────────┘                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Header Bar
**Purpose:** Global navigation and user actions

**Elements:**
- Logo (left) - Links to dashboard
- Main nav links (Dashboard, My Groups, Profile)
- Notification bell with badge (if unread)
- User avatar with dropdown menu (right)

**Styling:**
- Background: White with subtle border-bottom
- Height: 64px
- Sticky positioning
- Shadow: subtle on scroll

---

### 2. Welcome Section
**Purpose:** Personalized greeting and quick actions

**Elements:**
- Greeting: "Hey {Name}!"
- Status summary: "You have X upcoming events"
- Notification indicator: "🔔 2 new"
- Primary actions: [Create Event] [Auto-Schedule]

**Styling:**
- Background: Gradient (Primary light → White)
- Padding: 32px
- Border radius: 12px
- Margin bottom: 24px

**Interactions:**
- Create Event → Opens event creation modal
- Auto-Schedule → Opens auto-scheduling flow
- Notification → Opens notification drawer

---

### 3. Main Content Area (2-Column Layout)

#### Left Column (70% width): Upcoming Events

**Section Header:**
- Icon + "UPCOMING EVENTS" heading
- Visual separator line
- Optional: Sort/filter controls

**Event Card (Needs RSVP):**
```
┌─────────────────────────────────────────────────────────┐
│  THIS FRIDAY, 7:00 PM                           ⭐      │ ← Date/time + status badge
│                                                         │
│  🍽️  Team Dinner at Pizzeria Delfina               │ ← Emoji + title
│  📍 Mission District                                   │ ← Location
│  👥 8 going, 2 maybe                                   │ ← Attendance count
│                                                         │
│  [✓ I'm going!]  [View Details →]                    │ ← Primary action + secondary
└─────────────────────────────────────────────────────────┘
```

**Card States:**

1. **Needs RSVP** (Most urgent)
   - Border: 2px solid primary color (attention)
   - Badge: "🔔 RSVP" in top right
   - Actions: [Yes] [Maybe] [No] buttons
   - Highlight: Subtle pulse animation (optional)

2. **Already Responded**
   - Border: 1px solid gray-200
   - Badge: "⭐" or checkmark
   - Actions: [✓ Already responded] (disabled) + [View Details]
   - Muted style (not urgent)

3. **Coming Soon** (Virtual events)
   - Border: 1px dashed gray-300
   - Badge: "📅 Soon"
   - Style: Slightly transparent
   - Actions: [Details] only

**Styling per card:**
- Background: White
- Padding: 20px
- Border radius: 12px
- Shadow: sm (subtle)
- Hover: shadow-md, lift 2px
- Spacing between cards: 16px

**Empty State:**
```
┌─────────────────────────────────────────────────────────┐
│              [Illustration of calendar]                 │
│                                                         │
│           No upcoming events yet                        │
│                                                         │
│      Time to plan something fun with your groups!       │
│                                                         │
│           [Schedule an Event]                           │
│                                                         │
│         or [Auto-Schedule] →                            │
└─────────────────────────────────────────────────────────┘
```

#### Right Column (30% width): Groups Sidebar

**Section Header:**
- "YOUR GROUPS" heading
- Optional: "View All" link if > 3 groups

**Group Card:**
```
┌────────────────────────┐
│  🍕                    │ ← Group emoji
│  Weekly Dinners        │ ← Group name
│  12 members            │ ← Member count
│                        │
│  [View] →              │ ← Action
└────────────────────────┘
```

**Styling:**
- Compact cards (smaller than events)
- Background: White
- Padding: 16px
- Border radius: 8px
- Shadow: sm
- Hover: lift, show quick actions
- Spacing between: 12px

**Action Button:**
- [+ New Group] - Full width, secondary style
- Bottom of sidebar

**Empty State:**
```
┌────────────────────────┐
│  [Icon of people]      │
│                        │
│  No groups yet         │
│                        │
│  [Create a Group]      │
└────────────────────────┘
```

---

### 4. Past Events Section (Collapsed by default)

**Header:**
- "📅 PAST EVENTS (3)" with expand arrow →
- Clicking expands to show past events
- Collapsed by default to reduce clutter

**Expanded View:**
- Similar card style to upcoming events
- Muted colors (gray scale)
- Shows last 5 events
- "View all past events →" link at bottom

---

## Mobile Layout Mockup (360px width)

### Visual Wireframe

```
┌──────────────────────────────┐
│ ☰  Dashboard          🔔  👤│ ← Header (compact)
└──────────────────────────────┘

┌──────────────────────────────┐
│ 👋 Hey Sarah!                │
│ 3 upcoming events            │
│                              │
│ [+ Create]  [Auto-Schedule] │
└──────────────────────────────┘

┌──────────────────────────────┐
│ 🎯 UPCOMING                  │ ← Tab bar
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                              │
│ ┌──────────────────────────┐ │
│ │ FRI, 7:00 PM       ⭐   │ │
│ │                          │ │
│ │ 🍽️ Team Dinner          │ │
│ │ Pizzeria Delfina         │ │
│ │ 📍 Mission District      │ │
│ │ 👥 8 going, 2 maybe      │ │
│ │                          │ │
│ │ [✓ I'm going!]           │ │
│ │ [View Details →]         │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ SAT, 8:00 PM    🔔 RSVP │ │
│ │                          │ │
│ │ 🎬 Movie Night          │ │
│ │ Alamo Drafthouse         │ │
│ │ ⏰ RSVP by Tomorrow      │ │
│ │                          │ │
│ │ [Yes] [Maybe] [No]       │ │
│ └──────────────────────────┘ │
│                              │
│ [Load more...]               │
└──────────────────────────────┘

┌──────────────────────────────┐
│ YOUR GROUPS (3)       [→]   │ ← Horizontal scroll
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 🍕  │ │ 🎬  │ │ 🍺  │ → │ ← Swipeable cards
│ │     │ │     │ │     │    │
│ └─────┘ └─────┘ └─────┘    │
└──────────────────────────────┘

┌──────────────────────────────┐
│ [Home] [Groups] [+] [Profile]│ ← Bottom navigation
└──────────────────────────────┘
```

---

## Mobile-Specific Changes

### 1. Compact Header
- Hamburger menu (☰) on left
- App name or logo (center)
- Notifications + Profile (right icons only)
- Height: 56px (touch-friendly)

### 2. Single Column Layout
- Events take full width
- Groups section moves below events
- Horizontal scrollable group cards

### 3. Simplified Event Cards
- Stack info vertically
- Larger touch targets (buttons 44px min height)
- Less metadata (hide non-essential info)
- Swipe gesture for quick actions (optional)

### 4. Bottom Navigation Bar
- Fixed at bottom
- Icons + labels
- Active state highlighted
- 4-5 main sections

### 5. Tabs for Organization
- "Upcoming" vs "Past" events
- Swipeable tabs
- Reduces vertical scrolling

---

## Interaction Details

### Event Card Hover (Desktop)
1. **Default state:** Shadow-sm
2. **Hover:**
   - Lift 2px (transform: translateY(-2px))
   - Shadow-md
   - Show quick actions (Edit, Share icons)
3. **Transition:** 200ms ease-out

### RSVP Buttons
1. **States:**
   - Default: Outlined, gray
   - Hover: Filled background (light)
   - Selected: Filled, primary color, checkmark icon
   - Loading: Spinner icon
2. **Interaction:**
   - Click → Immediate optimistic update
   - Show loading spinner briefly
   - Success: Checkmark + "Saved!" toast
   - Error: Revert + error message

### Create Event Flow
1. Click [+ Create Event] button
2. Opens ResponsiveDialog:
   - Desktop: Centered modal (700px wide)
   - Mobile: Bottom sheet (full width)
3. Form with tabs: Manual vs AI
4. Submit → Loading state → Success celebration

### Notification Drawer
1. Click notification bell
2. Drawer slides in from right (desktop) or bottom (mobile)
3. Shows list of notifications
4. Click notification → Navigate to relevant page
5. Mark as read on view
6. "Clear all" option at bottom

---

## Loading States

### Initial Page Load
```
┌──────────────────────────────┐
│ ▒▒▒▒▒▒  Dashboard    ▒▒  ▒▒ │ ← Skeleton header
└──────────────────────────────┘

┌──────────────────────────────┐
│ ▒▒ ▒▒▒▒▒▒                    │ ← Skeleton welcome
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒     │
│                              │
│ ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒      │
└──────────────────────────────┘

┌──────────────────────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│                              │ ← Skeleton event cards
│ ▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         │
│ ▒▒  ▒▒▒▒▒▒▒▒▒▒▒▒▒            │
│                              │
│ ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒          │
└──────────────────────────────┘
```

**Styling:**
- Gray gradient background (#E5E7EB to #F3F4F6)
- Shimmer animation (left to right sweep)
- Same dimensions as actual content
- Smooth transition when real data loads

### RSVP Button Loading
```
Before: [Yes] [Maybe] [No]
During: [... Loading ...]
After:  [✓ Going!] (success state)
```

---

## Success States

### After Creating Event
```
┌──────────────────────────────────┐
│        ✨ 🎉 ✨                  │
│                                  │
│   Event Created Successfully!    │
│                                  │
│   Team Dinner is scheduled for   │
│   this Friday at 7:00 PM         │
│                                  │
│   [Invite Members] [View Event]  │
└──────────────────────────────────┘
```
- Confetti animation
- Success modal or toast
- Clear next actions

### After RSVP
```
Toast (bottom-right):
┌────────────────────────┐
│ ✓ You're going to      │
│   Team Dinner!         │
└────────────────────────┘
```
- Auto-dismisses after 3s
- Gentle slide-in animation
- Success green color

---

## Responsive Breakpoints

### Mobile (< 640px)
- Single column
- Full-width cards
- Bottom navigation
- Hamburger menu
- Horizontal group scroll

### Tablet (640px - 1024px)
- Single column (wider)
- Slightly larger cards
- Top navigation
- Groups sidebar (collapsible)

### Desktop (> 1024px)
- 2-column layout (70/30 split)
- Side-by-side content
- Full navigation
- Groups always visible
- Hover effects enabled

---

## Technical Implementation Notes

### Components to Create/Update

1. **DashboardLayout.tsx**
   - Two-column wrapper
   - Responsive grid
   - Proper spacing

2. **EventCard.tsx**
   - Reusable event card component
   - Props: event data, onRSVP callback, variant (upcoming/past/needs-rsvp)
   - Multiple states (needs RSVP, responded, past)

3. **GroupCard.tsx**
   - Compact group display
   - Props: group data, onView callback
   - Hover quick actions

4. **WelcomeSection.tsx**
   - Personalized greeting
   - Quick action buttons
   - Notification count

5. **EventCardSkeleton.tsx**
   - Loading placeholder
   - Shimmer animation
   - Matches EventCard dimensions

### Data Structure

```typescript
interface DashboardData {
  user: {
    name: string;
    avatar: string;
  };
  notifications: {
    count: number;
    unread: number;
  };
  upcomingEvents: Event[];
  pastEvents: Event[];
  groups: Group[];
}

interface Event {
  id: string;
  title: string;
  emoji: string;
  datetime: Date;
  location: string;
  groupName: string;
  rsvpStatus: 'pending' | 'yes' | 'maybe' | 'no';
  rsvpDeadline?: Date;
  attendeeCounts: {
    yes: number;
    maybe: number;
    no: number;
  };
  isVirtual: boolean; // For virtual placeholder events
}

interface Group {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
}
```

### API Endpoints

```
GET /api/user/dashboard
Response: DashboardData

POST /api/events/:id/rsvp
Body: { status: 'yes' | 'maybe' | 'no' }
Response: { success: boolean, event: Event }

GET /api/notifications
Response: Notification[]
```

---

## Color Specifications

### Event Card States

**Needs RSVP (Urgent):**
- Border: 2px solid #8B5CF6 (primary purple)
- Background: #FAFBFC
- Badge background: #8B5CF6
- Badge text: White

**Already Responded:**
- Border: 1px solid #E5E7EB (gray-200)
- Background: White
- Badge: ⭐ or ✓ with green color

**Past Event:**
- Border: 1px solid #E5E7EB
- Background: #F9FAFB (gray-50)
- Text: Muted (#6B7280)

### Buttons

**Primary ([I'm going!]):**
- Background: #8B5CF6 (primary)
- Text: White
- Hover: #7C3AED (darker)

**Secondary ([View Details]):**
- Background: Transparent
- Border: 1px solid #D1D5DB
- Text: #374151
- Hover: Background #F3F4F6

---

## Animation Timing

```css
/* Hover effects */
transition: all 200ms ease-out;

/* Page transitions */
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

/* Loading shimmer */
animation: shimmer 2s infinite;

/* Success confetti */
duration: 3s (then auto-clear);
```

---

## Accessibility Checklist

- [ ] All cards are keyboard navigable
- [ ] RSVP buttons have proper focus states
- [ ] Screen reader announces RSVP status changes
- [ ] Event times include timezone info
- [ ] Color is not the only indicator (use icons too)
- [ ] Alt text on all decorative images
- [ ] Skip to main content link
- [ ] Heading hierarchy is logical (h1 → h2 → h3)

---

## Next Steps

1. **Review with stakeholders** - Get feedback on design direction
2. **Create Figma mockups** - High-fidelity visual designs (optional)
3. **Implement components** - Start with EventCard
4. **Build dashboard layout** - Responsive grid
5. **Add loading states** - Skeletons and spinners
6. **Test on mobile devices** - Real device testing
7. **Iterate based on feedback** - Refine and polish

---

## Related Documents

- [Design System](./design-system.md) - Complete design guidelines
- [Mobile Optimization](./mobile-optimization.md) - Mobile-specific improvements
- [Discover Venues](./discover-venues-schedule-now.md) - Related feature specs

---

*Dashboard mockup created: 2025-11-23*
*Ready for review and implementation*
