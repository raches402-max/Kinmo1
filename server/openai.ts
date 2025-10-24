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
  searchRadius?: number; // Search radius in miles (2, 10, 30, 50)
  previousFeedback?: { venueName: string; venueType: string; feedback: string; description: string }[];
  votingFeedback?: { venueName: string; venueType: string; upvotes: number; downvotes: number; netVotes: number; description: string }[];
  likedConcepts?: string[];
  passedConcepts?: string[];
  previouslySuggestedVenues?: string[];
  targetCategories?: string[]; // NEW: For category-specific generation
  memberConstraints?: { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string }[]; // Member RSVP constraints
  rejectedVenues?: string[]; // Venues that don't exist in Google Places (blacklist)
}): Promise<ActivitySuggestion[]> {
  try {
    // Generate 30 suggestions to account for duplicates after Google Places enrichment
    // After deduplication, we'll take the first 15 unique ones (3 per category)
    // This ensures we always have 15 cards even in areas with limited venue options
    
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

    // Format member constraints from RSVP feedback
    let constraintsContext = '';
    if (groupData.memberConstraints && groupData.memberConstraints.length > 0) {
      const allScheduleConflicts = new Set<string>();
      let budgetConcernCount = 0;
      let distanceConcernCount = 0;
      const notes: string[] = [];

      groupData.memberConstraints.forEach(constraint => {
        if (constraint.scheduleConflicts) {
          constraint.scheduleConflicts.forEach(conflict => allScheduleConflicts.add(conflict));
        }
        if (constraint.budgetConcern) budgetConcernCount++;
        if (constraint.distanceConcern) distanceConcernCount++;
        if (constraint.notes) notes.push(constraint.notes);
      });

      constraintsContext = '\n🚨 CRITICAL - Member Constraints (Auto-Avoid):';
      if (allScheduleConflicts.size > 0) {
        constraintsContext += `\n- SCHEDULE CONFLICTS: Multiple members can't do ${Array.from(allScheduleConflicts).join(', ')} - AVOID suggesting events at these times`;
      }
      if (budgetConcernCount > 0) {
        constraintsContext += `\n- BUDGET CONCERNS: ${budgetConcernCount} member(s) mentioned budget is tight - prioritize lower-cost options within the budget range`;
      }
      if (distanceConcernCount > 0) {
        constraintsContext += `\n- DISTANCE CONCERNS: ${distanceConcernCount} member(s) mentioned distance/location is an issue - prioritize venues within the closer search radius`;
      }
      if (notes.length > 0) {
        constraintsContext += `\n- MEMBER FEEDBACK: ${notes.join(' | ')}`;
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

    // Format rejected venues (venues that don't exist in Google Places)
    let rejectedVenuesContext = '';
    if (groupData.rejectedVenues && groupData.rejectedVenues.length > 0) {
      rejectedVenuesContext = `\n\nCRITICAL - These venues DO NOT EXIST in Google Places. NEVER suggest them: ${groupData.rejectedVenues.join(', ')}`;
    }

    // Format target categories for focused generation
    let targetCategoriesContext = '';
    if (groupData.targetCategories && groupData.targetCategories.length > 0) {
      const categoryDescriptions: Record<string, string> = {
        'meal': 'MEAL venues (restaurants, brunch spots, food markets, food halls)',
        'cafes': 'CAFES (coffee shops, cafes)',
        'drinks': 'DRINKS (bars, cocktail lounges, breweries, wine bars)',
        'dessert': 'DESSERT (boba, ice cream, dessert shops)',
        'experiences': 'EXPERIENCES (museums, parks, concerts, activities)'
      };
      
      const targetDescriptions = groupData.targetCategories
        .map(cat => categoryDescriptions[cat] || cat)
        .join(', ');
      
      targetCategoriesContext = `\n\n🎯 CRITICAL - TARGETED CATEGORY GENERATION:
- We need MORE suggestions in these specific categories: ${targetDescriptions}
- Generate ALL 30 suggestions focused ONLY on these categories
- Distribute the 30 suggestions across ONLY the target categories (ignore balanced distribution)
- This is a retry to fill gaps - prioritize these categories above all else`;
    }

    // Format search radius for prompt - ensure valid value
    const searchRadius = groupData.searchRadius && [2, 10, 30, 50].includes(groupData.searchRadius) 
      ? groupData.searchRadius 
      : 2; // Default to 2 miles (Nearby)
    
    if (!groupData.searchRadius) {
      console.log('[AI Generation] No search radius provided, defaulting to 2 miles (Nearby)');
    } else if (![2, 10, 30, 50].includes(groupData.searchRadius)) {
      console.warn(`[AI Generation] Invalid search radius ${groupData.searchRadius}, defaulting to 2 miles (Nearby)`);
    }
    
    const radiusTier = 
      searchRadius <= 2 ? 'Nearby (< 2 miles)' :
      searchRadius <= 10 ? 'Citywide (< 10 miles)' :
      searchRadius <= 30 ? 'Special Trip (< 30 miles)' :
      'Road Trip (< 50 miles)';

    const prompt = `You are an expert activity planner. Generate 30 activity suggestions for a group with these preferences:

NOTE: You will generate 30 suggestions, but only 15 will be shown to the user after removing duplicates (aiming for 3 per category). This ensures 15 unique venues even if Google Places returns the same restaurant for multiple search queries.

Location: ${groupData.locationBase}
Search Radius: ${radiusTier} - ${searchRadius <= 2 ? 'Focus on nearby venues within walking or short drive distance' : searchRadius <= 10 ? 'Include venues across the city' : searchRadius <= 30 ? 'Include special destinations worth a drive' : 'Include road trip worthy destinations - only suggest highly-rated gems'}
Budget Range: $${groupData.budgetMin}-${groupData.budgetMax} per person
Meeting Frequency: ${groupData.meetingFrequency}
Usual Availability: ${availabilityText}
${groupData.additionalInstructions ? `\n🚨 USER INSTRUCTIONS (OVERRIDES EVERYTHING): ${groupData.additionalInstructions}` : `${categoriesContext}
${groupData.pastPreferences ? `Past Preferences: ${groupData.pastPreferences}` : ''}${feedbackContext}${votingContext}${swipeContext}`}${constraintsContext}${avoidVenuesContext}${rejectedVenuesContext}${targetCategoriesContext}

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
- Maintain diversity across time categories (20 QUICK + 45 STANDARD + 10 LARGE distribution)`}

CRITICAL - Time-Based Organization Strategy (ONLY applies when user provides GENERAL guidance):
- Suggestions will be organized by TIME COMMITMENT:
  * QUICK (<90 min): Drinks, bars, desserts, cafes - in and out
  * STANDARD (1-3 hours): Full meals (breakfast, lunch, dinner) - the main event
  * LARGE (4+ hours): Activities, hikes, shows, museums - commitment required
- MANDATORY DISTRIBUTION (only when user gives GENERAL guidance):
  * 20 QUICK suggestions (boba tea shops, cocktail bars, ice cream parlors, coffee shops, wine bars, dessert cafes)
  * 45 STANDARD suggestions (restaurants - various cuisines)
  * 10 LARGE suggestions (activities, outdoor venues, shows) - only if the group's interests support them, otherwise add more QUICK or STANDARD
- CRITICAL: QUICK items are STANDALONE main venue suggestions, NOT complementary options
- Think of QUICK venues as pre-dinner drinks or post-dinner dessert spots - they complement the main meal but are separate experiences

${!groupData.additionalInstructions ? `CRITICAL - Novelty Preference Strategy:
- Suggest ${familiarCount} FAMILIAR venues (things similar to past preferences, favorites, or things they've loved)
- Suggest ${newCount} NEW venues (novel experiences they haven't tried)
- Mark NEW suggestions with "NEW:" prefix in reasoning` : ''}

Requirements:
1. ${groupData.additionalInstructions ? `🚨 FOLLOW ONLY THE USER INSTRUCTIONS ABOVE - Ignore all other context (Activity Interests, Past Preferences, Feedback). If they specify a venue type (like "Boba"), generate ALL 30 of that type. If they give general guidance, maintain diversity while matching the theme.` : (!groupData.pastPreferences && (!groupData.activityCategories || groupData.activityCategories.length === 0) ? `🌍 CULTURAL DIVERSITY FOR NEW GROUPS: This group has NO past preferences or activity interests. Ensure MAXIMUM CULTURAL DIVERSITY across ALL 30 suggestions. DO NOT bias toward any single cuisine type (Asian, Italian, Mexican, etc.). Mix: American, Italian, Mexican, Japanese, Korean, Thai, Vietnamese, Indian, Mediterranean, French, Chinese, etc. Spread cuisines evenly.` : 'Use Activity Interests, Past Preferences, and Feedback to guide suggestions')}
2. ${!groupData.additionalInstructions && groupData.activityCategories && groupData.activityCategories.length > 0 ? `PRIORITIZE the Activity Interests - these are the types of activities the group specifically wants` : ''}
3. ${!groupData.additionalInstructions && groupData.pastPreferences ? 'ANALYZE Past Preferences to identify venue TYPES they prefer (restaurants, bars, cafes, activities, etc.)' : ''}
4. ${!groupData.additionalInstructions && groupData.pastPreferences ? 'PRIORITIZE suggesting the same TYPES of venues they\'ve enjoyed historically' : ''}
5. 🚨 CRITICAL - NEVER SUGGEST AIRPORT VENUES: DO NOT suggest any venues located inside airports (terminals, gates, etc.) UNLESS the user EXPLICITLY asks for "airport activities" or "activities inside an airport". Airport restaurants, cafes, and shops are BANNED unless specifically requested.
6. Suggest 30 specific types of venues/activities (not specific business names) - we'll show 15 after deduplication (aiming for 3 per category: MEAL, CAFES, DRINKS, DESSERT, EXPERIENCES)
7. 🎯 CATEGORY BALANCE GOAL: Aim for a balanced distribution across categories to ensure ~3 cards per category after deduplication:
   - MEAL venues (restaurants, brunch spots, food markets, food halls): ~12 suggestions
   - CAFES (coffee shops, cafes): ~4 suggestions
   - DRINKS (bars, cocktail lounges, breweries, wine bars): ~6 suggestions
   - DESSERT (boba, ice cream, dessert shops): ~4 suggestions
   - EXPERIENCES (museums, parks, concerts, activities): ~4 suggestions
   - This distribution helps ensure visual balance with 3 cards displaying per category row
8. Each suggestion should fit within the budget range
9. CRITICAL - BE SPECIFIC WITH CUISINE TYPES:
   - NEVER use broad categories like "Asian restaurants" or "Asian food"
   - ALWAYS break down into SPECIFIC cuisines: Sushi, Korean BBQ (KBBQ), Ramen, Pho, Dumplings, Thai, Vietnamese, Chinese (Szechuan/Cantonese/Dim Sum), Japanese Izakaya, Malaysian, Filipino, etc.
   - NEVER use generic "Italian restaurants" - specify: Pizza, Pasta, Trattoria, Osteria
   - NEVER use generic "Mexican restaurants" - specify: Tacos, Burritos, Tortas, Tequila Bars
   - Each cuisine type should be DISTINCT to avoid Google returning the same venues repeatedly
   - Examples of GOOD search queries: "sushi restaurants near X", "Korean BBQ near X", "pho restaurants near X", "dim sum near X"
   - Examples of BAD search queries: "Asian restaurants near X", "Asian food near X", "ethnic cuisine near X"
10. CRITICAL - RECOGNIZE EXPERIENCE-BASED OPTIONS (beyond just venue types):
   - The AI should adapt to broader experiential terms that people actually use
   - EXPERIENCE TYPES to recognize and incorporate:
     * Bottomless brunch (brunch + unlimited drinks like mimosas)
     * Happy hour specials (drink deals at bars/restaurants)
     * Prix fixe menus (fixed-price multi-course meals)
     * Tasting menus (chef's curated multi-course experience)
     * Wine tastings / Wine flights (at wine bars, wineries)
     * Brewery tours / Beer flights (at breweries, beer gardens)
     * Omakase (chef's choice sushi experience)
     * High tea / Afternoon tea (tea service with pastries)
     * Tapas-style dining (small plates, shareable)
   - HOW TO USE: When user mentions these in instructions/preferences OR when past preferences suggest interest:
     * Include the experience keyword in the venueType (e.g., "bottomless brunch spot", "prix fixe restaurant")
     * Include the experience in the search query (e.g., "bottomless brunch near X", "happy hour bars near X")
     * Mention the experience in the description if relevant (within 4-word limit)
   - SEARCH QUERY STRATEGY:
     * ✅ GOOD: "bottomless brunch near [location]", "happy hour bars near [location]", "prix fixe restaurants near [location]"
     * ✅ GOOD: "wine tasting rooms near [location]", "omakase sushi near [location]", "tapas restaurants near [location]"
     * ❌ BAD: Just "brunch near [location]" when they want bottomless brunch
   - This allows natural language understanding - users say "bottomless brunch" not "brunch restaurants with drink specials"
11. Provide a search query that can be used with Google Places API
12. FOR EVENTS ONLY (festivals, concerts, shows, sporting events, movies, comedy shows, etc.): 
   - Include a realistic "priceEstimate" (e.g., "$25-50 per person", "$15 tickets", "Free")
   - Include "timeConstraints" if applicable (e.g., "Only on Friday afternoons", "Weekends in summer", "Saturday evenings")
   - IMPORTANT: timeConstraints must match the group's availability (${availabilityText})
   - Include a "complementaryFoodPlace" KEYWORD (e.g., "restaurants", "food trucks", "cafes" - NOT "restaurants near [venue]")
13. FOR FULL MEAL VENUES - this includes: restaurants, brunch spots, food markets, food halls
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" KEYWORD for DRINKS/DESSERT options nearby to complete the meal experience
   - BE SPECIFIC AND VARIED - use different types each time (don't repeat "dessert shops" over and over)
   - IMPORTANT: Use ONLY simple keywords (NOT full queries with "near"). The nearby search is automatic.
   - Examples: "artisan ice cream", "craft cocktail bars", "boba tea", "gelato shops", "sake bars", "specialty coffee", "dessert cafes"
   - These are post-meal treats or drinks to extend the outing
14. FOR DRINKS/DESSERT VENUES - this includes: cafes, coffee shops, boba shops, cocktail bars, wine bars, breweries, beer gardens, dessert shops, ice cream shops, tea shops
   - Leave priceEstimate and timeConstraints empty (pricing comes from Google)
   - REQUIRED: Include a "complementaryFoodPlace" KEYWORD for FULL MEAL options nearby
   - BE SPECIFIC AND VARIED - use different cuisines/types each time (don't repeat "restaurants" generically)
   - IMPORTANT: Use ONLY simple keywords (NOT full queries with "near"). The nearby search is automatic.
   - Examples: "ramen restaurants", "taco restaurants", "banh mi", "pizza restaurants", "poke bowls", "dim sum restaurants"
   - Logic: If the main venue is drinks/dessert, suggest a proper meal that complements it (not another drink/dessert spot)
15. FOR OUTDOOR VENUES - this includes: parks, beaches, hiking trails, nature areas, outdoor recreation spaces
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
${!groupData.additionalInstructions ? `16. IMPORTANT - Use previous feedback AND voting data to guide suggestions:
   - If activities were "LOVED", suggest very similar venues/types
   - If activities got "more", increase that type of suggestion
   - If activities got "less", avoid or minimize that type
   - If Favorites have HIGH net votes (popular), prioritize very similar venue types
   - If Favorites have NEGATIVE net votes (unpopular), avoid similar venue types
17. CRITICAL - Use Swipe Session Preferences to refine suggestions:
   - LIKED concepts: These are activity types the group has shown interest in - PRIORITIZE suggesting these types
   - PASSED concepts: These are activity types the group is NOT interested in - AVOID suggesting these types
   - Swipe preferences reveal what the group wants to explore, so weight them heavily in your suggestions` : ''}
18. FOR DESCRIPTION: ABSOLUTE MAXIMUM 4 WORDS. NOUNS ONLY. ZERO DESCRIPTIVE ADJECTIVES.
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
19. FOR REASONING: CRITICAL - Ultra-short and direct. 2-5 words maximum. NO vague phrases. Be specific.
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
20. When suggesting something NEW (outside their usual range), start with "NEW:" and be specific about what's new.
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

🚨 CRITICAL - RESPONSE FORMAT REQUIREMENTS:
- You MUST return EXACTLY 30 suggestions in the suggestions array
- The array MUST contain 30 items - no more, no less
- DO NOT stop generating suggestions until you reach exactly 30 items
- This is a hard requirement - the system will fail if you return fewer than 30

Return your response as a JSON object with this EXACT structure containing EXACTLY 30 items in the suggestions array:
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
    },
    ... (repeat for EXACTLY 30 total suggestions)
  ]
}

REMINDER: The suggestions array MUST contain EXACTLY 30 items. Count them if needed. Do not stop at 10, 15, 20, or any other number - you must provide all 30 suggestions.`;

    console.log(`[OpenAI] Sending prompt with availability: ${availabilityText}`);
    
    // Use GPT-4o for activity suggestions - better at understanding complex preferences and constraints
    // All other AI features use gpt-4o-mini for cost efficiency
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert activity planner who creates personalized suggestions based on group preferences. CRITICAL: You MUST always return EXACTLY 30 suggestions in the suggestions array. Always respond with valid JSON containing exactly 30 items."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 6000, // Supports 30 suggestions (~200 tokens each = ~6000 total)
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const suggestionsCount = result.suggestions?.length || 0;
    console.log(`[OpenAI] ✅ Received response with ${suggestionsCount} suggestions (target: 30, will show 15 after deduplication)`);
    
    // Log token usage for debugging
    console.log(`[OpenAI] Token usage: ${response.usage?.completion_tokens || 0} completion tokens (max: 6000)`);
    
    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error("OpenAI returned no activity suggestions. The response may be empty or malformed.");
    }
    
    if (result.suggestions.length < 30) {
      console.log(`[OpenAI] ℹ️  Received ${result.suggestions.length}/30 suggestions (OpenAI sometimes returns fewer than requested - this is normal)`);
    }
    
    if (result.suggestions.length < 20) {
      console.warn(`[OpenAI] ⚠️ Very low suggestion count (${result.suggestions.length}) - may need additional retries for balanced categories`);
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

export async function categorizeVenue(
  venueName: string, 
  venueType: string, 
  googleTypes?: string[]
): Promise<'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'> {
  // Create cache key from venue name + type for more accurate caching
  const cacheKey = `${venueName.toLowerCase()}::${venueType.toLowerCase()}`;
  const cached = categorizationCache.get(cacheKey);
  if (cached) {
    return cached as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
  }

  try {
    // Build context from all available information
    let context = `Venue name: "${venueName}"\nVenue type: "${venueType}"`;
    if (googleTypes && googleTypes.length > 0) {
      context += `\nGoogle types: ${googleTypes.join(', ')}`;
    }

    const prompt = `Categorize this venue into ONE category based on its PRIMARY purpose.

${context}

Categories:
- meal: Full meal venues (restaurants, food halls, dining establishments)
- cafes: Coffee shops, cafes
- drinks: Bars, breweries, wine bars, cocktail lounges (alcoholic beverages)
- dessert: Boba/tea shops, ice cream, dessert cafes, bakeries, sweet treats
- experiences: Entertainment, museums, parks, sports, events, activities, shows, performances

CRITICAL RULES - PRIMARY PURPOSE:
1. If the venue's PRIMARY purpose is entertainment/experience (shows, performances, museums, activities), it's "experiences" - EVEN IF food is served
   Examples:
   - "Murder Mystery Dinner Show" → experiences (it's a SHOW that serves dinner)
   - "Concert Hall with Bar" → experiences (it's a CONCERT venue)
   - "Museum Cafe" → experiences (it's a MUSEUM)
   - "Sports Bar with Games" → drinks (it's primarily a BAR)
   
2. If the PRIMARY purpose is dining/eating:
   - Izakaya = meal (Japanese dining establishment)
   - Restaurants, bistros, food halls = meal
   
3. If the PRIMARY purpose is drinks:
   - Bars, breweries, wine bars = drinks
   
4. If the PRIMARY purpose is dessert/treats:
   - Tea shop/bubble tea/boba = dessert
   - Ice cream, bakeries = dessert

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
          content: "You categorize venues by their PRIMARY purpose. Entertainment/shows = experiences even if food is served. Always respond with valid JSON."
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
      console.error(`[AI Categorization] No category in response for "${venueName}":`, result);
      console.log(`[AI Categorization] Falling back to keyword categorization`);
      const fallbackCategory = keywordCategorize(venueType);
      categorizationCache.set(cacheKey, fallbackCategory);
      return fallbackCategory;
    }
    
    const category = result.category;
    
    // Validate it's one of the expected categories
    const validCategories = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
    if (!validCategories.includes(category)) {
      console.error(`[AI Categorization] Invalid category "${category}" for "${venueName}". Falling back to keyword categorization.`);
      const fallbackCategory = keywordCategorize(venueType);
      categorizationCache.set(cacheKey, fallbackCategory);
      return fallbackCategory;
    }
    
    // Cache the result
    categorizationCache.set(cacheKey, category);
    
    console.log(`[AI Categorization] "${venueName}" → ${category}`);
    return category as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
  } catch (error) {
    console.error("Error categorizing venue:", error);
    console.log(`[AI Categorization] Exception occurred, falling back to keyword categorization`);
    const fallbackCategory = keywordCategorize(venueType);
    return fallbackCategory;
  }
}

export interface PreferencePattern {
  pattern: string;
  icon: string;
  description: string;
}

export async function analyzePreferencePatterns(data: {
  notThisFeedback: { venueName: string; venueType: string; description: string }[];
  votingFeedback: { venueName: string; venueType: string; upvotes: number; downvotes: number; netVotes: number }[];
  likedConcepts: string[];
  passedConcepts: string[];
}): Promise<PreferencePattern[]> {
  try {
    const { notThisFeedback, votingFeedback, likedConcepts, passedConcepts } = data;

    // Calculate total feedback actions
    const totalActions = 
      notThisFeedback.length + 
      votingFeedback.length + 
      likedConcepts.length + 
      passedConcepts.length;

    // Don't generate insights if there's not enough data
    if (totalActions < 5) {
      console.log('[AI Insights] Not enough feedback data to generate patterns (need at least 5 actions)');
      return [];
    }

    // Build context for AI
    let feedbackContext = '';
    
    if (notThisFeedback.length > 0) {
      feedbackContext += '\n\n"Not This" Feedback (venues rejected):';
      notThisFeedback.forEach(f => {
        feedbackContext += `\n- ${f.venueName} (${f.venueType}): ${f.description}`;
      });
    }

    if (votingFeedback.length > 0) {
      const upvoted = votingFeedback.filter(v => v.netVotes > 0);
      const downvoted = votingFeedback.filter(v => v.netVotes < 0);
      
      if (upvoted.length > 0) {
        feedbackContext += '\n\nUpvoted Favorites (group loves):';
        upvoted.forEach(v => {
          feedbackContext += `\n- ${v.venueName} (${v.venueType}): +${v.upvotes} votes`;
        });
      }
      
      if (downvoted.length > 0) {
        feedbackContext += '\n\nDownvoted Venues (group dislikes):';
        downvoted.forEach(v => {
          feedbackContext += `\n- ${v.venueName} (${v.venueType}): ${v.downvotes} downvotes`;
        });
      }
    }

    if (likedConcepts.length > 0) {
      feedbackContext += '\n\nLiked Concepts (from swipe sessions):';
      likedConcepts.forEach(c => {
        feedbackContext += `\n- ${c}`;
      });
    }

    if (passedConcepts.length > 0) {
      feedbackContext += '\n\nPassed Concepts (from swipe sessions):';
      passedConcepts.forEach(c => {
        feedbackContext += `\n- ${c}`;
      });
    }

    const prompt = `Analyze this group's activity preferences and identify 3-5 clear patterns or trends.

${feedbackContext}

Based on this feedback data (${totalActions} total actions), identify the clearest patterns in what this group likes or dislikes.

Rules:
1. Only identify patterns if there are at least 2-3 examples supporting it
2. Be specific and actionable (e.g., "Avoiding loud venues" not "likes quiet places")
3. Focus on the strongest signals
4. Keep descriptions concise and casual (10-15 words max)
5. Choose appropriate emoji icons that match the pattern
6. Return 3-5 patterns maximum (fewer if data is limited)

Example patterns:
- Avoiding loud venues: 🎵 "You've passed on 4 nightclubs and live music spots"
- Loves unique experiences: ✨ "Museums and art galleries get the most upvotes"
- Budget-conscious: 💰 "Expensive venues frequently marked 'not this'"
- Prefers authentic cuisine: 🌮 "Local ethnic restaurants highly favored over chains"

Return JSON array of patterns:
[
  {
    "pattern": "Short descriptive title",
    "icon": "single emoji",
    "description": "Brief casual explanation (10-15 words)"
  }
]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing group preferences and identifying behavioral patterns. Be specific and actionable. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"patterns": []}');
    const patterns = result.patterns || [];
    
    console.log(`[AI Insights] Generated ${patterns.length} preference patterns from ${totalActions} feedback actions`);
    return patterns;
  } catch (error) {
    console.error("Error analyzing preference patterns:", error);
    return [];
  }
}
