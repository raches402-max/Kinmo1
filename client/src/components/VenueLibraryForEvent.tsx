import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Star, DollarSign, Plus, Check, Search, Filter, Heart, Clock, Globe, Loader2, Info, Trash2, X } from "lucide-react";
import { useDebounce } from "use-debounce";
import { AnimatePresence, motion } from "framer-motion";

interface VenueResult {
  id?: string;
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
  sourceType?: 'activity' | 'voting_event';
}

interface VenueLibraryForEventProps {
  venues: VenueResult[];
  favorites?: VenueResult[];
  selectedVenues: Array<{ sourceType: string; sourceId: string }>;
  onToggleVenue: (sourceType: 'activity' | 'voting_event' | 'google_place', sourceId: string, venueData?: VenueResult) => void;
  maxVenues?: number;
  isLoading?: boolean;
  groupId?: string;
  onDeleteVenue?: (venueId: string) => Promise<void>;
  deletingVenueId?: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  meal: { label: "Restaurants & Meals", icon: "🍽️" },
  cafes: { label: "Cafes & Coffee", icon: "☕" },
  drinks: { label: "Bars & Drinks", icon: "🍷" },
  dessert: { label: "Desserts & Sweets", icon: "🍰" },
  experiences: { label: "Activities & Experiences", icon: "🎉" },
};

function VenueCardForEvent({
  venue,
  isSelected,
  onToggle,
  isFavorite,
  disabled,
  onDelete,
  isDeleting,
}: {
  venue: VenueResult;
  isSelected: boolean;
  onToggle: () => void;
  isFavorite?: boolean;
  disabled?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <Card
      className={`overflow-hidden transition-all relative ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-lg'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isDeleting) setShowDeleteConfirm(false);
      }}
    >
      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          >
            <p className="text-sm font-medium text-center mb-3">
              Remove from library?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="h-8 px-3"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Keep
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-8 px-3"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

        {/* Subtle delete button - appears on hover in top-left */}
        {onDelete && !showDeleteConfirm && (
          <AnimatePresence>
            {isHovered && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                onClick={handleDeleteClick}
                className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 hover:bg-destructive text-white/70 hover:text-white transition-colors z-10"
                title="Remove from library"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {isFavorite && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-1">
              <Heart className="h-3 w-3 fill-current" />
              Favorite
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base line-clamp-1">{venue.venueName}</h3>
          {venue.venueType && (
            <p className="text-xs text-muted-foreground">{venue.venueType}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 flex items-start gap-1">
          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{venue.venueAddress}</span>
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {venue.rating && (
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(venue.rating).toFixed(1)}</span>
              {venue.reviewCount && (
                <span className="text-muted-foreground">({Number(venue.reviewCount).toLocaleString()})</span>
              )}
            </div>
          )}
          {venue.priceLevel && (
            <div className="flex items-center text-xs">
              {"$".repeat(Number(venue.priceLevel))}
            </div>
          )}
        </div>

        {venue.badges && venue.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {venue.badges.slice(0, 3).map((badge, index) => (
              <Badge key={index} variant="outline" className="text-2xs py-0 h-5">
                {badge}
              </Badge>
            ))}
          </div>
        )}

        <Button
          onClick={onToggle}
          disabled={disabled}
          variant={isSelected ? "secondary" : "default"}
          size="sm"
          className="w-full gap-2"
        >
          {isSelected ? (
            <>
              <Check className="h-4 w-4" />
              Added to Event
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add to Event
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function VenueLibraryForEvent({
  venues,
  favorites = [],
  selectedVenues,
  onToggleVenue,
  maxVenues = 5,
  isLoading = false,
  groupId,
  onDeleteVenue,
  deletingVenueId,
}: VenueLibraryForEventProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Google Places search state
  const [googleSearchQuery, setGoogleSearchQuery] = useState("");
  const [debouncedGoogleSearch] = useDebounce(googleSearchQuery, 500);
  const [googleSearchResults, setGoogleSearchResults] = useState<VenueResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  // Filter state
  const [selectedPriceLevels, setSelectedPriceLevels] = useState<Set<string>>(new Set(['1', '2', '3', '4']));
  const [minRating, setMinRating] = useState<string>("any");
  const [sortBy, setSortBy] = useState<string>("rating");

  // Group venues by category
  const venuesByCategory = venues.reduce((acc, venue) => {
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

  // Get all unique venues
  const uniqueVenues = Array.from(
    new Map(venues.map(v => [v.googlePlaceId, v])).values()
  );

  // Filter venues based on search and category
  let filteredVenues = selectedCategory === "all"
    ? uniqueVenues
    : (venuesByCategory[selectedCategory] || []);

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredVenues = filteredVenues.filter(venue =>
      venue.venueName.toLowerCase().includes(query) ||
      venue.venueType?.toLowerCase().includes(query) ||
      venue.venueAddress.toLowerCase().includes(query)
    );
  }

  // Apply price level filter
  filteredVenues = filteredVenues.filter(venue => {
    if (!venue.priceLevel) return true;
    return selectedPriceLevels.has(venue.priceLevel.toString());
  });

  // Apply rating filter
  if (minRating !== "any") {
    filteredVenues = filteredVenues.filter(venue => {
      if (!venue.rating) return false;
      const rating = typeof venue.rating === 'string' ? parseFloat(venue.rating) : venue.rating;
      const threshold = parseFloat(minRating);
      return rating >= threshold;
    });
  }

  // Apply sorting
  const displayVenues = [...filteredVenues].sort((a, b) => {
    if (sortBy === "rating") {
      const ratingA = a.rating ? (typeof a.rating === 'string' ? parseFloat(a.rating) : a.rating) : 0;
      const ratingB = b.rating ? (typeof b.rating === 'string' ? parseFloat(b.rating) : b.rating) : 0;
      return ratingB - ratingA;
    }
    if (sortBy === "price-low") {
      const priceA = a.priceLevel ? Number(a.priceLevel) : 999;
      const priceB = b.priceLevel ? Number(b.priceLevel) : 999;
      return priceA - priceB;
    }
    if (sortBy === "price-high") {
      const priceA = a.priceLevel ? Number(a.priceLevel) : 0;
      const priceB = b.priceLevel ? Number(b.priceLevel) : 0;
      return priceB - priceA;
    }
    return 0;
  });

  // Get set of favorite place IDs for quick lookup
  const favoritePlaceIds = new Set(favorites.map(f => f.googlePlaceId));

  // Check if venue is selected
  const isVenueSelected = (venue: VenueResult) => {
    const sourceType = venue.sourceType || 'activity';
    const sourceId = venue.id || venue.googlePlaceId;
    return selectedVenues.some(v =>
      v.sourceType === sourceType && v.sourceId === sourceId
    );
  };

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

  // Google Places Search
  useEffect(() => {
    if (!debouncedGoogleSearch || debouncedGoogleSearch.length < 2) {
      setGoogleSearchResults([]);
      return;
    }

    const searchGooglePlaces = async () => {
      // Cancel any pending request
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }

      const controller = new AbortController();
      searchAbortController.current = controller;

      setIsSearching(true);
      setSearchError(null);

      try {
        const endpoint = groupId
          ? `/api/groups/${groupId}/search-venues`
          : `/api/places/search`;

        const params = new URLSearchParams({
          query: debouncedGoogleSearch,
          ...(groupId && { groupId })
        });

        const response = await fetch(`${endpoint}?${params}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();

        // Transform results to VenueResult format
        const results = (data.results || data.venues || []).map((place: any) => ({
          id: place.id || place.place_id,
          venueName: place.name,
          googlePlaceId: place.place_id,
          venueAddress: place.formatted_address || place.vicinity,
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          priceLevel: place.price_level,
          photoUrl: place.photoUrl || (place.photos?.[0]?.photo_reference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${process.env.VITE_GOOGLE_PLACES_API_KEY}`
            : null),
          venueType: place.types?.[0]?.replace(/_/g, ' '),
          googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          sourceType: 'google_place' as const
        }));

        setGoogleSearchResults(results);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Google Places search error:', error);
          setSearchError('Failed to search venues. Please try again.');
        }
      } finally {
        setIsSearching(false);
      }
    };

    searchGooglePlaces();
  }, [debouncedGoogleSearch, groupId]);

  const availableCategories = Object.keys(venuesByCategory);
  const canAddMore = selectedVenues.length < maxVenues;

  return (
    <div className="space-y-4">
      {/* Main Search Tabs */}
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">
            <Heart className="h-4 w-4 mr-2" />
            Saved Venues
          </TabsTrigger>
          <TabsTrigger value="search">
            <Globe className="h-4 w-4 mr-2" />
            Search Google Places
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="space-y-4">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter saved venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>

        {showFilters && (
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Price Level</Label>
                <div className="space-y-2">
                  {['1', '2', '3', '4'].map(level => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox
                        id={`price-${level}`}
                        checked={selectedPriceLevels.has(level)}
                        onCheckedChange={() => togglePriceLevel(level)}
                      />
                      <label htmlFor={`price-${level}`} className="text-sm">
                        {"$".repeat(Number(level))}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating-filter" className="text-sm">Minimum Rating</Label>
                <Select value={minRating} onValueChange={setMinRating}>
                  <SelectTrigger id="rating-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Rating</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-by" className="text-sm">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto p-1">
          <TabsTrigger value="all" className="whitespace-nowrap">
            All Venues
          </TabsTrigger>
          {favorites.length > 0 && (
            <TabsTrigger value="favorites" className="whitespace-nowrap">
              <Heart className="h-3 w-3 mr-1" />
              Favorites
            </TabsTrigger>
          )}
          {availableCategories.map(category => {
            const info = CATEGORY_LABELS[category];
            if (!info) return null;
            return (
              <TabsTrigger key={category} value={category} className="whitespace-nowrap">
                <span className="mr-1">{info.icon}</span>
                {info.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Loading venues...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayVenues.map((venue) => (
                <VenueCardForEvent
                  key={venue.googlePlaceId}
                  venue={venue}
                  isSelected={isVenueSelected(venue)}
                  isFavorite={favoritePlaceIds.has(venue.googlePlaceId)}
                  onToggle={() => {
                    const sourceType = venue.sourceType || 'activity';
                    const sourceId = venue.id || venue.googlePlaceId;
                    onToggleVenue(sourceType, sourceId);
                  }}
                  disabled={!canAddMore && !isVenueSelected(venue)}
                  onDelete={venue.id && venue.sourceType === 'activity' && onDeleteVenue ? () => onDeleteVenue(venue.id!) : undefined}
                  isDeleting={deletingVenueId === venue.id}
                />
              ))}
              {displayVenues.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No venues found matching your search.' : 'No venues available.'}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((venue) => (
              <VenueCardForEvent
                key={venue.googlePlaceId}
                venue={venue}
                isSelected={isVenueSelected(venue)}
                isFavorite={true}
                onToggle={() => {
                  const sourceType = venue.sourceType || 'activity';
                  const sourceId = venue.id || venue.googlePlaceId;
                  onToggleVenue(sourceType, sourceId);
                }}
                disabled={!canAddMore && !isVenueSelected(venue)}
              />
            ))}
            {favorites.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No favorite venues yet. Mark venues as favorites to see them here.
              </div>
            )}
          </div>
        </TabsContent>

        {availableCategories.map(category => (
          <TabsContent key={category} value={category} className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(venuesByCategory[category] || [])
                .filter(venue => {
                  // Apply same filters as main list
                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    if (!(venue.venueName.toLowerCase().includes(query) ||
                          venue.venueType?.toLowerCase().includes(query) ||
                          venue.venueAddress.toLowerCase().includes(query))) {
                      return false;
                    }
                  }
                  if (venue.priceLevel && !selectedPriceLevels.has(venue.priceLevel.toString())) {
                    return false;
                  }
                  if (minRating !== "any" && venue.rating) {
                    const rating = typeof venue.rating === 'string' ? parseFloat(venue.rating) : venue.rating;
                    const threshold = parseFloat(minRating);
                    if (rating < threshold) return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  // Apply same sorting
                  if (sortBy === "rating") {
                    const ratingA = a.rating ? (typeof a.rating === 'string' ? parseFloat(a.rating) : a.rating) : 0;
                    const ratingB = b.rating ? (typeof b.rating === 'string' ? parseFloat(b.rating) : b.rating) : 0;
                    return ratingB - ratingA;
                  }
                  if (sortBy === "price-low") {
                    const priceA = a.priceLevel ? Number(a.priceLevel) : 999;
                    const priceB = b.priceLevel ? Number(b.priceLevel) : 999;
                    return priceA - priceB;
                  }
                  if (sortBy === "price-high") {
                    const priceA = a.priceLevel ? Number(a.priceLevel) : 0;
                    const priceB = b.priceLevel ? Number(b.priceLevel) : 0;
                    return priceB - priceA;
                  }
                  return 0;
                })
                .map((venue) => (
                  <VenueCardForEvent
                    key={venue.googlePlaceId}
                    venue={venue}
                    isSelected={isVenueSelected(venue)}
                    isFavorite={favoritePlaceIds.has(venue.googlePlaceId)}
                    onToggle={() => {
                      const sourceType = venue.sourceType || 'activity';
                      const sourceId = venue.id || venue.googlePlaceId;
                      onToggleVenue(sourceType, sourceId);
                    }}
                    disabled={!canAddMore && !isVenueSelected(venue)}
                    onDelete={venue.id && venue.sourceType === 'activity' && onDeleteVenue ? () => onDeleteVenue(venue.id!) : undefined}
                    isDeleting={deletingVenueId === venue.id}
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      </TabsContent>

      {/* Google Places Search Tab */}
      <TabsContent value="search" className="space-y-4">
        <div className="space-y-4">
          {/* Google Search Input */}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for any venue (e.g., 'coffee shops near me', 'Starbucks downtown')"
              value={googleSearchQuery}
              onChange={(e) => setGoogleSearchQuery(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Info Alert */}
          {!googleSearchQuery && !googleSearchResults.length && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Search for any venue using Google Places. Type a business name, category, or location to discover new venues for your event.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {searchError && (
            <Alert variant="destructive">
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          {googleSearchResults.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">
                Search Results ({googleSearchResults.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {googleSearchResults.map((venue) => {
                  const isSelected = selectedVenues.some(v =>
                    v.sourceType === 'google_place' && v.sourceId === venue.googlePlaceId
                  );
                  return (
                    <VenueCardForEvent
                      key={venue.googlePlaceId}
                      venue={venue}
                      isSelected={isSelected}
                      onToggle={() => {
                        onToggleVenue('google_place', venue.googlePlaceId, venue);
                      }}
                      disabled={!canAddMore && !isSelected}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results */}
          {googleSearchQuery && !isSearching && googleSearchResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No venues found for "{googleSearchQuery}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>

      {/* Status Bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        {selectedVenues.length > 0 && (
          <Card className="px-4 py-2 shadow-lg border-primary">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="font-semibold">
                {selectedVenues.length} / {maxVenues} venues selected
              </Badge>
              {selectedVenues.length >= maxVenues && (
                <span className="text-xs text-muted-foreground">Maximum reached</span>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}