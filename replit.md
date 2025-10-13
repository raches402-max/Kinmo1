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
- **Schema Design**: `groups` (planning preferences, budget, location, AI status), `members` (invitations, availability, organizer status), `activities` (AI suggestions, Google Places data), `itineraries` (validated multi-venue plans with AI notes), and `itinerary_items` (individual venues in itineraries). Uses UUID primary keys and cryptographically random tokens for shareable links.
- **Data Access Layer**: `IStorage` interface, `DatabaseStorage` class, transaction support, cascade deletion.

### Core Features & AI Logic
- **AI Suggestion Generation**: Uses GPT-4o-mini to generate 15 diverse suggestions per attempt, which are then deduplicated to 6 unique venues. Retries up to 3 times to ensure 6 cards.
  - **Prompt Refinement**: Focuses on specific cuisines, avoids adjectives and budget mentions, and provides ultra-short, pragmatic descriptions (2-4 words, nouns only).
  - **Preference Interpretation**: AI prioritizes venue types based on past preferences, uses novelty as a percentage split (familiar vs. new), and integrates voting feedback (up/downvotes on favorites) and direct card feedback ("More like this," "Not this," "Heart").
  - **Natural Language Understanding**: The temporary instructions text box uses GPT-4's natural language understanding to interpret user intent. Specific requests like "Boba" or "Sushi" generate all suggestions of that type, while general guidance like "something adventurous" maintains diversity. No detection heuristics - relies entirely on AI's ability to understand context.
- **Google Reviews Integration**: Fetches 4-5 star Google reviews and creates summarized positive highlights (e.g., "Great food • Amazing atmosphere • Highly recommend"). Review counts displayed in rating badges. Activity cards sorted by highest rating first, then highest review count.
- **Tinder-Style Swipe Feed**: Allows users to refine preferences by swiping on AI-generated activity concepts, influencing future suggestions.
- **Deduplication**: Comprehensive tracking of AI-suggested types and Google business names to prevent duplicate suggestions within and across batches.
- **Complementary Food Suggestions**:
  - For full meal venues, suggests nearby drinks/desserts (e.g., cocktail bars, boba, ice cream).
  - For drinks/dessert venues, suggests nearby full meals (e.g., restaurants, sandwiches).
  - For outdoor venues, suggests nearby portable meal options within a 0.5-mile radius with 3.5+ star ratings.
  - Uses simple keyword-based queries (not full natural language) optimized for Google Places Nearby Search API.
- **Activity Category Selection**: Visual selector with 17 activity types for quick preference setting, integrated into AI suggestions.
- **Enhanced Favorites with Google Places Enrichment**: When users manually add events to the Favorites voting list, the system automatically looks up the venue in Google Places and enriches the entry with venue details (photo, rating, review count, address, price level, Google Maps link). Includes graceful degradation if enrichment fails.
- **Multi-Select Itinerary Builder**: Users can select 2-5 venues from activities and favorites to create an evening itinerary. AI validates proximity (using Google Places coordinates), operating hours, and logical flow, then proposes an ordered sequence. Users can drag-to-reorder venues in the itinerary display using @dnd-kit. The system stores itineraries with AI validation notes and supports real-time order updates.

## External Dependencies

-   **OpenAI Integration**: GPT-4o-mini model for AI activity suggestion and preference-aware reasoning.
-   **Google Places API**: Text search for venue discovery, Photo API for imagery, and enrichment data (ratings, price levels, addresses, place IDs).
-   **Third-Party UI Libraries**: Radix UI, Tailwind CSS, `class-variance-authority`, `date-fns`, Lucide React.
-   **Development Tools**: TypeScript, ESBuild, Vite plugins (cartographer, dev-banner, runtime-error-modal), PostCSS with Autoprefixer.
-   **Environment Requirements**: `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV`.