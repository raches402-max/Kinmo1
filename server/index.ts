import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import net from "net";
import path from "path";
import { env } from "./config"; // Validate environment variables at startup
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startReminderScheduler } from "./reminder-scheduler";

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
  // Don't exit - let the app continue running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the app continue running
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Security: HTTP headers protection
app.use(helmet({
  contentSecurityPolicy: app.get("env") === "development" ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Vite in dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://maps.googleapis.com",
        "https://places.googleapis.com"
      ],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: app.get("env") === "development" ? false : undefined,
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

    // In production, check against allowedOrigins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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

    // Start the automated reminder scheduler
    startReminderScheduler();
  });
})();
