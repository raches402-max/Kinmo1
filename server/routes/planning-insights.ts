/**
 * Planning Insights Routes
 *
 * Planning agent insights: get, dismiss, mark acted, and trigger analysis.
 *
 *   GET    /groups/:id/planning-insights            — get planning insights
 *   POST   /planning-insights/:id/dismiss           — dismiss an insight
 *   POST   /planning-insights/:id/acted             — mark insight as acted upon
 *   POST   /groups/:id/analyze                      — trigger planning agent analysis
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { fail } from "../lib/responses";

const router = Router();

router.get("/groups/:id/planning-insights", isAuthenticated, async (req: any, res) => {
  try {
    const groupId = req.params.id;
    const userId = await getUserId(req);

    const group = await storage.getGroup(groupId);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    const members = await storage.getGroupMembers(groupId);
    const isMember = group.userId === userId || members.some(m => m.userId === userId);
    if (!isMember) {
      return fail(res, 403, "Access denied");
    }

    const { getGroupInsights } = await import('../planning-agent');
    const insights = await getGroupInsights(groupId, userId);

    res.json(insights);
  } catch (error: any) {
    console.error("Error fetching planning insights:", error);
    fail(res, 500, safeError(error));
  }
});

router.post("/planning-insights/:id/dismiss", isAuthenticated, async (req: any, res) => {
  try {
    const insightId = req.params.id;
    const userId = await getUserId(req);

    const { dismissInsight } = await import('../planning-agent');
    await dismissInsight(insightId, userId);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error dismissing insight:", error);
    fail(res, 500, safeError(error));
  }
});

router.post("/planning-insights/:id/acted", isAuthenticated, async (req: any, res) => {
  try {
    const insightId = req.params.id;
    const { actionStatus, actionDetails } = req.body;

    const { markInsightActed } = await import('../planning-agent');
    await markInsightActed(insightId, actionStatus || 'user_acted', actionDetails);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking insight as acted:", error);
    fail(res, 500, safeError(error));
  }
});

router.post("/groups/:id/analyze", isAuthenticated, async (req: any, res) => {
  try {
    const groupId = req.params.id;
    const userId = await getUserId(req);

    const group = await storage.getGroup(groupId);
    if (!group || group.userId !== userId) {
      return fail(res, 403, "Only group owner can trigger analysis");
    }

    const { analyzeGroup } = await import('../planning-agent');
    const insightCount = await analyzeGroup(groupId);

    res.json({
      success: true,
      insightsGenerated: insightCount,
      message: insightCount > 0
        ? `Generated ${insightCount} new insight(s)`
        : 'No new insights to report'
    });
  } catch (error: any) {
    console.error("Error running planning agent:", error);
    fail(res, 500, safeError(error));
  }
});

export default router;
