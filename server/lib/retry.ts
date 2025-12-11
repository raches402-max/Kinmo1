/**
 * Retry utility with exponential backoff
 *
 * Provides resilient execution of async operations with configurable retry behavior.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Custom function to determine if error should trigger retry */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Optional callback for logging retry attempts */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Default retry condition - retries on rate limits (429) and server errors (5xx)
 */
function defaultShouldRetry(error: any): boolean {
  // Get status code from various error formats
  const status = error.status || error.statusCode || error.response?.status;

  // Retry on rate limits
  if (status === 429) return true;

  // Retry on server errors (5xx)
  if (status >= 500 && status < 600) return true;

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Retry on generic timeout messages
  if (error.message?.toLowerCase().includes('timeout')) return true;

  // Don't retry client errors (4xx) except rate limits
  if (status >= 400 && status < 500) return false;

  // Default to retry for unknown errors (be resilient)
  return true;
}

/**
 * Execute an async function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Log retry attempt
      if (onRetry) {
        onRetry(error, attempt, delay);
      } else {
        console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms:`, error.message);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Wrap a function to always execute with retry logic
 *
 * @example
 * const resilientFetch = withRetryWrapper(fetch, { maxRetries: 3 });
 * const data = await resilientFetch('https://api.example.com/data');
 */
export function withRetryWrapper<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Execute with timeout - throws if operation takes too long
 *
 * @example
 * const result = await withTimeout(
 *   fetch('https://slow-api.example.com'),
 *   5000,
 *   'API request timed out'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${errorMessage} (after ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Execute with timeout and optional fallback value
 *
 * @example
 * const result = await withTimeoutFallback(
 *   fetchUserPreferences(),
 *   2000,
 *   { theme: 'default' } // fallback if timeout
 * );
 */
export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
  onFallback?: (timeoutMs: number) => void
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs);
  } catch (error: any) {
    if (error.message?.includes('timed out')) {
      if (onFallback) {
        onFallback(timeoutMs);
      } else {
        console.warn(`[Timeout] Operation timed out after ${timeoutMs}ms, using fallback`);
      }
      return fallback;
    }
    throw error;
  }
}
