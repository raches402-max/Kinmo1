# Kinmo - AI-Powered Group Event Planning

## Project Overview

Kinmo is a full-stack web application that helps friend groups plan and coordinate social events using AI. The app automates venue discovery, itinerary creation, scheduling, and RSVP management.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, React Query, wouter (routing)
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (Neon serverless)
- **AI**: OpenAI GPT-4o for venue suggestions, scheduling, and itinerary generation
- **APIs**: Google Places API (venue data), Google Maps API (geocoding), Resend (emails)
- **Auth**: Replit OpenID Connect (OAuth)
- **Hosting**: Replit

## Project Structure

```
/home/runner/workspace/
├── client/src/
│   ├── components/     # React components (shadcn/ui based)
│   ├── pages/          # Route pages (wouter)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities (queryClient, utils)
│   ├── App.tsx         # Main app with routing
│   └── main.tsx        # Entry point
├── server/
│   ├── index.ts        # Express server entry
│   ├── routes.ts       # All API routes (~600KB, very large)
│   ├── storage.ts      # Database operations (Drizzle)
│   ├── openai.ts       # OpenAI integrations
│   ├── google-places.ts # Google Places API
│   ├── email-service.ts # Resend email templates
│   ├── auto-scheduler.ts # AI event scheduling
│   ├── ai-*.ts         # Various AI modules
│   └── replitAuth.ts   # Authentication
├── shared/
│   └── schema.ts       # Drizzle schema + Zod types
├── migrations/         # Drizzle migrations
└── docs/               # Documentation
```

## Key Commands

```bash
# Development
npm run dev           # Start dev server (tsx watch)
npm run dev:claude    # Dev server on port 3000
npm run client        # Vite dev server only

# Build & Deploy
npm run build         # Build for production
npm run start         # Run production build

# Database
npm run db:push       # Push schema to database
npx drizzle-kit studio # Open Drizzle Studio

# Utilities
npm run check         # TypeScript type check
npm run fix           # Run fix-replit.sh
npm run kill          # Kill all node processes
npm run kill:port     # Free ports 3000/5000
```

## Database Schema Highlights

Key tables in `shared/schema.ts`:
- `users` - Auth via Replit OIDC, email as stable ID
- `groups` - Friend groups with preferences, automation settings
- `members` - Group members (can be linked to users or standalone)
- `activities` - AI-generated venue suggestions
- `votingEvents` - User-added venues for voting
- `itineraries` - Event plans with venues
- `itineraryItems` - Venues in an itinerary
- `rsvps` - Member responses to events
- `autoScheduledEvents` - AI-generated pending events
- `curatedVenues` - Pre-vetted venue database
- `placesCache` / `searchCache` - Google API caching

## API Patterns

Routes are in `server/routes.ts`. Key patterns:
- Auth middleware: `requireAuth` for protected routes
- Authorization: Check group membership via `storage.getGroupMember()`
- Validation: Zod schemas from `shared/schema.ts`
- Responses: `{ success: true, data }` or `{ success: false, error }`

## Frontend Patterns

- **Data fetching**: React Query with `queryClient` from `lib/queryClient.ts`
- **Forms**: React Hook Form + Zod validation
- **UI Components**: shadcn/ui in `components/ui/`
- **Routing**: wouter (`useLocation`, `<Route>`, `<Link>`)
- **Toasts**: Use `useToast()` hook with `getSuccessToast()` / `getErrorToast()` helpers

## AI Integration

OpenAI calls are in `server/openai.ts`:
- `generateActivities()` - Venue suggestions based on group preferences
- `createSmartItinerary()` - Build itinerary from activities
- `getAiTimeSuggestion()` - Optimal event timing

Auto-scheduling in `server/auto-scheduler.ts`:
- Runs on cron schedule
- Creates events based on group cadence
- Handles RSVP collection and reminders

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - Neon PostgreSQL connection
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_MAPS_API_KEY` - Google Maps/Places API
- `RESEND_API_KEY` - Resend email API
- `REPLIT_*` - Auto-provided by Replit for auth
- `SESSION_SECRET` - Express session secret

## Common Tasks

### Adding a new API endpoint
1. Add route in `server/routes.ts`
2. Add storage function in `server/storage.ts` if needed
3. Add Zod schema in `shared/schema.ts` if new types

### Adding a new page
1. Create page in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Use existing patterns from similar pages

### Database changes
1. Modify `shared/schema.ts`
2. Run `npm run db:push` to sync
3. Add migration if needed in `migrations/`

## Important Notes

- **Large files**: `routes.ts` (~600KB) and `storage.ts` (~130KB) are very large. Search for specific functions rather than reading entire files.
- **Soft deletes**: Groups use `deletedAt` for soft deletion
- **Timezones**: Events use group's `timezone` field (IANA format)
- **Caching**: Google API results cached in `placesCache` and `searchCache` tables
- **Rate limiting**: API calls logged to `apiCallLogs` for cost tracking
