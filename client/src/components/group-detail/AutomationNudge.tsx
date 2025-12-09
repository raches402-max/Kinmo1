/**
 * AutomationNudge
 * Gentle prompts to encourage automation adoption at the right moments.
 *
 * Triggers:
 * - After 3+ successful manual events: "Want us to handle scheduling?"
 * - After 5+ favorites saved: "Ready for smart suggestions?"
 * - After approving 3+ AI suggestions: "Your AI track record: 3/3. Enable auto-send?"
 *
 * Design: Non-pushy, dismissable, appears once per session per trigger.
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Calendar, Heart, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type NudgeType =
  | "after_manual_events"
  | "after_favorites_saved"
  | "after_ai_approvals"
  | "first_time_intro";

interface AutomationNudgeProps {
  type: NudgeType;
  // Context for the nudge
  manualEventCount?: number;
  favoritesCount?: number;
  aiApprovalCount?: number;
  aiApprovalSuccessRate?: number; // 0-100
  // Actions
  onEnableAutomation: () => void;
  onLearnMore?: () => void;
  onDismiss: () => void;
  // Visibility
  className?: string;
}

// Session storage key for dismissed nudges
const DISMISSED_NUDGES_KEY = "kinmo_dismissed_nudges";

function getDismissedNudges(): Set<string> {
  try {
    const stored = sessionStorage.getItem(DISMISSED_NUDGES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissNudge(nudgeKey: string) {
  const dismissed = getDismissedNudges();
  dismissed.add(nudgeKey);
  sessionStorage.setItem(DISMISSED_NUDGES_KEY, JSON.stringify([...dismissed]));
}

function isNudgeDismissed(nudgeKey: string): boolean {
  return getDismissedNudges().has(nudgeKey);
}

const nudgeContent: Record<NudgeType, {
  icon: typeof Sparkles;
  iconColor: string;
  bgGradient: string;
  title: (props: AutomationNudgeProps) => string;
  description: (props: AutomationNudgeProps) => string;
  ctaText: string;
  secondaryText?: string;
}> = {
  after_manual_events: {
    icon: Calendar,
    iconColor: "text-primary",
    bgGradient: "from-primary/5 via-background to-background",
    title: (props) => `You've planned ${props.manualEventCount} great events`,
    description: () => "Want us to handle the scheduling part? You'll still pick the venues - we just handle the when.",
    ctaText: "Try Auto-Scheduling",
    secondaryText: "Learn more",
  },
  after_favorites_saved: {
    icon: Heart,
    iconColor: "text-accent",
    bgGradient: "from-accent/5 via-background to-background",
    title: (props) => `${props.favoritesCount} spots saved`,
    description: () => "That's a great collection! We can now suggest smart event combos from these.",
    ctaText: "See AI Suggestions",
    secondaryText: "Maybe later",
  },
  after_ai_approvals: {
    icon: Zap,
    iconColor: "text-secondary-foreground",
    bgGradient: "from-secondary/10 via-background to-background",
    title: (props) => `AI track record: ${props.aiApprovalCount}/${props.aiApprovalCount} approved`,
    description: (props) => props.aiApprovalSuccessRate && props.aiApprovalSuccessRate >= 80
      ? "Looks like the AI suggestions are working for your group. Ready to let it auto-send?"
      : "The AI is learning your group's preferences. Keep approving to improve suggestions.",
    ctaText: "Enable Auto-Send",
    secondaryText: "Not yet",
  },
  first_time_intro: {
    icon: Sparkles,
    iconColor: "text-primary",
    bgGradient: "from-primary/5 via-secondary/5 to-background",
    title: () => "Meet your AI planning assistant",
    description: () => "I can suggest venues, pick times, and even schedule events automatically. Start by saving a few favorite spots.",
    ctaText: "Show Me How",
    secondaryText: "I'll explore first",
  },
};

export function AutomationNudge(props: AutomationNudgeProps) {
  const { type, onEnableAutomation, onLearnMore, onDismiss, className } = props;
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const nudgeKey = `${type}_${new Date().toDateString()}`;

  useEffect(() => {
    // Check if already dismissed this session
    if (!isNudgeDismissed(nudgeKey)) {
      // Small delay for entrance animation
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [nudgeKey]);

  const handleDismiss = () => {
    setIsExiting(true);
    dismissNudge(nudgeKey);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  };

  const handleCta = () => {
    dismissNudge(nudgeKey);
    onEnableAutomation();
  };

  const handleSecondary = () => {
    if (onLearnMore) {
      onLearnMore();
    } else {
      handleDismiss();
    }
  };

  if (!isVisible) return null;

  const content = nudgeContent[type];
  const Icon = content.icon;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      "border-0 shadow-sm",
      isExiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
      className
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-r", content.bgGradient)} />
      <CardContent className="relative p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            "bg-background/80 backdrop-blur-sm border border-border/50"
          )}>
            <Icon className={cn("h-4 w-4", content.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-0.5">
              {content.title(props)}
            </h4>
            <p className="text-sm text-muted-foreground leading-snug">
              {content.description(props)}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleCta}
                className="h-8 text-xs"
              >
                {content.ctaText}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
              {content.secondaryText && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSecondary}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  {content.secondaryText}
                </Button>
              )}
            </div>
          </div>

          {/* Dismiss */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to determine which nudge to show based on user's state
 */
export function useAutomationNudge(params: {
  autoScheduleEnabled: boolean;
  manualEventCount: number;
  favoritesCount: number;
  aiApprovalCount: number;
  hasSeenIntro: boolean;
}): NudgeType | null {
  const { autoScheduleEnabled, manualEventCount, favoritesCount, aiApprovalCount, hasSeenIntro } = params;

  // Don't show nudges if automation is already enabled
  if (autoScheduleEnabled) return null;

  // Priority 1: First time intro (if they haven't seen it)
  if (!hasSeenIntro && favoritesCount === 0 && manualEventCount === 0) {
    return "first_time_intro";
  }

  // Priority 2: After approving AI suggestions (closest to conversion)
  if (aiApprovalCount >= 3) {
    return "after_ai_approvals";
  }

  // Priority 3: After saving enough favorites
  if (favoritesCount >= 5) {
    return "after_favorites_saved";
  }

  // Priority 4: After planning manual events
  if (manualEventCount >= 3) {
    return "after_manual_events";
  }

  return null;
}
