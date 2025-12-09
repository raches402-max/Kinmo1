import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogDescription as DialogDescription, ResponsiveDialogFooter as DialogFooter, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle } from "@/components/ui/responsive-dialog";
import { Sparkles, CheckCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

type MemberClaimData = {
  id: string;
  name: string;
  email: string | null;
  groupName: string;
  groupEmoji: string;
  alreadyClaimed: boolean;
};

export default function ClaimMemberPage() {
  const [, params] = useRoute("/claim/:claimToken");
  const claimToken = params?.claimToken;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Profile completion dialog
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [claimedMemberId, setClaimedMemberId] = useState<string | null>(null);

  // Verify claim token and get member data
  const { data: claimData, isLoading, error } = useQuery<MemberClaimData>({
    queryKey: ["/api/members/claim/verify", claimToken],
    enabled: !!claimToken,
  });

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/members/claim`, {
        claimToken,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Account claimed!",
        description: "You can now see your group's events and activities",
      });
      
      // Show optional profile setup dialog
      setClaimedMemberId(data.id);
      setShowProfileDialog(true);
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Store claim token in localStorage for later use (e.g., accessing /events)
  useEffect(() => {
    if (claimToken && claimData && !claimData.alreadyClaimed) {
      localStorage.setItem('claimToken', claimToken);
      console.log("[Claim Page] Stored claim token in localStorage");
    }
  }, [claimToken, claimData]);

  // Auto-claim when user is authenticated and claim data is loaded
  const hasAttemptedClaim = useRef(false);
  useEffect(() => {
    console.log("[Claim Page] Auto-claim check:", {
      hasUser: !!user,
      hasClaimData: !!claimData,
      alreadyClaimed: claimData?.alreadyClaimed,
      isPending: claimMutation.isPending,
      hasAttempted: hasAttemptedClaim.current
    });
    
    if (
      user && 
      claimData && 
      !claimData.alreadyClaimed && 
      !claimMutation.isPending &&
      !hasAttemptedClaim.current
    ) {
      console.log("[Claim Page] Auto-claiming membership...");
      hasAttemptedClaim.current = true;
      // Clear claim token from localStorage after claiming
      localStorage.removeItem('claimToken');
      claimMutation.mutate();
    }
  }, [user, claimData, claimMutation.isPending]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(38,35%,97%)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(44,87%,63%)] mx-auto mb-4"></div>
          <p className="text-[hsl(25,20%,40%)]">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error || !claimData) {
    return (
      <div className="min-h-screen bg-[hsl(38,35%,97%)] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <h2 className="text-xl font-semibold text-[hsl(25,30%,14%)]">Invalid Invitation</h2>
            <p className="text-sm text-[hsl(25,20%,40%)] mt-1">
              This invitation link is invalid or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Already claimed
  if (claimData.alreadyClaimed) {
    return (
      <div className="min-h-screen bg-[hsl(38,35%,97%)] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(145,50%,50%)]/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-[hsl(145,50%,50%)]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[hsl(25,30%,14%)]">Already Claimed</h2>
                <p className="text-sm text-[hsl(25,20%,40%)]">
                  You've already claimed this membership.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-[hsl(25,20%,40%)] mb-4">
              Check your dashboard to see your group's activities.
            </p>
            <Button
              className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
              onClick={() => setLocation("/")}
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(38,35%,97%)]">
      <div className="max-w-2xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center shadow-[0_2px_8px_rgba(242,201,76,0.3)]">
              <Sparkles className="h-6 w-6 text-[hsl(44,87%,63%)]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[hsl(25,30%,14%)]">Kinmo.ai</h1>
          <p className="text-[hsl(25,20%,40%)]">AI-Powered Group Planning</p>
        </div>

        {/* Invitation Card */}
        <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
          {/* Card Header with gradient */}
          <div className="px-6 py-6 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center mx-auto shadow-[0_2px_8px_rgba(242,201,76,0.3)]">
                <span className="text-4xl">{claimData.groupEmoji}</span>
              </div>
              <h2 className="text-2xl font-bold text-[hsl(25,30%,14%)]">You're Invited!</h2>
              <p className="text-base text-[hsl(25,20%,40%)]">
                Join {claimData.groupName} on Kinmo.ai
              </p>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-6">
            <div className="bg-[hsl(35,40%,95%)] p-4 rounded-xl border border-[hsl(44,70%,75%)]/50 space-y-3">
              <div>
                <p className="text-sm text-[hsl(25,20%,40%)]">Your name</p>
                <p className="font-semibold text-[hsl(25,30%,14%)]">{claimData.name}</p>
              </div>
              {claimData.email && (
                <div>
                  <p className="text-sm text-[hsl(25,20%,40%)]">Email</p>
                  <p className="font-semibold text-[hsl(25,30%,14%)]">{claimData.email}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[hsl(25,20%,40%)] text-center">
                Claim your membership to see group activities, vote on venues, and RSVP to events
              </p>

              {!user ? (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold shadow-[0_2px_8px_rgba(242,201,76,0.3)] transition-all duration-200"
                    onClick={() => window.location.href = "/api/login"}
                    data-testid="button-sign-in"
                  >
                    Sign In with Replit
                  </Button>
                  <p className="text-xs text-center text-[hsl(25,20%,40%)]">
                    Sign in to claim your membership
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold shadow-[0_2px_8px_rgba(242,201,76,0.3)] transition-all duration-200"
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  data-testid="button-claim-membership"
                >
                  {claimMutation.isPending ? "Claiming..." : "Claim Your Membership"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Completion Dialog */}
        <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
          <DialogContent data-testid="dialog-profile-setup">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <DialogTitle>Complete Your Profile</DialogTitle>
              </div>
              <DialogDescription>
                Help us personalize your experience by sharing your location, activity preferences, and availability. This is optional and can be done later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">What we'll ask:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Your home base location (for nearby suggestions)</li>
                  <li>Types of activities you enjoy</li>
                  <li>When you're typically free</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowProfileDialog(false);
                  setLocation("/");
                }}
                data-testid="button-skip-profile"
              >
                Skip for Now
              </Button>
              <Button 
                onClick={() => {
                  setShowProfileDialog(false);
                  setLocation(`/member-profile-setup/${claimedMemberId}`);
                }}
                data-testid="button-complete-profile"
              >
                Complete Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
