import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface RsvpConstraintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (constraintText: string) => void;
  isSubmitting: boolean;
}

export function RsvpConstraintDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: RsvpConstraintDialogProps) {
  const [constraintText, setConstraintText] = useState("");

  const handleClose = () => {
    onOpenChange(false);
    setConstraintText("");
  };

  const handleSubmit = () => {
    if (constraintText.trim()) {
      onSubmit(constraintText.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-rsvp-constraint">
        <DialogHeader>
          <DialogTitle>Conditional RSVP</DialogTitle>
          <DialogDescription>
            Let the group know what would make this work for you
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="constraint-text">Your Constraint</Label>
            <Input
              id="constraint-text"
              placeholder="e.g., only if we meet in Oakland, only if we start after 7pm"
              value={constraintText}
              onChange={(e) => setConstraintText(e.target.value)}
              data-testid="input-constraint-text"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-constraint"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!constraintText.trim() || isSubmitting}
            data-testid="button-confirm-constraint"
          >
            {isSubmitting ? "Submitting..." : "Submit RSVP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
