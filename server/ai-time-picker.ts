import OpenAI from 'openai';
import { fromZonedTime } from 'date-fns-tz';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Map location strings to IANA timezone identifiers
function getTimezoneIdentifier(location: string): string {
  const loc = location.toLowerCase().trim();
  
  // Helper to check if a pattern matches as a whole word (for state abbreviations)
  const matchesWord = (text: string, pattern: string): boolean => {
    // Match if pattern is a separate word (preceded/followed by space, comma, or start/end of string)
    const regex = new RegExp(`(^|[\\s,])${pattern}($|[\\s,])`, 'i');
    return regex.test(text);
  };
  
  // Pacific Time (UTC-8/UTC-7) - WA, OR, CA, NV
  const pacificCities = [
    'san francisco', 'los angeles', 'oakland', 'san diego', 'san jose', 'sacramento',
    'seattle', 'portland', 'spokane', 'tacoma', 'vancouver', 'eugene', 'salem',
    'las vegas', 'reno', 'henderson'
  ];
  const pacificStates = ['california', 'oregon', 'nevada'];
  const pacificAbbrevs = ['ca', 'or', 'nv', 'wa'];  // Check as whole words only
  
  // Mountain Time (UTC-7/UTC-6) - CO, UT, NM, WY, MT, ID
  const mountainCities = [
    'denver', 'colorado springs', 'aurora', 'boulder', 'fort collins',
    'salt lake', 'provo', 'west jordan', 'orem',
    'albuquerque', 'santa fe', 'las cruces',
    'boise', 'nampa', 'meridian',
    'billings', 'missoula', 'great falls',
    'cheyenne', 'casper'
  ];
  const mountainStates = ['colorado', 'utah', 'new mexico', 'wyoming', 'montana', 'idaho'];
  const mountainAbbrevs = ['co', 'ut', 'nm', 'wy', 'mt', 'id'];
  
  // Arizona (UTC-7, no DST)
  const arizonaCities = ['phoenix', 'tucson', 'mesa', 'chandler', 'scottsdale', 'gilbert'];
  const arizonaStates = ['arizona'];
  const arizonaAbbrevs = ['az'];
  
  // Alaska (UTC-9/UTC-8)
  const alaskaCities = ['anchorage', 'fairbanks', 'juneau', 'sitka', 'ketchikan', 'wasilla'];
  const alaskaStates = ['alaska'];
  const alaskaAbbrevs = ['ak'];
  
  // Hawaii (UTC-10, no DST)
  const hawaiiCities = ['honolulu', 'pearl city', 'hilo', 'kailua', 'waipahu', 'kaneohe'];
  const hawaiiStates = ['hawaii'];
  const hawaiiAbbrevs = ['hi'];
  
  // Central Time (UTC-6/UTC-5) - TX, IL, MN, WI, MO, LA, TN, OK, IA, NE, KS, AR, AL, MS, ND, SD
  const centralCities = [
    'chicago', 'houston', 'dallas', 'austin', 'san antonio', 'fort worth', 'arlington',
    'minneapolis', 'st paul', 'milwaukee', 'madison', 'kansas city', 'st louis',
    'new orleans', 'baton rouge', 'nashville', 'memphis', 'oklahoma city', 'tulsa',
    'des moines', 'omaha', 'lincoln', 'wichita', 'little rock', 'birmingham', 'jackson',
    'fargo', 'bismarck', 'grand forks', 'minot',
    'sioux falls', 'rapid city', 'aberdeen', 'brookings'
  ];
  const centralStates = [
    'texas', 'illinois', 'minnesota', 'wisconsin', 'missouri',
    'louisiana', 'tennessee', 'oklahoma', 'iowa', 'nebraska',
    'kansas', 'arkansas', 'alabama', 'mississippi',
    'north dakota', 'south dakota'
  ];
  const centralAbbrevs = ['tx', 'il', 'mn', 'wi', 'mo', 'la', 'tn', 'ok', 'ia', 'ne', 'ks', 'ar', 'al', 'ms', 'nd', 'sd'];
  
  // Eastern Time (UTC-5/UTC-4) - NY, MA, PA, FL, GA, NC, MI, IN, OH, VA, SC, KY, MD, DC, ME, NH, VT, CT, RI, NJ, DE, WV
  const easternCities = [
    'new york', 'nyc', 'brooklyn', 'queens', 'bronx', 'manhattan', 'buffalo', 'rochester', 'syracuse',
    'boston', 'worcester', 'springfield', 'cambridge',
    'philadelphia', 'pittsburgh', 'allentown',
    'washington', 'baltimore',
    'miami', 'tampa', 'orlando', 'jacksonville',
    'atlanta', 'augusta', 'savannah',
    'charlotte', 'raleigh', 'greensboro', 'durham',
    'detroit', 'grand rapids', 'indianapolis', 'cleveland', 'cincinnati',
    'richmond', 'virginia beach', 'charleston', 'louisville'
  ];
  const easternStates = [
    'massachusetts', 'pennsylvania', 'florida', 'georgia',
    'north carolina', 'michigan', 'indiana', 'ohio',
    'virginia', 'south carolina', 'kentucky', 'maryland',
    'district of columbia', 'maine', 'new hampshire', 'vermont',
    'connecticut', 'rhode island', 'new jersey', 'delaware',
    'west virginia', 'new york'
  ];
  const easternAbbrevs = ['ma', 'pa', 'fl', 'ga', 'nc', 'mi', 'in', 'oh', 'va', 'sc', 'ky', 'md', 'dc', 'd.c.', 'me', 'nh', 'vt', 'ct', 'ri', 'nj', 'de', 'wv', 'ny'];
  
  // Check for Washington state (must exclude DC patterns)
  if ((loc.includes('washington') || matchesWord(loc, 'wa')) && 
      !loc.includes('dc') && !loc.includes('d.c.') && 
      !loc.includes('washington,') && !loc.includes('washington d')) {
    return 'America/Los_Angeles';
  }
  
  // Check cities first (most specific)
  if (alaskaCities.some(p => loc.includes(p))) return 'America/Anchorage';
  if (hawaiiCities.some(p => loc.includes(p))) return 'Pacific/Honolulu';
  if (arizonaCities.some(p => loc.includes(p))) return 'America/Phoenix';
  if (pacificCities.some(p => loc.includes(p))) return 'America/Los_Angeles';
  if (mountainCities.some(p => loc.includes(p))) return 'America/Denver';
  if (centralCities.some(p => loc.includes(p))) return 'America/Chicago';
  if (easternCities.some(p => loc.includes(p))) return 'America/New_York';
  
  // Check full state names
  if (alaskaStates.some(p => loc.includes(p))) return 'America/Anchorage';
  if (hawaiiStates.some(p => loc.includes(p))) return 'Pacific/Honolulu';
  if (arizonaStates.some(p => loc.includes(p))) return 'America/Phoenix';
  if (pacificStates.some(p => loc.includes(p))) return 'America/Los_Angeles';
  if (mountainStates.some(p => loc.includes(p))) return 'America/Denver';
  if (centralStates.some(p => loc.includes(p))) return 'America/Chicago';
  if (easternStates.some(p => loc.includes(p))) return 'America/New_York';
  
  // Check state abbreviations as whole words only
  if (alaskaAbbrevs.some(p => matchesWord(loc, p))) return 'America/Anchorage';
  if (hawaiiAbbrevs.some(p => matchesWord(loc, p))) return 'Pacific/Honolulu';
  if (arizonaAbbrevs.some(p => matchesWord(loc, p))) return 'America/Phoenix';
  if (pacificAbbrevs.some(p => matchesWord(loc, p))) return 'America/Los_Angeles';
  if (mountainAbbrevs.some(p => matchesWord(loc, p))) return 'America/Denver';
  if (centralAbbrevs.some(p => matchesWord(loc, p))) return 'America/Chicago';
  if (easternAbbrevs.some(p => matchesWord(loc, p))) return 'America/New_York';
  
  // Default to Pacific Time for unrecognized US locations
  return 'America/Los_Angeles';
}

// Get timezone display name from IANA identifier
function getTimezoneName(tzIdentifier: string): string {
  const names: { [key: string]: string } = {
    'America/Los_Angeles': 'Pacific Time',
    'America/Denver': 'Mountain Time',
    'America/Phoenix': 'Mountain Time (no DST)',
    'America/Chicago': 'Central Time',
    'America/New_York': 'Eastern Time',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time',
  };
  return names[tzIdentifier] || 'Pacific Time';
}

// Convert availability object to natural language string
// Helper to extract allowed days from an availability string containing "only"
function extractAllowedDays(availabilityString: string): string[] {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allowedDays: string[] = [];
  
  // Find all day names mentioned in the string
  for (const day of dayNames) {
    if (availabilityString.includes(day)) {
      allowedDays.push(day);
    }
  }
  
  return allowedDays;
}

export function convertAvailabilityToString(availability: any): string {
  console.log('[convertAvailabilityToString] Input:', JSON.stringify(availability));
  
  if (!availability || typeof availability !== 'object') {
    console.log('[convertAvailabilityToString] Returning "Not specified" - input is null or not object');
    return 'Not specified';
  }

  // Handle both formats:
  // 1. Full lowercase: { monday: { morning: true, ... }, ... }
  // 2. Abbreviated capitalized: { Mon: { morning: true, ... }, ... }
  
  // Define day order and all possible keys for each day
  const daysInOrder = [
    { label: 'Monday', keys: ['monday', 'Mon'] },
    { label: 'Tuesday', keys: ['tuesday', 'Tue'] },
    { label: 'Wednesday', keys: ['wednesday', 'Wed'] },
    { label: 'Thursday', keys: ['thursday', 'Thu'] },
    { label: 'Friday', keys: ['friday', 'Fri'] },
    { label: 'Saturday', keys: ['saturday', 'Sat'] },
    { label: 'Sunday', keys: ['sunday', 'Sun'] }
  ];

  const availableDays: string[] = [];
  const timeSlots: { [key: string]: Set<string> } = {
    morning: new Set(),
    afternoon: new Set(),
    evening: new Set()
  };

  // Collect which days are available and which time slots (in correct order)
  for (const { label, keys } of daysInOrder) {
    // Check all possible keys for this day
    for (const key of keys) {
      const dayData = availability[key];
      if (dayData && typeof dayData === 'object') {
        const hasAnySlot = dayData.morning || dayData.afternoon || dayData.evening;
        console.log(`[convertAvailabilityToString] ${label} (${key}): morning=${dayData.morning}, afternoon=${dayData.afternoon}, evening=${dayData.evening}, hasAnySlot=${hasAnySlot}`);
        if (hasAnySlot) {
          availableDays.push(label);
          
          if (dayData.morning) timeSlots.morning.add(label);
          if (dayData.afternoon) timeSlots.afternoon.add(label);
          if (dayData.evening) timeSlots.evening.add(label);
          
          // Found data for this day, move to next day
          break;
        }
      }
    }
  }

  console.log('[convertAvailabilityToString] availableDays:', availableDays);
  console.log('[convertAvailabilityToString] timeSlots:', JSON.stringify(Array.from(timeSlots.morning)), JSON.stringify(Array.from(timeSlots.afternoon)), JSON.stringify(Array.from(timeSlots.evening)));

  if (availableDays.length === 0) {
    console.log('[convertAvailabilityToString] Returning "Not specified" - no available days found');
    return 'Not specified';
  }

  // Build a concise description
  const parts: string[] = [];
  
  // Check if all time slots are selected for the available days (simpler description)
  const allSlotsForDays = availableDays.every(day => 
    timeSlots.morning.has(day) && timeSlots.afternoon.has(day) && timeSlots.evening.has(day)
  );

  if (allSlotsForDays) {
    // Simple: just list the days
    if (availableDays.length === 1) {
      return `${availableDays[0]}s only`;
    } else if (availableDays.length === 7) {
      return 'Any day of the week';
    } else {
      const daysList = availableDays.slice(0, -1).join(', ') + ', and ' + availableDays[availableDays.length - 1];
      return `${daysList} only`;
    }
  }

  // Complex: describe time slots for each day
  for (const [slot, days] of Object.entries(timeSlots)) {
    if (days.size > 0) {
      const daysList = Array.from(days);
      const slotLabel = slot === 'morning' ? 'mornings' : slot === 'afternoon' ? 'afternoons' : 'evenings';
      
      if (daysList.length === 1) {
        parts.push(`${daysList[0]} ${slotLabel}`);
      } else {
        const formatted = daysList.slice(0, -1).join(', ') + ', and ' + daysList[daysList.length - 1];
        parts.push(`${formatted} ${slotLabel}`);
      }
    }
  }

  let result = '';
  if (parts.length === 1) {
    result = parts[0];
  } else if (parts.length === 2) {
    result = parts.join(' and ');
  } else {
    result = parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }
  
  // Add "only" to make the constraint explicit for AI (unless all 7 days are available)
  if (availableDays.length < 7) {
    result += ' only';
  }
  
  console.log('[convertAvailabilityToString] Final result:', result);
  return result;
}

interface VenueForScheduling {
  name: string;
  type: string;
}

interface TimeSelectionInput {
  generalAvailability?: string; // "Weekday evenings", "Weekends", "Friday/Saturday nights"
  venues: VenueForScheduling[];
  memberConstraints?: string[]; // e.g., ["Not available Thursdays", "Prefer weekends"]
  rescheduleReason?: string; // Why previous time didn't work (for rescheduling)
  location?: string; // Group location for timezone context (e.g., "San Francisco, CA")
}

interface TimeSelectionResult {
  eventDate: Date;
  reasoning: string;
}

export async function suggestOptimalTime(
  input: TimeSelectionInput
): Promise<TimeSelectionResult> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI Time Picker] Attempt ${attempt} of ${maxRetries}`);
      
      const now = new Date();
      const minDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // Min 2 days from now
      const maxDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // Max 3 weeks out

      const venueList = input.venues.map(v => `${v.name} (${v.type})`).join(', ');
      const constraints = input.memberConstraints?.join('; ') || 'None';
      
      // Get timezone identifier for the location
      const tzIdentifier = input.location ? getTimezoneIdentifier(input.location) : 'America/Los_Angeles';
      const tzName = getTimezoneName(tzIdentifier);

      const prompt = `You are scheduling a group outing. Pick ONE specific date and time.

Venues: ${venueList}
Group general availability: ${input.generalAvailability || 'Not specified'}
Member constraints: ${constraints}
${input.rescheduleReason ? `Previous attempt failed: ${input.rescheduleReason}` : ''}
Timezone: ${tzName} (all times should be in this timezone)

Current date: ${now.toISOString().split('T')[0]}
Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}

**Your Task:**
Based on the group's availability and the venues, suggest:
1. An optimal event date (return as ISO 8601 datetime string)
2. A brief reason why this time works (1-2 sentences, casual tone)

**CRITICAL STEP-BY-STEP PROCESS:**

**STEP 1: Extract allowed days from availability (THIS IS MANDATORY)**
   * Look for "only" in the availability string - this indicates HARD constraints
   * Extract the EXACT day names listed BEFORE "only"
   * Example: "Thursday, Friday, Saturday, and Sunday evenings only" → Valid days: [Thursday, Friday, Saturday, Sunday]
   * Example: "Saturday, and Sunday afternoons and Thursday, Friday, Saturday, and Sunday evenings only" → Valid days: [Thursday, Friday, Saturday, Sunday]
   * These are the ONLY valid days - all other days are FORBIDDEN
   * If availability says "Weekends" → Valid days: [Saturday, Sunday]
   * If availability says "Weekday evenings" → Valid days: [Monday, Tuesday, Wednesday, Thursday, Friday]

**STEP 2: Identify venue type and appropriate time**
   * Brunch/Breakfast/Cafe → 10:00-13:00 (morning to early afternoon), prefer weekend from Step 1
   * Lunch → 11:30-14:00 (midday)
   * Dinner/Restaurant → 18:00-20:30 (evening)
   * Ramen/Asian restaurant → can be lunch (12:00) or dinner (18:30)
   * Bars/Drinks → 19:00-22:00 (evening)
   * Matcha/Tea/Coffee → 10:00-16:00 (morning to afternoon)

**STEP 3: Select a valid date**
   * Pick a day from your Step 1 list (NEVER pick a day not in that list)
   * Pick a time from your Step 2 range
   * Ensure it's 3-7 days in the future
   * DOUBLE-CHECK: Is the day you picked in the Step 1 allowed list? If NO, pick a different day!

**STEP 4: Write reasoning**
   * State the ACTUAL day name you selected (e.g., "Saturday", "Friday")  
   * State the ACTUAL venue type/meal (e.g., "brunch", "ramen dinner", "matcha")
   * Keep it casual and brief

**COMMON MISTAKES TO AVOID:**
❌ Suggesting Tuesday when only Thursday/Friday/Saturday/Sunday are allowed
❌ Suggesting 18:30 (dinner time) for a brunch/cafe venue
❌ Suggesting "dinner" in reasoning for a ramen restaurant at 12:00 (that's lunch!)
❌ Writing "Tuesday at 18:30" in reasoning but returning different date in JSON

Return ONLY a JSON object with this exact structure:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "reasoning": "[Actual day] at [time] works well for [actual meal type] at [venue name]"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    console.log('[AI Time Picker] Raw AI response:', JSON.stringify(result));

    if (!result.date || !result.time) {
      console.log('[AI Time Picker] Missing date or time in response, using fallback');
      return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
    }

    // Parse and validate the AI-suggested time
    // AI suggests time in the group's local timezone (e.g., 10:30 AM PST/PDT)
    // Create a "naive" Date using UTC to avoid server timezone interpretation
    const [year, month, day] = result.date.split('-').map(Number);
    const [hours, minutes] = result.time.split(':').map(Number);
    const naiveDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    // fromZonedTime treats this as local time in the target timezone and converts to UTC
    const eventDate = fromZonedTime(naiveDate, tzIdentifier);

    // Validate it's within our range
    if (eventDate < minDate || eventDate > maxDate) {
      console.log('[AI Time Picker] Date out of range, using fallback');
      return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
    }

      // Validate day-of-week matches availability constraint
      const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const suggestedDay = dayNames[dayOfWeek];
      
      // Extract allowed days from availability string if it contains "only"
      if (input.generalAvailability && input.generalAvailability.includes('only')) {
        const allowedDays = extractAllowedDays(input.generalAvailability);
        console.log('[AI Time Picker] Allowed days from availability:', allowedDays);
        console.log('[AI Time Picker] AI suggested day:', suggestedDay);
        
        if (allowedDays.length > 0 && !allowedDays.includes(suggestedDay)) {
          console.log(`[AI Time Picker] INVALID (attempt ${attempt}): AI suggested ${suggestedDay} but only ${allowedDays.join(', ')} are allowed`);
          
          if (attempt < maxRetries) {
            console.log('[AI Time Picker] Retrying with stricter prompt...');
            continue; // Try again
          } else {
            console.log('[AI Time Picker] Max retries reached, using fallback');
            return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
          }
        }
      }

      console.log('[AI Time Picker] Validation passed, returning suggestion');
      return {
        eventDate,
        reasoning: result.reasoning || 'AI-selected optimal time based on venue type and group availability',
      };
    } catch (error) {
      console.error(`[AI Time Picker] Error on attempt ${attempt}:`, error);
      
      if (attempt === maxRetries) {
        const now = new Date();
        const minDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const maxDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
        const tzIdentifier = input.location ? getTimezoneIdentifier(input.location) : 'America/Los_Angeles';
        return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
      }
    }
  }
  
  // Fallback if all retries fail (should not reach here)
  const now = new Date();
  const minDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const tzIdentifier = input.location ? getTimezoneIdentifier(input.location) : 'America/Los_Angeles';
  return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
}

// Wrapper function for auto-reschedule with feedback constraints
export async function generateOptimalTime(
  venues: VenueForScheduling[],
  generalAvailability: any,
  constraints?: {
    avoidDays?: string[];
    preferEarlier?: boolean;
    preferLater?: boolean;
    avoidThisWeek?: boolean;
  },
  location?: string
): Promise<{ suggestedTime: string; reasoning: string }> {
  // Convert availability object to readable string
  const availabilityString = convertAvailabilityToString(generalAvailability);
  
  // Build member constraints from feedback
  const memberConstraints: string[] = [];
  if (constraints?.avoidDays && constraints.avoidDays.length > 0) {
    memberConstraints.push(`Not available on: ${constraints.avoidDays.join(', ')}`);
  }
  if (constraints?.preferEarlier) {
    memberConstraints.push('Prefer earlier times');
  }
  if (constraints?.preferLater) {
    memberConstraints.push('Prefer later times');
  }
  if (constraints?.avoidThisWeek) {
    memberConstraints.push('Avoid this week');
  }

  const result = await suggestOptimalTime({
    generalAvailability: availabilityString,
    venues,
    memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
    location, // Pass location for timezone detection
  });

  return {
    suggestedTime: result.eventDate.toISOString(),
    reasoning: result.reasoning,
  };
}

function generateFallbackTime(
  input: TimeSelectionInput,
  minDate: Date,
  maxDate: Date,
  tzIdentifier: string
): TimeSelectionResult {
  console.log('[Fallback] Generating fallback time with venues:', input.venues);
  
  // Determine time of day based on venue type
  const venueTypes = input.venues.map(v => v.type.toLowerCase()).join(' ');
  let hours = 19; // Default to 7 PM
  let minutes = 0;

  if (venueTypes.includes('brunch') || venueTypes.includes('breakfast') || venueTypes.includes('coffee') || venueTypes.includes('cafe')) {
    hours = 11; // 11 AM for brunch/morning activities
    minutes = 0;
  } else if (venueTypes.includes('lunch')) {
    hours = 12; // Noon for lunch
    minutes = 30;
  } else if (venueTypes.includes('bar') || venueTypes.includes('drinks') || venueTypes.includes('cocktail')) {
    hours = 20; // 8 PM for drinks
  }

  // Add slight randomness to time (±30 mins)
  const timeVariation = Math.floor(Math.random() * 3) * 15 - 30; // -30, -15, 0, 15, or 30 minutes
  minutes += timeVariation;
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  } else if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }

  // Extract allowed days from availability constraint
  let allowedDayIndices: number[] = [];
  const dayMap: {[key: string]: number} = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };

  // PRIORITY 1: Check for "only" constraint - this is a HARD constraint
  if (input.generalAvailability && input.generalAvailability.includes('only')) {
    const allowedDays = extractAllowedDays(input.generalAvailability);
    console.log('[Fallback] Hard constraint - allowed days from "only":', allowedDays);
    allowedDayIndices = allowedDays.map(d => dayMap[d]).filter(i => i !== undefined);
  }
  // PRIORITY 2: Check for soft keywords if no "only" constraint
  else if (input.generalAvailability) {
    const avail = input.generalAvailability.toLowerCase();
    if (avail.includes('weekday') || avail.includes('week night')) {
      allowedDayIndices = [1, 2, 3, 4, 5]; // Mon-Fri
      console.log('[Fallback] Soft constraint - weekdays');
    } else if (avail.includes('weekend')) {
      allowedDayIndices = [6, 0]; // Sat-Sun
      console.log('[Fallback] Soft constraint - weekends');
    } else if (avail.includes('friday')) {
      allowedDayIndices = [5]; // Friday
      console.log('[Fallback] Soft constraint - Friday');
    }
  }
  
  // PRIORITY 3: Default based on venue type if no constraints found
  if (allowedDayIndices.length === 0) {
    if (venueTypes.includes('brunch') || venueTypes.includes('breakfast')) {
      allowedDayIndices = [6, 0]; // Saturday, Sunday for brunch
      console.log('[Fallback] Venue-based default - brunch weekends');
    } else {
      allowedDayIndices = [0, 1, 2, 3, 4, 5, 6]; // All days
      console.log('[Fallback] No constraints - all days allowed');
    }
  }

  console.log('[Fallback] Final allowed day indices:', allowedDayIndices);

  // Pick a random allowed day
  const targetDayOfWeek = allowedDayIndices[Math.floor(Math.random() * allowedDayIndices.length)];
  
  // Find the next occurrence of target day within our window
  let candidateDate = new Date(minDate);
  candidateDate.setHours(hours, minutes, 0, 0);

  // Move to next occurrence of target day
  const daysUntilTarget = (targetDayOfWeek - candidateDate.getDay() + 7) % 7;
  candidateDate.setDate(candidateDate.getDate() + daysUntilTarget);

  // If that's too soon (less than minDate), move to next week
  if (candidateDate < minDate) {
    candidateDate.setDate(candidateDate.getDate() + 7);
  }

  // Add some day variation (0-7 days) if still in range
  const dayVariation = Math.floor(Math.random() * 2) * 7; // 0 or 7 days
  const variedDate = new Date(candidateDate.getTime() + dayVariation * 24 * 60 * 60 * 1000);
  if (variedDate <= maxDate && allowedDayIndices.includes(variedDate.getDay())) {
    candidateDate = variedDate;
  }

  // If somehow we're past maxDate, use minDate + random offset
  if (candidateDate > maxDate) {
    const daysInRange = Math.floor((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000));
    const randomOffset = Math.floor(Math.random() * Math.min(daysInRange, 14));
    candidateDate = new Date(minDate.getTime() + randomOffset * 24 * 60 * 60 * 1000);
    candidateDate.setHours(hours, minutes, 0, 0);
  }
  
  // Convert to timezone-aware UTC date using date-fns-tz
  const year = candidateDate.getFullYear();
  const month = candidateDate.getMonth();
  const day = candidateDate.getDate();
  const naiveDate = new Date(Date.UTC(year, month, day, hours, minutes));
  const finalDate = fromZonedTime(naiveDate, tzIdentifier);

  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][candidateDate.getDay()];
  
  // Format time correctly for 12-hour clock
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'PM' : 'AM';
  
  console.log('[Fallback] Selected:', dayName, 'at', `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`);
  
  return {
    eventDate: finalDate,
    reasoning: `${dayName} at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period} works well for ${venueTypes.includes('brunch') ? 'brunch' : venueTypes.includes('lunch') ? 'lunch' : venueTypes.includes('bar') || venueTypes.includes('drink') ? 'drinks' : 'this outing'} based on venue type and group availability`,
  };
}