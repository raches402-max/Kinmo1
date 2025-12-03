import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Save, Edit } from "lucide-react";

interface ScheduleNowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleNow: () => void;
  onSaveAsTemplate: () => void;
  onKeepEditing: () => void;
}

export function ScheduleNowModal({
  open,
  onOpenChange,
  onScheduleNow,
  onSaveAsTemplate,
  onKeepEditing
}: ScheduleNowModalProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Your itinerary is ready!</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Would you like to schedule this event now, or save it as a reusable template?
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={onScheduleNow}
            className="w-full h-auto py-4 flex-col items-start gap-1"
            data-testid="button-schedule-now"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Calendar className="h-5 w-5" />
              Schedule Now
            </div>
            <span className="text-xs font-normal opacity-90">
              Pick a time and send to your group immediately
            </span>
          </Button>

          <Button
            onClick={onSaveAsTemplate}
            variant="outline"
            className="w-full h-auto py-4 flex-col items-start gap-1"
            data-testid="button-save-as-template"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Save className="h-5 w-5" />
              Save for Later
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              Save this plan and schedule whenever you're ready
            </span>
          </Button>

          <Button
            onClick={onKeepEditing}
            variant="ghost"
            className="w-full"
            data-testid="button-keep-editing"
          >
            <Edit className="h-4 w-4 mr-2" />
            Keep Editing
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
