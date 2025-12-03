import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SavedItinerary {
  id: string;
  name: string;
  items?: Array<unknown>;
}

interface SendBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedItineraries: SavedItinerary[];
  onSend: (savedItineraryId: string) => void;
  isSending: boolean;
}

export function SendBackupDialog({
  open,
  onOpenChange,
  savedItineraries,
  onSend,
  isSending,
}: SendBackupDialogProps) {
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);

  const handleClose = () => {
    onOpenChange(false);
    setSelectedBackupId(null);
  };

  const handleSend = () => {
    if (selectedBackupId) {
      onSend(selectedBackupId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-send-backup">
        <DialogHeader>
          <DialogTitle>Send Backup Plan</DialogTitle>
          <DialogDescription>
            Select an alternative plan to send to members with location constraints
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {savedItineraries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No saved plans available. Save a plan first to send it as a backup.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Backup Plan</Label>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {savedItineraries.map((itinerary) => (
                  <button
                    key={itinerary.id}
                    onClick={() => setSelectedBackupId(itinerary.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all ${
                      selectedBackupId === itinerary.id ? 'border-primary bg-primary/25' : ''
                    }`}
                    data-testid={`backup-option-${itinerary.id}`}
                  >
                    <p className="text-sm font-medium">{itinerary.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {itinerary.items?.length || 0} stops
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-backup"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedBackupId || isSending}
            data-testid="button-confirm-backup"
          >
            {isSending ? "Sending..." : "Send Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
