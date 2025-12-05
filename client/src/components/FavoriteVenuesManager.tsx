import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, X } from "lucide-react";

interface Venue {
  placeId: string;
  name: string;
  address: string;
  category: string;
  photoUrl?: string;
  rating?: string;
}

interface FavoriteVenuesManagerProps {
  memberId: string;
  homeLocation?: string;
  showTitle?: boolean;
  showDescription?: boolean;
}

export function FavoriteVenuesManager({
  memberId,
  homeLocation = "San Francisco, CA",
  showTitle = true,
  showDescription = true,
}: FavoriteVenuesManagerProps) {
  const { toast } = useToast();
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [venueSearchResults, setVenueSearchResults] = useState<Venue[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch existing favorite venues
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<Array<{
    id: string;
    venuePlaceId: string;
    venueName: string;
    venueAddress: string | null;
    venuePhotoUrl: string | null;
    category: string | null;
  }>>({
    queryKey: ["/api/members", memberId, "favorites"],
    enabled: !!memberId,
  });

  // Add favorite mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async (venue: Venue) => {
      return await apiRequest("POST", `/api/members/${memberId}/favorites`, {
        venuePlaceId: venue.placeId,
        venueName: venue.name,
        venueAddress: venue.address,
        venuePhotoUrl: venue.photoUrl,
        category: venue.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "favorites"] });
      toast({
        title: "Added to favorites",
        description: "Venue added successfully",
      });
      setVenueSearchQuery("");
      setVenueSearchResults([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (placeId: string) => {
      return await apiRequest("DELETE", `/api/members/${memberId}/favorites/${placeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "favorites"] });
      toast({
        title: "Removed from favorites",
        description: "Venue removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Search for venues
  const handleVenueSearch = async (query: string) => {
    if (!query.trim()) {
      setVenueSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await apiRequest("GET", `/api/venues/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(homeLocation)}`);
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

  // Handle add favorite
  const handleAddFavorite = (venue: Venue) => {
    // Check if already in favorites
    const alreadyFavorited = favorites.some(f => f.venuePlaceId === venue.placeId);
    if (alreadyFavorited) {
      toast({
        title: "Already in favorites",
        description: "This venue is already in your favorites",
        variant: "destructive",
      });
      return;
    }

    addFavoriteMutation.mutate(venue);
  };

  // Handle remove favorite
  const handleRemoveFavorite = (placeId: string) => {
    removeFavoriteMutation.mutate(placeId);
  };

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle>Saved Places</CardTitle>
          </div>
          {showDescription && (
            <CardDescription>
              Search for and save your favorite venues to help us make better suggestions
            </CardDescription>
          )}
        </CardHeader>
      )}
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
                  disabled={addFavoriteMutation.isPending}
                  className="w-full px-4 py-3 text-left hover:bg-muted flex items-start gap-3 border-b last:border-b-0 disabled:opacity-50"
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

        {/* Display favorites */}
        {favoritesLoading ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading favorites...</p>
          </div>
        ) : favorites.length > 0 ? (
          <div className="space-y-2">
            <Label>Your saved places ({favorites.length})</Label>
            <div className="space-y-2">
              {favorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="flex items-center gap-2 p-3 bg-muted rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{favorite.venueName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {favorite.venueAddress || "No address"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveFavorite(favorite.venuePlaceId)}
                    disabled={removeFavoriteMutation.isPending}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No saved places added yet. Search to add some!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
