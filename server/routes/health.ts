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

const router = Router();

// Health check endpoint (for monitoring and load balancers)
router.get("/health", async (req, res) => {
  try {
    // Check database connectivity
    await db.select().from(users).limit(1);

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
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
