import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Try multiple possible locations for the static files
  // The path depends on where the bundled server runs from
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"),              // When running from dist/ folder
    path.resolve(import.meta.dirname, "..", "dist", "public"), // Original development path
    path.resolve(process.cwd(), "dist", "public"),            // From working directory
    path.resolve(process.cwd(), "public"),                    // Direct public folder
  ];

  console.log(`[Static] Looking for static files...`);
  console.log(`[Static] import.meta.dirname: ${import.meta.dirname}`);
  console.log(`[Static] process.cwd(): ${process.cwd()}`);

  let staticPath: string | null = null;
  for (const p of possiblePaths) {
    const exists = fs.existsSync(p);
    console.log(`[Static] Checking: ${p} -> ${exists ? 'EXISTS' : 'not found'}`);
    if (exists && !staticPath) {
      // Also verify it has the expected content (index.html)
      const hasIndex = fs.existsSync(path.join(p, 'index.html'));
      console.log(`[Static]   Has index.html: ${hasIndex}`);
      if (hasIndex) {
        staticPath = p;
      }
    }
  }

  if (!staticPath) {
    console.error(`[Static] ERROR: No valid static path found!`);
    console.error(`[Static] Tried paths:`, possiblePaths);
    // List contents of likely directories for debugging
    try {
      console.error(`[Static] Contents of cwd:`, fs.readdirSync(process.cwd()));
      const distDir = path.resolve(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        console.error(`[Static] Contents of dist/:`, fs.readdirSync(distDir));
      }
    } catch (e) {
      console.error(`[Static] Could not list directories:`, e);
    }
    throw new Error(
      `Could not find the build directory with index.html, make sure to build the client first`,
    );
  }

  console.log(`[Static] Using static path: ${staticPath}`);

  // List contents for verification
  try {
    console.log(`[Static] Contents:`, fs.readdirSync(staticPath));
    const assetsDir = path.join(staticPath, 'assets');
    if (fs.existsSync(assetsDir)) {
      console.log(`[Static] Assets:`, fs.readdirSync(assetsDir));
    }
  } catch (e) {
    console.error(`[Static] Could not list static contents:`, e);
  }

  // Serve static files with proper headers for production
  app.use(express.static(staticPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // CORS headers for cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

      // Don't cache HTML
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // Fall through to index.html for SPA routing (but NOT for API routes)
  app.use("*", (req, res, next) => {
    // Don't catch API routes - let them 404 properly
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    res.sendFile(path.resolve(staticPath!, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}
