/**
 * Sidebar Footer Component
 * Action buttons for scheduling, editing, and clearing
 */

import { Button } from "@/components/ui/button";
import { Sparkles, Settings, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SidebarFooterProps {
  venueCount: number;
  onQuickSchedule: () => void;
  onBuildEdit: () => void;
  onClearAll: () => void;
  isLoading?: boolean;
}

export function SidebarFooter({
  venueCount,
  onQuickSchedule,
  onBuildEdit,
  onClearAll,
  isLoading = false,
}: SidebarFooterProps) {
  const canSchedule = venueCount >= 1;

  return (
    <div className="border-t bg-background p-4 space-y-2">
      {/* Primary Action: Quick Schedule */}
      <Button
        className="w-full"
        onClick={onQuickSchedule}
        disabled={!canSchedule || isLoading}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {isLoading ? "Creating..." : "Quick Schedule"}
      </Button>

      {/* Secondary Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onBuildEdit}
          disabled={!canSchedule || isLoading}
        >
          <Settings className="h-4 w-4 mr-2" />
          Build & Edit
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canSchedule || isLoading}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all venues?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {venueCount} venues from your itinerary. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClearAll}>
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!canSchedule && (
        <p className="text-xs text-center text-muted-foreground pt-1">
          Add at least 1 venue to continue
        </p>
      )}
    </div>
  );
}
