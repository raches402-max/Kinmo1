import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle
} from "./ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { useToast } from "../hooks/use-toast";
import { Edit, Search, Sparkles, Library, Link as LinkIcon, MapPin, Star, DollarSign, Navigation2, ChevronDown, Clock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import type { ItineraryItem } from "@shared/schema";

interface EditVenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: ItineraryItem | null;
  itineraryId?: string;
  groupId?: string;
  itineraryItems?: ItineraryItem[];  // All items in the itinerary for "search near" feature
  mode?: 'edit' | 'add';  // 'add' for adding new venues, 'edit' for editing existing
}

export function EditVenueDialog({ open, onOpenChange, venue, itineraryId, groupId, itineraryItems = [], mode = 'edit' }: EditVenueDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Determine if we have group context (affects which tabs are shown)
  const hasGroupContext = !!groupId;

  // Tab state - Library is default for group context, Find is default otherwise
  const [activeTab, setActiveTab] = useState(hasGroupContext ? "library" : "find");

  // Collapsible states
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showTimingFields, setShowTimingFields] = useState(false);

  // Form state (for manual edit)
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [travelNotes, setTravelNotes] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<any>(null);

  // "Search near" state - null means use group location, string is venue ID
  const [searchNearVenueId, setSearchNearVenueId] = useState<string | null>(null);

  // Compute other venues in itinerary (excluding current venue) with valid coordinates
  const otherVenuesWithCoords = useMemo(() => {
    if (!venue || !itineraryItems?.length) return [];
    return itineraryItems
      .filter(item =>
        item.id !== venue.id &&
        item.latitude &&
        item.longitude
      )
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [venue, itineraryItems]);

  // Get the selected "search near" venue object
  const searchNearVenue = useMemo(() => {
    if (!searchNearVenueId) return null;
    return otherVenuesWithCoords.find(v => v.id === searchNearVenueId) || null;
  }, [searchNearVenueId, otherVenuesWithCoords]);

  // Set default "search near" to previous venue when dialog opens
  useEffect(() => {
    if (open && venue && otherVenuesWithCoords.length > 0) {
      // Find the venue just before the current one by orderIndex
      const currentIndex = venue.orderIndex || 0;
      const previousVenue = otherVenuesWithCoords
        .filter(v => (v.orderIndex || 0) < currentIndex)
        .sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0))[0];

      if (previousVenue) {
        setSearchNearVenueId(previousVenue.id);
      } else {
        // If this is the first venue, default to group location
        setSearchNearVenueId(null);
      }
    }
  }, [open, venue?.id]);

  // Reset active tab when dialog opens based on context
  useEffect(() => {
    if (open) {
      setActiveTab(hasGroupContext ? "library" : "find");
    }
  }, [open, hasGroupContext]);

  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [selectedAiSuggestion, setSelectedAiSuggestion] = useState<any>(null);

  // Library state
  const [libraryFilter, setLibraryFilter] = useState({ category: "", priceLevel: "" });
  const [selectedLibraryVenue, setSelectedLibraryVenue] = useState<any>(null);

  // Initialize form with venue data when dialog opens or venue changes
  useEffect(() => {
    if (venue && open) {
      setVenueName(venue.venueName || "");
      setVenueAddress(venue.venueAddress || "");
      setNotes(venue.notes || "");
      setGoogleMapsUrl(venue.googleMapsUrl || "");

      // Format datetime for input (datetime-local requires YYYY-MM-DDTHH:mm format)
      if (venue.arrivalTime) {
        const date = new Date(venue.arrivalTime);
        const formatted = date.toISOString().slice(0, 16);
        setArrivalTime(formatted);
      } else {
        setArrivalTime("");
      }

      if (venue.departureTime) {
        const date = new Date(venue.departureTime);
        const formatted = date.toISOString().slice(0, 16);
        setDepartureTime(formatted);
      } else {
        setDepartureTime("");
      }

      setTravelNotes(venue.travelNotes || "");
    }
  }, [venue, open]);

  const resetForm = () => {
    setVenueName("");
    setVenueAddress("");
    setNotes("");
    setGoogleMapsUrl("");
    setArrivalTime("");
    setDepartureTime("");
    setTravelNotes("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchResult(null);
    setSearchNearVenueId(null);
    setAiSuggestions([]);
    setSelectedAiSuggestion(null);
    setSelectedLibraryVenue(null);
    setActiveTab("library");
    setShowUrlInput(false);
    setShowTimingFields(false);
    setAiError(null);
  };

  // Search places mutation - supports searching near an itinerary venue
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      let url = `/api/places/search?query=${encodeURIComponent(query)}`;

      // If searching near a specific venue, add lat/lng and use tight radius
      if (searchNearVenue?.latitude && searchNearVenue?.longitude) {
        url += `&lat=${searchNearVenue.latitude}&lng=${searchNearVenue.longitude}&radius=0.5`;
      }

      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
    },
    onError: () => {
      toast({
        title: "Search failed",
        description: "Could not search for places",
        variant: "destructive",
      });
    },
  });

  // Fetch AI suggestions
  const [aiError, setAiError] = useState<string | null>(null);
  const aiSuggestionsMutation = useMutation({
    mutationFn: async () => {
      if (!venue) throw new Error("No venue to analyze");
      const response = await fetch(`/api/venues/suggest-alternatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentVenue: {
            name: venue.venueName,
            address: venue.venueAddress,
            placeId: venue.googlePlaceId,
            venueType: venue.venueType,
          },
          itineraryId,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get suggestions");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions || []);
      setAiError(null);
    },
    onError: (error: Error) => {
      // Show error inline in the AI tab instead of a toast that might disrupt the flow
      setAiError(error.message || "Could not generate venue suggestions");
    },
  });

  // Fetch group's favorites (voting events) - the actual library for this group
  const { data: libraryVenues = [] } = useQuery({
    queryKey: [`/api/groups/${groupId}/voting-events`, libraryFilter],
    enabled: open && activeTab === "library" && !!groupId,
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/voting-events`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch venues");
      const events = await response.json();

      // Transform voting events to match the expected venue format and apply filters
      return events
        .filter((event: any) => {
          // Apply category filter if set
          if (libraryFilter.category && event.venueType) {
            const venueType = event.venueType.toLowerCase();
            const category = libraryFilter.category.toLowerCase();
            // Match category to venue type
            if (category === 'meal' && !venueType.includes('restaurant') && !venueType.includes('food')) return false;
            if (category === 'cafes' && !venueType.includes('cafe') && !venueType.includes('coffee')) return false;
            if (category === 'drinks' && !venueType.includes('bar') && !venueType.includes('pub')) return false;
            if (category === 'dessert' && !venueType.includes('dessert') && !venueType.includes('bakery') && !venueType.includes('ice cream')) return false;
          }
          // Apply price filter if set
          if (libraryFilter.priceLevel && event.priceLevel) {
            if (event.priceLevel !== libraryFilter.priceLevel) return false;
          }
          return true;
        })
        .map((event: any) => ({
          id: event.id,
          name: event.title || event.name,
          address: event.venueAddress,
          category: event.venueType,
          photoUrl: event.photoUrl,
          rating: event.rating,
          reviewCount: event.reviewCount,
          priceLevel: event.priceLevel ? parseInt(event.priceLevel) : null,
          googlePlaceId: event.googlePlaceId || event.venuePlaceId,
          likedBy: event.likedBy,
        }));
    },
  });

  // Update venue mutation with optimistic updates
  const updateVenueMutation = useMutation({
    mutationFn: async (data: {
      venueName?: string;
      venueAddress?: string;
      venueType?: string;
      notes?: string;
      googleMapsUrl?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      rating?: string;
      photoUrl?: string;
      arrivalTime?: string | null;
      departureTime?: string | null;
      travelNotes?: string;
    }) => {
      if (!venue) throw new Error("No venue to update");

      const response = await fetch(`/api/itinerary-items/${venue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update venue");
      }

      return response.json();
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/itineraries", itineraryId] });
      await queryClient.cancelQueries({ queryKey: ["/api/user/events"] });

      // Snapshot previous values
      const previousItinerary = queryClient.getQueryData(["/api/itineraries", itineraryId]);
      const previousEvents = queryClient.getQueryData(["/api/user/events"]);

      // Optimistically update the itinerary cache
      if (itineraryId && venue) {
        queryClient.setQueryData(["/api/itineraries", itineraryId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items?.map((item: any) =>
              item.id === venue.id ? { ...item, ...data } : item
            ),
          };
        });
      }

      // Optimistically update user events cache
      queryClient.setQueryData(["/api/user/events"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((event: any) => {
          if (event.itineraryId === itineraryId && event.itinerary?.items) {
            return {
              ...event,
              itinerary: {
                ...event.itinerary,
                items: event.itinerary.items.map((item: any) =>
                  item.id === venue?.id ? { ...item, ...data } : item
                ),
              },
            };
          }
          return event;
        });
      });

      // Close dialog immediately for snappy feel
      onOpenChange(false);
      resetForm();

      return { previousItinerary, previousEvents };
    },
    onSuccess: () => {
      // Invalidate to ensure server data is fetched
      if (itineraryId) {
        queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });

      toast({
        title: "Venue updated!",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error, _data, context) => {
      // Rollback on error
      if (context?.previousItinerary) {
        queryClient.setQueryData(["/api/itineraries", itineraryId], context.previousItinerary);
      }
      if (context?.previousEvents) {
        queryClient.setQueryData(["/api/user/events"], context.previousEvents);
      }

      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add venue mutation (for mode='add')
  const addVenueMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      address?: string;
      venueType?: string;
      notes?: string;
      googleMapsUrl?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      rating?: string;
      photoUrl?: string;
      arrivalTime?: string | null;
      departureTime?: string | null;
      travelNotes?: string;
    }) => {
      if (!itineraryId) throw new Error("No itinerary to add venue to");

      const response = await fetch(`/api/itineraries/${itineraryId}/items/ad-hoc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add venue");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate to refresh data
      if (itineraryId) {
        queryClient.invalidateQueries({ queryKey: ["/api/itineraries/:id", itineraryId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });

      toast({
        title: "Venue added!",
        description: "The venue has been added to your event",
      });

      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    setSelectedSearchResult(result);
    // Auto-populate fields
    setVenueName(result.name);
    setVenueAddress(result.address);
    // Store the full result data for submission
  };

  const handleSelectAiSuggestion = (suggestion: any) => {
    setSelectedAiSuggestion(suggestion);
    // Auto-populate fields
    setVenueName(suggestion.name);
    setVenueAddress(suggestion.address);
  };

  const handleSelectLibraryVenue = (libraryVenue: any) => {
    setSelectedLibraryVenue(libraryVenue);
    // Auto-populate fields
    setVenueName(libraryVenue.name);
    setVenueAddress(libraryVenue.address);
  };

  const handleSubmit = () => {
    if (!venueName.trim()) {
      toast({
        title: "Missing information",
        description: "Venue name is required",
        variant: "destructive",
      });
      return;
    }

    const updateData: {
      venueName?: string;
      venueAddress?: string;
      venueType?: string;
      notes?: string;
      googleMapsUrl?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      rating?: string;
      photoUrl?: string;
      arrivalTime?: string | null;
      departureTime?: string | null;
      travelNotes?: string;
    } = {};

    // If a search result was selected, include all the venue data
    if (selectedSearchResult) {
      updateData.venueName = selectedSearchResult.name;
      updateData.venueAddress = selectedSearchResult.address;
      if (selectedSearchResult.type) updateData.venueType = selectedSearchResult.type;
      if (selectedSearchResult.placeId) updateData.googlePlaceId = selectedSearchResult.placeId;
      if (selectedSearchResult.latitude) updateData.latitude = String(selectedSearchResult.latitude);
      if (selectedSearchResult.longitude) updateData.longitude = String(selectedSearchResult.longitude);
      if (selectedSearchResult.rating) updateData.rating = String(selectedSearchResult.rating);
      if (selectedSearchResult.photoUrl) updateData.photoUrl = selectedSearchResult.photoUrl;
    } else if (selectedAiSuggestion) {
      // If an AI suggestion was selected, include all the venue data
      updateData.venueName = selectedAiSuggestion.name;
      updateData.venueAddress = selectedAiSuggestion.address;
      if (selectedAiSuggestion.type) updateData.venueType = selectedAiSuggestion.type;
      if (selectedAiSuggestion.placeId) updateData.googlePlaceId = selectedAiSuggestion.placeId;
      if (selectedAiSuggestion.latitude) updateData.latitude = String(selectedAiSuggestion.latitude);
      if (selectedAiSuggestion.longitude) updateData.longitude = String(selectedAiSuggestion.longitude);
      if (selectedAiSuggestion.rating) updateData.rating = String(selectedAiSuggestion.rating);
      if (selectedAiSuggestion.photoUrl) updateData.photoUrl = selectedAiSuggestion.photoUrl;
    } else if (selectedLibraryVenue) {
      // If a library venue was selected, include all the venue data
      updateData.venueName = selectedLibraryVenue.name;
      updateData.venueAddress = selectedLibraryVenue.address;
      if (selectedLibraryVenue.category) updateData.venueType = selectedLibraryVenue.category;
      if (selectedLibraryVenue.googlePlaceId) updateData.googlePlaceId = selectedLibraryVenue.googlePlaceId;
      if (selectedLibraryVenue.latitude) updateData.latitude = String(selectedLibraryVenue.latitude);
      if (selectedLibraryVenue.longitude) updateData.longitude = String(selectedLibraryVenue.longitude);
      if (selectedLibraryVenue.rating) updateData.rating = String(selectedLibraryVenue.rating);
      if (selectedLibraryVenue.photoUrl) updateData.photoUrl = selectedLibraryVenue.photoUrl;
    } else {
      // Manual edit mode - only send fields that have changed
      if (venueName !== venue?.venueName) {
        updateData.venueName = venueName;
      }
      if (venueAddress !== (venue?.venueAddress || "")) {
        updateData.venueAddress = venueAddress;
      }
      if (googleMapsUrl !== (venue?.googleMapsUrl || "")) {
        updateData.googleMapsUrl = googleMapsUrl;
      }
    }

    // Always check notes and travel notes (manual edit fields that can combine with venue swap)
    if (notes !== (venue?.notes || "")) {
      updateData.notes = notes;
    }
    if (travelNotes !== (venue?.travelNotes || "")) {
      updateData.travelNotes = travelNotes;
    }

    // Handle arrival time
    const currentArrival = venue?.arrivalTime ? new Date(venue.arrivalTime).toISOString().slice(0, 16) : "";
    if (arrivalTime !== currentArrival) {
      updateData.arrivalTime = arrivalTime || null;
    }

    // Handle departure time
    const currentDeparture = venue?.departureTime ? new Date(venue.departureTime).toISOString().slice(0, 16) : "";
    if (departureTime !== currentDeparture) {
      updateData.departureTime = departureTime || null;
    }

    // For add mode, use addVenueMutation
    if (mode === 'add') {
      // Ensure we have a name for adding
      const addData = {
        name: updateData.venueName || venueName,
        address: updateData.venueAddress || venueAddress || undefined,
        venueType: updateData.venueType,
        notes: updateData.notes || notes || undefined,
        googleMapsUrl: updateData.googleMapsUrl || googleMapsUrl || undefined,
        googlePlaceId: updateData.googlePlaceId,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        rating: updateData.rating,
        photoUrl: updateData.photoUrl,
        arrivalTime: updateData.arrivalTime,
        departureTime: updateData.departureTime,
        travelNotes: updateData.travelNotes || travelNotes || undefined,
      };
      addVenueMutation.mutate(addData);
      return;
    }

    // For edit mode, only update if there are actual changes
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "No changes",
        description: "No changes were made to the venue",
      });
      onOpenChange(false);
      return;
    }

    updateVenueMutation.mutate(updateData);
  };

  // Load AI suggestions when tab is activated
  useEffect(() => {
    if (activeTab === "ai" && aiSuggestions.length === 0 && venue) {
      aiSuggestionsMutation.mutate();
    }
  }, [activeTab, venue]);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className={isMobile ? "max-h-[85vh] overflow-y-auto pb-2" : "sm:max-w-[650px] max-h-[90vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Venue' : 'Edit Venue'}</DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Search for a venue or enter details manually'
              : 'Update venue details, search for alternatives, or browse suggestions'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${hasGroupContext ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {hasGroupContext && (
              <TabsTrigger value="library">
                <Library className="h-4 w-4 mr-1" />
                Library
              </TabsTrigger>
            )}
            <TabsTrigger value="find">
              <Search className="h-4 w-4 mr-1" />
              Find
            </TabsTrigger>
            {hasGroupContext && (
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4 mr-1" />
                AI
              </TabsTrigger>
            )}
            <TabsTrigger value="details">
              <Edit className="h-4 w-4 mr-1" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Library Tab (default) - Group's favorited venues - only shown with group context */}
          {hasGroupContext && <TabsContent value="library" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <select
                className="border rounded px-2 py-1 text-sm"
                value={libraryFilter.category}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, category: e.target.value })}
              >
                <option value="">All Categories</option>
                <option value="meal">Meals</option>
                <option value="drinks">Drinks</option>
                <option value="dessert">Dessert</option>
                <option value="cafes">Cafes</option>
                <option value="experiences">Experiences</option>
              </select>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={libraryFilter.priceLevel}
                onChange={(e) => setLibraryFilter({ ...libraryFilter, priceLevel: e.target.value })}
              >
                <option value="">All Prices</option>
                <option value="1">$ (Inexpensive)</option>
                <option value="2">$$ (Moderate)</option>
                <option value="3">$$$ (Expensive)</option>
                <option value="4">$$$$ (Very Expensive)</option>
              </select>
            </div>

            <div className={`space-y-1 overflow-y-auto ${isMobile ? 'max-h-[45vh]' : 'max-h-[400px]'}`}>
              {libraryVenues.map((libraryVenue: any, idx: number) => (
                <div
                  key={libraryVenue.id || idx}
                  className={`group flex gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                    selectedLibraryVenue?.googlePlaceId === libraryVenue.googlePlaceId
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectLibraryVenue(libraryVenue)}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {libraryVenue.photoUrl ? (
                      <img
                        src={libraryVenue.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <MapPin className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    {/* Name + Price on same line */}
                    <div className="flex items-baseline gap-2">
                      <h4 className="font-medium text-sm truncate">{libraryVenue.name}</h4>
                      {libraryVenue.priceLevel && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {"$".repeat(libraryVenue.priceLevel)}
                        </span>
                      )}
                    </div>

                    {/* Category + Rating inline */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {libraryVenue.category && (
                        <>
                          <span className="capitalize">{libraryVenue.category.replace(/_/g, ' ')}</span>
                          {libraryVenue.rating && <span className="opacity-40">·</span>}
                        </>
                      )}
                      {libraryVenue.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {libraryVenue.rating}
                          {libraryVenue.reviewCount && (
                            <span className="opacity-60">({Number(libraryVenue.reviewCount).toLocaleString()})</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Liked by - subtle */}
                    {libraryVenue.likedBy && libraryVenue.likedBy.length > 0 && (
                      <p className="text-2xs text-muted-foreground/70 mt-1 truncate">
                        Liked by {libraryVenue.likedBy.slice(0, 2).join(", ")}
                        {libraryVenue.likedBy.length > 2 && ` +${libraryVenue.likedBy.length - 2}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {libraryVenues.length === 0 && !groupId && (
                <p className="text-center text-muted-foreground py-8 text-sm">No group context</p>
              )}
              {libraryVenues.length === 0 && groupId && (
                <p className="text-center text-muted-foreground py-8 text-sm">No saved places in this group yet</p>
              )}
            </div>
          </TabsContent>}

          {/* Find Tab (Search + URL combined) */}
          <TabsContent value="find" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Search for a venue</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  placeholder="e.g., Tang Bar, coffee shop in mission"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? "..." : "Search"}
                </Button>
              </div>
            </div>

            {/* Search Near dropdown - only show if there are other venues with coordinates */}
            {otherVenuesWithCoords.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Search near:</span>
                <Select
                  value={searchNearVenueId || "group"}
                  onValueChange={(val) => setSearchNearVenueId(val === "group" ? null : val)}
                >
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Group location</SelectItem>
                    {otherVenuesWithCoords.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="truncate">{v.venueName}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Collapsible URL input */}
            <Collapsible open={showUrlInput} onOpenChange={setShowUrlInput}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <LinkIcon className="h-3 w-3" />
                  <span>Or paste a Google Maps URL</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showUrlInput ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Input
                  id="google-maps-url"
                  placeholder="https://maps.google.com/..."
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                />
              </CollapsibleContent>
            </Collapsible>

            <div className={`space-y-2 overflow-y-auto ${isMobile ? 'max-h-[40vh]' : 'max-h-[350px]'}`}>
              {searchResults.map((result, idx) => (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedSearchResult?.placeId === result.placeId
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-300"
                  }`}
                  onClick={() => handleSelectSearchResult(result)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{result.name}</h4>
                      <p className="text-sm text-muted-foreground">{result.address}</p>
                      <div className="flex gap-2 mt-1">
                        {result.rating && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {result.rating}
                          </Badge>
                        )}
                        {result.priceLevel && (
                          <Badge variant="secondary" className="text-xs">
                            {result.priceLevel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {searchResults.length === 0 && !searchMutation.isPending && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Search for a venue by name or location
                </p>
              )}
            </div>
          </TabsContent>

          {/* AI Suggestions Tab - only shown with group context */}
          {hasGroupContext && <TabsContent value="ai" className="space-y-4 mt-4">
            {aiSuggestionsMutation.isPending && (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 animate-pulse mx-auto mb-2" />
                <p className="text-muted-foreground">Generating suggestions...</p>
              </div>
            )}

            {/* Inline error display with retry option */}
            {aiError && !aiSuggestionsMutation.isPending && (
              <div className="text-center py-8 space-y-3">
                <div className="text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Couldn't generate suggestions</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{aiError}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAiError(null);
                    aiSuggestionsMutation.mutate();
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            <div className={`space-y-2 overflow-y-auto ${isMobile ? 'max-h-[40vh]' : 'max-h-[400px]'}`}>
              {aiSuggestions.map((suggestion, idx) => (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedAiSuggestion?.placeId === suggestion.placeId
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-300"
                  }`}
                  onClick={() => handleSelectAiSuggestion(suggestion)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{suggestion.name}</h4>
                      <p className="text-sm text-muted-foreground">{suggestion.address}</p>
                      {suggestion.reasoning && (
                        <p className="text-sm text-primary mt-1">💡 {suggestion.reasoning}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {suggestion.rating && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {suggestion.rating}
                          </Badge>
                        )}
                        {suggestion.priceLevel && (
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.priceLevel}
                          </Badge>
                        )}
                        {suggestion.distance && (
                          <Badge variant="secondary" className="text-xs">
                            <Navigation2 className="h-3 w-3 mr-1" />
                            {suggestion.distance}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {aiSuggestions.length === 0 && aiSuggestionsMutation.isSuccess && !aiError && (
                <p className="text-center text-muted-foreground py-8">No alternative suggestions available</p>
              )}
            </div>
          </TabsContent>}

          {/* Details Tab (Manual edit with collapsible timing) */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">Venue Name *</Label>
              <Input
                id="venue-name"
                placeholder="Venue name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue-address">Address</Label>
              <Input
                id="venue-address"
                placeholder="Street address"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this venue..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Collapsible Timing & Travel section */}
            <Collapsible open={showTimingFields} onOpenChange={setShowTimingFields}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2 border-t">
                  <Clock className="h-4 w-4" />
                  <span>Timing & Travel</span>
                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showTimingFields ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="arrival-time">Arrival Time</Label>
                    <Input
                      id="arrival-time"
                      type="datetime-local"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="departure-time">Departure Time</Label>
                    <Input
                      id="departure-time"
                      type="datetime-local"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="travel-notes">Travel Notes</Label>
                  <Textarea
                    id="travel-notes"
                    placeholder="Parking info, directions, etc..."
                    value={travelNotes}
                    onChange={(e) => setTravelNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>

        <DialogFooter className={isMobile ? "pt-2 pb-4 gap-2" : ""}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateVenueMutation.isPending || addVenueMutation.isPending}
            className={isMobile ? "flex-1" : ""}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateVenueMutation.isPending || addVenueMutation.isPending}
            className={isMobile ? "flex-1" : ""}
          >
            {updateVenueMutation.isPending || addVenueMutation.isPending
              ? (mode === 'add' ? "Adding..." : "Saving...")
              : (mode === 'add' ? "Add Venue" : "Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
