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

interface JobRegistration {
  intervalMs?: number;
  staleAfterMs?: number;
  registeredAt: Date;
}

interface JobHealthEntry {
  totalFailures: number;
  consecutiveFailures: number;
  lastError: string;
  lastFailure: string;
  lastSuccess: string;
  lastStartedAt: string;
  intervalMs: number | null;
  staleAfterMs: number | null;
  millisSinceLastSuccess: number | null;
  millisSinceLastStart: number | null;
  reason: string | null;
  status: 'healthy' | 'degraded' | 'failing';
}

// In-memory tracking of job failures
const jobFailures = new Map<string, JobFailure>();

// Track job successes to reset consecutive failure count
const jobSuccesses = new Map<string, Date>();

// Track job registrations / last starts so health checks can detect stale jobs
const jobRegistrations = new Map<string, JobRegistration>();
const jobStarts = new Map<string, Date>();

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

function registerJob(jobName: string, options?: { intervalMs?: number; staleAfterMs?: number }): void {
  if (jobRegistrations.has(jobName)) {
    return;
  }

  const intervalMs = options?.intervalMs;
  jobRegistrations.set(jobName, {
    intervalMs,
    staleAfterMs: options?.staleAfterMs ?? (intervalMs ? intervalMs * 2 + 5 * 60 * 1000 : undefined),
    registeredAt: new Date(),
  });
}

function trackJobStart(jobName: string): void {
  jobStarts.set(jobName, new Date());
}

/**
 * Get health status for all tracked jobs
 *
 * @returns Object with job names as keys and failure info as values
 */
export function getJobHealthStatus(): Record<string, JobHealthEntry> {
  const status: Record<string, JobHealthEntry> = {};
  const jobNames = new Set<string>([
    ...jobRegistrations.keys(),
    ...jobFailures.keys(),
    ...jobSuccesses.keys(),
    ...jobStarts.keys(),
  ]);

  for (const jobName of jobNames) {
    const registration = jobRegistrations.get(jobName);
    const failure = jobFailures.get(jobName);
    const lastSuccess = jobSuccesses.get(jobName);
    const lastStartedAt = jobStarts.get(jobName);
    const staleAfterMs = registration?.staleAfterMs;
    const millisSinceLastSuccess = lastSuccess ? Date.now() - lastSuccess.getTime() : null;
    const millisSinceLastStart = lastStartedAt ? Date.now() - lastStartedAt.getTime() : null;
    const isStale = Boolean(staleAfterMs && millisSinceLastSuccess !== null && millisSinceLastSuccess > staleAfterMs);
    const hasNeverSucceededPastDeadline = Boolean(
      staleAfterMs && !lastSuccess && registration && Date.now() - registration.registeredAt.getTime() > staleAfterMs
    );
    const isLongRunningWithoutSuccess = Boolean(
      staleAfterMs && millisSinceLastStart !== null && millisSinceLastStart > staleAfterMs && (!lastSuccess || lastStartedAt! > lastSuccess)
    );

    let jobStatus: JobHealthEntry['status'] = 'healthy';
    let reason: string | null = null;

    if ((failure?.consecutiveFailures ?? 0) >= 5) {
      jobStatus = 'failing';
      reason = 'repeated_failures';
    } else if ((failure?.consecutiveFailures ?? 0) >= 3) {
      jobStatus = 'degraded';
      reason = 'recent_failures';
    } else if (isLongRunningWithoutSuccess) {
      jobStatus = 'degraded';
      reason = 'run_started_but_not_completed';
    } else if (isStale) {
      jobStatus = 'degraded';
      reason = 'stale_success';
    } else if (hasNeverSucceededPastDeadline) {
      jobStatus = 'degraded';
      reason = 'never_succeeded';
    }

    status[jobName] = {
      totalFailures: failure?.count ?? 0,
      consecutiveFailures: failure?.consecutiveFailures ?? 0,
      lastError: failure?.lastError ?? '',
      lastFailure: failure?.lastTime.toISOString() ?? 'never',
      lastSuccess: lastSuccess?.toISOString() ?? 'never',
      lastStartedAt: lastStartedAt?.toISOString() ?? 'never',
      intervalMs: registration?.intervalMs ?? null,
      staleAfterMs: staleAfterMs ?? null,
      millisSinceLastSuccess,
      millisSinceLastStart,
      reason,
      status: jobStatus,
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
  fn: () => Promise<any>,
  options?: { intervalMs?: number; staleAfterMs?: number }
): () => void {
  registerJob(jobName, options);

  return () => {
    trackJobStart(jobName);
    fn()
      .then(() => trackJobSuccess(jobName))
      .catch((error) => trackJobError(jobName, error));
  };
}
