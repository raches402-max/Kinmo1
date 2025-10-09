// Reference: javascript_openai blueprint
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ActivitySuggestion {
  venueName: string;
  venueType: string;
  description: string;
  reasoning: string;
  searchQuery: string; // For Google Places search
  priceEstimate?: string; // For events: "$25-50 per person", "Free", etc.
  timeConstraints?: string; // For events: "Only on Friday afternoons", "Weekends only", etc.
  complementaryFoodPlace?: string; // For outdoor venues: search query for nearby food place
}

export async function generateActivitySuggestions(groupData: {
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  meetingFrequency: string;
  availability: any;
  closenessLevel: number;
  noveltyPreference: number;
  activityCategories?: string[];
  pastPreferences?: string;
  additionalInstructions?: string;
  previousFeedback?: { venueName: string; venueType: string; feedback: string; description: string }[];
  votingFeedback?: { venueName: string; venueType: string; upvotes: number; downvotes: number; netVotes: number; description: string }[];
  previouslySuggestedVenues?: string[];
}): Promise<ActivitySuggestion[]> {
  try {
    // Calculate novelty split: novelty 1 = 6 familiar, novelty 3 = 3 familiar + 3 new, novelty 5 = 6 new
    // Formula: familiar = 6 - (noveltyPreference - 1) * 1.5, rounded
    const familiarCount = Math.round(6 - (groupData.noveltyPreference - 1) * 1.5);
    const newCount = 6 - familiarCount;

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

    // Format previous feedback for the prompt
    let feedbackContext = '';
    if (groupData.previousFeedback && groupData.previousFeedback.length > 0) {
      const lovedActivities = groupData.previousFeedback.filter(f => f.feedback === 'love').map(f => `${f.venueName} (${f.venueType})`);
      const moreActivities = groupData.previousFeedback.filter(f => f.feedback === 'more').map(f => `${f.venueName} (${f.venueType})`);
      const lessActivities = groupData.previousFeedback.filter(f => f.feedback === 'less').map(f => `${f.venueName} (${f.venueType})`);
      
      feedbackContext = '\nPrevious Feedback:';
      if (lovedActivities.length > 0) {
        feedbackContext += `\n- LOVED (suggest more like these): ${lovedActivities.join(', ')}`;
      }
      if (moreActivities.length > 0) {
        feedbackContext += `\n- Want more like: ${moreActivities.join(', ')}`;
      }
      if (lessActivities.length > 0) {
        feedbackContext += `\n- Want less like: ${lessActivities.join(', ')}`;
      }
    }

    // Format voting feedback from Favorites list
    let votingContext = '';
    if (groupData.votingFeedback && groupData.votingFeedback.length > 0) {
      const popularVenues = groupData.votingFeedback
        .filter(v => v.netVotes > 0)
        .sort((a, b) => b.netVotes - a.netVotes)
        .map(v => `${v.venueName} (${v.venueType}) [+${v.upvotes}/-${v.downvotes}]`);
      
      const unpopularVenues = groupData.votingFeedback
        .filter(v => v.netVotes < 0)
        .sort((a, b) => a.netVotes - b.netVotes)
        .map(v => `${v.venueName} (${v.venueType}) [+${v.upvotes}/-${v.downvotes}]`);
      
      votingContext = '\nFavorites List Voting:';
      if (popularVenues.length > 0) {
        votingContext += `\n- POPULAR (high net votes - suggest more like these): ${popularVenues.join(', ')}`;
      }
      if (unpopularVenues.length > 0) {
        votingContext += `\n- UNPOPULAR (negative net votes - avoid similar): ${unpopularVenues.join(', ')}`;
      }
    }

    // Format activity categories for the prompt
    const categoryLabels: Record<string, string> = {
      'restaurants': 'Restaurants',
      'brunch': 'Brunch Spots',
      'cafes': 'Cafes',
      'wine-bars': 'Wine / Cocktail Bars',
      'breweries': 'Breweries / Beer Gardens',
      'food-markets': 'Food Markets / Food Halls',
      'potlucks': 'Potlucks',
      'concerts': 'Concerts',
      'karaoke': 'Karaoke',
      'dancing': 'Dancing / Clubs',
      'comedy': 'Comedy Shows',
      'movies': 'Movie Theaters',
      'museums': 'Museums / Art Galleries',
      'sports': 'Sports Games',
      'outdoors': 'Hikes / Outdoors',
      'game-nights': 'Game Nights',
      'trivia': 'Trivia Nights'
    };
    
    let categoriesContext = '';
    if (groupData.activityCategories && groupData.activityCategories.length > 0) {
      const selectedCategories = groupData.activityCategories.map(id => categoryLabels[id] || id).join(', ');
      categoriesContext = `\nActivity Interests: ${selectedCategories}`;
    }

    // Format previously suggested venues to avoid repeats
    let avoidVenuesContext = '';
    if (groupData.previouslySuggestedVenues && groupData.previouslySuggestedVenues.length > 0) {
      avoidVenuesContext = `\n\nIMPORTANT - DO NOT suggest these venues again (already suggested): ${groupData.previouslySuggestedVenues.join(', ')}`;
    }

    const prompt = `You are an expert activity planner. Generate 6 diverse activity suggestions for a group with these preferences:

Location: ${groupData.locationBase}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person
Meeting Frequency: ${groupData.meetingFrequency}
Usual Availability: ${availabilityText}${categoriesContext}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}
${groupData.additionalInstructions ? `\n⚠️ CRITICAL USER REQUEST: ${groupData.additionalInstructions}` : ''}${feedbackContext}${votingContext}${avoidVenuesContext}

CRITICAL - Availability Constraint:
- The group is ONLY available during: ${availabilityText}
- DO NOT suggest events/activities outside their availability times
- If an event requires specific timing, it MUST match their availability
- Example: If they're only available "Mon-Fri evenings", DO NOT suggest "Saturday events" or "Sunday morning" activities

CRITICAL - Novelty Preference Strategy:
- Suggest ${familiarCount} FAMILIAR venues (things similar to past preferences, favorites, or things they've loved)
- Suggest ${newCount} NEW venues (novel experiences they haven't tried)
- Mark NEW suggestions with "NEW:" prefix in reasoning

Requirements:
1. ${groupData.additionalInstructions ? `⚠️ STRICTLY FOLLOW THE USER'S CRITICAL REQUEST ABOVE - This takes priority over everything else` : 'No additional user instructions'}
2. ${groupData.activityCategories && groupData.activityCategories.length > 0 ? `PRIORITIZE the Activity Interests listed above - these are the types of activities the group specifically wants` : 'No specific activity category preferences'}
3. ANALYZE Past Preferences to identify the TYPES of venues they prefer (restaurants, bars, cafes, activities, outdoor spaces, etc.)
4. PRIORITIZE suggesting the same TYPES of venues they've enjoyed historically
   - If past preferences are mostly restaurants → suggest mostly restaurants
   - If past preferences include bars/nightlife → include bars/nightlife
   - Match the category distribution of their past preferences
5. Suggest 6 specific types of venues/activities (not specific business names)
6. Each suggestion should fit within the budget range
7. Diversity within the same category is good (e.g., different cuisines if suggesting restaurants)
8. Provide a search query that can be used with Google Places API
9. FOR EVENTS ONLY (festivals, concerts, shows, sporting events, movies, comedy shows, etc.): 
   - Include a realistic "priceEstimate" (e.g., "$25-50 per person", "$15 tickets", "Free")
   - Include "timeConstraints" if applicable (e.g., "Only on Friday afternoons", "Weekends in summer", "Saturday evenings")
   - IMPORTANT: timeConstraints must match the group's availability (${availabilityText})
   - Include a "complementaryFoodPlace" search query (e.g., "restaurants near [event venue]" or "food near [festival location]")
10. FOR FULL MEAL VENUES - this includes: restaurants, brunch spots, food markets, food halls
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" search query for DRINKS/DESSERT options nearby to complete the meal experience
   - Examples: "dessert shops near [location]", "cocktail bars near [location]", "boba tea near [location]", "ice cream near [location]", "wine bars near [location]"
   - These are post-meal treats or drinks to extend the outing
11. FOR DRINKS/DESSERT VENUES - this includes: cafes, coffee shops, boba shops, cocktail bars, wine bars, breweries, beer gardens, dessert shops, ice cream shops, tea shops
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" search query for FULL MEAL options nearby
   - Examples: "restaurants near [location]", "brunch spots near [location]", "sandwich shops near [location]", "food trucks near [location]"
   - Logic: If the main venue is drinks/dessert, suggest a proper meal that complements it (not another drink/dessert spot)
12. FOR OUTDOOR VENUES - this includes: parks, beaches, hiking trails, nature areas, outdoor recreation spaces
   - Include a "complementaryFoodPlace" search query for nearby PORTABLE MEAL options
   - Examples: "sandwich shops near [location]", "food trucks near [location]", "delis near [location]", "poke bowls near [location]"
   - Focus on portable, casual food suitable for outdoor activities (avoid sit-down restaurants)

CRITICAL CONSTRAINTS for ALL complementaryFoodPlace queries:
- Distance: ALL suggestions must be within 0.5 miles of the main venue
- Quality: ALL suggestions must have 3.5+ star ratings or better
- Each search query should return multiple options for the group to choose from
13. IMPORTANT - Use previous feedback AND voting data to guide suggestions:
   - If activities were "LOVED", suggest very similar venues/types
   - If activities got "more", increase that type of suggestion
   - If activities got "less", avoid or minimize that type
   - If Favorites have HIGH net votes (popular), prioritize very similar venue types
   - If Favorites have NEGATIVE net votes (unpopular), avoid similar venue types
14. FOR REASONING: CRITICAL - Keep it extremely concise at 4-10 words. NO flowery language or fluff. Just state the key reason.
   Examples:
   - Good: "Fits budget, casual Asian shareable dining" (6 words)
   - Good: "Budget-friendly, intimate conversation spot" (4 words)
   - Bad: "Fits your budget and love for casual Asian dining with shareable plates" (too long)
   - Bad: "This wonderful venue will delight your senses with an amazing array of flavors" (way too long)
15. When suggesting something NEW (outside their usual range/novelty preference), explicitly say "NEW:" at the start of the reasoning to highlight it's a departure from their typical choices.
   Example: "NEW: Outside typical range, fits budget" (6 words)

Return your response as a JSON object with this structure:
{
  "suggestions": [
    {
      "venueName": "suggested venue type or activity name",
      "venueType": "category (restaurant, museum, park, event, festival, concert, etc)",
      "description": "brief description of the activity and why it suits this group",
      "reasoning": "why this is a good fit for this specific group based on their preferences",
      "searchQuery": "search terms for Google Places API (e.g., 'Italian restaurants in San Francisco')",
      "priceEstimate": "ONLY for events: realistic price estimate",
      "timeConstraints": "ONLY for events: date/time constraints if any",
      "complementaryFoodPlace": "search query for nearby options (<0.5mi, 3.5+ stars). Full meal venues→drinks/dessert. Drinks/dessert venues→full meals. Outdoor venues→portable meals."
    }
  ]
}`;

    console.log(`[OpenAI] Sending prompt with availability: ${availabilityText}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    console.log(`[OpenAI] Received response with ${result.suggestions?.length || 0} suggestions`);
    console.log(`[OpenAI] Raw response:`, JSON.stringify(result, null, 2));
    
    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error("OpenAI returned no activity suggestions. The response may be empty or malformed.");
    }
    
    return result.suggestions;
  } catch (error) {
    console.error("Error generating activity suggestions:", error);
    throw new Error("Failed to generate activity suggestions: " + (error as Error).message);
  }
}
