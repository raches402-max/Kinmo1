/**
 * FavoritesTab - Shows group's saved venues (voting_events)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Plus, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { VenueData, CATEGORY_CONFIG, CategoryId } from "./VenueCard";
import { VenueGrid } from "./VenueGrid";
import { VenueDetailSheet } from "./VenueDetailSheet";
import { cn } from "@/lib/utils";

// API response shape for voting events
interface VotingEvent {
  id: number;
  groupId: number;
  name: string;
  venueAddress?: string;
  venueType?: string;
  venuePlaceId?: string;
  photoUrl?: string;
  rating?: string;
  reviewCount?: number;
  priceLevel?: number;
  category?: string;
  upvotes?: number;
  downvotes?: number;
  likedBy?: string[];
}

interface FavoritesTabProps {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onStartDiscover: () => void;
  mode: 'select' | 'curate';
  className?: string;
}

// Transform voting event to VenueData
function toVenueData(event: VotingEvent): VenueData {
  return {
    id: event.id.toString(),
    name: event.name,
    address: event.venueAddress || '',
    photoUrl: event.photoUrl,
    rating: event.rating,
    reviewCount: event.reviewCount,
    priceLevel: event.priceLevel,
    googlePlaceId: event.venuePlaceId,
    category: event.category,
    venueType: event.venueType,
    source: 'favorite',
    likedBy: event.likedBy,
    likedByCount: event.likedBy?.length,
  };
}

export function FavoritesTab({
  groupId,
  selectedIds,
  onToggle,
  onStartDiscover,
  mode,
  className,
}: FavoritesTabProps) {
  // Detail sheet state
  const [selectedVenue, setSelectedVenue] = useState<VenueData | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const handleCardClick = (venue: VenueData) => {
    setSelectedVenue(venue);
    setDetailSheetOpen(true);
  };

  // Fetch voting events (favorites)
  const { data: votingEvents = [], isLoading } = useQuery<VotingEvent[]>({
    queryKey: [`/api/groups/${groupId}/voting-events`],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/voting-events`),
    enabled: !!groupId,
  });

  // Transform to VenueData and dedupe by place ID
  const venues = votingEvents
    .filter(e => e.venuePlaceId) // Only include venues with place IDs
    .reduce((acc, event) => {
      const existing = acc.find(v => v.googlePlaceId === event.venuePlaceId);
      if (!existing) {
        acc.push(toVenueData(event));
      }
      return acc;
    }, [] as VenueData[]);

  // Group by category
  const venuesByCategory = venues.reduce((acc, venue) => {
    const category = venue.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(venue);
    return acc;
  }, {} as Record<string, VenueData[]>);

  // Categories that have venues
  const categoriesWithVenues = Object.keys(CATEGORY_CONFIG).filter(
    cat => venuesByCategory[cat]?.length > 0
  ) as CategoryId[];

  // Empty state
  if (!isLoading && venues.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <Heart className="h-8 w-8 text-rose-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Favorites Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Start discovering venues to build your group's collection of favorite spots
        </p>
        <Button onClick={onStartDiscover} className="gap-2">
          <Compass className="h-4 w-4" />
          Start Discovering
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" />
          <h3 className="font-semibold">Your Favorites</h3>
          <Badge variant="secondary">{venues.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onStartDiscover} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add More
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <VenueGrid
          venues={[]}
          selectedIds={selectedIds}
          onToggle={onToggle}
          isLoading={true}
          layout="grid"
          size="md"
        />
      ) : categoriesWithVenues.length > 0 ? (
        /* Grouped by category */
        categoriesWithVenues.map(categoryId => {
          const categoryConfig = CATEGORY_CONFIG[categoryId];
          const categoryVenues = venuesByCategory[categoryId] || [];

          return (
            <div key={categoryId} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{categoryConfig.emoji}</span>
                <span className="font-medium">{categoryConfig.label}</span>
                <Badge variant="outline" className="text-xs">
                  {categoryVenues.length}
                </Badge>
              </div>
              <VenueGrid
                venues={categoryVenues}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onCardClick={handleCardClick}
                layout="horizontal"
                size="md"
                selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
              />
            </div>
          );
        })
      ) : (
        /* Flat list for uncategorized */
        <VenueGrid
          venues={venues}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onCardClick={handleCardClick}
          layout="grid"
          size="md"
          selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
        />
      )}

      {/* Other/uncategorized */}
      {venuesByCategory['other']?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="font-medium">Other</span>
            <Badge variant="outline" className="text-xs">
              {venuesByCategory['other'].length}
            </Badge>
          </div>
          <VenueGrid
            venues={venuesByCategory['other']}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onCardClick={handleCardClick}
            layout="horizontal"
            size="md"
            selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
          />
        </div>
      )}

      {/* Venue Detail Sheet */}
      <VenueDetailSheet
        venue={selectedVenue}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        groupId={groupId}
      />
    </div>
  );
}

export default FavoritesTab;
