/**
 * VenueGrid - Grid/list layout for venue cards
 *
 * Supports both grid and horizontal scroll layouts with loading and empty states.
 */

import { VenueCard, VenueData } from "./VenueCard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface VenueGridProps {
  venues: VenueData[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isLoading?: boolean;
  layout?: 'grid' | 'horizontal';
  size?: 'sm' | 'md' | 'lg';
  selectionMode?: 'checkbox' | 'heart' | 'none';
  showSource?: boolean;
  emptyState?: {
    icon: 'search' | 'heart' | 'sparkles';
    title: string;
    description: string;
  };
  maxDisplay?: number;
  onViewAll?: () => void;
  className?: string;
}

export function VenueGrid({
  venues,
  selectedIds,
  onToggle,
  isLoading = false,
  layout = 'grid',
  size = 'md',
  selectionMode = 'checkbox',
  showSource = false,
  emptyState,
  maxDisplay,
  onViewAll,
  className,
}: VenueGridProps) {
  const EmptyIcon = emptyState?.icon === 'heart' ? Heart
    : emptyState?.icon === 'sparkles' ? Sparkles
    : Search;

  // Loading state
  if (isLoading) {
    if (layout === 'horizontal') {
      return (
        <div className={cn("flex gap-3 overflow-x-auto pb-2 scrollbar-hide", className)}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-44">
              <Skeleton className="aspect-[4/3] rounded-lg" />
              <Skeleton className="h-4 w-3/4 mt-2" />
              <Skeleton className="h-3 w-1/2 mt-1" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={cn(
        "grid gap-4",
        size === 'lg' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i}>
            <Skeleton className={size === 'lg' ? "aspect-video rounded-lg" : "aspect-[4/3] rounded-lg"} />
            <Skeleton className="h-4 w-3/4 mt-2" />
            <Skeleton className="h-3 w-1/2 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (venues.length === 0 && emptyState) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <EmptyIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-medium mb-1">{emptyState.title}</h3>
        <p className="text-sm text-muted-foreground">{emptyState.description}</p>
      </Card>
    );
  }

  // Determine venues to display
  const displayVenues = maxDisplay ? venues.slice(0, maxDisplay) : venues;
  const hasMore = maxDisplay && venues.length > maxDisplay;

  // Horizontal scroll layout
  if (layout === 'horizontal') {
    return (
      <div className={cn(
        "flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory",
        className
      )}>
        <AnimatePresence mode="popLayout">
          {displayVenues.map((venue) => (
            <motion.div
              key={venue.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 snap-start"
            >
              <VenueCard
                venue={venue}
                isSelected={selectedIds.has(venue.id)}
                onToggle={() => onToggle(venue.id)}
                size={size}
                selectionMode={selectionMode}
                showSource={showSource}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* "More" card */}
        {hasMore && onViewAll && (
          <div
            className="flex-shrink-0 w-44 snap-start flex items-center justify-center cursor-pointer"
            onClick={onViewAll}
          >
            <Card className="w-full h-full min-h-[160px] flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors">
              <div className="text-center p-4">
                <span className="text-2xl font-bold text-muted-foreground">
                  +{venues.length - (maxDisplay || 0)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">more</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Grid layout
  return (
    <div className={cn(
      "grid gap-4",
      size === 'lg'
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : size === 'sm'
          ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
      className
    )}>
      <AnimatePresence mode="popLayout">
        {displayVenues.map((venue) => (
          <motion.div
            key={venue.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <VenueCard
              venue={venue}
              isSelected={selectedIds.has(venue.id)}
              onToggle={() => onToggle(venue.id)}
              size={size}
              selectionMode={selectionMode}
              showSource={showSource}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* "More" card in grid */}
      {hasMore && onViewAll && (
        <Card
          className="flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors cursor-pointer min-h-[160px]"
          onClick={onViewAll}
        >
          <div className="text-center p-4">
            <span className="text-2xl font-bold text-muted-foreground">
              +{venues.length - (maxDisplay || 0)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">more</p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default VenueGrid;
