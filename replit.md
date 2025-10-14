# Kinmo.ai - AI Group Activity Planner

## Overview
Kinmo.ai is an AI-powered application designed to streamline group activity planning. It generates personalized activity and venue suggestions based on collective preferences, budget, and location, utilizing AI to enhance the social planning experience. The platform allows users to create groups, invite members, and receive tailored recommendations, including venue details, photos, and ratings, to facilitate informed decision-making. The project aims to remove friction from group planning and encourage more frequent social interactions.

## User Preferences
Preferred communication style: Simple, everyday language.

AI suggestion preferences:
- Reasoning should be direct and concise - no flowery descriptions or fluff
- Clearly highlight when suggestions are "NEW" (outside the group's typical range)

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React with TypeScript, Vite, Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms.
- **UI Component Strategy**: Radix UI primitives, shadcn/ui with Tailwind CSS, a hybrid design system inspired by Notion, Eventbrite, and Linear, and light/dark theme support.
- **Design Tokens**: Custom purple color palette, Inter font, consistent spacing and border radius, CSS variables for theming.

### Backend Architecture
- **Server Framework**: Express.js REST API with TypeScript, custom Vite integration for HMR, middleware for logging and error handling, session-based approach.
- **API Design Pattern**: RESTful endpoints, JSON format, centralized error handling, background job pattern for AI activity generation.
- **Core Business Logic Flow**: Group creation with preferences and members, asynchronous AI suggestion generation, Google Places API enrichment, polling for AI generation status, shareable invitation links.

### Data Storage
- **Database**: PostgreSQL via Neon serverless, Drizzle ORM for type-safe operations, Drizzle Kit for migrations.
- **Schema Design**: `groups` (planning preferences, budget, location, AI status, emoji icon), `members` (invitations, availability, organizer status), `activities` (AI suggestions, Google Places data), `itineraries` (validated multi-venue plans with AI notes), and `itinerary_items` (individual venues in itineraries). Uses UUID primary keys and cryptographically random tokens for shareable links.
- **Data Access Layer**: `IStorage` interface, `DatabaseStorage` class, transaction support, cascade deletion.

### Core Features & AI Logic
- **AI Suggestion Generation**: Uses GPT-4o-mini to generate ~30 diverse suggestions per attempt (typically returns 20-33), which are then deduplicated to 15 unique venues displayed as 3 cards per category. Retries up to 3 times with category-aware targeting to ensure balanced 3-3-3-3-3 distribution.
  - **Category-Aware Retry Logic**: After each attempt, tracks category distribution (MEAL, CAFES, DRINKS, DESSERT, EXPERIENCES). If any category has < 3 cards, makes a targeted retry requesting suggestions ONLY for underrepresented categories. This ensures balanced visual presentation with 3 cards per category row.
  - **Prompt Refinement**: Focuses on specific cuisines, avoids quality adjectives and budget mentions, and provides ultra-short, pragmatic descriptions (1-4 words maximum, food/cuisine nouns only, cuisine names allowed but zero quality adjectives). Uses specific venue types ("boba shop", "cocktail bar") instead of generic categories ("drink", "restaurant").
  - **Preference Interpretation**: AI prioritizes venue types based on past preferences, uses novelty as a percentage split (familiar vs. new), and integrates voting feedback (up/downvotes on favorites) and direct card feedback ("More like this," "Not this," "Heart").
  - **Natural Language Understanding**: The temporary instructions text box uses GPT-4's natural language understanding to interpret user intent. Specific requests like "Boba" or "Sushi" generate all suggestions of that type, while general guidance like "something adventurous" maintains diversity. No detection heuristics - relies entirely on AI's ability to understand context.
  - **Airport Venue Exclusion**: Hard rule to NEVER suggest airport venues (terminals, gates, airport restaurants/cafes/shops) unless explicitly requested by the user with terms like "airport activities" or "activities inside an airport".
- **Google Reviews Integration**: Fetches 4-5 star Google reviews and creates summarized positive highlights (e.g., "Great food • Amazing atmosphere • Highly recommend"). Review counts displayed in rating badges. Activity cards sorted by highest rating first, then highest review count.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts, influencing future suggestions.
- **Deduplication**: Comprehensive tracking of AI-suggested types and Google business names to prevent duplicate suggestions within and across batches.
- **Complementary Food Suggestions**:
  - For full meal venues, suggests nearby drinks/desserts (e.g., cocktail bars, boba, ice cream).
  - For drinks/dessert venues, suggests nearby full meals (e.g., restaurants, sandwiches).
  - For outdoor venues, suggests nearby portable meal options within a 0.5-mile radius with 3.5+ star ratings.
  - Uses simple keyword-based queries (not full natural language) optimized for Google Places Nearby Search API.
  - Automatically filters out the main venue from complementary results to prevent self-referencing.
- **Activity Category Selection**: Visual selector with 17 activity types for quick preference setting, integrated into AI suggestions.
- **Activity Categorization on Activities Tab**: AI-generated activities are automatically categorized and displayed in 5 groups for intuitive browsing:
  - 🍽️ **MEAL** - Restaurants, food markets, food halls (any time of day: breakfast, lunch, dinner)
  - ☕ **CAFES** - Coffee shops, cafes
  - 🍸 **DRINKS** - Bars, cocktail lounges, wine bars, breweries
  - 🍰 **DESSERT** - Boba, ice cream, dessert shops
  - 🎭 **EXPERIENCES** - Museums, concerts, karaoke, parks, events
  - Within each category, venues are sorted by rating (highest first), then review count
- **Enhanced Favorites with Google Places Enrichment**: When users manually add events to the Favorites voting list, the system automatically looks up the venue in Google Places and enriches the entry with venue details (photo, rating, review count, address, price level, Google Maps link). Includes graceful degradation if enrichment fails.
- **Shopping Cart Itinerary Builder**: Simplified multi-select flow for building itineraries:
  - **Tab 2 (Activities)**: Checkboxes always visible on activity cards and favorites - no selection mode toggle needed
  - **Floating Cart Badge**: Fixed position badge in bottom-right corner shows selection count (0-5) with shopping cart icon and disabled/enabled "Build Itinerary" button
  - **2-5 Venue Requirement**: Cart button disabled until 2 venues selected, maximum 5 venues with toast notification at limit
  - **Tab 3 (Build/Itinerary)**: Clicking cart button navigates to Build tab showing selected venues in organized card with "Create Itinerary" button
  - **AI Validation**: System validates proximity (using Google Places coordinates), operating hours, and logical flow, then creates ordered itinerary
  - **Drag-to-Reorder**: Users can reorder venues in final itinerary display using @dnd-kit
  - **State Management**: Selection state tracked via selectedVenues array, cleared after successful itinerary creation
- **Location Radius Expansion**: 4-tier search radius selector allowing users to expand search area from nearby (< 2 miles) to road trips (< 50 miles):
  - **📍 Nearby (< 2 miles)**: Walking or short drive distance, 3.0+ stars, 5+ reviews minimum
  - **🏙️ Citywide (< 10 miles)**: Venues across the city, 3.5+ stars, 20+ reviews minimum
  - **🚗 Special Trip (< 30 miles)**: Special destinations worth a drive, 4.0+ stars, 50+ reviews minimum
  - **🛣️ Road Trip (< 50 miles)**: Road trip worthy destinations, 4.2+ stars, 100+ reviews minimum
  - Quality filtering ensures farther venues are highly rated with substantial review counts
  - AI prompt adapts suggestions based on selected radius tier (nearby conveniences vs. destination-worthy gems)
  - Google Places searches use dynamic radius converted to meters (1 mile = 1609.34 meters)
  - Schema-level validation enforces only 2, 10, 30, 50 mile values with fallback to 2 miles default
- **Group Emoji Personalization**: Users can personalize their groups with emoji icons for visual identity:
  - **Random Default**: Groups created with a randomly selected emoji from a curated palette of 16 popular options
  - **Visual Picker**: Click-to-select emoji buttons in create and edit forms for quick selection
  - **Custom Input**: Text input field allows users to paste any emoji, including multi-codepoint variants (flags, skin tones, complex emoji)
  - **Display Locations**: Emoji displayed on group cards in dashboard, group detail page header, and all editing interfaces
  - **Inline Editing**: Emoji editable directly in Group Details tab with real-time preview and "Save Changes" button
  - **Fallback**: Groups without emoji default to 🎉 for consistent visual presentation

## External Dependencies

-   **OpenAI Integration**: GPT-4o-mini model for AI activity suggestion and preference-aware reasoning.
-   **Google Places API**: Text search for venue discovery, Photo API for imagery, and enrichment data (ratings, price levels, addresses, place IDs).
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins (cartographer, dev-banner, runtime-error-modal), PostCSS with Autoprefixer.
-   **Environment Requirements**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV`.