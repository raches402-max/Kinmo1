/**
 * AI Event Validator
 * Validates auto-scheduled events for time appropriateness, venue flow, and pacing
 */

import OpenAI from 'openai';
import { format } from 'date-fns';
import { logApiCall, calculateOpenAICost, getAICache, setAICache } from './openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QueueVenue {
  sourceType: 'voting_event' | 'activity' | 'ad_hoc' | 'google_place';
  sourceId: string;
  venueName: string;
  venueType: string;
  venueAddress?: string | null;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
  adHocData?: {
    name: string;
    address?: string | null;
    type?: string | null;
    googlePlaceId?: string | null;
    notes?: string | null;
    googleMapsUrl?: string | null;
    arrivalTime?: Date | string | null;
    departureTime?: Date | string | null;
    travelNotes?: string | null;
  };
}

export interface QueueEvent {
  id: string;
  scheduledDate: string;
  scheduledTime?: string;
  venues: QueueVenue[];
  sourceType: 'favorites' | 'itinerary';
  sourceItineraryId?: string;
  sourceItineraryName?: string;
  aiValidationScore: number;
  aiValidationReasoning: string;
  aiValidationConcerns: string[];
  aiValidationSuggestions: string[];
}

export interface ValidationResult {
  score: number; // 0-100
  reasoning: string;
  concerns: string[];
  suggestions: string[];
}

interface GroupContext {
  meetingFrequency?: string;
  recentEventDates?: Date[];
}

/**
 * Get day of week from ISO date string
 */
function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'EEEE'); // e.g., "Thursday"
}

/**
 * Infer time of day from scheduled time or venue types
 */
function inferTimeOfDay(scheduledTime?: string, venues?: QueueVenue[]): string {
  if (scheduledTime) {
    const hour = parseInt(scheduledTime.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  // Infer from venue types
  if (venues && venues.length > 0) {
    const types = venues.map(v => v.venueType.toLowerCase()).join(' ');
    if (types.includes('breakfast') || types.includes('coffee') || types.includes('cafe')) {
      return 'morning/afternoon';
    }
    if (types.includes('bar') || types.includes('brewery') || types.includes('cocktail')) {
      return 'evening/night';
    }
    if (types.includes('restaurant') || types.includes('dinner')) {
      return 'evening';
    }
  }

  return 'unspecified';
}

/**
 * Validate an auto-scheduled queue event
 */
export async function validateQueueEvent(
  event: QueueEvent,
  groupContext?: GroupContext
): Promise<ValidationResult> {
  const startTime = Date.now();

  // Generate cache key from event properties that affect validation
  const venueKey = event.venues.map(v => `${v.venueName}:${v.venueType}`).sort().join('|');
  const cacheKey = `validate:${event.scheduledDate}:${event.scheduledTime || 'unset'}:${venueKey}:${event.sourceType}`;

  // Check cache first (1 hour TTL - validation results are stable for same inputs)
  const cached = getAICache<ValidationResult>(cacheKey);
  if (cached) {
    console.log('[AI Event Validator] Cache hit for event validation');
    await logApiCall({
      service: 'openai',
      method: 'validateQueueEvent',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: Date.now() - startTime,
      parameters: { eventId: event.id, venueCount: event.venues.length },
    });
    return cached;
  }

  try {
    const dayOfWeek = getDayOfWeek(event.scheduledDate);
    const timeOfDay = inferTimeOfDay(event.scheduledTime, event.venues);

    const venueList = event.venues
      .map((v, idx) => `${idx + 1}. ${v.venueName} (${v.venueType})`)
      .join('\n');

    const sourceDescription = event.sourceType === 'itinerary'
      ? `Saved itinerary "${event.sourceItineraryName}"`
      : 'Group favorites';

    // Few-shot examples improve consistency and quality
    const fewShotExamples = `
EXAMPLE 1 (Good Event):
Input: Saturday 7:00 PM, Venues: 1. Flour + Water (Italian Restaurant), 2. Trick Dog (Cocktail Bar)
Output: {"score": 95, "confidence": 0.95, "reasoning": "Perfect dinner-to-drinks flow on a Saturday evening.", "concerns": [], "suggestions": []}

EXAMPLE 2 (Bad Time Match):
Input: Tuesday 9:00 AM, Venues: 1. Salt & Straw (Ice Cream Shop)
Output: {"score": 45, "confidence": 0.90, "reasoning": "Ice cream at 9 AM on a weekday is unusual for a social event.", "concerns": ["Ice cream is typically an afternoon/evening treat", "Weekday morning is work time for most people"], "suggestions": ["Reschedule to afternoon (2-5 PM)", "Consider a weekend instead"]}

EXAMPLE 3 (Poor Venue Flow):
Input: Saturday 6:00 PM, Venues: 1. Burma Superstar (Restaurant), 2. State Bird Provisions (Restaurant), 3. Rich Table (Restaurant)
Output: {"score": 55, "confidence": 0.85, "reasoning": "Three full-service restaurants back-to-back is too much food.", "concerns": ["Three restaurants in one evening is excessive", "Guests will be uncomfortably full"], "suggestions": ["Keep one restaurant, add a bar or dessert spot", "Split into multiple event dates"]}`;

    const prompt = `Validate this auto-scheduled group event for time appropriateness and venue flow.

EVENT TO VALIDATE:
- Date: ${format(new Date(event.scheduledDate), 'MMMM d, yyyy')} (${dayOfWeek})
- Time: ${event.scheduledTime || 'Not specified'} (${timeOfDay})
- Venues: ${venueList}
- Source: ${sourceDescription}

SCORING RULES:
- 80-100: Auto-approve (great event)
- 60-79: Needs review (minor issues)
- 0-59: Not recommended (significant problems)

Deduct points for:
- Time mismatch (ice cream at 9 AM, bar at 10 AM): -20 to -30
- Poor venue flow (3 restaurants in a row): -15 to -20
- Questionable day choice (brunch on Tuesday): -10
- Minor concerns: -5 to -10

${fewShotExamples}

NOW VALIDATE THE EVENT ABOVE.
Return JSON: {"score": 0-100, "confidence": 0.0-1.0, "reasoning": "brief", "concerns": [], "suggestions": []}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini with few-shot examples for consistent, cost-effective validation
      messages: [
        {
          role: 'system',
          content: 'You are an expert event planner. Validate events using the examples as a guide. Be consistent with scoring.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Very low for maximum consistency
      max_tokens: 400,
    });

    let aiResponse;
    try {
      aiResponse = JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (parseError) {
      console.error('[AI Event Validator] Failed to parse AI response:', parseError);
      aiResponse = { score: 50, reasoning: 'Failed to parse AI response' };
    }

    // Log successful API call with cost tracking
    const responseTimeMs = Date.now() - startTime;
    await logApiCall({
      service: 'openai',
      method: 'validateQueueEvent',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost(
        'gpt-4o-mini',
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      parameters: {
        eventId: event.id,
        venueCount: event.venues.length,
        sourceType: event.sourceType,
      },
      metadata: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        score: aiResponse.score,
        confidence: aiResponse.confidence,
      },
    });

    // Validate and sanitize the response
    const score = Math.max(0, Math.min(100, aiResponse.score || 50));
    const reasoning = aiResponse.reasoning || 'Event validated by AI';
    const concerns = Array.isArray(aiResponse.concerns) ? aiResponse.concerns : [];
    const suggestions = Array.isArray(aiResponse.suggestions) ? aiResponse.suggestions : [];

    const result: ValidationResult = {
      score,
      reasoning,
      concerns,
      suggestions,
    };

    // Cache the result for 1 hour (3600 seconds)
    setAICache(cacheKey, result, 3600);

    return result;
  } catch (error) {
    // Log failed API call
    const responseTimeMs = Date.now() - startTime;
    await logApiCall({
      service: 'openai',
      method: 'validateQueueEvent',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs,
      errorMessage: (error as Error).message,
      parameters: {
        eventId: event.id,
        venueCount: event.venues.length,
        sourceType: event.sourceType,
      },
    });

    console.error('[AI Event Validator] Error validating event:', error);

    // Return safe default - requires manual review
    return {
      score: 50,
      reasoning: 'Unable to validate automatically. Please review this event.',
      concerns: ['AI validation unavailable'],
      suggestions: ['Manually verify venue and time appropriateness'],
    };
  }
}
