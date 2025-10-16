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
  try {
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

**Guidelines (CRITICAL - Follow in exact order):**
1. **FIRST, check group availability - THIS IS THE HARD CONSTRAINT:**
   * If group lists specific days (e.g., "Thursday, Friday, Saturday, and Sunday only") → ONLY pick from those exact days listed (NEVER other days)
   * If group says "Weekends" or "Saturday/Sunday" → MUST pick Saturday or Sunday (NEVER weekdays)
   * If group says "Weekday evenings" or "week nights" → MUST pick weekday (Mon-Fri) after 18:00 (NEVER weekends)
   * If group says "Weekday afternoons" → MUST pick weekday (Mon-Fri) 14:00-18:00 (NEVER weekends)
   * If group says "Friday/Saturday nights" → MUST pick Friday or Saturday evening (NEVER other days)
   * Availability is NON-NEGOTIABLE - you can ONLY suggest days explicitly mentioned in the availability constraint

2. **THEN identify meal type and time within the allowed days:**
   * Brunch venues (brunch, breakfast cafe, morning spots) → 10:00-14:00 (10am-2pm), prefer weekends
   * Breakfast venues → 08:00-11:00 (8am-11am)
   * Lunch venues → 11:00-14:00 (11am-2pm)
   * Dinner venues (restaurants, fine dining) → 18:00-21:00 (6pm-9pm)
   * Bars/drinks → 19:00-23:00 (7pm-11pm)
   * Activities → match to appropriate time of day

3. **Timing rules:**
   * For upscale/reservation venues: suggest 6+ days out
   * For casual spots: 3-5 days out is fine
   * ALWAYS use 24-hour time format (HH:MM) in your response
   * Use correct meal terminology (e.g., "brunch" for brunch venues, NOT "dinner")

4. **Reasoning requirements (CRITICAL):**
   * Your reasoning MUST reference the ACTUAL day of week you suggested (e.g., "Saturday", "Tuesday")
   * Your reasoning MUST reference the ACTUAL meal type from the venues (e.g., "brunch", "drinks", "lunch")
   * DO NOT use generic template text - make it specific to your actual suggestion
   * Keep it concise (1-2 sentences, casual tone)

Return ONLY a JSON object with this exact structure (DO NOT copy this example text - generate your own based on your actual suggestion):
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "reasoning": "[Day of week] at [time] works well for [actual meal type] based on venue type and group availability"
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
      return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
    }

    return {
      eventDate,
      reasoning: result.reasoning || 'AI-selected optimal time based on venue type and group availability',
    };
  } catch (error) {
    console.error('[AI Time Picker] Error:', error);
    const now = new Date();
    const minDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const tzIdentifier = input.location ? getTimezoneIdentifier(input.location) : 'America/Los_Angeles';
    return generateFallbackTime(input, minDate, maxDate, tzIdentifier);
  }
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
  // Deterministic fallback based on heuristics
  const now = new Date();

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

  // Determine day of week based on general availability
  let targetDayOfWeek = 6; // Default to Saturday

  // For brunch/breakfast, ALWAYS prefer weekends regardless of general availability
  if (venueTypes.includes('brunch') || venueTypes.includes('breakfast')) {
    targetDayOfWeek = 6; // Saturday for brunch
  } else if (input.generalAvailability?.toLowerCase().includes('weekday') || input.generalAvailability?.toLowerCase().includes('week night')) {
    targetDayOfWeek = 5; // Friday (end of work week)
  } else if (input.generalAvailability?.toLowerCase().includes('friday')) {
    targetDayOfWeek = 5; // Friday
  } else if (input.generalAvailability?.toLowerCase().includes('weekend')) {
    targetDayOfWeek = 6; // Saturday
  }

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

  // If somehow we're past maxDate, use minDate + 5 days
  if (candidateDate > maxDate) {
    candidateDate = new Date(minDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    candidateDate.setHours(hours, minutes, 0, 0);
  }
  
  // Convert to timezone-aware UTC date using date-fns-tz
  // Create a "naive" Date using UTC to avoid server timezone interpretation
  const year = candidateDate.getFullYear();
  const month = candidateDate.getMonth();
  const day = candidateDate.getDate();
  const naiveDate = new Date(Date.UTC(year, month, day, hours, minutes));
  // fromZonedTime treats this as local time in the target timezone and converts to UTC
  const finalDate = fromZonedTime(naiveDate, tzIdentifier);

  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][candidateDate.getDay()];
  
  // Format time correctly for 12-hour clock
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'PM' : 'AM';
  
  return {
    eventDate: finalDate,
    reasoning: `${dayName} at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period} works well for ${venueTypes.includes('brunch') ? 'brunch' : venueTypes.includes('lunch') ? 'lunch' : venueTypes.includes('bar') || venueTypes.includes('drink') ? 'drinks' : 'this outing'} based on venue type and group availability`,
  };
}