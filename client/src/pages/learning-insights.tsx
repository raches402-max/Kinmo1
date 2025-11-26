import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Brain, Ban, Users, TrendingUp, Calendar, AlertCircle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

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

export default function LearningInsights() {
  const [match, params] = useRoute("/groups/:id/learning");
  const groupId = params?.id;
  const { toast } = useToast();

  // Fetch learning insights
  const { data, isLoading, error } = useQuery<LearningInsightsData>({
    queryKey: [`/api/groups/${groupId}/learning-insights`],
    enabled: !!groupId,
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-6xl">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-6xl">
          <Link href={`/groups/${groupId}`}>
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Group
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Failed to load learning insights.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: data.groupName || "Group", href: `/group/${groupId}` },
            { label: "Insights" }
          ]}
          className="mb-4"
        />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{data.groupName} - Learning Insights</h1>
          </div>
          <p className="text-muted-foreground">
            What the system has learned about your group from past events and member behavior
          </p>
        </div>

        <div className="space-y-6">
          {/* Auto-Blacklisted Venues */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Auto-Blacklisted Venues
              </CardTitle>
              <CardDescription>{learningInsights.rejectedVenues.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {learningInsights.rejectedVenues.count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No venues have been blacklisted yet. Venues rated 2 stars or lower, or marked "would not do again" will automatically be excluded from future suggestions.
                </p>
              ) : (
                <div className="space-y-2">
                  {learningInsights.rejectedVenues.venues.map((venue) => (
                    <div key={venue} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Ban className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{venue}</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" />
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Member Constraints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Member Constraints
              </CardTitle>
              <CardDescription>{learningInsights.memberConstraints.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {learningInsights.memberConstraints.count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No member constraints have been learned yet. As members provide feedback through RSVPs, the system will automatically detect patterns and update their preferences.
                </p>
              ) : (
                <div className="space-y-4">
                  {learningInsights.memberConstraints.constraints.map((constraint) => (
                    <div key={constraint.memberId} className="border rounded-lg p-4">
                      <div className="font-medium mb-3">{constraint.memberName}</div>
                      <div className="space-y-2">
                        {constraint.budgetConcern && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Budget Concern</Badge>
                            <span className="text-muted-foreground">Prefers budget-friendly options</span>
                          </div>
                        )}
                        {constraint.distanceConcern && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Distance Concern</Badge>
                            <span className="text-muted-foreground">Prefers nearby locations</span>
                          </div>
                        )}
                        {constraint.scheduleConflicts.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Schedule Conflicts</Badge>
                            <span className="text-muted-foreground">
                              Busy on: {constraint.scheduleConflicts.join(', ')}
                            </span>
                          </div>
                        )}
                        {constraint.notes && (
                          <p className="text-sm text-muted-foreground italic mt-2">
                            Note: {constraint.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Engagement Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Member Engagement
              </CardTitle>
              <CardDescription>{learningInsights.engagement.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{learningInsights.engagement.totalMembers}</div>
                  <div className="text-sm text-muted-foreground">Total Members</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-green-500/5">
                  <div className="text-2xl font-bold text-green-700">{learningInsights.engagement.active}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-yellow-500/5">
                  <div className="text-2xl font-bold text-yellow-700">{learningInsights.engagement.atRisk}</div>
                  <div className="text-sm text-muted-foreground">At Risk</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-red-500/5">
                  <div className="text-2xl font-bold text-red-700">{learningInsights.engagement.inactive}</div>
                  <div className="text-sm text-muted-foreground">Inactive</div>
                </div>
              </div>

              {/* Alert for at-risk members */}
              {learningInsights.engagement.atRisk > 0 && (
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-700 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-900">
                      {learningInsights.engagement.atRisk} {learningInsights.engagement.atRisk === 1 ? 'member is' : 'members are'} at risk
                    </div>
                    <div className="text-sm text-yellow-800 mt-1">
                      Consider reviewing their preferences or reaching out to see if event timing or activities need adjustment.
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Member Scores */}
              <div className="space-y-3">
                {learningInsights.engagement.scores.map((score) => (
                  <div key={score.memberId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{score.memberName}</span>
                        <Badge className={getStatusColor(score.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(score.status)}
                            {score.status.charAt(0).toUpperCase() + score.status.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {score.totalInvites} {score.totalInvites === 1 ? 'invite' : 'invites'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Response Rate */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Response Rate</span>
                          <span className="font-medium">{score.responseRate}%</span>
                        </div>
                        <Progress value={score.responseRate} className="h-2" />
                      </div>

                      {/* Attendance Rate */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Attendance Rate</span>
                          <span className="font-medium">{score.attendanceRate}%</span>
                        </div>
                        <Progress value={score.attendanceRate} className="h-2" />
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {score.totalResponses} responses • {score.totalAttended} attended
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Frequency Learning */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting Frequency
              </CardTitle>
              <CardDescription>{learningInsights.frequency.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <span className="text-sm text-muted-foreground">Current Frequency</span>
                  <Badge variant="outline" className="text-base">
                    {learningInsights.frequency.current.charAt(0).toUpperCase() + learningInsights.frequency.current.slice(1)}
                  </Badge>
                </div>

                {learningInsights.frequency.feedbackCount > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Based on {learningInsights.frequency.feedbackCount} feedback {learningInsights.frequency.feedbackCount === 1 ? 'response' : 'responses'}:
                    </p>
                    <div className="space-y-2">
                      {learningInsights.frequency.moreOften > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Want more frequent events</span>
                          <Badge variant="secondary">{learningInsights.frequency.moreOften}</Badge>
                        </div>
                      )}
                      {learningInsights.frequency.justRight > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Happy with current frequency</span>
                          <Badge variant="secondary">{learningInsights.frequency.justRight}</Badge>
                        </div>
                      )}
                      {learningInsights.frequency.lessOften > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Want less frequent events</span>
                          <Badge variant="secondary">{learningInsights.frequency.lessOften}</Badge>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground italic mt-4">
                      The system automatically adjusts meeting frequency when 50%+ of members provide consistent feedback.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No frequency feedback yet. After events, members can indicate if they'd like more or fewer events.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
