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
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  console.log(`[Static] import.meta.dirname: ${import.meta.dirname}`);
  console.log(`[Static] Resolved distPath: ${distPath}`);
  console.log(`[Static] distPath exists: ${fs.existsSync(distPath)}`);

  // Try alternative path if the standard one doesn't exist
  let finalPath = distPath;
  if (!fs.existsSync(distPath)) {
    // In bundled mode, public folder might be sibling to index.js
    const altPath = path.resolve(import.meta.dirname, "public");
    console.log(`[Static] Trying alternative path: ${altPath}`);
    console.log(`[Static] altPath exists: ${fs.existsSync(altPath)}`);

    if (fs.existsSync(altPath)) {
      finalPath = altPath;
    } else {
      console.error(`[Static] ERROR: Neither path exists!`);
      console.error(`[Static] Tried: ${distPath}`);
      console.error(`[Static] Tried: ${altPath}`);
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
  }

  console.log(`[Static] Using path: ${finalPath}`);

  // Serve static files with proper headers for production
  app.use(express.static(finalPath, {
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

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res, next) => {
    res.sendFile(path.resolve(finalPath, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}
