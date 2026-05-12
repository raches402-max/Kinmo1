/**
 * Notification Routes
 *
 * Handles all /api/notifications/* endpoints.
 *
 * Migrated from server/routes.ts (lines 16520–16590)
 */

import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { getUserId } from "../authorization";
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
});

export default router;
