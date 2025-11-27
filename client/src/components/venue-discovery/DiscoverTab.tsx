/**
 * DiscoverTab - AI-powered venue discovery with auto-load
 *
 * Auto-loads suggestions when tab opens. User can filter by category
 * and refresh for new suggestions. Also includes swipe discovery option.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VenueData, CATEGORY_CONFIG, CategoryId } from "./VenueCard";
import { VenueGrid } from "./VenueGrid";
import { cn } from "@/lib/utils";

interface GeneratedVenue {
  venueName: string;
  googlePlaceId: string;
  venueAddress: string;
  rating?: number | string;
  reviewCount?: number | string;
  priceLevel?: number | string;
  photoUrl?: string;
  venueType?: string;
  category?: string;
  personalizedScore?: number;
  badges?: string[];
}

interface DiscoverTabProps {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  location: string;
  radius: number;
  mode: 'select' | 'curate';
  onStartSwipe: () => void;
  className?: string;
}

// Transform generated venue to VenueData
function toVenueData(venue: GeneratedVenue): VenueData {
  return {
    id: venue.googlePlaceId,
    name: venue.venueName,
    address: venue.venueAddress,
    photoUrl: venue.photoUrl,
    rating: venue.rating,
    reviewCount: venue.reviewCount,
    priceLevel: venue.priceLevel,
    googlePlaceId: venue.googlePlaceId,
    category: venue.category,
    venueType: venue.venueType,
    badges: venue.badges,
    source: 'suggestion',
  };
}

export function DiscoverTab({
  groupId,
  selectedIds,
  onToggle,
  location,
  radius,
  mode,
  onStartSwipe,
  className,
}: DiscoverTabProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [venues, setVenues] = useState<VenueData[]>([]);

  // Auto-load suggestions on mount and when category changes
  const generateMutation = useMutation({
    mutationFn: async (category: CategoryId | null) => {
      const requestBody: Record<string, unknown> = {
        radius,
        count: 9,
        sortBy: 'rating',
      };

      if (category) {
        requestBody.category = category;
      } else {
        // Generate a mix of categories
        requestBody.category = 'meal'; // Default to meals
      }

      if (location) {
        requestBody.location = { address: location };
      }

      return apiRequest(
        "POST",
        `/api/groups/${groupId}/generate-category`,
        requestBody,
        { retry: true, maxRetries: 1, timeout: 30000 }
      );
    },
    onSuccess: (data: GeneratedVenue[]) => {
      setVenues(data.map(toVenueData));
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't load suggestions",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Auto-load on mount
  useEffect(() => {
    if (venues.length === 0 && !generateMutation.isPending) {
      generateMutation.mutate(null);
    }
  }, [groupId]); // Only on groupId change/mount

  // Regenerate when category changes
  const handleCategoryChange = (category: CategoryId | null) => {
    setSelectedCategory(category);
    generateMutation.mutate(category);
  };

  const handleRefresh = () => {
    generateMutation.mutate(selectedCategory);
  };

  const isLoading = generateMutation.isPending;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Category chips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">AI Suggestions</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartSwipe}
              className="gap-1.5"
            >
              <Compass className="h-4 w-4" />
              Swipe Mode
            </Button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryChange(null)}
            className="flex-shrink-0"
          >
            All
          </Button>
          {(Object.entries(CATEGORY_CONFIG) as [CategoryId, typeof CATEGORY_CONFIG[CategoryId]][]).map(([id, config]) => (
            <Button
              key={id}
              variant={selectedCategory === id ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-shrink-0 gap-1.5",
                selectedCategory === id && "shadow-sm"
              )}
              style={selectedCategory === id ? {
                backgroundColor: config.color,
                borderColor: config.color,
                color: 'white'
              } : undefined}
              onClick={() => handleCategoryChange(id)}
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      <VenueGrid
        venues={venues}
        selectedIds={selectedIds}
        onToggle={onToggle}
        isLoading={isLoading}
        layout="grid"
        size="lg"
        selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
        showSource={true}
        emptyState={{
          icon: 'sparkles',
          title: 'Generating suggestions...',
          description: 'AI is finding the best venues for your group',
        }}
      />

      {/* Swipe discovery promo (when not many results) */}
      {!isLoading && venues.length > 0 && venues.length < 5 && (
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Want more options? Try swiping to discover venues one at a time
          </p>
          <Button variant="outline" size="sm" onClick={onStartSwipe} className="gap-1.5">
            <Compass className="h-4 w-4" />
            Start Swipe Discovery
          </Button>
        </div>
      )}
    </div>
  );
}

export default DiscoverTab;
