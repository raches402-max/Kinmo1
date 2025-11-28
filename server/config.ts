import { z } from 'zod';

/**
 * Environment variable schema validation
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // External APIs
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY_2: z.string().optional(),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

  // Authentication (Replit)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  REPLIT_DOMAINS: z.string().min(1, 'REPLIT_DOMAINS is required'),
  REPL_ID: z.string().min(1, 'REPL_ID is required'),
  ISSUER_URL: z.string().url().optional().default('https://replit.com/oidc'),

  // Server Configuration
  PORT: z.string().optional().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),

  // CORS and Frontend URLs
  ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),

  // Error Monitoring (optional - Sentry)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLED: z.string().optional(), // Set to 'true' to enable in development
}).refine(
  (data) => data.GOOGLE_PLACES_API_KEY || data.GOOGLE_PLACES_API_KEY_2,
  {
    message: 'At least one Google Places API key is required (GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_API_KEY_2)',
    path: ['GOOGLE_PLACES_API_KEY'],
  }
);

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables at startup
 * Throws an error with detailed message if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => {
        const path = err.path.join('.');
        return `  ❌ ${path}: ${err.message}`;
      }).join('\n');

      console.error('🚨 Environment variable validation failed:\n' + missingVars);
      console.error('\n💡 Please check your .env file or environment configuration.');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Typed environment variables
 * Use this instead of process.env for type safety
 */
export const env = validateEnv();
