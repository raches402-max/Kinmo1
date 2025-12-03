import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { useState } from "react";

type RsvpResponse = "yes" | "maybe" | "no";

interface InviteGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (data: { guestName: string; guestEmail: string; response: RsvpResponse }) => void;
  isInviting: boolean;
  onValidationError: (message: string) => void;
}

export function InviteGuestDialog({
  open,
  onOpenChange,
  onInvite,
  isInviting,
  onValidationError,
}: InviteGuestDialogProps) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const handleClose = () => {
    onOpenChange(false);
    setGuestName("");
    setGuestEmail("");
  };

  const handleInvite = (response: RsvpResponse) => {
    if (!guestName.trim()) {
      onValidationError("Please enter the guest's name");
      return;
    }
    onInvite({
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      response,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Additional Guests</DialogTitle>
          <DialogDescription>
            Add guests to this event. Guests will be able to RSVP but won't affect the group's preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Guest Name *</Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g., Sarah Johnson"
              data-testid="input-guest-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-email">Guest Email (Optional)</Label>
            <Input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="e.g., sarah@example.com"
              data-testid="input-guest-email"
            />
          </div>
          <div className="space-y-2">
            <Label>Guest RSVP Response</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleInvite("yes")}
                disabled={isInviting || !guestName.trim()}
                data-testid="button-guest-rsvp-yes"
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Yes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleInvite("maybe")}
                disabled={isInviting || !guestName.trim()}
                data-testid="button-guest-rsvp-maybe"
                className="flex-1"
              >
                <Circle className="h-4 w-4 mr-2" />
                Maybe
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleInvite("no")}
                disabled={isInviting || !guestName.trim()}
                data-testid="button-guest-rsvp-no"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                No
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-invite-guest"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
