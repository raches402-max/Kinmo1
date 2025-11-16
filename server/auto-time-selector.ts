/**
 * Auto-Time Selection
 * Automatically selects the best time slot based on member votes
 */

import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { proposedTimeSlots, timeSlotVotes, itineraries } from '../shared/schema';

export interface TimeSlotScore {
  timeSlotId: string;
  proposedDateTime: Date;
  label: string | null;
  yesVotes: number;
  maybeVotes: number;
  noVotes: number;
  totalVotes: number;
  score: number; // Weighted score: yes=3, maybe=1, no=-1
}

export interface TimeSelectionResult {
  success: boolean;
  selectedTimeSlot?: TimeSlotScore;
  allScores?: TimeSlotScore[];
  error?: string;
}

/**
 * Select the best time slot for an itinerary based on member votes
 *
 * Scoring:
 * - Yes vote: +3 points
 * - Maybe vote: +1 point
 * - No vote: -1 point
 *
 * The time slot with the highest score wins.
 * In case of a tie, the earlier time slot is selected.
 *
 * @param itineraryId - ID of the itinerary
 * @returns TimeSelectionResult with selected time slot or error
 */
export async function selectBestTimeSlot(itineraryId: string): Promise<TimeSelectionResult> {
  try {
    console.log(`[Time Selector] Selecting best time slot for itinerary ${itineraryId}`);

    // Get all proposed time slots for this itinerary
    const timeSlots = await db
      .select()
      .from(proposedTimeSlots)
      .where(eq(proposedTimeSlots.itineraryId, itineraryId));

    if (timeSlots.length === 0) {
      return {
        success: false,
        error: 'No time slots found for this itinerary',
      };
    }

    console.log(`[Time Selector] Found ${timeSlots.length} time slot(s)`);

    // If only one time slot, auto-select it
    if (timeSlots.length === 1) {
      const slot = timeSlots[0];
      await markTimeSlotAsSelected(itineraryId, slot.id, slot.proposedDateTime);

      return {
        success: true,
        selectedTimeSlot: {
          timeSlotId: slot.id,
          proposedDateTime: slot.proposedDateTime,
          label: slot.label,
          yesVotes: 0,
          maybeVotes: 0,
          noVotes: 0,
          totalVotes: 0,
          score: 0,
        },
      };
    }

    // Get votes for all time slots
    const allVotes = await db
      .select()
      .from(timeSlotVotes)
      .where(
        eq(timeSlotVotes.timeSlotId, timeSlots[0].id) // Will expand this in the loop
      );

    // Calculate scores for each time slot
    const scores: TimeSlotScore[] = [];

    for (const slot of timeSlots) {
      // Get votes for this specific time slot
      const slotVotes = await db
        .select()
        .from(timeSlotVotes)
        .where(eq(timeSlotVotes.timeSlotId, slot.id));

      // Count vote types
      const yesVotes = slotVotes.filter((v: any) => v.voteType === 'yes').length;
      const maybeVotes = slotVotes.filter((v: any) => v.voteType === 'maybe').length;
      const noVotes = slotVotes.filter((v: any) => v.voteType === 'no').length;

      // Calculate weighted score: yes=3, maybe=1, no=-1
      const score = (yesVotes * 3) + (maybeVotes * 1) + (noVotes * -1);

      scores.push({
        timeSlotId: slot.id,
        proposedDateTime: slot.proposedDateTime,
        label: slot.label,
        yesVotes,
        maybeVotes,
        noVotes,
        totalVotes: slotVotes.length,
        score,
      });
    }

    // Sort by score (highest first), then by date (earliest first for ties)
    scores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.proposedDateTime.getTime() - b.proposedDateTime.getTime();
    });

    const winner = scores[0];

    console.log(`[Time Selector] Winner: ${winner.label || winner.proposedDateTime.toISOString()}`);
    console.log(`[Time Selector] Score: ${winner.score} (${winner.yesVotes} yes, ${winner.maybeVotes} maybe, ${winner.noVotes} no)`);

    // Mark the winning time slot as selected and update itinerary
    await markTimeSlotAsSelected(itineraryId, winner.timeSlotId, winner.proposedDateTime);

    return {
      success: true,
      selectedTimeSlot: winner,
      allScores: scores,
    };
  } catch (error: any) {
    console.error('[Time Selector] Error selecting best time slot:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Mark a time slot as selected and update the itinerary's event date
 *
 * @param itineraryId - ID of the itinerary
 * @param timeSlotId - ID of the selected time slot
 * @param proposedDateTime - The selected date/time
 */
async function markTimeSlotAsSelected(
  itineraryId: string,
  timeSlotId: string,
  proposedDateTime: Date
): Promise<void> {
  // Unmark all time slots for this itinerary
  await db
    .update(proposedTimeSlots)
    .set({ isSelected: false })
    .where(eq(proposedTimeSlots.itineraryId, itineraryId));

  // Mark the winning time slot as selected
  await db
    .update(proposedTimeSlots)
    .set({ isSelected: true })
    .where(eq(proposedTimeSlots.id, timeSlotId));

  // Update the itinerary's event date
  await db
    .update(itineraries)
    .set({ eventDate: proposedDateTime })
    .where(eq(itineraries.id, itineraryId));

  console.log(`[Time Selector] ✅ Marked time slot ${timeSlotId} as selected and updated itinerary event date`);
}

/**
 * Check if an itinerary needs time slot selection
 * Returns true if:
 * - Itinerary has multiple proposed time slots
 * - None are currently selected
 * - Event date is within 24-48 hours
 *
 * @param itineraryId - ID of the itinerary
 * @returns true if time selection is needed
 */
export async function needsTimeSelection(itineraryId: string): Promise<boolean> {
  try {
    // Get the itinerary
    const [itinerary] = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.id, itineraryId))
      .limit(1);

    if (!itinerary || !itinerary.eventDate) {
      return false;
    }

    // Check if event is within 24-48 hours
    const now = new Date();
    const eventDate = new Date(itinerary.eventDate);
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Only trigger selection 24-48 hours before event
    if (hoursUntilEvent > 48 || hoursUntilEvent < 0) {
      return false;
    }

    // Get time slots
    const timeSlots = await db
      .select()
      .from(proposedTimeSlots)
      .where(eq(proposedTimeSlots.itineraryId, itineraryId));

    // Need selection if we have multiple slots and none are selected
    if (timeSlots.length <= 1) {
      return false;
    }

    const hasSelectedSlot = timeSlots.some((slot: any) => slot.isSelected);
    return !hasSelectedSlot;
  } catch (error) {
    console.error('[Time Selector] Error checking if time selection needed:', error);
    return false;
  }
}
