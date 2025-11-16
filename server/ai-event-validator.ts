/**
 * AI Event Validator
 * Validates auto-scheduled events for time appropriateness, venue flow, and pacing
 */

import OpenAI from 'openai';
import { format } from 'date-fns';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QueueVenue {
  sourceType: 'voting_event' | 'activity';
  sourceId: string;
  venueName: string;
  venueType: string;
  venueAddress?: string | null;
  googlePlaceId?: string | null;
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
  try {
    const dayOfWeek = getDayOfWeek(event.scheduledDate);
    const timeOfDay = inferTimeOfDay(event.scheduledTime, event.venues);

    const venueList = event.venues
      .map((v, idx) => `${idx + 1}. ${v.venueName} (${v.venueType})`)
      .join('\n');

    const sourceDescription = event.sourceType === 'itinerary'
      ? `Saved itinerary "${event.sourceItineraryName}"`
      : 'Group favorites';

    const prompt = `You are validating an auto-scheduled group event. Analyze if this event makes sense.

Event Details:
- Date: ${format(new Date(event.scheduledDate), 'MMMM d, yyyy')} (${dayOfWeek})
- Time: ${event.scheduledTime || 'Not specified'}
- Time of Day: ${timeOfDay}
- Number of Venues: ${event.venues.length}
- Source: ${sourceDescription}

Venues:
${venueList}

Validation Criteria:

1. TIME APPROPRIATENESS (Most Important):
   - Are these venue types appropriate for the scheduled time?
   - Examples of BAD matches:
     * Ice cream shop at 9 AM on a weekday
     * Breakfast cafe at 9 PM
     * Bar at 10 AM
   - Examples of GOOD matches:
     * Brunch cafe at 11 AM on Saturday
     * Restaurant + bar at 7 PM
     * Dessert spot at 8 PM

2. VENUE COMBINATION LOGIC:
   - Do these venues flow well together for a single event?
   - Examples of BAD combinations:
     * 3 full restaurants in a row
     * 2 breakfast spots back-to-back
   - Examples of GOOD combinations:
     * Dinner → Bar → Dessert
     * Lunch → Coffee
     * Single restaurant/cafe/bar

3. DAY OF WEEK MATCH:
   - Does the day of week make sense for these venue types?
   - Weekend vs weekday considerations:
     * Brunch works better on weekends
     * Bars work any evening
     * Coffee shops work any day

4. PACING:
   - Is ${dayOfWeek} a reasonable day for a social event?
   - Weeknights are fine for casual events
   - Avoid if this feels too rushed or awkward

Scoring Rubric:
- Start at 100
- Deduct 20-30 points for major time mismatches (ice cream at 9 AM)
- Deduct 15-20 points for poor venue flow (3 meals in a row)
- Deduct 10 points for questionable day choice
- Deduct 5-10 points for minor concerns

Score Interpretation:
- 80-100: Validated - This is a great event, auto-approve
- 60-79: Needs Review - Decent but has minor issues
- 0-59: Not Recommended - Has significant problems

Return JSON with this exact structure:
{
  "score": <number 0-100>,
  "reasoning": "<1-2 sentence explanation of the score>",
  "concerns": ["<specific concern 1>", "<specific concern 2>"],
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>"]
}

Important:
- If score >= 80, concerns and suggestions can be empty arrays
- If score < 80, provide at least 1 concern and 1 suggestion
- Be specific and actionable in concerns/suggestions
- Keep reasoning concise (under 100 characters)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert event planner validating auto-scheduled events. Be concise and specific.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

    // Validate and sanitize the response
    const score = Math.max(0, Math.min(100, aiResponse.score || 50));
    const reasoning = aiResponse.reasoning || 'Event validated by AI';
    const concerns = Array.isArray(aiResponse.concerns) ? aiResponse.concerns : [];
    const suggestions = Array.isArray(aiResponse.suggestions) ? aiResponse.suggestions : [];

    return {
      score,
      reasoning,
      concerns,
      suggestions,
    };
  } catch (error) {
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
