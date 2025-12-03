/**
 * InlineVenueSelector - Compact venue picker for date-first event creation
 *
 * Three modes:
 * - Quick Pick: AI-suggested venues based on group preferences
 * - Favorites: Group's saved venues
 * - Search: Free-text venue search
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Heart,
  MapPin,
  Search,
  Sparkles,
  Star,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface VenueOption {
  id: string;
  name: string;
  address?: string;
  category?: string;
  rating?: number;
  photoUrl?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
}

export interface InlineVenueSelectorProps {
  groupId: string;
  groupLocation?: string;
  selectedDate: Date | null;
  onSelect: (venues: VenueOption[]) => void;
  onHoldDate: () => void;
  onCancel: () => void;
  maxSelections?: number;
  className?: string;
}

interface VenueCardProps {
  venue: VenueOption;
  isSelected: boolean;
  onToggle: () => void;
}

function VenueCard({ venue, isSelected, onToggle }: VenueCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex flex-col rounded-lg border p-3 text-left transition-all",
        "hover:border-primary/50 hover:bg-accent/50",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Photo or placeholder */}
      <div className="h-20 w-full rounded-md bg-muted mb-2 overflow-hidden">
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <MapPin className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Venue info */}
      <h4 className="text-sm font-medium truncate">{venue.name}</h4>
      {venue.category && (
        <p className="text-xs text-muted-foreground">{venue.category}</p>
      )}
      {venue.rating != null && (
        <div className="flex items-center gap-1 mt-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-xs">{Number(venue.rating).toFixed(1)}</span>
        </div>
      )}
    </button>
  );
}

function VenueCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border p-3">
      <Skeleton className="h-20 w-full rounded-md mb-2" />
      <Skeleton className="h-4 w-24 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function InlineVenueSelector({
  groupId,
  groupLocation = "",
  selectedDate,
  onSelect,
  onHoldDate,
  onCancel,
  maxSelections = 3,
  className,
}: InlineVenueSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>("quick");
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());
  const [venueData, setVenueData] = useState<Map<string, VenueOption>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch favorites (voting events)
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<VenueOption[]>({
    queryKey: ["/api/groups", groupId, "voting-events", "compact"],
    enabled: !!groupId && activeTab === "favorites",
    select: (data: any[]) =>
      data.map((v) => ({
        id: v.id || v.activityId,
        name: v.name || v.venueName,
        address: v.address || v.venueAddress,
        category: v.category || v.venueType,
        rating: v.rating,
        photoUrl: v.photoUrl,
        googlePlaceId: v.googlePlaceId,
        googleMapsUrl: v.googleMapsUrl,
      })),
  });

  // Fetch AI suggestions
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery<VenueOption[]>({
    queryKey: ["/api/groups", groupId, "quick-pick-venues"],
    enabled: !!groupId && activeTab === "quick",
    select: (data: any[]) =>
      data.map((v) => ({
        id: v.id || v.activityId,
        name: v.name || v.venueName,
        address: v.address || v.venueAddress,
        category: v.category || v.venueType,
        rating: v.rating,
        photoUrl: v.photoUrl,
        googlePlaceId: v.googlePlaceId,
        googleMapsUrl: v.googleMapsUrl,
      })),
  });

  // Search venues
  const { data: searchResults = [], isLoading: searchLoading } = useQuery<VenueOption[]>({
    queryKey: ["/api/groups", groupId, "venues/search", { q: debouncedSearch }],
    enabled: !!groupId && activeTab === "search" && debouncedSearch.length >= 2,
    select: (data: any[]) =>
      data.map((v) => ({
        id: v.id || v.googlePlaceId || v.name,
        name: v.name || v.venueName,
        address: v.address || v.venueAddress,
        category: v.category || v.venueType,
        rating: v.rating,
        photoUrl: v.photoUrl,
        googlePlaceId: v.googlePlaceId,
        googleMapsUrl: v.googleMapsUrl,
      })),
  });

  // Toggle venue selection
  const toggleVenue = useCallback((venue: VenueOption) => {
    setSelectedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(venue.id)) {
        next.delete(venue.id);
      } else if (next.size < maxSelections) {
        next.add(venue.id);
        // Store venue data
        setVenueData((prevData) => {
          const newData = new Map(prevData);
          newData.set(venue.id, venue);
          return newData;
        });
      }
      return next;
    });
  }, [maxSelections]);

  // Get selected venue objects
  const selectedVenueList = useMemo(() => {
    return Array.from(selectedVenues)
      .map((id) => venueData.get(id))
      .filter((v): v is VenueOption => v !== undefined);
  }, [selectedVenues, venueData]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    onSelect(selectedVenueList);
  }, [onSelect, selectedVenueList]);

  // Get current venue list based on tab
  const currentVenues = useMemo(() => {
    switch (activeTab) {
      case "quick":
        return suggestions;
      case "favorites":
        return favorites;
      case "search":
        return searchResults;
      default:
        return [];
    }
  }, [activeTab, suggestions, favorites, searchResults]);

  const isLoading =
    (activeTab === "quick" && suggestionsLoading) ||
    (activeTab === "favorites" && favoritesLoading) ||
    (activeTab === "search" && searchLoading);

  return (
    <div
      className={cn(
        "bg-background border rounded-lg shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="text-sm font-semibold">
            {selectedDate
              ? format(selectedDate, "EEEE, MMMM d")
              : "Select Venue"}
          </h3>
          {selectedDate && (
            <p className="text-xs text-muted-foreground">
              Choose a venue or hold the date
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="quick" className="text-xs gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Quick Pick
          </TabsTrigger>
          <TabsTrigger value="favorites" className="text-xs gap-1">
            <Heart className="h-3.5 w-3.5" />
            Favorites
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1">
            <Search className="h-3.5 w-3.5" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* Quick Pick */}
        <TabsContent value="quick" className="mt-0">
          <p className="text-xs text-muted-foreground mb-3">
            AI-suggested venues based on your group's preferences
          </p>
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites" className="mt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Your group's saved favorite venues
          </p>
        </TabsContent>

        {/* Search */}
        <TabsContent value="search" className="mt-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for a venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Venue Grid */}
      <ScrollArea className="px-4" style={{ maxHeight: "280px" }}>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            <VenueCardSkeleton />
            <VenueCardSkeleton />
            <VenueCardSkeleton />
          </div>
        ) : currentVenues.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {currentVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                isSelected={selectedVenues.has(venue.id)}
                onToggle={() => toggleVenue(venue)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {activeTab === "search" && debouncedSearch.length < 2 ? (
              <p>Type to search venues...</p>
            ) : activeTab === "favorites" ? (
              <>
                <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No favorites yet</p>
                <p className="text-xs mt-1">
                  Use Explore tab to discover and save venues
                </p>
              </>
            ) : (
              <p>No venues found</p>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Selection indicator */}
      {selectedVenues.size > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {selectedVenues.size}/{maxSelections} selected:
            </span>
            {selectedVenueList.map((v) => (
              <Badge key={v.id} variant="secondary" className="text-xs gap-1">
                {v.name}
                <button
                  onClick={() => toggleVenue(v)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onHoldDate}
          className="text-xs"
        >
          <MapPin className="h-3.5 w-3.5 mr-1" />
          Venue TBD - Hold Date
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={selectedVenues.size === 0}
          className="text-xs"
        >
          Create Event
          {selectedVenues.size > 0 && ` (${selectedVenues.size})`}
        </Button>
      </div>
    </div>
  );
}

export default InlineVenueSelector;
