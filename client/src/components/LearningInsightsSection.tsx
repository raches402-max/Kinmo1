/**
 * Learning Insights Section Component
 * Displays learning system insights inline within the Insights tab
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Brain, Ban, Users, TrendingUp, Calendar, AlertCircle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

interface LearningInsightsSectionProps {
  groupId: string;
}

interface LearningInsightsData {
  groupId: string;
  groupName: string;
  learningInsights: {
    rejectedVenues: {
      count: number;
      venues: string[];
      description: string;
    };
    memberConstraints: {
      count: number;
      constraints: Array<{
        memberId: number;
        memberName: string;
        budgetConcern: boolean;
        distanceConcern: boolean;
        scheduleConflicts: string[];
        notes: string | null;
      }>;
      description: string;
    };
    engagement: {
      totalMembers: number;
      active: number;
      atRisk: number;
      inactive: number;
      scores: Array<{
        memberId: number;
        memberName: string;
        status: 'active' | 'at-risk' | 'inactive';
        responseRate: number;
        attendanceRate: number;
        totalInvites: number;
        totalResponses: number;
        totalAttended: number;
      }>;
      description: string;
    };
    frequency: {
      current: string;
      feedbackCount: number;
      moreOften: number;
      lessOften: number;
      justRight: number;
      description: string;
    };
  };
}

export function LearningInsightsSection({ groupId }: LearningInsightsSectionProps) {
  const { toast } = useToast();

  // Fetch learning insights
  const { data, isLoading, error } = useQuery<LearningInsightsData>({
    queryKey: [`/api/groups/${groupId}/learning-insights`],
  });

  // Remove venue from blacklist mutation
  const removeVenueMutation = useMutation({
    mutationFn: async (venueName: string) => {
      return apiRequest('DELETE', `/api/groups/${groupId}/rejected-venues`, { venueName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/learning-insights`] });
      toast({
        title: "Venue removed",
        description: "This venue can now be suggested again.",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Learning & Engagement</h3>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently fail if insights aren't available
  }

  const { learningInsights } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'at-risk':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'inactive':
        return 'bg-red-500/10 text-red-700 border-red-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'at-risk':
        return <AlertCircle className="h-4 w-4" />;
      case 'inactive':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Check if there's any data to show
  const hasData =
    learningInsights.rejectedVenues.count > 0 ||
    learningInsights.memberConstraints.count > 0 ||
    learningInsights.engagement.scores.length > 0;

  if (!hasData) {
    return null; // Don't show if no learning data yet
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Learning & Engagement</h3>
        <Badge variant="secondary" className="ml-2">Auto-Learned</Badge>
      </div>

      <div className="space-y-4">
        {/* Auto-Blacklisted Venues */}
        {learningInsights.rejectedVenues.count > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Auto-Blacklisted Venues
              </CardTitle>
              <CardDescription className="text-xs">
                {learningInsights.rejectedVenues.count} venues excluded from future suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {learningInsights.rejectedVenues.venues.slice(0, 5).map((venue) => (
                  <div key={venue} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span className="truncate">{venue}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from blacklist?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{venue}" will be able to appear in future AI suggestions again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeVenueMutation.mutate(venue)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
                {learningInsights.rejectedVenues.count > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    + {learningInsights.rejectedVenues.count - 5} more venues
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Member Constraints */}
        {learningInsights.memberConstraints.count > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Member Constraints
              </CardTitle>
              <CardDescription className="text-xs">
                {learningInsights.memberConstraints.count} members with learned preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {learningInsights.memberConstraints.constraints.slice(0, 3).map((constraint) => (
                  <div key={constraint.memberId} className="border rounded-lg p-3">
                    <div className="font-medium text-sm mb-2">{constraint.memberName}</div>
                    <div className="flex flex-wrap gap-1">
                      {constraint.budgetConcern && (
                        <Badge variant="secondary" className="text-xs">Budget</Badge>
                      )}
                      {constraint.distanceConcern && (
                        <Badge variant="secondary" className="text-xs">Distance</Badge>
                      )}
                      {constraint.scheduleConflicts.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Schedule ({constraint.scheduleConflicts.length})
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {learningInsights.memberConstraints.count > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {learningInsights.memberConstraints.count - 3} more members
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engagement Scores Summary */}
        {learningInsights.engagement.scores.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Member Engagement
              </CardTitle>
              <CardDescription className="text-xs">
                Tracking {learningInsights.engagement.totalMembers} members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 border rounded-lg bg-green-500/5">
                  <div className="text-xl font-bold text-green-700">{learningInsights.engagement.active}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-yellow-500/5">
                  <div className="text-xl font-bold text-yellow-700">{learningInsights.engagement.atRisk}</div>
                  <div className="text-xs text-muted-foreground">At Risk</div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-red-500/5">
                  <div className="text-xl font-bold text-red-700">{learningInsights.engagement.inactive}</div>
                  <div className="text-xs text-muted-foreground">Inactive</div>
                </div>
              </div>

              {/* Alert for at-risk members */}
              {learningInsights.engagement.atRisk > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-200 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-yellow-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-yellow-900">
                      {learningInsights.engagement.atRisk} {learningInsights.engagement.atRisk === 1 ? 'member is' : 'members are'} at risk
                    </div>
                    <div className="text-yellow-800 mt-1">
                      Consider reviewing their preferences or event timing.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
