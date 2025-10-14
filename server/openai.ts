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
    // Generate 30 suggestions to account for duplicates after Google Places enrichment
    // After deduplication, we'll take the first 6 unique ones
    // This ensures we always have 6 cards even in areas with limited venue options
    
    // Calculate novelty split based on 30 suggestions
    // novelty 1 = 30 familiar, novelty 3 = 15-15 split, novelty 5 = 30 new
    // Formula: familiar = 30 - (noveltyPreference - 1) * 7.5, rounded
    const familiarCount = Math.round(30 - (groupData.noveltyPreference - 1) * 7.5);
    const newCount = 30 - familiarCount;

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

    const prompt = `You are an expert activity planner. Generate 30 activity suggestions for a group with these preferences:

NOTE: You will generate 30 suggestions, but only 6 will be shown to the user after removing duplicates. This ensures 6 unique venues even if Google Places returns the same restaurant for multiple search queries.

Location: ${groupData.locationBase}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person
Meeting Frequency: ${groupData.meetingFrequency}
Usual Availability: ${availabilityText}
${groupData.additionalInstructions ? `\n🚨 USER INSTRUCTIONS (OVERRIDES EVERYTHING): ${groupData.additionalInstructions}` : `${categoriesContext}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}${feedbackContext}${votingContext}${swipeContext}`}${avoidVenuesContext}

CRITICAL - Availability Constraint:
- The group is ONLY available during: ${availabilityText}
- DO NOT suggest events/activities outside their availability times
- If an event requires specific timing, it MUST match their availability
- Example: If they're only available "Mon-Fri evenings", DO NOT suggest "Saturday events" or "Sunday morning" activities

${groupData.additionalInstructions ? `🚨 CRITICAL - USER INSTRUCTIONS MODE (ABSOLUTE PRIORITY):
- The user has provided specific instructions in the text box above
- IGNORE ALL OTHER CONTEXT: Activity Interests, Past Preferences, Voting Feedback, and Swipe Feedback are NOT relevant
- ONLY focus on what the user typed in the USER INSTRUCTIONS
- If they specify a venue type (like "Boba", "Sushi", "Pizza", "Korean BBQ"), generate ALL 30 suggestions of that exact type
- If they provide general guidance (like "something fun", "adventurous"), maintain diversity while matching the theme
- Use your natural language understanding to distinguish between specific venue types vs. general preferences` : `CRITICAL - How to interpret preferences:
- If Activity Interests are specified, prioritize those activity types
- Analyze Past Preferences to understand venue types they prefer
- Consider Voting Feedback and Swipe Feedback to refine suggestions
- Maintain diversity across time categories (4 QUICK + 9 STANDARD + 2 LARGE distribution)`}

CRITICAL - Time-Based Organization Strategy (ONLY applies when user provides GENERAL guidance):
- Suggestions will be organized by TIME COMMITMENT:
  * QUICK (<90 min): Drinks, bars, desserts, cafes - in and out
  * STANDARD (1-3 hours): Full meals (breakfast, lunch, dinner) - the main event
  * LARGE (4+ hours): Activities, hikes, shows, museums - commitment required
- MANDATORY DISTRIBUTION (only when user gives GENERAL guidance):
  * 4 QUICK suggestions (boba tea shops, cocktail bars, ice cream parlors, coffee shops, wine bars, dessert cafes)
  * 9 STANDARD suggestions (restaurants - various cuisines)
  * 2 LARGE suggestions (activities, outdoor venues, shows) - only if the group's interests support them, otherwise add more QUICK or STANDARD
- CRITICAL: QUICK items are STANDALONE main venue suggestions, NOT complementary options
- Think of QUICK venues as pre-dinner drinks or post-dinner dessert spots - they complement the main meal but are separate experiences

${!groupData.additionalInstructions ? `CRITICAL - Novelty Preference Strategy:
- Suggest ${familiarCount} FAMILIAR venues (things similar to past preferences, favorites, or things they've loved)
- Suggest ${newCount} NEW venues (novel experiences they haven't tried)
- Mark NEW suggestions with "NEW:" prefix in reasoning` : ''}

Requirements:
1. ${groupData.additionalInstructions ? `🚨 FOLLOW ONLY THE USER INSTRUCTIONS ABOVE - Ignore all other context (Activity Interests, Past Preferences, Feedback). If they specify a venue type (like "Boba"), generate ALL 15 of that type. If they give general guidance, maintain diversity while matching the theme.` : 'Use Activity Interests, Past Preferences, and Feedback to guide suggestions'}
2. ${!groupData.additionalInstructions && groupData.activityCategories && groupData.activityCategories.length > 0 ? `PRIORITIZE the Activity Interests - these are the types of activities the group specifically wants` : ''}
3. ${!groupData.additionalInstructions ? 'ANALYZE Past Preferences to identify venue TYPES they prefer (restaurants, bars, cafes, activities, etc.)' : ''}
4. ${!groupData.additionalInstructions ? 'PRIORITIZE suggesting the same TYPES of venues they\'ve enjoyed historically' : ''}
5. 🚨 CRITICAL - NEVER SUGGEST AIRPORT VENUES: DO NOT suggest any venues located inside airports (terminals, gates, etc.) UNLESS the user EXPLICITLY asks for "airport activities" or "activities inside an airport". Airport restaurants, cafes, and shops are BANNED unless specifically requested.
6. Suggest 15 specific types of venues/activities (not specific business names) - we'll show 6 after deduplication
7. Each suggestion should fit within the budget range
8. CRITICAL - BE SPECIFIC WITH CUISINE TYPES:
   - NEVER use broad categories like "Asian restaurants" or "Asian food"
   - ALWAYS break down into SPECIFIC cuisines: Sushi, Korean BBQ (KBBQ), Ramen, Pho, Dumplings, Thai, Vietnamese, Chinese (Szechuan/Cantonese/Dim Sum), Japanese Izakaya, Malaysian, Filipino, etc.
   - NEVER use generic "Italian restaurants" - specify: Pizza, Pasta, Trattoria, Osteria
   - NEVER use generic "Mexican restaurants" - specify: Tacos, Burritos, Tortas, Tequila Bars
   - Each cuisine type should be DISTINCT to avoid Google returning the same venues repeatedly
   - Examples of GOOD search queries: "sushi restaurants near X", "Korean BBQ near X", "pho restaurants near X", "dim sum near X"
   - Examples of BAD search queries: "Asian restaurants near X", "Asian food near X", "ethnic cuisine near X"
9. Provide a search query that can be used with Google Places API
10. FOR EVENTS ONLY (festivals, concerts, shows, sporting events, movies, comedy shows, etc.): 
   - Include a realistic "priceEstimate" (e.g., "$25-50 per person", "$15 tickets", "Free")
   - Include "timeConstraints" if applicable (e.g., "Only on Friday afternoons", "Weekends in summer", "Saturday evenings")
   - IMPORTANT: timeConstraints must match the group's availability (${availabilityText})
   - Include a "complementaryFoodPlace" KEYWORD (e.g., "restaurants", "food trucks", "cafes" - NOT "restaurants near [venue]")
11. FOR FULL MEAL VENUES - this includes: restaurants, brunch spots, food markets, food halls
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" KEYWORD for DRINKS/DESSERT options nearby to complete the meal experience
   - BE SPECIFIC AND VARIED - use different types each time (don't repeat "dessert shops" over and over)
   - IMPORTANT: Use ONLY simple keywords (NOT full queries with "near"). The nearby search is automatic.
   - Examples: "artisan ice cream", "craft cocktail bars", "boba tea", "gelato shops", "sake bars", "specialty coffee", "dessert cafes"
   - These are post-meal treats or drinks to extend the outing
12. FOR DRINKS/DESSERT VENUES - this includes: cafes, coffee shops, boba shops, cocktail bars, wine bars, breweries, beer gardens, dessert shops, ice cream shops, tea shops
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" KEYWORD for FULL MEAL options nearby
   - BE SPECIFIC AND VARIED - use different cuisines/types each time (don't repeat "restaurants" generically)
   - IMPORTANT: Use ONLY simple keywords (NOT full queries with "near"). The nearby search is automatic.
   - Examples: "ramen restaurants", "taco restaurants", "banh mi", "pizza restaurants", "poke bowls", "dim sum restaurants"
   - Logic: If the main venue is drinks/dessert, suggest a proper meal that complements it (not another drink/dessert spot)
13. FOR OUTDOOR VENUES - this includes: parks, beaches, hiking trails, nature areas, outdoor recreation spaces
   - Include a "complementaryFoodPlace" KEYWORD for nearby PORTABLE MEAL options
   - BE SPECIFIC AND VARIED - use different portable food types each time
   - IMPORTANT: Use ONLY simple keywords (NOT full queries with "near"). The nearby search is automatic.
   - Examples: "banh mi sandwich", "taco trucks", "gourmet delis", "poke bowl takeout", "burrito restaurants"
   - Focus on portable, casual food suitable for outdoor activities (avoid sit-down restaurants)

CRITICAL CONSTRAINTS for ALL complementaryFoodPlace keywords:
- FORMAT: Use ONLY simple keywords without "near [location]" - the nearby search happens automatically
  ✅ CORRECT: "boba tea", "craft cocktail bars", "artisan ice cream"
  ❌ WRONG: "boba tea cafes near Sichuan hot pot", "craft cocktail bars near [location]", "artisan ice cream near restaurant"
- Distance: ALL suggestions will be searched within 0.5 miles of the main venue
- Quality: ALL suggestions will be filtered to 3.5+ star ratings or better
- VARIETY: Each suggestion should use a DIFFERENT type of complementary place (don't repeat the same type like "dessert shops" multiple times)
- Each keyword should be specific enough to return relevant options for the group to choose from
${!groupData.additionalInstructions ? `14. IMPORTANT - Use previous feedback AND voting data to guide suggestions:
   - If activities were "LOVED", suggest very similar venues/types
   - If activities got "more", increase that type of suggestion
   - If activities got "less", avoid or minimize that type
   - If Favorites have HIGH net votes (popular), prioritize very similar venue types
   - If Favorites have NEGATIVE net votes (unpopular), avoid similar venue types
15. CRITICAL - Use Swipe Session Preferences to refine suggestions:
   - LIKED concepts: These are activity types the group has shown interest in - PRIORITIZE suggesting these types
   - PASSED concepts: These are activity types the group is NOT interested in - AVOID suggesting these types
   - Swipe preferences reveal what the group wants to explore, so weight them heavily in your suggestions` : ''}
16. FOR DESCRIPTION: ABSOLUTE MAXIMUM 4 WORDS. NOUNS ONLY. ZERO DESCRIPTIVE ADJECTIVES.
   - HARD LIMIT: 1-4 words TOTAL. Not one word more. Count your words.
   - RULE: Use ONLY food/cuisine nouns. Cuisine names (Korean, Italian, Japanese) are ALLOWED. Descriptive adjectives (fresh, authentic, high-quality) are BANNED.
   - ALLOWED: Cuisine names (Korean, Italian, Mexican), food nouns (sushi, pizza, ramen, cocktails)
   - BANNED: Quality adjectives (high-quality, fresh, authentic, traditional, wood-fired, small, spicy, rich)
   - BANNED PHRASES: "with ingredients", "and more", "featuring", "known for", any connective phrases
   - GOOD examples (1-4 words):
     * "Sushi" (1 word)
     * "Korean BBQ" (2 words - cuisine + noun)
     * "Ramen" (1 word)
     * "Dim sum" (2 words)
     * "Italian pasta" (2 words - cuisine + noun)
     * "Cocktails" (1 word)
   - BAD examples (TOO LONG or has quality adjectives):
     * "High-quality sushi and sashimi with fresh ingredients" ❌ (12 words! Has quality adjectives!)
     * "Fresh sushi" ❌ ("Fresh" is quality adjective)
     * "Authentic Italian pasta" ❌ ("Authentic" is quality adjective)
     * "Wood-fired pizza" ❌ ("Wood-fired" is quality adjective)
   - Format: Just the food/cuisine. 1-4 words max.
17. FOR REASONING: CRITICAL - Ultra-short and direct. 2-5 words maximum. NO vague phrases. Be specific.
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
18. When suggesting something NEW (outside their usual range), start with "NEW:" and be specific about what's new.
   - GOOD: "NEW: Unfamiliar Filipino cuisine" (4 words - specific)
   - BAD: "NEW: Unique flavors to explore" ❌ (vague)

CRITICAL - venueType Field Specificity:
- NEVER use generic categories like "drink", "Asian food", or "restaurant"
- ALWAYS be SPECIFIC with venue types to enable proper categorization
- For DRINKS venues, use specific types:
  * "boba shop" or "bubble tea shop" (NOT "drink")
  * "cocktail bar" or "craft cocktail bar" (NOT "bar" or "drink")
  * "wine bar" (NOT "bar" or "drink")
  * "brewery" or "beer garden" (NOT "bar" or "drink")
  * "sake bar" (NOT "bar" or "drink")
- For RESTAURANTS, be specific with cuisine:
  * "sushi restaurant" (NOT "restaurant" or "Japanese restaurant")
  * "Korean BBQ restaurant" (NOT "restaurant" or "Asian restaurant")
  * "ramen restaurant" (NOT "restaurant")
  * "taco restaurant" or "Mexican restaurant" (NOT "restaurant")
- For CAFES/DESSERT, be specific:
  * "coffee shop" or "cafe" (NOT "drink")
  * "ice cream shop" (NOT "dessert shop" or "drink")
  * "dessert cafe" (NOT "cafe" or "drink")
- For EXPERIENCES, be specific:
  * "hiking trail" or "park" (NOT "outdoor activity")
  * "art museum" or "museum" (NOT "activity")
  * "concert venue" or "live music venue" (NOT "event")

Return your response as a JSON object with this structure:
{
  "suggestions": [
    {
      "venueName": "suggested venue type or activity name",
      "venueType": "SPECIFIC category (e.g., 'boba shop', 'cocktail bar', 'sushi restaurant', 'ice cream shop', 'art museum') - NEVER use generic 'drink', 'restaurant', 'activity'",
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
      max_completion_tokens: 8000,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    console.log(`[OpenAI] Received response with ${result.suggestions?.length || 0} suggestions (will show 6 after deduplication)`);
    console.log(`[OpenAI] Raw response:`, JSON.stringify(result, null, 2));
    
    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error("OpenAI returned no activity suggestions. The response may be empty or malformed.");
    }
    
    if (result.suggestions.length < 30) {
      console.warn(`[OpenAI] Warning: Only received ${result.suggestions.length} suggestions instead of 30 - may result in fewer than 6 unique activities after deduplication`);
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

// AI-based venue categorization for edge cases
const categorizationCache = new Map<string, string>();

// Keyword-based fallback categorization
function keywordCategorize(venueType: string): 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences' {
  const lowerType = venueType.toLowerCase();
  
  const mealKeywords = ['restaurant', 'food hall', 'food market', 'kitchen', 'diner', 
                       'eatery', 'bistro', 'grill', 'bbq', 'pizzeria', 'steakhouse', 'izakaya'];
  if (mealKeywords.some(keyword => lowerType.includes(keyword))) {
    return 'meal';
  }
  
  if (lowerType.includes('cafe') || lowerType.includes('coffee')) {
    return 'cafes';
  }
  
  if (lowerType.includes('boba') || lowerType.includes('ice cream') || 
      lowerType.includes('dessert') || lowerType.includes('bakery') ||
      lowerType.includes('sweet') || lowerType.includes('milk bar') ||
      lowerType.includes('tea shop') || lowerType.includes('bubble tea') || 
      lowerType.includes('milk tea') || lowerType.includes('gelato')) {
    return 'dessert';
  }
  
  const drinksKeywords = ['drink', 'brewery', 'wine bar', 'cocktail', 'pub', 'lounge', 'taproom', 'speakeasy', 'sake bar', 'taphouse', 'tasting room'];
  const hasStandaloneBar = /\bbar\b/.test(lowerType);
  if (drinksKeywords.some(keyword => lowerType.includes(keyword)) || hasStandaloneBar) {
    return 'drinks';
  }
  
  return 'experiences';
}

export async function categorizeVenue(venueType: string): Promise<'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'> {
  // Check cache first
  const cached = categorizationCache.get(venueType.toLowerCase());
  if (cached) {
    return cached as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
  }

  try {
    const prompt = `Categorize this venue type into ONE of these categories:

Venue type: "${venueType}"

Categories:
- meal: Full meal venues (restaurants, food halls, dining establishments including izakaya, bistro, etc.)
- cafes: Coffee shops, cafes
- drinks: Bars, breweries, wine bars, cocktail lounges (alcoholic beverages)
- dessert: Boba/tea shops, ice cream, dessert cafes, bakeries, sweet treats
- experiences: Entertainment, museums, parks, sports, events, activities

Rules:
1. Izakaya = meal (Japanese dining establishment)
2. Tea shop/bubble tea/boba = dessert
3. Any dining establishment with food = meal
4. Bars with alcohol = drinks
5. Entertainment/activities = experiences

Return a JSON object with this exact structure:
{
  "category": "meal"
}

The category value MUST be one of: meal, cafes, drinks, dessert, or experiences`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You categorize venue types. Always respond with valid JSON containing only the category."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 50,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate that we got a category in the response
    if (!result.category) {
      console.error(`[AI Categorization] No category in response for "${venueType}":`, result);
      console.log(`[AI Categorization] Falling back to keyword categorization for "${venueType}"`);
      const fallbackCategory = keywordCategorize(venueType);
      categorizationCache.set(venueType.toLowerCase(), fallbackCategory);
      return fallbackCategory;
    }
    
    const category = result.category;
    
    // Validate it's one of the expected categories
    const validCategories = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
    if (!validCategories.includes(category)) {
      console.error(`[AI Categorization] Invalid category "${category}" for "${venueType}". Falling back to keyword categorization.`);
      const fallbackCategory = keywordCategorize(venueType);
      categorizationCache.set(venueType.toLowerCase(), fallbackCategory);
      return fallbackCategory;
    }
    
    // Cache the result
    categorizationCache.set(venueType.toLowerCase(), category);
    
    console.log(`[AI Categorization] "${venueType}" → ${category}`);
    return category as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
  } catch (error) {
    console.error("Error categorizing venue:", error);
    console.log(`[AI Categorization] Exception occurred, falling back to keyword categorization for "${venueType}"`);
    const fallbackCategory = keywordCategorize(venueType);
    return fallbackCategory;
  }
}
