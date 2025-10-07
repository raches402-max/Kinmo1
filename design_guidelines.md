# Design Guidelines: AI Group Activity Planner

## Design Approach

**Selected Framework**: Hybrid approach drawing from Notion's clean productivity aesthetics combined with Eventbrite's event-focused experience, enhanced with modern SaaS design patterns from Linear.

**Core Philosophy**: Create a sophisticated planning tool that feels approachable and social. Balance data-heavy forms with visual warmth through strategic use of imagery, thoughtful spacing, and intelligent information hierarchy.

## Color Palette

**Light Mode:**
- Primary: 262 80% 50% (vibrant purple - trust and creativity)
- Primary Hover: 262 80% 45%
- Background: 0 0% 100%
- Surface: 240 5% 96%
- Border: 240 6% 90%
- Text Primary: 240 10% 4%
- Text Secondary: 240 5% 45%
- Success: 142 76% 36%
- Warning: 38 92% 50%

**Dark Mode:**
- Primary: 262 85% 60%
- Primary Hover: 262 85% 65%
- Background: 240 10% 4%
- Surface: 240 6% 10%
- Border: 240 4% 16%
- Text Primary: 0 0% 98%
- Text Secondary: 240 5% 65%
- Success: 142 70% 45%
- Warning: 38 92% 60%

## Typography

**Font Families:**
- Headings: 'Inter', sans-serif (700 weight for impact)
- Body: 'Inter', sans-serif (400 regular, 500 medium)
- UI Elements: 'Inter', sans-serif (500 medium, 600 semibold)

**Type Scale:**
- Hero/Display: text-5xl md:text-6xl (60px/72px)
- Page Titles: text-3xl md:text-4xl (36px/48px)
- Section Headers: text-2xl md:text-3xl (24px/30px)
- Card Titles: text-xl (20px)
- Body: text-base (16px)
- Small/Meta: text-sm (14px)
- Labels: text-xs uppercase tracking-wide

## Layout System

**Spacing Units**: Utilize Tailwind's 4, 6, 8, 12, 16, 24 for consistent rhythm
- Component padding: p-6 (cards), p-8 (sections)
- Section spacing: space-y-12 to space-y-16
- Grid gaps: gap-6 to gap-8
- Form fields: space-y-4

**Container Strategy:**
- Max widths: max-w-7xl for full sections, max-w-4xl for forms
- Responsive grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for activity cards

## Core Components

**Hero Section:**
- Full-width gradient background (purple to indigo subtle blend)
- Large hero image showcasing diverse group activities (people planning, socializing, exploring venues)
- Centered heading with primary CTA
- Height: min-h-[600px] with content centered

**Group Creation Form:**
- Multi-step wizard layout with progress indicator
- Grouped form sections with clear headers
- Sliding scales with visual feedback (track fill, current value display)
- Member list with add/remove controls and avatar placeholders
- Form fields: rounded-lg, focus:ring-2 focus:ring-primary

**Activity Cards:**
- Image thumbnail (Google Places photo) at top
- Venue name (text-lg font-semibold)
- Rating stars + review count
- Location badge with distance
- Price level indicator ($$$ visual)
- Quick action buttons (Save, Share, Details)
- Hover effect: subtle lift (transform translate-y-[-4px])

**Invitation System:**
- Copy link input with one-click copy button
- Email list with status indicators (sent, opened, RSVP'd)
- Visual timeline showing invitation flow
- Group chat link prominent with icon

**Member Portal:**
- Personal preference dashboard
- Availability calendar grid
- Previous activity history cards
- Preference editing inline

**Navigation:**
- Top navbar: Logo left, primary nav center, user profile right
- Sticky on scroll with backdrop blur
- Mobile: hamburger menu with slide-out drawer

**Buttons:**
- Primary: bg-primary text-white rounded-lg px-6 py-3
- Secondary: bg-surface border border-border
- Outline on images: backdrop-blur-md bg-white/10 border border-white/20 (no hover states needed)
- Icon buttons: rounded-full p-2

**Input Fields:**
- Rounded-lg borders
- Light fill in dark mode (bg-surface)
- Focus states: ring-2 ring-primary
- Floating labels for elegance
- Helper text below in text-secondary

**Data Visualization:**
- Budget range: dual-thumb slider with gradient fill
- Closeness scale: emoji scale (🙂 to ❤️) with labels
- Meeting frequency: button group selector
- Availability: visual grid calendar

## Images & Visual Assets

**Hero Image**: Large, inspiring photo of diverse friend group planning activities together or exploring a city - warm, inviting atmosphere. Full-width at 600px height minimum.

**Activity Cards**: Real venue photos from Google Places API at 16:9 aspect ratio (400x225px). Fallback to category illustrations if unavailable.

**Empty States**: Friendly illustrations for "No activities yet" and "Add your first group" states.

**Icons**: Use Heroicons (outline style) for UI elements - location pins, calendar, users, settings, etc.

## Animations

Minimal, purposeful motion:
- Page transitions: fade-in only
- Card hover: subtle transform translate-y-[-4px] with transition-transform duration-200
- Button interactions: scale-95 on active
- Form validation: shake animation for errors
- Loading states: spinner for AI suggestions
- NO scroll-triggered animations, NO parallax effects

## Key UX Patterns

**Smart Defaults**: Pre-populate fields based on user history
**Progressive Disclosure**: Show advanced options only when needed
**Inline Validation**: Real-time feedback on form inputs
**Optimistic UI**: Show updates immediately while API processes
**Skeleton Screens**: Use during AI suggestion generation
**Contextual Help**: Tooltips on complex fields (sliding scales)

## Responsive Breakpoints

- Mobile: < 768px (single column, stacked forms)
- Tablet: 768px - 1024px (2-column grids)
- Desktop: > 1024px (3-column grids, sidebar layouts)