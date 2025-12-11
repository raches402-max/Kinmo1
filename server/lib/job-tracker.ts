/**
 * Background Job Error Tracking
 *
 * Tracks failures of background jobs with failure counts and timing.
 * Integrates with Sentry for alerting on repeated failures.
 */

import * as Sentry from '@sentry/node';

interface JobFailure {
  count: number;
  lastError: string;
  lastTime: Date;
  consecutiveFailures: number;
}

// In-memory tracking of job failures
const jobFailures = new Map<string, JobFailure>();

// Track job successes to reset consecutive failure count
const jobSuccesses = new Map<string, Date>();

/**
 * Track a background job error
 *
 * @param jobName - Unique name for the job (e.g., 'scheduledReminders', 'autoScheduling')
 * @param error - The error that occurred
 */
export function trackJobError(jobName: string, error: any): void {
  const entry = jobFailures.get(jobName) || {
    count: 0,
    lastError: '',
    lastTime: new Date(),
    consecutiveFailures: 0,
  };

  entry.count++;
  entry.consecutiveFailures++;
  entry.lastError = error?.message || String(error);
  entry.lastTime = new Date();
  jobFailures.set(jobName, entry);

  // Determine severity based on consecutive failures
  const level = entry.consecutiveFailures >= 5 ? 'error' : entry.consecutiveFailures >= 3 ? 'warning' : 'info';

  // Always log to console
  console.error(`[${jobName}] Error (failure #${entry.count}, consecutive: ${entry.consecutiveFailures}):`, error);

  // Send to Sentry with context (only for warning/error level to reduce noise)
  if (level !== 'info' && process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        jobName,
        failureCount: entry.count.toString(),
        consecutiveFailures: entry.consecutiveFailures.toString(),
      },
      level: level as 'warning' | 'error',
      extra: {
        lastSuccessTime: jobSuccesses.get(jobName)?.toISOString() || 'never',
      },
    });
  }
}

/**
 * Track a successful job execution (resets consecutive failure count)
 *
 * @param jobName - Unique name for the job
 */
export function trackJobSuccess(jobName: string): void {
  jobSuccesses.set(jobName, new Date());

  const entry = jobFailures.get(jobName);
  if (entry) {
    entry.consecutiveFailures = 0;
  }
}

/**
 * Get health status for all tracked jobs
 *
 * @returns Object with job names as keys and failure info as values
 */
export function getJobHealthStatus(): Record<string, {
  totalFailures: number;
  consecutiveFailures: number;
  lastError: string;
  lastFailure: string;
  lastSuccess: string;
  status: 'healthy' | 'degraded' | 'failing';
}> {
  const status: Record<string, any> = {};

  for (const [jobName, failure] of jobFailures) {
    const lastSuccess = jobSuccesses.get(jobName);
    status[jobName] = {
      totalFailures: failure.count,
      consecutiveFailures: failure.consecutiveFailures,
      lastError: failure.lastError,
      lastFailure: failure.lastTime.toISOString(),
      lastSuccess: lastSuccess?.toISOString() || 'never',
      status: failure.consecutiveFailures >= 5 ? 'failing' :
              failure.consecutiveFailures >= 3 ? 'degraded' : 'healthy',
    };
  }

  return status;
}

/**
 * Wrap a background job function with error tracking
 *
 * @param jobName - Unique name for the job
 * @param fn - The async function to wrap
 * @returns Wrapped function that tracks errors and successes
 */
export function withJobTracking<T>(
  jobName: string,
  fn: () => Promise<T>
): () => Promise<T | undefined> {
  return async () => {
    try {
      const result = await fn();
      trackJobSuccess(jobName);
      return result;
    } catch (error) {
      trackJobError(jobName, error);
      return undefined;
    }
  };
}

/**
 * Create a tracked job runner for use with setInterval
 *
 * @param jobName - Unique name for the job
 * @param fn - The async function to run
 * @returns Function suitable for setInterval that handles errors
 */
export function createTrackedJob(
  jobName: string,
  fn: () => Promise<any>
): () => void {
  return () => {
    fn()
      .then(() => trackJobSuccess(jobName))
      .catch((error) => trackJobError(jobName, error));
  };
}
