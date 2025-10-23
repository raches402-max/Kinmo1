# Kinmo.ai - AI Group Activity Planner

## Overview
Kinmo.ai is an AI-powered application designed to streamline group activity planning. It generates personalized activity and venue suggestions based on collective preferences, budget, and location. The platform allows users to create groups, invite members, and receive tailored recommendations with detailed venue information, fostering more frequent social interactions.

## User Preferences
Preferred communication style: Simple, everyday language.

AI suggestion preferences:
- Reasoning should be direct and concise - no flowery descriptions or fluff
- Clearly highlight when suggestions are "NEW" (outside the group's typical range)

## System Architecture

### UI/UX Decisions
- **Framework & Libraries**: React with TypeScript, Vite, Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms.
- **Component Strategy**: Radix UI primitives, shadcn/ui with Tailwind CSS, inspired by Notion, Eventbrite, and Linear.
- **Theming**: Light/dark mode support with a custom purple color palette, Inter font, consistent spacing and border radius, utilizing CSS variables.

### Technical Implementations
- **Backend**: Express.js REST API with TypeScript, custom Vite integration, and session-based authentication.
- **API Design**: RESTful endpoints, JSON format, centralized error handling, and a background job pattern for AI activity generation.
- **Data Storage**: PostgreSQL via Neon serverless, Drizzle ORM for type-safe operations, Drizzle Kit for migrations.
    - **Schema**: Includes `groups`, `members`, `activities`, `itineraries`, and `itinerary_items` tables with UUID primary keys and cryptographically random tokens for shareable links.
- **Member Management**: Members claim accounts via unique claim tokens. An "Events Dashboard" allows members to view pending, upcoming, and past events, supporting both authenticated and unclaimed users. RSVP links use itinerary-specific invite tokens.
- **User Profile System**: Authenticated users manage personal information via a dedicated `/profile` page, supported by a `user_profiles` table and secure API endpoints.

### Feature Specifications
- **AI Suggestion Generation**: GPT-4o-mini generates 15 diverse venue suggestions across 5 categories, with category-aware retry logic and prompt refinement to interpret preferences, integrate user feedback, and exclude airport venues.
- **Google Reviews Integration**: Fetches 4-5 star Google reviews, summarizes positive highlights, and sorts activity cards.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts.
- **Deduplication**: Prevents duplicate suggestions.
- **Complementary Food Suggestions**: Suggests nearby complementary venues using Google Places Nearby Search API.
- **Activity Category Selection**: Visual selector with 17 activity types and automatic categorization.
- **Enhanced Favorites**: Enriches manually added favorites with Google Places data.
- **Shopping Cart Itinerary Builder**: Multi-select flow for building itineraries (1-5 venues) with drag-to-reorder, real-time distance calculations, AI validation for proximity/operating hours, nearby add-on suggestions, AI auto-naming, and timing recommendations.
- **Location Radius Expansion**: 4-tier search radius selector (Nearby, Citywide, Special Trip, Road Trip) with adaptive AI prompts and Google Places searches.
- **Group Emoji Personalization**: Custom emoji selection for group identification.
- **Location-Based Filtering with Geocoding**: Converts location strings to latitude/longitude for precise searching using Google Geocoding API.
- **AI Preference Insights**: Analyzes user feedback patterns to surface 3-5 key preference insights using GPT-4o-mini.
- **AI-Driven Scheduling System**: Organizers set general group availability, and AI picks optimal times, considering venue types and international timezones (using Google Timezone API and `date-fns-tz`). Features a secure RSVP system, structured feedback for auto-rescheduling, multi-time selection, and management of proposed itineraries by organizers.
- **Organizer RSVP System**: Group owners can RSVP to their own events directly from the dashboard. Authenticated endpoint (POST /api/itineraries/:itineraryId/organizer-rsvp) allows organizers to indicate attendance (yes/maybe/no) using their userId without requiring member records. Dashboard displays organizer RSVP status alongside member RSVPs, with visual badges and quick-action buttons for attendance responses.
- **Multi-Date/Time Voting**: Organizers can propose multiple date/time options for events, displayed side-by-side in event cards. Members vote for preferred times by clicking time slots, with vote counts and top choice indicators shown in real-time. System tracks individual votes (proposedTimeSlots and timeSlotVotes tables), displays user's previous votes on revisit, and allows organizers to select the final time which updates the event's eventDate. **Implementation**: POST /api/itineraries/:id/send with eventDates array creates a single proposed itinerary with multiple time slots. Idempotency prevents duplicates on retry. Public GET /api/itineraries/:id endpoint supports unauthenticated RSVP page access, returning itinerary with proposedTimeSlots and vote counts.
- **AI Auto-Scheduling**: Proactive event generation to maintain group meeting cadence. AI creates pending proposals 10 days before the next event, prioritizing saved itineraries, favorites, or AI-generated content. Includes an organizer approval flow, auto-send fallback, frequency feedback collection, and adaptive scheduling based on member votes.

## External Dependencies

-   **OpenAI**: GPT-4o-mini for AI activity suggestion and preference reasoning.
-   **Google Places API**: Text search, Photo API, Geocoding API, and enrichment data, with session-level caching for cost reduction.
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins, PostCSS with Autoprefixer.
-   **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV`.