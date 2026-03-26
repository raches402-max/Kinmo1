import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Custom domains - must match replitAuth.ts for consistent domain handling
const HARDCODED_CUSTOM_DOMAINS = ["kinmo.ai"];

function getAllDomains(): string[] {
  const replitDomains =
    process.env.REPLIT_DOMAINS?.split(",").map((d) => d.trim()) || [];
  const envCustomDomains =
    process.env.CUSTOM_DOMAINS?.split(",").map((d) => d.trim()) || [];
  return [
    ...new Set([
      ...HARDCODED_CUSTOM_DOMAINS,
      ...envCustomDomains,
      ...replitDomains,
    ]),
  ];
}

async function upsertGoogleUser(profile: Profile) {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error("No email provided by Google");
  }

  const googleId = profile.id;
  const firstName = profile.name?.givenName || null;
  const lastName = profile.name?.familyName || null;
  const profileImageUrl = profile.photos?.[0]?.value || null;

  // Check if user exists by email (stable identifier)
  const existingUser = await storage.getUserByEmail(email);

  if (existingUser) {
    // User exists - update with Google info
    console.log(`[GoogleAuth] Updating existing user by email: ${email}`);
    await storage.upsertUser({
      id: existingUser.id, // Keep stable user ID
      email: email,
      googleId: googleId,
      firstName: firstName || existingUser.firstName,
      lastName: lastName || existingUser.lastName,
      profileImageUrl: profileImageUrl || existingUser.profileImageUrl,
    } as any);
    return existingUser;
  } else {
    // New user - create with Google ID as initial ID
    console.log(`[GoogleAuth] Creating new user: ${email}`);
    const newUser = await storage.upsertUser({
      id: `google_${googleId}`,
      email: email,
      googleId: googleId,
      firstName: firstName,
      lastName: lastName,
      profileImageUrl: profileImageUrl,
    } as any);
    return newUser;
  }
}

export async function setupGoogleAuth(app: Express) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.log(
      "[GoogleAuth] Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)"
    );
    return;
  }

  // Set up a Google strategy for each domain
  for (const domain of getAllDomains()) {
    const callbackURL = `https://${domain}/api/auth/google/callback`;

    passport.use(
      `google:${domain}`,
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL,
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await upsertGoogleUser(profile);
            // Store tokens and claims in session similar to Replit auth
            const sessionUser = {
              claims: {
                sub: profile.id,
                email: profile.emails?.[0]?.value,
                first_name: profile.name?.givenName,
                last_name: profile.name?.familyName,
                profile_image_url: profile.photos?.[0]?.value,
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week
              },
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            };
            done(null, sessionUser);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // Google login route - stores the return URL and initiates OAuth
  app.get("/api/auth/google", (req, res, next) => {
    // Store return URL in session for post-auth redirect
    const returnTo = req.query.returnTo as string;
    if (returnTo) {
      (req.session as any).returnTo = returnTo;
    }

    passport.authenticate(`google:${req.hostname}`, {
      scope: ["profile", "email"],
    })(req, res, next);
  });

  // Google callback route
  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate(`google:${req.hostname}`, (err: any, user: any) => {
      if (err) {
        console.error("[GoogleAuth] Authentication error:", err);
        return res.redirect("/api/login?error=auth_failed");
      }
      if (!user) {
        return res.redirect("/api/login?error=no_user");
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[GoogleAuth] Login error:", loginErr);
          return res.redirect("/api/login?error=login_failed");
        }

        // Redirect to stored returnTo URL or homepage
        const returnTo = (req.session as any).returnTo || "/";
        delete (req.session as any).returnTo;
        res.redirect(returnTo);
      });
    })(req, res, next);
  });

  console.log("[GoogleAuth] Google OAuth configured successfully");
}

/**
 * Session setup for Google OAuth (replaces replitAuth.getSession)
 * Uses connect-pg-simple to store sessions in Neon PostgreSQL
 */
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

/**
 * Combined auth setup: session + passport + Google OAuth routes
 * Drop-in replacement for replitAuth.setupAuth
 */
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  await setupGoogleAuth(app);
}

/**
 * Middleware: require authenticated session
 * Drop-in replacement for replitAuth.isAuthenticated
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  // Check token expiry if set
  if (user?.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      return res.status(401).json({ message: "Session expired" });
    }
  }

  return next();
};
