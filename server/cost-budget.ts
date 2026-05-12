/**
 * Global daily API budget tripwire.
 *
 * Reads recent spend from api_call_logs and compares against soft/hard caps
 * set via env. Soft cap = warn loudly. Hard cap = blocks paid calls if a
 * callsite opts in via checkBudgetOrThrow().
 *
 * Per-group caps are deferred until logApiCall callsites consistently carry
 * groupId — today they don't, so we can only enforce a global ceiling.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

interface SpendRow extends Record<string, unknown> {
  total: string;
}

export interface BudgetStatus {
  spent: number;
  softCap: number | null;
  hardCap: number | null;
  underSoft: boolean;
  underHard: boolean;
  windowHours: number;
}

function getCap(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getRecentSpend(windowHours: number = 24): Promise<number> {
  const result = await db.execute<SpendRow>(sql`
    SELECT COALESCE(SUM(cost_estimate), 0) AS total
    FROM api_call_logs
    WHERE created_at > now() - (${windowHours} || ' hours')::interval
  `);
  const ts = result.rows[0]?.total;
  return ts ? parseFloat(ts) : 0;
}

export async function checkBudget(windowHours: number = 24): Promise<BudgetStatus> {
  const spent = await getRecentSpend(windowHours);
  const softCap = getCap("DAILY_BUDGET_SOFT_USD");
  const hardCap = getCap("DAILY_BUDGET_HARD_USD");
  return {
    spent,
    softCap,
    hardCap,
    underSoft: softCap === null ? true : spent < softCap,
    underHard: hardCap === null ? true : spent < hardCap,
    windowHours,
  };
}

/**
 * For callsites that should refuse to spend money when over the hard cap.
 * Throws a `BudgetExceededError` — callers should catch and degrade gracefully
 * (e.g., return a cached/curated fallback instead of firing a paid API call).
 */
export class BudgetExceededError extends Error {
  constructor(public status: BudgetStatus) {
    super(
      `Daily API budget exceeded: $${status.spent.toFixed(2)} >= hard cap $${status.hardCap?.toFixed(2)} (window: ${status.windowHours}h)`,
    );
    this.name = "BudgetExceededError";
  }
}

export async function checkBudgetOrThrow(windowHours: number = 24): Promise<void> {
  const status = await checkBudget(windowHours);
  if (!status.underHard) {
    throw new BudgetExceededError(status);
  }
}
