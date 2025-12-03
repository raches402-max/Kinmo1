/**
 * Regeneration Fallback Dialog
 * Shows after 3 regeneration attempts, offering alternative paths
 */

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Edit } from "lucide-react";

interface RegenerationFallbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscoverMore: () => void;
  onManualPlanning: () => void;
  onKeepTrying: () => void;
  regenerationCount: number;
}

export function RegenerationFallbackDialog({
  open,
  onOpenChange,
  onDiscoverMore,
  onManualPlanning,
  onKeepTrying,
  regenerationCount,
}: RegenerationFallbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Still looking for the perfect match?</DialogTitle>
          <DialogDescription>
            We've regenerated this event {regenerationCount} times. Would you like to try a different approach?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            Here are some options to help you find the perfect event:
          </p>

          <div className="space-y-2">
            <Button
              variant="default"
              className="w-full h-auto py-4 flex-col items-start gap-1"
              onClick={onDiscoverMore}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Search className="h-5 w-5" />
                Discover More Venues
              </div>
              <span className="text-xs font-normal opacity-90">
                Expand your Favorites with more venue options
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto py-4 flex-col items-start gap-1"
              onClick={onManualPlanning}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Edit className="h-5 w-5" />
                Manual Planning
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                Create a custom event with full control
              </span>
            </Button>

            <Button
              variant="ghost"
              className="w-full flex items-center gap-2"
              onClick={onKeepTrying}
            >
              <RefreshCw className="h-4 w-4" />
              Keep Trying
            </Button>
          </div>
        </div>

        <DialogFooter className="text-xs text-muted-foreground">
          Tip: Adding more venues to Favorites improves auto-scheduling variety
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
