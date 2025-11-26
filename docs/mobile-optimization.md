# Mobile Optimization Plan

**Status:** Ready to implement
**Priority:** 🔴 High
**Estimated Time:** 22-28 hours total
**Created:** 2025-11-23

---

## Executive Summary

**Current State:** Mobile readiness score **3/10**

**Good Foundation:**
- ✅ Tailwind CSS + proper viewport meta
- ✅ shadcn/ui component library (42+ components)
- ✅ Vaul drawer library already installed
- ✅ useIsMobile hook exists (768px breakpoint)
- ✅ SwipeSession already mobile-friendly with touch gestures

**Critical Blockers:**
- ❌ AvailabilityGrid (7×3 grid) forces horizontal scroll on mobile
- ❌ Group Detail page (7,881 lines) needs mobile redesign
- ❌ All dialogs use fixed max-widths (cramped on mobile)
- ❌ EventsTable requires horizontal scroll
- ❌ No mobile navigation pattern
- ❌ Create Group form too long for mobile

**Recommended Approach:** Hybrid strategy using responsive CSS + existing component library + mobile-first refactors.

---

## Investigation Findings

### Current Mobile Readiness Analysis

**Responsive Design Maturity: 3/10**

**Breakdown:**
- ✓ Tailwind + proper viewport meta (2/10)
- ✓ UI component library installed (1/10)
- △ Some responsive classes used (1/10)
- △ Mobile hook exists but underused (0.5/10)
- ✗ No mobile navigation (0/10)
- ✗ No adaptive layouts (0/10)
- ✗ Critical blockers unresolved (0/10)
- △ Touch gestures (SwipeCard only) (0.5/10)

### Technology Stack

**Current:**
- Tailwind CSS v3.4.17 (default breakpoints)
- shadcn/ui (Radix UI primitives)
- Framer Motion (animations, gestures)
- @dnd-kit (drag and drop)
- Vaul (mobile drawer component)
- React Hook Form + Zod
- Wouter (lightweight router)

**Breakpoints:**
- sm: 640px (tablets portrait)
- md: 768px (tablets landscape) ← useIsMobile threshold
- lg: 1024px (desktops)
- xl: 1280px (large desktops)
- 2xl: 1536px (extra large)

### Biggest Mobile UX Blockers (Priority Order)

1. **AvailabilityGrid** - Breaks completely on mobile (7 columns × 64px = 448px minimum)
2. **Group Detail Page** - 7,881 lines, monolithic component needs mobile redesign
3. **Dialog sizing** - All modals use fixed max-widths (max-w-lg, max-w-2xl, max-w-4xl)
4. **EventsTable** - Horizontal scroll nightmare, needs card view alternative
5. **Create Group Form** - Too long (600+ lines), needs wizard/stepper pattern
6. **Navigation** - No mobile-friendly nav pattern (hamburger or bottom nav)
7. **Page containers** - max-w-7xl causes horizontal scroll on many pages
8. **Drag & drop** - @dnd-kit touch support needs testing/optimization

### What's Already Mobile-Friendly

**✓ Works Well:**
1. SwipeSession - Native mobile experience with Framer Motion gestures
2. Basic UI components - Buttons, inputs, cards are touch-friendly
3. Vaul drawer - Already installed for mobile bottom sheets
4. Design system - Color scheme and typography work at any size

**△ Partially Works:**
1. Dashboard - Basic layout works but needs optimization
2. Header - Functions but could be better
3. Forms - Functional but not optimized

---

## Implementation Plan

### Phase 1: Foundation & Critical Fixes (6-8 hours)

**Goal:** Make app functional on mobile by fixing blockers

#### 1.1 Responsive Dialog → Drawer Conversion (2 hours)

**Problem:** All dialogs use fixed max-widths (max-w-lg, max-w-2xl, max-w-4xl) which are cramped on mobile screens.

**Solution:** Create wrapper component that automatically uses Dialog on desktop, Vaul Drawer on mobile.

**Tasks:**
- Create `client/src/components/ResponsiveDialog.tsx`
- Use existing `useIsMobile` hook (768px breakpoint)
- API should match shadcn Dialog component
- Convert ~15 dialog instances across the app:
  - ScheduleEventModal
  - DiscoverVenuesModal
  - TimeSlotVoting dialogs
  - Settings dialogs
  - All other Dialog usages

**Implementation:**
```typescript
// ResponsiveDialog.tsx
import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"

export function ResponsiveDialog({ children, open, onOpenChange, ...props }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent {...props}>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...props}>
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

**Impact:** All modals become mobile-friendly with minimal code changes.

---

#### 1.2 Fix AvailabilityGrid (2 hours)

**Problem:** 7-day grid (7 columns × 64px each = 448px) forces horizontal scroll on mobile (360-414px screens).

**Current Structure:**
- File: `client/src/components/AvailabilityGrid.tsx`
- 7 columns (days) × 3 rows (Morning, Afternoon, Evening)
- Fixed cell sizes: w-16 (64px) × h-10 (40px)

**Solution Options:**

**Option A: Vertical Stack (Recommended)**
- Mobile: Stack days vertically, show one day at a time with swipe navigation
- Desktop: Keep current 7-column grid

**Option B: Accordion Pattern**
- Mobile: Each day is an accordion item, expand to see time slots
- Desktop: Keep current grid

**Option C: Responsive Grid**
- Mobile: 2-3 columns, abbreviated day names
- Tablet: 4-5 columns
- Desktop: 7 columns

**Recommended: Option A** (cleanest mobile UX)

**Implementation:**
```typescript
// Mobile: One day at a time with horizontal swipe
const [selectedDayIndex, setSelectedDayIndex] = useState(0)

if (isMobile) {
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {days.map((day, idx) => (
          <button
            key={day}
            className={cn("flex-1 py-2 text-xs", idx === selectedDayIndex && "bg-primary")}
            onClick={() => setSelectedDayIndex(idx)}
          >
            {day.slice(0, 1)}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {timeSlots.map(slot => (
          <AvailabilityButton day={days[selectedDayIndex]} time={slot} />
        ))}
      </div>
    </div>
  )
}

// Desktop: Keep existing grid
```

**Impact:** Core group creation feature works on mobile.

---

#### 1.3 Responsive Container Widths (1 hour)

**Problem:** Many pages use `max-w-7xl`, `max-w-4xl` which cause horizontal scroll on mobile.

**Solution:** Replace with responsive max-widths.

**Tasks:**
- Search codebase for `max-w-7xl`, `max-w-6xl`, `max-w-5xl`, `max-w-4xl`
- Replace with responsive pattern: `max-w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-7xl`
- Focus on main page containers

**Pattern:**
```typescript
// Before
<div className="max-w-7xl mx-auto">

// After
<div className="max-w-full px-4 sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
```

**Impact:** Eliminates horizontal scrolling across entire app.

---

#### 1.4 Mobile Navigation (2-3 hours)

**Problem:** No mobile-friendly navigation pattern. Current header works but is cramped.

**Current Structure:**
- File: `client/src/components/Header.tsx`
- Sticky top header with logo + user dropdown
- No hamburger menu

**Solution:** Add hamburger menu with slide-out drawer navigation.

**Tasks:**
- Create `client/src/components/MobileNav.tsx`
- Add hamburger icon to Header (mobile only)
- Use Vaul drawer for slide-out menu
- Show main navigation links:
  - Dashboard
  - My Groups
  - Member Dashboard
  - Settings
  - Log out
- Keep desktop header unchanged

**Implementation:**
```typescript
// Header.tsx addition
{isMobile && (
  <button onClick={() => setMobileNavOpen(true)}>
    <Menu className="h-6 w-6" />
  </button>
)}

// MobileNav.tsx
export function MobileNav({ open, onOpenChange }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="left">
      <DrawerContent className="h-full w-3/4">
        <nav className="p-4 space-y-4">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/groups">My Groups</NavLink>
          <NavLink to="/member-dashboard">Member Dashboard</NavLink>
          {/* etc */}
        </nav>
      </DrawerContent>
    </Drawer>
  )
}
```

**Impact:** Easy navigation on mobile devices.

---

### Phase 2: Component Optimization (10-12 hours)

**Goal:** Optimize all critical user flows for mobile

#### 2.1 EventsTable → Card View (3 hours)

**Problem:** EventsTable uses horizontal scroll on mobile, complex nested dropdowns.

**Current Structure:**
- File: `client/src/components/EventsTable.tsx`
- Table with columns: Event, Date/Time, Location, RSVPs, Actions
- Dropdown menus for actions
- Horizontal scroll wrapper

**Solution:** Adaptive rendering - table on desktop, card view on mobile.

**Tasks:**
- Create `client/src/components/EventCard.tsx`
- Use `useIsMobile` to switch between table and card rendering
- Card view shows:
  - Event name (large)
  - Date/time (prominent)
  - Location (with map link)
  - RSVP status badges
  - Primary actions as buttons (not dropdown)

**Implementation:**
```typescript
export function EventsTable({ events }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="space-y-3">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table>{/* existing table */}</table>
    </div>
  )
}
```

**Impact:** Events are easy to browse and interact with on mobile.

---

#### 2.2 Create Group Wizard (3-4 hours)

**Problem:** Create Group form is too long (600+ lines, 4 large card sections) for mobile scrolling.

**Current Structure:**
- File: `client/src/pages/create-group.tsx`
- 4 card sections: Basic Info, Schedule & Budget, Preferences, Members

**Solution:** Convert to 5-step wizard on mobile, keep existing layout on desktop.

**Tasks:**
- Leverage existing `OnboardingWizard` infrastructure (already built!)
- Create wizard steps:
  1. Welcome + Basic Info (name, emoji, location)
  2. Schedule & Budget (frequency, budget, availability)
  3. Preferences (novelty, activity categories)
  4. Members (optional invites)
  5. Review & Create (summary with edit buttons)
- Add progress indicator (Step 2 of 5)
- Keep desktop as-is (single page with 4 cards)
- Use `useIsMobile` to switch rendering

**Implementation:**
```typescript
export default function CreateGroup() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <CreateGroupWizard />
  }

  return <CreateGroupSinglePage />
}
```

**Impact:** Group creation is approachable on mobile, not overwhelming.

---

#### 2.3 Group Detail Page Refactor (3-4 hours)

**Problem:** 7,881 lines in single component, too much vertical scrolling on mobile.

**Current Structure:**
- File: `client/src/pages/group-detail.tsx`
- Single long page with many sections
- Fixed max-widths throughout

**Solution:** Tab-based navigation on mobile, keep existing layout on desktop.

**Tasks:**
- Create tab components:
  - `GroupDetailEventsTab.tsx`
  - `GroupDetailFavoritesTab.tsx`
  - `GroupDetailBuildTab.tsx`
  - `GroupDetailSettingsTab.tsx`
- Mobile: Tabs component with swipeable views
- Desktop: Keep current layout (or improve with tabs for better organization)
- Extract repeated logic into hooks

**Implementation:**
```typescript
export default function GroupDetail() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="events"><GroupDetailEventsTab /></TabsContent>
        {/* etc */}
      </Tabs>
    )
  }

  return <GroupDetailSinglePage />
}
```

**Side Benefit:** Refactoring this massive file improves maintainability for everyone.

**Impact:** Complex group management is navigable on mobile.

---

#### 2.4 Form Touch Optimization (1-2 hours)

**Problem:** Touch targets too small, inputs cramped together on mobile.

**Solution:** Increase spacing and touch target sizes on mobile.

**Tasks:**
- Audit all form inputs
- Ensure minimum 44×44px touch targets (iOS guideline)
- Add vertical spacing between inputs on mobile
- Optimize specific components:
  - Budget slider (larger thumb, bigger track)
  - Emoji picker (responsive sizing, don't overflow viewport)
  - Date/time pickers (use native on mobile)
  - Radio groups (larger clickable area)

**Pattern:**
```typescript
<Button className="h-11 min-h-[44px] md:h-10"> {/* Mobile: 44px min */}
<Input className="h-11 md:h-10"> {/* Mobile: larger inputs */}
<div className="space-y-4 md:space-y-3"> {/* Mobile: more spacing */}
```

**Impact:** Forms are easy to fill out on mobile without mis-taps.

---

### Phase 3: Advanced Mobile Features (6-8 hours)

**Goal:** Add mobile-specific enhancements

#### 3.1 Bottom Navigation Bar (2-3 hours)

**Problem:** Mobile users have to reach to top of screen for navigation (thumb unfriendly).

**Solution:** Bottom navigation bar for main sections (mobile only).

**Tasks:**
- Create `client/src/components/BottomNav.tsx`
- Show on authenticated pages only
- 4-5 main items:
  - Home/Dashboard
  - Groups (My Groups)
  - Events (Member Dashboard)
  - Profile/Settings
- Fixed positioning at bottom
- Active state highlighting
- Hide on scroll down, show on scroll up (advanced)

**Implementation:**
```typescript
export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex justify-around items-center h-16">
        <NavButton to="/dashboard" icon={Home} label="Home" />
        <NavButton to="/groups" icon={Users} label="Groups" />
        <NavButton to="/member-dashboard" icon={Calendar} label="Events" />
        <NavButton to="/preferences" icon={Settings} label="Settings" />
      </div>
    </nav>
  )
}
```

**Impact:** Thumb-friendly navigation, native app feel.

---

#### 3.2 Touch Gesture Enhancements (2 hours)

**Problem:** Limited touch gesture support beyond SwipeCard.

**Solution:** Add common mobile gestures throughout the app.

**Tasks:**
- **Swipe-to-delete** for list items
  - Events list: Swipe to cancel/delete
  - Favorites: Swipe to remove
  - Use Framer Motion drag gestures
- **Pull-to-refresh** on main lists
  - Dashboard events
  - Group events
  - Member events
  - Use native-feeling spring animations
- **Swipe between tabs** (optional)
  - Group Detail tabs
  - Create Group wizard steps

**Implementation:**
```typescript
// Swipe-to-delete
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: 0 }}
  onDragEnd={(e, info) => {
    if (info.offset.x < -50) {
      handleDelete()
    }
  }}
>
  {/* List item content */}
</motion.div>
```

**Impact:** Native mobile app feel, improved UX.

---

#### 3.3 Drag-and-Drop Mobile Testing & Optimization (1 hour)

**Problem:** @dnd-kit touch support needs verification and optimization.

**Current Usage:** 15 files use @dnd-kit for drag-and-drop:
- Dashboard group card reordering
- ItinerarySidebar venue reordering
- EventsTable (potentially)

**Tasks:**
- Test all drag-and-drop interactions on mobile device
- Verify @dnd-kit touch events work correctly
- Add visual feedback:
  - Larger drag handles on mobile
  - Haptic feedback (if supported)
  - Clear drop zones
- Fallback: Add move up/down buttons on mobile if drag is problematic

**Implementation:**
```typescript
{isMobile ? (
  <div className="flex gap-2">
    <Button onClick={() => moveUp(index)} variant="ghost" size="sm">
      <ChevronUp className="h-4 w-4" />
    </Button>
    <Button onClick={() => moveDown(index)} variant="ghost" size="sm">
      <ChevronDown className="h-4 w-4" />
    </Button>
  </div>
) : (
  <DragHandle />
)}
```

**Impact:** Reliable reordering on mobile devices.

---

#### 3.4 Mobile-Specific Improvements (2-3 hours)

**Goal:** Add features that leverage mobile capabilities.

**Tasks:**

1. **"Use my location" for group creation** (45 min)
   - Add button next to location input
   - Use Geolocation API
   - Reverse geocode to city name
   - Only show on mobile (desktop users less likely to allow location)

2. **"Add to Calendar" button** (30 min)
   - Add ICS file download for events
   - Native calendar integration on mobile
   - One-tap add to Google Calendar/Apple Calendar

3. **Optimize image loading** (45 min)
   - Lazy load venue images
   - Responsive image sizes (smaller on mobile)
   - Loading skeletons while images load

4. **Fix viewport scaling issues** (30 min)
   - Test all pages for zoom/scaling bugs
   - Ensure forms don't zoom when focused (iOS)
   - Fix any overflow issues

**Implementation:**
```typescript
// Use location
<Button
  onClick={async () => {
    const pos = await getCurrentPosition()
    const city = await reverseGeocode(pos.coords)
    setLocation(city)
  }}
  className="md:hidden"
>
  <MapPin className="h-4 w-4 mr-2" />
  Use my location
</Button>

// Add to calendar
<Button onClick={() => downloadICS(event)}>
  <Calendar className="h-4 w-4 mr-2" />
  Add to Calendar
</Button>
```

**Impact:** Mobile users get native app conveniences.

---

## Implementation Timeline

### Week 1: Foundation (6-8 hours)
**Priority: Fix critical blockers**

**Day 1-2:**
- Create ResponsiveDialog wrapper component
- Convert 5-10 most important dialogs
- Test on mobile device

**Day 3-4:**
- Fix AvailabilityGrid for mobile
- Update all responsive container widths
- Test group creation flow on mobile

**Day 5:**
- Implement mobile navigation (hamburger + drawer)
- Test navigation throughout app

**Deliverable:** App is functional on mobile, no horizontal scroll

---

### Week 2: Core Flows (10-12 hours)
**Priority: Optimize critical user journeys**

**Day 1-2:**
- Create EventCard component
- Implement EventsTable responsive rendering
- Test events viewing/RSVP on mobile

**Day 3-4:**
- Refactor Group Detail page into tabs
- Create tab components
- Test group management on mobile

**Day 5:**
- Optimize all form inputs for touch
- Fix emoji picker, sliders, date pickers
- Test form submission on mobile

**Deliverable:** All critical flows work smoothly on mobile

---

### Week 3: Polish & Advanced Features (6-8 hours)
**Priority: Mobile-specific enhancements**

**Day 1-2:**
- Create Group wizard for mobile
- Add progress indicators
- Test group creation flow

**Day 3:**
- Implement bottom navigation bar
- Add touch gesture enhancements
- Test drag-and-drop on mobile

**Day 4-5:**
- Add mobile-specific improvements (location, calendar, images)
- Final testing across all flows
- Fix any remaining issues

**Deliverable:** Complete mobile experience with native app feel

---

## Testing Checklist

### Devices to Test

**Minimum:**
- iPhone SE (small screen, 375×667)
- iPhone 14 Pro (modern, 393×852)
- Android phone (360×800)

**Recommended:**
- iPad (tablet, 768×1024)
- Large Android phone (412×915)

### Critical User Flows to Test

- [ ] **Authentication**
  - [ ] Sign up
  - [ ] Log in
  - [ ] Password reset

- [ ] **Group Creation**
  - [ ] Fill out all fields
  - [ ] Use availability grid
  - [ ] Submit successfully

- [ ] **RSVP Flow**
  - [ ] View event invite
  - [ ] See itinerary details
  - [ ] Vote on time slots
  - [ ] Submit RSVP

- [ ] **Swipe Session**
  - [ ] Discover venues
  - [ ] Swipe left/right
  - [ ] Complete session
  - [ ] View results

- [ ] **Event Management**
  - [ ] View events list
  - [ ] See event details
  - [ ] Edit event (organizer)
  - [ ] Cancel event

- [ ] **Favorites Management**
  - [ ] View favorites list
  - [ ] Upvote/downvote
  - [ ] Remove from favorites

### Technical Tests

- [ ] No horizontal scrolling on any page
- [ ] All touch targets ≥44×44px
- [ ] Forms don't trigger zoom on focus (iOS)
- [ ] Drag-and-drop works or has alternative
- [ ] Images load appropriately
- [ ] Navigation is thumb-friendly
- [ ] Dialogs/drawers open smoothly
- [ ] Performance is acceptable (no jank)

---

## Success Metrics

**Functional:**
- ✅ All critical flows work on 360px width screens
- ✅ No horizontal scrolling on any page
- ✅ All touch targets ≥44×44px
- ✅ Forms are single-column on mobile
- ✅ Navigation is thumb-friendly
- ✅ Drag-and-drop works or has mobile alternative

**Performance:**
- ✅ Page load <3 seconds on 3G
- ✅ No layout shift when images load
- ✅ Smooth 60fps animations

**User Experience:**
- ✅ Feels like a native mobile app
- ✅ Touch gestures are intuitive
- ✅ No accidental taps/clicks
- ✅ Clear visual hierarchy on small screens

---

## Files to Create/Modify

### New Components
- `client/src/components/ResponsiveDialog.tsx` - Dialog/Drawer wrapper
- `client/src/components/MobileNav.tsx` - Mobile hamburger navigation
- `client/src/components/BottomNav.tsx` - Bottom navigation bar
- `client/src/components/EventCard.tsx` - Mobile event card view
- `client/src/components/CreateGroupWizard.tsx` - Mobile wizard flow
- `client/src/components/GroupDetailEventsTab.tsx` - Tab component
- `client/src/components/GroupDetailFavoritesTab.tsx` - Tab component
- `client/src/components/GroupDetailBuildTab.tsx` - Tab component
- `client/src/components/GroupDetailSettingsTab.tsx` - Tab component

### Major Refactors
- `client/src/components/AvailabilityGrid.tsx` - Add mobile vertical stack
- `client/src/pages/group-detail.tsx` - Split into tabs or add mobile tabs
- `client/src/components/EventsTable.tsx` - Add card view rendering
- `client/src/pages/create-group.tsx` - Add wizard option
- `client/src/components/Header.tsx` - Add hamburger menu

### Minor Updates
- All Dialog usages → ResponsiveDialog
- All page containers → Responsive max-widths
- All form components → Touch-optimized spacing
- Increase usage of `client/src/hooks/use-mobile.tsx` throughout

### Utility Additions
- `client/src/hooks/useMediaQuery.tsx` - For granular breakpoint control (optional)
- `client/src/utils/mobile.ts` - Mobile-specific utilities (geolocation, calendar, etc.)

---

## Notes & Considerations

### Why This Approach?

1. **Leverage existing foundation** - Vaul drawer, useIsMobile hook, Tailwind already in place
2. **Incremental improvement** - Each phase delivers immediate value
3. **Minimal new dependencies** - Use what's already installed
4. **Maintain desktop experience** - Desktop users unaffected
5. **Code reusability** - Components work for both mobile and desktop

### Progressive Enhancement Strategy

- Start with critical blockers (Phase 1)
- Optimize core flows (Phase 2)
- Add nice-to-haves (Phase 3)
- Can stop after any phase with working mobile experience

### Technical Debt Reduction

Bonus benefit: Refactoring Group Detail (7,881 lines) and Create Group improves maintainability for entire team, not just mobile users.

### Future Enhancements (Beyond this plan)

- Progressive Web App (PWA) manifest + service worker
- Push notifications for event reminders
- Offline mode for viewing events
- Native share API integration
- Camera integration for venue photos
- Voice input for search

---

*Plan created: 2025-11-23*
*Ready to implement - start with Phase 1*
