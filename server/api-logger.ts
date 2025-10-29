import { db } from "./db";
import { apiCallLogs } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export type ApiService = 
  | "google_places"
  | "openai"
  | "google_geocoding"
  | "google_timezone";

export type ApiMethod = 
  | "textSearch"
  | "placeDetails"
  | "nearbySearch"
  | "geocode"
  | "timezone"
  | "placePhoto"
  | "chatCompletion"
  | "embedding";

export type CacheStatus = 
  | "miss"           // Not in cache, called API
  | "session_hit"    // Found in session/memory cache
  | "db_hit"         // Found in database cache
  | "hit";           // Generic cache hit

export type LogStatus = "success" | "error";

interface ApiLogParams {
  service: ApiService;
  method: ApiMethod;
  cacheStatus: CacheStatus;
  status: LogStatus;
  responseTimeMs?: number;
  errorMessage?: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

// API Pricing (as of 2025)
// Google Places API: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
const GOOGLE_PLACES_PRICING = {
  textSearch: 0.032,           // Text Search (New)
  nearbySearch: 0.032,         // Nearby Search (New)
  placeDetails_basic: 0.017,   // Place Details - Basic Data
  placeDetails_contact: 0.003, // Place Details - Contact Data
  placeDetails_atmosphere: 0.005, // Place Details - Atmosphere Data
  geocoding: 0.005,            // Geocoding API
  timezone: 0.005,             // Time Zone API
  placePhoto: 0.007,           // Place Photo (per photo)
};

// OpenAI Pricing: https://openai.com/api/pricing/
const OPENAI_PRICING = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,   // $2.50 per 1M input tokens
    output: 10.00 / 1_000_000,  // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.150 / 1_000_000,  // $0.15 per 1M input tokens
    output: 0.600 / 1_000_000,  // $0.60 per 1M output tokens
  },
};

/**
 * Calculate estimated cost for an API call
 */
function estimateCost(params: ApiLogParams): number {
  // Cache hits have no cost
  if (params.cacheStatus !== 'miss') {
    return 0;
  }

  // Google Places API costs
  if (params.service === 'google_places') {
    switch (params.method) {
      case 'textSearch':
        return GOOGLE_PLACES_PRICING.textSearch;
      case 'nearbySearch':
        return GOOGLE_PLACES_PRICING.nearbySearch;
      case 'placeDetails':
        // Basic data is always requested, could add contact/atmosphere based on fields
        return GOOGLE_PLACES_PRICING.placeDetails_basic;
      case 'placePhoto':
        return GOOGLE_PLACES_PRICING.placePhoto;
      default:
        return 0;
    }
  }

  // Google Geocoding API costs
  if (params.service === 'google_geocoding') {
    return GOOGLE_PLACES_PRICING.geocoding;
  }

  // Google Timezone API costs
  if (params.service === 'google_timezone') {
    return GOOGLE_PLACES_PRICING.timezone;
  }

  // OpenAI API costs (based on token usage in metadata)
  if (params.service === 'openai' && params.metadata) {
    const model = params.metadata.model as keyof typeof OPENAI_PRICING || 'gpt-4o-mini';
    const inputTokens = params.metadata.inputTokens || 0;
    const outputTokens = params.metadata.outputTokens || 0;
    
    const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['gpt-4o-mini'];
    return (inputTokens * pricing.input) + (outputTokens * pricing.output);
  }

  return 0;
}

/**
 * Log an API call to the database (async, non-blocking)
 */
export async function logApiCall(params: ApiLogParams): Promise<void> {
  try {
    const costEstimate = estimateCost(params);

    // Sanitize parameters to remove sensitive data
    const sanitizedParams = params.parameters ? sanitizeParameters(params.parameters) : null;

    await db.insert(apiCallLogs).values({
      service: params.service,
      method: params.method,
      cacheStatus: params.cacheStatus,
      responseTimeMs: params.responseTimeMs,
      costEstimate: costEstimate.toString(),
      status: params.status,
      errorMessage: params.errorMessage,
      parameters: sanitizedParams as any,
      metadata: params.metadata as any,
    });

    // Log to console for immediate visibility (optional, can remove in production)
    const costStr = costEstimate > 0 ? ` ($${costEstimate.toFixed(6)})` : '';
    const cacheStr = params.cacheStatus !== 'miss' ? ` [${params.cacheStatus.toUpperCase()}]` : '';
    console.log(`[API Log] ${params.service}.${params.method}${cacheStr}${costStr} - ${params.status}`);
  } catch (error) {
    // Don't throw - logging should never break the application
    console.error('[API Logger] Failed to log API call:', error);
  }
}

/**
 * Remove sensitive data from parameters before logging
 */
function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const sanitized = { ...params };
  
  // Remove API keys
  const sensitiveKeys = ['key', 'apiKey', 'api_key', 'token', 'authorization'];
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Helper to wrap API calls with automatic logging
 * Usage: const result = await withApiLogging({ service: 'google_places', method: 'textSearch' }, () => actualApiCall());
 */
export async function withApiLogging<T>(
  logParams: Pick<ApiLogParams, 'service' | 'method' | 'parameters' | 'metadata'>,
  apiCall: () => Promise<T>,
  cacheStatus: CacheStatus = 'miss'
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    const responseTimeMs = Date.now() - startTime;
    
    await logApiCall({
      ...logParams,
      cacheStatus,
      status: 'success',
      responseTimeMs,
    });
    
    return result;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    
    await logApiCall({
      ...logParams,
      cacheStatus,
      status: 'error',
      responseTimeMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

interface GetApiLogsOptions {
  limit?: number;
  service?: ApiService;
  status?: LogStatus;
  cacheStatus?: CacheStatus;
}

/**
 * Fetch API logs from database with optional filters
 */
export async function getApiLogs(options: GetApiLogsOptions = {}) {
  const { limit = 100, service, status, cacheStatus } = options;

  let query = db.select().from(apiCallLogs);

  // Apply filters
  const conditions = [];
  if (service) {
    conditions.push(eq(apiCallLogs.service, service));
  }
  if (status) {
    conditions.push(eq(apiCallLogs.status, status));
  }
  if (cacheStatus) {
    conditions.push(eq(apiCallLogs.cacheStatus, cacheStatus));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const logs = await query
    .orderBy(sql`${apiCallLogs.timestamp} DESC`)
    .limit(limit);

  return logs;
}

/**
 * Get aggregated statistics for API calls
 */
export async function getApiStats() {
  // Get overall statistics
  const totalCalls = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiCallLogs)
    .then(r => Number(r[0]?.count) || 0);

  const totalCost = await db
    .select({ sum: sql<number>`COALESCE(SUM(CAST(${apiCallLogs.costEstimate} AS NUMERIC)), 0)` })
    .from(apiCallLogs)
    .then(r => Number(r[0]?.sum) || 0);

  const avgResponseTime = await db
    .select({ avg: sql<number>`AVG(${apiCallLogs.responseTimeMs})` })
    .from(apiCallLogs)
    .where(sql`${apiCallLogs.responseTimeMs} IS NOT NULL`)
    .then(r => Number(r[0]?.avg) || 0);

  // Get statistics by service
  const byService = await db
    .select({
      service: apiCallLogs.service,
      count: sql<number>`count(*)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${apiCallLogs.costEstimate} AS NUMERIC)), 0)`,
      avgResponseTime: sql<number>`AVG(${apiCallLogs.responseTimeMs})`,
    })
    .from(apiCallLogs)
    .groupBy(apiCallLogs.service);

  // Get statistics by cache status
  const byCacheStatus = await db
    .select({
      cacheStatus: apiCallLogs.cacheStatus,
      count: sql<number>`count(*)`,
    })
    .from(apiCallLogs)
    .groupBy(apiCallLogs.cacheStatus);

  // Get statistics by status (success/error)
  const byStatus = await db
    .select({
      status: apiCallLogs.status,
      count: sql<number>`count(*)`,
    })
    .from(apiCallLogs)
    .groupBy(apiCallLogs.status);

  // Calculate cache hit rate
  const cacheHits = byCacheStatus
    .filter(s => s.cacheStatus === 'session_hit' || s.cacheStatus === 'db_hit' || s.cacheStatus === 'hit')
    .reduce((sum, s) => sum + Number(s.count), 0);
  const cacheMisses = byCacheStatus
    .find(s => s.cacheStatus === 'miss')?.count || 0;
  const cacheHitRate = totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0;

  return {
    overall: {
      totalCalls,
      totalCost,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHits,
      cacheMisses: Number(cacheMisses),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    },
    byService: byService.map(s => ({
      service: s.service,
      count: Number(s.count),
      totalCost: Number(s.totalCost),
      avgResponseTime: Math.round(Number(s.avgResponseTime) || 0),
    })),
    byCacheStatus: byCacheStatus.map(s => ({
      cacheStatus: s.cacheStatus,
      count: Number(s.count),
    })),
    byStatus: byStatus.map(s => ({
      status: s.status,
      count: Number(s.count),
    })),
  };
}
