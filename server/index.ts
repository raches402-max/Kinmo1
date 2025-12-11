// Load .env file before anything else
import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import net from "net";
import path from "path";
import * as Sentry from "@sentry/node";
import { env } from "./config"; // Validate environment variables at startup
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startReminderScheduler } from "./reminder-scheduler";
import { pool } from "./db";

// Initialize Sentry for error monitoring (only if DSN is configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    // Don't send errors in development unless explicitly enabled
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',
  });
  console.log('✅ Sentry error monitoring initialized');
} else {
  console.log('ℹ️  Sentry not configured (set SENTRY_DSN to enable)');
}

/**
 * Check if a port is available
 * Returns the port if available, or the next available port
 */
async function getAvailablePort(preferredPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try next one
        console.warn(`⚠️  Port ${preferredPort} is already in use, trying ${preferredPort + 1}...`);
        resolve(getAvailablePort(preferredPort + 1));
      } else {
        // Other error, use preferred port anyway
        resolve(preferredPort);
      }
    });

    server.once('listening', () => {
      // Port is available
      const address = server.address();
      const port = typeof address === 'object' ? address?.port : preferredPort;
      server.close(() => resolve(port || preferredPort));
    });

    server.listen(preferredPort, '0.0.0.0');
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  Sentry.captureException(error);
  // Don't exit - let the app continue running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (reason instanceof Error) {
    Sentry.captureException(reason);
  } else {
    Sentry.captureMessage(`Unhandled Rejection: ${reason}`, 'error');
  }
  // Don't exit - let the app continue running
});

const app = express();

// CRITICAL: Health check endpoints must be FIRST and respond immediately
// Replit autoscale requires very fast health check responses
app.get('/__health', async (_req, res) => {
  try {
    // Quick DB check with 2-second timeout to verify database connectivity
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB connection timeout')), 2000)
      )
    ]);
    client.release();
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Health] DB check failed:', error);
    res.status(503).send('DB_UNAVAILABLE');
  }
});

// Root health check - respond immediately for any request to /
// This is critical for Replit's default health check behavior
app.get('/', (req, res, next) => {
  // Check if this looks like a health check (no accept header for HTML, or specific probes)
  const acceptHeader = req.headers['accept'] || '';
  const userAgent = req.headers['user-agent'] || '';

  const isHealthProbe =
    userAgent.includes('kube-probe') ||
    userAgent.includes('GoogleHC') ||
    !acceptHeader.includes('text/html');

  if (isHealthProbe) {
    return res.status(200).send('OK');
  }

  // Not a health probe - continue to static file serving
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Security: HTTP headers protection
// Note: Disable CSP in development for Vite HMR; in production use permissive CSP for React app
const isDevMode = process.env.NODE_ENV === "development";
app.use(helmet({
  // Disable CSP - it causes issues with React apps and inline scripts from the build
  // The app is served over HTTPS and uses secure authentication, which provides adequate protection
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: isDevMode ? false : undefined,
  crossOriginResourcePolicy: false, // Allow static assets with crossorigin attribute
}));

// Security: CORS protection
const isDevelopment = env.NODE_ENV === 'development';
const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development mode, allow all origins for Replit preview
    if (isDevelopment) {
      return callback(null, true);
    }

    // Allow Replit domains (both dev and deployed apps)
    if (origin.endsWith('.replit.dev') || origin.endsWith('.replit.app') || origin.endsWith('.repl.co')) {
      return callback(null, true);
    }

    // Allow kinmo.ai custom domain
    if (origin === 'https://kinmo.ai' || origin === 'https://www.kinmo.ai') {
      return callback(null, true);
    }

    // In production, check against allowedOrigins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies for authentication
}));

// Security: Rate limiting for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window per IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', apiLimiter);

// Security: Strict rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window per IP
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/', authLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Serve mockups folder for design previews (before Vite middleware)
  const mockupsPath = path.resolve(import.meta.dirname, "..", "client", "src", "components", "mockups");
  app.use("/mockups", express.static(mockupsPath));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Startup] About to setup static/vite middleware...`);

  if (process.env.NODE_ENV === "development") {
    console.log(`[Startup] Setting up Vite (development mode)`);
    await setupVite(app, server);
  } else {
    console.log(`[Startup] Setting up static file serving (production mode)`);
    serveStatic(app);
  }
  console.log(`[Startup] Static/vite middleware setup complete`);

  // Sentry error handler - must be AFTER static file serving
  app.use(Sentry.expressErrorHandler());

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Capture error in Sentry (expressErrorHandler may have already done this, but this ensures coverage)
    if (status >= 500) {
      Sentry.captureException(err);
    }

    res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // For Replit: Backend uses 3000, Frontend (preview) uses 5000
  // this serves both the API and the client.
  const preferredPort = parseInt(process.env.PORT || '3000', 10);

  // Check if preferred port is available
  const port = await getAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`📌 Using port ${port} instead of ${preferredPort} (original port was occupied)`);
    console.log(`💡 Tip: Port 5000 is reserved for Replit preview - backend uses 3000`);
  } else {
    console.log(`✅ Port ${port} is available`);
  }

  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);

    // CRITICAL: Delay scheduler startup for autoscale deployments
    // This ensures health checks pass before heavy background tasks run
    // In development, start immediately; in production, delay 15 seconds
    const schedulerDelay = process.env.NODE_ENV === 'production' ? 15000 : 0;

    if (schedulerDelay > 0) {
      console.log(`[Startup] Server ready! Delaying scheduler by ${schedulerDelay/1000}s for health checks...`);
      setTimeout(() => {
        console.log(`[Startup] Starting scheduler now...`);
        startReminderScheduler();
      }, schedulerDelay);
    } else {
      // Development mode - start immediately
      startReminderScheduler();
    }
  });
})();
