import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar, Check, AlertCircle, Clock } from "lucide-react";
import { DateAvailabilityGrid, type DateSpecificAvailability, createFullDateAvailability } from "@/components/DateAvailabilityGrid";
import { format, parseISO, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

interface PulsePageData {
  pulse: {
    id: string;
    startDate: string;
    endDate: string;
    targetEventDate: string | null;
    status: string;
    memberCount: number;
    expiresAt: string;
  };
  group: {
    name: string;
    emoji: string;
  };
  member: {
    name: string;
  };
  existingResponse: {
    availability: DateSpecificAvailability;
    notes: string | null;
    updatedAt: string;
  };
  aggregatedAvailability: Record<string, { morning: number; afternoon: number; evening: number }>;
  totalResponses: number;
}

export default function AvailabilityPulsePage() {
  const params = useParams<{ pulseId: string; responseToken: string }>();
  const { pulseId, responseToken } = params;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [availability, setAvailability] = useState<DateSpecificAvailability>({});
  const [notes, setNotes] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch pulse data
  const { data, isLoading, error } = useQuery<PulsePageData>({
    queryKey: ["availability-pulse", pulseId, responseToken],
    queryFn: async () => {
      const res = await fetch(`/api/availability-pulse/${pulseId}/respond/${responseToken}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to load availability pulse");
      }
      return res.json();
    },
    enabled: !!pulseId && !!responseToken,
  });

  // Initialize form with existing response
  useEffect(() => {
    if (data?.existingResponse) {
      setAvailability(data.existingResponse.availability || {});
      setNotes(data.existingResponse.notes || "");
    }
  }, [data]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (payload: { availability: DateSpecificAvailability; notes: string }) => {
      const res = await fetch(`/api/availability-pulse/${pulseId}/respond/${responseToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to submit availability");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Availability saved!",
        description: "Thanks for letting us know when you're free.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["availability-pulse", pulseId, responseToken] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleAvailabilityChange = (newAvailability: DateSpecificAvailability) => {
    setAvailability(newAvailability);
    setHasChanges(true);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setHasChanges(true);
  };

  const handleSubmit = () => {
    submitMutation.mutate({ availability, notes });
  };

  const handleSelectAll = () => {
    if (!data) return;
    const startDate = parseISO(data.pulse.startDate);
    const endDate = parseISO(data.pulse.endDate);
    setAvailability(createFullDateAvailability(startDate, endDate));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading availability...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">Unable to Load</h2>
            <p className="text-muted-foreground">
              {error?.message || "This availability link may have expired or is no longer valid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { pulse, group, member, aggregatedAvailability, totalResponses, existingResponse } = data;
  const startDate = parseISO(pulse.startDate);
  const endDate = parseISO(pulse.endDate);
  const expiresAt = parseISO(pulse.expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const isExpired = pulse.status !== 'active' || daysUntilExpiry < 0;
  const targetDate = pulse.targetEventDate ? parseISO(pulse.targetEventDate) : null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">{group.emoji}</div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            Hey {member.name}! When are you free?
          </p>
        </div>

        {/* Expired notice */}
        {isExpired && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <p className="font-medium">This availability window has closed</p>
              <p className="text-sm text-muted-foreground mt-1">
                The group has already moved forward with planning.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info card */}
        {!isExpired && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm">
                    We're planning something for around{" "}
                    <span className="font-medium">
                      {targetDate ? format(targetDate, 'MMMM d') : 'soon'}
                    </span>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Let us know when you're available over the next few weeks.
                    No pressure - we'll work with what we have!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {daysUntilExpiry > 0
                    ? `${daysUntilExpiry} days left to respond`
                    : "Closing soon"}
                </span>
                <span className="mx-2">•</span>
                <span>{totalResponses} of {pulse.memberCount} have responded</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Availability grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Availability</CardTitle>
            <CardDescription>
              Select the times that work for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateAvailabilityGrid
              startDate={startDate}
              endDate={endDate}
              value={availability}
              onChange={handleAvailabilityChange}
              groupData={aggregatedAvailability}
              totalMembers={pulse.memberCount}
              readOnly={isExpired}
            />

            {!isExpired && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="w-full"
              >
                I'm flexible - select all times
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {!isExpired && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes (optional)</CardTitle>
              <CardDescription>
                Any constraints we should know about?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g., Out of town Dec 20-22, work party on Thursday..."
                value={notes}
                onChange={handleNotesChange}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        {/* Submit button */}
        {!isExpired && (
          <div className="space-y-3">
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full"
              size="lg"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {hasChanges ? "Save Availability" : "Update Availability"}
                </>
              )}
            </Button>

            {existingResponse.updatedAt && !hasChanges && (
              <p className="text-center text-xs text-muted-foreground">
                Last updated {format(parseISO(existingResponse.updatedAt), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          This link is just for you. Don't share it with others.
        </p>
      </div>
    </div>
  );
}
