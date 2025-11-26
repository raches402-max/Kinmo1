/**
 * AI Event Planning Agent
 *
 * Intelligent agent that reasons about event planning and uses tools to make decisions.
 * Replaces simple AI venue selection with contextual, self-validating event planning.
 */

import OpenAI from "openai";
import type { Group } from "@shared/schema";
import { logApiCall, calculateOpenAICost } from "./openai";
import {
  calculateVenueScore,
  getVisitStats,
  shouldSkipVenue,
} from "./venue-scoring-utils";
import {
  orderVenuesLogically,
  isVenueAppropriateForTime,
  getTimePeriod,
  categorizeVenueTimeOfDay,
} from "./venue-ordering-utils";
import {
  selectDiverseVenues,
  validateVenueDiversity,
  getCategoryDistribution,
  getVenueCategory,
} from "./venue-diversity-utils";
import {
  calculateVenueDistance,
  validateVenueProximity,
  getDistanceStatistics,
  filterVenuesByDistance,
  calculateCenterPoint,
} from "./venue-distance-utils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Venue type from auto-scheduler (matches existing structure)
export interface VenueForAgent {
  type: 'activity' | 'voting_event';
  id: string;
  name: string;
  score: number;
  visitCount: number;
  daysSinceLastVisit: number;
  qualityScore: number;
  feedback?: string | null;
  category?: string | null;
  timeCategory?: string | null;
  venueType?: string | null;
  rating?: string | null;
  venueAddress?: string | null;
  googlePlaceId?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
}

export interface EventPlanningRequest {
  group: Group;
  eventDate: Date;
  availableVenues: VenueForAgent[];
  constraints?: {
    maxDistanceMiles?: number;
    minConfidence?: number;
    desiredVenueCount?: number;
  };
}

export interface EventPlan {
  selectedVenues: VenueForAgent[]; // Will contain 1 primary venue
  reasoning: string;
  confidence: number;
  flow: string;
  warnings?: string[];
  nearbySuggestions?: Array<VenueForAgent & { distance: number }>; // Optional nearby venues
}

/**
 * Tool definitions for the agent
 * These are the functions the agent can call to gather info and make decisions
 */
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "filter_by_time_appropriateness",
      description: "Filter venues to only those appropriate for the event time (e.g., no ice cream at 9am, no coffee shops at 9pm). Returns indices of suitable venues.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to check for time appropriateness",
          },
          event_hour: {
            type: "number",
            description: "Hour of the event in 24-hour format (0-23)",
          },
        },
        required: ["venue_indices", "event_hour"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_venue_diversity",
      description: "Check if a set of venues has good diversity (no duplicate categories like '3 restaurants'). Returns validation result with any issues found.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to validate for diversity",
          },
        },
        required: ["venue_indices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_geographic_proximity",
      description: "Check if venues are reasonably close together (not 20 miles apart). Returns distance statistics and validation.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to check proximity",
          },
          max_distance_miles: {
            type: "number",
            description: "Maximum acceptable distance between venues in miles (default: 5)",
          },
        },
        required: ["venue_indices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_distribution",
      description: "Get breakdown of venue categories (meal, drinks, dessert, etc.) for a set of venues. Useful for understanding diversity.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to analyze",
          },
        },
        required: ["venue_indices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "order_venues_by_flow",
      description: "Order venues in logical flow for an event (meal → drinks → dessert). Returns ordered indices.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to order",
          },
        },
        required: ["venue_indices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "filter_by_distance_from_center",
      description: "Filter venues to only those within X miles of a central point. Useful for geographic clustering.",
      parameters: {
        type: "object",
        properties: {
          venue_indices: {
            type: "array",
            items: { type: "number" },
            description: "Indices of venues to filter",
          },
          max_distance_miles: {
            type: "number",
            description: "Maximum distance from center in miles",
          },
        },
        required: ["venue_indices", "max_distance_miles"],
      },
    },
  },
];

/**
 * Execute a tool call from the agent
 */
function executeTool(
  toolName: string,
  args: any,
  venues: VenueForAgent[],
  eventDate: Date
): string {
  try {
    switch (toolName) {
      case "filter_by_time_appropriateness": {
        const { venue_indices, event_hour } = args;
        const suitable: number[] = [];

        for (const idx of venue_indices) {
          if (idx >= 0 && idx < venues.length) {
            const venue = venues[idx];
            if (venue.venueType && isVenueAppropriateForTime(venue.venueType, event_hour)) {
              suitable.push(idx);
            }
          }
        }

        const period = getTimePeriod(event_hour);
        return JSON.stringify({
          suitable_indices: suitable,
          filtered_count: venue_indices.length - suitable.length,
          time_period: period,
          message: `Found ${suitable.length} venues appropriate for ${period} (${event_hour}:00)`,
        });
      }

      case "validate_venue_diversity": {
        const { venue_indices } = args;
        const selectedVenues = venue_indices
          .filter((idx: number) => idx >= 0 && idx < venues.length)
          .map((idx: number) => venues[idx]);

        const validation = validateVenueDiversity(selectedVenues);
        const distribution = getCategoryDistribution(selectedVenues);

        return JSON.stringify({
          is_valid: validation.isValid,
          issues: validation.issues,
          category_distribution: distribution,
          message: validation.isValid
            ? "Venue selection has good diversity"
            : `Diversity issues: ${validation.issues.join(", ")}`,
        });
      }

      case "check_geographic_proximity": {
        const { venue_indices, max_distance_miles = 5 } = args;
        const selectedVenues = venue_indices
          .filter((idx: number) => idx >= 0 && idx < venues.length)
          .map((idx: number) => venues[idx]);

        const validation = validateVenueProximity(selectedVenues, max_distance_miles);
        const stats = getDistanceStatistics(selectedVenues);

        return JSON.stringify({
          is_valid: validation.isValid,
          max_distance: validation.maxDistance,
          issues: validation.issues,
          statistics: stats,
          message: validation.isValid
            ? `All venues within ${max_distance_miles} miles`
            : `Some venues too far apart: ${validation.issues.join(", ")}`,
        });
      }

      case "get_category_distribution": {
        const { venue_indices } = args;
        const selectedVenues = venue_indices
          .filter((idx: number) => idx >= 0 && idx < venues.length)
          .map((idx: number) => venues[idx]);

        const distribution = getCategoryDistribution(selectedVenues);

        return JSON.stringify({
          distribution,
          total_venues: selectedVenues.length,
          unique_categories: Object.keys(distribution).length,
        });
      }

      case "order_venues_by_flow": {
        const { venue_indices } = args;
        const selectedVenues = venue_indices
          .filter((idx: number) => idx >= 0 && idx < venues.length)
          .map((idx: number) => ({ venue: venues[idx], originalIndex: idx }));

        const ordered = orderVenuesLogically(selectedVenues.map((v: { venue: VenueForAgent; originalIndex: number }) => v.venue));
        const orderedIndices = ordered.map(orderedVenue => {
          const match = selectedVenues.find((sv: { venue: VenueForAgent; originalIndex: number }) => sv.venue.id === orderedVenue.id);
          return match?.originalIndex ?? -1;
        }).filter(idx => idx !== -1);

        return JSON.stringify({
          ordered_indices: orderedIndices,
          flow: ordered.map(v => getVenueCategory(v)).join(" → "),
          message: `Ordered ${orderedIndices.length} venues logically`,
        });
      }

      case "filter_by_distance_from_center": {
        const { venue_indices, max_distance_miles } = args;
        const selectedVenues = venue_indices
          .filter((idx: number) => idx >= 0 && idx < venues.length)
          .map((idx: number) => venues[idx]);

        const centerPoint = calculateCenterPoint(selectedVenues);
        if (!centerPoint) {
          return JSON.stringify({
            error: "Cannot calculate center point - venues missing coordinates",
            filtered_indices: venue_indices,
          });
        }

        const filtered = filterVenuesByDistance<VenueForAgent>(selectedVenues, centerPoint, max_distance_miles);
        const filteredIndices = filtered
          .map((v) => venue_indices.find((idx: number) => venues[idx].id === v.id))
          .filter((idx): idx is number => idx !== undefined);

        return JSON.stringify({
          filtered_indices: filteredIndices,
          center_point: centerPoint,
          filtered_count: venue_indices.length - filteredIndices.length,
          message: `${filteredIndices.length} venues within ${max_distance_miles} miles of center`,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

/**
 * Main agent function - plans an event using AI reasoning and tools
 */
export async function planEventWithAgent(
  request: EventPlanningRequest
): Promise<EventPlan | null> {
  const startTime = Date.now();
  const { group, eventDate, availableVenues, constraints = {} } = request;
  const {
    maxDistanceMiles = 5,
    minConfidence = 75,
    desiredVenueCount = 1, // Changed to 1: select single primary venue
  } = constraints;

  const eventHour = eventDate.getHours();
  const eventDay = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  console.log(`[Agent] Planning event for "${group.name}" on ${eventDay} at ${eventHour}:00`);
  console.log(`[Agent] ${availableVenues.length} venues available, target: ${desiredVenueCount} venues`);

  // Build venue list for agent context
  const venueList = availableVenues
    .slice(0, 20) // Top 20 to keep prompt reasonable
    .map((v, i) => {
      const category = getVenueCategory(v);
      const isFavorite = v.type === 'voting_event';
      return `${i}. ${v.name} (${v.venueType || 'unknown'})${isFavorite ? ' ⭐ FAVORITE' : ''}
   Category: ${category} | Score: ${v.score.toFixed(1)} | Rating: ${v.rating || 'N/A'}
   Visits: ${v.visitCount}x, Last: ${v.daysSinceLastVisit === 999 ? 'Never' : Math.round(v.daysSinceLastVisit) + ' days ago'}`;
    })
    .join('\n\n');

  const systemPrompt = `You are an expert event planner selecting the BEST venue for "${group.name}".

EVENT CONTEXT:
- Date: ${eventDay}
- Time: ${eventHour}:00 (${getTimePeriod(eventHour)})
- Group preferences: ${group.activityCategories || 'None specified'}
- Goal: Select ONE primary anchor venue

YOUR APPROACH:
1. **Select the SINGLE BEST venue** - quality over quantity
2. **Prioritize Favorites (⭐ FAVORITE)** - these are proven group favorites
3. **Consider time appropriateness** (no ice cream at 9am, no coffee at 9pm)
4. **Choose high-scoring venues** that haven't been visited recently
5. **Keep it simple** - groups can add other stops if they want

SELECTION CRITERIA:
- **Favorites first** - If there's a suitable favorite, strongly prefer it
- **High quality** - Look for high scores (2.5+) and good ratings
- **Time-appropriate** - Match venue type to time of day
- **Not recently visited** - Fresh experiences are better
- **Clear category** - Restaurant, bar, cafe, dessert, or activity

AVAILABLE TOOLS (use if helpful, but not required):
- filter_by_time_appropriateness: Remove venues unsuitable for event time
- get_category_distribution: See breakdown of venue types

WORKFLOW:
1. Review venues and identify top candidates
2. Select the SINGLE BEST venue for this time/date
3. Return your selection as JSON immediately

⚠️  IMPORTANT: You're selecting ONE venue, not building a multi-stop itinerary.
The group can explore nearby options on their own if they want to extend the night.`;

  const userPrompt = `Select the SINGLE BEST venue from this list for ${eventHour}:00 on ${eventDay}:

${venueList}

**YOUR TASK:**
1. Review the venues above
2. Consider the time (${eventHour}:00, ${getTimePeriod(eventHour)})
3. Select the ONE venue that's the best fit
4. Prioritize ⭐ FAVORITE venues when available
5. Return your selection as JSON

**REQUIRED JSON RESPONSE FORMAT:**
You MUST respond with this exact JSON structure (no other text):
{
  "selected_venue_indices": [5],
  "reasoning": "Why this venue is the best choice",
  "flow_description": "What makes this venue perfect for tonight",
  "confidence": 90
}

The index must be a single number from the list above (0-${Math.min(19, availableVenues.length - 1)}).
Use tools if helpful, but return your selection quickly.`;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let iteration = 0;
    const maxIterations = 10; // Allow more iterations for thorough planning

    while (iteration < maxIterations) {
      iteration++;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Add assistant's message to history
      messages.push(message);

      // Check if agent wants to use tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Agent] Iteration ${iteration}: Using ${message.tool_calls.length} tool(s)`);

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          // Handle both standard and custom tool call types
          if (toolCall.type !== 'function' || !('function' in toolCall)) {
            console.warn(`[Agent] Skipping non-function tool call: ${toolCall.type}`);
            continue;
          }

          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`[Agent] Calling tool: ${toolName}`);
          const result = executeTool(toolName, args, availableVenues, eventDate);

          // Add tool result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Continue to next iteration (agent will process tool results)
        continue;
      }

      // Agent finished - extract final answer
      if (message.content) {
        console.log(`[Agent] Completed in ${iteration} iteration(s)`);

        // Parse JSON response
        const content = message.content;
        let parsed: any;

        try {
          // Try to extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            console.error('[Agent] No JSON found in response:', content);
            return null;
          }
        } catch (parseError) {
          console.error('[Agent] Failed to parse JSON:', content);
          return null;
        }

        // Extract selected venues
        const selectedIndices: number[] = parsed.selected_venue_indices || [];
        const selectedVenues = selectedIndices
          .filter(idx => idx >= 0 && idx < availableVenues.length)
          .map(idx => availableVenues[idx]);

        if (selectedVenues.length === 0) {
          console.error('[Agent] No valid venues selected');
          return null;
        }

        const responseTime = Date.now() - startTime;
        const cost = calculateOpenAICost(
          'gpt-4o-mini',
          response.usage?.prompt_tokens || 0,
          response.usage?.completion_tokens || 0
        );

        // Log successful API call with cost tracking
        await logApiCall({
          service: 'openai',
          method: 'planEventWithAgent',
          cacheStatus: 'miss',
          status: 'success',
          responseTimeMs: responseTime,
          costEstimate: cost,
          parameters: {
            groupName: request.group.name,
            venueCount: availableVenues.length,
            selectedCount: selectedVenues.length,
          },
          metadata: {
            iterations: iteration,
            inputTokens: response.usage?.prompt_tokens,
            outputTokens: response.usage?.completion_tokens,
            confidence: parsed.confidence,
          },
        });

        console.log(`[Agent] Selected ${selectedVenues.length} venues in ${responseTime}ms`);
        console.log(`[Agent] Cost: $${cost.toFixed(4)} | Confidence: ${parsed.confidence}%`);

        return {
          selectedVenues,
          reasoning: parsed.reasoning || 'Agent selected these venues',
          confidence: parsed.confidence || 70,
          flow: parsed.flow_description || 'Event itinerary',
          warnings: parsed.warnings,
        };
      }

      // Safety: shouldn't reach here
      break;
    }

    console.log('[Agent] Max iterations reached without final answer');
    return null;

  } catch (error: any) {
    // Log failed API call
    await logApiCall({
      service: 'openai',
      method: 'planEventWithAgent',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error.message,
      parameters: {
        groupName: request.group.name,
        venueCount: availableVenues.length,
      },
    });

    console.error('[Agent] Error:', error.message);
    return null;
  }
}
