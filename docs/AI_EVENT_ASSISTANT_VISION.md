# AI Event Assistant - Vision & Implementation Plan

## Overview
Transform Kinmo's AI capabilities from simple venue suggestions into a full conversational event planning assistant that can handle the entire event lifecycle.

## Current State (As of 2025-12-10)

### Existing AI Tab in Edit Venue Dialog
- **Location**: `client/src/components/EditVenueDialog.tsx`
- **Current Modes**:
  - "Swap Venue" - Find alternatives to replace current venue
  - "Add Stop" - Find complementary venues to add after current venue

### How It Currently Works
1. Pulls from two sources:
   - **Activities** - AI-generated venue suggestions from group preferences
   - **Voting Events (Favorites)** - User-added and voted-on venues
2. Scores venues based on:
   - Quality score (feedback, ratings)
   - Visit history (frequency, recency)
3. Feeds top 15 venues to GPT-4o which:
   - Ranks top 3 alternatives OR
   - Suggests complementary stops
4. Returns venues with confidence scores (0-100)

### Current Problem
- Favorites get artificial priority boost even when not contextually relevant
- Limited to predefined modes (swap/add)
- No conversational interface for complex requests
- Doesn't leverage full context (availability, scheduling, feedback)

## Vision: Full Event Assistant Agent

### Philosophy
Automate the "planner" role in friend groups - the person who:
- Figures out when everyone is free
- Picks the places
- Coordinates the details
- Learns what works and what doesn't

### Ultimate Capabilities (Full Vision)

#### 1. Venue Discovery & Planning
- Natural language requests: "Find a bar crawl near Double Standard, walkable"
- Contextual use of favorites (only when relevant to current itinerary)
- Multi-venue planning with flow consideration
- Explains reasoning behind suggestions

#### 2. Scheduling Intelligence
- Suggests optimal timing based on:
  - Group member availability
  - Venue hours of operation
  - Past attendance patterns
- Proactively handles scheduling conflicts
- Can reschedule when RSVPs indicate issues

#### 3. Continuous Learning
- Ingests feedback from past events
- Identifies patterns (e.g., "group prefers breweries over wine bars")
- Surfaces insights about what works
- Adapts suggestions based on group evolution

#### 4. Full Event Orchestration
- Can create entire events from scratch with minimal input
- Handles RSVP collection and reminders
- Suggests adjustments based on responses
- Manages backup plans

## Implementation Strategy

### Recommended Approach: Build Foundation Now, Ship Incrementally

**Why This Works**:
- Leverage Claude's Agent SDK for conversational capabilities
- Build extensible architecture that supports adding features over time
- Start with high-value MVP, expand based on usage
- Natural evolution from existing AI features

### Phase 1: MVP - Conversational Venue Finder (2-3 weeks)

#### Goals
- Replace current AI tab with chat interface
- Handle natural language venue requests
- Contextually use favorites (not artificially boost)
- Add venues to itinerary through conversation

#### Key Features
- **Chat Interface**: Text input with conversational responses
- **Context Awareness**:
  - Current itinerary venues and their locations
  - Event type and vibe
  - Time of day
- **Smart Search**:
  - Google Places API for discovery
  - Curated venues database
  - Favorites only when contextually relevant (same area, compatible category)
- **Actions**: Can add venues to itinerary
- **Session Memory**: Remembers conversation within dialog session

#### User Experience Example
```
User: "Help me find venues for a bar crawl near Double Standard, walkable"

Agent: "Great! Double Standard is in the Marina. I'll look for bars within
a 10-minute walk. What vibe are you going for - craft beer spots, dive bars,
or upscale cocktail lounges?"

User: "Craft beer and dive bars"

Agent: "Perfect! Here are 3 spots that work well:

1. **The Interval** (5 min walk)
   - Craft cocktails with eclectic vibe
   - Your group visited here 3 months ago and loved it ⭐

2. **The Brick Yard** (7 min walk)
   - Sports bar with craft beer selection
   - Great outdoor space

3. **Horseshoe Tavern** (8 min walk)
   - Classic dive bar
   - Pool tables, jukebox

Want me to add any of these to your itinerary?"
```

#### Technical Architecture
- **New Component**: `AIEventAssistant.tsx` (replaces AI tab)
- **Backend Endpoint**: `POST /api/itineraries/:id/ai-chat`
- **Agent Implementation**: Claude with function calling
- **Available Functions**:
  - `searchVenues(query, location, radius, category)`
  - `getGroupFavorites(groupId, category)`
  - `getCurrentItinerary(itineraryId)`
  - `addVenueToItinerary(itineraryId, venueData)`

#### Contextual Favorites Logic
```typescript
// Only include favorites when:
1. Same geographic area (within 1 mile of existing venues)
2. Compatible category (bar → bar, restaurant → restaurant)
3. Time-appropriate (don't suggest breakfast at 9pm)
4. Not over-represented (if 3/4 venues are favorites, prioritize discovery)
```

### Phase 2: Scheduling & Flow Intelligence (Post-MVP)

#### Additional Capabilities
- Suggest optimal event timing based on group availability
- Reorder itinerary for better flow (geographic + logical sequence)
- Explain timing decisions ("Drinks at 7pm works best - 4/5 people available")
- Warn about conflicts (venue hours, travel time, availability gaps)

#### New Functions
- `getGroupAvailability(groupId, dateRange)`
- `reorderItinerary(itineraryId, newOrder, reason)`
- `suggestEventTime(groupId, preferences)`
- `checkVenueHours(placeId, dateTime)`

### Phase 3: Full Event Creation (Future Vision)

#### Additional Capabilities
- Create entire events from minimal input ("Plan Saturday night for the group")
- Handle end-to-end scheduling (find time, pick venues, send invites)
- Manage RSVPs and adjust plans accordingly
- Proactive suggestions ("Only 2 RSVPs so far, want me to send reminders?")

#### New Functions
- `createEvent(groupId, description, constraints)`
- `sendInvites(itineraryId, memberIds)`
- `analyzeRsvps(itineraryId)`
- `suggestAlternatives(itineraryId, reason)`

### Phase 4: Learning & Insights (Advanced)

#### Additional Capabilities
- Surface patterns from feedback ("Your group rates breweries 30% higher than wine bars")
- Suggest group preference updates
- Predict venue success before visiting
- Generate reports on what's working

#### New Functions
- `analyzeFeedbackPatterns(groupId, timeRange)`
- `predictVenueRating(venueData, groupPreferences)`
- `generateInsights(groupId)`
- `suggestPreferenceUpdates(groupId, insights)`

## Key Design Principles

### 1. Contextual Intelligence Over Brute Force
- Don't artificially boost favorites - use them when they make sense
- Consider geography, timing, category compatibility
- Balance discovery with proven favorites

### 2. Transparency
- Always explain why suggestions were made
- Show confidence levels
- Let users understand the "thinking"

### 3. Graceful Degradation
- If agent can't help, offer fallbacks
- Don't pretend to know what you don't
- Clear error messages and retry paths

### 4. User Control
- Agent assists, doesn't take over
- Easy to override or ignore suggestions
- Manual editing always available

### 5. Progressive Enhancement
- Each phase builds on previous
- New capabilities don't break old workflows
- Can be adopted incrementally by users

## Technical Considerations

### Agent Architecture
- Use Claude's function calling for tool use
- Streaming responses for better UX
- Rate limiting and cost controls
- Error handling and fallbacks

### Context Management
- Session memory within dialog
- What to include in context:
  - Current itinerary state
  - Group preferences and history
  - Recent feedback
  - Member availability (when relevant)
- What to exclude (avoid bloat):
  - Full venue databases
  - Complete event history
  - Unrelated groups

### Performance
- Cache frequently accessed data (group prefs, favorites)
- Lazy load venue details
- Optimize prompt size for cost
- Stream responses to feel instant

### Testing Strategy
- Unit tests for venue scoring logic
- Integration tests for agent functions
- User testing for conversation quality
- A/B test against current AI tab

## Success Metrics

### Phase 1 (MVP)
- **Adoption**: % of events using AI chat vs. manual venue adding
- **Efficiency**: Time to add venue (chat vs. manual)
- **Quality**: Venues added via chat that stay in final itinerary
- **Engagement**: Average messages per session

### Phase 2+
- **Event Quality**: RSVP rates, attendance, post-event ratings
- **Time Saved**: Organizer time spent on event planning
- **Group Satisfaction**: NPS for AI-planned events
- **Learning**: Improvement in suggestions over time (feedback scores)

## Migration Path

### For Users
1. **Phase 1**: AI tab becomes chat interface (seamless)
2. **Phase 2**: New scheduling features appear in chat
3. **Phase 3**: Option to "Let AI plan this event" from scratch
4. **Phase 4**: Insights surface in group dashboard

### For Codebase
1. Keep existing `/api/itineraries/:id/ai-suggestions` for compatibility
2. New `/api/itineraries/:id/ai-chat` endpoint coexists
3. Gradually deprecate old AI tab code
4. Share venue scoring logic between systems

## Open Questions

1. **Cost Management**: How to handle Claude API costs at scale?
   - Token limits per conversation
   - Caching strategies
   - Fallback to cheaper models for simple queries

2. **Multi-User Editing**: What if organizer and member both chat with AI?
   - Lock itinerary during AI edits?
   - Merge suggestions?
   - Last write wins?

3. **Privacy**: What context is safe to share with Claude?
   - Member names vs. anonymized
   - Location data
   - Feedback content

4. **Offline/Error Modes**: What if Claude API is down?
   - Fallback to current AI tab logic?
   - Manual mode only?
   - Queue requests?

## Next Steps

1. ✅ Document vision and strategy (this doc)
2. ✅ Create detailed MVP implementation plan (see below)
3. Design chat interface mockups
4. Implement backend agent infrastructure
5. Build frontend chat component
6. Test with small user group
7. Iterate based on feedback
8. Roll out to all users
9. Begin Phase 2 planning

---

# MVP IMPLEMENTATION PLAN: Conversational Venue Finder with Agent SDK

## Overview

This plan details how to implement Phase 1 (MVP) of the AI Event Assistant using the Claude Agent SDK. The goal is to replace the current AI tab in EditVenueDialog with a conversational chat interface that can intelligently find and add venues based on natural language requests.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AIEventAssistant.tsx (Chat Interface)                │   │
│  │  - Text input                                         │   │
│  │  - Message history                                    │   │
│  │  - Streaming responses                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ POST /api/itineraries/:id/ai-chat│
│                           ▼                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express Route: /api/itineraries/:id/ai-chat         │   │
│  │  - Session management                                │   │
│  │  - Agent SDK initialization                          │   │
│  │  - SSE streaming                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Claude Agent SDK                                    │   │
│  │  - Model: claude-opus-4-5                            │   │
│  │  - Session memory                                    │   │
│  │  - Custom MCP tools                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Custom MCP Server: kinmo-event-tools                │   │
│  │                                                       │   │
│  │  Tools:                                              │   │
│  │  - searchVenues()                                    │   │
│  │  - getGroupFavorites()                               │   │
│  │  - getCurrentItinerary()                             │   │
│  │  - addVenueToItinerary()                             │   │
│  │  - getGroupPreferences()                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Existing Kinmo Backend Services                     │   │
│  │  - storage.ts (database queries)                     │   │
│  │  - google-places.ts (venue search)                   │   │
│  │  - routes.ts (add venue endpoint)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### Step 1: Install Dependencies

**File**: `package.json`

```bash
npm install @anthropic-ai/claude-agent-sdk zod
```

Add to dependencies:
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^latest",
    "zod": "^3.22.4"
  }
}
```

### Step 2: Create MCP Server with Custom Tools

**New File**: `server/agent-mcp-server.ts`

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { storage } from './storage';
import { searchPlaces, getPlaceDetails } from './google-places';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { votingEvents, activities, itineraries, itineraryItems } from '../shared/schema';

// Helper: Calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Tool 1: Search for venues
const searchVenuesTool = tool(
  'searchVenues',
  'Search for venues using Google Places API. Use this to discover new restaurants, bars, cafes, experiences near a location.',
  {
    query: z.string().describe('Search query (e.g., "craft beer bars", "Italian restaurants")'),
    location: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).describe('Center point for search'),
    radius: z.number().optional().describe('Search radius in meters (default: 1609 for 1 mile)'),
    category: z.enum(['restaurant', 'bar', 'cafe', 'night_club', 'bakery', 'museum', 'park', 'entertainment']).optional()
  },
  async (args) => {
    try {
      const results = await searchPlaces(
        args.query,
        `${args.location.latitude},${args.location.longitude}`,
        args.radius || 1609
      );

      const venues = results.slice(0, 5).map((place: any) => ({
        name: place.name,
        address: place.vicinity || place.formatted_address,
        placeId: place.place_id,
        rating: place.rating,
        priceLevel: place.price_level,
        category: place.types?.[0] || 'unknown',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        photoUrl: place.photos?.[0]?.photo_reference
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
          : null
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ venues, count: venues.length })
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message, venues: [] })
        }]
      };
    }
  }
);

// Tool 2: Get group favorites (voting events)
const getGroupFavoritesTool = tool(
  'getGroupFavorites',
  'Get venues that this group has favorited/liked in the past. Only use these when contextually relevant (same area, compatible category).',
  {
    groupId: z.string().describe('The group ID'),
    category: z.string().optional().describe('Filter by category (e.g., "bar", "restaurant")'),
    nearLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      maxDistanceMiles: z.number().optional()
    }).optional().describe('Only return favorites near this location')
  },
  async (args) => {
    try {
      const favorites = await db
        .select({
          id: votingEvents.id,
          name: votingEvents.title,
          address: votingEvents.venueAddress,
          category: votingEvents.venueType,
          placeId: votingEvents.googlePlaceId,
          rating: votingEvents.rating,
          priceLevel: votingEvents.priceLevel,
          photoUrl: votingEvents.photoUrl,
          latitude: votingEvents.latitude,
          longitude: votingEvents.longitude,
          upvotes: sql<number>`COUNT(CASE WHEN vote = 'up' THEN 1 END)`,
          downvotes: sql<number>`COUNT(CASE WHEN vote = 'down' THEN 1 END)`
        })
        .from(votingEvents)
        .where(eq(votingEvents.groupId, args.groupId))
        .groupBy(votingEvents.id);

      let filtered = favorites;

      // Filter by category if specified
      if (args.category) {
        filtered = filtered.filter(f =>
          f.category?.toLowerCase().includes(args.category!.toLowerCase())
        );
      }

      // Filter by location if specified
      if (args.nearLocation) {
        const maxDist = args.nearLocation.maxDistanceMiles || 1.0;
        filtered = filtered.filter(f => {
          if (!f.latitude || !f.longitude) return false;
          const dist = calculateDistance(
            args.nearLocation!.latitude,
            args.nearLocation!.longitude,
            parseFloat(f.latitude),
            parseFloat(f.longitude)
          );
          return dist <= maxDist;
        });
      }

      const favoritesData = filtered.map(f => ({
        name: f.name,
        address: f.address,
        category: f.category,
        placeId: f.placeId,
        rating: f.rating,
        priceLevel: f.priceLevel,
        photoUrl: f.photoUrl,
        upvotes: f.upvotes,
        downvotes: f.downvotes,
        isFavorite: true
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ favorites: favoritesData, count: favoritesData.length })
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message, favorites: [] })
        }]
      };
    }
  }
);

// Tool 3: Get current itinerary state
const getCurrentItineraryTool = tool(
  'getCurrentItinerary',
  'Get the current state of the itinerary including all venues already added.',
  {
    itineraryId: z.string().describe('The itinerary ID')
  },
  async (args) => {
    try {
      const itinerary = await storage.getItinerary(args.itineraryId);
      if (!itinerary) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Itinerary not found' })
          }]
        };
      }

      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, args.itineraryId))
        .orderBy(itineraryItems.orderIndex);

      const venues = items.map(item => ({
        id: item.id,
        name: item.venueName,
        address: item.venueAddress,
        category: item.venueType,
        latitude: item.latitude,
        longitude: item.longitude,
        orderIndex: item.orderIndex,
        notes: item.notes
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            itinerary: {
              id: itinerary.id,
              name: itinerary.name,
              eventDate: itinerary.eventDate,
              groupId: itinerary.groupId
            },
            venues,
            venueCount: venues.length
          })
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message })
        }]
      };
    }
  }
);

// Tool 4: Add venue to itinerary
const addVenueToItineraryTool = tool(
  'addVenueToItinerary',
  'Add a venue to the itinerary. This actually modifies the user\'s event.',
  {
    itineraryId: z.string().describe('The itinerary ID'),
    venue: z.object({
      name: z.string(),
      address: z.string().optional(),
      placeId: z.string().optional(),
      category: z.string(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      photoUrl: z.string().optional(),
      rating: z.string().optional(),
      notes: z.string().optional()
    }).describe('Venue details to add')
  },
  async (args) => {
    try {
      // Add the venue as an ad-hoc item
      const result = await db.insert(itineraryItems).values({
        itineraryId: args.itineraryId,
        sourceType: 'ad_hoc',
        sourceId: null,
        venueName: args.venue.name,
        venueAddress: args.venue.address || '',
        venueType: args.venue.category,
        googlePlaceId: args.venue.placeId || null,
        latitude: args.venue.latitude || null,
        longitude: args.venue.longitude || null,
        photoUrl: args.venue.photoUrl || null,
        rating: args.venue.rating || null,
        notes: args.venue.notes || null,
        orderIndex: 999 // Will be auto-adjusted by backend
      }).returning();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            venueId: result[0].id,
            message: `Added ${args.venue.name} to itinerary`
          })
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message })
        }]
      };
    }
  }
);

// Tool 5: Get group preferences
const getGroupPreferencesTool = tool(
  'getGroupPreferences',
  'Get the group\'s preferences and history to understand what they like.',
  {
    groupId: z.string().describe('The group ID')
  },
  async (args) => {
    try {
      const group = await storage.getGroup(args.groupId);
      if (!group) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Group not found' })
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            preferences: {
              activityPreferences: group.activityPreferences || [],
              budgetMin: group.budgetMin,
              budgetMax: group.budgetMax,
              radiusMiles: group.radiusMiles,
              centerLatitude: group.centerLatitude,
              centerLongitude: group.centerLongitude,
              schedulingPreferences: group.schedulingPreferences
            }
          })
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message })
        }]
      };
    }
  }
);

// Create and export the MCP server
export function createKinmoMcpServer() {
  return createSdkMcpServer({
    name: 'kinmo-event-tools',
    tools: [
      searchVenuesTool,
      getGroupFavoritesTool,
      getCurrentItineraryTool,
      addVenueToItineraryTool,
      getGroupPreferencesTool
    ]
  });
}
```

### Step 3: Create Agent SDK Route

**New File**: `server/ai-agent-chat.ts`

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createKinmoMcpServer } from './agent-mcp-server';

interface AgentChatOptions {
  prompt: string;
  itineraryId: string;
  groupId: string | null;
  sessionId?: string;
  resume?: boolean;
}

export async function* runEventPlanningAgent(options: AgentChatOptions) {
  const { prompt, itineraryId, groupId, sessionId, resume } = options;

  // Create session ID if not provided
  const actualSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // System prompt for the event planning agent
  const systemPrompt = `You are an AI event planning assistant for Kinmo, helping users plan events with their friend groups.

Your capabilities:
- Search for venues using Google Places API
- Access the group's favorite/liked venues (only use when contextually relevant!)
- View the current itinerary
- Add venues to the itinerary
- Understand group preferences

Key rules:
1. **Contextual Favorites**: Only suggest favorites when they're geographically close (within 1 mile) AND in the same category as what the user is asking for
2. **Balance Discovery**: Don't over-rely on favorites - mix in new discoveries
3. **Be Conversational**: Ask clarifying questions, explain your reasoning
4. **Confirm Actions**: Before adding a venue, describe it and ask if they want to add it
5. **Geographic Awareness**: Pay attention to walkability and travel time between venues
6. **Transparency**: Explain why you're suggesting each venue

Current context:
- Itinerary ID: ${itineraryId}
${groupId ? `- Group ID: ${groupId}` : '- Standalone event (no group)'}

Start by understanding what the user wants, then use your tools to help them.`;

  try {
    // Initialize the agent with MCP server
    const agentQuery = query({
      prompt,
      options: {
        model: 'claude-opus-4-5',
        systemPrompt,
        mcpServers: {
          'kinmo': {
            type: 'sdk',
            instance: createKinmoMcpServer()
          }
        },
        sessionId: actualSessionId,
        resume: resume ? actualSessionId : undefined,
        maxTurns: 15,
        maxBudgetUsd: 2.0, // Cost control
        permissionMode: 'bypassPermissions', // Auto-approve tool use for now
        includePartialMessages: true // Stream intermediate results
      }
    });

    // Stream responses
    for await (const message of agentQuery) {
      yield {
        type: message.type,
        data: message,
        sessionId: actualSessionId
      };
    }
  } catch (error: any) {
    yield {
      type: 'error',
      data: { error: error.message },
      sessionId: actualSessionId
    };
  }
}
```

### Step 4: Add Express Route

**File**: `server/routes.ts` (add new route)

```typescript
import { runEventPlanningAgent } from './ai-agent-chat';

// Add this route after existing itinerary routes
app.post("/api/itineraries/:id/ai-chat", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const itineraryId = req.params.id;
    const { prompt, sessionId, resume } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get itinerary to check access
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Check user has access (is organizer or group member)
    let hasAccess = false;
    if (itinerary.createdBy === userId) {
      hasAccess = true;
    } else if (itinerary.groupId) {
      const member = await storage.getGroupMember(itinerary.groupId, userId);
      hasAccess = !!member;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Set up Server-Sent Events for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Run the agent and stream responses
    const agentStream = runEventPlanningAgent({
      prompt,
      itineraryId,
      groupId: itinerary.groupId,
      sessionId,
      resume: !!resume
    });

    for await (const message of agentStream) {
      // Send each message as SSE
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    }

    res.end();
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: { error: error.message } })}\n\n`);
    res.end();
  }
});
```

### Step 5: Create Frontend Chat Component

**New File**: `client/src/components/AIEventAssistant.tsx`

```typescript
import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Loader2, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIEventAssistantProps {
  itineraryId: string;
  groupId: string | null;
  onVenueAdded?: () => void;
}

export function AIEventAssistant({ itineraryId, groupId, onVenueAdded }: AIEventAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/itineraries/${itineraryId}/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt: userMessage.content,
          sessionId: sessionId,
          resume: !!sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantMessage = '';
      let currentSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            // Store session ID
            if (data.sessionId && !currentSessionId) {
              currentSessionId = data.sessionId;
              setSessionId(currentSessionId);
            }

            // Handle different message types
            if (data.type === 'assistant') {
              const content = data.data.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text') {
                    assistantMessage += block.text;
                  }
                }
              }
            } else if (data.type === 'result') {
              // Final result
              assistantMessage = data.data.result || assistantMessage;
            } else if (data.type === 'error') {
              assistantMessage = `Error: ${data.data.error}`;
            }

            // Update message in real-time
            setMessages(prev => {
              const existing = prev.find(m => m.id === 'assistant-streaming');
              if (existing) {
                return prev.map(m =>
                  m.id === 'assistant-streaming'
                    ? { ...m, content: assistantMessage }
                    : m
                );
              } else {
                return [...prev, {
                  id: 'assistant-streaming',
                  role: 'assistant' as const,
                  content: assistantMessage,
                  timestamp: new Date()
                }];
              }
            });
          }
        }
      }

      // Finalize message
      setMessages(prev =>
        prev.map(m =>
          m.id === 'assistant-streaming'
            ? { ...m, id: `assistant-${Date.now()}` }
            : m
        )
      );

      // Invalidate queries to refresh itinerary
      queryClient.invalidateQueries({ queryKey: ['/api/user/events'] });
      onVenueAdded?.();

    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[hsl(32,20%,88%)] p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[hsl(44,87%,63%)]" />
          <h3 className="font-semibold text-[hsl(25,30%,14%)]">AI Event Assistant</h3>
        </div>
        <p className="text-sm text-[hsl(25,15%,45%)] mt-1">
          Ask me to find venues, suggest alternatives, or help plan your event
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-[hsl(44,87%,63%)] mx-auto mb-3" />
            <p className="text-sm text-[hsl(25,15%,45%)]">
              Try asking: "Find a bar crawl near Double Standard, walkable"
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(44,87%,63%)] flex items-center justify-center">
                  <Bot className="h-4 w-4 text-[hsl(25,30%,14%)]" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2",
                  message.role === 'user'
                    ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
                    : "bg-[hsl(38,50%,97%)] text-[hsl(25,30%,14%)]"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(220,15%,90%)] flex items-center justify-center">
                  <User className="h-4 w-4 text-[hsl(25,30%,14%)]" />
                </div>
              )}
            </div>
          ))
        )}
        {isStreaming && (
          <div className="flex gap-2 items-center text-sm text-[hsl(25,15%,45%)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[hsl(32,20%,88%)] p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask for venue suggestions..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "gap-2 bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
              "hover:bg-[hsl(44,87%,58%)]"
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Step 6: Integrate into EditVenueDialog

**File**: `client/src/components/EditVenueDialog.tsx`

Replace the existing AI tab content with the new chat component:

```typescript
// Add import at top
import { AIEventAssistant } from '@/components/AIEventAssistant';

// In the AI tab section (around line 849), replace the entire AI tab content with:
{activeTab === "ai" && (
  <div className="h-[500px]">
    <AIEventAssistant
      itineraryId={itineraryId}
      groupId={groupId || null}
      onVenueAdded={() => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      }}
    />
  </div>
)}
```

### Step 7: Environment Variables

**File**: `.env`

Add if not already present:
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

### Step 8: Testing Plan

#### Manual Testing Checklist

1. **Basic Chat Flow**
   - [ ] Open Edit Venue dialog, switch to AI tab
   - [ ] Send message: "Find craft beer bars near Marina"
   - [ ] Verify streaming response appears in real-time
   - [ ] Verify venues are suggested

2. **Session Memory**
   - [ ] Ask: "Find bars near Double Standard"
   - [ ] Follow up: "Make them walkable"
   - [ ] Verify agent remembers context

3. **Contextual Favorites**
   - [ ] Add some favorites to group in same area as search
   - [ ] Ask: "Find bars near [location with favorites]"
   - [ ] Verify favorites appear when relevant
   - [ ] Ask: "Find bars in different city"
   - [ ] Verify favorites don't appear when not relevant

4. **Adding Venues**
   - [ ] Agent suggests venues
   - [ ] Confirm adding one
   - [ ] Verify venue appears in itinerary
   - [ ] Verify other tabs update

5. **Error Handling**
   - [ ] Test with invalid query
   - [ ] Test with network disconnection
   - [ ] Verify graceful error messages

6. **Cost Control**
   - [ ] Check logs for token usage
   - [ ] Verify stays under $2 budget per session
   - [ ] Test hitting max turns limit

## Files to Create/Modify

### New Files
- `server/agent-mcp-server.ts` - Custom MCP server with Kinmo tools
- `server/ai-agent-chat.ts` - Agent SDK integration layer
- `client/src/components/AIEventAssistant.tsx` - Chat UI component

### Modified Files
- `package.json` - Add Agent SDK dependency
- `server/routes.ts` - Add `/api/itineraries/:id/ai-chat` endpoint
- `client/src/components/EditVenueDialog.tsx` - Replace AI tab with chat component

### Configuration Files
- `.env` - Add `ANTHROPIC_API_KEY`

## Migration Strategy

### Phase 1: Soft Launch (Week 1-2)
1. Deploy with AI tab showing both old and new UI
2. Add feature flag to control which version users see
3. Beta test with select users
4. Gather feedback and iterate

### Phase 2: Full Rollout (Week 3)
1. Remove old AI tab UI
2. Make chat interface the default
3. Monitor usage and costs
4. Adjust prompts based on user behavior

### Phase 3: Deprecation (Week 4)
1. Remove old `/api/itineraries/:id/ai-suggestions` endpoint
2. Clean up unused AI tab code
3. Document new flow

## Cost Estimates

**Per Conversation**:
- Average: 3-5 messages
- Tokens per message: ~2,000 input, ~500 output
- Total: ~12,500 tokens per conversation
- Cost: ~$0.15 per conversation (Opus 4.5 pricing)

**Monthly Estimates** (100 active groups):
- Conversations per week: ~200
- Monthly cost: ~$120
- Budget controls: $2 max per session limits runaway costs

## Success Criteria

After 2 weeks of beta testing:
- [ ] 50%+ of venue additions use AI chat (vs. manual)
- [ ] Average session: 3-5 messages (shows engagement)
- [ ] 80%+ of AI-suggested venues stay in final itinerary (shows quality)
- [ ] <5% error rate
- [ ] Average response time: <3 seconds for first token
- [ ] Cost: <$0.20 per conversation

## Rollback Plan

If issues arise:
1. Flip feature flag to show old AI tab
2. Investigate logs for agent failures
3. Adjust prompts or tools as needed
4. Re-launch after fixes

## Next Steps After MVP

Once MVP is stable:
1. Add Phase 2 tools (scheduling, availability)
2. Improve prompts based on usage patterns
3. Add analytics dashboard for agent performance
4. Explore cheaper models for simple queries
5. Add voice input for mobile users

---

# CRITICAL REVIEW: Issues & Recommendations

After reviewing the plan, here are important considerations and potential issues:

## 1. Agent SDK vs. Direct API: Strategic Decision

### The Question
The plan uses the Claude Agent SDK, but we should consider whether this is the right approach vs. using the Anthropic API directly with tool calling.

### Agent SDK Pros
- Built-in session management
- MCP server abstraction is clean
- Streaming handled for you
- Designed for agentic workflows

### Agent SDK Concerns
- **Newer SDK** - less battle-tested in production
- **Dependency risk** - adding another major dependency
- **Overhead** - may be overkill for MVP scope (just venue search + add)
- **Debugging** - another layer to debug when things go wrong

### Alternative: Direct Anthropic API
You could achieve the same with:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514', // Cheaper for MVP
  messages: conversationHistory,
  tools: kinmoTools,
  stream: true
});
```

### Recommendation
**Start with Direct API for MVP**, then migrate to Agent SDK when you need:
- Cross-session memory persistence
- More complex multi-step workflows
- Subagent orchestration (Phase 3+)

This reduces initial complexity and lets you validate the UX before committing to the SDK.

## 2. Model Selection: Cost vs. Quality

### Current Plan Issue
Uses `claude-opus-4-5` which is:
- Most expensive ($15 input / $75 output per million tokens)
- Overkill for venue search tasks

### Recommendation
**Use Sonnet for MVP** (`claude-sonnet-4-5-20250514`):
- Much cheaper (~$3 input / $15 output per million tokens)
- Fast enough for chat UX
- Capable enough for tool calling + venue recommendations

Reserve Opus for:
- Complex multi-venue itinerary optimization (Phase 2+)
- Full event creation from scratch (Phase 3)

### Cost Impact
| Model | Per Conversation | Monthly (200 convos) |
|-------|-----------------|---------------------|
| Opus 4.5 | ~$0.15 | ~$120 |
| Sonnet 4.5 | ~$0.03 | ~$24 |

**5x cost savings with Sonnet**

## 3. Missing: Location Resolution

### The Problem
User says: "Find bars near Double Standard"

But the agent doesn't know where "Double Standard" is. The current plan requires:
```typescript
location: z.object({
  latitude: z.number(),
  longitude: z.number()
})
```

### Solution: Add Location Resolution Tool
```typescript
const resolveLocationTool = tool(
  'resolveLocation',
  'Convert a place name, address, or landmark to coordinates.',
  {
    query: z.string().describe('Place name or address (e.g., "Double Standard", "Marina District SF")')
  },
  async (args) => {
    // Use Google Geocoding API or Places API text search
    const result = await geocodeLocation(args.query);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: result.name,
          address: result.formattedAddress,
          latitude: result.latitude,
          longitude: result.longitude
        })
      }]
    };
  }
);
```

**This is essential for natural language requests.**

## 4. Missing: Venue Details/Hours

### The Problem
Agent suggests a venue, but doesn't know:
- Is it open at the time of the event?
- What are the hours?
- Phone number for reservations?

### Solution: Add Venue Details Tool
```typescript
const getVenueDetailsTool = tool(
  'getVenueDetails',
  'Get detailed information about a specific venue including hours, phone, website.',
  {
    placeId: z.string().describe('Google Place ID')
  },
  async (args) => {
    const details = await getPlaceDetails(args.placeId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: details.name,
          hours: details.opening_hours?.weekday_text,
          isOpen: details.opening_hours?.open_now,
          phone: details.formatted_phone_number,
          website: details.website,
          priceLevel: details.price_level,
          rating: details.rating,
          reviews: details.reviews?.slice(0, 2) // Top 2 reviews
        })
      }]
    };
  }
);
```

## 5. Missing: Remove Venue Capability

### The Problem
User can ask to add venues, but not remove them through chat.

### Solution
```typescript
const removeVenueFromItineraryTool = tool(
  'removeVenueFromItinerary',
  'Remove a venue from the itinerary.',
  {
    itineraryId: z.string(),
    venueId: z.string().describe('The venue/item ID to remove')
  },
  async (args) => {
    await db.delete(itineraryItems)
      .where(eq(itineraryItems.id, args.venueId));
    return { content: [{ type: 'text', text: 'Venue removed' }] };
  }
);
```

## 6. Session Storage: Missing Persistence

### The Problem
Current plan stores session ID in React state, but:
- Lost on page refresh
- Lost when dialog closes and reopens
- No way to continue conversation later

### Solution Options

**Option A: Store in localStorage (Simple)**
```typescript
const SESSION_KEY = `kinmo-ai-session-${itineraryId}`;
const [sessionId, setSessionId] = useState<string | null>(
  () => localStorage.getItem(SESSION_KEY)
);
// Save on update
useEffect(() => {
  if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
}, [sessionId]);
```

**Option B: Store in Database (Better for multi-device)**
```sql
CREATE TABLE ai_chat_sessions (
  id VARCHAR PRIMARY KEY,
  itinerary_id VARCHAR REFERENCES itineraries(id),
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  message_count INTEGER DEFAULT 0
);
```

**Recommendation**: Start with localStorage, migrate to DB if needed.

## 7. Rate Limiting: Not Addressed

### The Problem
Nothing stops a user from:
- Spamming the chat
- Running up API costs
- Hitting Claude rate limits

### Solution
```typescript
// In routes.ts
import rateLimit from 'express-rate-limit';

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests. Please wait a moment.' }
});

app.post("/api/itineraries/:id/ai-chat", isAuthenticated, aiChatLimiter, async (req, res) => {
  // ...
});
```

Also add to frontend:
```typescript
const [cooldown, setCooldown] = useState(false);

const sendMessage = async () => {
  if (cooldown) return;
  setCooldown(true);
  setTimeout(() => setCooldown(false), 2000); // 2s between messages
  // ...
};
```

## 8. Standalone Events: Special Handling Needed

### The Problem
For standalone events (no group):
- No group preferences to use
- No group favorites
- `getGroupFavorites` will fail

### Solution
Update tools to handle null groupId gracefully:
```typescript
if (!args.groupId) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        favorites: [],
        count: 0,
        note: 'This is a standalone event with no group favorites'
      })
    }]
  };
}
```

And update system prompt:
```typescript
const systemPrompt = `...
${groupId
  ? `- Group ID: ${groupId} (you can access group preferences and favorites)`
  : '- Standalone event (no group - focus on user preferences and venue discovery)'}
`;
```

## 9. Curated Venues: Not Utilized

### The Problem
You have a `curatedVenues` table with pre-vetted, high-quality venues, but the plan only uses Google Places.

### Solution: Add Curated Venues Tool
```typescript
const getCuratedVenuesTool = tool(
  'getCuratedVenues',
  'Get pre-vetted, high-quality venues from our curated database. These are guaranteed quality.',
  {
    category: z.string().optional(),
    nearLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusMiles: z.number().optional()
    }).optional()
  },
  async (args) => {
    let query = db.select().from(curatedVenues);

    if (args.category) {
      query = query.where(ilike(curatedVenues.category, `%${args.category}%`));
    }

    const venues = await query;

    // Filter by location if provided
    if (args.nearLocation) {
      // ... distance filtering
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          venues: venues.slice(0, 10),
          isCurated: true,
          note: 'These venues are pre-vetted for quality'
        })
      }]
    };
  }
);
```

## 10. Error UX: Needs Improvement

### The Problem
Current error handling just shows the error message, which may be technical/confusing.

### Solution: Friendly Error Messages
```typescript
const friendlyErrors: Record<string, string> = {
  'RATE_LIMIT': "I'm thinking too fast! Give me a moment and try again.",
  'API_ERROR': "I'm having trouble connecting. Let's try that again.",
  'NO_RESULTS': "I couldn't find any venues matching that. Can you be more specific?",
  'TIMEOUT': "That took too long. Let me try a simpler search."
};

// In the catch block
const friendlyMessage = friendlyErrors[error.code] ||
  "Something went wrong. Try rephrasing your request?";
```

## 11. Analytics: Add from Day 1

### Recommendation
Track these metrics from launch:
```typescript
// Log each agent interaction
await db.insert(aiAgentLogs).values({
  userId,
  itineraryId,
  sessionId,
  prompt: userMessage,
  responseTokens: result.usage.output_tokens,
  inputTokens: result.usage.input_tokens,
  toolsCalled: toolsUsed,
  venuesAdded: venuesAddedCount,
  durationMs: endTime - startTime,
  success: !error,
  errorType: error?.code || null
});
```

This lets you:
- Track costs per user/group
- Identify common queries
- Find failure patterns
- Measure agent effectiveness

## 12. Revised Tool List for MVP

Based on the above, here's the recommended tool set:

| Tool | Purpose | Priority |
|------|---------|----------|
| `resolveLocation` | Convert place names to coordinates | **Must have** |
| `searchVenues` | Google Places search | Must have |
| `getCuratedVenues` | High-quality pre-vetted venues | Should have |
| `getGroupFavorites` | Group's liked venues | Should have |
| `getCurrentItinerary` | View current state | Must have |
| `addVenueToItinerary` | Add venue | Must have |
| `removeVenueFromItinerary` | Remove venue | Should have |
| `getVenueDetails` | Hours, phone, reviews | Nice to have |
| `getGroupPreferences` | Budget, categories | Nice to have |

## 13. Revised Cost Estimates (with Sonnet)

| Metric | Opus | Sonnet (Recommended) |
|--------|------|---------------------|
| Per conversation | $0.15 | $0.03 |
| Monthly (200 convos) | $120 | $24 |
| Budget per session | $2.00 | $0.50 |

## Updated Implementation Order

1. **Week 1: Core Infrastructure**
   - Direct Anthropic API (not Agent SDK)
   - Sonnet model
   - `resolveLocation` + `searchVenues` + `getCurrentItinerary` + `addVenueToItinerary`
   - Basic chat UI with streaming
   - Rate limiting
   - Error handling

2. **Week 2: Enhancement**
   - `getCuratedVenues` + `getGroupFavorites`
   - Session persistence (localStorage)
   - Analytics logging
   - Standalone event handling

3. **Week 3: Polish & Launch**
   - `removeVenueFromItinerary` + `getVenueDetails`
   - UX improvements based on testing
   - Cost monitoring dashboard
   - Feature flag for gradual rollout

4. **Post-MVP: Migrate to Agent SDK**
   - When you need cross-session memory
   - When implementing Phase 2 (scheduling)
   - When adding complex multi-agent workflows

---

**Document Version**: 1.2
**Last Updated**: December 10, 2025
**Author**: Claude (based on discussion with product team)
**Status**: Plan reviewed with critical additions - ready for implementation decision
