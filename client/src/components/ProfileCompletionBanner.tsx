import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Sparkles, Calendar, DollarSign, ChevronRight } from "lucide-react";

interface ProfileCompletionBannerProps {
  memberId: string;
  hasAvailability: boolean;
  hasBudget: boolean;
  onSetAvailability?: () => void;
  onSetBudget?: () => void;
  className?: string;
}

export function ProfileCompletionBanner({
  memberId,
  hasAvailability,
  hasBudget,
  onSetAvailability,
  onSetBudget,
  className = "",
}: ProfileCompletionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash
  const storageKey = `kinmo_profilePromptDismissed_${memberId}`;

  useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(storageKey);
    setIsDismissed(dismissed === "true");
  }, [storageKey]);

  // Don't show if user already has preferences set
  const profileComplete = hasAvailability && hasBudget;
  if (profileComplete || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setIsDismissed(true);
  };

  const missingItems = [];
  if (!hasAvailability) missingItems.push("availability");
  if (!hasBudget) missingItems.push("budget");

  return (
    <Card className={`relative overflow-hidden border-orange-200 dark:border-orange-800/50 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 ${className}`}>
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-400" />

      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50">
            <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500 sm:hidden" />
              Complete your profile
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              Help us find the perfect times and places for your group by sharing your {missingItems.join(" and ")}.
            </p>

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2">
              {!hasAvailability && onSetAvailability && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSetAvailability}
                  className="bg-white dark:bg-zinc-800 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-orange-600 dark:text-orange-400" />
                  Set Availability
                </Button>
              )}
              {!hasBudget && onSetBudget && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSetBudget}
                  className="bg-white dark:bg-zinc-800 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5 text-orange-600 dark:text-orange-400" />
                  Set Budget
                </Button>
              )}
              <Link href="/preferences" className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-100/50 dark:hover:bg-orange-900/30"
                >
                  All Preferences
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
