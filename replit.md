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
- **Member Management**: Members can claim their accounts through unique claim tokens, linking their email to a Replit Auth user account.
    - **Claim Flow**: Members receive welcome emails with `/claim/:claimToken` links that allow them to authenticate and link their account.
    - **Auto-Claim**: Claim page automatically claims membership when user is authenticated (via useEffect hook).
    - **Group Access**: `getUserGroups` API returns groups where user is either organizer or claimed member (via members.userId join).
    - **RSVP Routes**: RSVP links use format `/rsvp/:itineraryId/:inviteToken` for secure member authentication.
    - **Member Events Dashboard**: Dedicated `/events` page where members can view all pending invitations, upcoming events, and past events in one place, reducing reliance on email. Features include:
        - **Dual Access Pattern**: Supports both authenticated users (via session) and unclaimed members (via claim token stored in localStorage)
        - **Event Categorization**: Automatically separates events into pending invitations (awaiting RSVP), upcoming events (RSVP'd or organizing), and past events
        - **Navigation Integration**: "My Events" button in dashboard header with badge showing pending invitation count
        - **Email Integration**: All email templates (invites, reminders, welcome, reschedule) include footer links to `/events` page using robust URL API parsing via `getEventsUrl` helper
        - **Claim Token Persistence**: Claim tokens stored in localStorage for seamless access to events page without re-authenticating, cleared after successful account claim

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
    - **Timing Recommendations**: Optional organizer notes field for saved itineraries to specify when a plan works best (e.g., "Best for Saturday brunch" or "Sunday when there's a Monday holiday"). Notes can be added when saving an itinerary (hidden by default in a collapsible section) and are displayed with a Clock icon on saved itinerary cards. Users can view and edit timing notes at any time through the Edit Plan dialog.
- **Location Radius Expansion**: 4-tier search radius selector (Nearby, Citywide, Special Trip, Road Trip) with corresponding quality filtering. AI prompts and Google Places searches adapt to the selected radius.
- **Group Emoji Personalization**: Allows users to select or input custom emojis for group identification.
- **Location-Based Filtering with Geocoding**: Converts location strings to latitude/longitude for precise search filtering using Google Geocoding API. Includes user feedback for geocoding failures and backfill support.
- **AI Preference Insights**: Analyzes user feedback patterns to surface 3-5 key preference insights using GPT-4o-mini, refreshing automatically or manually.
- **AI-Driven Scheduling System**: Fully automated scheduling where organizers set general group availability and AI automatically picks optimal times. Features include:
    - **Availability Conversion**: Converts group availability objects to natural language strings for AI comprehension (e.g., `{weekdayEvenings: true}` → "Weekday evenings")
    - **Venue-Type Awareness**: AI matches event times to venue types (brunch → weekend mornings, dinner → evenings, etc.)
    - **International Timezone Support**: Worldwide timezone detection using Google Timezone API. When a group's location is geocoded, the system automatically fetches and stores the IANA timezone identifier (e.g., "Europe/London", "Asia/Tokyo", "Australia/Sydney"). Includes DST-aware date handling using date-fns-tz for correct local time interpretation year-round. Frontend displays friendly timezone names (e.g., "UK Time", "Japan Time") and supports editing AI time suggestions in the group's local timezone. Backfill endpoint available to populate timezones for existing groups. Fallback to US-only timezone mapping (Pacific, Mountain, Arizona, Central, Eastern) for groups created before international support.
    - **Secure RSVP System**: Itinerary-specific invite tokens prevent cross-itinerary spoofing with atomic database locking
    - **RSVP Feedback Collection**: Structured feedback (tryEarlier, tryLater, unavailableDays) informs auto-rescheduling
    - **Auto-Reschedule Logic**: Triggers when >50% negative RSVPs with ≥3 responses, uses atomic conditional UPDATE for race condition prevention
    - **Email Integration**: Sends RSVP invites and reschedule notifications via Resend API
    - **Multi-Time Selection**: Organizers can select 2+ scheduling options (AI-generated or manual) and send all at once. Creates separate proposed itineraries for each selected time with full venue data. Members RSVP to each option independently via in-app flow. Email notifications not sent for multi-date sends (MVP limitation).
    - **Proposed Itinerary Management**: Organizers can edit and delete proposed (sent-out) itineraries before they are finalized. Features include:
        - **Edit Functionality**: Opens edit dialog with pre-populated data (name, venues, event date/time, timing notes). Event date/time picker shows in group's timezone with proper conversion handling. Supports editing venues (add, remove, reorder) via drag-and-drop interface.
        - **Delete Functionality**: Shows confirmation dialog warning that deletion is permanent and removes all RSVPs.
        - **Access Control**: Both actions only available to group owners for non-scheduled itineraries.
        - **Cache Invalidation**: Updates saved itineraries, proposed itineraries, and member events dashboard after changes.
- **AI Auto-Scheduling**: Proactive event generation to maintain group meeting cadence. Features include:
    - **Automatic Event Creation**: 10 days before next event due date, AI creates pending proposal for organizer approval
    - **Smart Itinerary Selection**: Prioritizes saved itineraries → favorites → AI-generated content similar to group preferences
    - **Organizer Approval Flow**: Pending events shown in Plans tab with countdown timer for review
    - **Auto-Send Fallback**: If organizer doesn't act 3 days before target date, system automatically sends best option to group
    - **Frequency Feedback**: RSVP flow includes question about meeting frequency (more often/just right/less often)
    - **Adaptive Scheduling**: When >50% of members vote for frequency change, system adjusts group's meeting cadence
    - **Frequency Tracking**: Database tracks lastEventDate and nextEventDueDate to maintain consistent scheduling
    - **Configurable**: Organizers can enable/disable auto-scheduling in group settings

## Performance Optimizations

### Google Places API Caching System
Comprehensive session-level caching reduces API billing costs by 40-60% during activity generation:

-   **Three-Tier Cache Strategy**:
    -   `placeDetails`: Keyed by place_id to prevent duplicate venue lookups
    -   `searchResults`: Keyed by query+location to reuse text search results
    -   `nearbyResults`: Keyed by coordinates+query to cache complementary venue searches
-   **Cache Lifecycle**: Cache is cleared at the start of each generation session and persists across retry attempts within the same session
-   **Mutation Prevention**: Deep cloning on both write (cache miss) and read (cache hit) prevents downstream code from contaminating cached data
-   **Metrics Tracking**: Hit/miss counters for each API type with end-of-generation summary showing total calls, hit rate percentage, and API calls saved
-   **Cache Observability**: Generation session logs include detailed metrics:
    ```
    [API Optimization] ━━━ Cache Performance Summary ━━━
    [API Optimization] Total API calls: 150
    [API Optimization] Cache hits: 60 (40.0%)
    [API Optimization] ✅ API calls saved: 60
    [API Optimization] Breakdown:
    [API Optimization]   - placeDetails: 25 hits / 35 misses
    [API Optimization]   - textSearch: 20 hits / 40 misses
    [API Optimization]   - nearbySearch: 15 hits / 15 misses
    ```
-   **Additional Optimizations**:
    -   Blacklist filtering before API calls prevents repeated lookups of venues Google Places can't find
    -   Photo URLs stored in database eliminate repeated Google Photo API requests
    -   Complementary venue data cached in database for reuse across suggestions

## External Dependencies

-   **OpenAI**: GPT-4o-mini for AI activity suggestion and preference reasoning.
-   **Google Places API**: Text search, Photo API, Geocoding API, and enrichment data. Session-level caching reduces billing by 40-60%.
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins, PostCSS with Autoprefixer.
-   **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV`.