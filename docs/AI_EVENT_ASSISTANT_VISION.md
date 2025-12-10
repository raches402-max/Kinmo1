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
2. Create detailed MVP implementation plan
3. Design chat interface mockups
4. Implement backend agent infrastructure
5. Build frontend chat component
6. Test with small user group
7. Iterate based on feedback
8. Roll out to all users
9. Begin Phase 2 planning

---

**Document Version**: 1.0
**Last Updated**: December 10, 2025
**Author**: Claude (based on discussion with product team)
**Status**: Vision - awaiting implementation plan
