/**
 * Admin endpoints for managing the invite-only beta:
 *
 *   GET    /api/admin/waitlist                — list signups
 *   POST   /api/admin/waitlist/:id/approve    — approve + add to allowlist
 *   POST   /api/admin/waitlist/:id/reject     — mark rejected
 *
 *   GET    /api/admin/invite-codes   — list codes with usage
 *   POST   /api/admin/invite-codes            — create new code
 *   PATCH  /api/admin/invite-codes/:code      — update label/maxUses/isActive
 *
 *   GET    /api/admin/allowed-emails          — list allowlist
 *   POST   /api/admin/allowed-emails          — add one manually
 *   DELETE /api/admin/allowed-emails/:email   — remove
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { requireAdmin } from "../authorization";
import { allowedEmails, inviteCodes, waitlistSignups } from "@shared/schema";
import { fail } from "../lib/responses";

export const adminWaitlistRouter = Router();

// ─── Waitlist signups ──────────────────────────────────────────────────────

adminWaitlistRouter.get(
  "/admin/waitlist",
  isAuthenticated,
  requireAdmin(),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(waitlistSignups)
      .orderBy(desc(waitlistSignups.createdAt));
    res.json({ signups: rows });
  },
);

adminWaitlistRouter.post(
  "/admin/waitlist/:id/approve",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const id = req.params.id;
    const [signup] = await db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.id, id))
      .limit(1);
    if (!signup) {
      return fail(res, 404, "Signup not found");
    }

    const email = signup.email.toLowerCase();
    await db
      .insert(allowedEmails)
      .values({ email, source: "manual" })
      .onConflictDoNothing();

    await db
      .update(waitlistSignups)
      .set({ status: "approved" })
      .where(eq(waitlistSignups.id, id));

    res.json({ ok: true, email });
  },
);

adminWaitlistRouter.post(
  "/admin/waitlist/:id/reject",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const id = req.params.id;
    const result = await db
      .update(waitlistSignups)
      .set({ status: "rejected" })
      .where(eq(waitlistSignups.id, id))
      .returning({ id: waitlistSignups.id });
    if (result.length === 0) {
      return fail(res, 404, "Signup not found");
    }
    res.json({ ok: true });
  },
);

// ─── Invite codes ──────────────────────────────────────────────────────────

adminWaitlistRouter.get(
  "/admin/invite-codes",
  isAuthenticated,
  requireAdmin(),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt));
    res.json({ codes: rows });
  },
);

const createCodeSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  maxUses: z.number().int().min(1).max(10000).default(25),
  expiresAt: z.string().datetime().optional().nullable(),
});

adminWaitlistRouter.post(
  "/admin/invite-codes",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const parsed = createCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid input", { errors: parsed.error.errors });
    }
    const code = parsed.data.code.trim().toLowerCase();
    try {
      const [created] = await db
        .insert(inviteCodes)
        .values({
          code,
          label: parsed.data.label,
          maxUses: parsed.data.maxUses,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        })
        .returning();
      res.json({ ok: true, code: created });
    } catch (err: any) {
      if (err?.code === "23505") {
        return fail(res, 409, "Code already exists");
      }
      throw err;
    }
  },
);

const updateCodeSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  maxUses: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

adminWaitlistRouter.patch(
  "/admin/invite-codes/:code",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const code = req.params.code.toLowerCase();
    const parsed = updateCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid input");
    }
    const updates: any = {};
    if (parsed.data.label !== undefined) updates.label = parsed.data.label;
    if (parsed.data.maxUses !== undefined) updates.maxUses = parsed.data.maxUses;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.expiresAt !== undefined) {
      updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    }
    if (Object.keys(updates).length === 0) {
      return fail(res, 400, "No updates provided");
    }
    const [updated] = await db
      .update(inviteCodes)
      .set(updates)
      .where(eq(inviteCodes.code, code))
      .returning();
    if (!updated) {
      return fail(res, 404, "Code not found");
    }
    res.json({ ok: true, code: updated });
  },
);

// ─── Allowed emails ────────────────────────────────────────────────────────

adminWaitlistRouter.get(
  "/admin/allowed-emails",
  isAuthenticated,
  requireAdmin(),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(allowedEmails)
      .orderBy(desc(allowedEmails.createdAt));
    res.json({ emails: rows });
  },
);

const addEmailSchema = z.object({
  email: z.string().email().max(320),
});

adminWaitlistRouter.post(
  "/admin/allowed-emails",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const parsed = addEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid email");
    }
    const email = parsed.data.email.trim().toLowerCase();
    await db
      .insert(allowedEmails)
      .values({ email, source: "manual" })
      .onConflictDoNothing();
    res.json({ ok: true, email });
  },
);

adminWaitlistRouter.delete(
  "/admin/allowed-emails/:email",
  isAuthenticated,
  requireAdmin(),
  async (req, res) => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const result = await db
      .delete(allowedEmails)
      .where(eq(allowedEmails.email, email))
      .returning({ email: allowedEmails.email });
    if (result.length === 0) {
      return fail(res, 404, "Email not found");
    }
    res.json({ ok: true });
  },
);
