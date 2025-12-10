/**
 * Places Tab - Your venue library
 *
 * Features:
 * - Swipe mode: Review unreviewed venues from your groups
 * - Personal favorites
 * - Group favorites (per group)
 * - Discover = Google Places search to add new venues
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  MapPin,
  Search,
  Plus,
  Star,
  Grid,
  List,
  ChevronDown,
  Utensils,
  Coffee,
  Wine,
  IceCream,
  Dumbbell,
  X,
  Check,
  Users,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { PlacesSwipeFlow } from "@/components/PlacesSwipeFlow";
import { cn } from "@/lib/utils";
import { handlePhotoError } from "@/hooks/usePhotoRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// Types
interface SavedPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  address?: string | null;
  category?: string | null;
  rating?: string | null;
  priceLevel?: number | null;
  photoUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  // For group places
  addedByName?: string | null;
}

interface GroupWithPlaces {
  groupId: string;
  groupName: string;
  groupEmoji?: string | null;
  places: SavedPlace[];
}

interface AllPlacesResponse {
  personal: SavedPlace[];
  groups: GroupWithPlaces[];
  venueLibrary?: GroupWithPlaces[]; // Voting events from each group
}

interface VenueSearchResult {
  placeId: string;
  name: string;
  address: string;
  category?: string;
  photoUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
}

// Category definitions
const categories = [
  { id: "all", label: "All", icon: Heart },
  { id: "meal", label: "Food", icon: Utensils },
  { id: "cafes", label: "Coffee", icon: Coffee },
  { id: "drinks", label: "Drinks", icon: Wine },
  { id: "dessert", label: "Dessert", icon: IceCream },
  { id: "experiences", label: "Activities", icon: Dumbbell },
];

// Helper to format price level
const formatPriceLevel = (level?: number | null) => {
  if (!level) return null;
  return "$".repeat(level);
};

// Helper to extract compact address (neighborhood, city instead of full street address)
const getCompactAddress = (address?: string | null): string => {
  if (!address) return "";
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    // Skip street address, take neighborhood/area and city
    // Filter out zip codes (5 digits or 5+4 format)
    const relevantParts = parts.slice(1).filter(p => !/^\d{5}(-\d{4})?$/.test(p) && !/^[A-Z]{2}\s*\d{5}/.test(p));
    return relevantParts.slice(0, 2).join(', ');
  } else if (parts.length === 2) {
    return parts.join(', ');
  }
  return address;
};

// Helper to build Google Maps URL
const getGoogleMapsUrl = (place: { googlePlaceId?: string | null; name: string; address?: string | null }) => {
  if (place.googlePlaceId) {
    return `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address || ''}`)}`;
};

// Helper to map categories
const getCategoryIcon = (category?: string | null) => {
  switch (category?.toLowerCase()) {
    case "meal":
      return Utensils;
    case "cafes":
      return Coffee;
    case "drinks":
      return Wine;
    case "dessert":
      return IceCream;
    case "experiences":
      return Dumbbell;
    default:
      return MapPin;
  }
};

// Response type for swipe queue
interface PlacesSwipeQueueResponse {
  groups: Array<{
    groupId: string;
    groupName: string;
    venues: Array<{ id: string }>;
    totalUnreviewed: number;
  }>;
  totalUnreviewed: number;
  totalGroups: number;
}

export default function PlacesPage() {
  const { toast } = useToast();
  const searchString = useSearch();

  // Parse URL params for group filter (e.g., /places?group=abc123)
  const urlGroupId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("group");
  }, [searchString]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string>(urlGroupId || "all");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveToGroupId, setSaveToGroupId] = useState<string>("personal");
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [venueToSave, setVenueToSave] = useState<VenueSearchResult | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Swipe mode state - check if there are unreviewed venues
  const [showSwipeMode, setShowSwipeMode] = useState<boolean | null>(null); // null = loading, true/false = show/hide

  // Update selectedGroupId when URL param changes
  useEffect(() => {
    if (urlGroupId) {
      setSelectedGroupId(urlGroupId);
    }
  }, [urlGroupId]);

  // Check for unreviewed venues to determine initial view
  const { data: swipeQueue, isLoading: isLoadingSwipeQueue } = useQuery<PlacesSwipeQueueResponse>({
    queryKey: ["/api/user/places-swipe-queue"],
    queryFn: () => apiRequest("GET", "/api/user/places-swipe-queue"),
  });

  // Auto-show swipe mode if there are unreviewed venues (only on initial load)
  useEffect(() => {
    if (showSwipeMode === null && !isLoadingSwipeQueue && swipeQueue) {
      setShowSwipeMode(swipeQueue.totalUnreviewed > 0);
    }
  }, [swipeQueue, isLoadingSwipeQueue, showSwipeMode]);

  // Handle image load errors gracefully - triggers lazy photo refresh via shared hook
  const handleLocalImageError = (placeId: string, googlePlaceId?: string, imgElement?: HTMLImageElement) => {
    setFailedImages(prev => new Set(prev).add(placeId));
    // Delegate to shared photo refresh mechanism
    handlePhotoError(googlePlaceId, imgElement);
  };

  // Fetch all places (personal + groups)
  const { data: allPlaces, isLoading } = useQuery<AllPlacesResponse>({
    queryKey: ["/api/user/all-places"],
    queryFn: async () => {
      const res = await fetch("/api/user/all-places");
      if (!res.ok) throw new Error("Failed to fetch places");
      return res.json();
    },
  });

  // Search venues
  const { data: searchResults, isLoading: isSearching, refetch: doSearch } = useQuery<{ results: VenueSearchResult[] }>({
    queryKey: ["/api/venues/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return { results: [] };
      const res = await fetch(`/api/venues/search?query=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search venues");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Save to personal
  const saveToPersonalMutation = useMutation({
    mutationFn: async (venue: VenueSearchResult) => {
      return apiRequest("POST", "/api/user/saved-places", {
        googlePlaceId: venue.placeId,
        name: venue.name,
        address: venue.address,
        category: venue.category,
        rating: venue.rating?.toString(),
        priceLevel: venue.priceLevel,
        photoUrl: venue.photoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
      toast({ title: "Saved!", description: "Added to your personal places" });
      setShowAddSheet(false);
      setSearchQuery("");
      setVenueToSave(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Save to group
  const saveToGroupMutation = useMutation({
    mutationFn: async ({ groupId, venue }: { groupId: string; venue: VenueSearchResult }) => {
      return apiRequest("POST", `/api/groups/${groupId}/saved-places`, {
        googlePlaceId: venue.placeId,
        name: venue.name,
        address: venue.address,
        category: venue.category,
        rating: venue.rating?.toString(),
        priceLevel: venue.priceLevel,
        photoUrl: venue.photoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
      toast({ title: "Saved!", description: "Added to group places" });
      setShowAddSheet(false);
      setSearchQuery("");
      setVenueToSave(null);
      setShowSavePicker(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Remove personal place
  const removePersonalMutation = useMutation({
    mutationFn: async (placeId: string) => {
      return apiRequest("DELETE", `/api/user/saved-places/${placeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
      toast({ title: "Removed", description: "Place removed from your places" });
    },
  });

  // Remove group place (from saved_places table)
  const removeGroupMutation = useMutation({
    mutationFn: async ({ groupId, placeId }: { groupId: string; placeId: string }) => {
      return apiRequest("DELETE", `/api/groups/${groupId}/saved-places/${placeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
      toast({ title: "Removed", description: "Place removed from group" });
    },
  });

  // Remove voting event (from voting_events table - this is the main favorites source)
  const removeVotingEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest("DELETE", `/api/voting-events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
      toast({ title: "Removed", description: "Place removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to remove place", variant: "destructive" });
    },
  });

  // Build group options for filter - combine groups from venue library
  const groupOptions = useMemo(() => {
    const options = [
      { id: "all", name: "All Places", emoji: "🌍" },
      { id: "personal", name: "My Places", emoji: "❤️" },
    ];

    // Track seen groups to avoid duplicates
    const seenGroups = new Set<string>();

    // Add groups from venue library (voting_events) - this is the main source
    if (allPlaces?.venueLibrary) {
      allPlaces.venueLibrary.forEach((g) => {
        if (!seenGroups.has(g.groupId) && g.places.length > 0) {
          seenGroups.add(g.groupId);
          options.push({
            id: g.groupId,
            name: g.groupName,
            emoji: g.groupEmoji || "👥",
          });
        }
      });
    }

    // Add groups from manually saved places (if any)
    if (allPlaces?.groups) {
      allPlaces.groups.forEach((g) => {
        if (!seenGroups.has(g.groupId) && g.places.length > 0) {
          seenGroups.add(g.groupId);
          options.push({
            id: g.groupId,
            name: g.groupName,
            emoji: g.groupEmoji || "👥",
          });
        }
      });
    }

    return options;
  }, [allPlaces]);

  // Filter places based on selection - include venue library
  // sourceType tracks where the place came from for proper deletion
  const filteredPlaces = useMemo(() => {
    const result: Array<SavedPlace & { source: string; groupId?: string; sourceType: 'personal' | 'voting_event' | 'saved_place' }> = [];
    const seenVenues = new Set<string>(); // Track by googlePlaceId to avoid duplicates

    if (!allPlaces) return result;

    // Add personal places
    if (selectedGroupId === "all" || selectedGroupId === "personal") {
      allPlaces.personal.forEach((p) => {
        seenVenues.add(p.googlePlaceId);
        result.push({ ...p, source: "My Places", sourceType: 'personal' });
      });
    }

    // Add venue library (voting_events) - this is the main source of favorites
    if (allPlaces.venueLibrary) {
      if (selectedGroupId === "all") {
        allPlaces.venueLibrary.forEach((g) => {
          g.places.forEach((p) => {
            if (!seenVenues.has(p.googlePlaceId)) {
              seenVenues.add(p.googlePlaceId);
              result.push({
                ...p,
                source: g.groupName,
                groupId: g.groupId,
                sourceType: 'voting_event',
              });
            }
          });
        });
      } else if (selectedGroupId !== "personal") {
        const group = allPlaces.venueLibrary.find((g) => g.groupId === selectedGroupId);
        if (group) {
          group.places.forEach((p) => {
            if (!seenVenues.has(p.googlePlaceId)) {
              seenVenues.add(p.googlePlaceId);
              result.push({
                ...p,
                source: group.groupName,
                groupId: group.groupId,
                sourceType: 'voting_event',
              });
            }
          });
        }
      }
    }

    // Add manually saved group places (if any, as fallback)
    if (selectedGroupId === "all") {
      allPlaces.groups.forEach((g) => {
        g.places.forEach((p) => {
          if (!seenVenues.has(p.googlePlaceId)) {
            seenVenues.add(p.googlePlaceId);
            result.push({ ...p, source: g.groupName, groupId: g.groupId, sourceType: 'saved_place' });
          }
        });
      });
    } else if (selectedGroupId !== "personal") {
      const group = allPlaces.groups.find((g) => g.groupId === selectedGroupId);
      if (group) {
        group.places.forEach((p) => {
          if (!seenVenues.has(p.googlePlaceId)) {
            seenVenues.add(p.googlePlaceId);
            result.push({ ...p, source: group.groupName, groupId: group.groupId, sourceType: 'saved_place' });
          }
        });
      }
    }

    // Filter by category
    if (selectedCategory !== "all") {
      return result.filter((p) => p.category === selectedCategory);
    }

    return result;
  }, [allPlaces, selectedGroupId, selectedCategory]);

  // Build a list of all available groups for the save picker
  const availableGroupsForSave = useMemo(() => {
    const groups: Array<{ groupId: string; groupName: string; groupEmoji?: string | null }> = [];
    const seenGroups = new Set<string>();

    // Add groups from venue library (voting_events)
    if (allPlaces?.venueLibrary) {
      allPlaces.venueLibrary.forEach((g) => {
        if (!seenGroups.has(g.groupId)) {
          seenGroups.add(g.groupId);
          groups.push({
            groupId: g.groupId,
            groupName: g.groupName,
            groupEmoji: g.groupEmoji,
          });
        }
      });
    }

    // Add groups from manually saved places
    if (allPlaces?.groups) {
      allPlaces.groups.forEach((g) => {
        if (!seenGroups.has(g.groupId)) {
          seenGroups.add(g.groupId);
          groups.push({
            groupId: g.groupId,
            groupName: g.groupName,
            groupEmoji: g.groupEmoji,
          });
        }
      });
    }

    return groups;
  }, [allPlaces]);

  const handleSaveVenue = (venue: VenueSearchResult) => {
    // If already viewing a specific group (not "all" or "personal"),
    // save directly to that group without showing the picker
    if (selectedGroupId !== "all" && selectedGroupId !== "personal") {
      // Verify this group exists
      const groupExists = availableGroupsForSave.some(g => g.groupId === selectedGroupId);
      if (groupExists) {
        saveToGroupMutation.mutate({ groupId: selectedGroupId, venue });
        return;
      }
    }

    // Otherwise, show the picker
    setVenueToSave(venue);
    setSaveToGroupId(selectedGroupId === "personal" ? "personal" : "personal"); // Default to personal
    setShowSavePicker(true);
  };

  const confirmSave = () => {
    if (!venueToSave) return;

    if (saveToGroupId === "personal") {
      saveToPersonalMutation.mutate(venueToSave);
    } else {
      saveToGroupMutation.mutate({ groupId: saveToGroupId, venue: venueToSave });
    }
  };

  if (isLoading || isLoadingSwipeQueue) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  // Show swipe mode if there are unreviewed venues
  if (showSwipeMode) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-background">
        <PlacesSwipeFlow
          onComplete={() => {
            setShowSwipeMode(false);
            // Refresh the places list
            queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user/places-swipe-queue"] });
          }}
          onSkip={() => setShowSwipeMode(false)}
        />
      </div>
    );
  }

  const isEmpty = filteredPlaces.length === 0;

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h1 className="text-xl font-bold truncate">Places</h1>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? <List className="h-5 w-5" /> : <Grid className="h-5 w-5" />}
              </Button>
              <Button size="sm" className="h-9" onClick={() => setShowAddSheet(true)}>
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>

          {/* Group filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mb-3 w-full justify-between text-left">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{groupOptions.find((g) => g.id === selectedGroupId)?.emoji}</span>
                  <span className="truncate">{groupOptions.find((g) => g.id === selectedGroupId)?.name}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-[280px]">
              {groupOptions.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="min-w-0"
                >
                  <span className="mr-2 shrink-0">{group.emoji}</span>
                  <span className="truncate">{group.name}</span>
                  {group.id === selectedGroupId && <Check className="ml-auto h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category filters - mobile-optimized horizontal scroll */}
          <div className="relative -mx-4">
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide snap-x snap-mandatory">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 snap-start"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {isEmpty ? (
          <div className="text-center py-12">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No places yet</h3>
            <p className="text-muted-foreground mb-4">
              {selectedGroupId === "personal"
                ? "Save your favorite spots to find them easily later."
                : selectedGroupId === "all"
                ? "No saved places yet. Add your first one!"
                : "No places saved to this group yet."}
            </p>
            <Button onClick={() => setShowAddSheet(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Place
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredPlaces.map((place) => {
              const CategoryIcon = getCategoryIcon(place.category);
              const imageHasFailed = failedImages.has(place.id);
              return (
                <Card key={place.id} className="overflow-hidden group">
                  <div className="relative aspect-[4/3] bg-muted">
                    {place.photoUrl && !imageHasFailed ? (
                      <img
                        src={place.photoUrl}
                        alt={place.name}
                        className="w-full h-full object-cover"
                        onError={(e) => handleLocalImageError(place.id, place.googlePlaceId, e.currentTarget)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <CategoryIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-7 w-7 sm:h-8 sm:w-8 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                      onClick={() => {
                        // Use the correct mutation based on where the place came from
                        if (place.sourceType === 'voting_event') {
                          removeVotingEventMutation.mutate(place.id);
                        } else if (place.sourceType === 'saved_place' && place.groupId) {
                          removeGroupMutation.mutate({ groupId: place.groupId, placeId: place.id });
                        } else {
                          removePersonalMutation.mutate(place.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="p-2 sm:p-3">
                    <h3 className="font-medium text-sm sm:text-base truncate">{place.name}</h3>
                    <a
                      href={getGoogleMapsUrl(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                      title={place.address || "View on Google Maps"}
                    >
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{getCompactAddress(place.address)}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                    </a>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                      {place.rating && (
                        <span className="flex items-center text-xs sm:text-sm">
                          <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-yellow-400 text-yellow-400 mr-0.5" />
                          {place.rating}
                        </span>
                      )}
                      {place.priceLevel && (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {formatPriceLevel(place.priceLevel)}
                        </span>
                      )}
                    </div>
                    {place.addedByName && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                        Added by {place.addedByName}
                      </p>
                    )}
                    <Badge variant="secondary" className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs max-w-full truncate">
                      {place.source}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlaces.map((place) => {
              const CategoryIcon = getCategoryIcon(place.category);
              const imageHasFailed = failedImages.has(place.id);
              return (
                <Card key={place.id} className="p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 group">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {place.photoUrl && !imageHasFailed ? (
                      <img
                        src={place.photoUrl}
                        alt={place.name}
                        className="w-full h-full object-cover"
                        onError={(e) => handleLocalImageError(place.id, place.googlePlaceId, e.currentTarget)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <CategoryIcon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="font-medium text-sm sm:text-base truncate">{place.name}</h3>
                    <a
                      href={getGoogleMapsUrl(place)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                      title={place.address || "View on Google Maps"}
                    >
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{getCompactAddress(place.address)}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                    </a>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                      {place.rating && (
                        <span className="flex items-center text-xs shrink-0">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-0.5" />
                          {place.rating}
                        </span>
                      )}
                      {place.priceLevel && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatPriceLevel(place.priceLevel)}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-none">
                        {place.source}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                    onClick={() => {
                      // Use the correct mutation based on where the place came from
                      if (place.sourceType === 'voting_event') {
                        removeVotingEventMutation.mutate(place.id);
                      } else if (place.sourceType === 'saved_place' && place.groupId) {
                        removeGroupMutation.mutate({ groupId: place.groupId, placeId: place.id });
                      } else {
                        removePersonalMutation.mutate(place.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Place Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] px-4 pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">Add a Place</SheetTitle>
            <SheetDescription className="text-left">
              Search for a place to add to your saved places
            </SheetDescription>
          </SheetHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants, cafes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto h-[calc(100%-120px)] -mx-4 px-4">
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && searchQuery.length < 2 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Type at least 2 characters to search
              </p>
            )}

            {!isSearching && searchResults?.results && searchResults.results.length === 0 && searchQuery.length >= 2 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No results found
              </p>
            )}

            {!isSearching && searchResults?.results && searchResults.results.length > 0 && (
              <div className="space-y-2 pb-4">
                {searchResults.results.map((venue) => {
                  const VenueIcon = getCategoryIcon(venue.category);
                  const imageHasFailed = failedImages.has(venue.placeId);
                  return (
                  <Card
                    key={venue.placeId}
                    className="p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:bg-accent active:bg-accent"
                    onClick={() => handleSaveVenue(venue)}
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                      {venue.photoUrl && !imageHasFailed ? (
                        <img
                          src={venue.photoUrl}
                          alt={venue.name}
                          className="w-full h-full object-cover"
                          onError={(e) => handleLocalImageError(venue.placeId, venue.placeId, e.currentTarget)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                          <VenueIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="font-medium text-sm sm:text-base truncate">{venue.name}</h3>
                      <p
                        className="text-xs sm:text-sm text-muted-foreground truncate flex items-center gap-1"
                        title={venue.address}
                      >
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{getCompactAddress(venue.address)}</span>
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                        {venue.rating && (
                          <span className="flex items-center text-xs shrink-0">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-0.5" />
                            {venue.rating}
                            {venue.reviewCount && (
                              <span className="text-muted-foreground ml-0.5">
                                ({venue.reviewCount.toLocaleString()})
                              </span>
                            )}
                          </span>
                        )}
                        {venue.priceLevel && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatPriceLevel(venue.priceLevel)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Save To Picker Sheet */}
      <Sheet open={showSavePicker} onOpenChange={setShowSavePicker}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] px-4 pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">Save to...</SheetTitle>
            <SheetDescription className="text-left truncate">
              Choose where to save "{venueToSave?.name}"
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 mb-4 overflow-y-auto max-h-[40vh]">
            <Card
              className={cn(
                "p-3 flex items-center gap-3 cursor-pointer active:bg-accent",
                saveToGroupId === "personal" && "ring-2 ring-primary"
              )}
              onClick={() => setSaveToGroupId("personal")}
            >
              <span className="text-xl shrink-0">❤️</span>
              <span className="font-medium text-sm sm:text-base truncate">My Places</span>
              {saveToGroupId === "personal" && <Check className="ml-auto h-4 w-4 text-primary shrink-0" />}
            </Card>

            {availableGroupsForSave.map((group) => (
              <Card
                key={group.groupId}
                className={cn(
                  "p-3 flex items-center gap-3 cursor-pointer active:bg-accent",
                  saveToGroupId === group.groupId && "ring-2 ring-primary"
                )}
                onClick={() => setSaveToGroupId(group.groupId)}
              >
                <span className="text-xl shrink-0">{group.groupEmoji || "👥"}</span>
                <span className="font-medium text-sm sm:text-base truncate">{group.groupName}</span>
                {saveToGroupId === group.groupId && <Check className="ml-auto h-4 w-4 text-primary shrink-0" />}
              </Card>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={confirmSave}
            disabled={saveToPersonalMutation.isPending || saveToGroupMutation.isPending}
          >
            {(saveToPersonalMutation.isPending || saveToGroupMutation.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
