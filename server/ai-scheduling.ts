import OpenAI from 'openai';
import { logApiCall, calculateOpenAICost } from './openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
});

export interface ScheduleConfig {
  inviteAdvanceDays: number; // How many days before event to send invites
  rsvpWindowDays: number; // How many days members have to RSVP
  reminders: Array<{
    type: 'gentle_nudge' | 'final_call' | 'day_before';
    daysBeforeDeadline?: number; // For nudge/final call (relative to RSVP deadline)
    daysBeforeEvent?: number; // For day-before reminder
  }>;
  reasoning: string; // AI explanation for the schedule
}

export interface VenueInfo {
  name: string;
  type: string;
  requiresReservation?: boolean;
}

export async function generateScheduleConfig(
  venues: VenueInfo[],
  groupSize: number,
  eventDateFromNow?: number // Optional: days from now to the event (if already known)
): Promise<ScheduleConfig> {
  const startTime = Date.now();

  const venueDescriptions = venues.map(v =>
    `${v.name} (${v.type})${v.requiresReservation ? ' - requires reservation' : ''}`
  ).join(', ');

  const prompt = `You are an expert event planner. Analyze this planned outing and suggest an optimal automated email schedule.

**Event Details:**
- Group size: ${groupSize} people
- Venues: ${venueDescriptions}
${eventDateFromNow ? `- Event is ${eventDateFromNow} days from now` : '- Event date not yet set'}

**Your Task:**
Determine the ideal timing for:
1. How far in advance to send initial invites (inviteAdvanceDays)
2. How long to give people to RSVP (rsvpWindowDays)
3. Which automated reminders to send (gentle_nudge, final_call, day_before)

**Guidelines:**
- CRITICAL: RSVP deadline must be at least 7 days before event (inviteAdvanceDays - rsvpWindowDays >= 7)
- Standard timeline (21 days out): 21 days advance notice, 14 day RSVP window (deadline 7 days before)
- Medium timeline (14 days out): 14 days advance notice, 7 day RSVP window (deadline 7 days before)
- Fine dining / upscale venues: Use standard timeline for proper planning
- Casual spots: Use medium timeline but never less than 7 days before event for RSVP deadline
- Large groups (>6 people): Need more advance notice, use standard timeline
- Always include gentle_nudge halfway through RSVP window
- Always include final_call 1 day before RSVP deadline
- Always include day_before reminder for all events

**Output Format (JSON):**
{
  "inviteAdvanceDays": 21,
  "rsvpWindowDays": 14,
  "reminders": [
    {"type": "gentle_nudge", "daysBeforeDeadline": 7},
    {"type": "final_call", "daysBeforeDeadline": 1},
    {"type": "day_before", "daysBeforeEvent": 1}
  ],
  "reasoning": "Standard timeline gives 3 weeks notice with RSVP deadline 7 days before event for venue booking."
}

Keep reasoning to 1-2 sentences max.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert event planning assistant. Provide concise, practical scheduling advice.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const config = JSON.parse(response.choices[0].message.content || '{}') as ScheduleConfig;

    // Log successful API call
    await logApiCall({
      service: 'openai',
      method: 'generateScheduleConfig',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs: Date.now() - startTime,
      costEstimate: calculateOpenAICost(
        'gpt-4o-mini',
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      parameters: { venueCount: venues.length, groupSize, eventDateFromNow },
      metadata: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        inviteAdvanceDays: config.inviteAdvanceDays,
        rsvpWindowDays: config.rsvpWindowDays,
      },
    });

    // Validation & defaults - ensure at least 7 days before event for RSVP deadline
    if (!config.inviteAdvanceDays || config.inviteAdvanceDays < 1) {
      config.inviteAdvanceDays = 14;
    }
    if (!config.rsvpWindowDays || config.rsvpWindowDays < 1) {
      config.rsvpWindowDays = 7;
    }
    if (!config.reminders || config.reminders.length === 0) {
      config.reminders = [
        { type: 'gentle_nudge', daysBeforeDeadline: Math.floor(config.rsvpWindowDays / 2) },
        { type: 'final_call', daysBeforeDeadline: 1 },
        { type: 'day_before', daysBeforeEvent: 1 },
      ];
    }

    return config;
  } catch (error: any) {
    // Log failed API call
    await logApiCall({
      service: 'openai',
      method: 'generateScheduleConfig',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error.message,
      parameters: { venueCount: venues.length, groupSize, eventDateFromNow },
    });

    console.error('Error generating schedule config:', error);
    
    // Fallback to sensible defaults - ensure at least 7 days before event for RSVP deadline
    const isUpscale = venues.some(v =>
      v.type.toLowerCase().includes('fine') ||
      v.type.toLowerCase().includes('restaurant') ||
      v.requiresReservation
    );

    // Default timeline: 21 days advance, 14 day RSVP window = 7 days before event
    // Smaller groups: 14 days advance, 7 day RSVP window = 7 days before event
    const inviteAdvanceDays = isUpscale || groupSize > 6 ? 21 : 14;
    const rsvpWindowDays = isUpscale || groupSize > 6 ? 14 : 7;

    return {
      inviteAdvanceDays,
      rsvpWindowDays,
      reminders: [
        { type: 'gentle_nudge', daysBeforeDeadline: Math.max(1, Math.floor(rsvpWindowDays / 2)) },
        { type: 'final_call', daysBeforeDeadline: 1 },
        { type: 'day_before', daysBeforeEvent: 1 },
      ],
      reasoning: 'Using default schedule based on venue type and group size.',
    };
  }
}
