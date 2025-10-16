import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

**Guidelines (CRITICAL - Follow in order):**
1. **FIRST, identify the meal type from venue names and types:**
   * Brunch venues (brunch, breakfast cafe, morning spots) → 10:00-14:00 (10am-2pm), ALWAYS on weekends
   * Breakfast venues → 08:00-11:00 (8am-11am)
   * Lunch venues → 11:00-14:00 (11am-2pm)
   * Dinner venues (restaurants, fine dining) → 18:00-21:00 (6pm-9pm)
   * Bars/drinks → 19:00-23:00 (7pm-11pm)
   * Activities → match to appropriate time of day

2. **THEN match to group's availability:**
   * If group says "Weekends" or "Saturday/Sunday" → pick Saturday or Sunday
   * If group says "Weekday evenings" → pick weekday after 18:00
   * If group says "Friday/Saturday nights" → pick Friday or Saturday evening

3. **Timing rules:**
   * For upscale/reservation venues: suggest 6+ days out
   * For casual spots: 3-5 days out is fine
   * ALWAYS use 24-hour time format (HH:MM) in your response
   * Use correct meal terminology (e.g., "brunch" for brunch venues, NOT "dinner")

Return ONLY a JSON object with this exact structure:
{
  "date": "2025-10-25",
  "time": "19:00",
  "reasoning": "Friday evening works well for dinner at upscale venue, gives group 6 days to plan"
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