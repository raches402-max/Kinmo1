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
- **Data Storage**: PostgreSQL via Neon serverless, Drizzle ORM for type-safe operations, Drizzle Kit for migrations. Schema includes `groups`, `members`, `activities`, `itineraries`, `itinerary_items`, `group_collections`, and `category_search_history` tables with UUID primary keys and cryptographically random tokens for shareable links.
- **Member Management**: Members claim accounts via unique claim tokens. An "Events Dashboard" allows members to view pending, upcoming, and past events, supporting both authenticated and unclaimed users.
- **User Profile System**: Authenticated users manage personal information via a dedicated `/profile` page, supported by a `user_profiles` table and secure API endpoints.

### Feature Specifications
- **AI Suggestion Generation**: GPT-4o generates diverse venue suggestions across categories, with category-aware retry logic and prompt refinement. Includes category filtering, on-demand category-specific generation with custom location/radius, and a "Multi-venue outing" toggle for sorting preferences.
- **Event Management**: Group owners can delete events with proper authorization.
- **Google Reviews Integration**: Fetches and summarizes Google reviews for activity cards.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts, incorporating category filters.
- **Deduplication**: Prevents duplicate suggestions.
- **Activity Category Selection**: Visual selector with 17 activity types and automatic categorization.
- **Enhanced Favorites**: Enriches manually added favorites with Google Places data.
- **Shopping Cart Itinerary Builder**: Multi-select flow for building itineraries (1-5 venues) with reordering, real-time distance calculations, AI validation, nearby add-on suggestions, AI auto-naming, and timing recommendations.
- **Location Radius Expansion**: 4-tier search radius selector (Nearby, Citywide, Special Trip, Road Trip) with adaptive AI prompts.
- **Group Emoji Personalization**: Custom emoji selection for group identification.
- **Location-Based Filtering with Geocoding**: Converts location strings to latitude/longitude for precise searching.
- **AI Preference Insights**: Analyzes user feedback patterns to surface key preference insights.
- **AI-Driven Scheduling System**: Organizers set general group availability, and AI picks optimal times considering venue types and timezones. Features a secure RSVP system, structured feedback, multi-time selection, and itinerary management.
- **Organizer RSVP System**: Group owners can RSVP to their own events from the dashboard.
- **Multi-Date/Time Voting**: Organizers can propose multiple date/time options for events, with members voting for preferences. Displays vote breakdowns and "Most Popular" badges.
- **AI Auto-Scheduling**: Proactive event generation to maintain group meeting cadence, including organizer approval flows.
- **Group Collections/Tags**: Users can organize groups into custom collections (e.g., "Weekly Hangs", "Special Events") for better organization.
- **Event Hosting Rotation**: Opt-in hosting system where members volunteer to host specific events, with badges indicating hosts.
- **Optional Member Registration**: Members can optionally complete profiles (home base, activity preferences, availability) to improve AI recommendations.
- **Post-Event Feedback**: Collects venue ratings, frequency preferences, and notes for past events.
- **Admin Dashboard**: Platform health monitoring dashboard accessible at `/admin` for administrators, displaying key metrics, trends, and visualizations.

## External Dependencies

-   **OpenAI**: GPT-4o for main activity suggestion generation; GPT-4o-mini for other AI features (swipe concepts, categorization, preference insights, naming, time selection, scheduling).
-   **Google Places API (New)**: Migrated from legacy API to new Places API (v1) using direct HTTP requests.
    -   **Text Search**: POST to `places.googleapis.com/v1/places:searchText` with field masking
    -   **Nearby Search**: POST to `places.googleapis.com/v1/places:searchNearby` with location restrictions
    -   **Place Details**: GET to `places.googleapis.com/v1/places/{PLACE_ID}` with field masking
    -   **Legacy APIs**: Geocoding and Timezone still use legacy client (unchanged)
    -   **Field Masking**: Only request needed fields to minimize costs (displayName, formattedAddress, location, rating, userRatingCount, priceLevel, photos, types)
    -   **Multi-Key Load Balancing**: Supports rotating between two API keys (`GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACES_API_KEY_2`) to distribute quota across accounts. Round-robin rotation effectively doubles daily API quota.
    -   **Cache-First Strategy with Curated Venues**: Prioritizes pre-loaded San Francisco venue data over API calls for dramatic cost reduction (10-100x faster). Uses `curated_venues` table with strict geographic validation (SF bounding box + location string matching) to prevent venue leakage. On-demand photo fetching: first request fetches photos from Place Details API and caches in DB; subsequent requests use cached photos (zero API calls). For SF searches: returns 10-50ms (cache hit) vs 500-1500ms (API call). Curated venues include Place IDs, coordinates, ratings, addresses. Bulk import endpoint `/api/admin/import-venues` supports loading venues from external datasets.
    -   **Auto-Caching System**: High-quality API results (100+ reviews, 4.0+ rating) are automatically saved to the curated venues table after each search, creating a "self-learning" system. Works globally for any location - auto-detects region from coordinates (san_francisco, oakland, san_jose, bay_area, other). Duplicates are prevented via Place ID checks. The cache grows organically over time, progressively reducing API calls for popular searches. Cached venues are marked with `source: 'api_auto'` for tracking.
    -   **Cost Optimization**: Reduced from Advanced ($0.020) to Basic ($0.005) tier for Place Details (75% savings). AI suggestions reduced from 30 to 15 (50% fewer Text Search calls). Persistent database caching: 30-day TTL for Place Details, 24-hour TTL for Text Search results. Direct Text Search data usage eliminates 20 redundant Place Details calls per search (11.6x cost reduction). Cache-first curated venues eliminate most SF API calls entirely (10-100x cost savings for SF searches).
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins, PostCSS with Autoprefixer.
-   **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_API_KEY_2` (optional), `NODE_ENV`.