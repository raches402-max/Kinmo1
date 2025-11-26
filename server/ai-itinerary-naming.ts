import OpenAI from 'openai';
import { logApiCall, calculateOpenAICost, getAICache, setAICache } from './openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VenueForNaming {
  name: string;
  type: string;
}

export async function generateItineraryName(
  venues: VenueForNaming[],
  location: string
): Promise<string> {
  const startTime = Date.now();

  // Generate cache key from sorted venue names and location (stable inputs)
  const venueKey = venues.map(v => `${v.name}:${v.type}`).sort().join('|');
  const cacheKey = `itinerary-name:${venueKey}:${location}`;

  // Check cache first (24 hour TTL - venue names don't change)
  const cached = getAICache<string>(cacheKey);
  if (cached) {
    console.log('[AI Naming] Cache hit for itinerary name');
    await logApiCall({
      service: 'openai',
      method: 'generateItineraryName',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: Date.now() - startTime,
      parameters: { venueCount: venues.length, location },
    });
    return cached;
  }

  try {
    const venueList = venues.map((v, idx) => `${idx + 1}. ${v.name} (${v.type})`).join('\n');

    const prompt = `Generate a short, descriptive name for this itinerary based on the actual venues.

Venues:
${venueList}

Location: ${location}

Guidelines:
- Be literal and practical - describe what's actually in the itinerary
- If there's 1 venue, use: "[Venue Name] - [City]" (e.g., "Ryoko's - Oakland")
- If there are 2-3 venues of the same type, use: "[Type] at [Venue1] & [Venue2] - [City]" (e.g., "Ramen at Marufuku & Ippudo - SF")
- If there are 2-3 venues of different types, list the types: "[Type1] & [Type2] in [Neighborhood/City]" (e.g., "Ramen & Coffee in Stonestown")
- If there are 4+ venues, describe what they are: "[Types] in [City]" (e.g., "Japanese Food & Drinks - SF" or "Dinner & Dessert Spots - Oakland")
- Keep it under 50 characters
- DO NOT use embellished words like: adventure, journey, experience, tour, crawl, exploration, day, night
- Be straightforward - just say what the venues are
- Don't use quotation marks in the name

Return ONLY the itinerary name, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    });

    const name = response.choices[0]?.message?.content?.trim();

    // Log successful API call
    await logApiCall({
      service: 'openai',
      method: 'generateItineraryName',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs: Date.now() - startTime,
      costEstimate: calculateOpenAICost(
        'gpt-4o-mini',
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      parameters: { venueCount: venues.length, location },
      metadata: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        generatedName: name,
      },
    });

    if (!name) {
      return generateFallbackName(venues, location);
    }

    // Cache the result for 24 hours (86400 seconds) - itinerary names are stable
    setAICache(cacheKey, name, 86400);

    return name;
  } catch (error: any) {
    // Log failed API call
    await logApiCall({
      service: 'openai',
      method: 'generateItineraryName',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error.message,
      parameters: { venueCount: venues.length, location },
    });

    console.error('[AI Naming] Error generating name:', error);
    return generateFallbackName(venues, location);
  }
}

function generateFallbackName(venues: VenueForNaming[], location: string): string {
  const city = location.split(',')[0].trim();

  if (venues.length === 1) {
    return `${venues[0].name} - ${city}`;
  }

  if (venues.length === 2) {
    return `${venues[0].name} & ${venues[1].name} - ${city}`;
  }

  const types = Array.from(new Set(venues.map(v => v.type.toLowerCase())));

  if (types.length === 1) {
    const typeCapitalized = types[0].charAt(0).toUpperCase() + types[0].slice(1);
    return `${typeCapitalized} in ${city}`;
  }

  return `${venues.length} Spots - ${city}`;
}
