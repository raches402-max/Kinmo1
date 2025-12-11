/**
 * Link Member Account Page - Phase 2: Account Dashboard Unlock
 *
 * After OAuth, this page links the authenticated user to their existing member record
 * Shows a celebration moment and reveals the full dashboard
 */

import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Check } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

export default function LinkMemberAccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");
  const hasAttemptedLink = useRef(false);

  // Get memberId from localStorage (stored when clicking "Create Account")
  const memberId = localStorage.getItem("linkMemberId");
  const returnPath = localStorage.getItem("linkReturnPath") || "/";

  // Fetch member details to show in celebration
  const { data: member } = useQuery<any>({
    queryKey: [`/api/members/${memberId}`],
    enabled: !!memberId,
  });

  // Fetch group details for celebration
  useEffect(() => {
    if (member?.groupId) {
      fetch(`/api/groups/${member.groupId}`)
        .then((res) => res.json())
        .then((group) => setGroupName(group.name))
        .catch(console.error);
    }
  }, [member?.groupId]);

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error("No member ID found");

      return await apiRequest("POST", "/api/members/link-account", {
        memberId,
      });
    },
    onSuccess: (data: any) => {
      console.log("[Link Account] Successfully linked member to user");

      // Clear localStorage
      localStorage.removeItem("linkMemberId");
      localStorage.removeItem("linkReturnPath");

      // Invalidate queries to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });

      // Show celebration
      setShowCelebration(true);

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        setLocation(returnPath);
      }, 3000);
    },
    onError: (error: Error) => {
      console.error("[Link Account] Error:", error);
      setLinkError(error.message || "Failed to link account. Please try again.");
    },
  });

  // Auto-link when user is authenticated
  useEffect(() => {
    if (user && memberId && !linkMutation.isPending && !hasAttemptedLink.current) {
      console.log("[Link Account] Attempting to link member:", memberId);
      hasAttemptedLink.current = true;
      linkMutation.mutate();
    }
  }, [user, memberId, linkMutation.isPending]);

  // Redirect if no memberId
  useEffect(() => {
    if (!authLoading && !user) {
      // Not authenticated yet, redirect to login
      const loginUrl = `/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      window.location.href = loginUrl;
    }

    if (!authLoading && user && !memberId) {
      console.log("[Link Account] No member ID found, redirecting to dashboard");
      setLocation("/");
    }
  }, [authLoading, user, memberId, setLocation]);

  // Loading state
  if (authLoading || linkMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-purple-600" />
            <h2 className="text-xl font-semibold mb-2">Creating Your Account</h2>
            <p className="text-gray-600">Linking your account to your group membership...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Celebration screen
  if (showCelebration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-2 border-purple-200 shadow-2xl">
          <CardContent className="p-12 text-center">
            {/* Animated Kinmo sun */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <KinmoIcon size={80} color="hsl(280 60% 65%)" className="animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center animate-ping">
                <KinmoIcon size={64} color="hsl(210 70% 60%)" className="opacity-40" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Welcome to {groupName || "Your Group"}! 🎉
            </h1>

            <p className="text-xl text-gray-700 mb-8">
              Your dashboard has been unlocked!
            </p>

            {/* Features unlocked */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
              <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-purple-100 rounded-full p-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold">All Events in One Place</h3>
                </div>
                <p className="text-sm text-gray-600">
                  View all past and upcoming events for your group
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-100 rounded-full p-2">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold">Set Standing Preferences</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Influence all future scheduling with your preferences
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-green-100 rounded-full p-2">
                    <KinmoIcon size={20} color="hsl(145 60% 40%)" />
                  </div>
                  <h3 className="font-semibold">Vote on Venues</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Choose between venue options for future events
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-orange-100 rounded-full p-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold">Event History</h3>
                </div>
                <p className="text-sm text-gray-600">
                  See all the events you've attended with the group
                </p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Redirecting to your dashboard...
            </p>

            <Button
              onClick={() => setLocation(returnPath)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Go to Dashboard Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state with retry
  if (linkError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Link Failed</h2>
            <p className="text-gray-600 mb-6">
              {linkError}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setLocation(returnPath)}
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  setLinkError(null);
                  hasAttemptedLink.current = false;
                  linkMutation.mutate();
                }}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: nothing to show (should not reach here normally)
  return null;
}
