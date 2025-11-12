import { IStorage } from "./storage";

/**
 * Availability grid structure: 7 days x 3 time periods
 */
export interface AvailabilityGrid {
  Mon?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Tue?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Wed?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Thu?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Fri?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Sat?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
  Sun?: { morning?: boolean; afternoon?: boolean; evening?: boolean };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const TIME_PERIODS = ['morning', 'afternoon', 'evening'] as const;

/**
 * Aggregate member availability across all group members
 * Uses a preference fallback chain for each member:
 * 1. memberGroupPreferences.availabilityOverride (most specific)
 * 2. userProfiles.personalAvailability (user default)
 * 3. group.availability (organizer's group setting)
 *
 * @param groupId - The group ID
 * @param storage - Storage instance
 * @returns Aggregated availability grid (intersection of all members' availability)
 */
export async function aggregateMemberAvailability(
  groupId: string,
  storage: IStorage
): Promise<{ grid: AvailabilityGrid; memberCount: number; conflicts: string[] }> {
  const group = await storage.getGroup(groupId);
  if (!group) {
    throw new Error("Group not found");
  }

  const members = await storage.getGroupMembers(groupId);
  const availabilityGrids: AvailabilityGrid[] = [];
  const conflicts: string[] = [];

  // Collect availability for each member
  for (const member of members) {
    let availability: AvailabilityGrid | null = null;

    if (member.userId) {
      try {
        // Priority 1: Check for group-specific override
        const prefs = await storage.getMemberGroupPreferences(member.userId, groupId);
        if (prefs?.availabilityOverride && typeof prefs.availabilityOverride === 'object') {
          availability = prefs.availabilityOverride as AvailabilityGrid;
          console.log(`[Availability] Using group override for member ${member.userId}`);
        } else {
          // Priority 2: Fall back to user profile
          const profile = await storage.getUserProfile(member.userId);
          if (profile?.personalAvailability && typeof profile.personalAvailability === 'object') {
            availability = profile.personalAvailability as AvailabilityGrid;
            console.log(`[Availability] Using personal profile for member ${member.userId}`);
          }
        }
      } catch (error) {
        console.error(`[Availability] Error fetching preferences for member ${member.userId}:`, error);
      }
    }

    // Priority 3: Final fallback to group availability
    if (!availability && group.availability && typeof group.availability === 'object') {
      availability = group.availability as AvailabilityGrid;
      console.log(`[Availability] Using group default for member ${member.userId || member.id}`);
    }

    if (availability) {
      availabilityGrids.push(availability);
    }
  }

  // If no availability data found, use group availability as baseline
  if (availabilityGrids.length === 0 && group.availability) {
    availabilityGrids.push(group.availability as AvailabilityGrid);
  }

  // Find intersection of all grids (time slots where ALL members are available)
  const aggregatedGrid = intersectAvailabilityGrids(availabilityGrids);

  // Check for conflicts (times where no one is available)
  const hasAnyAvailability = DAYS.some(day =>
    TIME_PERIODS.some(period => aggregatedGrid[day]?.[period] === true)
  );

  if (!hasAnyAvailability && availabilityGrids.length > 1) {
    conflicts.push("No overlapping availability found across all members");
  }

  console.log(`[Availability] Aggregated ${availabilityGrids.length} member availability grids`);

  return {
    grid: aggregatedGrid,
    memberCount: availabilityGrids.length,
    conflicts,
  };
}

/**
 * Find intersection of multiple availability grids
 * A time slot is only available if ALL members are available
 *
 * @param grids - Array of availability grids
 * @returns Intersection grid (only slots where everyone is available)
 */
export function intersectAvailabilityGrids(grids: AvailabilityGrid[]): AvailabilityGrid {
  if (grids.length === 0) {
    return {};
  }

  if (grids.length === 1) {
    return grids[0];
  }

  const result: AvailabilityGrid = {};

  // For each day and time period, check if ALL grids have availability
  for (const day of DAYS) {
    result[day] = {};

    for (const period of TIME_PERIODS) {
      // Time slot is available only if ALL members are available
      const allAvailable = grids.every(grid => grid[day]?.[period] === true);
      result[day]![period] = allAvailable;
    }
  }

  return result;
}

/**
 * Convert availability grid to natural language for AI prompts
 * Includes information about member conflicts if present
 *
 * @param grid - Availability grid
 * @param conflicts - List of availability conflicts
 * @param memberCount - Number of members considered
 * @returns Human-readable availability description
 */
export function convertAvailabilityToText(
  grid: AvailabilityGrid,
  conflicts: string[] = [],
  memberCount: number = 1
): string {
  const availableSlots: string[] = [];
  const unavailableSlots: string[] = [];

  for (const day of DAYS) {
    const daySlots = grid[day];
    if (!daySlots) continue;

    const available: string[] = [];
    const unavailable: string[] = [];

    for (const period of TIME_PERIODS) {
      if (daySlots[period] === true) {
        available.push(period);
      } else if (daySlots[period] === false) {
        unavailable.push(period);
      }
    }

    if (available.length > 0) {
      availableSlots.push(`${day}: ${available.join(', ')}`);
    }
    if (unavailable.length === TIME_PERIODS.length) {
      unavailableSlots.push(day);
    }
  }

  let text = '';

  if (memberCount > 1) {
    text += `Availability for ${memberCount} members:\n`;
  }

  if (availableSlots.length > 0) {
    text += `Available: ${availableSlots.join('; ')}`;
  } else {
    text += 'No specific availability preferences set';
  }

  if (unavailableSlots.length > 0) {
    text += `\nUnavailable: ${unavailableSlots.join(', ')}`;
  }

  if (conflicts.length > 0) {
    text += `\n⚠️ Conflicts: ${conflicts.join('; ')}`;
  }

  return text;
}

/**
 * Infer time period from hour of day
 * Morning: 6am-12pm, Afternoon: 12pm-5pm, Evening: 5pm-midnight
 */
export function inferTimePeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 6 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * Calculate density score for each day (0-3 available slots)
 * Returns map of day -> number of available time periods
 */
export function calculateDayDensity(grid: AvailabilityGrid): Record<string, number> {
  const density: Record<string, number> = {};

  for (const day of DAYS) {
    const slots = grid[day];
    if (!slots) {
      density[day] = 0;
      continue;
    }

    let count = 0;
    if (slots.morning) count++;
    if (slots.afternoon) count++;
    if (slots.evening) count++;

    density[day] = count;
  }

  return density;
}

/**
 * Get list of days with at least one available slot
 */
export function getAvailableDays(grid: AvailabilityGrid): string[] {
  const availableDays: string[] = [];

  for (const day of DAYS) {
    const slots = grid[day];
    if (slots && (slots.morning || slots.afternoon || slots.evening)) {
      availableDays.push(day);
    }
  }

  return availableDays;
}

/**
 * Check if a specific day and time period is available
 */
export function isSlotAvailable(
  grid: AvailabilityGrid,
  day: string,
  period: 'morning' | 'afternoon' | 'evening'
): boolean {
  const slots = grid[day as keyof AvailabilityGrid];
  if (!slots) return false;
  return slots[period] === true;
}
