// Reference: javascript_openai blueprint
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ActivitySuggestion {
  venueName: string;
  venueType: string;
  description: string;
  reasoning: string;
  searchQuery: string; // For Google Places search
}

export async function generateActivitySuggestions(groupData: {
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  meetingFrequency: string;
  availability: any;
  closenessLevel: number;
  noveltyPreference: number;
  pastPreferences?: string;
  additionalInstructions?: string;
}): Promise<ActivitySuggestion[]> {
  try {
    const closenessDescriptions = [
      "acquaintances who are just getting to know each other",
      "casual friends who enjoy spending time together",
      "good friends with shared interests",
      "close friends with strong bonds",
      "best friends or family who know each other very well"
    ];

    const noveltyDescriptions = [
      "strongly prefer familiar, tried-and-true places they've enjoyed before",
      "generally prefer familiar places but open to occasional new experiences",
      "enjoy a balanced mix of familiar favorites and new discoveries",
      "prefer trying new places and experiences regularly",
      "always seeking novel, unique, and adventurous experiences"
    ];

    // Format availability for display
    const formatAvailabilityForPrompt = (availability: any): string => {
      if (typeof availability === 'string') {
        return availability;
      }
      
      if (typeof availability === 'object' && availability !== null) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const times = ['morning', 'afternoon', 'evening'];
        const selectedSlots: string[] = [];
        
        days.forEach(day => {
          if (availability[day]) {
            const dayTimes = times.filter(time => availability[day][time]);
            if (dayTimes.length > 0) {
              selectedSlots.push(`${day}: ${dayTimes.join(', ')}`);
            }
          }
        });
        
        return selectedSlots.length > 0 ? selectedSlots.join('; ') : 'Flexible';
      }
      
      return 'Flexible';
    };

    const availabilityText = formatAvailabilityForPrompt(groupData.availability);

    const prompt = `You are an expert activity planner. Generate 6 diverse activity suggestions for a group with these preferences:

Location: ${groupData.locationBase}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person
Meeting Frequency: ${groupData.meetingFrequency}
Usual Availability: ${availabilityText}
Group Closeness: ${closenessDescriptions[groupData.closenessLevel - 1]}
Experience Preference: ${noveltyDescriptions[groupData.noveltyPreference - 1]}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}
${groupData.additionalInstructions ? `Additional Instructions: ${groupData.additionalInstructions}` : ''}

Requirements:
1. Suggest 6 specific types of venues/activities (not specific business names)
2. Each suggestion should fit within the budget range
3. Consider the group's closeness level (intimate vs casual activities)
4. Balance familiar and novel based on their novelty preference
5. Ensure variety across the 6 suggestions
6. Provide a search query that can be used with Google Places API

Return your response as a JSON object with this structure:
{
  "suggestions": [
    {
      "venueName": "suggested venue type or activity name",
      "venueType": "category (restaurant, museum, park, etc)",
      "description": "brief description of the activity and why it suits this group",
      "reasoning": "why this is a good fit for this specific group based on their preferences",
      "searchQuery": "search terms for Google Places API (e.g., 'Italian restaurants in San Francisco')"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert activity planner who creates personalized suggestions based on group preferences. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.suggestions || [];
  } catch (error) {
    console.error("Error generating activity suggestions:", error);
    throw new Error("Failed to generate activity suggestions: " + (error as Error).message);
  }
}
