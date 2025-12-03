import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrossGroupContactPicker } from "@/components/CrossGroupContactPicker";
import { Calendar, Users, ArrowLeft, ArrowRight, Loader2, PartyPopper } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  memberId: string;
  sourceGroupId: string;
  sourceGroupName: string;
  sourceGroupEmoji: string | null;
}

interface StandaloneEventCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "details" | "invitees" | "review";

export function StandaloneEventCreationModal({
  open,
  onOpenChange,
}: StandaloneEventCreationModalProps) {
  const [step, setStep] = useState<Step>("details");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createEventMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create the standalone event
      const event = await apiRequest("POST", "/api/standalone-events", {
        name: eventName,
        eventDate: eventDate || null,
        status: "draft",
      });

      // Step 2: Add invitees if any selected
      if (selectedContacts.length > 0) {
        await apiRequest("POST", `/api/standalone-events/${event.id}/invitees`, {
          invitees: selectedContacts.map((c) => ({
            memberId: c.memberId,
            userId: c.userId,
            sourceGroupId: c.sourceGroupId,
            inviteeName: c.name,
            inviteeEmail: c.email,
          })),
        });
      }

      return event;
    },
    onSuccess: () => {
      toast({
        title: "Event created!",
        description: `"${eventName}" has been created with ${selectedContacts.length} invitees.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/standalone-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      resetAndClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetAndClose = () => {
    setStep("details");
    setEventName("");
    setEventDate("");
    setSelectedContacts([]);
    onOpenChange(false);
  };

  const canProceedFromDetails = eventName.trim().length > 0;
  const canCreate = eventName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5" />
            {step === "details" && "Create Standalone Event"}
            {step === "invitees" && "Invite People"}
            {step === "review" && "Review & Create"}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Details */}
        {step === "details" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name *</Label>
              <Input
                id="event-name"
                placeholder="e.g., Birthday Dinner, Game Night..."
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date (optional)
              </Label>
              <Input
                id="event-date"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can set the date later
              </p>
            </div>
          </div>
        )}

        {/* Step: Invitees */}
        {step === "invitees" && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select people from your groups to invite to this event.
            </p>
            <CrossGroupContactPicker
              selectedContacts={selectedContacts}
              onSelectionChange={setSelectedContacts}
            />
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Event Name</p>
                <p className="font-medium">{eventName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Not set yet"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Invitees ({selectedContacts.length})
                </p>
                {selectedContacts.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedContacts.slice(0, 5).map((c) => (
                      <span
                        key={c.id}
                        className="text-xs bg-background px-2 py-1 rounded"
                      >
                        {c.name}
                      </span>
                    ))}
                    {selectedContacts.length > 5 && (
                      <span className="text-xs bg-background px-2 py-1 rounded">
                        +{selectedContacts.length - 5} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">No invitees added</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              You can add venues and send invites after creating the event.
            </p>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step !== "details" && (
              <Button
                variant="ghost"
                onClick={() =>
                  setStep(step === "review" ? "invitees" : "details")
                }
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>

            {step === "details" && (
              <Button
                onClick={() => setStep("invitees")}
                disabled={!canProceedFromDetails}
              >
                Next: Invitees
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === "invitees" && (
              <Button onClick={() => setStep("review")}>
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === "review" && (
              <Button
                onClick={() => createEventMutation.mutate()}
                disabled={!canCreate || createEventMutation.isPending}
              >
                {createEventMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Event"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
