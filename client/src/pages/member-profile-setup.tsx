import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MapPin, Calendar, Sparkles, Heart, X, Search, Plus } from "lucide-react";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

type AvailabilityGridType = Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>;

// Activity type cards with icons (not real venues)
const ACTIVITY_TYPE_CARDS = [
  { id: "movies", label: "Movie Nights", emoji: "🎬", description: "Cinema and film screenings" },
  { id: "concerts", label: "Live Concerts", emoji: "🎵", description: "Music venues and live shows" },
  { id: "outdoor", label: "Outdoor Adventures", emoji: "🌲", description: "Hiking, parks, and nature" },
  { id: "trivia", label: "Trivia Nights", emoji: "🧠", description: "Pub quizzes and trivia" },
  { id: "sports", label: "Sports Events", emoji: "⚽", description: "Games and sporting events" },
  { id: "karaoke", label: "Karaoke", emoji: "🎤", description: "Karaoke bars and singing" },
  { id: "dancing", label: "Dancing/Nightlife", emoji: "💃", description: "Dance clubs and nightlife" },
  { id: "games", label: "Games & Arcades", emoji: "🎮", description: "Arcades and game venues" },
];

export default function MemberProfileSetup() {
  const [, params] = useRoute("/member-profile-setup/:memberId");
  const memberId = params?.memberId;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Location state
  const [homeLocation, setHomeLocation] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodedData, setGeocodedData] = useState<{ lat: number; lng: number } | null>(null);

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityGridType>({
    Monday: { morning: false, afternoon: false, evening: false },
    Tuesday: { morning: false, afternoon: false, evening: false },
    Wednesday: { morning: false, afternoon: false, evening: false },
    Thursday: { morning: false, afternoon: false, evening: false },
    Friday: { morning: false, afternoon: false, evening: false },
    Saturday: { morning: false, afternoon: false, evening: false },
    Sunday: { morning: false, afternoon: false, evening: false },
  });

  // Swipe deck state
  const [showSwipeDeck, setShowSwipeDeck] = useState(false);
  const [swipeDeck, setSwipeDeck] = useState<any[]>([]);
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);
  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [isLoadingDeck, setIsLoadingDeck] = useState(false);

  // Favorite venues state
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [venueSearchResults, setVenueSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favoriteVenues, setFavoriteVenues] = useState<any[]>([]);

  // Fetch member data to verify ownership
  const { data: member, isLoading: memberLoading } = useQuery<{
    id: string;
    userId: string | null;
    name: string | null;
    homeBaseLocation: string | null;
    homeBaseLatitude: string | null;
    homeBaseLongitude: string | null;
    activityPreferences: string[] | null;
    personalAvailability: AvailabilityGridType | null;
    profileCompleted: boolean;
  }>({
    queryKey: ["/api/members", memberId],
    enabled: !!memberId && !!user,
  });

  // Fetch existing favorite venues
  const { data: existingFavorites, isLoading: favoritesLoading } = useQuery<Array<{
    id: string;
    venuePlaceId: string;
    venueName: string;
    venueAddress: string | null;
    venuePhotoUrl: string | null;
    category: string | null;
  }>>({
    queryKey: ["/api/members", memberId, "favorites"],
    enabled: !!memberId && !!user,
  });

  // Preload existing profile data
  useEffect(() => {
    if (member) {
      if (member.homeBaseLocation) {
        setHomeLocation(member.homeBaseLocation);
      }
      if (member.homeBaseLatitude && member.homeBaseLongitude) {
        setGeocodedData({
          lat: parseFloat(member.homeBaseLatitude),
          lng: parseFloat(member.homeBaseLongitude)
        });
      }
      if (member.personalAvailability) {
        setAvailability(member.personalAvailability);
      }
    }
  }, [member]);

  // Load existing favorite venues
  useEffect(() => {
    if (existingFavorites && existingFavorites.length > 0) {
      // Transform API response to match UI format
      const transformedFavorites = existingFavorites.map(fav => ({
        placeId: fav.venuePlaceId,
        name: fav.venueName,
        address: fav.venueAddress || "",
        photoUrl: fav.venuePhotoUrl,
        category: fav.category || "other",
      }));
      setFavoriteVenues(transformedFavorites);
    }
  }, [existingFavorites]);

  // Geocode location
  const handleGeocodeLocation = async () => {
    if (!homeLocation.trim()) {
      toast({
        title: "Location required",
        description: "Please enter your home base location",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(homeLocation)}`
      );
      const data = await response.json();

      if (data.latitude && data.longitude) {
        setGeocodedData({ lat: data.latitude, lng: data.longitude });
        toast({
          title: "Location found!",
          description: `${data.formattedAddress || homeLocation}`,
        });
      } else {
        toast({
          title: "Location not found",
          description: "Please try a different location",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to geocode location",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Load swipe deck
  const loadSwipeDeck = async () => {
    setIsLoadingDeck(true);
    try {
      // Fetch popular venues from curated cache
      // For now, we'll create a simple mix of activity type cards
      // TODO: Fetch real venues from API based on location

      // Start with activity type cards
      const activityCards = ACTIVITY_TYPE_CARDS.map(activity => ({
        id: activity.id,
        type: 'activity',
        title: activity.label,
        description: activity.description,
        emoji: activity.emoji,
        category: activity.id,
      }));

      // Shuffle and take first 20 (for now just activity cards, will add venues next)
      const deck = activityCards.slice(0, 8);

      setSwipeDeck(deck);
      setCurrentSwipeIndex(0);
      setShowSwipeDeck(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load discovery deck",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDeck(false);
    }
  };

  // Handle swipe
  const handleSwipe = (direction: 'like' | 'pass') => {
    if (direction === 'like' && swipeDeck[currentSwipeIndex]) {
      setLikedItems(prev => [...prev, swipeDeck[currentSwipeIndex]]);
    }
    setCurrentSwipeIndex(prev => prev + 1);
  };

  // Search for venues
  const handleVenueSearch = async (query: string) => {
    if (!query.trim()) {
      setVenueSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await apiRequest("GET", `/api/venues/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(homeLocation || "San Francisco, CA")}`);
      setVenueSearchResults(results);
    } catch (error) {
      console.error("Venue search error:", error);
      setVenueSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced venue search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleVenueSearch(venueSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [venueSearchQuery, homeLocation]);

  // Add venue to favorites
  const handleAddFavorite = (venue: any) => {
    if (!favoriteVenues.find(v => v.placeId === venue.placeId)) {
      setFavoriteVenues(prev => [...prev, venue]);
      setVenueSearchQuery("");
      setVenueSearchResults([]);
    }
  };

  // Remove venue from favorites
  const handleRemoveFavorite = (placeId: string) => {
    setFavoriteVenues(prev => prev.filter(v => v.placeId !== placeId));
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      // Extract activity preferences from liked items
      const activityPreferences = likedItems
        .filter(item => item.type === 'activity')
        .map(item => item.category);

      // Update profile first
      await apiRequest("PATCH", `/api/members/${memberId}/profile`, {
        homeBaseLocation: homeLocation,
        homeBaseLatitude: geocodedData?.lat,
        homeBaseLongitude: geocodedData?.lng,
        activityPreferences: activityPreferences,
        personalAvailability: availability,
        profileCompleted: true,
      });

      // Save only NEW favorite venues (not already saved)
      const existingPlaceIds = new Set(existingFavorites?.map(f => f.venuePlaceId) || []);
      const newFavorites = favoriteVenues.filter(v => !existingPlaceIds.has(v.placeId));

      for (const venue of newFavorites) {
        try {
          await apiRequest("POST", `/api/members/${memberId}/favorites`, {
            venuePlaceId: venue.placeId,
            venueName: venue.name,
            venueAddress: venue.address,
            venuePhotoUrl: venue.photoUrl,
            category: venue.category,
          });
        } catch (error) {
          console.error("Error saving favorite:", error);
          // Continue saving other favorites even if one fails
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Profile completed!",
        description: "Your preferences have been saved",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleComplete = () => {
    updateProfileMutation.mutate();
  };

  const handleSkip = () => {
    setLocation("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to complete your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!member || member.userId !== (user as any)?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Not Authorized</CardTitle>
            <CardDescription>You don't have permission to edit this profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const swipesRemaining = swipeDeck.length - currentSwipeIndex;
  const hasSwipedEnough = likedItems.length >= 8;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        {/* Location Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Where are you based?</CardTitle>
            </div>
            <CardDescription>
              This helps us suggest activities near you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location">Home Base Location</Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA"
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleGeocodeLocation();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleGeocodeLocation}
                  disabled={isGeocoding || !homeLocation.trim()}
                  variant={geocodedData ? "outline" : "default"}
                >
                  {isGeocoding ? "Finding..." : geocodedData ? "Update" : "Find"}
                </Button>
              </div>
              {geocodedData && (
                <p className="text-sm text-muted-foreground">
                  ✓ Location saved
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Availability Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>When are you typically free?</CardTitle>
            </div>
            <CardDescription>
              This helps the group plan events at times that work for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvailabilityGrid value={availability} onChange={setAvailability} />
          </CardContent>
        </Card>

        {/* Interest Discovery Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <CardTitle>Help us understand what you like</CardTitle>
            </div>
            <CardDescription>
              Swipe through activities and venues to build your profile (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showSwipeDeck ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Discover activities and venues you'll love
                </p>
                <Button
                  onClick={loadSwipeDeck}
                  disabled={isLoadingDeck}
                >
                  {isLoadingDeck ? "Loading..." : "Start Discovering"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentSwipeIndex < swipeDeck.length ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{likedItems.length} liked</span>
                      <span>{swipesRemaining} remaining</span>
                    </div>

                    {/* Simple swipe card */}
                    <Card className="relative overflow-hidden">
                      <CardContent className="p-8 text-center">
                        <div className="text-6xl mb-4">{swipeDeck[currentSwipeIndex].emoji}</div>
                        <h3 className="text-xl font-semibold mb-2">{swipeDeck[currentSwipeIndex].title}</h3>
                        <p className="text-sm text-muted-foreground mb-6">{swipeDeck[currentSwipeIndex].description}</p>

                        <div className="flex gap-4 justify-center">
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleSwipe('pass')}
                            className="gap-2"
                          >
                            <X className="h-5 w-5" />
                            Pass
                          </Button>
                          <Button
                            size="lg"
                            onClick={() => handleSwipe('like')}
                            className="gap-2"
                          >
                            <Heart className="h-5 w-5" />
                            Like
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Suggestion to stop after 8 */}
                    {hasSwipedEnough && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          Great! You've liked {likedItems.length} activities. That's enough to get started!
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentSwipeIndex(swipeDeck.length)}
                        >
                          Finish Swiping
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Heart className="h-12 w-12 mx-auto text-primary mb-4" />
                    <p className="text-lg font-semibold mb-2">
                      All done!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You liked {likedItems.length} activities
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Favorite Venues Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle>Add your favorite places (optional)</CardTitle>
            </div>
            <CardDescription>
              Search for specific venues or restaurants you love
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Label htmlFor="venue-search">Search for a venue</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="venue-search"
                  placeholder="e.g., Blue Bottle Coffee, Golden Gate Park..."
                  value={venueSearchQuery}
                  onChange={(e) => setVenueSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Search results dropdown */}
              {venueSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {venueSearchResults.map((venue) => (
                    <button
                      key={venue.placeId}
                      onClick={() => handleAddFavorite(venue)}
                      className="w-full px-4 py-3 text-left hover:bg-muted flex items-start gap-3 border-b last:border-b-0"
                    >
                      <Plus className="h-4 w-4 text-primary mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{venue.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isSearching && (
                <p className="text-xs text-muted-foreground mt-2">Searching...</p>
              )}
            </div>

            {/* Display selected favorites */}
            {favoriteVenues.length > 0 && (
              <div className="space-y-2">
                <Label>Your favorite places ({favoriteVenues.length})</Label>
                <div className="space-y-2">
                  {favoriteVenues.map((venue) => (
                    <div
                      key={venue.placeId}
                      className="flex items-center gap-2 p-3 bg-muted rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{venue.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveFavorite(venue.placeId)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {favoriteVenues.length === 0 && !venueSearchQuery && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No favorite places added yet. Search to add some!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            View My Groups
          </Button>
          <Button
            onClick={handleComplete}
            disabled={updateProfileMutation.isPending}
            className="flex-1"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
