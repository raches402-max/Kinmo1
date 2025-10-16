import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Convert availability object to natural language string
export function convertAvailabilityToString(availability: any): string {
  if (!availability || typeof availability !== 'object') {
    return 'Not specified';
  }

  // Availability grid structure: { [day]: { morning: boolean, afternoon: boolean, evening: boolean } }
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels: { [key: string]: string } = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  };

  const availableDays: string[] = [];
  const timeSlots: { [key: string]: Set<string> } = {
    morning: new Set(),
    afternoon: new Set(),
    evening: new Set()
  };

  // Collect which days are available and which time slots
  for (const day of dayNames) {
    const dayData = availability[day];
    if (dayData && typeof dayData === 'object') {
      const hasAnySlot = dayData.morning || dayData.afternoon || dayData.evening;
      if (hasAnySlot) {
        availableDays.push(dayLabels[day]);
        
        if (dayData.morning) timeSlots.morning.add(dayLabels[day]);
        if (dayData.afternoon) timeSlots.afternoon.add(dayLabels[day]);
        if (dayData.evening) timeSlots.evening.add(dayLabels[day]);
      }
    }
  }

  if (availableDays.length === 0) {
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

  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length === 2) {
    return parts.join(' and ');
  } else {
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }
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

    const prompt = `You are scheduling a group outing. Pick ONE specific date and time.

Venues: ${venueList}
Group general availability: ${input.generalAvailability || 'Not specified'}
Member constraints: ${constraints}
${input.rescheduleReason ? `Previous attempt failed: ${input.rescheduleReason}` : ''}

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
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    if (!result.date || !result.time) {
      return generateFallbackTime(input, minDate, maxDate);
    }

    // Parse and validate the AI-suggested time
    const [year, month, day] = result.date.split('-').map(Number);
    const [hours, minutes] = result.time.split(':').map(Number);
    const eventDate = new Date(year, month - 1, day, hours, minutes);

    // Validate it's within our range
    if (eventDate < minDate || eventDate > maxDate) {
      return generateFallbackTime(input, minDate, maxDate);
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
    return generateFallbackTime(input, minDate, maxDate);
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
  }
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
  });

  return {
    suggestedTime: result.eventDate.toISOString(),
    reasoning: result.reasoning,
  };
}

function generateFallbackTime(
  input: TimeSelectionInput,
  minDate: Date,
  maxDate: Date
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

  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][candidateDate.getDay()];
  
  // Format time correctly for 12-hour clock
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'PM' : 'AM';
  
  return {
    eventDate: candidateDate,
    reasoning: `${dayName} at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period} works well for ${venueTypes.includes('brunch') ? 'brunch' : venueTypes.includes('lunch') ? 'lunch' : venueTypes.includes('bar') || venueTypes.includes('drink') ? 'drinks' : 'this outing'} based on venue type and group availability`,
  };
}