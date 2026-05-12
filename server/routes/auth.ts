/**
 * Auth Routes
 *
 * Handles authenticated user session state.
 * Google OAuth setup (login/callback/logout) lives in ../googleAuth.ts (setupAuth).
 *
 * Routes:
 *   GET  /api/auth/user  — returns the currently authenticated user
 */

import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { getUserId } from "../authorization";
import { storage } from "../storage";

const router = Router();

// GET /api/auth/user
// Returns the currently authenticated user from the session.
router.get("/user", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    if (!userId) {
      console.error("[Auth] No user ID found in claims:", req.user);
      return res.status(401).json({ message: "Invalid session - no user ID in claims" });
    }

    const user = await storage.getUser(userId);

    if (!user) {
      console.error(`[Auth] User not found in database: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("[Auth] Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
