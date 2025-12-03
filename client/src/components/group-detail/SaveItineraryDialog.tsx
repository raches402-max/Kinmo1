import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface SaveItineraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; timingRecommendations?: string }) => void;
  isSaving: boolean;
}

export function SaveItineraryDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: SaveItineraryDialogProps) {
  const [itineraryName, setItineraryName] = useState("");
  const [timingRecommendations, setTimingRecommendations] = useState("");
  const [timingNotesOpen, setTimingNotesOpen] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setItineraryName("");
    setTimingRecommendations("");
    setTimingNotesOpen(false);
  };

  const handleSave = () => {
    onSave({
      name: itineraryName.trim(),
      timingRecommendations: timingRecommendations.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-save-itinerary">
        <DialogHeader>
          <DialogTitle>Save Itinerary</DialogTitle>
          <DialogDescription>
            Name it yourself or let AI create a name based on your venues
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itinerary-name">Itinerary Name (optional)</Label>
            <Input
              id="itinerary-name"
              placeholder="Leave blank for AI to name it (e.g., 'Dinner at Ryoko's - Oakland')"
              value={itineraryName}
              onChange={(e) => setItineraryName(e.target.value)}
              data-testid="input-itinerary-name"
            />
          </div>

          <Collapsible open={timingNotesOpen} onOpenChange={setTimingNotesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 px-0"
                data-testid="button-toggle-timing-notes"
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${timingNotesOpen ? 'rotate-90' : ''}`} />
                <span className="text-sm text-muted-foreground">Add timing notes (optional)</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <Label htmlFor="timing-recommendations" className="text-xs text-muted-foreground">
                When does this plan work best?
              </Label>
              <Textarea
                id="timing-recommendations"
                placeholder="e.g., 'Best for Saturday brunch' or 'Sunday when there's a Monday holiday'"
                value={timingRecommendations}
                onChange={(e) => setTimingRecommendations(e.target.value)}
                className="min-h-[80px]"
                data-testid="textarea-timing-recommendations"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-save-itinerary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-confirm-save-itinerary"
          >
            {isSaving ? "Saving..." : "Save Itinerary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
