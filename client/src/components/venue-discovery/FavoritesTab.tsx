/**
 * FavoritesTab - Shows group's saved venues (voting_events)
 *
 * Desktop: Editorial grid layout with generous spacing
 * Mobile: Compact horizontal scroll
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Plus, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { VenueData, CATEGORY_CONFIG, CategoryId } from "./VenueCard";
import { VenueGrid } from "./VenueGrid";
import { VenueDetailSheet } from "./VenueDetailSheet";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// API response shape for voting events
interface VotingEvent {
  id: number;
  groupId: number;
  title: string;
  venueAddress?: string;
  venueType?: string;
  googlePlaceId?: string;
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
    name: event.title,
    address: event.venueAddress || '',
    photoUrl: event.photoUrl,
    rating: event.rating,
    reviewCount: event.reviewCount,
    priceLevel: event.priceLevel,
    googlePlaceId: event.googlePlaceId,
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
    .filter(e => e.googlePlaceId) // Only include venues with place IDs
    .reduce((acc, event) => {
      const existing = acc.find(v => v.googlePlaceId === event.googlePlaceId);
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

  // Empty state - warm, inviting design
  if (!isLoading && venues.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "text-center py-16 sm:py-24 px-6",
          "bg-gradient-to-b from-accent/5 via-transparent to-transparent",
          "rounded-2xl border border-dashed border-accent/20",
          className
        )}
      >
        {/* Decorative icon cluster */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/20 to-primary/10 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
            <Heart className="h-10 w-10 text-accent" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-pulse" />
        </div>

        <h3 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">
          Your collection awaits
        </h3>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
          Discover and save spots your group will love. Build a library of favorites to make planning effortless.
        </p>
        <Button
          onClick={onStartDiscover}
          size="lg"
          className="gap-2 shadow-gold hover:shadow-gold-lg transition-shadow"
        >
          <Compass className="h-4 w-4" />
          Start Discovering
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-6 sm:space-y-10", className)}
    >
      {/* Header - Editorial style on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 sm:pb-6 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent">
            <Heart className="h-4 w-4 fill-current" />
            <span className="text-xs font-medium uppercase tracking-wider">Your Collection</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Saved Places
            <span className="ml-3 text-muted-foreground font-normal text-lg sm:text-xl">
              {venues.length}
            </span>
          </h2>
        </div>
        <Button
          variant="outline"
          onClick={onStartDiscover}
          className="gap-2 self-start sm:self-auto hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add More
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-[4/3] rounded-xl bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : categoriesWithVenues.length > 0 ? (
        /* Grouped by category - Desktop: grid, Mobile: horizontal scroll */
        <div className="space-y-8 sm:space-y-12">
          {categoriesWithVenues.map((categoryId, categoryIndex) => {
            const categoryConfig = CATEGORY_CONFIG[categoryId];
            const categoryVenues = venuesByCategory[categoryId] || [];

            return (
              <motion.section
                key={categoryId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: categoryIndex * 0.1,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Category header - editorial style */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl"
                    style={{
                      backgroundColor: `${categoryConfig.color}15`,
                      color: categoryConfig.color
                    }}
                  >
                    {categoryConfig.emoji}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">{categoryConfig.label}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {categoryVenues.length} {categoryVenues.length === 1 ? 'spot' : 'spots'} saved
                    </p>
                  </div>
                </div>

                {/* Mobile: Horizontal scroll */}
                <div className="sm:hidden">
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

                {/* Desktop: Proper grid with larger cards */}
                <div className="hidden sm:block">
                  <VenueGrid
                    venues={categoryVenues}
                    selectedIds={selectedIds}
                    onToggle={onToggle}
                    onCardClick={handleCardClick}
                    layout="grid"
                    size="lg"
                    selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
                  />
                </div>
              </motion.section>
            );
          })}
        </div>
      ) : (
        /* Flat list for uncategorized */
        <VenueGrid
          venues={venues}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onCardClick={handleCardClick}
          layout="grid"
          size="lg"
          selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
        />
      )}

      {/* Other/uncategorized section */}
      {categoriesWithVenues.length > 0 && venuesByCategory['other']?.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: categoriesWithVenues.length * 0.1,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="space-y-4 sm:space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center text-xl sm:text-2xl">
              📍
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold">Other Places</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {venuesByCategory['other'].length} {venuesByCategory['other'].length === 1 ? 'spot' : 'spots'} saved
              </p>
            </div>
          </div>

          {/* Mobile: Horizontal scroll */}
          <div className="sm:hidden">
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

          {/* Desktop: Grid */}
          <div className="hidden sm:block">
            <VenueGrid
              venues={venuesByCategory['other']}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onCardClick={handleCardClick}
              layout="grid"
              size="lg"
              selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
            />
          </div>
        </motion.section>
      )}

      {/* Venue Detail Sheet */}
      <VenueDetailSheet
        venue={selectedVenue}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        groupId={groupId}
      />
    </motion.div>
  );
}

export default FavoritesTab;
