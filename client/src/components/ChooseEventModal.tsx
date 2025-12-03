import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface EventOption {
  id: string;
  name: string | null;
  items: Array<{
    venueName: string;
    venueType: string | null;
  }>;
  createdAt: Date | string;
  eventDate?: Date | string | null;
  isNewlyGenerated?: boolean;
}

interface ChooseEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEvents: EventOption[];
  newEventOption: EventOption | null;
  onSelectExisting: (eventId: string) => void;
  onSelectNew: () => void;
}

export function ChooseEventModal({
  open,
  onOpenChange,
  existingEvents,
  newEventOption,
  onSelectExisting,
  onSelectNew,
}: ChooseEventModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Choose Event to Schedule</DialogTitle>
          <DialogDescription>
            You have an existing proposed event. Would you like to schedule that one, or create a new event with fresh recommendations?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Existing Events */}
          {existingEvents.map((event) => (
            <div
              key={event.id}
              className="border rounded-lg p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {event.name || "Untitled Event"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created {format(new Date(event.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* Venue List */}
              <div className="space-y-1 mb-4">
                {event.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-sm flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span>{item.venueName}</span>
                    {item.venueType && (
                      <span className="text-xs text-muted-foreground">
                        ({item.venueType})
                      </span>
                    )}
                  </div>
                ))}
                {event.items.length > 3 && (
                  <div className="text-sm text-muted-foreground ml-5">
                    +{event.items.length - 3} more
                  </div>
                )}
              </div>

              <Button
                onClick={() => onSelectExisting(event.id)}
                className="w-full"
              >
                Schedule This Event
              </Button>
            </div>
          ))}

          {/* New Event Option */}
          {newEventOption && (
            <div className="border rounded-lg p-4 hover:border-primary transition-colors bg-accent/50">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Create New Event</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fresh recommendations based on latest preferences
                  </p>
                </div>
              </div>

              {/* Venue List */}
              <div className="space-y-1 mb-4">
                {newEventOption.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-sm flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span>{item.venueName}</span>
                    {item.venueType && (
                      <span className="text-xs text-muted-foreground">
                        ({item.venueType})
                      </span>
                    )}
                  </div>
                ))}
                {newEventOption.items.length > 3 && (
                  <div className="text-sm text-muted-foreground ml-5">
                    +{newEventOption.items.length - 3} more
                  </div>
                )}
              </div>

              <Button onClick={onSelectNew} className="w-full" variant="default">
                <Sparkles className="h-4 w-4 mr-2" />
                Schedule New Event
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
