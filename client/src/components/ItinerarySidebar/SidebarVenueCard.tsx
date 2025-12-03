/**
 * Sidebar Venue Card Component
 * Individual venue card with drag handle and actions
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SidebarVenueCardProps {
  id: string;
  venueName: string;
  venueType?: string;
  rating?: number;
  priceLevel?: number;
  distanceToNext?: number; // in miles
  isLast: boolean;
  onRemove: (id: string) => void;
}

export function SidebarVenueCard({
  id,
  venueName,
  venueType,
  rating,
  priceLevel,
  distanceToNext,
  isLast,
  onRemove,
}: SidebarVenueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Color code distance indicator
  const getDistanceColor = () => {
    if (!distanceToNext) return "";
    if (distanceToNext < 1) return "text-green-600";
    if (distanceToNext < 2) return "text-yellow-600";
    return "text-red-600";
  };

  const formatPrice = (level?: number) => {
    if (!level) return "";
    return "$".repeat(level);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? "opacity-50 z-50" : ""}`}
    >
      <div className="flex items-start gap-2 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{venueName}</h4>
              {venueType && (
                <p className="text-xs text-muted-foreground">{venueType}</p>
              )}
            </div>

            {/* Remove Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 mt-1">
            {rating != null && (
              <span className="text-xs text-muted-foreground">
                ⭐ {Number(rating).toFixed(1)}
              </span>
            )}
            {priceLevel && (
              <span className="text-xs text-muted-foreground">
                {formatPrice(priceLevel)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Distance to Next Venue */}
      {!isLast && distanceToNext !== undefined && (
        <div className="flex items-center justify-center py-1">
          <div className="flex items-center gap-1 text-xs">
            <ArrowDown className={`h-3 w-3 ${getDistanceColor()}`} />
            <span className={getDistanceColor()}>
              {distanceToNext.toFixed(1)} mi
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
