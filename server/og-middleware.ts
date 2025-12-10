/**
 * Open Graph Middleware
 *
 * Express middleware that intercepts shareable link routes and injects
 * dynamic Open Graph meta tags for rich link previews.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ViteDevServer } from "vite";
import fs from "fs";
import path from "path";
import {
  injectOGMetaTags,
  getGuestRsvpMeta,
  getGroupJoinMeta,
  getMemberClaimMeta,
  type OGMetaData,
} from "./og-meta";

// Route patterns that should have OG meta tags injected
const OG_ROUTES: Array<{
  pattern: RegExp;
  handler: (token: string) => Promise<OGMetaData | null>;
}> = [
  { pattern: /^\/guest-rsvp\/([^\/]+)$/, handler: getGuestRsvpMeta },
  { pattern: /^\/join\/([^\/]+)$/, handler: getGroupJoinMeta },
  { pattern: /^\/claim\/([^\/]+)$/, handler: getMemberClaimMeta },
];

/**
 * Check if a URL matches any of our OG routes
 */
function matchOGRoute(url: string): { token: string; handler: (token: string) => Promise<OGMetaData | null> } | null {
  // Remove query string if present
  const pathname = url.split("?")[0];

  for (const route of OG_ROUTES) {
    const match = pathname.match(route.pattern);
    if (match && match[1]) {
      return { token: match[1], handler: route.handler };
    }
  }
  return null;
}

/**
 * Create OG middleware for development (Vite)
 */
export function createOGMiddlewareForVite(vite: ViteDevServer): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    // Check if this URL should have OG tags
    const routeMatch = matchOGRoute(url);
    if (!routeMatch) {
      return next();
    }

    try {
      // Fetch meta data for this link
      const meta = await routeMatch.handler(routeMatch.token);
      if (!meta) {
        // If data fetch fails, fall through to normal SPA
        return next();
      }

      // Read and transform HTML template
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Inject OG meta tags
      template = injectOGMetaTags(template, meta);

      // Transform with Vite for dev server compatibility
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      console.error("[OG Middleware] Error processing request:", error);
      // Fall through to normal handling on error
      next();
    }
  };
}

/**
 * Create OG middleware for production (static files)
 */
export function createOGMiddlewareForStatic(staticPath: string): RequestHandler {
  // Pre-read the template at startup
  let templateHtml: string | null = null;

  return async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    // Check if this URL should have OG tags
    const routeMatch = matchOGRoute(url);
    if (!routeMatch) {
      return next();
    }

    try {
      // Fetch meta data for this link
      const meta = await routeMatch.handler(routeMatch.token);
      if (!meta) {
        // If data fetch fails, fall through to normal SPA
        return next();
      }

      // Read HTML template (cache it after first read)
      if (!templateHtml) {
        templateHtml = await fs.promises.readFile(
          path.join(staticPath, "index.html"),
          "utf-8"
        );
      }

      // Inject OG meta tags
      const page = injectOGMetaTags(templateHtml, meta);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      console.error("[OG Middleware] Error processing request:", error);
      // Fall through to normal handling on error
      next();
    }
  };
}
