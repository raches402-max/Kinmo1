# Kinmo.ai - AI Group Activity Planner

## Overview

Kinmo.ai is an AI-powered group activity planning application that helps users discover and organize group activities based on collective preferences, budget constraints, and location. Using AI to take the friction out of seeing your kin, more. The application generates personalized venue and activity suggestions using OpenAI's GPT model and enriches them with real-world data from Google Places API.

The platform enables users to create groups, invite members, and receive tailored activity recommendations that consider factors like group closeness, novelty preferences, budget ranges, and meeting frequency. Each suggestion includes venue details, photos, ratings, and practical information to help groups make informed decisions.

## Recent Changes

### October 9, 2025
- **AI Prompt Refinement - No Fluff, Specific Cuisines, Always 6 Cards**:
  - **Specific Cuisines Only**: AI must now suggest specific cuisines (Sushi, Korean BBQ, Ramen, Pho, Dumplings, Thai, Vietnamese, etc.) instead of broad categories like "Asian restaurants" to avoid Google returning the same venues repeatedly
  - **No Sales Language**: Banned ALL adjectives including "Enjoy", "Savor", "Experience", "Discover", "Authentic", "Traditional", "Fresh", "Wood-fired", "Small", "Spicy", etc. - descriptions ultra-short and pragmatic (2-4 words max, NOUNS ONLY, ZERO adjectives): "Sushi and sashimi", "Korean BBQ", "Ramen bowls", "Dim sum", "Pizza and pasta"
  - **No Budget Mentions**: Reasoning field no longer mentions budget (assumed all suggestions fit budget) - now just 3-8 words focusing on preference match
  - **15→6 Deduplication Strategy with Retry**: AI generates 15 suggestions per attempt, system deduplicates after Google Places enrichment, then displays first 6 unique venues. If fewer than 6 unique after first attempt, retries up to 3 times (45 total suggestions max) to ensure 6 cards appear even in areas with limited venue diversity
  - **Why Duplicates Happen**: Google Places returns same restaurant for related searches (e.g., "dumpling restaurants" and "noodle restaurants" both return same venue that serves both)
- **Tinder-Style Swipe Feed for Preference Refinement**: Added swipeable activity concept cards for ongoing taste refinement:
  - **Database**: New `preference_signals` table tracks liked/passed concepts with timestamps
  - **Swipe Session**: Generates 15-20 AI concepts based on group preferences, users swipe right (like) or left (pass)
  - **AI Integration**: Swipe preferences feed into activity generation - AI prioritizes liked concepts and avoids passed ones
  - **Two Entry Points**: Optional swipe session after group creation, plus "Refine Ideas" button in group page for ongoing refinement
  - **Specific Activities**: Updated AI to suggest concrete activities ("Pottery Painting Workshop", "Hot Yoga Class", "Trivia at Irish Pub") instead of vague vibes ("bar hopping", "clubbing")
- **Fixed Duplicate Suggestions**: Completely eliminated duplicates in both main and complementary food suggestions:
  - **Comprehensive Tracking**: Duplicate prevention now tracks main venues (AI names + Google names) AND complementary food places (both complementaryPlaceName and complementaryPlaceName2)
  - **Within-Batch Deduplication**: Added deduplication AFTER Google Places returns results to catch when different search queries return the same business (e.g., "Szechuan restaurants" and "dim sum restaurants" both returning the same restaurant)
  - **Varied Complementary Queries**: AI now uses specific, varied food types instead of generic repeats:
    - Instead of "dessert shops" repeatedly → uses "artisan ice cream", "gelato shops", "craft cocktail bars", "boba tea cafes", "sake bars"
    - Instead of "restaurants" generically → uses "ramen shops", "taco spots", "banh mi shops", "poke bowl restaurants", "dim sum"
  - **Result**: Same venues won't appear multiple times across different suggestions
- **Refined Complementary Food Suggestions**: Improved AI logic AND Google Places filtering for nearby food recommendations:
  - **Distance & Quality Enforcement**: 
    - Google Places now uses `nearbySearch` API with 0.5 mile (805m) radius constraint
    - Filters results to only show 3.5+ star ratings
    - Previously, text search could return venues 4+ miles away (e.g., Supreme Dumplings at 4.4mi)
  - **Smart Pairing Logic**: 
    - Full meal venues (restaurants, brunch) → suggest drinks/dessert nearby (cocktail bars, boba, ice cream)
    - Drinks/dessert venues (cafes, bars, boba shops) → suggest full meals nearby (restaurants, sandwiches)
    - Outdoor venues (parks, hiking) → suggest portable meal options nearby
  - **Example Fix**: If main venue is boba (Wanpo), AI now suggests restaurants/food trucks instead of another dessert spot (Matcha Maiko)
- **Activity Category Selection**: Added visual category selector buttons with icons for quick preference setting:
  - **17 Activity Types**: Restaurants, Brunch Spots, Cafes, Wine/Cocktail Bars, Breweries/Beer Gardens, Food Markets/Food Halls, Potlucks, Concerts, Karaoke, Dancing/Clubs, Comedy Shows, Movie Theaters, Museums/Art Galleries, Sports Games, Hikes/Outdoors, Game Nights, Trivia Nights
  - **Food & Dining**: Expanded with restaurants, brunch, breweries, and food markets to cover diverse culinary experiences
  - **Entertainment & Culture**: Added comedy shows, movies, museums, and trivia nights to fill gaps in activity options
  - **Easy Selection**: Toggle buttons with lucide-react icons let organizers quickly select what their group enjoys
  - **AI Integration**: Selected categories are prioritized in AI suggestions to better match group interests
  - **Available In**: Both create group form and edit group dialog
- **Meeting Frequency Simplified**: Changed from plural to singular units (day, week, month, year) for cleaner display
- **AI Preference Interpretation Overhaul**: Completely redesigned how AI reads group preferences to be more accurate:
  - **Type Prioritization**: AI now analyzes past preferences to identify TYPES of venues (restaurants, bars, etc.) and prioritizes suggesting the same types they've historically enjoyed
  - **Closeness Level**: No longer influences activity types (reserved for future scheduling features like quorum)
  - **Novelty as Percentage**: Novelty preference now works as a split - Level 1 = all familiar, Level 3 = 3 familiar + 3 new, Level 5 = all new
  - **Familiar vs New**: "Familiar" means venues similar to past favorites or loved venues; "New" means novel experiences they haven't tried
- **Voting Integration into AI**: Favorites list voting now influences AI suggestions! The system tracks upvotes/downvotes on favorite venues and tells the AI to suggest more venues like highly-voted favorites and avoid venues similar to downvoted ones. This works alongside the existing heart/more/less feedback system.
- **Fixed Duplicate Venue Suggestions (Final)**: Enhanced duplicate prevention to track BOTH AI-suggested types AND actual Google business names, preventing repeats like "Sweet Indulgence" and "Central Park" from appearing again
- **Members in Group Details**: Moved members list into Group Details card as a collapsible section, removing the separate Members card for a more compact layout.
- **Meal Complementary Suggestions**: For restaurants/cafes/bars, AI now suggests pre/post meal options (dessert shops, cocktail bars, boba places, etc.) to complete the dining experience. These appear with the label "Complete the experience:" for meal venues, "Grab food nearby:" for outdoor venues.
- **Aligned Feedback Section**: Activity cards now use flexbox layout to keep the feedback section (More like this / Not this buttons) aligned at the bottom of each card, regardless of content length.
- **Feedback Integration Confirmed**: "Not this" (less), "More like this" (more), and heart (love) feedback are all configured to feed into AI suggestions. The system passes this feedback to the AI prompt so it can suggest more of what you love and less of what you don't prefer.

### October 7, 2025
- **Complementary Food Suggestions**: For outdoor venues like parks and beaches, the AI now suggests nearby food places (e.g., "pick up sandwiches at ____ near this park"). This helps groups plan complete outdoor experiences with food options.
- **Feedback Integration**: Activity feedback (love/more/less) is now fed back into the AI when generating new suggestions. The AI learns from previous feedback to suggest more of what the group loves and less of what they don't prefer.
- **Enhanced AI Context**: OpenAI prompts now include previous activity feedback and complementary food place recommendations for outdoor venues.

## User Preferences

Preferred communication style: Simple, everyday language.

AI suggestion preferences:
- Reasoning should be direct and concise - no flowery descriptions or fluff
- Clearly highlight when suggestions are "NEW" (outside the group's typical range)

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript using Vite as the build tool
- Client-side routing implemented with Wouter (lightweight alternative to React Router)
- State management through TanStack Query (React Query) for server state synchronization
- Form handling via React Hook Form with Zod schema validation

**UI Component Strategy**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library built on Radix UI with Tailwind CSS styling
- Design system follows hybrid approach inspired by Notion, Eventbrite, and Linear aesthetics
- Theme system supports light/dark modes with CSS custom properties
- Responsive design using Tailwind's mobile-first breakpoints

**Design Tokens**
- Custom color palette with purple primary (262° hue) for trust and creativity
- Inter font family for all typography
- Consistent spacing and border radius system
- CSS variables for dynamic theming with HSL color format

### Backend Architecture

**Server Framework**
- Express.js REST API with TypeScript
- Custom Vite integration for development with HMR (Hot Module Replacement)
- Middleware-based request logging and error handling
- Session-based approach (infrastructure in place via connect-pg-simple)

**API Design Pattern**
- RESTful endpoints following resource-based URL structure
- JSON request/response format
- Centralized error handling middleware
- Background job pattern for AI activity generation (fire-and-forget)

**Core Business Logic Flow**
1. Group creation accepts preferences and member list
2. AI suggestions generated asynchronously in background
3. Google Places API enriches suggestions with real venue data
4. Polling-based status updates for AI generation progress
5. Shareable links enable member invitation without authentication

### Data Storage

**Database**
- PostgreSQL via Neon serverless with WebSocket support
- Drizzle ORM for type-safe database operations
- Schema-first approach with Drizzle Kit for migrations
- Three main tables: groups, members, activities

**Schema Design**
- Groups table: stores planning preferences, budget, location, and AI generation status
- Members table: tracks invitations, availability, and organizer designation with cascade deletion
- Activities table: stores AI-generated suggestions with Google Places enrichment data
- UUID primary keys with automatic generation
- Shareable links use cryptographically random tokens

**Data Access Layer**
- Storage abstraction interface (IStorage) for potential future implementations
- DatabaseStorage class implements all data operations
- Transaction support for atomic group + member creation
- Cascade deletion ensures referential integrity

### External Dependencies

**OpenAI Integration**
- GPT-4o-mini model for activity suggestion generation
- Structured prompt engineering based on group preferences
- Preference-aware reasoning (closeness level, novelty preference, budget, additional instructions)
- Returns 6 diverse activity suggestions with search queries
- Error handling for empty or malformed responses

**Google Places API**
- Text search for venue discovery based on AI-generated queries
- Photo API for venue imagery with 400px max width
- Enrichment data: ratings, price levels, addresses, place IDs
- Fallback handling for missing photos or search results

**Third-Party UI Libraries**
- Radix UI: 20+ primitive components for accessibility
- Tailwind CSS: utility-first styling framework
- class-variance-authority: variant-based component styling
- date-fns: date manipulation utilities
- Lucide React: icon system

**Development Tools**
- TypeScript for type safety across stack
- ESBuild for production server bundling
- Vite plugins for Replit integration (cartographer, dev-banner, runtime-error-modal)
- PostCSS with Autoprefixer for CSS processing

**Environment Requirements**
- DATABASE_URL: Neon PostgreSQL connection string
- OPENAI_API_KEY: OpenAI API authentication
- GOOGLE_PLACES_API_KEY: Google Maps Platform credentials
- NODE_ENV: environment designation (development/production)