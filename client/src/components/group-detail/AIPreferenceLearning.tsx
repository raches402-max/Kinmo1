/**
 * AIPreferenceLearning
 * Displays AI preference learning controls and discovered group patterns.
 * Includes a "Refine Ideas" button to start a swipe session and shows
 * AI-discovered preference insights.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ========== TYPES ==========

/**
 * A single preference insight discovered by AI
 */
export interface PreferenceInsight {
  icon: string;
  pattern: string;
  description: string;
}

interface AIPreferenceLearningProps {
  /**
   * Group ID for refreshing insights
   */
  groupId: string;
  /**
   * AI-discovered preference insights
   */
  preferenceInsights?: PreferenceInsight[] | null;
  /**
   * Number of feedback actions the AI has learned from
   */
  feedbackCount?: number;
  /**
   * Callback to open the swipe session
   */
  onOpenSwipeSession: () => void;
}

// ========== COMPONENT ==========

export function AIPreferenceLearning({
  groupId,
  preferenceInsights,
  feedbackCount,
  onOpenSwipeSession,
}: AIPreferenceLearningProps) {
  const { toast } = useToast();

  const handleRefreshInsights = async () => {
    try {
      await apiRequest("POST", `/api/groups/${groupId}/analyze-patterns`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      toast({ title: "Insights refreshed successfully" });
    } catch (error: any) {
      toast({
        title: "Failed to refresh insights",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const hasInsights = preferenceInsights && Array.isArray(preferenceInsights) && preferenceInsights.length > 0;

  return (
    <>
      {/* AI Preference Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Preference Learning
          </CardTitle>
          <CardDescription>Refine AI understanding of your group's preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onOpenSwipeSession} variant="outline" data-testid="button-refine-ideas">
            <Target className="mr-2 h-4 w-4" />
            Refine Ideas
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            Swipe through activity concepts to help AI learn your group's taste
          </p>
        </CardContent>
      </Card>

      {/* AI Preference Insights Section */}
      {hasInsights && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Your Group's Patterns
                </CardTitle>
                <CardDescription>
                  AI-discovered preferences based on {feedbackCount || 0} feedback actions
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshInsights}
                className="gap-2"
                data-testid="button-refresh-insights"
              >
                <Sparkles className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {preferenceInsights.map((insight, index) => (
              <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-md">
                <div className="text-2xl flex-shrink-0">{insight.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{insight.pattern}</p>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
