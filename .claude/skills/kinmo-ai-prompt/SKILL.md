---
name: kinmo-ai-prompt
description: Create OpenAI prompt functions for Kinmo with structured outputs, caching, and cost tracking. Use when adding new AI-powered features that call GPT-4o or GPT-4o-mini.
---

# Kinmo AI Prompt Patterns

When creating new OpenAI integrations for Kinmo, follow these patterns.

## File Location

- AI functions: `server/openai.ts`
- Specialized AI agents: `server/ai-*.ts` (e.g., `ai-event-agent.ts`, `ai-time-picker.ts`)

## Standard AI Function Template

```typescript
export async function myAiFunction(params: {
  requiredParam: string;
  optionalContext?: string[];
}): Promise<MyResponseType> {
  const startTime = Date.now();

  try {
    // Build the prompt
    const systemPrompt = `You are an AI assistant for Kinmo, a group event planning app.
Your task is to [describe task].

IMPORTANT RULES:
1. Always respond in valid JSON format
2. [Other rules specific to this function]`;

    const userPrompt = `[Build user prompt with params]`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // Use gpt-4o for complex reasoning
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,  // Adjust based on creativity needs
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(responseText);

    // Log the API call
    const responseTime = Date.now() - startTime;
    await logApiCall({
      service: "openai",
      method: "myAiFunction",
      cacheStatus: "miss",
      status: "success",
      responseTimeMs: responseTime,
      costEstimate: calculateOpenAICost(
        "gpt-4o-mini",
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      parameters: { paramCount: params.optionalContext?.length },
    });

    return result;
  } catch (error: any) {
    console.error("[myAiFunction] Error:", error);
    await logApiCall({
      service: "openai",
      method: "myAiFunction",
      cacheStatus: "miss",
      status: "error",
      errorMessage: error.message,
    });
    throw error;
  }
}
```

## Model Selection

```typescript
// gpt-4o-mini ($0.15/1M input, $0.60/1M output)
// Use for: Simple categorization, parsing, formatting
const model = "gpt-4o-mini";

// gpt-4o ($2.50/1M input, $10.00/1M output)
// Use for: Complex reasoning, multi-step analysis, creative generation
const model = "gpt-4o";
```

## Response Format Patterns

### Structured JSON Response

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [...],
  response_format: { type: "json_object" },
});

// Always include JSON schema in system prompt
const systemPrompt = `...
Respond with JSON in this exact format:
{
  "items": [
    {
      "name": "string",
      "score": number,
      "reasoning": "string"
    }
  ],
  "summary": "string"
}`;
```

### Enum/Category Response

```typescript
const systemPrompt = `Categorize the venue into exactly ONE of these categories:
- meal: Restaurants, food halls, places primarily for eating
- cafes: Coffee shops, cafes
- drinks: Bars, breweries, wine bars
- dessert: Ice cream, boba, bakeries
- experiences: Museums, concerts, outdoor activities

Respond with JSON: { "category": "meal|cafes|drinks|dessert|experiences", "confidence": 0.0-1.0 }`;
```

## Caching Pattern

```typescript
// Check cache first
const cacheKey = `my-function:${hashParams(params)}`;
const cached = await db
  .select()
  .from(aiCategorizationCache)
  .where(and(
    eq(aiCategorizationCache.cacheKey, cacheKey),
    gt(aiCategorizationCache.expiresAt, new Date())
  ))
  .limit(1);

if (cached.length > 0) {
  await logApiCall({
    service: "openai",
    method: "myAiFunction",
    cacheStatus: "hit",
    status: "success",
  });
  return JSON.parse(cached[0].result);
}

// Call OpenAI...

// Store in cache
await db.insert(aiCategorizationCache).values({
  cacheKey,
  result: JSON.stringify(result),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  createdAt: new Date(),
});
```

## Building Context-Rich Prompts

### Group Preferences Context

```typescript
function buildGroupContext(groupData: GroupData): string {
  let context = `GROUP PROFILE:
- Location: ${groupData.locationBase}
- Budget: $${groupData.budgetMin}-${groupData.budgetMax} per person
- Meeting frequency: ${groupData.meetingFrequency}
- Closeness level: ${groupData.closenessLevel}/5
- Novelty preference: ${groupData.noveltyPreference}/5`;

  if (groupData.pastPreferences) {
    context += `\n- Past preferences: ${groupData.pastPreferences}`;
  }

  return context;
}
```

### Feedback/Learning Context

```typescript
function buildFeedbackContext(feedback: Feedback[]): string {
  if (!feedback.length) return '';

  const loved = feedback.filter(f => f.rating >= 4);
  const disliked = feedback.filter(f => f.rating <= 2);

  let context = '\nPAST FEEDBACK:';
  if (loved.length) {
    context += `\n- Loved: ${loved.map(f => f.venueName).join(', ')}`;
  }
  if (disliked.length) {
    context += `\n- Disliked: ${disliked.map(f => f.venueName).join(', ')}`;
  }

  return context;
}
```

### Constraint Injection

```typescript
// Always add exclusions to prevent repetition
if (seenVenues?.length) {
  userPrompt += `\n\nDO NOT suggest these venues (already seen): ${seenVenues.join(', ')}`;
}

if (rejectedVenues?.length) {
  userPrompt += `\n\nDO NOT suggest these venues (don't exist or closed): ${rejectedVenues.join(', ')}`;
}
```

## Temperature Guidelines

```typescript
// Low (0.0 - 0.3): Deterministic, factual
temperature: 0.1,  // Categorization, parsing

// Medium (0.4 - 0.7): Balanced
temperature: 0.7,  // Activity suggestions, creative but grounded

// High (0.8 - 1.0): Creative, varied
temperature: 0.9,  // Generating unique concepts
```

## Error Handling

```typescript
try {
  const response = await openai.chat.completions.create({...});
  const result = JSON.parse(response.choices[0]?.message?.content || "{}");

  // Validate response structure
  if (!result.items || !Array.isArray(result.items)) {
    console.warn("[myAiFunction] Invalid response structure, using fallback");
    return getDefaultResponse();
  }

  return result;
} catch (error: any) {
  // Log for monitoring
  console.error("[myAiFunction] OpenAI error:", error.message);

  // Track failed calls
  await logApiCall({
    service: "openai",
    method: "myAiFunction",
    cacheStatus: "miss",
    status: "error",
    errorMessage: error.message,
  });

  // Return graceful fallback or rethrow
  if (error.code === 'rate_limit_exceeded') {
    throw new Error("AI service temporarily unavailable. Please try again.");
  }

  throw error;
}
```

## Cost Tracking

Already integrated via `logApiCall` and `calculateOpenAICost`:

```typescript
await logApiCall({
  service: "openai",
  method: "functionName",
  cacheStatus: "hit" | "miss" | "write",
  status: "success" | "error",
  responseTimeMs: Date.now() - startTime,
  costEstimate: calculateOpenAICost(model, inputTokens, outputTokens),
  parameters: { /* logged params for debugging */ },
});
```

## Common Kinmo AI Functions

Reference these existing functions for patterns:
- `generateActivitySuggestions()` - Complex multi-context prompts
- `categorizeVenue()` - Simple categorization with caching
- `parseSchedulingPrompt()` - Natural language parsing
- `validateVenueForCategory()` - Binary validation
- `analyzePreferencePatterns()` - Pattern analysis

## Checklist for New AI Function

- [ ] Choose appropriate model (gpt-4o-mini vs gpt-4o)
- [ ] Set response_format to json_object
- [ ] Include JSON schema in system prompt
- [ ] Add caching if results are reusable
- [ ] Log API call with cost estimate
- [ ] Handle parse errors gracefully
- [ ] Add fallback for rate limits
- [ ] Export function for use in routes

## Structured Outputs (OpenAI's JSON Mode)

For guaranteed JSON structure, use OpenAI's structured outputs:

```typescript
import { zodResponseFormat } from "openai/helpers/zod";

// Define expected output schema
const VenueSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    category: z.enum(["meal", "drinks", "experience"]),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  summary: z.string(),
});

export async function getVenueSuggestions(params: VenueParams) {
  const response = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(VenueSuggestionSchema, "venue_suggestions"),
  });

  // Automatically parsed and typed!
  const result = response.choices[0].message.parsed;
  return result; // Type: z.infer<typeof VenueSuggestionSchema>
}
```

## Multi-Model Strategy

Use different models for different tasks:

```typescript
// Quick classification - use gpt-4o-mini
const category = await categorizeVenue(venueName, venueType); // Fast, cheap

// Complex reasoning - use gpt-4o
const analysis = await analyzeGroupPreferences(feedbackHistory); // Better quality

// Batch operations - use gpt-4o-mini with parallelization
const limit = pLimit(5); // Max 5 concurrent requests
const results = await Promise.all(
  venues.map(v => limit(() => categorizeVenue(v.name, v.type)))
);
```

## Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;

      // Only retry on transient errors
      if (error.code === 'rate_limit_exceeded' || error.code === 'timeout') {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error; // Don't retry on other errors
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
const result = await withRetry(() => categorizeVenue(name, type));
```

## Prompt Engineering Tips for Kinmo

### Be Specific About Kinmo Context
```typescript
const systemPrompt = `You are an AI assistant for Kinmo, a group event planning app.
Kinmo helps friend groups plan regular activities together.

Key concepts:
- Groups: Collections of friends who meet regularly
- Itineraries: Event plans with venues, times, and RSVPs
- Activities: Venues saved to a group's library
- Cadence: How often a group meets (weekly, biweekly, monthly)

Your task is to [specific task]...`;
```

### Include Constraints Explicitly
```typescript
userPrompt += `

CONSTRAINTS:
- Budget: $${budgetMin}-${budgetMax} per person
- Location: Within ${radiusMiles} miles of ${location}
- Already visited: ${visitedVenues.join(', ')} (don't repeat these)
- Dietary restrictions: ${restrictions.join(', ')}`;
```

### Request Confidence Scores
```typescript
// Always ask for confidence to help with fallback logic
const systemPrompt = `...
Include a confidence score (0.0-1.0) for each suggestion.
Use 0.8+ for high confidence, 0.5-0.8 for moderate, below 0.5 for uncertain.`;

// Then in code:
const suggestions = result.suggestions.filter(s => s.confidence >= 0.7);
```

## Common AI Functions in Kinmo

| Function | Model | Purpose | Cache TTL |
|----------|-------|---------|-----------|
| `categorizeVenue` | gpt-4o-mini | Classify venue into meal/drinks/experience | 24h |
| `generateActivitySuggestions` | gpt-4o-mini | Suggest new venues for group | 1h |
| `parseSchedulingPrompt` | gpt-4o-mini | NLP parsing of "let's meet next Friday" | None |
| `analyzePreferencePatterns` | gpt-4o | Find patterns in group feedback | 6h |
| `validateVenueForCategory` | gpt-4o-mini | Check if venue fits a category | 24h |
| `generateItineraryName` | gpt-4o-mini | Create fun name for event | None |

## Fallback Strategies

```typescript
export async function categorizeWithFallback(
  venueName: string,
  venueType: string
): Promise<VenueCategory> {
  try {
    // Try AI categorization first
    const result = await categorizeVenue(venueName, venueType);
    if (result.confidence >= 0.7) {
      return result.category;
    }
    // Low confidence - fall back to keyword matching
    return fallbackCategorize(venueName, venueType);
  } catch (error) {
    // AI failed - use keyword fallback
    console.warn("[categorizeWithFallback] AI failed, using fallback:", error);
    return fallbackCategorize(venueName, venueType);
  }
}

function fallbackCategorize(name: string, type: string): VenueCategory {
  const text = `${name} ${type}`.toLowerCase();

  if (text.match(/restaurant|food|dining|kitchen|grill|cafe/)) return "meal";
  if (text.match(/bar|pub|brewery|wine|cocktail/)) return "drinks";
  if (text.match(/museum|theater|park|concert|gallery/)) return "experience";

  return "experience"; // Default
}
```
