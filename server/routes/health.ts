/**
 * Health & Debug Routes
 *
 *   GET  /api/health        — health check (DB connectivity)
 *   GET  /api/debug/paths   — static file path debug info
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { getJobHealthStatus } from "../lib/job-tracker";

const router = Router();

// Health check endpoint (for monitoring and load balancers)
router.get("/health", async (req, res) => {
  try {
    // Check database connectivity
    await db.select().from(users).limit(1);

    const jobHealth = getJobHealthStatus();
    const jobs = Object.values(jobHealth);
    const failingJobs = jobs.filter((job) => job.status === "failing").length;
    const degradedJobs = jobs.filter((job) => job.status === "degraded").length;
    const overallStatus = failingJobs > 0 ? "failing" : degradedJobs > 0 ? "degraded" : "healthy";

    // Public endpoint: omit lastError/lastFailure to avoid leaking raw exception
    // strings to unauthenticated callers. Full detail is on /api/admin/job-health.
    const publicJobs: Record<string, Omit<typeof jobHealth[string], "lastError" | "lastFailure">> = {};
    for (const [name, entry] of Object.entries(jobHealth)) {
      const { lastError, lastFailure, ...safe } = entry;
      publicJobs[name] = safe;
    }

    res.status(failingJobs > 0 ? 503 : 200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: "healthy",
        jobs: overallStatus,
      },
      jobSummary: {
        total: jobs.length,
        healthy: jobs.filter((job) => job.status === "healthy").length,
        degraded: degradedJobs,
        failing: failingJobs,
      },
      jobs: publicJobs,
    });
  } catch (error) {
    console.error("[Health Check] Database connection failed:", error);
    res.status(503).json({
      status: "unhealthy",
      error: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint to check static file paths
router.get("/debug/paths", (req, res) => {
  const fs = require("fs");
  const path = require("path");
  const dirname = import.meta.dirname;
  const distPath = path.resolve(dirname, "..", "dist", "public");
  const altPath = path.resolve(dirname, "public");

  res.json({
    dirname,
    distPath,
    distPathExists: fs.existsSync(distPath),
    altPath,
    altPathExists: fs.existsSync(altPath),
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    buildTime: "2025-12-08T01:15:00Z",
  });
});

export default router;
