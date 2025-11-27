/**
 * VenueDiscoveryModule - Unified venue discovery experience
 *
 * A single, reusable component with 3 consistent sub-tabs:
 * - Favorites: Group's saved venues
 * - Search: Free-text venue search
 * - Discover: AI-powered suggestions
 *
 * Supports two modes:
 * - 'select': Pick venues for an event (shows "Plan Event" action)
 * - 'curate': Build favorites (shows "Add to Favorites" action)
 */

import { useState, useCallback, useMemo } from "react";
import { Heart, Search, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { VenueData } from "./VenueCard";
import { FavoritesTab } from "./FavoritesTab";
import { SearchTab } from "./SearchTab";
import { DiscoverTab } from "./DiscoverTab";
import { SelectionBar } from "./SelectionBar";
import { cn } from "@/lib/utils";

export interface VenueDiscoveryModuleProps {
  groupId: string;
  groupLocation?: string;
  mode: 'select' | 'curate';
  selectedVenueIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Called when user clicks "Plan Event" - receives full venue data */
  onCreateEvent?: (venues: VenueData[]) => void;
  /** Called when user clicks "Add to Favorites" - receives full venue data */
  onAddToFavorites?: (venues: VenueData[]) => void;
  onStartSwipe?: () => void;
  maxSelections?: number;
  defaultTab?: 'favorites' | 'search' | 'discover';
  inline?: boolean;
  className?: string;
}

// Internal venue store to track venue data for selected IDs
const venueStore = new Map<string, VenueData>();

export function VenueDiscoveryModule({
  groupId,
  groupLocation = "",
  mode,
  selectedVenueIds: externalSelectedIds,
  onSelectionChange,
  onCreateEvent,
  onAddToFavorites,
  onStartSwipe,
  maxSelections = 5,
  defaultTab = 'favorites',
  inline = false,
  className,
}: VenueDiscoveryModuleProps) {
  const { toast } = useToast();

  // Internal state if not controlled externally
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());

  // Use external state if provided, otherwise internal
  const selectedIds = externalSelectedIds ?? internalSelectedIds;

  // Update selection - handles both direct set and updater function
  const updateSelectedIds = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const newIds = typeof updater === 'function' ? updater(selectedIds) : updater;
    if (onSelectionChange) {
      onSelectionChange(newIds);
    } else {
      setInternalSelectedIds(newIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Location state
  const [location, setLocation] = useState(groupLocation);
  const [radius, setRadius] = useState(10);

  // Active tab
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Toggle venue selection
  const handleToggle = useCallback((id: string, venueData?: VenueData) => {
    // Store venue data if provided
    if (venueData) {
      venueStore.set(id, venueData);
    }

    updateSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelections) {
        next.add(id);
      } else {
        toast({
          title: `Maximum ${maxSelections} venues`,
          description: `You can select up to ${maxSelections} venues`,
          variant: "destructive",
        });
        return prev;
      }
      return next;
    });
  }, [maxSelections, updateSelectedIds, toast]);

  // Remove venue from selection
  const handleRemove = useCallback((id: string) => {
    updateSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [updateSelectedIds]);

  // Get selected venues with data
  const selectedVenues = useMemo(() => {
    return Array.from(selectedIds)
      .map(id => venueStore.get(id))
      .filter((v): v is VenueData => v !== undefined);
  }, [selectedIds]);

  // Handle primary action
  const handleAction = useCallback(() => {
    // Pass full venue data, not just IDs
    if (mode === 'select' && onCreateEvent) {
      onCreateEvent(selectedVenues);
    } else if (mode === 'curate' && onAddToFavorites) {
      onAddToFavorites(selectedVenues);
    }
  }, [mode, selectedVenues, onCreateEvent, onAddToFavorites]);

  // Handle swipe session
  const handleStartSwipe = useCallback(() => {
    if (onStartSwipe) {
      onStartSwipe();
    }
  }, [onStartSwipe]);

  // Wrapper toggle that stores venue data
  const createToggleHandler = useCallback((venue: VenueData) => () => {
    venueStore.set(venue.id, venue);
    handleToggle(venue.id);
  }, [handleToggle]);

  return (
    <div className={cn(
      "relative",
      inline ? "pb-24" : "", // Add padding for selection bar when inline
      className
    )}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-6">
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Favorites</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Discover</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          <FavoritesTab
            groupId={groupId}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onStartDiscover={() => setActiveTab('discover')}
            mode={mode}
          />
        </TabsContent>

        <TabsContent value="search">
          <SearchTab
            groupId={groupId}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            location={location}
            radius={radius}
            mode={mode}
          />
        </TabsContent>

        <TabsContent value="discover">
          <DiscoverTab
            groupId={groupId}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            location={location}
            radius={radius}
            mode={mode}
            onStartSwipe={handleStartSwipe}
          />
        </TabsContent>
      </Tabs>

      {/* Selection bar - only show when inline mode */}
      {inline && (
        <SelectionBar
          selectedVenues={selectedVenues}
          onRemove={handleRemove}
          onAction={handleAction}
          mode={mode}
          maxSelections={maxSelections}
        />
      )}
    </div>
  );
}

export default VenueDiscoveryModule;
