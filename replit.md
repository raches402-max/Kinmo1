# Kinmo.ai - AI Group Activity Planner

## Overview
Kinmo.ai is an AI-powered application designed to streamline group activity planning. It generates personalized activity and venue suggestions based on collective preferences, budget, and location. The platform allows users to create groups, invite members, and receive tailored recommendations with detailed venue information, fostering more frequent social interactions. The project aims to provide a robust, scalable, and user-friendly solution for social planning, leveraging AI to enhance the user experience and drive social engagement.

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
- **Data Storage**: PostgreSQL via Neon serverless, Drizzle ORM for type-safe operations, Drizzle Kit for migrations. Schema includes `groups`, `members`, `activities`, `itineraries`, `itinerary_items`, `group_collections`, `category_search_history`, `group_backups`, and `database_backups` tables with UUID primary keys and cryptographically random tokens for shareable links.
- **Automatic Backup System**: Transparent data protection via `group_backups` table, capturing complete group state on every create/update and maintaining the last 10 backups.
- **Data Loss Prevention & Auto-Reconciliation**: Implemented `onDelete: "set null"` for `userId` foreign keys in `groups` and `groupBackups` to preserve data during auth session recreation. Automatic reconciliation re-links orphaned groups/members by email.
- **Database Backup & Restore System**: Admin Dashboard feature for manual and automatic full database snapshots, maintaining 30 most recent backups.
- **Member Management**: Members claim accounts via unique claim tokens; "Events Dashboard" for viewing pending, upcoming, and past events.
- **User Profile System**: Dedicated `/profile` page for authenticated users to manage personal information.

### Feature Specifications
- **AI Suggestion Generation**: GPT-4o generates diverse venue suggestions, optimized for prompt length and Google Places API calls. Includes category filtering (5 buckets: MEAL, CAFE, DRINKS, DESSERT, EXPERIENCES), on-demand generation, and a "Multi-venue outing" toggle. AI prompts explicitly request "SPECIFIC REAL VENUE NAME" to improve precision.
  - **Category Filter Architecture**: Database stores category toggles as camelCase (`mealEnabled`, `cafeEnabled`, etc.). Frontend sends snake_case API requests (`meal_enabled`), which are mapped to camelCase before database updates. Generation code reads camelCase properties from database objects. Retry logic correctly targets only ENABLED underrepresented categories.
  - **Venue Type-Aware Cache Matching**: AI suggestions include specific venueType (e.g., "steakhouse", "cocktail bar", "sushi restaurant"). Cache search filters by venue type using `tags` array (Google Places types) with tiered matching: (1) Exact tag match (e.g., "steakhouse" matches tags containing "steakhouse"), (2) Fuzzy keyword match (e.g., "steakhouse" matches tags with "steak"), (3) Category-only fallback. This prevents broad matches (e.g., "steakhouse" returning all restaurants) and improves cache hit rate from ~15% to >50% for SF searches.
  - **Budget Filter NaN Handling**: Venues with missing price data (NaN) are allowed for budgets ≥ $100 (treated as price level 0), rejected for budgets < $100 (treated as price level 999).
- **Event Management**: Group owners can delete events with proper authorization.
- **Google Reviews Integration**: Fetches and summarizes Google reviews for activity cards.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts.
- **Deduplication**: Prevents duplicate suggestions.
- **Activity Category Selection**: Visual selector with 17 activity types and automatic categorization.
- **Enhanced Favorites**: Enriches manually added favorites with Google Places data.
- **Shopping Cart Itinerary Builder**: Multi-select flow for building itineraries (1-5 venues) with reordering, real-time distance calculations, AI validation, and auto-naming.
- **Location Radius Expansion**: 4-tier search radius selector with adaptive AI prompts.
- **Group Emoji Personalization**: Custom emoji selection for group identification.
- **Location-Based Filtering with Geocoding**: Converts location strings to latitude/longitude for precise searching.
- **AI Preference Insights**: Analyzes user feedback patterns to surface key preference insights.
- **AI-Driven Scheduling System**: Organizers set general group availability, and AI picks optimal times, supporting RSVP and structured feedback.
- **Organizer RSVP System**: Group owners can RSVP to their own events.
- **Multi-Date/Time Voting**: Organizers propose multiple date/time options, with member voting and "Most Popular" badges.
- **AI Auto-Scheduling**: Proactive event generation with organizer approval flows.
- **Group Collections/Tags**: Users can organize groups into custom collections.
- **Event Hosting Rotation**: Opt-in hosting system where members volunteer to host.
- **Optional Member Registration**: Members can optionally complete profiles to improve AI recommendations.
- **Post-Event Feedback**: Collects venue ratings and frequency preferences for past events.
- **Admin Dashboard**: Platform health monitoring dashboard at `/admin` with analytics and database maintenance tools. Includes:
  - **Analytics Tab**: Interactive venue analytics dashboard showing curated venues distribution and drill-down capabilities.
  - **Maintenance Tab**: Tools for cleaning up curated venues using AI validation (GPT-4o-mini) and accessing archived deleted venues.

## External Dependencies

-   **OpenAI**: GPT-4o for main activity suggestion generation; GPT-4o-mini for other AI features (swipe concepts, categorization, preference insights, naming, time selection, scheduling).
-   **Google Places API (New)**: Migrated to new Places API (v1) using direct HTTP requests for Text Search, Nearby Search, and Place Details. Legacy APIs for Geocoding and Timezone. Features field masking and multi-key load balancing for quota distribution. Utilizes a cache-first strategy with a `curated_venues` table for pre-loaded data, reducing API calls and costs. Includes fuzzy venue matching for curated venues and an auto-caching system for high-quality API results. Cost optimizations implemented through Basic tier usage, reduced AI suggestions, persistent database caching, and direct Text Search data usage.
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins, PostCSS with Autoprefixer.
-   **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_API_KEY_2` (optional), `NODE_ENV`.