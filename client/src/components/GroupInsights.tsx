/**
 * Group Insights Component
 *
 * Displays automated group-level insights:
 * - Budget preferences (anonymous member counts)
 * - Availability patterns (day-of-week analysis)
 * - Activity type distribution (what they've done)
 * - Blacklisted venues
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { X, RefreshCw, TrendingUp, Calendar, Target, Ban, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GroupInsightsProps {
  groupId: string;
}

interface BudgetInsight {
  recentAverage: number | null;
  membersConcerned: number;
  suggestion: string | null;
  dismissed: boolean;
}

interface AvailabilityInsight {
  lowTurnoutDays: Array<{
    day: string;
    consecutiveCount: number;
    averageAttendance: number;
    totalEvents: number;
  }>;
  bestDays: Array<{
    day: string;
    attendanceRate: number;
    totalEvents: number;
  }>;
  suggestion: string | null;
  dismissed: boolean;
}

interface ActivityTypeInsight {
  distribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  suggestion: string | null;
  dismissed: boolean;
}

interface GroupInsightsData {
  budget: BudgetInsight;
  availability: AvailabilityInsight;
  activityTypes: ActivityTypeInsight;
  generatedAt: Date;
}

interface DayAttendance {
  day: string;
  avgAttendance: number;
  eventCount: number;
}

interface TimePatterns {
  bestDays: DayAttendance[];
  worstDays: DayAttendance[];
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: Date;
}

export function GroupInsights({ groupId }: GroupInsightsProps) {
  const { toast } = useToast();

  // Fetch insights
  const { data: insightsData, isLoading, refetch } = useQuery({
    queryKey: [`/api/groups/${groupId}/insights`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/insights`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
  });

  const insights: GroupInsightsData | null = insightsData?.insights || null;
  const timePatterns: TimePatterns | null = insightsData?.timePatterns || null;

  // Dismiss insight mutation
  const dismissMutation = useMutation({
    mutationFn: async (insightType: 'budget' | 'availability' | 'activityTypes') => {
      return apiRequest('POST', `/api/groups/${groupId}/insights/dismiss`, { insightType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/insights`] });
      toast({
        title: "Insight dismissed",
        description: "This suggestion has been hidden.",
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

  // Regenerate insights mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/insights?regenerate=true`);
      if (!response.ok) throw new Error('Failed to regenerate insights');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/insights`] });
      toast({
        title: "Insights refreshed",
        description: "Your insights have been regenerated.",
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

  const handleDismiss = (insightType: 'budget' | 'availability' | 'activityTypes') => {
    dismissMutation.mutate(insightType);
  };

  const handleRefresh = () => {
    regenerateMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Group Insights
          </CardTitle>
          <CardDescription>
            Not enough data yet. Insights will appear after a few events.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasAnyInsights =
    (insights.budget.membersConcerned > 0 || insights.budget.suggestion) ||
    (insights.availability.lowTurnoutDays.length > 0 || insights.availability.bestDays.length > 0) ||
    (insights.activityTypes.distribution.length > 0) ||
    (timePatterns && (timePatterns.bestDays.length > 0 || timePatterns.worstDays.length > 0));

  if (!hasAnyInsights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Group Insights
          </CardTitle>
          <CardDescription>
            Not enough event history yet. Check back after a few events!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">What We've Learned</h3>
          <p className="text-sm text-muted-foreground">Automated insights from your group's activity</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={regenerateMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Budget Preferences */}
      {(insights.budget.membersConcerned > 0 || insights.budget.suggestion) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span>💰</span>
              Budget Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.budget.membersConcerned > 0 && (
              <p className="text-sm text-muted-foreground">
                • {insights.budget.membersConcerned} {insights.budget.membersConcerned === 1 ? 'member prefers' : 'members prefer'} budget-friendly options
              </p>
            )}

            {insights.budget.suggestion && !insights.budget.dismissed && (
              <div className="p-3 bg-muted rounded-md flex items-start justify-between group">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <p className="text-sm">{insights.budget.suggestion}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  onClick={() => handleDismiss('budget')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Availability Patterns */}
      {(insights.availability.lowTurnoutDays.length > 0 || insights.availability.bestDays.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Availability Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.availability.lowTurnoutDays.length > 0 && (
              <div className="space-y-1">
                {insights.availability.lowTurnoutDays.map((day) => (
                  <p key={day.day} className="text-sm text-muted-foreground">
                    • {day.day}: {day.averageAttendance}% attendance ({day.totalEvents} {day.totalEvents === 1 ? 'event' : 'events'})
                  </p>
                ))}
              </div>
            )}

            {insights.availability.bestDays.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Best days:</p>
                {insights.availability.bestDays.map((day) => (
                  <p key={day.day} className="text-sm text-muted-foreground">
                    • {day.day}: {day.attendanceRate}% attendance
                  </p>
                ))}
              </div>
            )}

            {insights.availability.suggestion && !insights.availability.dismissed && (
              <div className="p-3 bg-muted rounded-md flex items-start justify-between group">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <p className="text-sm">{insights.availability.suggestion}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  onClick={() => handleDismiss('availability')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Time Patterns (from availability learning) */}
      {timePatterns && (timePatterns.bestDays.length > 0 || timePatterns.worstDays.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Learned Time Patterns
            </CardTitle>
            <CardDescription className="text-xs">
              Based on {timePatterns.sampleSize} event{timePatterns.sampleSize !== 1 ? 's' : ''} • {timePatterns.confidence} confidence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timePatterns.bestDays.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Best days for attendance:</p>
                {timePatterns.bestDays.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{day.day}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {day.avgAttendance}% avg
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({day.eventCount} event{day.eventCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {timePatterns.worstDays.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Days to consider avoiding:</p>
                {timePatterns.worstDays.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{day.day}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        {day.avgAttendance}% avg
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({day.eventCount} event{day.eventCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              These patterns help us schedule events at times that work best for your group.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Activity Types */}
      {insights.activityTypes.distribution.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Activity Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {insights.activityTypes.distribution.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-muted-foreground">{cat.category}</div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-sm text-right">{cat.percentage}%</div>
                </div>
              ))}
            </div>

            {insights.activityTypes.suggestion && !insights.activityTypes.dismissed && (
              <div className="p-3 bg-muted rounded-md flex items-start justify-between group">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <p className="text-sm">{insights.activityTypes.suggestion}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  onClick={() => handleDismiss('activityTypes')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
