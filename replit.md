# Kinmo.ai - AI Group Activity Planner

## Overview
Kinmo.ai is an AI-powered application that simplifies group activity planning. It generates personalized activity and venue suggestions based on collective preferences, budget, and location, using AI to enhance social planning. The platform enables users to create groups, invite members, and receive tailored recommendations with venue details, photos, and ratings, facilitating informed decision-making and encouraging more frequent social interactions.

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
- **Backend**: Express.js REST API with TypeScript, custom Vite integration for HMR, middleware for logging and error handling, and session-based authentication.
- **API Design**: RESTful endpoints, JSON format, centralized error handling, and a background job pattern for AI activity generation.
- **Data Storage**: PostgreSQL via Neon serverless, Drizzle ORM for type-safe operations, Drizzle Kit for migrations.
    - **Schema**: Includes `groups`, `members`, `activities`, `itineraries`, and `itinerary_items` tables with UUID primary keys and cryptographically random tokens for shareable links.
    - **Data Access**: `IStorage` interface, `DatabaseStorage` class, transaction support, and cascade deletion.

### Feature Specifications
- **AI Suggestion Generation**: GPT-4o-mini generates 15 diverse venue suggestions across 5 categories (MEAL, CAFES, DRINKS, DESSERT, EXPERIENCES), ensuring 3 cards per category. Includes category-aware retry logic and per-category regeneration.
    - **Prompt Refinement**: Focuses on specific cuisines and venue types, avoids quality adjectives, and provides concise descriptions.
    - **Preference Interpretation**: AI prioritizes venue types, balances familiar vs. new suggestions, and integrates user feedback (voting, "More like this," "Not this").
    - **Natural Language Understanding**: GPT-4 interprets user intent from temporary instruction texts for specific or general requests.
    - **Airport Venue Exclusion**: Hard rule to exclude airport venues unless explicitly requested.
- **Google Reviews Integration**: Fetches 4-5 star Google reviews, creates summarized positive highlights, and sorts activity cards by rating and review count.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts.
- **Deduplication**: Prevents duplicate suggestions within and across batches.
- **Complementary Food Suggestions**: Suggests nearby complementary venues (e.g., drinks after a meal) using keyword-based Google Places Nearby Search API queries.
- **Activity Category Selection**: Visual selector with 17 activity types and automatic categorization of AI-generated activities into 5 groups.
- **Enhanced Favorites**: Automatically enriches manually added favorites with Google Places data.
- **Shopping Cart Itinerary Builder**: Multi-select flow for building itineraries with an expandable cart preview, drag-to-reorder functionality, and real-time distance calculations. Supports 1-5 venues per itinerary.
    - **AI Validation**: Validates proximity, operating hours, and logical flow before itinerary creation.
    - **Nearby Add-On Suggestions**: Suggests high-rated nearby venues (<0.5 miles) to enhance the itinerary, displayed at the bottom of the Build tab.
    - **AI Auto-Naming**: Automatically generates contextual itinerary names based on venues and location when users don't provide a name. Examples: "Dinner at Ryoko's - Oakland", "SF Coffee & Desserts Tour". Includes deterministic fallback for API failures.
    - **Timing Recommendations**: Optional organizer notes field for saved itineraries to specify when a plan works best (e.g., "Best for Saturday brunch" or "Sunday when there's a Monday holiday"). Hidden by default in a collapsible section of the Save Itinerary dialog.
- **Location Radius Expansion**: 4-tier search radius selector (Nearby, Citywide, Special Trip, Road Trip) with corresponding quality filtering. AI prompts and Google Places searches adapt to the selected radius.
- **Group Emoji Personalization**: Allows users to select or input custom emojis for group identification.
- **Location-Based Filtering with Geocoding**: Converts location strings to latitude/longitude for precise search filtering using Google Geocoding API. Includes user feedback for geocoding failures and backfill support.
- **AI Preference Insights**: Analyzes user feedback patterns to surface 3-5 key preference insights using GPT-4o-mini, refreshing automatically or manually.
- **AI-Driven Scheduling System**: Fully automated scheduling where organizers set general group availability and AI automatically picks optimal times. Features include:
    - **Availability Conversion**: Converts group availability objects to natural language strings for AI comprehension (e.g., `{weekdayEvenings: true}` → "Weekday evenings")
    - **Venue-Type Awareness**: AI matches event times to venue types (brunch → weekend mornings, dinner → evenings, etc.)
    - **DST-Aware Timezone Handling**: Comprehensive US timezone mapping (Pacific, Mountain, Arizona, Central, Eastern) with automatic DST adjustment using date-fns-tz. Maps 100+ cities and all US states to IANA timezone identifiers. Uses whole-word matching for state abbreviations to prevent false matches. Creates naive Date via Date.UTC then converts with fromZonedTime for correct local time interpretation year-round.
    - **Secure RSVP System**: Itinerary-specific invite tokens prevent cross-itinerary spoofing with atomic database locking
    - **RSVP Feedback Collection**: Structured feedback (tryEarlier, tryLater, unavailableDays) informs auto-rescheduling
    - **Auto-Reschedule Logic**: Triggers when >50% negative RSVPs with ≥3 responses, uses atomic conditional UPDATE for race condition prevention
    - **Email Integration**: Sends RSVP invites and reschedule notifications via Resend API

## External Dependencies

-   **OpenAI**: GPT-4o-mini for AI activity suggestion and preference reasoning.
-   **Google Places API**: Text search, Photo API, Geocoding API, and enrichment data.
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins, PostCSS with Autoprefixer.
-   **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV`.