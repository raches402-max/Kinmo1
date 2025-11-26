import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle
} from "./ui/responsive-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { useToast } from "../hooks/use-toast";
import { Edit, Search, Sparkles, Library, Link as LinkIcon, MapPin, Star, DollarSign, Navigation2 } from "lucide-react";
import type { ItineraryItem } from "@shared/schema";

interface EditVenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: ItineraryItem | null;
  itineraryId?: string;
}

export function EditVenueDialog({ open, onOpenChange, venue, itineraryId }: EditVenueDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState("manual");

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
    setAiSuggestions([]);
    setSelectedAiSuggestion(null);
    setSelectedLibraryVenue(null);
    setActiveTab("manual");
  };

  // Search places mutation
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/places/search?query=${encodeURIComponent(query)}`, {
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
      if (!response.ok) throw new Error("Failed to get suggestions");
      return response.json();
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions || []);
    },
    onError: () => {
      toast({
        title: "AI suggestions unavailable",
        description: "Could not generate venue suggestions",
        variant: "destructive",
      });
    },
  });

  // Fetch curated venues
  const { data: libraryVenues = [] } = useQuery({
    queryKey: ["/api/curated-venues", libraryFilter],
    enabled: open && activeTab === "library",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (libraryFilter.category) params.append("category", libraryFilter.category);
      if (libraryFilter.priceLevel) params.append("priceLevel", libraryFilter.priceLevel);
      params.append("limit", "20");

      const response = await fetch(`/api/curated-venues?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch venues");
      return response.json();
    },
  });

  // Update venue mutation
  const updateVenueMutation = useMutation({
    mutationFn: async (data: {
      venueName?: string;
      venueAddress?: string;
      notes?: string;
      googleMapsUrl?: string;
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
    onSuccess: () => {
      // Invalidate queries to refresh data
      if (itineraryId) {
        queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });

      toast({
        title: "Venue updated!",
        description: "Your changes have been saved",
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
      notes?: string;
      googleMapsUrl?: string;
      arrivalTime?: string | null;
      departureTime?: string | null;
      travelNotes?: string;
    } = {};

    // Only send fields that have changed
    if (venueName !== venue?.venueName) {
      updateData.venueName = venueName;
    }
    if (venueAddress !== (venue?.venueAddress || "")) {
      updateData.venueAddress = venueAddress;
    }
    if (notes !== (venue?.notes || "")) {
      updateData.notes = notes;
    }
    if (googleMapsUrl !== (venue?.googleMapsUrl || "")) {
      updateData.googleMapsUrl = googleMapsUrl;
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

    // Only update if there are actual changes
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
  }, [activeTab]);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Venue</DialogTitle>
          <DialogDescription>
            Update venue details, search for alternatives, or browse suggestions
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="manual">
              <Edit className="h-4 w-4 mr-1" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-1" />
              Search
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="h-4 w-4 mr-1" />
              AI
            </TabsTrigger>
            <TabsTrigger value="library">
              <Library className="h-4 w-4 mr-1" />
              Library
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="h-4 w-4 mr-1" />
              URL
            </TabsTrigger>
          </TabsList>

          {/* Manual Edit Tab */}
          <TabsContent value="manual" className="space-y-4 mt-4">
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
                rows={3}
              />
            </div>

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
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Search for a venue</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  placeholder="e.g., coffee shop in mission"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
              {searchResults.length === 0 && searchMutation.isSuccess && (
                <p className="text-center text-muted-foreground py-8">No results found</p>
              )}
            </div>
          </TabsContent>

          {/* AI Suggestions Tab */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            {aiSuggestionsMutation.isPending && (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 animate-pulse mx-auto mb-2" />
                <p className="text-muted-foreground">Generating suggestions...</p>
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
              {aiSuggestions.length === 0 && aiSuggestionsMutation.isSuccess && (
                <p className="text-center text-muted-foreground py-8">No alternative suggestions available</p>
              )}
            </div>
          </TabsContent>

          {/* Venue Library Tab */}
          <TabsContent value="library" className="space-y-4 mt-4">
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

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {libraryVenues.map((libraryVenue: any, idx: number) => (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedLibraryVenue?.googlePlaceId === libraryVenue.googlePlaceId
                      ? "border-primary bg-primary/5"
                      : "hover:border-gray-300"
                  }`}
                  onClick={() => handleSelectLibraryVenue(libraryVenue)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{libraryVenue.name}</h4>
                      <p className="text-sm text-muted-foreground">{libraryVenue.address}</p>
                      <div className="flex gap-2 mt-1">
                        {libraryVenue.rating && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {libraryVenue.rating}
                          </Badge>
                        )}
                        {libraryVenue.priceLevel && (
                          <Badge variant="secondary" className="text-xs">
                            {"$".repeat(libraryVenue.priceLevel)}
                          </Badge>
                        )}
                        {libraryVenue.category && (
                          <Badge variant="outline" className="text-xs">
                            {libraryVenue.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {libraryVenues.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No curated venues found</p>
              )}
            </div>
          </TabsContent>

          {/* Maps URL Tab */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="google-maps-url">Google Maps URL</Label>
              <Input
                id="google-maps-url"
                placeholder="https://maps.google.com/..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Google Maps link to automatically update venue information
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateVenueMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateVenueMutation.isPending}
          >
            {updateVenueMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
