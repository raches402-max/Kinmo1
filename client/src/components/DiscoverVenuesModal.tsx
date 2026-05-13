import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Compass,
  Sparkles,
  Heart,
  MapPin,
  Loader2,
  Search,
  ChevronDown,
  Settings,
  Star,
  Shuffle,
  Users,
  ExternalLink
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SwipeSessionWithDeck } from "@/components/SwipeSessionWithDeck";
import { VenuePreviewModal } from "@/components/VenuePreviewModal";
import { LoadingState, TimeAwareLoading } from "@/components/LoadingState";
import { ErrorDisplay, getErrorToast } from "@/components/ErrorDisplay";

interface DiscoverVenuesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupLocation?: string;
  onStartSwipeSession?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

interface VotingEvent {
  id: string;
  title: string;
  description?: string;
  venueAddress?: string;
  venueType?: string;
  googlePlaceId?: string;
  rating?: string;
  priceLevel?: number;
  photoUrl?: string;
  upvotes: number;
  downvotes: number;
  netVotes: number;
  likedBy?: string[];
  aiReasoning?: string;
}

interface SearchResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  types?: string[];
}

const CATEGORY_OPTIONS = [
  { value: "meal", label: "Restaurants & Meals", icon: "🍽️" },
  { value: "cafes", label: "Cafes & Coffee", icon: "☕" },
  { value: "drinks", label: "Bars & Drinks", icon: "🍷" },
  { value: "dessert", label: "Desserts & Sweets", icon: "🍰" },
  { value: "experiences", label: "Activities & Experiences", icon: "🎉" },
];

export function DiscoverVenuesModal({
  open,
  onOpenChange,
  groupId,
  groupLocation = "San Francisco, CA",
  onStartSwipeSession,
  onNavigateToTab
}: DiscoverVenuesModalProps) {
  const { toast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Category tab state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [radius, setRadius] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);

  // Advanced options state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [venueCount, setVenueCount] = useState<number>(9);
  const [sortBy, setSortBy] = useState<string>("rating");
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>("");

  // Swipe session state
  const [swipeSessionOpen, setSwipeSessionOpen] = useState(false);
  const [swipeDeck, setSwipeDeck] = useState<any[]>([]);
  const [swipeSessionId, setSwipeSessionId] = useState<string>("");
  const [swipeMode, setSwipeMode] = useState<'favorites' | 'discover' | null>(null);

  // Track current groupId to prevent stale responses from being used
  const groupIdRef = useRef(groupId);
  useEffect(() => {
    groupIdRef.current = groupId;
  }, [groupId]);

  // Reset swipe session state when groupId changes to prevent cross-group data bleed
  useEffect(() => {
    setSwipeSessionOpen(false);
    setSwipeDeck([]);
    setSwipeSessionId("");
    setSwipeMode(null);
    setGeneratedVenues([]);
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    setIsGenerating(false); // Also cancel any in-progress generation
  }, [groupId]);

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [generatedVenues, setGeneratedVenues] = useState<any[]>([]);
  const [previewSearchLocation, setPreviewSearchLocation] = useState<string>("");

  // Error handling state
  const [error, setError] = useState<any>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);

  // Fetch group favorites (voting events with likes)
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<VotingEvent[]>({
    queryKey: [`/api/groups/${groupId}/voting-events`],
    enabled: open && !!groupId,
  });

  // Filter favorites based on search
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const query = searchQuery.toLowerCase();
    return favorites.filter(f =>
      f.title.toLowerCase().includes(query) ||
      f.venueAddress?.toLowerCase().includes(query) ||
      f.venueType?.toLowerCase().includes(query)
    );
  }, [favorites, searchQuery]);

  // Search Google Places
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await apiRequest(
          "GET",
          `/api/venues/search?query=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(groupLocation)}`
        );
        setSearchResults(results || []);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, groupLocation]);

  const getBudgetPriceLevels = (budget: number | null) => {
    if (!budget) return "Using group default";
    if (budget <= 30) return "Allows: $";
    if (budget <= 60) return "Allows: $, $$";
    if (budget < 100) return "Allows: $, $$, $$$";
    return "Allows: All price levels";
  };

  const handleGenerateCategory = async () => {
    if (!selectedCategory) {
      toast({
        title: "Missing Information",
        description: "Please select a category to generate venues",
        variant: "destructive",
      });
      return;
    }

    // Capture the groupId at the start of the request
    const requestGroupId = groupId;

    setIsGenerating(true);
    setError(null);
    setLoadingStartTime(Date.now());

    try {
      const requestBody: any = {
        category: selectedCategory,
        radius,
        count: venueCount,
        sortBy,
      };

      if (location.trim()) {
        requestBody.location = { address: location };
      }

      if (budgetOverride !== null) {
        requestBody.budgetOverride = budgetOverride;
      }

      if (customInstructions.trim()) {
        requestBody.tempInstructions = customInstructions;
      }

      const venues = await apiRequest(
        "POST",
        `/api/groups/${requestGroupId}/generate-category`,
        requestBody,
        { retry: true, maxRetries: 2, timeout: 30000 }
      );

      // CRITICAL: Check if groupId changed while we were waiting for the response
      // If it did, discard this response to prevent cross-group data contamination
      if (groupIdRef.current !== requestGroupId) {
        return;
      }

      setGeneratedVenues(venues);
      setPreviewSearchLocation(location.trim() || "Default location");
      onOpenChange(false);
      setPreviewModalOpen(true);

      toast({
        title: "Venues Generated!",
        description: `Found ${venues.length} great venues for you`,
      });
    } catch (error: any) {
      // Only show error if we're still on the same group
      if (groupIdRef.current === requestGroupId) {
        setError(error);
        toast(getErrorToast(error));
      }
    } finally {
      // Only reset loading state if we're still on the same group
      if (groupIdRef.current === requestGroupId) {
        setIsGenerating(false);
      }
    }
  };

  const handleStartSwipe = async (mode: 'favorites' | 'discover') => {
    // Capture the groupId at the start of the request
    const requestGroupId = groupId;

    setIsGenerating(true);
    setError(null);
    setLoadingStartTime(Date.now());
    setSwipeMode(mode);

    try {
      const response = await apiRequest(
        "POST",
        `/api/groups/${requestGroupId}/discover-venues`,
        {
          count: 15,
          includeExisting: mode === 'favorites', // Include group favorites in the deck
        },
        { retry: true, maxRetries: 2, timeout: 30000 }
      );

      // CRITICAL: Check if groupId changed while we were waiting for the response
      // If it did, discard this response to prevent cross-group data contamination
      if (groupIdRef.current !== requestGroupId) {
        return;
      }

      setSwipeDeck(response.deck || []);
      setSwipeSessionId(response.sessionId);
      onOpenChange(false);
      setSwipeSessionOpen(true);

      toast({
        title: "Ready to swipe!",
        description: `${response.totalVenues} venues to discover`,
      });
    } catch (error: any) {
      // Only show error if we're still on the same group
      if (groupIdRef.current === requestGroupId) {
        setError(error);
        toast(getErrorToast(error));
      }
    } finally {
      // Only reset loading state if we're still on the same group
      if (groupIdRef.current === requestGroupId) {
        setIsGenerating(false);
      }
    }
  };

  const handleAddFromSearch = async (result: SearchResult) => {
    // Capture the groupId at the start of the request
    const requestGroupId = groupId;

    try {
      // Add the venue as a voting event
      await apiRequest("POST", "/api/voting-events", {
        groupId: requestGroupId,
        title: result.name,
        venueAddress: result.address,
        googlePlaceId: result.placeId,
        skipEnrichmentCheck: false,
      });

      // Only update UI if we're still on the same group
      if (groupIdRef.current !== requestGroupId) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: [`/api/groups/${requestGroupId}/voting-events`] });

      toast({
        title: "Venue Added!",
        description: `${result.name} has been added to your favorites`,
      });

      setSearchQuery("");
      setShowSearchDropdown(false);
    } catch (error: any) {
      // Only show error if we're still on the same group
      if (groupIdRef.current === requestGroupId) {
        toast(getErrorToast(error));
      }
    }
  };

  const renderLikedByBadge = (likedBy?: string[]) => {
    if (!likedBy || likedBy.length === 0) return null;

    const displayNames = likedBy.slice(0, 2);
    const remaining = likedBy.length - 2;

    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
        <span>
          {displayNames.join(", ")}
          {remaining > 0 && ` +${remaining}`}
        </span>
      </div>
    );
  };

  const renderVenueCard = (venue: VotingEvent, isNew?: boolean) => (
    <div
      key={venue.id}
      className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Photo */}
      <div className="aspect-[4/3] bg-muted relative">
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <MapPin className="h-8 w-8" />
          </div>
        )}
        {isNew && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            New for you
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div>
          <h4 className="font-medium text-sm line-clamp-1">{venue.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {venue.venueAddress || venue.venueType || "Venue"}
          </p>
        </div>

        <div className="flex items-center justify-between">
          {/* Rating & Price */}
          <div className="flex items-center gap-2 text-xs">
            {venue.rating && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {venue.rating}
              </span>
            )}
            {venue.priceLevel && (
              <span className="text-muted-foreground">
                {"$".repeat(venue.priceLevel)}
              </span>
            )}
          </div>

          {/* Liked by */}
          {renderLikedByBadge(venue.likedBy)}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Discover Venues
          </DialogTitle>
          <DialogDescription>
            Find and save venues your group will love
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar - Always visible at top */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a specific place..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="pl-9 pr-4"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && searchQuery.trim().length >= 2 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-auto">
              {/* Matching Favorites */}
              {filteredFavorites.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    From Your Places
                  </div>
                  {filteredFavorites.slice(0, 3).map((fav) => (
                    <button
                      key={fav.id}
                      className="w-full px-2 py-2 text-left hover:bg-muted rounded flex items-start gap-3"
                      onClick={() => {
                        setSearchQuery("");
                        setShowSearchDropdown(false);
                        // Could navigate to venue detail or select it
                      }}
                    >
                      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {fav.photoUrl ? (
                          <img src={fav.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{fav.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{fav.venueAddress}</p>
                        {renderLikedByBadge(fav.likedBy)}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              {filteredFavorites.length > 0 && searchResults.length > 0 && (
                <div className="border-t" />
              )}

              {/* Google Places Results */}
              {searchResults.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    From Google
                  </div>
                  {searchResults.slice(0, 5).map((result) => (
                    <button
                      key={result.placeId}
                      className="w-full px-2 py-2 text-left hover:bg-muted rounded flex items-start gap-3"
                      onClick={() => handleAddFromSearch(result)}
                    >
                      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {result.photoUrl ? (
                          <img src={result.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{result.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {result.rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {result.rating}
                            </span>
                          )}
                          {result.priceLevel && (
                            <span>{"$".repeat(result.priceLevel)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {!isSearching && filteredFavorites.length === 0 && searchResults.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No venues found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Click outside to close dropdown */}
        {showSearchDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSearchDropdown(false)}
          />
        )}

        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="favorites" className="gap-2">
              <Heart className="h-4 w-4" />
              Group Places
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Discover
            </TabsTrigger>
          </TabsList>

          {/* Group Favorites Tab */}
          <TabsContent value="favorites" className="space-y-4 mt-4">
            {favoritesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : favorites.length === 0 ? (
              /* Empty State */
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Heart className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No saved places yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Start discovering venues your group will love. Use the search bar above or generate suggestions below.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Search Places
                    </Button>
                    <Button onClick={() => handleStartSwipe('discover')}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Discover New
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Favorites Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {favorites.slice(0, 9).map((venue) => renderVenueCard(venue))}
                </div>

                {favorites.length > 9 && (
                  <p className="text-center text-sm text-muted-foreground">
                    +{favorites.length - 9} more in your library
                  </p>
                )}

                {/* Swipe Mode Button */}
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStartSwipe('favorites')}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating && swipeMode === 'favorites' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                    Swipe Mode
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-4 mt-4">
            {/* Category Pills */}
            <div>
              <Label className="text-sm mb-2 block">Quick Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.value)}
                    className="gap-1"
                  >
                    <span>{cat.icon}</span>
                    {cat.label.split(" ")[0]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Generate Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI-Powered Discovery
                </CardTitle>
                <CardDescription>
                  Generate venue suggestions tailored to your group
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && !isGenerating && (
                  <ErrorDisplay error={error} onRetry={handleGenerateCategory} />
                )}

                {isGenerating && (
                  <LoadingState type="ai-generation" showProgress={true} className="my-4" />
                )}

                {!isGenerating && (
                  <>
                    {/* Location Input */}
                    <div className="space-y-2">
                      <Label htmlFor="location-input">Location (optional)</Label>
                      <Input
                        id="location-input"
                        placeholder="e.g., Mission District, Downtown Oakland..."
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>

                    {/* Radius Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="radius-slider">Search Radius</Label>
                        <span className="text-sm text-muted-foreground">{radius} miles</span>
                      </div>
                      <Slider
                        id="radius-slider"
                        min={2}
                        max={50}
                        step={1}
                        value={[radius]}
                        onValueChange={(value) => setRadius(value[0])}
                      />
                    </div>

                    {/* Advanced Options */}
                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" className="w-full justify-between p-2">
                          <span className="flex items-center gap-2 text-sm">
                            <Settings className="h-4 w-4" />
                            Advanced Options
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>Number of Venues</Label>
                            <span className="text-sm text-muted-foreground">{venueCount}</span>
                          </div>
                          <Slider
                            min={3}
                            max={20}
                            step={1}
                            value={[venueCount]}
                            onValueChange={(value) => setVenueCount(value[0])}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Sort By</Label>
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rating">Highest Rated</SelectItem>
                              <SelectItem value="distance">Closest Distance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <Label>Budget Override</Label>
                              <p className="text-xs text-muted-foreground">Override group budget</p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {budgetOverride ? `$${budgetOverride}` : "Default"}
                              </span>
                              {budgetOverride && (
                                <button
                                  onClick={() => setBudgetOverride(null)}
                                  className="text-xs text-primary hover:underline block"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          <Slider
                            min={20}
                            max={150}
                            step={10}
                            value={[budgetOverride || 60]}
                            onValueChange={(value) => setBudgetOverride(value[0])}
                          />
                          <p className="text-xs text-muted-foreground">
                            {getBudgetPriceLevels(budgetOverride)}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Custom Instructions</Label>
                          <Textarea
                            placeholder="e.g., 'Focus on outdoor seating', 'Must be family-friendly'..."
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            rows={2}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={handleGenerateCategory}
                        disabled={!selectedCategory || isGenerating}
                        className="flex-1"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate {selectedCategory ? CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label.split(" ")[0] : "Venues"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStartSwipe('discover')}
                        disabled={isGenerating}
                        className="gap-2"
                      >
                        {isGenerating && swipeMode === 'discover' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Shuffle className="h-4 w-4" />
                        )}
                        Swipe Mode
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Swipe Session Modal */}
      <SwipeSessionWithDeck
        groupId={groupId}
        open={swipeSessionOpen}
        onOpenChange={setSwipeSessionOpen}
        initialDeck={swipeDeck}
        sessionId={swipeSessionId}
        onComplete={() => {
          setSwipeSessionOpen(false);
          queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
          toast({
            title: "Discovery complete!",
            description: "Check your favorites to see what you saved",
          });
        }}
      />

      {/* Venue Preview Modal */}
      <VenuePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        venues={generatedVenues}
        category={selectedCategory}
        searchLocation={previewSearchLocation}
        searchRadius={radius}
        groupId={groupId}
        onComplete={() => {
          onNavigateToTab?.("venue-library");
        }}
      />
    </Dialog>
  );
}
