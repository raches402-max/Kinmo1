# Kinmo.ai - AI Group Activity Planner

## Overview

Kinmo.ai is an AI-powered group activity planning application that helps users discover and organize group activities based on collective preferences, budget constraints, and location. Using AI to take the friction out of seeing your kin, more. The application generates personalized venue and activity suggestions using OpenAI's GPT model and enriches them with real-world data from Google Places API.

The platform enables users to create groups, invite members, and receive tailored activity recommendations that consider factors like group closeness, novelty preferences, budget ranges, and meeting frequency. Each suggestion includes venue details, photos, ratings, and practical information to help groups make informed decisions.

## Recent Changes

### October 7, 2025
- **Complementary Food Suggestions**: For outdoor venues like parks and beaches, the AI now suggests nearby food places (e.g., "pick up sandwiches at ____ near this park"). This helps groups plan complete outdoor experiences with food options.
- **Feedback Integration**: Activity feedback (love/more/less) is now fed back into the AI when generating new suggestions. The AI learns from previous feedback to suggest more of what the group loves and less of what they don't prefer.
- **Enhanced AI Context**: OpenAI prompts now include previous activity feedback and complementary food place recommendations for outdoor venues.

## User Preferences

Preferred communication style: Simple, everyday language.

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