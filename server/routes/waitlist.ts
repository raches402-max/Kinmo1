/**
 * Waitlist & invite-code redemption routes (public, no auth).
 *
 *   POST /api/waitlist/redeem-code  { code }    → validates and stashes in session
 *   POST /api/waitlist/signup       { email }   → adds to manual-review waitlist
 *
 * The actual allowlist insertion + uses_count increment happens inside the
 * Google OAuth verify callback (server/googleAuth.ts), which reads
 * req.session.pendingInviteCode at sign-in time.
 */

import { Router } from "express";
import { z } from "zod";
import { validateInviteCode, addWaitlistSignup } from "../waitlist";

export const waitlistRouter = Router();

const redeemSchema = z.object({
  code: z.string().min(1).max(64),
});

waitlistRouter.post("/redeem-code", async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, reason: "invalid_input" });
  }
  const code = parsed.data.code.trim().toLowerCase();

  const result = await validateInviteCode(code);
  if (!result.ok) {
    return res.status(400).json({ ok: false, reason: result.reason });
  }

  // Stash on session — the actual claim happens at Google sign-in callback.
  (req.session as any).pendingInviteCode = code;
  return res.json({ ok: true, label: result.label });
});

const signupSchema = z.object({
  email: z.string().email().max(320),
});

waitlistRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, reason: "invalid_email" });
  }

  await addWaitlistSignup(parsed.data.email);
  return res.json({ ok: true });
});
