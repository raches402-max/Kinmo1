import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
import {
  Users,
  CheckCircle2,
  Compass,
  Calendar,
  MapPin,
  Sparkles,
  Link2Off,
} from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

// Types for the join preview API response
interface JoinPreviewData {
  group: {
    id: string;
    name: string;
    emoji: string;
    locationBase: string;
  };
  memberStats: {
    total: number;
    joined: number;
    percentage: number;
  };
  socialProof: {
    names: string[];
    remainingCount: number;
  } | null;
  upcomingEvent: {
    title: string;
    eventDate: string;
    eventTime: string;
  } | null;
  venuesBeingConsidered: number;
}

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Replit icon component
function ReplitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M7 5.5C7 4.67157 7.67157 4 8.5 4H15.5C16.3284 4 17 4.67157 17 5.5V12H8.5C7.67157 12 7 11.3284 7 10.5V5.5Z" fill="#F26207"/>
      <path d="M17 12H25.5C26.3284 12 27 12.6716 27 13.5V18.5C27 19.3284 26.3284 20 25.5 20H17V12Z" fill="#F26207"/>
      <path d="M7 21.5C7 20.6716 7.67157 20 8.5 20H17V26.5C17 27.3284 16.3284 28 15.5 28H8.5C7.67157 28 7 27.3284 7 26.5V21.5Z" fill="#F26207"/>
    </svg>
  );
}

export default function JoinGroup() {
  const [, params] = useRoute("/join/:shareableLink");
  const [, navigate] = useLocation();
  const shareableLink = params?.shareableLink;
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [joinedSuccessfully, setJoinedSuccessfully] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const isLoggedIn = !!user;

  // Fetch join preview data
  const { data: previewData, isLoading, error } = useQuery<JoinPreviewData>({
    queryKey: ["/api/groups/join-preview", shareableLink],
    enabled: !!shareableLink,
  });

  // Check if link is closed from error
  const linkClosed = (error as any)?.linkClosed;

  // Join mutation - called after user is authenticated
  const joinMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${previewData?.group.id}/join`, {
        // No name/email needed - will be pulled from authenticated user
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", previewData?.group.id] });
      setJoinedSuccessfully(true);
      setIsJoining(false);
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
      setIsJoining(false);
    },
  });

  // Auto-join when user becomes authenticated and we have preview data
  useEffect(() => {
    if (isLoggedIn && previewData && !joinedSuccessfully && !isJoining && !joinMutation.isPending) {
      setIsJoining(true);
      joinMutation.mutate();
    }
  }, [isLoggedIn, previewData, joinedSuccessfully, isJoining]);

  // Handle auth redirect
  const handleGoogleAuth = () => {
    const returnTo = `/join/${shareableLink}`;
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const handleReplitAuth = () => {
    const returnTo = `/join/${shareableLink}`;
    // Store returnTo in sessionStorage for Replit auth (it doesn't support returnTo param)
    sessionStorage.setItem("authReturnTo", returnTo);
    window.location.href = `/api/login`;
  };

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="flex justify-center">
                <Skeleton className="h-20 w-20 rounded-2xl" />
              </div>
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Link closed state
  if (linkClosed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Link2Off className="h-8 w-8 text-zinc-400" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Invite Link Inactive
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              This invite link is no longer active. Please contact the group organizer for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (!previewData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Invalid Link
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              This group invitation link is not valid.
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { group, memberStats, socialProof, upcomingEvent, venuesBeingConsidered } = previewData;

  // Success screen after joining
  if (joinedSuccessfully) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        {/* Decorative background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200/30 dark:bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-md relative overflow-hidden border-0 shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />

          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              You're in!
            </h1>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-3xl">{group.emoji}</span>
              <span className="text-xl font-medium text-zinc-700 dark:text-zinc-300">
                {group.name}
              </span>
            </div>

            <p className="text-zinc-500 dark:text-zinc-400 mb-8">
              You've joined the group! You can now see events, vote on venues, and help plan outings together.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-left">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">What's next?</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Discover venues, vote on places, and see what the group is planning!
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/group/${group.id}`)}
              className="w-full mt-8 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold"
            >
              <Compass className="h-4 w-4 mr-2" />
              Go to Group
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Joining in progress (after auth redirect)
  if (isJoining || joinMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Joining {group.name}...
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Just a moment while we add you to the group.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main invite screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-200/30 dark:bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative overflow-hidden border-0 shadow-xl">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-rose-400 to-pink-400" />

        <CardContent className="p-8">
          {/* Group identity */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 text-4xl mb-4 shadow-lg ring-4 ring-white dark:ring-zinc-800">
              {group.emoji || <Users className="h-10 w-10 text-orange-600" />}
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              {group.name}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
              <KinmoIcon size={14} />
              You've been invited to join
            </p>
          </div>

          {/* Value preview */}
          <div className="space-y-3 mb-8">
            {/* Location */}
            {group.locationBase && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                <MapPin className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Based in {group.locationBase}
                </span>
              </div>
            )}

            {/* Upcoming event */}
            {upcomingEvent && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Next up: {upcomingEvent.title}
                </span>
              </div>
            )}

            {/* Venues being considered */}
            {venuesBeingConsidered > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                <Sparkles className="h-4 w-4 text-rose-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {venuesBeingConsidered} venue{venuesBeingConsidered !== 1 ? 's' : ''} being considered
                </span>
              </div>
            )}

            {/* Member count */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
              <Users className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {memberStats.total} member{memberStats.total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Social proof */}
          {socialProof && (
            <div className="text-center mb-8">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {socialProof.names.length === 1 && (
                  <>{socialProof.names[0]} has joined</>
                )}
                {socialProof.names.length === 2 && (
                  <>{socialProof.names[0]} and {socialProof.names[1]} have joined</>
                )}
                {socialProof.names.length >= 3 && socialProof.remainingCount === 0 && (
                  <>{socialProof.names[0]}, {socialProof.names[1]}, and {socialProof.names[2]} have joined</>
                )}
                {socialProof.names.length >= 3 && socialProof.remainingCount > 0 && (
                  <>{socialProof.names[0]}, {socialProof.names[1]}, and {socialProof.remainingCount + 1} others have joined</>
                )}
              </p>
            </div>
          )}

          {/* Auth buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleGoogleAuth}
              className="w-full h-12 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 shadow-sm font-medium"
              variant="outline"
            >
              <GoogleIcon className="h-5 w-5 mr-3" />
              Continue with Google
            </Button>

            <Button
              onClick={handleReplitAuth}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-medium dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
            >
              <ReplitIcon className="h-5 w-5 mr-3" />
              Continue with Replit
            </Button>
          </div>

          {/* Already have an account */}
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
            Already have an account?{" "}
            <button
              onClick={handleReplitAuth}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 font-medium"
            >
              Log in
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
