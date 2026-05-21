/**
 * Notification Routes
 *
 * Handles all /api/notifications/* endpoints.
 *
 * Migrated from server/routes.ts (lines 16520–16590)
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { getUserId } from "../authorization";
import { fail } from "../lib/responses";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../notifications";

const router = Router();

// List notifications (with optional limit/offset/unreadOnly filters)
router.get("/notifications", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { limit, offset, unreadOnly } = req.query;

    const notifications = await getUserNotifications(userId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      unreadOnly: unreadOnly === "true",
    });

    res.json(notifications);
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    fail(res, 500, safeError(error));
  }
});

// Get unread notification count
router.get("/notifications/unread-count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    fail(res, 500, safeError(error));
  }
});

// Mark a single notification as read
router.post("/notifications/:id/mark-read", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    await markAsRead(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    fail(res, 500, safeError(error));
  }
});

// Mark all notifications as read
router.post("/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    await markAllAsRead(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    fail(res, 500, safeError(error));
  }
});

// Delete a notification
router.delete("/notifications/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    await deleteNotification(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    fail(res, 500, safeError(error));
  }
});

export default router;
