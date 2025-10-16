import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
- Fine dining / upscale venues with reservations: 7-14 days advance notice, 3-5 day RSVP window
- Casual spots / bars: 3-5 days advance notice, 2-3 day RSVP window
- Large groups (>6 people): Need more advance notice for coordination
- Small groups (2-4 people): Can be more spontaneous
- Always include gentle_nudge halfway through RSVP window if window > 2 days
- Always include final_call 1 day before RSVP deadline if window > 2 days
- Always include day_before reminder for all events

**Output Format (JSON):**
{
  "inviteAdvanceDays": 7,
  "rsvpWindowDays": 3,
  "reminders": [
    {"type": "gentle_nudge", "daysBeforeDeadline": 2},
    {"type": "final_call", "daysBeforeDeadline": 1},
    {"type": "day_before", "daysBeforeEvent": 1}
  ],
  "reasoning": "Upscale restaurant requiring reservations needs 7-day advance notice. 3-day RSVP window gives planner time to book."
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

    // Validation & defaults
    if (!config.inviteAdvanceDays || config.inviteAdvanceDays < 1) {
      config.inviteAdvanceDays = 5;
    }
    if (!config.rsvpWindowDays || config.rsvpWindowDays < 1) {
      config.rsvpWindowDays = 3;
    }
    if (!config.reminders || config.reminders.length === 0) {
      config.reminders = [
        { type: 'gentle_nudge', daysBeforeDeadline: Math.floor(config.rsvpWindowDays / 2) },
        { type: 'final_call', daysBeforeDeadline: 1 },
        { type: 'day_before', daysBeforeEvent: 1 },
      ];
    }

    return config;
  } catch (error) {
    console.error('Error generating schedule config:', error);
    
    // Fallback to sensible defaults
    const isUpscale = venues.some(v => 
      v.type.toLowerCase().includes('fine') || 
      v.type.toLowerCase().includes('restaurant') ||
      v.requiresReservation
    );
    
    const inviteAdvanceDays = isUpscale || groupSize > 6 ? 7 : 5;
    const rsvpWindowDays = isUpscale || groupSize > 6 ? 3 : 2;
    
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
