/**
 * AI-Powered Venue Selection
 * Uses GPT-4o-mini to intelligently select venues that create high-confidence events
 */

import OpenAI from "openai";
import { logApiCall, calculateOpenAICost } from "./openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });

export type VenueForSelection = {
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
};

export type AISelectionResult = {
  selectedVenues: VenueForSelection[];
  reasoning: string;
  itineraryFlow: string;
  confidenceEstimate: number;
  rawResponse?: any;
};

/**
 * Use AI to select venues that will create a high-confidence event
 */
export async function selectVenuesWithAI(
  venues: VenueForSelection[],
  groupName: string,
  eventDate: Date,
  count: number = 3
): Promise<AISelectionResult | null> {
  const startTime = Date.now();

  try {
    console.log(`[AI Selection] Selecting ${count} venues from ${venues.length} options for ${groupName}`);

    // Take top 20 scored venues to reduce prompt size and focus on best options
    const topVenues = venues
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(20, venues.length));

    // Build venue list for prompt
    const venueList = topVenues.map((v, i) => {
      const isFavorite = v.feedback === 'favorite' || v.feedback === 'more_like_this';
      const favoriteMarker = isFavorite ? ' ⭐ FAVORITE' : '';
      const visitInfo = v.visitCount === 0
        ? '(Never visited)'
        : `(Visited ${v.visitCount}x, last ${Math.round(v.daysSinceLastVisit)} days ago)`;

      return `${i + 1}. ${v.name}${favoriteMarker}
   Type: ${v.venueType || 'Unknown'} | Category: ${v.category || 'N/A'}
   Rating: ${v.rating || 'N/A'} | ${visitInfo}
   Score: ${v.score.toFixed(2)} | Quality: ${v.qualityScore.toFixed(1)}`;
    }).join('\n\n');

    const prompt = `You are an expert event planner creating an itinerary for "${groupName}".
Event date: ${eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

AVAILABLE VENUES (choose ${count}):
${venueList}

CRITERIA FOR HIGH CONFIDENCE:
1. **Diversity** - Mix venue types (restaurant, bar, cafe, activity, etc.)
2. **Logical Flow** - Natural progression (e.g., dinner → drinks → dessert)
3. **Quality** - Prefer highly-rated venues and group favorites (marked ⭐)
4. **Variety** - Avoid duplicate venue types or cuisines
5. **Freshness** - Prefer venues never visited or not recently visited
6. **Favorites Priority** - Always include at least 1-2 favorites if available

Select ${count} venues that create a cohesive, high-quality experience.
Return ONLY valid JSON (no markdown, no code blocks):
{
  "selected_venues": [
    {"venue_index": 0, "reason": "why this venue"},
    {"venue_index": 2, "reason": "why this venue"}
  ],
  "itinerary_flow": "brief description of the event flow",
  "confidence_estimate": 85,
  "reasoning": "overall explanation of why this combination works"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert event planner. Select venues that create cohesive, high-quality experiences. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseTime = Date.now() - startTime;
    const content = response.choices[0].message.content;

    if (!content) {
      console.error('[AI Selection] Empty response from API');
      return null;
    }

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Selection] Failed to parse JSON:', content);
      return null;
    }

    // Validate response structure
    if (!parsed.selected_venues || !Array.isArray(parsed.selected_venues)) {
      console.error('[AI Selection] Invalid response structure:', parsed);
      return null;
    }

    // Map venue indices to actual venues
    const selectedVenues: VenueForSelection[] = [];
    for (const selection of parsed.selected_venues) {
      const index = selection.venue_index;
      if (index >= 0 && index < topVenues.length) {
        selectedVenues.push(topVenues[index]);
        console.log(`[AI Selection] Selected: ${topVenues[index].name} - ${selection.reason}`);
      } else {
        console.warn(`[AI Selection] Invalid venue index: ${index}`);
      }
    }

    if (selectedVenues.length === 0) {
      console.error('[AI Selection] No valid venues selected');
      return null;
    }

    // Calculate cost estimate
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens);

    // Log successful API call with cost tracking
    await logApiCall({
      service: 'openai',
      method: 'selectVenuesWithAI',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs: responseTime,
      costEstimate: cost,
      parameters: {
        groupName,
        venueCount: venues.length,
        requestedCount: count,
        selectedCount: selectedVenues.length,
      },
      metadata: {
        inputTokens,
        outputTokens,
        confidence: parsed.confidence_estimate,
      },
    });

    console.log(`[AI Selection] Selected ${selectedVenues.length} venues in ${responseTime}ms`);
    console.log(`[AI Selection] Cost: $${cost.toFixed(4)} | Confidence: ${parsed.confidence_estimate}%`);
    console.log(`[AI Selection] Flow: ${parsed.itinerary_flow}`);

    return {
      selectedVenues,
      reasoning: parsed.reasoning || 'AI selected these venues',
      itineraryFlow: parsed.itinerary_flow || 'Event itinerary',
      confidenceEstimate: parsed.confidence_estimate || 70,
      rawResponse: parsed,
    };

  } catch (error: any) {
    // Log failed API call
    await logApiCall({
      service: 'openai',
      method: 'selectVenuesWithAI',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error.message,
      parameters: { groupName, venueCount: venues.length },
    });

    console.error('[AI Selection] Error:', error.message);
    return null;
  }
}
