/**
 * GroupPatterns
 * Shows learned group preferences and lets users refine their taste through swiping.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, RefreshCw, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ========== TYPES ==========

export interface PreferenceInsight {
  icon: string;
  pattern: string;
  description: string;
}

interface GroupPatternsProps {
  groupId: string;
  preferenceInsights?: PreferenceInsight[] | null;
  feedbackCount?: number;
  onOpenSwipeSession: () => void;
}

// ========== COMPONENT ==========

export function GroupPatterns({
  groupId,
  preferenceInsights,
  feedbackCount,
  onOpenSwipeSession,
}: GroupPatternsProps) {
  const { toast } = useToast();

  const handleRefreshInsights = async () => {
    try {
      await apiRequest("POST", `/api/groups/${groupId}/analyze-patterns`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      toast({ title: "Patterns refreshed" });
    } catch (error: any) {
      toast({
        title: "Couldn't refresh patterns",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const hasInsights = preferenceInsights && Array.isArray(preferenceInsights) && preferenceInsights.length > 0;

  return (
    <>
      {/* Refine Preferences Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-accent" />
            Your Group's Taste
          </CardTitle>
          <CardDescription>Help us learn what you love</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onOpenSwipeSession} variant="outline" data-testid="button-refine-ideas">
            <Target className="mr-2 h-4 w-4" />
            Refine Ideas
          </Button>
          <p className="text-sm text-muted-foreground mt-3">
            Swipe through ideas to teach us your preferences
          </p>
        </CardContent>
      </Card>

      {/* Learned Patterns Section */}
      {hasInsights && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  What We've Noticed
                </CardTitle>
                <CardDescription>
                  Based on {feedbackCount || 0} things you've liked
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshInsights}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="button-refresh-insights"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {preferenceInsights.map((insight, index) => (
              <div key={index} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="text-xl flex-shrink-0">{insight.icon}</div>
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

// Keep the old export name for backwards compatibility during transition
export { GroupPatterns as AIPreferenceLearning };
