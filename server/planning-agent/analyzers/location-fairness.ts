/**
 * Location Fairness Analyzer
 *
 * Detects when meeting locations consistently favor some members over others.
 * E.g., "You've met in SF 5 times in a row. Sarah lives in Oakland - consider meeting there?"
 */

import { db } from '../../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { activities, members, venueVisitHistory } from '../../../shared/schema';
import {
  Analyzer,
  RawInsight,
  LocationFairnessAnalysis,
  MemberLocationData,
  DEFAULT_CONFIG,
} from '../types';

// Helper to calculate distance between two points (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to extract neighborhood/area from venue address
function extractArea(address: string): string {
  // Try to extract the city/neighborhood from the address
  // Format is typically: "123 Main St, Neighborhood, City, State ZIP"
  const parts = address.split(',').map((p) => p.trim());

  if (parts.length >= 3) {
    // Return the city (usually 2nd to last before state/zip)
    return parts[parts.length - 3] || parts[1] || parts[0];
  } else if (parts.length === 2) {
    return parts[0]; // Just return first part
  }

  return address.substring(0, 30); // Fallback
}

export class LocationFairnessAnalyzer implements Analyzer {
  name = 'LocationFairnessAnalyzer';
  insightType = 'location_fairness' as const;

  async analyze(groupId: string): Promise<RawInsight[]> {
    const insights: RawInsight[] = [];

    try {
      // Get recent venue visits for this group (last 90 days)
      // Join with activities to get venue location data
      const recentVisits = await db
        .select({
          venueName: venueVisitHistory.venueName,
          venueAddress: activities.venueAddress,
          venueLatitude: activities.latitude,
          venueLongitude: activities.longitude,
          visitedAt: venueVisitHistory.visitedAt,
        })
        .from(venueVisitHistory)
        .leftJoin(activities, eq(venueVisitHistory.activityId, activities.id))
        .where(
          and(
            eq(venueVisitHistory.groupId, groupId),
            sql`${venueVisitHistory.visitedAt} > NOW() - INTERVAL '90 days'`
          )
        )
        .orderBy(desc(venueVisitHistory.visitedAt))
        .limit(20);

      if (recentVisits.length < DEFAULT_CONFIG.minEventsForAnalysis) {
        // Not enough data to analyze
        return insights;
      }

      // Get members with home locations
      const groupMembers = await db
        .select({
          id: members.id,
          name: members.name,
          homeBaseLatitude: members.homeBaseLatitude,
          homeBaseLongitude: members.homeBaseLongitude,
          memberLocation: members.memberLocation,
        })
        .from(members)
        .where(eq(members.groupId, groupId));

      // Count venues by area
      const areaCounts: Record<string, number> = {};
      const recentAreas: string[] = [];

      for (const visit of recentVisits) {
        if (visit.venueAddress) {
          const area = extractArea(visit.venueAddress);
          areaCounts[area] = (areaCounts[area] || 0) + 1;
          if (recentAreas.length < 5) {
            recentAreas.push(area);
          }
        }
      }

      // Check for dominant area (>60% of visits)
      const areaCountValues = Object.values(areaCounts);
      const totalVisits = areaCountValues.length > 0
        ? areaCountValues.reduce((a, b) => a + b, 0)
        : 0;

      if (totalVisits === 0) {
        // No visits with address data
        return insights;
      }

      let dominantArea: string | undefined;
      let dominantCount = 0;

      for (const [area, count] of Object.entries(areaCounts)) {
        if (count / totalVisits > DEFAULT_CONFIG.locationDominanceThreshold) {
          dominantArea = area;
          dominantCount = count;
          break;
        }
      }

      // Calculate average distance for each member
      const memberDistances: MemberLocationData[] = [];

      for (const member of groupMembers) {
        if (member.homeBaseLatitude && member.homeBaseLongitude) {
          const memberLat = parseFloat(member.homeBaseLatitude);
          const memberLon = parseFloat(member.homeBaseLongitude);

          let totalDistance = 0;
          let venueCount = 0;

          for (const visit of recentVisits) {
            if (visit.venueLatitude && visit.venueLongitude) {
              const venueLat = parseFloat(visit.venueLatitude);
              const venueLon = parseFloat(visit.venueLongitude);
              totalDistance += calculateDistance(memberLat, memberLon, venueLat, venueLon);
              venueCount++;
            }
          }

          if (venueCount > 0) {
            memberDistances.push({
              memberId: member.id,
              memberName: member.name || 'Unknown',
              homeLocation: member.memberLocation
                ? {
                    name: member.memberLocation,
                    latitude: memberLat,
                    longitude: memberLon,
                  }
                : undefined,
              averageDistanceToVenues: totalDistance / venueCount,
              totalEventsWithLocation: venueCount,
            });
          }
        }
      }

      // Find the member traveling furthest compared to others
      if (memberDistances.length >= 2) {
        // Sort by distance (furthest first)
        memberDistances.sort((a, b) => b.averageDistanceToVenues - a.averageDistanceToVenues);

        const furthestMember = memberDistances[0];
        const closestMember = memberDistances[memberDistances.length - 1];
        const distanceDifference =
          furthestMember.averageDistanceToVenues - closestMember.averageDistanceToVenues;

        // If there's significant unfairness (>5 miles difference)
        if (distanceDifference > DEFAULT_CONFIG.distanceUnfairnessThreshold) {
          const analysis: LocationFairnessAnalysis = {
            locationCounts: areaCounts,
            recentLocations: recentAreas,
            memberDistances,
            dominantArea,
            underservedMember: {
              memberId: furthestMember.memberId,
              memberName: furthestMember.memberName,
              averageDistance: furthestMember.averageDistanceToVenues,
              nearbyArea: furthestMember.homeLocation?.name || 'their area',
            },
            suggestedArea: furthestMember.homeLocation?.name,
          };

          insights.push({
            type: 'location_fairness',
            severity: 'suggestion',
            audienceType: 'organizer',
            groupId,
            metadata: analysis,
            suggestedAction: {
              type: 'suggest_venue',
              params: {
                nearArea: furthestMember.homeLocation?.name,
                nearLatitude: furthestMember.homeLocation?.latitude,
                nearLongitude: furthestMember.homeLocation?.longitude,
              },
            },
            deduplicationKey: `location_fairness_${groupId}_${furthestMember.memberId}`,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
          });
        }
      }

      // Also flag if we've been going to the same area too much
      if (dominantArea && dominantCount >= 4) {
        // Check if there's a member in a different area
        const membersNotInDominantArea = memberDistances.filter(
          (m) =>
            m.homeLocation?.name &&
            !m.homeLocation.name.toLowerCase().includes(dominantArea!.toLowerCase())
        );

        if (membersNotInDominantArea.length > 0) {
          const suggestedMember = membersNotInDominantArea[0];

          const analysis: LocationFairnessAnalysis = {
            locationCounts: areaCounts,
            recentLocations: recentAreas,
            memberDistances,
            dominantArea,
            suggestedArea: suggestedMember.homeLocation?.name,
          };

          insights.push({
            type: 'location_fairness',
            severity: 'info',
            audienceType: 'organizer',
            groupId,
            metadata: {
              ...analysis,
              reason: 'repeated_area',
              dominantAreaCount: dominantCount,
            },
            suggestedAction: {
              type: 'suggest_venue',
              params: {
                nearArea: suggestedMember.homeLocation?.name,
              },
            },
            deduplicationKey: `location_repeated_${groupId}_${dominantArea}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
          });
        }
      }

      return insights;
    } catch (error) {
      console.error(`[LocationFairnessAnalyzer] Error analyzing group ${groupId}:`, error);
      throw error;
    }
  }
}
