import OpenAI from "openai";
import type { Activity, VotingEvent, ItineraryItem } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SelectedVenue {
  sourceType: 'activity' | 'voting_event';
  sourceId: string;
  venueName: string;
  venueType: string;
  venueAddress: string | null;
  googlePlaceId: string | null;
  location?: { lat: number; lng: number };
}

interface ValidationResult {
  isValid: boolean;
  proposedOrder: string[]; // Array of sourceIds in suggested sequence
  validationNotes: string;
  issues?: string[];
}

// Calculate distance between two coordinates in miles
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function validateItinerary(
  selectedVenues: SelectedVenue[]
): Promise<ValidationResult> {
  if (selectedVenues.length < 1) {
    return {
      isValid: false,
      proposedOrder: [],
      validationNotes: "Please select at least 1 venue for an itinerary",
      issues: ["Minimum 1 venue required"],
    };
  }

  if (selectedVenues.length > 5) {
    return {
      isValid: false,
      proposedOrder: [],
      validationNotes: "Too many venues selected. Please select 1-5 venues max",
      issues: ["Maximum 5 venues allowed"],
    };
  }

  // Check proximity if we have location data
  const venuesWithLocations = selectedVenues.filter(v => v.location);
  const proximityIssues: string[] = [];
  
  if (venuesWithLocations.length >= 2) {
    for (let i = 0; i < venuesWithLocations.length; i++) {
      for (let j = i + 1; j < venuesWithLocations.length; j++) {
        const v1 = venuesWithLocations[i];
        const v2 = venuesWithLocations[j];
        if (v1.location && v2.location) {
          const distance = calculateDistance(
            v1.location.lat,
            v1.location.lng,
            v2.location.lat,
            v2.location.lng
          );
          if (distance > 3) {
            proximityIssues.push(
              `${v1.venueName} and ${v2.venueName} are ${distance.toFixed(1)} miles apart`
            );
          }
        }
      }
    }
  }

  // For single venue, skip AI validation and use simple default
  if (selectedVenues.length === 1) {
    return {
      isValid: true,
      proposedOrder: [selectedVenues[0].sourceId],
      validationNotes: "", // No notes needed for single venue
      issues: undefined,
    };
  }

  // Use AI to determine logical flow and order
  const venueDescriptions = selectedVenues.map((v, idx) => 
    `${idx + 1}. ${v.venueName} (${v.venueType})${v.venueAddress ? ` at ${v.venueAddress}` : ''}`
  ).join('\n');

  const prompt = `You are planning an evening itinerary. Given these venues, suggest the most logical order to visit them.

Selected Venues:
${venueDescriptions}

Consider:
- Typical flow: Full meal → Lighter options/drinks → Dessert
- Don't eat two full meals in a row
- Drinks/bars work well after dinner or before/after lighter fare
- Dessert typically comes last

Respond with:
1. The optimal order (using venue numbers from the list above)
2. ONE brief note (max 8 words) - only if there's something helpful to mention

EXAMPLES OF GOOD NOTES:
- "Dinner → drinks flow"
- "Dessert moved to end"
- "Bar before dinner works well"
- "" (empty if order is obvious)

EXAMPLES OF BAD NOTES (too wordy):
- "As there is only one venue listed (Portal), it serves as the brunch spot for a full meal..."
- "The itinerary follows a natural progression from dinner to drinks to dessert..."

Format your response as JSON:
{
  "order": [1, 3, 2],
  "reasoning": "Dinner → drinks flow"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert event planner. Be extremely concise - helpful facts only, no fluff.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || "{}");
    const proposedOrder = (aiResponse.order as number[] || []).map(idx => 
      selectedVenues[idx - 1]?.sourceId
    ).filter(Boolean);

    // Build validation notes - keep them brief
    let validationNotes = (aiResponse.reasoning || "").trim();
    
    // Add distance note if there's a proximity issue
    if (proximityIssues.length > 0) {
      validationNotes = validationNotes 
        ? `${validationNotes}. ${proximityIssues[0]}`
        : proximityIssues[0];
    }

    return {
      isValid: true,
      proposedOrder,
      validationNotes,
      issues: proximityIssues.length > 0 ? proximityIssues : undefined,
    };
  } catch (error) {
    console.error("Error validating itinerary with AI:", error);
    
    // Fallback: suggest order based on venue types
    const orderedVenues = [...selectedVenues].sort((a, b) => {
      const typeOrder = ['restaurant', 'cafe', 'bar', 'brewery', 'dessert', 'cafe'];
      const aIndex = typeOrder.findIndex(t => a.venueType.toLowerCase().includes(t));
      const bIndex = typeOrder.findIndex(t => b.venueType.toLowerCase().includes(t));
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

    return {
      isValid: true,
      proposedOrder: orderedVenues.map(v => v.sourceId),
      validationNotes: "Order based on typical flow: meals first, then drinks/dessert",
      issues: proximityIssues.length > 0 ? proximityIssues : undefined,
    };
  }
}
