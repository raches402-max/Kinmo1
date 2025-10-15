import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, XCircle, MapPin, DollarSign, Calendar } from "lucide-react";

type Member = {
  id: string;
  name: string;
  rsvpStatus: string | null;
  claimToken: string | null;
};

type Group = {
  id: string;
  name: string;
  emoji: string;
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  shareableLink: string;
};

export default function InvitePage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token;
  const { toast } = useToast();

  // State for claimed member and RSVP flow
  const [claimedMemberId, setClaimedMemberId] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [selectedRsvp, setSelectedRsvp] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  // Preference form state
  const [memberLocation, setMemberLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  // Load claim data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`claim_${token}`);
    if (stored) {
      const data = JSON.parse(stored);
      setClaimedMemberId(data.memberId);
      setClaimToken(data.claimToken);
      setSelectedRsvp(data.rsvpStatus);
    }
  }, [token]);

  // Save claim data to localStorage
  const saveClaimData = (memberId: string, token: string, rsvp?: string) => {
    const data = {
      memberId,
      claimToken: token,
      rsvpStatus: rsvp || selectedRsvp,
    };
    localStorage.setItem(`claim_${params?.token}`, JSON.stringify(data));
  };

  // Fetch group by shareable link
  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups/by-link", token],
    enabled: !!token,
  });

  // Fetch group members
  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/groups", group?.id, "members"],
    enabled: !!group?.id,
  });

  // Claim member mutation
  const claimMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const newClaimToken = crypto.randomUUID();
      const response = await apiRequest("POST", `/api/members/${memberId}/claim`, {
        claimToken: newClaimToken,
      });
      return { member: response, claimToken: newClaimToken };
    },
    onSuccess: (data) => {
      setClaimedMemberId(data.member.id);
      setClaimToken(data.claimToken);
      saveClaimData(data.member.id, data.claimToken);
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group?.id, "members"] });
      toast({
        title: "Welcome!",
        description: `You've claimed your spot as ${data.member.name}`,
      });
    },
    onError: (error: any) => {
      // Check if this is an "already claimed" error
      const isAlreadyClaimed = error.message?.includes("already been claimed");
      toast({
        title: isAlreadyClaimed ? "Already claimed" : "Error",
        description: isAlreadyClaimed 
          ? "This member has already been claimed by someone else. Please choose a different name or contact the organizer."
          : error.message,
        variant: "destructive",
      });
    },
  });

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async (rsvpStatus: string) => {
      return await apiRequest("PATCH", `/api/members/${claimedMemberId}/rsvp`, {
        rsvpStatus,
        claimToken,
      });
    },
    onSuccess: (_, rsvpStatus) => {
      setSelectedRsvp(rsvpStatus);
      saveClaimData(claimedMemberId!, claimToken!, rsvpStatus);
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group?.id, "members"] });
      toast({
        title: "RSVP updated",
        description: "Your response has been recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Preferences mutation
  const preferencesMutation = useMutation({
    mutationFn: async (preferences: any) => {
      return await apiRequest("PATCH", `/api/members/${claimedMemberId}/preferences`, {
        ...preferences,
        claimToken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group?.id, "members"] });
      toast({
        title: "Preferences saved",
        description: "Thanks for helping us plan better!",
      });
      setShowPreferences(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClaim = (memberId: string) => {
    claimMutation.mutate(memberId);
  };

  const handleRsvp = (status: string) => {
    rsvpMutation.mutate(status);
  };

  const handleSavePreferences = () => {
    const prefs: any = {};
    if (memberLocation) prefs.memberLocation = memberLocation;
    if (budgetMin) prefs.memberBudgetMin = parseInt(budgetMin);
    if (budgetMax) prefs.memberBudgetMax = parseInt(budgetMax);

    preferencesMutation.mutate(prefs);
  };

  if (groupLoading || membersLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Group not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const claimedMember = members.find(m => m.id === claimedMemberId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Group Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{group.emoji}</span>
            <div>
              <CardTitle className="text-2xl">{group.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4" />
                {group.locationBase}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Claim Member / RSVP Flow */}
      {!claimedMemberId ? (
        <Card>
          <CardHeader>
            <CardTitle>Who are you?</CardTitle>
            <CardDescription>Select your name to RSVP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {members.map((member) => (
                <Button
                  key={member.id}
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => handleClaim(member.id)}
                  disabled={claimMutation.isPending}
                  data-testid={`button-claim-${member.name}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{member.name}</span>
                    {member.rsvpStatus && (
                      <Badge variant="secondary">
                        {member.rsvpStatus === "going" && "Going"}
                        {member.rsvpStatus === "maybe" && "Maybe"}
                        {member.rsvpStatus === "not_going" && "Can't make it"}
                      </Badge>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* RSVP Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Hi {claimedMember?.name}!</CardTitle>
              <CardDescription>Will you be joining us?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Button
                  variant={selectedRsvp === "going" ? "default" : "outline"}
                  className="justify-start gap-3 h-auto py-3"
                  onClick={() => handleRsvp("going")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-going"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Going</div>
                    <div className="text-sm text-muted-foreground">Count me in!</div>
                  </div>
                </Button>

                <Button
                  variant={selectedRsvp === "maybe" ? "default" : "outline"}
                  className="justify-start gap-3 h-auto py-3"
                  onClick={() => handleRsvp("maybe")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-maybe"
                >
                  <Circle className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Maybe</div>
                    <div className="text-sm text-muted-foreground">I'll try to make it</div>
                  </div>
                </Button>

                <Button
                  variant={selectedRsvp === "not_going" ? "default" : "outline"}
                  className="justify-start gap-3 h-auto py-3"
                  onClick={() => handleRsvp("not_going")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-not-going"
                >
                  <XCircle className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Can't make it</div>
                    <div className="text-sm text-muted-foreground">Not this time</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Optional Preferences */}
          {selectedRsvp && (
            <Card>
              <CardHeader>
                <CardTitle>Want to help us plan better?</CardTitle>
                <CardDescription>
                  Share your preferences so we can find the perfect spots
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showPreferences ? (
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      onClick={() => setShowPreferences(true)}
                      data-testid="button-show-preferences"
                    >
                      Sure, let's do it
                    </Button>
                    <Button variant="outline" data-testid="button-skip-preferences">
                      No thanks
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Location */}
                    <div className="space-y-2">
                      <Label htmlFor="location" className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Where are you coming from?
                      </Label>
                      <Input
                        id="location"
                        placeholder="e.g., Oakland, CA"
                        value={memberLocation}
                        onChange={(e) => setMemberLocation(e.target.value)}
                        data-testid="input-member-location"
                      />
                      <p className="text-xs text-muted-foreground">
                        Helps us find spots convenient for everyone
                      </p>
                    </div>

                    <Separator />

                    {/* Budget */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Your budget per person?
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Input
                            type="number"
                            placeholder="Min"
                            value={budgetMin}
                            onChange={(e) => setBudgetMin(e.target.value)}
                            data-testid="input-budget-min"
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={budgetMax}
                            onChange={(e) => setBudgetMax(e.target.value)}
                            data-testid="input-budget-max"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        We'll balance everyone's budgets
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleSavePreferences}
                        disabled={preferencesMutation.isPending}
                        data-testid="button-save-preferences"
                      >
                        Save preferences
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowPreferences(false)}
                        data-testid="button-cancel-preferences"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
