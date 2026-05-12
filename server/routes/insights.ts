/**
 * Insights Routes
 *
 * Learning insights, confidence weights, calibration, rejected venues,
 * and group-level preference insights.
 *
 *   GET    /groups/:groupId/learning-insights       — get learning insights
 *   GET    /groups/:groupId/confidence-weights      — get confidence weights
 *   POST   /groups/:groupId/calibrate               — trigger calibration
 *   DELETE /groups/:groupId/rejected-venues          — remove venue from blacklist
 *   GET    /groups/:groupId/insights                 — get group insights
 *   POST   /groups/:groupId/insights/dismiss         — dismiss an insight
 *   PATCH  /groups/:groupId/insights/:insightType    — edit an insight suggestion
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { groups as groupsTable } from "@shared/schema";
import { generateGroupInsights, saveGroupInsights, dismissInsight, editInsightSuggestion } from "../group-insights";
import { analyzeGroupTimePatterns } from "../availability-analyzer";

const router = Router();

// Get learning insights for a group (what the system has learned)
router.get("/groups/:groupId/learning-insights", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    // Verify user has access to the group
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is group owner or member
    const isOwner = group.userId === userId;
    const members = await storage.getGroupMembers(groupId);
    const isMember = members.some(m => m.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Not authorized to view this group's insights" });
    }

    // Get rejected venues (auto-blacklisted)
    const rejectedVenues = group.rejectedVenues || [];

    // Get member constraints (auto-learned preferences)
    const memberConstraints = await Promise.all(
      members.map(async (member) => {
        const constraints = member.memberConstraints as any;
        return {
          memberId: member.id,
          memberName: member.name,
          budgetConcern: constraints?.budgetConcern || false,
          distanceConcern: constraints?.distanceConcern || false,
          scheduleConflicts: constraints?.scheduleConflicts || [],
          notes: constraints?.notes || null,
        };
      })
    );

    // Calculate engagement scores for all members
    const { calculateGroupEngagement } = await import('../member-learning');
    const engagementScores = await calculateGroupEngagement(groupId);

    // Get frequency adjustment info
    const frequencyFeedback = await storage.getGroupFrequencyFeedback(groupId);
    const moreOften = frequencyFeedback.filter(f => f.feedback === 'more_often').length;
    const lessOften = frequencyFeedback.filter(f => f.feedback === 'less_often').length;
    const justRight = frequencyFeedback.filter(f => f.feedback === 'just_right').length;

    res.json({
      groupId,
      groupName: group.name,
      learningInsights: {
        // Venue learning
        rejectedVenues: {
          count: rejectedVenues.length,
          venues: rejectedVenues,
          description: "Venues that have been auto-blacklisted due to low ratings or negative feedback",
        },

        // Member constraints learning
        memberConstraints: {
          count: memberConstraints.filter(m => m.budgetConcern || m.distanceConcern || m.scheduleConflicts.length > 0).length,
          constraints: memberConstraints.filter(m => m.budgetConcern || m.distanceConcern || m.scheduleConflicts.length > 0),
          description: "Member preferences auto-learned from RSVP patterns",
        },

        // Engagement tracking
        engagement: {
          totalMembers: members.length,
          active: engagementScores.filter(e => e.status === 'active').length,
          atRisk: engagementScores.filter(e => e.status === 'at-risk').length,
          inactive: engagementScores.filter(e => e.status === 'inactive').length,
          scores: engagementScores,
          description: "Member engagement based on RSVP response rates and attendance",
        },

        // Frequency learning
        frequency: {
          current: group.meetingFrequency || 'monthly',
          feedbackCount: frequencyFeedback.length,
          moreOften,
          lessOften,
          justRight,
          description: "Meeting frequency auto-adjusted based on member feedback",
        },
      },
    });
  } catch (error: any) {
    console.error('[Learning Insights] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get confidence weights and calibration status for a group
router.get("/groups/:groupId/confidence-weights", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user is a member
    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    // Get weights
    const { groupConfidenceWeights, confidencePredictions } = await import('../../shared/schema');
    const { isNotNull } = await import('drizzle-orm');

    const [weights] = await db
      .select()
      .from(groupConfidenceWeights)
      .where(eq(groupConfidenceWeights.groupId, groupId))
      .limit(1);

    if (!weights) {
      return res.status(404).json({ message: "No calibration data found for this group" });
    }

    // Get prediction statistics
    const [stats] = await db
      .select({
        totalPredictions: sql<number>`count(*)::int`,
        validatedPredictions: sql<number>`count(CASE WHEN ${confidencePredictions.actualConsensus} IS NOT NULL THEN 1 END)::int`,
        unusedPredictions: sql<number>`count(CASE WHEN ${confidencePredictions.usedForCalibration} = false AND ${confidencePredictions.actualConsensus} IS NOT NULL THEN 1 END)::int`,
        averageError: sql<number>`avg(${confidencePredictions.predictionError})`,
      })
      .from(confidencePredictions)
      .where(eq(confidencePredictions.groupId, groupId));

    res.json({
      weights: {
        venueQuality: weights.venueQualityWeight,
        timeConsensus: weights.timeConsensusWeight,
        groupEngagement: weights.groupEngagementWeight,
        patternMatch: weights.patternMatchWeight,
        swipeConsensus: weights.swipeConsensusWeight,
      },
      calibration: {
        count: weights.calibrationCount,
        lastCalibrationAt: weights.lastCalibrationAt,
        totalPredictions: weights.totalPredictions,
        meanAbsoluteError: weights.meanAbsoluteError,
        accuracyRate: weights.accuracyRate,
        autoCalibrationEnabled: weights.autoCalibrationEnabled,
      },
      predictions: {
        total: stats?.totalPredictions || 0,
        validated: stats?.validatedPredictions || 0,
        unused: stats?.unusedPredictions || 0,
        averageError: stats?.averageError ? Math.round(stats.averageError * 100) / 100 : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching confidence weights:', error);
    res.status(500).json({ message: error.message });
  }
});

// Manually trigger calibration for a group (admin/organizer only)
router.post("/groups/:groupId/calibrate", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user is the group organizer
    const group = await storage.getGroup(groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only the organizer can trigger calibration" });
    }

    // Run calibration
    const { calibrateGroupWeights, shouldTriggerCalibration } = await import('../confidence-calibration');

    // Check if enough data
    if (!(await shouldTriggerCalibration(groupId))) {
      return res.status(400).json({
        message: "Not enough validated predictions for calibration (need 50+)",
      });
    }

    const result = await calibrateGroupWeights(groupId);

    if (!result) {
      return res.status(400).json({ message: "Calibration failed - insufficient data" });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error running calibration:', error);
    res.status(500).json({ message: error.message });
  }
});

// Remove a venue from the blacklist
router.delete("/groups/:groupId/rejected-venues", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;
    const { venueName } = req.body;

    if (!venueName) {
      return res.status(400).json({ message: "Venue name is required" });
    }

    // Verify user is the group owner
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only the group owner can remove venues from the blacklist" });
    }

    // Remove the venue from the rejectedVenues array
    const currentRejected = group.rejectedVenues || [];
    const updatedRejected = currentRejected.filter(v => v !== venueName);

    // Update the group
    await db
      .update(groupsTable)
      .set({ rejectedVenues: updatedRejected })
      .where(eq(groupsTable.id, groupId));

    res.json({
      message: "Venue removed from blacklist",
      rejectedVenues: updatedRejected
    });
  } catch (error: any) {
    console.error('[Remove Rejected Venue] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate and retrieve group-level insights (budget, availability, activity types)
router.get("/groups/:groupId/insights", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;
    const { regenerate } = req.query; // ?regenerate=true to force regeneration

    // Verify user has access to the group
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is group owner or member
    const isOwner = group.userId === userId;
    const members = await storage.getGroupMembers(groupId);
    const isMember = members.some(m => m.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Not authorized to view this group's insights" });
    }

    // Check if we need to regenerate insights
    const shouldRegenerate = regenerate === 'true' ||
      !group.preferenceInsights ||
      !group.lastInsightsUpdate ||
      (new Date().getTime() - new Date(group.lastInsightsUpdate).getTime()) > 7 * 24 * 60 * 60 * 1000; // 7 days

    let insights;
    if (shouldRegenerate) {
      console.log(`[Insights] Generating insights for group ${groupId}`);
      insights = await generateGroupInsights(groupId);
      await saveGroupInsights(groupId, insights);
    } else {
      insights = group.preferenceInsights;
    }

    // Also get time patterns from availability analyzer
    let timePatterns = null;
    try {
      timePatterns = await analyzeGroupTimePatterns(groupId);
    } catch (err) {
      console.error('[Group Insights] Error getting time patterns:', err);
    }

    res.json({
      groupId,
      insights,
      timePatterns,
    });
  } catch (error: any) {
    console.error('[Group Insights] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Dismiss a specific insight
router.post("/groups/:groupId/insights/dismiss", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;
    const { insightType } = req.body; // 'budget', 'availability', 'activityTypes'

    // Verify user is group owner
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only group owners can dismiss insights" });
    }

    if (!['budget', 'availability', 'activityTypes'].includes(insightType)) {
      return res.status(400).json({ message: "Invalid insight type" });
    }

    await dismissInsight(groupId, insightType as 'budget' | 'availability' | 'activityTypes');

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Dismiss Insight] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Edit an insight suggestion
router.patch("/groups/:groupId/insights/:insightType", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId, insightType } = req.params;
    const { suggestion } = req.body;

    // Verify user is group owner
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only group owners can edit insights" });
    }

    if (!['budget', 'availability', 'activityTypes'].includes(insightType)) {
      return res.status(400).json({ message: "Invalid insight type" });
    }

    await editInsightSuggestion(groupId, insightType as 'budget' | 'availability' | 'activityTypes', suggestion);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Edit Insight] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
