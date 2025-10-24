import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, CheckCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error || !claimData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please contact the group organizer for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Already claimed
  if (claimData.alreadyClaimed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle>Already Claimed</CardTitle>
            </div>
            <CardDescription>
              You've already claimed this membership. Check your dashboard to see your group's activities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/")}
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Kinmo.ai</h1>
          </div>
          <p className="text-muted-foreground">AI-Powered Group Planning</p>
        </div>

        {/* Invitation Card */}
        <Card>
          <CardHeader>
            <div className="text-center space-y-2">
              <div className="text-5xl mb-2">{claimData.groupEmoji}</div>
              <CardTitle className="text-2xl">You're Invited!</CardTitle>
              <CardDescription className="text-base">
                Join {claimData.groupName} on Kinmo.ai
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Your name</p>
                <p className="font-medium">{claimData.name}</p>
              </div>
              {claimData.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{claimData.email}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Claim your membership to see group activities, vote on venues, and RSVP to events
              </p>

              {!user ? (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => window.location.href = "/api/login"}
                    data-testid="button-sign-in"
                  >
                    Sign In with Replit
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Sign in to claim your membership
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  data-testid="button-claim-membership"
                >
                  {claimMutation.isPending ? "Claiming..." : "Claim Your Membership"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
