/**
 * Planning Insight Banner
 *
 * Displays proactive AI insights for group organizers.
 * Shows as a subtle, dismissible banner on the group page.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Lightbulb,
  X,
  MapPin,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PlanningInsight {
  id: string;
  groupId: string;
  insightType: string;
  severity: string;
  audienceType: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  actionType?: string;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

interface PlanningInsightBannerProps {
  groupId: string;
}

// Icon mapping for insight types
const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  location_fairness: <MapPin className="h-4 w-4" />,
  venue_gap: <Calendar className="h-4 w-4" />,
  date_clustering: <Clock className="h-4 w-4" />,
  member_inclusion: <Users className="h-4 w-4" />,
  cadence_health: <Clock className="h-4 w-4" />,
};

// Color schemes for severity levels
const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  suggestion: "border-amber-200 bg-amber-50 text-amber-900",
  action_needed: "border-rose-200 bg-rose-50 text-rose-900",
};

const ICON_STYLES: Record<string, string> = {
  info: "text-blue-600",
  suggestion: "text-amber-600",
  action_needed: "text-rose-600",
};

export function PlanningInsightBanner({ groupId }: PlanningInsightBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch insights for this group
  const { data: insights = [], isLoading } = useQuery<PlanningInsight[]>({
    queryKey: [`/api/groups/${groupId}/planning-insights`],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (insightId: string) => {
      return await apiRequest("POST", `/api/planning-insights/${insightId}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/planning-insights`] });
    },
  });

  // Action mutation (mark as acted)
  const actionMutation = useMutation({
    mutationFn: async (insightId: string) => {
      return await apiRequest("POST", `/api/planning-insights/${insightId}/acted`, {
        actionStatus: "user_acted",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/planning-insights`] });
    },
  });

  const handleDismiss = (insightId: string) => {
    setDismissedIds((prev) => new Set([...Array.from(prev), insightId]));
    dismissMutation.mutate(insightId);
  };

  const handleAction = (insight: PlanningInsight) => {
    actionMutation.mutate(insight.id);
    // Navigation will happen via the Link component
  };

  // Filter out locally dismissed insights
  const visibleInsights = insights.filter((i) => !dismissedIds.has(i.id));

  if (isLoading || visibleInsights.length === 0) {
    return null;
  }

  // Show only the most important insight (first one)
  // Can expand to show multiple later
  const insight = visibleInsights[0];
  const icon = INSIGHT_ICONS[insight.insightType] || <Lightbulb className="h-4 w-4" />;
  const severityStyle = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
  const iconStyle = ICON_STYLES[insight.severity] || ICON_STYLES.info;

  return (
    <Alert className={`relative mb-4 ${severityStyle}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 ${iconStyle}`}>
          <Sparkles className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {insight.title}
          </AlertTitle>
          <AlertDescription className="text-sm mt-1 opacity-90">
            {insight.message}
          </AlertDescription>

          {/* Action button */}
          {insight.actionUrl && insight.actionLabel && (
            <div className="mt-2">
              <Link href={insight.actionUrl} onClick={() => handleAction(insight)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 bg-white/50 hover:bg-white"
                >
                  {insight.actionLabel}
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-60 hover:opacity-100"
          onClick={() => handleDismiss(insight.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Show count if more insights */}
      {visibleInsights.length > 1 && (
        <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-70">
          +{visibleInsights.length - 1} more suggestion{visibleInsights.length > 2 ? "s" : ""}
        </div>
      )}
    </Alert>
  );
}

/**
 * Compact version for inline display
 */
export function PlanningInsightInline({ groupId }: PlanningInsightBannerProps) {
  const { data: insights = [] } = useQuery<PlanningInsight[]>({
    queryKey: [`/api/groups/${groupId}/planning-insights`],
    staleTime: 5 * 60 * 1000,
  });

  if (insights.length === 0) {
    return null;
  }

  const insight = insights[0];

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      <span className="truncate">{insight.message}</span>
      {insight.actionUrl && (
        <Link href={insight.actionUrl}>
          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
            {insight.actionLabel || "Learn more"}
          </Button>
        </Link>
      )}
    </div>
  );
}
