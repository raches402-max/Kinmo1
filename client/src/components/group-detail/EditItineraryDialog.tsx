import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { SortableItineraryItem, type ItineraryItem } from "@/components/ItineraryDisplay";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

type EditableItinerary = {
  id: string;
  eventDate?: string | null;
};

interface EditItineraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itinerary: EditableItinerary | null;
  groupTimezone?: string | null;
  name: string;
  onNameChange: (name: string) => void;
  proposedDate: string;
  onProposedDateChange: (date: string) => void;
  timingRecommendations: string;
  onTimingRecommendationsChange: (value: string) => void;
  items: ItineraryItem[];
  onItemsChange: React.Dispatch<React.SetStateAction<ItineraryItem[]>>;
  onAddVenue: () => void;
  onDelete: (itineraryId: string) => void;
  onSave: (updates: {
    itineraryId: string;
    updates: {
      name: string;
      proposedOrder: string[];
      timingRecommendations: string | null;
      eventDate?: string;
    };
  }) => void;
  isDeleting: boolean;
  isSaving: boolean;
}

export function EditItineraryDialog({
  open,
  onOpenChange,
  itinerary,
  groupTimezone,
  name,
  onNameChange,
  proposedDate,
  onProposedDateChange,
  timingRecommendations,
  onTimingRecommendationsChange,
  items,
  onItemsChange,
  onAddVenue,
  onDelete,
  onSave,
  isDeleting,
  isSaving,
}: EditItineraryDialogProps) {
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSave = () => {
    if (!itinerary) return;

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the plan",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "No venues",
        description: "Please add at least one venue to the plan",
        variant: "destructive",
      });
      return;
    }

    const updates: {
      name: string;
      proposedOrder: string[];
      timingRecommendations: string | null;
      eventDate?: string;
    } = {
      name: name.trim(),
      proposedOrder: items.map((item) => item.sourceId),
      timingRecommendations: timingRecommendations.trim() || null,
    };

    if (itinerary.eventDate && proposedDate) {
      updates.eventDate = proposedDate;
    }

    onSave({
      itineraryId: itinerary.id,
      updates,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-itinerary">
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
          <DialogDescription>
            Update the plan name, add new venues, reorder, or remove venues
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="edit-itinerary-name">Plan Name</Label>
            <Input
              id="edit-itinerary-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter plan name"
              data-testid="input-edit-itinerary-name"
            />
          </div>

          {itinerary?.eventDate && (
            <div className="space-y-3">
              <Label htmlFor="edit-event-date">Event Date & Time</Label>
              <Input
                id="edit-event-date"
                type="datetime-local"
                value={proposedDate ? (
                  groupTimezone
                    ? formatInTimeZone(new Date(proposedDate), groupTimezone, "yyyy-MM-dd'T'HH:mm")
                    : format(new Date(proposedDate), "yyyy-MM-dd'T'HH:mm")
                ) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const dateString = e.target.value;

                    if (groupTimezone) {
                      const [datePart, timePart] = dateString.split('T');
                      const [year, month, day] = datePart.split('-').map(Number);
                      const [hour, minute] = timePart.split(':').map(Number);
                      const wallTime = new Date(year, month - 1, day, hour, minute);
                      const utcTime = fromZonedTime(wallTime, groupTimezone);
                      onProposedDateChange(utcTime.toISOString());
                    } else {
                      onProposedDateChange(new Date(dateString).toISOString());
                    }
                  } else {
                    onProposedDateChange('');
                  }
                }}
                data-testid="input-edit-event-date"
              />
              <p className="text-xs text-muted-foreground">
                {groupTimezone
                  ? `Times shown in ${groupTimezone.split('/')[1]?.replace('_', ' ') || "group's local"} time`
                  : 'Times shown in your local time'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="edit-timing-recommendations">Timing Notes (optional)</Label>
            <Textarea
              id="edit-timing-recommendations"
              value={timingRecommendations}
              onChange={(e) => onTimingRecommendationsChange(e.target.value)}
              placeholder="e.g., 'Best for Saturday lunch, 12:00-2:00 PM'"
              className="min-h-[80px]"
              data-testid="textarea-edit-timing-recommendations"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Venues ({items.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddVenue}
                data-testid="button-add-venue"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Venue
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No venues in this plan</div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  if (over && active.id !== over.id) {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    onItemsChange(arrayMove(items, oldIndex, newIndex));
                  }
                }}
              >
                <SortableContext
                  items={items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <SortableItineraryItem
                        key={item.id}
                        item={item}
                        index={index}
                        editable={true}
                        onRemove={() => onItemsChange((prev) => prev.filter((existing) => existing.id !== item.id))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting} data-testid="button-delete-itinerary">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-confirm-delete-itinerary">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this event. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => itinerary && onDelete(itinerary.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-itinerary">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || items.length === 0}
            data-testid="button-save-edit-itinerary"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
