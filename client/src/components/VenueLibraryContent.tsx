import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, MapPin, Star, DollarSign, ExternalLink, Loader2, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VenueLibraryContentProps {
  groupId: string;
  onOpenDiscoverModal: () => void;
}

interface VenueResult {
  venueName: string;
  googlePlaceId: string;
  venueAddress: string;
  rating?: number | string;
  reviewCount?: number | string;
  priceLevel?: number | string;
  photoUrl?: string;
  venueType?: string;
  googleMapsUrl?: string;
  category?: string;
  personalizedScore?: number;
  badges?: string[];
}

interface CategorySearchHistory {
  id: string;
  groupId: string;
  category: string;
  searchLocation: string;
  searchRadius: number;
  results: VenueResult[];
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  meal: { label: "Restaurants & Meals", icon: "🍽️" },
  cafes: { label: "Cafes & Coffee", icon: "☕" },
  drinks: { label: "Bars & Drinks", icon: "🍷" },
  dessert: { label: "Desserts & Sweets", icon: "🍰" },
  experiences: { label: "Activities & Experiences", icon: "🎉" },
};

function VenueCard({ venue }: { venue: VenueResult }) {
  // Construct Google Maps URL with multiple fallback options:
  // 1. Use provided googleMapsUrl
  // 2. Construct from googlePlaceId if available
  // 3. Fallback to search by name and address
  const googleMapsUrl = venue.googleMapsUrl ||
    (venue.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.venueName} ${venue.venueAddress}`)}`
    );

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video w-full bg-muted relative">
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.venueName}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <MapPin className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-lg line-clamp-1">{venue.venueName}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 flex items-start gap-1">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{venue.venueAddress}</span>
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {venue.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(venue.rating).toFixed(1)}</span>
              {venue.reviewCount && (
                <span className="text-muted-foreground">({Number(venue.reviewCount).toLocaleString()})</span>
              )}
            </div>
          )}
          {venue.priceLevel && (
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span>{"$".repeat(Number(venue.priceLevel))}</span>
            </div>
          )}
        </div>

        {/* Learning Badges */}
        {venue.badges && venue.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {venue.badges.map((badge, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open(googleMapsUrl, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
          View on Google Maps
        </Button>
      </CardContent>
    </Card>
  );
}

export function VenueLibraryContent({ groupId, onOpenDiscoverModal }: VenueLibraryContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter state
  const [selectedPriceLevels, setSelectedPriceLevels] = useState<Set<string>>(new Set(['$', '$$', '$$$', '$$$$']));
  const [minRating, setMinRating] = useState<string>("any");
  const [sortBy, setSortBy] = useState<string>("rating");

  const { data: activities, isLoading } = useQuery<VenueResult[]>({
    queryKey: [`/api/groups/${groupId}/activities`],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}/activities`),
    enabled: !!groupId,
  });

  // Group venues by category
  const venuesByCategory = (activities || []).reduce((acc, venue) => {
    const category = venue.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    // Avoid duplicates by place ID
    const existingIds = new Set(acc[category].map((v: VenueResult) => v.googlePlaceId));
    if (!existingIds.has(venue.googlePlaceId)) {
      acc[category].push(venue);
    }
    return acc;
  }, {} as Record<string, VenueResult[]>);

  // Get all unique venues across all categories
  const uniqueVenues = Array.from(
    new Map((activities || []).map(v => [v.googlePlaceId, v])).values()
  );

  // Filter venues based on selected category first
  let categoryFilteredVenues = selectedCategory === "all"
    ? uniqueVenues
    : venuesByCategory[selectedCategory] || [];

  // Apply price level filter
  const priceFilteredVenues = categoryFilteredVenues.filter(venue => {
    if (!venue.priceLevel) return true; // Include venues without price data
    return selectedPriceLevels.has(venue.priceLevel.toString());
  });

  // Apply rating filter
  const ratingFilteredVenues = priceFilteredVenues.filter(venue => {
    if (minRating === "any") return true;
    if (!venue.rating) return false;
    const rating = typeof venue.rating === 'string' ? parseFloat(venue.rating) : venue.rating;
    const threshold = parseFloat(minRating);
    return rating >= threshold;
  });

  // Apply sorting
  const displayVenues = [...ratingFilteredVenues].sort((a, b) => {
    if (sortBy === "rating") {
      const ratingA = a.rating ? (typeof a.rating === 'string' ? parseFloat(a.rating) : a.rating) : 0;
      const ratingB = b.rating ? (typeof b.rating === 'string' ? parseFloat(b.rating) : b.rating) : 0;
      return ratingB - ratingA; // Highest first
    }
    // Default: recently added (assumes array order is insertion order)
    return 0;
  });

  const totalVenues = uniqueVenues.length;
  const filteredCount = displayVenues.length;

  // Helper to toggle price level selection
  const togglePriceLevel = (level: string) => {
    setSelectedPriceLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activities || activities.length === 0 || totalVenues === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Venue Library
          </CardTitle>
          <CardDescription>
            Your AI-discovered venues will appear here
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8 space-y-4">
            <div className="text-muted-foreground">
              You haven't discovered any venues yet. Use the Discover Venues feature to find great places for your group!
            </div>
            <Button type="button" onClick={onOpenDiscoverModal} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Discover Venues
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Venue Library
              </CardTitle>
              <CardDescription>
                {totalVenues} venue{totalVenues !== 1 ? 's' : ''} discovered across {Object.keys(venuesByCategory).length} categor{Object.keys(venuesByCategory).length !== 1 ? 'ies' : 'y'}
              </CardDescription>
            </div>
            <Button type="button" onClick={onOpenDiscoverModal} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Discover More
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.keys(venuesByCategory).length + 1}, minmax(0, 1fr))` }}>
              <TabsTrigger value="all">
                All ({totalVenues})
              </TabsTrigger>
              {Object.keys(venuesByCategory).map((category) => {
                const config = CATEGORY_LABELS[category] || { label: category, icon: "📍" };
                return (
                  <TabsTrigger key={category} value={category}>
                    <span className="flex items-center gap-1">
                      <span>{config.icon}</span>
                      <span className="hidden sm:inline">{config.label}</span>
                      <span className="sm:hidden">{config.icon}</span>
                    </span>
                    <Badge variant="secondary" className="ml-1">
                      {venuesByCategory[category].length}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Price Level Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Price Level</Label>
              <div className="space-y-2">
                {['$', '$$', '$$$', '$$$$'].map((level) => (
                  <div key={level} className="flex items-center space-x-2">
                    <Checkbox
                      id={`price-${level}`}
                      checked={selectedPriceLevels.has(level)}
                      onCheckedChange={() => togglePriceLevel(level)}
                    />
                    <label
                      htmlFor={`price-${level}`}
                      className="text-sm cursor-pointer"
                    >
                      {level}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-3">
              <Label htmlFor="rating-filter" className="text-sm font-medium">Minimum Rating</Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger id="rating-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Rating</SelectItem>
                  <SelectItem value="3.0">3.0+ Stars</SelectItem>
                  <SelectItem value="3.5">3.5+ Stars</SelectItem>
                  <SelectItem value="4.0">4.0+ Stars</SelectItem>
                  <SelectItem value="4.5">4.5+ Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-3">
              <Label htmlFor="sort-filter" className="text-sm font-medium">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sort-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Results Summary */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredCount}</span> of{" "}
              <span className="font-medium text-foreground">{totalVenues}</span> venues
              {filteredCount < totalVenues && (
                <span className="text-xs ml-2">
                  ({totalVenues - filteredCount} filtered out)
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Venue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayVenues.map((venue) => (
          <VenueCard key={venue.googlePlaceId} venue={venue} />
        ))}
      </div>

      {displayVenues.length === 0 && selectedCategory !== "all" && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No venues found in this category. Try discovering more venues!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
