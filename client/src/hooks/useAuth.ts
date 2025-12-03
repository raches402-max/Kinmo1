// Reference: javascript_log_in_with_replit blueprint
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "../lib/queryClient";

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null on 401 instead of throwing
    retry: 1, // Retry once on failure to handle transient network issues
    staleTime: 5 * 60 * 1000, // 5 minutes - refresh auth state periodically
    refetchOnWindowFocus: true, // Recheck auth when user returns to tab
    refetchInterval: 10 * 60 * 1000, // Recheck auth every 10 minutes
  });

  // Log errors for debugging
  if (error) {
    console.error('[Auth] Authentication check failed:', error);
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
