/**
 * AI Event Planning Agent using Claude API
 *
 * This module handles conversational AI for event planning,
 * using Claude with tool calling for venue search, itinerary management, etc.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentTools, executeAgentTool } from "./agent-mcp-server";

// Check for API key at startup - fail fast with clear error
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[AI Agent] ANTHROPIC_API_KEY not set - AI chat will not work");
}

// Only create client if API key exists - prevents hanging with invalid key
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function ensureAnthropicClient(): Anthropic {
  if (!anthropic) {
    throw new Error("AI chat is not configured. ANTHROPIC_API_KEY is missing.");
  }
  return anthropic;
}

// Session storage for conversation history (in-memory for now)
const sessionHistory: Map<string, Anthropic.MessageParam[]> = new Map();

// Clean up old sessions periodically (sessions older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId] of sessionHistory) {
    // Simple cleanup - could be enhanced with timestamps
    if (sessionHistory.size > 100) {
      sessionHistory.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Every 15 minutes

interface GroupContext {
  name: string;
  locationBase: string;
  latitude: string | null;
  longitude: string | null;
  searchRadius: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  enabledCategories: string[];
  additionalInstructions: string | null;
  timezone: string | null;
}

interface AgentChatOptions {
  prompt: string;
  itineraryId: string;
  groupId: string | null;
  groupContext?: GroupContext | null;
  sessionId?: string;
}

interface AgentChatResult {
  response: string;
  sessionId: string;
  toolsUsed: string[];
}

/**
 * Run the event planning agent with a user prompt
 *
 * @param options - Chat options including prompt and context
 * @returns Agent response with session info
 */
export async function runEventPlanningAgent(
  options: AgentChatOptions
): Promise<AgentChatResult> {
  const { prompt, itineraryId, groupId, groupContext, sessionId } = options;

  // Generate or use existing session ID
  const actualSessionId =
    sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Get or initialize conversation history
  let messages = sessionHistory.get(actualSessionId) || [];

  // System prompt for the event planning agent
  const systemPrompt = `You are an AI event planning assistant for Kinmo, helping users plan events with their friend groups.

## Your Capabilities

### Venue Discovery
- **searchVenues** - Search for venues using Google Places API
- **resolveLocation** - Convert place names to coordinates (USE THIS FIRST when user mentions a place by name)
- **getGroupFavorites** - Access the group's favorite venues (only use when contextually relevant)
- **getVenueDetails** - Get detailed venue info including hours

### Itinerary Management
- **getCurrentItinerary** - View the current itinerary
- **addVenueToItinerary** - Add venues to the itinerary
- **removeVenueFromItinerary** - Remove venues from the itinerary

### Group & Preferences
- **getGroupPreferences** - Get group preferences and settings

### Scheduling & Pipeline (Phase 2)
- **getUpcomingEvents** - See what events are scheduled or pending for the group
- **getEventRsvpStatus** - Check who has RSVP'd, who hasn't, and their responses
- **getMemberAvailability** - Get weekly availability patterns for all members
- **suggestEventTimes** - Get AI-suggested time options based on availability
- **rescheduleEvent** - Change the date/time of an existing event
- **sendRsvpReminder** - Nudge members who haven't responded
- **analyzeSchedulingConflicts** - Check if a proposed time works for everyone

## Key Rules

### Venue Discovery
1. **Location Resolution**: When users mention locations by name (e.g., "near Double Standard", "in the Marina"), ALWAYS use resolveLocation first to get coordinates before searching.
2. **Contextual Favorites**: Only suggest favorites when they're geographically close (within 1 mile) AND in the same category.
3. **Balance Discovery**: Mix in new discoveries, don't over-rely on favorites.

### Scheduling
4. **Check Availability First**: Before suggesting or changing times, check member availability with getMemberAvailability or analyzeSchedulingConflicts.
5. **Proactive RSVP Awareness**: When asked about an event, check RSVP status. If people haven't responded, offer to send reminders.
6. **Explain Timing Decisions**: When suggesting times, explain why (e.g., "Saturday at 7pm works best - 4 out of 5 people are free").

### General
7. **Be Conversational**: Ask clarifying questions, explain your reasoning briefly.
8. **Confirm Actions**: Before modifying anything (adding venue, rescheduling), describe what you'll do and ask for confirmation.
9. **Be Concise**: Keep responses short and focused. Use bullet points for lists.
10. **Include Google Maps Links**: When recommending venues, ALWAYS include the googleMapsUrl as a clickable markdown link like [View on Google Maps](url) so users can easily check the location.

## Current Context
- Itinerary ID: ${itineraryId}
${groupId ? `- Group ID: ${groupId}` : "- Standalone event (no group - scheduling tools unavailable)"}
${groupContext ? `
## Your Group's Info
- **Group**: ${groupContext.name}
- **Location**: ${groupContext.locationBase}${groupContext.latitude && groupContext.longitude ? ` (${groupContext.latitude}, ${groupContext.longitude})` : ''}
- **Search Radius**: ${groupContext.searchRadius || 5} miles
- **Budget**: ${groupContext.budgetMin != null || groupContext.budgetMax != null ? `$${groupContext.budgetMin || 0} - $${groupContext.budgetMax || '∞'}` : 'No preference'}
- **Categories**: ${groupContext.enabledCategories.length > 0 ? groupContext.enabledCategories.join(', ') : 'All'}
${groupContext.additionalInstructions ? `- **Special Instructions**: ${groupContext.additionalInstructions}` : ''}
${groupContext.timezone ? `- **Timezone**: ${groupContext.timezone}` : ''}

**IMPORTANT**: This group is based in **${groupContext.locationBase}**. When searching for venues or resolving locations, assume they mean places in or near ${groupContext.locationBase} unless they explicitly specify a different location.` : ''}

Start by understanding what the user wants, then use your tools to help them. Be friendly but efficient.`;

  // Add user message to history
  messages.push({
    role: "user",
    content: prompt,
  });

  const toolsUsed: string[] = [];
  let finalResponse = "";
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  try {
    // Agentic loop - keep processing until we get a final response
    while (iterations < maxIterations) {
      iterations++;

      const client = ensureAnthropicClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools: agentTools as any,
        messages,
      });

      // Check if we have tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Check if we have text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (toolUseBlocks.length > 0) {
        // Execute tools and continue the loop
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          toolsUsed.push(toolUse.name);
          console.log(`[AI Agent] Executing tool: ${toolUse.name}`);

          const result = await executeAgentTool(
            toolUse.name,
            toolUse.input as Record<string, any>
          );

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        // Add assistant message with tool use
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Add tool results
        messages.push({
          role: "user",
          content: toolResults,
        });
      } else {
        // No tool use - we have a final response
        if (textBlocks.length > 0) {
          finalResponse = textBlocks.map((b) => b.text).join("\n");
        }

        // Add final assistant message to history
        messages.push({
          role: "assistant",
          content: response.content,
        });

        break;
      }

      // Check stop reason
      if (response.stop_reason === "end_turn") {
        // Combine any text from this response
        if (textBlocks.length > 0) {
          finalResponse = textBlocks.map((b) => b.text).join("\n");
        }
        messages.push({
          role: "assistant",
          content: response.content,
        });
        break;
      }
    }

    // Store updated conversation history
    sessionHistory.set(actualSessionId, messages);

    return {
      response: finalResponse || "I apologize, I couldn't generate a response. Please try again.",
      sessionId: actualSessionId,
      toolsUsed: [...new Set(toolsUsed)], // Dedupe
    };
  } catch (error: any) {
    console.error("[AI Agent] Error:", error);

    // Don't save failed conversation state
    if (messages.length > 1) {
      messages.pop(); // Remove the failed user message
      sessionHistory.set(actualSessionId, messages);
    }

    throw new Error(
      error.message || "Failed to communicate with AI agent"
    );
  }
}

/**
 * Stream the event planning agent response
 *
 * @param options - Chat options
 * @param onChunk - Callback for each text chunk
 * @returns Final result with session info
 */
export async function streamEventPlanningAgent(
  options: AgentChatOptions,
  onChunk: (chunk: string) => void
): Promise<AgentChatResult> {
  const { prompt, itineraryId, groupId, groupContext, sessionId } = options;

  const actualSessionId =
    sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let messages = sessionHistory.get(actualSessionId) || [];

  const systemPrompt = `You are an AI event planning assistant for Kinmo, helping users plan events with their friend groups.

## Your Capabilities

### Venue Discovery
- **searchVenues** - Search for venues using Google Places API
- **resolveLocation** - Convert place names to coordinates (USE THIS FIRST when user mentions a place by name)
- **getGroupFavorites** - Access the group's favorite venues (only use when contextually relevant)
- **getVenueDetails** - Get detailed venue info including hours

### Itinerary Management
- **getCurrentItinerary** - View the current itinerary
- **addVenueToItinerary** - Add venues to the itinerary
- **removeVenueFromItinerary** - Remove venues from the itinerary

### Group & Preferences
- **getGroupPreferences** - Get group preferences and settings

### Scheduling & Pipeline (Phase 2)
- **getUpcomingEvents** - See what events are scheduled or pending for the group
- **getEventRsvpStatus** - Check who has RSVP'd, who hasn't, and their responses
- **getMemberAvailability** - Get weekly availability patterns for all members
- **suggestEventTimes** - Get AI-suggested time options based on availability
- **rescheduleEvent** - Change the date/time of an existing event
- **sendRsvpReminder** - Nudge members who haven't responded
- **analyzeSchedulingConflicts** - Check if a proposed time works for everyone

## Key Rules

### Venue Discovery
1. **Location Resolution**: When users mention locations by name (e.g., "near Double Standard", "in the Marina"), ALWAYS use resolveLocation first to get coordinates before searching.
2. **Contextual Favorites**: Only suggest favorites when they're geographically close (within 1 mile) AND in the same category.
3. **Balance Discovery**: Mix in new discoveries, don't over-rely on favorites.

### Scheduling
4. **Check Availability First**: Before suggesting or changing times, check member availability with getMemberAvailability or analyzeSchedulingConflicts.
5. **Proactive RSVP Awareness**: When asked about an event, check RSVP status. If people haven't responded, offer to send reminders.
6. **Explain Timing Decisions**: When suggesting times, explain why (e.g., "Saturday at 7pm works best - 4 out of 5 people are free").

### General
7. **Be Conversational**: Ask clarifying questions, explain your reasoning briefly.
8. **Confirm Actions**: Before modifying anything (adding venue, rescheduling), describe what you'll do and ask for confirmation.
9. **Be Concise**: Keep responses short and focused. Use bullet points for lists.
10. **Include Google Maps Links**: When recommending venues, ALWAYS include the googleMapsUrl as a clickable markdown link like [View on Google Maps](url) so users can easily check the location.

## Current Context
- Itinerary ID: ${itineraryId}
${groupId ? `- Group ID: ${groupId}` : "- Standalone event (no group - scheduling tools unavailable)"}
${groupContext ? `
## Your Group's Info
- **Group**: ${groupContext.name}
- **Location**: ${groupContext.locationBase}${groupContext.latitude && groupContext.longitude ? ` (${groupContext.latitude}, ${groupContext.longitude})` : ''}
- **Search Radius**: ${groupContext.searchRadius || 5} miles
- **Budget**: ${groupContext.budgetMin != null || groupContext.budgetMax != null ? `$${groupContext.budgetMin || 0} - $${groupContext.budgetMax || '∞'}` : 'No preference'}
- **Categories**: ${groupContext.enabledCategories.length > 0 ? groupContext.enabledCategories.join(', ') : 'All'}
${groupContext.additionalInstructions ? `- **Special Instructions**: ${groupContext.additionalInstructions}` : ''}
${groupContext.timezone ? `- **Timezone**: ${groupContext.timezone}` : ''}

**IMPORTANT**: This group is based in **${groupContext.locationBase}**. When searching for venues or resolving locations, assume they mean places in or near ${groupContext.locationBase} unless they explicitly specify a different location.` : ''}

Start by understanding what the user wants, then use your tools to help them. Be friendly but efficient.`;

  messages.push({
    role: "user",
    content: prompt,
  });

  const toolsUsed: string[] = [];
  let fullResponse = "";
  let iterations = 0;
  const maxIterations = 10;

  try {
    while (iterations < maxIterations) {
      iterations++;

      // Use streaming for the final response
      const client = ensureAnthropicClient();
      const stream = client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools: agentTools as any,
        messages,
      });

      let currentToolUses: Anthropic.ToolUseBlock[] = [];
      let currentTextContent = "";
      let isToolUse = false;

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            isToolUse = true;
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            currentTextContent += event.delta.text;
            onChunk(event.delta.text);
          }
        }
      }

      const finalMessage = await stream.finalMessage();

      // Extract tool uses from final message
      currentToolUses = finalMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (currentToolUses.length > 0) {
        // Execute tools
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of currentToolUses) {
          toolsUsed.push(toolUse.name);
          console.log(`[AI Agent Stream] Executing tool: ${toolUse.name}`);

          const result = await executeAgentTool(
            toolUse.name,
            toolUse.input as Record<string, any>
          );

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        messages.push({
          role: "assistant",
          content: finalMessage.content,
        });

        messages.push({
          role: "user",
          content: toolResults,
        });

        // Continue the loop for more tool use or final response
      } else {
        // No tool use - this is the final response
        fullResponse = currentTextContent;
        messages.push({
          role: "assistant",
          content: finalMessage.content,
        });
        break;
      }

      if (finalMessage.stop_reason === "end_turn" && currentToolUses.length === 0) {
        fullResponse = currentTextContent;
        messages.push({
          role: "assistant",
          content: finalMessage.content,
        });
        break;
      }
    }

    sessionHistory.set(actualSessionId, messages);

    return {
      response: fullResponse,
      sessionId: actualSessionId,
      toolsUsed: [...new Set(toolsUsed)],
    };
  } catch (error: any) {
    console.error("[AI Agent Stream] Error:", error);
    throw new Error(error.message || "Failed to stream AI response");
  }
}

/**
 * Clear a session's conversation history
 */
export function clearSession(sessionId: string): void {
  sessionHistory.delete(sessionId);
}

/**
 * Get session info (for debugging)
 */
export function getSessionInfo(sessionId: string): {
  exists: boolean;
  messageCount: number;
} {
  const messages = sessionHistory.get(sessionId);
  return {
    exists: !!messages,
    messageCount: messages?.length || 0,
  };
}
