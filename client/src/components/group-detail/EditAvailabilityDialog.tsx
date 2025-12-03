import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { useState, useEffect } from "react";

type AvailabilityData = Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>;

interface EditAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAvailability: AvailabilityData;
  initialFrequencyNumber: number;
  initialFrequencyUnit: string;
  initialNotes: string;
  onSave: (data: {
    availability: AvailabilityData;
    generalAvailability: string | null;
    meetingFrequency: string;
  }) => void;
  isSaving: boolean;
}

export function EditAvailabilityDialog({
  open,
  onOpenChange,
  initialAvailability,
  initialFrequencyNumber,
  initialFrequencyUnit,
  initialNotes,
  onSave,
  isSaving,
}: EditAvailabilityDialogProps) {
  const [availability, setAvailability] = useState<AvailabilityData>(initialAvailability);
  const [freqNumber, setFreqNumber] = useState(initialFrequencyNumber);
  const [freqUnit, setFreqUnit] = useState(initialFrequencyUnit);
  const [notes, setNotes] = useState(initialNotes);

  // Reset state when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setAvailability(initialAvailability);
      setFreqNumber(initialFrequencyNumber);
      setFreqUnit(initialFrequencyUnit);
      setNotes(initialNotes);
    }
  }, [open, initialAvailability, initialFrequencyNumber, initialFrequencyUnit, initialNotes]);

  const handleSave = () => {
    const meetingFrequency = `${freqNumber}x ${freqUnit.replace(/s$/, '')}`;
    onSave({
      availability,
      generalAvailability: notes.trim() || null,
      meetingFrequency,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-availability">
        <DialogHeader>
          <DialogTitle>Edit Group Availability</DialogTitle>
          <DialogDescription>
            Update when the group is typically free to meet
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Availability Grid */}
          <div className="space-y-3">
            <Label>When is the group free?</Label>
            <AvailabilityGrid
              value={availability}
              onChange={setAvailability}
            />
          </div>

          {/* Meeting Frequency */}
          <div className="space-y-3">
            <Label>Meeting Frequency</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                value={freqNumber}
                onChange={(e) => setFreqNumber(parseInt(e.target.value) || 1)}
                className="w-20"
                data-testid="input-frequency-number"
              />
              <Select
                value={freqUnit}
                onValueChange={setFreqUnit}
              >
                <SelectTrigger className="flex-1" data-testid="select-frequency-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="weeks">weeks</SelectItem>
                  <SelectItem value="months">months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-3">
            <Label htmlFor="edit-availability-notes">Additional Notes (Optional)</Label>
            <Input
              id="edit-availability-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Prefer evenings after 6pm"
              data-testid="input-availability-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit-availability"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-availability"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
