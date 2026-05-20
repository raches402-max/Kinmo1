/**
 * Waitlist / invite-code gating helpers.
 *
 * Kinmo is invite-only. Three concepts:
 *  - `allowed_emails`: who can complete Google sign-in.
 *  - `invite_codes`: named codes ("frands", "haas") with per-code caps.
 *  - `waitlist_signups`: people who asked to be let in without a code.
 *
 * Redemption flow (session-based, no email entry):
 *  1. User POSTs /api/waitlist/redeem-code with { code }.
 *  2. validateInviteCode() checks code exists, is active, has remaining capacity.
 *     If valid, we stash the code on req.session.pendingInviteCode.
 *  3. User clicks "Sign in with Google" → Google OAuth → verify callback.
 *  4. In the verify callback, if the email is already in allowed_emails, proceed.
 *     Otherwise, if req.session.pendingInviteCode is set, call claimInviteCode()
 *     which atomically increments uses_count and inserts the email into
 *     allowed_emails. If the code is full by then (race), reject.
 */

import { db } from "./db";
import { allowedEmails, inviteCodes, waitlistSignups } from "@shared/schema";
import { eq, sql, and, or, isNull, gt } from "drizzle-orm";

export type InviteCodeStatus =
  | { ok: true; label: string }
  | { ok: false; reason: "not_found" | "inactive" | "expired" | "full" };

/**
 * Validate an invite code without consuming a slot. Returns the code's
 * human-readable label so the UI can show "Welcome, Frands".
 */
export async function validateInviteCode(rawCode: string): Promise<InviteCodeStatus> {
  const code = rawCode.trim().toLowerCase();
  if (!code) return { ok: false, reason: "not_found" };

  const [row] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!row) return { ok: false, reason: "not_found" };
  if (!row.isActive) return { ok: false, reason: "inactive" };
  if (row.expiresAt && row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.usesCount >= row.maxUses) return { ok: false, reason: "full" };

  return { ok: true, label: row.label };
}

/**
 * Check whether an email is already on the allowlist.
 */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  if (!lower) return false;

  const [row] = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, lower))
    .limit(1);

  return !!row;
}

/**
 * Mark an allowlisted email as having signed in (sets `claimed_at` if null).
 * Best-effort — failures here should not block sign-in.
 */
export async function markEmailClaimed(email: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  if (!lower) return;
  try {
    await db
      .update(allowedEmails)
      .set({ claimedAt: new Date() })
      .where(and(eq(allowedEmails.email, lower), isNull(allowedEmails.claimedAt)));
  } catch (err) {
    console.warn("[waitlist] markEmailClaimed failed", err);
  }
}

/**
 * Atomically consume one slot from an invite code and add the email to the
 * allowlist. Returns true on success, false if the code is full / invalid by
 * the time of claim.
 */
export async function claimInviteCode(rawCode: string, email: string): Promise<boolean> {
  const code = rawCode.trim().toLowerCase();
  const lowerEmail = email.trim().toLowerCase();
  if (!code || !lowerEmail) return false;

  // Atomic CAS: only increment if there's still capacity, code is active, not expired.
  // Postgres `RETURNING` lets us know whether the update fired.
  const updated = await db
    .update(inviteCodes)
    .set({ usesCount: sql`${inviteCodes.usesCount} + 1` })
    .where(
      and(
        eq(inviteCodes.code, code),
        eq(inviteCodes.isActive, true),
        sql`${inviteCodes.usesCount} < ${inviteCodes.maxUses}`,
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
      ),
    )
    .returning({ code: inviteCodes.code });

  if (updated.length === 0) return false;

  // Insert into allowlist. ON CONFLICT DO NOTHING in case the email is already
  // present (e.g. founder seeded + also redeemed a code). We still consumed the
  // slot in that case, which is fine and rare.
  await db
    .insert(allowedEmails)
    .values({
      email: lowerEmail,
      source: "invite_code",
      inviteCode: code,
      claimedAt: new Date(),
    })
    .onConflictDoNothing();

  return true;
}

/**
 * Add an email to the manual-review waitlist. Idempotent on email.
 */
export async function addWaitlistSignup(email: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  if (!lower) return;

  // Best-effort: if the user already on the list, do nothing. We don't have a
  // unique index, so just check first.
  const [existing] = await db
    .select({ id: waitlistSignups.id })
    .from(waitlistSignups)
    .where(eq(waitlistSignups.email, lower))
    .limit(1);

  if (existing) return;

  await db.insert(waitlistSignups).values({ email: lower });
}
