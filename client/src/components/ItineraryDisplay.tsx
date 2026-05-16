/**
 * ItineraryDisplay Component
 * Drag-and-drop sortable list for displaying and reordering itinerary items
 * Extracted from group-detail.tsx for reusability
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ========== TYPES ==========

export interface ItineraryItem {
  id: string;
  sourceId: string;
  venueName: string;
  venueType: string;
  rating?: number | string | null;
}

export interface Itinerary {
  id: string;
  items: ItineraryItem[];
}

interface ItineraryDisplayProps {
  /**
   * The itinerary to display
   */
  itinerary: Itinerary;
  /**
   * Group ID for cache invalidation
   */
  groupId: string;
  /**
   * Whether items can be edited (reordered/removed)
   * @default true
   */
  editable?: boolean;
  /**
   * Callback when an item is removed
   */
  onItemRemoved?: (itemId: string) => void;
  /**
   * Callback when items are reordered
   */
  onOrderChanged?: (newOrder: string[]) => void;
}

interface SortableItineraryItemProps {
  item: ItineraryItem;
  index: number;
  onRemove: () => void;
  editable: boolean;
}

// ========== SORTABLE ITEM COMPONENT ==========

export function SortableItineraryItem({ item, index, onRemove, editable }: SortableItineraryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-md bg-card border"
      data-testid={`itinerary-item-${item.id}`}
    >
      {editable && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/25 text-primary font-bold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.venueName}</p>
        {item.venueType && item.venueType !== 'venue' && (
          <p className="text-xs text-muted-foreground truncate">{item.venueType}</p>
        )}
      </div>
      {item.rating && (
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3 fill-current" />
          {item.rating}
        </Badge>
      )}
      {editable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 flex-shrink-0"
          data-testid={`button-remove-itinerary-${item.id}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ========== MAIN COMPONENT ==========

export function ItineraryDisplay({
  itinerary,
  groupId,
  editable = true,
  onItemRemoved,
  onOrderChanged,
}: ItineraryDisplayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ItineraryItem[]>(itinerary.items || []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      return await apiRequest("PATCH", `/api/itineraries/${itinerary.id}/order`, {
        proposedOrder: newOrder,
      });
    },
    onSuccess: () => {
      toast({
        title: "Order updated",
        description: "Your itinerary has been reordered",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/itinerary-items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "nearby-suggestions"] });
      toast({
        title: "Venue removed",
        description: "The venue has been removed from your itinerary",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing venue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Update on server
      const newOrder = newItems.map((item) => item.sourceId);
      updateOrderMutation.mutate(newOrder);
      onOrderChanged?.(newOrder);
    }
  }

  const handleRemoveItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
    onItemRemoved?.(itemId);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No venues in this itinerary yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableItineraryItem
              key={item.id}
              item={item}
              index={index}
              onRemove={() => handleRemoveItem(item.id)}
              editable={editable}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
