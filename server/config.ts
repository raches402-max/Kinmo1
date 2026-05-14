import { z } from 'zod';

const optionalUrl = z.string().url().optional();
const optionalNonEmptyString = z.string().trim().min(1).optional();

/**
 * Environment variable schema validation
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // External APIs (optional in development — stub mode if missing)
  OPENAI_API_KEY: optionalNonEmptyString,
  GOOGLE_PLACES_API_KEY: optionalNonEmptyString,
  GOOGLE_PLACES_API_KEY_2: optionalNonEmptyString,
  VITE_GOOGLE_MAPS_API_KEY: optionalNonEmptyString,
  RESEND_API_KEY: optionalNonEmptyString,

  // Authentication (Google OAuth)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,

  CUSTOM_DOMAINS: optionalNonEmptyString,
  ADMIN_EMAILS: optionalNonEmptyString,
  CRON_SECRET: optionalNonEmptyString,

  // Server Configuration
  PORT: z.string().optional().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  ENABLE_BACKGROUND_JOBS: z.enum(['true', 'false']).optional(),

  // CORS and Frontend URLs
  ALLOWED_ORIGINS: optionalNonEmptyString,
  FRONTEND_URL: optionalUrl,
  BASE_URL: optionalUrl,

  // Error Monitoring (optional - Sentry)
  SENTRY_DSN: optionalUrl,
  SENTRY_ENABLED: z.enum(['true', 'false']).optional(),
}).superRefine((env, ctx) => {
  const hasGoogleClientId = Boolean(env.GOOGLE_CLIENT_ID);
  const hasGoogleClientSecret = Boolean(env.GOOGLE_CLIENT_SECRET);

  if (hasGoogleClientId !== hasGoogleClientSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_CLIENT_ID'],
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
    });
  }

  if (env.NODE_ENV === 'production') {
    if (!hasGoogleClientId || !hasGoogleClientSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'Google OAuth credentials are required in production',
      });
    }
  }

  if (env.SENTRY_ENABLED === 'true' && !env.SENTRY_DSN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SENTRY_DSN'],
      message: 'SENTRY_DSN is required when SENTRY_ENABLED=true',
    });
  }
});

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
