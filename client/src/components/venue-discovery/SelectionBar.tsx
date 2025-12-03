/**
 * SelectionBar - Sticky bottom bar showing selected venues and primary action
 */

import { X, Plus, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueData } from "./VenueCard";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SelectionBarProps {
  selectedVenues: VenueData[];
  onRemove: (id: string) => void;
  onAction: () => void;
  mode: 'select' | 'curate';
  maxSelections?: number;
  className?: string;
}

export function SelectionBar({
  selectedVenues,
  onRemove,
  onAction,
  mode,
  maxSelections = 5,
  className,
}: SelectionBarProps) {
  const actionLabel = mode === 'select'
    ? `Plan Event with ${selectedVenues.length} Venue${selectedVenues.length > 1 ? 's' : ''}`
    : `Add ${selectedVenues.length} to Favorites`;

  const ActionIcon = mode === 'select' ? Plus : Heart;

  return (
    <AnimatePresence>
      {selectedVenues.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/95 backdrop-blur-lg border-t z-50 safe-area-pb",
            className
          )}
        >
          <div className="max-w-3xl mx-auto">
            {/* Selected venues preview */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide">
              {selectedVenues.map((venue) => (
                <Badge
                  key={venue.id}
                  variant="secondary"
                  className="flex-shrink-0 gap-1 pr-1 max-w-[150px]"
                >
                  <span className="truncate">{venue.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(venue.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}

              {/* Selection count indicator */}
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {selectedVenues.length}/{maxSelections}
              </span>
            </div>

            {/* Action button */}
            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={onAction}
            >
              <ActionIcon className="h-5 w-5" />
              {actionLabel}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SelectionBar;
