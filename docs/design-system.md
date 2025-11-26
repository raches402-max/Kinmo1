# Design System & UX Guidelines

**Status:** Ready for Implementation - Foundation Phase
**Created:** 2025-11-23
**Last Updated:** 2025-11-23

---

## Executive Summary

This document outlines a comprehensive design system to transform the event planning app from a corporate-feeling interface into a warm, friendly, delightful experience that reflects the social nature of bringing people together.

**Current State:**
- Design resembles StubHub (corporate, transactional)
- Lacks unique personality and brand identity
- Mobile readiness: 3/10
- Inconsistent component usage and terminology

**Design Vision:**
Create a warm, inviting, social experience that makes planning group hangouts feel effortless and fun - like texting friends, not booking tickets.

**Key Objectives:**
1. Establish unique, friendly brand identity
2. Improve visual hierarchy and clarity
3. Add delightful micro-interactions
4. Ensure mobile-first responsive design
5. Create consistent, reusable component system

---

## 🎯 Implementation Strategy: Do Design Changes in Parallel

**IMPORTANT:** Don't wait until the end to implement design changes. Instead, integrate foundational design work now while continuing product development, but save polish/advanced work for later.

### Strategic Approach: 3-Track System

#### Track 1: Do NOW (Foundational Design - Week 1-2)
**Time Investment: 6-8 hours one-time**

- ✅ **Color system** - Update Tailwind config once, benefits everything going forward
- ✅ **Typography** (Poppins + Inter) - Add Google Fonts, update base styles
- ✅ **Spacing standardization** - Makes all future work consistent
- ✅ **ResponsiveDialog wrapper** - Critical blocker for mobile, helps immediately

**Why now:** These are foundational changes that make ALL future work easier. If you wait, you'll have to retrofit everything later. Better to build new features on the right foundation.

**Parallel with:** Continue building product features (Schedule Now from Favorites, Member Preferences, etc.)

#### Track 2: Do DURING Product Development (Component Updates - Ongoing)
**Apply as you build/modify components**

- ✅ **Mobile navigation** (hamburger menu) - 2-3h
- ✅ **AvailabilityGrid mobile fix** - 2h (critical blocker)
- ✅ **Responsive container widths** - 1h (quick win)
- ✅ **Button standardization** - Apply to new/modified components
- ✅ **Form components** - Update as you build new features

**Why during:** As you build new features, apply the new design system. Don't redesign components you're not touching yet.

**Parallel with:** Member Preferences Page, Notification System, other feature work

#### Track 3: Save for LATER (Polish & Advanced - Pre-Launch)
**Time Investment: 16-20 hours during pre-launch phase**

- ⏸️ **Micro-interactions & animations** - 8-10h
- ⏸️ **Empty states redesign** - 2-3h
- ⏸️ **Advanced mobile features** (bottom nav, gestures) - 6-8h
- ⏸️ **Group Detail page refactor** - 3-4h
- ⏸️ **Dashboard mockup implementation** - variable

**Why later:** These are polish/optimization items. Don't spend time perfecting things that might change as you build features. Save for pre-launch polish pass.

### Key Principles

1. **Foundation first** - Color/typography/spacing changes are cheap now, expensive later
2. **Incremental component updates** - Redesign components as you build/modify them
3. **Mobile-first for new work** - Build new features mobile-responsive from the start
4. **Polish is pre-launch** - Save animations, empty states, advanced features for final pass
5. **Don't block launches** - Ship features with "good enough" design, perfect later

### What NOT to Do

❌ **Don't redesign everything before building features** - You'll waste time redesigning things that might change

❌ **Don't ignore design until the end** - You'll have massive technical debt

❌ **Don't perfect every pixel now** - Priorities may shift, features may change

### Recommended Sequencing

**Week 1-2: Foundation + Quick Wins**
```
Day 1-2:  Design foundation (colors, typography, spacing)
Day 3-4:  ResponsiveDialog + mobile navigation
Day 5-6:  AvailabilityGrid mobile fix
Day 7-10: Product features using new design system
```

**Weeks 3-4+: Feature Development + Component Updates**
```
Build features using new design system
Update components as you touch them (not wholesale redesign)
Test on mobile as you go
```

**Pre-Launch Phase (see PRE_LAUNCH.md):**
```
Week 1: Mobile optimization polish
Week 2: Design polish (animations, empty states, final UX pass)
Week 3: Testing, security audit, performance
Week 4: Production deployment prep
```

### Why This Works

✅ **Parallelizes work** - Design + features simultaneously
✅ **Avoids rework** - New features built on right foundation
✅ **Maintains velocity** - Don't stop shipping features
✅ **Reduces risk** - Test design changes incrementally
✅ **Focuses effort** - Polish what matters after features are stable

---

## 🎨 Brand Identity & Personality

### Personality Traits
- **Warm & Welcoming** (not corporate)
- **Playful & Fun** (not stuffy)
- **Helpful & Clear** (not confusing)
- **Social & Connected** (not transactional)
- **Effortless & Simple** (not overwhelming)

### Brand Keywords
✅ Friendly, inviting, warm, social, fun, playful, clear, simple, helpful
❌ Corporate, stiff, formal, complicated, transactional, cold

### Visual Direction
- Rounded corners (friendly, approachable)
- Warm colors (inviting, not clinical)
- Generous whitespace (calm, not cramped)
- Playful illustrations (human, not stock)
- Smooth animations (delightful, not jarring)

---

## 🎨 Color System

### Current Issue
- Colors may be too corporate/neutral (like StubHub blue/gray)
- Need warmer, more inviting palette

### Proposed Color Palette

#### Option A: Warm & Social
```
Primary:     Coral (#FF6B6B) or Warm Purple (#9B7EDE)
Secondary:   Teal (#20C997) or Sunny Yellow (#FFD93D)
Success:     Soft Green (#6BCF7F)
Warning:     Warm Orange (#FFB84D)
Error:       Soft Red (#FF6B6B)
Info:        Sky Blue (#4DABF7)

Neutrals:
  - Gray 900: #2C3E50 (text)
  - Gray 700: #5A6C7D
  - Gray 500: #95A5B8
  - Gray 300: #D1D9E2
  - Gray 100: #F0F3F7
  - Gray 50:  #F8FAFC (backgrounds)

Backgrounds:
  - Main: Off-white (#FAFBFC) not pure white
  - Cards: White (#FFFFFF) with subtle shadow
  - Hover: Gray 50 (#F8FAFC)
```

#### Option B: Friendly Tech
```
Primary:     Purple (#8B5CF6)
Secondary:   Pink (#EC4899)
Success:     Green (#10B981)
Warning:     Amber (#F59E0B)
Error:       Red (#EF4444)
Info:        Blue (#3B82F6)

(Use with same neutral scale)
```

### Color Usage Guidelines
- **Primary:** Main CTAs, links, active states
- **Secondary:** Accents, highlights, secondary actions
- **Success:** Confirmations, success states, positive feedback
- **Warning:** Alerts, important notices, caution
- **Error:** Errors, validation failures, destructive actions
- **Neutrals:** Text, borders, backgrounds, shadows

### Accessibility
- All text must meet WCAG AA contrast ratio (4.5:1 for normal text)
- Use color + icon/text together (not color alone)
- Test with colorblind simulators

---

## 📝 Typography

### Font System

#### Recommended Pairing

**Option A: Friendly & Modern**
- **Headings:** Poppins (Google Fonts) - Rounded, friendly, approachable
- **Body:** Inter (Google Fonts) - Clean, readable, professional
- **Accent:** (Optional) Caveat for special moments

**Option B: Tech-Forward**
- **Headings:** Space Grotesk (Google Fonts) - Modern, geometric
- **Body:** Plus Jakarta Sans (Google Fonts) - Rounded, friendly
- **Accent:** (Optional) DM Sans for diversity

### Type Scale

```
Display:  48px / 3rem    (Hero headlines)
H1:       36px / 2.25rem (Page titles)
H2:       30px / 1.875rem (Section headers)
H3:       24px / 1.5rem  (Card titles)
H4:       20px / 1.25rem (Subsections)
H5:       18px / 1.125rem (Labels)
Body:     16px / 1rem    (Default text)
Small:    14px / 0.875rem (Helper text)
Tiny:     12px / 0.75rem (Captions, metadata)
```

### Font Weights
- Regular: 400 (body text)
- Medium: 500 (emphasis, labels)
- Semibold: 600 (headings, buttons)
- Bold: 700 (important headings)

### Line Height
- Headings: 1.2 (tight)
- Body: 1.6 (comfortable reading)
- UI elements: 1.4 (balance)

### Implementation
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

:root {
  --font-heading: 'Poppins', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

---

## 📏 Spacing & Layout

### Spacing Scale
Use consistent 4px-based spacing throughout:

```
0:   0px
1:   4px   (tight spacing)
2:   8px   (buttons, small gaps)
3:   12px  (cards, list items)
4:   16px  (standard gap)
5:   20px
6:   24px  (sections)
8:   32px  (large sections)
10:  40px
12:  48px  (page sections)
16:  64px  (major sections)
20:  80px
24:  96px
```

### Layout Principles
- **Mobile-first:** Design for 360px, scale up
- **Container max-widths:**
  - Mobile: Full width with 16px padding
  - Tablet: 768px
  - Desktop: 1200px max (not full viewport on ultra-wide)
  - Reading content: 65ch max width

### Grid System
- **Columns:** 12-column grid (flexible)
- **Gap:** 24px on desktop, 16px on mobile
- **Margins:** 24px on desktop, 16px on mobile

---

## 🎯 Component Library Standards

### Buttons

#### Types & Hierarchy
```
Primary (filled):    Main actions (Create Event, Save, Submit)
Secondary (outline): Secondary actions (Cancel, Edit, Details)
Ghost (text only):   Tertiary actions (View More, Learn More)
Destructive (red):   Dangerous actions (Delete, Remove, Cancel Event)
```

#### Sizes
```
Large:  h-12 px-6 text-base  (Hero CTAs)
Medium: h-10 px-4 text-sm    (Standard buttons)
Small:  h-8  px-3 text-xs    (Inline actions)
Icon:   h-10 w-10            (Icon-only buttons)
```

#### States
- **Default:** Base style
- **Hover:** Slightly darker, subtle lift (transform: translateY(-1px))
- **Active:** Press down (transform: translateY(0))
- **Disabled:** Opacity 50%, cursor not-allowed
- **Loading:** Spinner icon, disabled state

#### Code Example (Tailwind)
```jsx
// Primary button
<button className="h-10 px-4 bg-primary text-white rounded-lg font-medium
  hover:bg-primary-dark hover:-translate-y-0.5 active:translate-y-0
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-all duration-200">
  Create Event
</button>

// Secondary button
<button className="h-10 px-4 border-2 border-gray-300 text-gray-700 rounded-lg font-medium
  hover:border-gray-400 hover:bg-gray-50
  transition-all duration-200">
  Cancel
</button>
```

### Cards

#### Visual Hierarchy
1. **Image/Icon** (if applicable) - Top or left
2. **Title** - Large, bold
3. **Metadata** - Small, gray (date, location, etc.)
4. **Description** - Optional body text
5. **Actions** - Bottom or right

#### Elevation System
```
Flat:     No shadow (background cards)
Low:      shadow-sm (subtle depth)
Medium:   shadow-md (standard cards)
High:     shadow-lg (modals, important cards)
Floating: shadow-xl (tooltips, dropdowns)
```

#### Border Radius
- Cards: 12px or 16px (rounded-lg or rounded-xl)
- Images within cards: 8px or 12px
- Keep consistent throughout app

#### States
- **Default:** White background, medium shadow
- **Hover:** Lift up 2px, increase shadow
- **Active/Selected:** Border highlight in primary color
- **Loading:** Skeleton with shimmer animation

#### Code Example
```jsx
<div className="bg-white rounded-xl shadow-md p-6
  hover:shadow-lg hover:-translate-y-0.5
  transition-all duration-200">
  <h3 className="text-lg font-semibold text-gray-900">
    Weekly Dinner Club
  </h3>
  <p className="text-sm text-gray-500 mt-1">
    Next event: Friday, 7:00 PM
  </p>
  <div className="mt-4 flex gap-2">
    <button className="primary">View Details</button>
  </div>
</div>
```

### Form Inputs

#### Input Sizes
```
Large:  h-12 px-4 text-base  (Important forms)
Medium: h-10 px-3 text-sm    (Standard inputs)
Small:  h-8  px-2 text-xs    (Compact forms)
```

#### Input States
- **Default:** Gray border, white background
- **Focus:** Primary color border, subtle ring/glow
- **Error:** Red border, error message below
- **Success:** Green border, checkmark icon
- **Disabled:** Gray background, cursor not-allowed

#### Best Practices
- **Labels above inputs** (not floating or placeholder-only)
- **Helper text below** (explain what's needed)
- **Inline validation** (check as user types)
- **Error messages** immediately below field
- **Touch targets:** 44px minimum height on mobile
- **Single column** on mobile (avoid side-by-side)

#### Code Example
```jsx
<div className="space-y-1.5">
  <label className="text-sm font-medium text-gray-700">
    Group Name
  </label>
  <input
    type="text"
    className="w-full h-10 px-3 border border-gray-300 rounded-lg
      focus:border-primary focus:ring-2 focus:ring-primary/20
      disabled:bg-gray-100 disabled:cursor-not-allowed"
    placeholder="e.g., Weekly Dinner Club"
  />
  <p className="text-xs text-gray-500">
    This will be visible to all members
  </p>
</div>
```

### Dialogs & Modals

#### Desktop vs Mobile
- **Desktop:** Centered modal with backdrop blur
  - Max width: 500px (small), 700px (medium), 900px (large)
  - Backdrop: rgba(0,0,0,0.5) with blur
  - Border radius: 16px

- **Mobile:** Bottom sheet (Vaul drawer)
  - Full width
  - Rounded top corners only
  - Swipe to dismiss
  - Backdrop: rgba(0,0,0,0.4)

#### Structure
```
┌─────────────────────┐
│ [X]           Title │ ← Header with close button
├─────────────────────┤
│                     │
│   Content area      │ ← Scrollable if needed
│                     │
├─────────────────────┤
│  [Cancel] [Confirm] │ ← Actions (right-aligned)
└─────────────────────┘
```

#### Best Practices
- **Clear title** - What is this modal for?
- **Concise content** - Don't overwhelm
- **Primary action** - Right side, visually prominent
- **Cancel option** - Always provide escape hatch
- **Close on backdrop click** - Standard behavior
- **Escape key closes** - Keyboard accessibility

---

## ✨ Micro-Interactions & Animations

### Animation Principles
- **Purposeful:** Every animation should have a reason
- **Fast:** 200-300ms for most interactions
- **Smooth:** Use easing functions (not linear)
- **Subtle:** Enhance, don't distract

### Common Animations

#### Button Press
```css
transition: all 200ms ease-out;
hover: transform translateY(-2px), shadow increase
active: transform translateY(0)
```

#### Card Hover
```css
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
hover: transform translateY(-4px), shadow-lg
```

#### Page Transitions
```jsx
// Using Framer Motion (already installed!)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

#### Loading Spinner
- Smooth rotation
- Primary color
- Size: 20px (small), 32px (medium), 48px (large)
- Accompany with text: "Creating your event..."

#### Success Celebration
```jsx
// Confetti on major actions (event created, group created)
import confetti from 'canvas-confetti';

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 }
});
```

#### Skeleton Loading
- Same shape as final content
- Shimmer animation (left to right)
- Gray gradient background
- Use for cards, lists, images

### Gestures (Mobile)
- **Swipe:** Already implemented in SwipeCard - extend to lists
- **Pull to refresh:** Dashboard, event lists
- **Long press:** Show contextual menu
- **Drag:** Reorder lists (with @dnd-kit)

---

## 🎯 Empty States

### Anatomy of Good Empty State
1. **Illustration or Icon** - Visual, friendly representation
2. **Headline** - "No [items] yet" or friendly explanation
3. **Body text** - Why empty? What's the benefit of adding?
4. **Primary CTA** - Large, obvious action button
5. **Secondary help** - Optional tips or examples

### Examples

#### No Groups Yet
```
┌────────────────────────────┐
│      [Illustration]        │ ← People connecting/high-five
│                            │
│   You haven't joined any   │
│      groups yet            │
│                            │
│  Groups make it easy to    │
│  plan hangouts with your   │
│  favorite people           │
│                            │
│  [Create Your First Group] │ ← Big primary button
│                            │
│  or [Join a Group]         │ ← Secondary option
└────────────────────────────┘
```

#### No Favorites
```
┌────────────────────────────┐
│      [Illustration]        │ ← Person discovering food
│                            │
│  Your favorites is empty   │
│                            │
│  Swipe on venues you'd     │
│  like to try. We'll use    │
│  them for future events!   │
│                            │
│   [Discover Venues]        │ ← CTA to swipe session
└────────────────────────────┘
```

#### No Events
```
┌────────────────────────────┐
│      [Illustration]        │ ← Calendar with friendly face
│                            │
│  No events scheduled yet   │
│                            │
│  Time to plan something    │
│  fun with your group!      │
│                            │
│   [Schedule an Event]      │
│                            │
│  or [Auto-Schedule] →      │ ← Secondary smart option
└────────────────────────────┘
```

### Empty State Checklist
- [ ] Has friendly illustration
- [ ] Uses encouraging copy (not negative)
- [ ] Clear value proposition
- [ ] Obvious next action (CTA)
- [ ] Provides secondary options
- [ ] Matches brand personality

---

## 💬 Error Messages & Recovery

### Error Message Formula
```
[What went wrong] + [Why it matters] + [How to fix it] + [CTA]
```

### Examples

#### Bad ❌
"Error creating group"

#### Good ✅
```
┌────────────────────────────────────────┐
│  Oops! We couldn't create your group   │
│                                        │
│  We need a group name to get started.  │
│  What should we call it?               │
│                                        │
│  [Enter Group Name] [Try Again]        │
└────────────────────────────────────────┘
```

#### Bad ❌
"Search failed"

#### Good ✅
```
┌────────────────────────────────────────┐
│  No venues found nearby                │
│                                        │
│  We couldn't find any venues matching  │
│  "Supreme Dumplings" in San Francisco  │
│                                        │
│  Try:                                  │
│  • Checking your spelling              │
│  • Searching for a category like       │
│    "Chinese food" instead              │
│  • Expanding your search radius        │
│                                        │
│  [Try Again] [Browse All Venues]       │
└────────────────────────────────────────┘
```

### Error Types & Handling

#### Validation Errors (Forms)
- **Show immediately** as user types
- **Inline below field** (red text, red border)
- **Clear icon** to help user fix
- Example: "Email must include @"

#### Network Errors
- **Retry button** prominent
- **Explain what happened** (lost connection, server busy)
- **Offer alternative** (try again later, work offline)

#### Permission Errors
- **Explain why permission needed**
- **Show how to grant it**
- Example: "We need location access to find venues near you"

### Loading States

#### Types
1. **Skeleton screens** - Show shape of content loading
2. **Spinners** - Small actions (buttons, inline)
3. **Progress bars** - Long operations (file uploads)
4. **Messages** - Explain what's happening

#### Good Loading Messages
- "Finding the perfect venues nearby..."
- "Checking everyone's availability..."
- "Creating your event... almost there!"
- "Saving your preferences..."

Not:
- "Loading..."
- "Please wait..."
- "Processing..."

---

## 🎨 Responsive Design Guidelines

### Breakpoints
```
Mobile:   < 640px   (sm)
Tablet:   640-1024px (md, lg)
Desktop:  > 1024px   (lg+)
```

### Mobile-First Approach
Design for mobile first, enhance for larger screens:

```jsx
// Start with mobile, add desktop styles
<div className="
  flex-col           /* Mobile: stack vertically */
  gap-4              /* Mobile: 16px gap */
  md:flex-row        /* Tablet+: horizontal */
  md:gap-6           /* Tablet+: 24px gap */
  lg:gap-8           /* Desktop: 32px gap */
">
```

### Touch Targets (Mobile)
- **Minimum:** 44×44px (iOS guideline)
- **Comfortable:** 48×48px
- **Spacing between:** At least 8px

### Typography Scaling
```
/* Mobile */
H1: 28px
H2: 24px
H3: 20px
Body: 16px

/* Desktop */
H1: 36px
H2: 30px
H3: 24px
Body: 16px (same)
```

### Layout Patterns

#### Mobile
- Single column
- Stack cards vertically
- Full-width buttons
- Bottom navigation
- Swipeable tabs

#### Desktop
- Multi-column grid (2-3 columns)
- Horizontal card layouts
- Inline actions
- Top navigation
- Click-based tabs

---

## ♿ Accessibility Standards

### WCAG AA Compliance (Minimum)

#### Color Contrast
- **Normal text:** 4.5:1 minimum
- **Large text (18px+):** 3:1 minimum
- **UI components:** 3:1 minimum

Test with: https://webaim.org/resources/contrastchecker/

#### Keyboard Navigation
- **All interactive elements** must be keyboard accessible
- **Tab order** must be logical
- **Focus indicators** must be visible (blue outline)
- **Skip to main content** link for screen readers

#### Screen Reader Support
- **Alt text** for all meaningful images
- **ARIA labels** for icon-only buttons
- **ARIA live regions** for dynamic content
- **Form labels** properly associated with inputs

#### Forms
- Every input must have a label
- Error messages must be announced
- Required fields must be marked
- Help text must be associated with inputs

### Accessibility Checklist
- [ ] All text meets contrast ratio
- [ ] Can navigate entire app with keyboard
- [ ] Focus indicators visible
- [ ] All images have alt text
- [ ] Screen reader tested
- [ ] Form errors are announced
- [ ] No color-only information

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1) - Visual Identity
**Time: 6-8 hours**

1. **Color System** (2h)
   - Choose and implement color palette
   - Update Tailwind config with new colors
   - Create color utility classes

2. **Typography** (2h)
   - Add Google Fonts (Poppins + Inter)
   - Implement type scale
   - Update all headings/body text

3. **Spacing System** (1h)
   - Standardize spacing scale
   - Update Tailwind config
   - Audit and fix inconsistent spacing

4. **Component Audit** (2-3h)
   - Document current components
   - Identify inconsistencies
   - Create component style guide

**Deliverable:** Updated brand identity, consistent visual foundation

---

### Phase 2: Core Components (Week 2) - UI Library
**Time: 10-12 hours**

1. **Buttons** (2h)
   - Standardize button types (primary, secondary, ghost, destructive)
   - Implement hover/active states
   - Add loading states

2. **Cards** (3h)
   - Redesign card component
   - Add hover effects
   - Implement skeleton loading states
   - Create card variants (event, venue, group)

3. **Forms** (3h)
   - Standardize input styles
   - Add inline validation
   - Improve error messages
   - Mobile touch optimization

4. **Dialogs/Modals** (2-3h)
   - Implement ResponsiveDialog component
   - Desktop: modal
   - Mobile: bottom sheet (Vaul)
   - Consistent header/footer

5. **Navigation** (2h)
   - Mobile: hamburger menu or bottom nav
   - Desktop: top header consistency
   - Active state highlighting

**Deliverable:** Consistent, reusable component library

---

### Phase 3: Delight & Polish (Week 3) - Micro-Interactions
**Time: 8-10 hours**

1. **Animations** (3h)
   - Button hover/press animations
   - Card hover effects
   - Page transitions
   - Loading animations

2. **Empty States** (2-3h)
   - Design illustrations
   - Write friendly copy
   - Implement for all empty views

3. **Success Celebrations** (1h)
   - Toast notifications
   - Confetti on major actions
   - Success modals

4. **Error Handling** (2-3h)
   - Rewrite all error messages
   - Add recovery actions
   - Better loading states

5. **Final Polish** (2h)
   - Fix remaining inconsistencies
   - Smooth rough edges
   - Mobile testing and fixes

**Deliverable:** Polished, delightful user experience

---

### Phase 4: Mobile Optimization (Week 4-5) - See mobile-optimization.md
**Time: 22-28 hours**

Separate comprehensive plan already documented in `mobile-optimization.md`.

---

## 📋 Design Review Checklist

Before shipping any new design:

### Visual Design
- [ ] Uses approved color palette
- [ ] Typography follows type scale
- [ ] Spacing uses 4px-based scale
- [ ] Consistent border radius
- [ ] Proper visual hierarchy

### Components
- [ ] Uses standard button types
- [ ] Cards have hover states
- [ ] Forms have inline validation
- [ ] Modals are responsive (Dialog/Drawer)
- [ ] Loading states implemented

### UX
- [ ] Empty states are helpful
- [ ] Error messages are actionable
- [ ] Success feedback is clear
- [ ] Navigation is intuitive
- [ ] Mobile friendly

### Accessibility
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigable
- [ ] Screen reader tested
- [ ] Focus indicators visible
- [ ] Alt text on images

### Performance
- [ ] Animations are 60fps
- [ ] Images are optimized
- [ ] No layout shift
- [ ] Fast loading time

---

## 📚 Resources & References

### Design Inspiration
- **Linear** (linear.app) - Clean, fast, delightful
- **Stripe** - Professional but friendly
- **Notion** - Great empty states and onboarding
- **Partiful** - Fun event planning vibes
- **Airbnb** - Warm, inviting, social

### Tools
- **Figma** - Design mockups
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library (already using)
- **Framer Motion** - Animations (already installed)
- **Vaul** - Mobile drawers (already installed)

### Testing
- **WebAIM Contrast Checker** - Color contrast
- **WAVE** - Accessibility testing
- **Lighthouse** - Performance + accessibility audit
- **BrowserStack** - Cross-device testing

### Learning
- **Refactoring UI** - Design for developers
- **Laws of UX** - Psychology principles
- **Material Design** - Component patterns
- **Human Interface Guidelines** - iOS best practices

---

*Design system created: 2025-11-23*
*Status: Ready for implementation - see Implementation Strategy section for sequencing*
*Start with Track 1 (Foundation) while continuing product development*
*See also: [Dashboard Mockup](./dashboard-mockup.md), [Mobile Optimization](./mobile-optimization.md)*
