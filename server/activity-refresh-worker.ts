// Auto-refresh stale activity pools for groups with autoActivitiesEnabled
import { db } from './db';
import { groups, activities } from '../shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { storage } from './storage';

/**
 * Main worker function that checks all groups with auto-activities enabled
 * and refreshes their activity pools if they've become stale
 */
export async function refreshStaleActivityPools(): Promise<void> {
  try {
    console.log('[Activity Refresh] Starting stale activity pool check...');

    // Get all groups with auto-activities enabled
    const autoEnabledGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.autoActivitiesEnabled, true));

    console.log(`[Activity Refresh] Found ${autoEnabledGroups.length} group(s) with auto-activities enabled`);

    for (const group of autoEnabledGroups) {
      try {
        const isStale = await isActivityPoolStale(group.id, group);

        if (isStale.stale) {
          console.log(`[Activity Refresh] 🔄 Group "${group.name}" (${group.id}) has stale activities: ${isStale.reason}`);
          await refreshActivitiesForGroup(group.id);
        } else {
          console.log(`[Activity Refresh] ✅ Group "${group.name}" (${group.id}) has fresh activities`);
        }
      } catch (error) {
        console.error(`[Activity Refresh] Error processing group ${group.id}:`, error);
        // Continue with next group
      }
    }

    console.log('[Activity Refresh] Finished checking all groups');
  } catch (error) {
    console.error('[Activity Refresh] Error in refresh worker:', error);
  }
}

/**
 * Determines if a group's activity pool is stale and needs refreshing
 *
 * Staleness criteria:
 * 1. Any enabled category has < 3 activities
 * 2. Oldest activity is > 30 days old
 * 3. > 80% of activities have negative feedback
 */
async function isActivityPoolStale(
  groupId: string,
  group: any
): Promise<{ stale: boolean; reason: string }> {
  // Get all active (non-archived) activities for this group
  const activeActivities = await storage.getGroupActivities(groupId);

  // Check 1: If no activities exist, it's stale
  if (!activeActivities || activeActivities.length === 0) {
    return { stale: true, reason: 'No active activities' };
  }

  // Check 2: Count activities per category for enabled categories
  const enabledCategories = [];
  if (group.mealEnabled ?? true) enabledCategories.push('meal');
  if (group.cafeEnabled ?? true) enabledCategories.push('cafes');
  if (group.drinksEnabled ?? true) enabledCategories.push('drinks');
  if (group.dessertEnabled ?? true) enabledCategories.push('dessert');
  if (group.experiencesEnabled ?? true) enabledCategories.push('experiences');

  const categoryCounts: Record<string, number> = {
    meal: 0,
    cafes: 0,
    drinks: 0,
    dessert: 0,
    experiences: 0,
  };

  for (const activity of activeActivities) {
    if (activity.category) {
      categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
    }
  }

  // Check if any enabled category has < 3 activities
  for (const category of enabledCategories) {
    if (categoryCounts[category] < 3) {
      return {
        stale: true,
        reason: `Category "${category}" has only ${categoryCounts[category]} activities (need 3+)`,
      };
    }
  }

  // Check 3: Check age of oldest activity (> 30 days = stale)
  const oldestActivity = activeActivities.reduce((oldest, current) => {
    const oldestDate = new Date(oldest.createdAt);
    const currentDate = new Date(current.createdAt);
    return currentDate < oldestDate ? current : oldest;
  }, activeActivities[0]);

  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(oldestActivity.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCreation > 30) {
    return {
      stale: true,
      reason: `Activities are ${daysSinceCreation} days old (threshold: 30 days)`,
    };
  }

  // Check 4: Check if > 80% have negative feedback
  const negativeFeedbackTypes = ['downvote', 'not_this', 'pass', 'less'];
  const activitiesWithFeedback = activeActivities.filter(a => a.feedback);
  const negativeCount = activitiesWithFeedback.filter(a =>
    negativeFeedbackTypes.includes(a.feedback || '')
  ).length;

  if (activitiesWithFeedback.length > 0) {
    const negativePercentage = (negativeCount / activitiesWithFeedback.length) * 100;
    if (negativePercentage > 80) {
      return {
        stale: true,
        reason: `${negativePercentage.toFixed(0)}% of activities have negative feedback (threshold: 80%)`,
      };
    }
  }

  // Activities are fresh
  return { stale: false, reason: 'Activities are fresh' };
}

/**
 * Triggers activity regeneration for a group
 * Reuses the same generation logic as the manual refresh endpoint
 */
async function refreshActivitiesForGroup(groupId: string): Promise<void> {
  try {
    console.log(`[Activity Refresh] Refreshing activities for group ${groupId}...`);

    // Get fresh group data
    const group = await storage.getGroup(groupId);
    if (!group) {
      console.error(`[Activity Refresh] Group ${groupId} not found`);
      return;
    }

    // Import and call the shared generation function
    const { generateAndStoreActivities } = await import('./routes');

    await generateAndStoreActivities(groupId, {
      locationBase: group.locationBase,
      latitude: group.latitude,
      longitude: group.longitude,
      budgetMin: group.budgetMin,
      budgetMax: group.budgetMax,
      meetingFrequency: group.meetingFrequency,
      availability: group.availability,
      closenessLevel: group.closenessLevel,
      noveltyPreference: group.noveltyPreference,
      activityCategories: group.activityCategories,
      pastPreferences: group.pastPreferences,
      additionalInstructions: group.additionalInstructions,
      searchRadius: group.searchRadius,
      mealEnabled: group.mealEnabled ?? true,
      cafeEnabled: group.cafeEnabled ?? true,
      drinksEnabled: group.drinksEnabled ?? true,
      dessertEnabled: group.dessertEnabled ?? true,
      experiencesEnabled: group.experiencesEnabled ?? true,
      rejectedVenues: group.rejectedVenues || [],
    });

    console.log(`[Activity Refresh] ✅ Successfully refreshed activities for group "${group.name}" (${groupId})`);
  } catch (error) {
    console.error(`[Activity Refresh] Error refreshing group ${groupId}:`, error);
    throw error;
  }
}
