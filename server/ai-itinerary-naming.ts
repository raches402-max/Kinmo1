import OpenAI from 'openai';

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
  try {
    const venueList = venues.map((v, idx) => `${idx + 1}. ${v.name} (${v.type})`).join('\n');

    const prompt = `Generate a short, catchy name for a group outing itinerary.

Venues:
${venueList}

Location: ${location}

Guidelines:
- If there's 1 main venue, use format: "[Activity] at [Venue Name] - [City]" (e.g., "Dinner at Ryoko's - Oakland")
- If multiple venues, create a thematic name that captures the experience (e.g., "SF Coffee & Desserts Tour", "North Beach Food Crawl")
- Keep it under 50 characters
- Include the city name
- Make it conversational and fun
- Don't use quotation marks in the name

Return ONLY the itinerary name, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    });

    const name = response.choices[0]?.message?.content?.trim();
    
    if (!name) {
      return generateFallbackName(venues, location);
    }

    return name;
  } catch (error) {
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
  
  const types = [...new Set(venues.map(v => v.type.toLowerCase()))];
  
  if (types.length === 1) {
    return `${city} ${types[0]} Tour`;
  }
  
  return `${city} Outing (${venues.length} stops)`;
}
