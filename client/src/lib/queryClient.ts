import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { retryOperation } from "./errorHandling";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    try {
      const json = await res.json();
      errorMessage = json.message || json.error || res.statusText;
    } catch {
      errorMessage = (await res.text()) || res.statusText;
    }

    const error: any = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options: {
    retry?: boolean;
    maxRetries?: number;
    timeout?: number;
  } = {}
): Promise<any> {
  const {
    retry = false,
    maxRetries = 3,
    timeout = 30000, // 30 seconds for API calls (some are slow)
  } = options;

  const makeRequest = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Better error message for timeouts
      if (error.name === 'AbortError') {
        const timeoutError: any = new Error(`Request timed out after ${timeout / 1000}s. The server might be busy.`);
        timeoutError.code = 'ETIMEDOUT';
        throw timeoutError;
      }

      // Better error message for network failures
      if (error.message?.includes('fetch')) {
        const networkError: any = new Error('Network error: Unable to connect. Please check your internet connection.');
        networkError.status = 0;
        throw networkError;
      }

      throw error;
    }
  };

  // Use retry logic if enabled
  if (retry) {
    return retryOperation(makeRequest, {
      maxRetries,
      initialDelay: 1000,
      maxDelay: 10000,
      onRetry: (attempt, error) => {
        console.log(`[API Retry] Attempt ${attempt}/${maxRetries} for ${url}:`, error.message);
      },
    });
  }

  return makeRequest();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  timeout?: number;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, timeout = 10000 }) =>
  async ({ queryKey }) => {
    // Add timeout to prevent indefinite waiting
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Provide better error message for timeouts
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms. Please check your connection and try again.`);
      }

      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
