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
import { getUserId, isAdminEmail } from "../authorization";
import { storage } from "../storage";
import { fail } from "../lib/responses";

const router = Router();

// GET /api/auth/user
// Returns the currently authenticated user from the session.
router.get("/user", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    if (!userId) {
      console.error("[Auth] No user ID found in claims:", req.user);
      return fail(res, 401, "Invalid session - no user ID in claims");
    }

    const user = await storage.getUser(userId);

    if (!user) {
      console.error(`[Auth] User not found in database: ${userId}`);
      return fail(res, 404, "User not found");
    }

    res.json({ ...user, isAdmin: isAdminEmail(user.email) });
  } catch (error) {
    console.error("[Auth] Error fetching user:", error);
    fail(res, 500, "Internal server error");
  }
});

export default router;
