/**
 * Auto-Approval Logic for Auto-Scheduled Events
 * Handles both manual organizer selection and automatic high-confidence approvals
 */

import { storage } from './storage';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { autoScheduledEvents } from '../shared/schema';

export interface ApprovalResult {
  success: boolean;
  itinerary?: any;
  error?: string;
}

/**
 * Approve an auto-scheduled event option and create the itinerary
 * Used by both manual selection endpoint and auto-approval job
 *
 * @param eventId - ID of the auto-scheduled event
 * @param optionId - ID of the option to approve (if null, selects top-voted or Option 1)
 * @param source - 'manual' or 'auto' (for logging/status tracking)
 * @returns ApprovalResult with itinerary or error
 */
export async function approveAndCreateItinerary(
  eventId: string,
  optionId: string | null,
  source: 'manual' | 'auto' = 'manual'
): Promise<ApprovalResult> {
  try {
    // Get the auto event
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Get the group
    const group = await storage.getGroup(event.groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    // If no optionId provided, determine the best option
    let selectedOptionId = optionId;
    if (!selectedOptionId) {
      selectedOptionId = await determineTopOption(eventId);
      if (!selectedOptionId) {
        return { success: false, error: 'No options available' };
      }
    }

    // Verify option exists and belongs to this event
    const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');
    const [option] = await db
      .select()
      .from(itineraryOptionsTable)
      .where(eq(itineraryOptionsTable.id, selectedOptionId));

    if (!option || option.autoEventId !== eventId) {
      return { success: false, error: 'Invalid option' };
    }

    // Update the auto event with the selected option
    await db
      .update(autoScheduledEvents)
      .set({
        selectedOptionId,
        status: source === 'auto' ? 'auto_approved' : 'approved',
      })
      .where(eq(autoScheduledEvents.id, eventId));

    // Extract venue information from the selected option
    const venues = option.venues as Array<{
      sourceType: 'activity' | 'voting_event';
      sourceId: string;
      venueName: string;
      badges: string[];
    }>;

    // Prepare venues for itinerary creation
    const venueItems = venues.map(v => ({
      sourceType: v.sourceType,
      sourceId: v.sourceId,
    }));

    // Create itinerary with venues
    const itinerary = await storage.createItinerary(
      {
        groupId: event.groupId,
        name: `Auto-scheduled event for ${group.name}`,
        eventDate: event.proposedDate,
        status: 'proposed',
        proposedOrder: [],
      },
      group.userId!,
      venueItems
    );

    // Update the event with the itinerary ID
    await db
      .update(autoScheduledEvents)
      .set({ itineraryId: itinerary.id })
      .where(eq(autoScheduledEvents.id, eventId));

    console.log(`[Auto-Approval] ${source === 'auto' ? '🤖 AUTO' : '👤 MANUAL'} approval for event ${eventId}:`, {
      optionNumber: option.optionNumber,
      venues: venues.map(v => v.venueName).join(' → '),
      confidence: event.confidenceScore,
    });

    return {
      success: true,
      itinerary,
    };
  } catch (error: any) {
    console.error(`[Auto-Approval] Error approving event ${eventId}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Determine the top option based on votes, or fallback to Option 1
 *
 * @param eventId - ID of the auto-scheduled event
 * @returns Option ID to select, or null if none available
 */
async function determineTopOption(eventId: string): Promise<string | null> {
  try {
    const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import('../shared/schema');

    // Get all options for this event
    const options = await db
      .select()
      .from(itineraryOptionsTable)
      .where(eq(itineraryOptionsTable.autoEventId, eventId))
      .orderBy(itineraryOptionsTable.optionNumber);

    if (options.length === 0) {
      return null;
    }

    // Get vote counts for each option
    const optionsWithVotes = await Promise.all(
      options.map(async (option: any) => {
        const votes = await db
          .select()
          .from(itineraryOptionVotes)
          .where(eq(itineraryOptionVotes.optionId, option.id));

        return {
          ...option,
          voteCount: votes.length,
        };
      })
    );

    // Sort by vote count (highest first), then by option number (lowest first)
    optionsWithVotes.sort((a: any, b: any) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return a.optionNumber - b.optionNumber;
    });

    // Return top-voted option (or Option 1 if no votes)
    return optionsWithVotes[0].id;
  } catch (error) {
    console.error('[Auto-Approval] Error determining top option:', error);
    return null;
  }
}
