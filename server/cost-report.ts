/**
 * Daily cost report — aggregates api_call_logs over a recent window and
 * logs a per-service/method cost + cache-hit summary to stdout.
 *
 * Closes the observability gap from W3: without this, "is the system
 * efficient now?" is unanswerable. With this, the answer shows up in
 * Railway logs once a day.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { checkBudget } from "./cost-budget";

interface CostRow extends Record<string, unknown> {
  service: string;
  method: string;
  cache_status: string;
  call_count: string;
  total_cost: string;
}

export async function generateDailyCostReport(
  windowHours: number = 24,
): Promise<void> {
  const result = await db.execute<CostRow>(sql`
    SELECT service, method, cache_status,
           COUNT(*) AS call_count,
           COALESCE(SUM(cost_estimate), 0) AS total_cost
    FROM api_call_logs
    WHERE created_at > now() - (${windowHours} || ' hours')::interval
    GROUP BY service, method, cache_status
    ORDER BY service, method, cache_status
  `);

  const rows = result.rows.map((r) => ({
    service: r.service,
    method: r.method,
    cacheStatus: r.cache_status,
    callCount: parseInt(r.call_count, 10),
    totalCost: parseFloat(r.total_cost),
  }));

  if (rows.length === 0) {
    console.log(`[Cost Report] No API calls in the last ${windowHours}h`);
    return;
  }

  // Roll up per service+method to get hit rates and total $.
  type Summary = {
    service: string;
    method: string;
    hit: number;
    miss: number;
    write: number;
    total: number;
    cost: number;
  };
  const byMethod = new Map<string, Summary>();
  for (const r of rows) {
    const key = `${r.service}::${r.method}`;
    const s =
      byMethod.get(key) ??
      ({ service: r.service, method: r.method, hit: 0, miss: 0, write: 0, total: 0, cost: 0 } as Summary);
    if (r.cacheStatus === "hit") s.hit += r.callCount;
    else if (r.cacheStatus === "miss") s.miss += r.callCount;
    else if (r.cacheStatus === "write") s.write += r.callCount;
    s.total += r.callCount;
    s.cost += r.totalCost;
    byMethod.set(key, s);
  }

  const summaries = Array.from(byMethod.values()).sort((a, b) => b.cost - a.cost);
  const totalCost = summaries.reduce((sum, s) => sum + s.cost, 0);
  const totalCalls = summaries.reduce((sum, s) => sum + s.total, 0);

  console.log(`\n[Cost Report] === API spend, last ${windowHours}h ===`);
  console.log(
    `[Cost Report] ${"service".padEnd(14)} ${"method".padEnd(28)} ${"calls".padStart(7)} ${"hit%".padStart(6)} ${"cost ($)".padStart(10)}`,
  );
  for (const s of summaries) {
    const billable = s.miss + s.write; // hits cost nothing
    const hitRate = s.total > 0 ? (s.hit / s.total) * 100 : 0;
    console.log(
      `[Cost Report] ${s.service.padEnd(14)} ${s.method.padEnd(28)} ${String(s.total).padStart(7)} ${hitRate.toFixed(0).padStart(5)}% ${s.cost.toFixed(4).padStart(10)} (${billable} billable)`,
    );
  }
  console.log(
    `[Cost Report] ${"TOTAL".padEnd(14)} ${"".padEnd(28)} ${String(totalCalls).padStart(7)} ${"".padStart(6)} ${totalCost.toFixed(4).padStart(10)}`,
  );

  // Budget tripwire — if soft/hard caps are configured, compare and shout.
  const budget = await checkBudget(windowHours);
  if (budget.hardCap !== null && !budget.underHard) {
    console.error(
      `[Cost Report] 🚨 HARD CAP EXCEEDED: $${budget.spent.toFixed(4)} >= $${budget.hardCap.toFixed(2)} (${windowHours}h). Callsites using checkBudgetOrThrow will refuse to spend.`,
    );
  } else if (budget.softCap !== null && !budget.underSoft) {
    console.warn(
      `[Cost Report] ⚠️  SOFT CAP EXCEEDED: $${budget.spent.toFixed(4)} >= $${budget.softCap.toFixed(2)} (${windowHours}h). Review whether spend is expected.`,
    );
  } else if (budget.softCap !== null || budget.hardCap !== null) {
    const capStr = [
      budget.softCap !== null ? `soft $${budget.softCap}` : null,
      budget.hardCap !== null ? `hard $${budget.hardCap}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`[Cost Report] Under budget (${capStr})`);
  }
  console.log(`[Cost Report] === end ===\n`);
}
