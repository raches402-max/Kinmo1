// Reference: javascript_openai blueprint
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Time category mapping based on venue type
export function categorizeByTime(venueType: string): 'quick' | 'standard' | 'large' {
  const type = venueType.toLowerCase();
  
  // Quick: Under 90 min - Drinks, bars, desserts, cafes
  const quickKeywords = [
    'bar', 'cocktail', 'wine', 'brewery', 'beer', 'pub',
    'cafe', 'coffee', 'boba', 'bubble tea', 'tea',
    'dessert', 'ice cream', 'gelato', 'bakery', 'pastry'
  ];
  
  // Large: 4+ hours - Activities, hikes, outdoor experiences, events
  const largeKeywords = [
    'hike', 'hiking', 'trail', 'park', 'outdoor', 'beach', 'nature',
    'museum', 'gallery', 'art', 'exhibit',
    'concert', 'show', 'festival', 'event', 'game', 'sporting',
    'activity', 'experience', 'adventure', 'tour'
  ];
  
  // Check quick first
  if (quickKeywords.some(keyword => type.includes(keyword))) {
    return 'quick';
  }
  
  // Check large
  if (largeKeywords.some(keyword => type.includes(keyword))) {
    return 'large';
  }
  
  // Default to standard (1-3 hours) - restaurants, meals, etc.
  return 'standard';
}

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
  likedConcepts?: string[];
  passedConcepts?: string[];
  previouslySuggestedVenues?: string[];
}): Promise<ActivitySuggestion[]> {
  try {
    // Generate 15 suggestions to account for duplicates after Google Places enrichment
    // After deduplication, we'll take the first 6 unique ones
    // This ensures we always have 6 cards even in areas with limited venue options
    
    // Calculate novelty split based on 15 suggestions
    // novelty 1 = 15 familiar, novelty 3 = 7-8 split, novelty 5 = 15 new
    // Formula: familiar = 15 - (noveltyPreference - 1) * 3.75, rounded
    const familiarCount = Math.round(15 - (groupData.noveltyPreference - 1) * 3.75);
    const newCount = 15 - familiarCount;

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

    // Format swipe session feedback
    let swipeContext = '';
    if ((groupData.likedConcepts && groupData.likedConcepts.length > 0) || 
        (groupData.passedConcepts && groupData.passedConcepts.length > 0)) {
      swipeContext = '\nSwipe Session Preferences:';
      if (groupData.likedConcepts && groupData.likedConcepts.length > 0) {
        swipeContext += `\n- LIKED concepts (prioritize these types): ${groupData.likedConcepts.join(', ')}`;
      }
      if (groupData.passedConcepts && groupData.passedConcepts.length > 0) {
        swipeContext += `\n- PASSED concepts (avoid these types): ${groupData.passedConcepts.join(', ')}`;
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

    const prompt = `You are an expert activity planner. Generate 15 activity suggestions for a group with these preferences:

NOTE: You will generate 15 suggestions, but only 6 will be shown to the user after removing duplicates. This ensures 6 unique venues even if Google Places returns the same restaurant for multiple search queries.

Location: ${groupData.locationBase}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person
Meeting Frequency: ${groupData.meetingFrequency}
Usual Availability: ${availabilityText}${categoriesContext}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}
${groupData.additionalInstructions ? `\n⚠️ USER INSTRUCTIONS: ${groupData.additionalInstructions}` : ''}${feedbackContext}${votingContext}${swipeContext}${avoidVenuesContext}

CRITICAL - Availability Constraint:
- The group is ONLY available during: ${availabilityText}
- DO NOT suggest events/activities outside their availability times
- If an event requires specific timing, it MUST match their availability
- Example: If they're only available "Mon-Fri evenings", DO NOT suggest "Saturday events" or "Sunday morning" activities

CRITICAL - How to interpret USER INSTRUCTIONS:
- If the user provides SPECIFIC venue types (e.g., "Boba", "Sushi", "Pizza"), generate ALL 15 suggestions of that type for variety within the theme
- If the user provides GENERAL guidance (e.g., "something adventurous", "romantic vibes", "fun and lively", "dinner plans", "mostly restaurants"), maintain diversity across ALL time categories while matching the mood/theme
- Use your natural language understanding to distinguish between requests for specific venue types vs. general preferences
- Examples of SPECIFIC requests (all 15 should match): "Boba", "Korean BBQ only", "Get tacos", "Sushi restaurants"
- Examples of GENERAL requests (maintain diversity across time categories): "something adventurous", "romantic atmosphere", "fun night out", "unique experiences", "dinner plans", "mostly restaurants"

CRITICAL - Time-Based Organization Strategy (MANDATORY):
- Suggestions will be organized by TIME COMMITMENT:
  * QUICK (<90 min): Drinks, bars, desserts, cafes - in and out
  * STANDARD (1-3 hours): Full meals (breakfast, lunch, dinner) - the main event
  * LARGE (4+ hours): Activities, hikes, shows, museums - commitment required
- MANDATORY DISTRIBUTION - You MUST generate exactly 15 suggestions with this breakdown:
  * 4 QUICK suggestions (boba tea shops, cocktail bars, ice cream parlors, coffee shops, wine bars, dessert cafes)
  * 9 STANDARD suggestions (restaurants - various cuisines)
  * 2 LARGE suggestions (activities, outdoor venues, shows) - only if the group's interests support them, otherwise add more QUICK or STANDARD
- CRITICAL: QUICK items are STANDALONE main venue suggestions, NOT complementary options
- EVEN IF user instructions say "dinner plans" or "mostly restaurants", you MUST still include 4 QUICK venue suggestions
- Think of QUICK venues as pre-dinner drinks or post-dinner dessert spots - they complement the main meal but are separate experiences

CRITICAL - Novelty Preference Strategy:
- Suggest ${familiarCount} FAMILIAR venues (things similar to past preferences, favorites, or things they've loved)
- Suggest ${newCount} NEW venues (novel experiences they haven't tried)
- Mark NEW suggestions with "NEW:" prefix in reasoning
- NOTE: If user instructions specify a particular venue type, ALL suggestions should be that type (but vary the specific venues)

Requirements:
1. ${groupData.additionalInstructions ? `⚠️ INTERPRET AND FOLLOW THE USER INSTRUCTIONS ABOVE - If they specify a venue type, focus all suggestions on that type. If they provide general guidance, maintain diversity while matching the theme.` : 'No additional user instructions'}
2. ${groupData.activityCategories && groupData.activityCategories.length > 0 ? `PRIORITIZE the Activity Interests listed above - these are the types of activities the group specifically wants` : 'No specific activity category preferences'}
3. ANALYZE Past Preferences to identify the TYPES of venues they prefer (restaurants, bars, cafes, activities, outdoor spaces, etc.)
4. PRIORITIZE suggesting the same TYPES of venues they've enjoyed historically
   - If past preferences are mostly restaurants → suggest mostly restaurants
   - If past preferences include bars/nightlife → include bars/nightlife
   - Match the category distribution of their past preferences
5. Suggest 15 specific types of venues/activities (not specific business names) - we'll show 6 after deduplication
6. Each suggestion should fit within the budget range
7. CRITICAL - BE SPECIFIC WITH CUISINE TYPES:
   - NEVER use broad categories like "Asian restaurants" or "Asian food"
   - ALWAYS break down into SPECIFIC cuisines: Sushi, Korean BBQ (KBBQ), Ramen, Pho, Dumplings, Thai, Vietnamese, Chinese (Szechuan/Cantonese/Dim Sum), Japanese Izakaya, Malaysian, Filipino, etc.
   - NEVER use generic "Italian restaurants" - specify: Pizza, Pasta, Trattoria, Osteria
   - NEVER use generic "Mexican restaurants" - specify: Tacos, Burritos, Tortas, Tequila Bars
   - Each cuisine type should be DISTINCT to avoid Google returning the same venues repeatedly
   - Examples of GOOD search queries: "sushi restaurants near X", "Korean BBQ near X", "pho restaurants near X", "dim sum near X"
   - Examples of BAD search queries: "Asian restaurants near X", "Asian food near X", "ethnic cuisine near X"
8. Provide a search query that can be used with Google Places API
9. FOR EVENTS ONLY (festivals, concerts, shows, sporting events, movies, comedy shows, etc.): 
   - Include a realistic "priceEstimate" (e.g., "$25-50 per person", "$15 tickets", "Free")
   - Include "timeConstraints" if applicable (e.g., "Only on Friday afternoons", "Weekends in summer", "Saturday evenings")
   - IMPORTANT: timeConstraints must match the group's availability (${availabilityText})
   - Include a "complementaryFoodPlace" search query (e.g., "restaurants near [event venue]" or "food near [festival location]")
10. FOR FULL MEAL VENUES - this includes: restaurants, brunch spots, food markets, food halls
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" search query for DRINKS/DESSERT options nearby to complete the meal experience
   - BE SPECIFIC AND VARIED - use different types each time (don't repeat "dessert shops" over and over)
   - Examples: "artisan ice cream near [location]", "craft cocktail bars near [location]", "boba tea cafes near [location]", "gelato shops near [location]", "sake bars near [location]", "specialty coffee near [location]"
   - These are post-meal treats or drinks to extend the outing
11. FOR DRINKS/DESSERT VENUES - this includes: cafes, coffee shops, boba shops, cocktail bars, wine bars, breweries, beer gardens, dessert shops, ice cream shops, tea shops
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" search query for FULL MEAL options nearby
   - BE SPECIFIC AND VARIED - use different cuisines/types each time (don't repeat "restaurants" generically)
   - Examples: "ramen shops near [location]", "taco spots near [location]", "banh mi shops near [location]", "pizza places near [location]", "poke bowl restaurants near [location]", "dim sum near [location]"
   - Logic: If the main venue is drinks/dessert, suggest a proper meal that complements it (not another drink/dessert spot)
12. FOR OUTDOOR VENUES - this includes: parks, beaches, hiking trails, nature areas, outdoor recreation spaces
   - Include a "complementaryFoodPlace" search query for nearby PORTABLE MEAL options
   - BE SPECIFIC AND VARIED - use different portable food types each time
   - Examples: "banh mi sandwich shops near [location]", "taco trucks near [location]", "gourmet delis near [location]", "poke bowl takeout near [location]", "burrito places near [location]"
   - Focus on portable, casual food suitable for outdoor activities (avoid sit-down restaurants)

CRITICAL CONSTRAINTS for ALL complementaryFoodPlace queries:
- Distance: ALL suggestions must be within 0.5 miles of the main venue
- Quality: ALL suggestions must have 3.5+ star ratings or better
- VARIETY: Each suggestion should use a DIFFERENT type of complementary place (don't repeat the same type like "dessert shops" multiple times)
- Each search query should return multiple options for the group to choose from
13. IMPORTANT - Use previous feedback AND voting data to guide suggestions:
   - If activities were "LOVED", suggest very similar venues/types
   - If activities got "more", increase that type of suggestion
   - If activities got "less", avoid or minimize that type
   - If Favorites have HIGH net votes (popular), prioritize very similar venue types
   - If Favorites have NEGATIVE net votes (unpopular), avoid similar venue types
14. CRITICAL - Use Swipe Session Preferences to refine suggestions:
   - LIKED concepts: These are activity types the group has shown interest in - PRIORITIZE suggesting these types
   - PASSED concepts: These are activity types the group is NOT interested in - AVOID suggesting these types
   - Swipe preferences reveal what the group wants to explore, so weight them heavily in your suggestions
15. FOR DESCRIPTION: CRITICAL - ULTRA-SHORT AND PRAGMATIC. NOUNS ONLY. ZERO ADJECTIVES.
   - RULE: Use ONLY nouns. ZERO adjectives, ZERO descriptive words. Format: cuisine + food type.
   - BANNED: ALL adjectives including "Wood-fired", "Small", "Tabletop", "Spicy", "Rich", "Fresh", "Authentic", "Traditional", "Amazing", etc.
   - GOOD examples (nouns only, 2-4 words):
     * "Sushi and sashimi" (3 words - nouns only)
     * "Korean BBQ" (2 words - nationality + noun)
     * "Ramen bowls" (2 words - nouns only)
     * "Dim sum" (2 words - nouns only)
     * "Pizza and pasta" (3 words - nouns only)
     * "Cocktails" (1 word - noun only)
     * "Tapas" (1 word - noun only)
   - BAD examples (contains ANY adjectives):
     * "Wood-fired pizza" ❌ ("Wood-fired" is adjective)
     * "Small plates" ❌ ("Small" is adjective)
     * "Korean BBQ, tabletop grills" ❌ ("tabletop" is adjective modifier)
     * "Ramen with rich broths" ❌ ("rich" is adjective)
     * "Szechuan spicy dishes" ❌ ("spicy" is adjective)
     * "Fresh sushi" ❌ ("Fresh" is adjective)
   - 2-4 words maximum
   - Format: [Cuisine/nationality] + [Food type], NOTHING else
16. FOR REASONING: CRITICAL - Ultra-short and direct. 2-5 words maximum. NO vague phrases. Be specific.
   - DO NOT mention budget (it's assumed everything shown fits budget)
   - BANNED VAGUE PHRASES: "interaction", "sharing", "social experience", "group dining", "intimate", "experience"
   - INSTEAD be SPECIFIC about WHAT matches their preferences
   - FOCUS on: Matches past preferences, Familiar cuisine type, NEW cuisine
   - GOOD examples (specific, direct, 2-5 words):
     * "Familiar sushi preference" (3 words)
     * "Matches Korean BBQ history" (4 words)
     * "Past dumpling favorite" (3 words)
     * "Regular Thai spot" (3 words)
   - BAD examples (vague, fluffy, or too long):
     * "Social, shareable dining experience" ❌ (vague "social, shareable")
     * "Interactive dining, great for groups" ❌ (vague "interactive", too long)
     * "Interaction and sharing" ❌ (completely vague)
     * "Intimate conversation spot" ❌ (vague "intimate")
     * "Budget-friendly Korean BBQ" ❌ (mentions budget)
17. When suggesting something NEW (outside their usual range), start with "NEW:" and be specific about what's new.
   - GOOD: "NEW: Unfamiliar Filipino cuisine" (4 words - specific)
   - BAD: "NEW: Unique flavors to explore" ❌ (vague)

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
    console.log(`[OpenAI] Received response with ${result.suggestions?.length || 0} suggestions (will show 6 after deduplication)`);
    console.log(`[OpenAI] Raw response:`, JSON.stringify(result, null, 2));
    
    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error("OpenAI returned no activity suggestions. The response may be empty or malformed.");
    }
    
    if (result.suggestions.length < 15) {
      console.warn(`[OpenAI] Warning: Only received ${result.suggestions.length} suggestions instead of 15 - may result in fewer than 6 unique activities after deduplication`);
    }
    
    return result.suggestions;
  } catch (error) {
    console.error("Error generating activity suggestions:", error);
    throw new Error("Failed to generate activity suggestions: " + (error as Error).message);
  }
}

export interface SwipeConcept {
  conceptType: string; // e.g., "karaoke", "breweries", "outdoor-activities"
  conceptDescription: string; // e.g., "Karaoke Night at Local Bar", "Craft Brewery Tour"
}

export async function generateSwipeConcepts(groupData: {
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  activityCategories?: string[];
  pastPreferences?: string;
  previouslySeenConcepts?: string[];
}): Promise<SwipeConcept[]> {
  try {
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

    // Format previously seen concepts to avoid repeats
    let avoidContext = '';
    if (groupData.previouslySeenConcepts && groupData.previouslySeenConcepts.length > 0) {
      avoidContext = `\n\nIMPORTANT - DO NOT suggest these concepts again (already shown): ${groupData.previouslySeenConcepts.join(', ')}`;
    }

    const prompt = `You are an expert activity planner. Generate 20 diverse activity concept ideas for a group to swipe through.

Location: ${groupData.locationBase}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person${categoriesContext}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}${avoidContext}

Requirements:
1. Generate 20 specific, actionable activity ideas (NOT generic vibes or actions)
2. Each concept should fit within the budget range
3. ${groupData.activityCategories && groupData.activityCategories.length > 0 ? `PRIORITIZE the Activity Interests listed above - focus on these types` : 'Suggest a diverse mix of activity types'}
4. Be SPECIFIC about the activity - avoid generic phrases like "bar hopping" or "clubbing"
5. Examples of GOOD concepts (specific activities):
   - "Pottery Painting Workshop"
   - "Sunrise Trail Hike"
   - "Hot Yoga Class"
   - "Pickleball Match"
   - "Wine & Paint Night"
   - "Trivia at Irish Pub"
   - "Sunday Farmers Market"
   - "Rooftop Cocktails"
   - "Bowling Night"
6. Examples of BAD concepts (too vague/generic):
   - "Bar hopping in the city" (too generic)
   - "Clubbing till 2am" (just an action)
   - "Going to museums" (too vague)
7. Include a mix of food, entertainment, and activities
8. Keep descriptions concise (2-4 words max) and specific

For each concept, provide:
- conceptType: a short category slug (e.g., "pottery-class", "sunrise-hike", "hot-yoga", "pickleball")
- conceptDescription: a specific 2-4 word activity name (e.g., "Pottery Painting Workshop", "Sunrise Trail Hike", "Hot Yoga Class")

Return your response as a JSON object with this structure:
{
  "concepts": [
    {
      "conceptType": "category-slug",
      "conceptDescription": "Short catchy description"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert activity planner who creates engaging concept ideas for groups to explore. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    if (!result.concepts || result.concepts.length === 0) {
      throw new Error("OpenAI returned no swipe concepts. The response may be empty or malformed.");
    }
    
    return result.concepts;
  } catch (error) {
    console.error("Error generating swipe concepts:", error);
    throw new Error("Failed to generate swipe concepts: " + (error as Error).message);
  }
}
