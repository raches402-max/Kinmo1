import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Calendar, Sparkles } from "lucide-react";

interface AutoSchedulePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frequencyNumber: number;
  frequencyUnit: string;
  lastEventDate: string | Date | null;
  calculateNextEventDate: (lastEventDate: string | null, freqNum: number, freqUnit: string) => Date;
  suggestedPlanName?: string;
  favoritedVenueCount?: number;
  onConfirm: (withinTriggerWindow: boolean) => Promise<void>;
  isEnabling: boolean;
}

export function AutoSchedulePreviewDialog({
  open,
  onOpenChange,
  frequencyNumber,
  frequencyUnit,
  lastEventDate,
  calculateNextEventDate,
  suggestedPlanName,
  favoritedVenueCount = 0,
  onConfirm,
  isEnabling,
}: AutoSchedulePreviewDialogProps) {
  const lastEventDateStr = lastEventDate
    ? (typeof lastEventDate === 'string' ? lastEventDate : new Date(lastEventDate).toISOString())
    : null;
  const nextEventDate = calculateNextEventDate(lastEventDateStr, frequencyNumber, frequencyUnit);
  const now = new Date();
  const daysAway = Math.ceil((nextEventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const withinTriggerWindow = daysAway <= 10 && daysAway >= 0;

  const handleConfirm = async () => {
    await onConfirm(withinTriggerWindow);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Enable Auto-scheduling?
          </DialogTitle>
          <DialogDescription>
            Here's what will happen when you enable automation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Meeting Frequency</div>
                <div className="text-sm text-muted-foreground">
                  Events every {frequencyNumber} {frequencyUnit}{frequencyNumber !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Next Event Target
                </div>
                <div className="text-sm text-muted-foreground">
                  {nextEventDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: nextEventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={withinTriggerWindow ? "default" : "secondary"} className="text-xs">
                    {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                  </Badge>
                </div>

                {withinTriggerWindow ? (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-primary/25 rounded-md">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <strong className="text-primary">Event will be created immediately</strong>
                      <p className="text-muted-foreground mt-1">
                        Within 10-day creation window. AI will create the pending event now and give members 48 hours to volunteer as host.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-2">
                    AI will create event on {new Date(nextEventDate.getTime() - (10 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (10 days before target)
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="text-sm font-semibold">Content Priority</div>
                <div className="text-xs text-muted-foreground">
                  AI pulls from: <strong>Saved plans</strong> → <strong>Favorited venues</strong> → <strong>Viable activities</strong>
                </div>
              </div>

              {suggestedPlanName && (
                <div className="pt-2 border-t text-xs">
                  <span className="text-muted-foreground">Would likely use: </span>
                  <span className="font-semibold">{suggestedPlanName}</span>
                </div>
              )}

              {!suggestedPlanName && favoritedVenueCount > 0 && (
                <div className="pt-2 border-t text-xs">
                  <span className="text-muted-foreground">Would create from: </span>
                  <span className="font-semibold">{favoritedVenueCount} favorited venues</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-auto-schedule"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isEnabling}
            data-testid="button-confirm-auto-schedule"
          >
            {isEnabling ? "Enabling..." : "Enable Automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
