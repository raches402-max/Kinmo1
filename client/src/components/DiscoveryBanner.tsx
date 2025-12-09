import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoveryBannerProps {
  count: number;
  onReview: () => void;
  onDismiss: () => void;
}

export function DiscoveryBanner({ count, onReview, onDismiss }: DiscoveryBannerProps) {
  const groupText = count === 1 ? "group" : "groups";

  return (
    <div className="relative bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
          <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm">
            We found {count} {groupText} that might be yours
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            It looks like you were added to some groups before creating your account.
          </p>

          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onReview}>
              Review & Claim
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Not Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
