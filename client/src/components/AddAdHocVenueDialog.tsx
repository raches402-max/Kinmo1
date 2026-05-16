import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "../hooks/use-toast";
import { getErrorToast } from "./ErrorDisplay";
import { MapPin, Link as LinkIcon, Search } from "lucide-react";

interface AddAdHocVenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itineraryId?: string;
  onSuccess?: () => void;
  onAdd?: (venueData: {
    name: string;
    address?: string;
    googlePlaceId?: string;
    googleMapsUrl?: string;
    notes?: string;
    arrivalTime?: string;
    departureTime?: string;
    travelNotes?: string;
  }) => void;
}

export function AddAdHocVenueDialog({ open, onOpenChange, itineraryId, onSuccess, onAdd }: AddAdHocVenueDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [activeTab, setActiveTab] = useState("manual");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [travelNotes, setTravelNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  const resetForm = () => {
    setName("");
    setAddress("");
    setNotes("");
    setGoogleMapsUrl("");
    setArrivalTime("");
    setDepartureTime("");
    setTravelNotes("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlace(null);
    setActiveTab("manual");
  };

  // Add ad-hoc venue mutation
  const addVenueMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      address?: string;
      googlePlaceId?: string;
      googleMapsUrl?: string;
      notes?: string;
      arrivalTime?: string;
      departureTime?: string;
      travelNotes?: string;
      googlePlaceTypes?: string[];
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", itineraryId] });
      toast({
        title: "Venue added!",
        description: "The venue has been added to your itinerary",
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

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
    onError: (error: any) => {
      toast(getErrorToast(error || new Error("Could not search for places")));
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleSelectPlace = (place: any) => {
    setSelectedPlace(place);
    setName(place.name);
    setAddress(place.address);
  };

  const handleSubmit = () => {
    let venueData: {
      name: string;
      address?: string;
      googlePlaceId?: string;
      googleMapsUrl?: string;
      notes?: string;
      arrivalTime?: string;
      departureTime?: string;
      travelNotes?: string;
      googlePlaceTypes?: string[];
    } | null = null;

    // Common timing data
    const timingData = {
      arrivalTime: arrivalTime || undefined,
      departureTime: departureTime || undefined,
      travelNotes: travelNotes || undefined,
    };

    if (activeTab === "manual") {
      if (!name.trim() || !address.trim()) {
        toast({
          title: "Missing information",
          description: "Please provide both name and address",
          variant: "destructive",
        });
        return;
      }
      venueData = { name, address, notes, ...timingData };
    } else if (activeTab === "url") {
      if (!googleMapsUrl.trim()) {
        toast({
          title: "Missing URL",
          description: "Please provide a Google Maps URL",
          variant: "destructive",
        });
        return;
      }
      const finalName = name.trim() || "Custom Location";
      venueData = { name: finalName, googleMapsUrl, notes, ...timingData };
    } else if (activeTab === "search") {
      if (!selectedPlace) {
        toast({
          title: "No place selected",
          description: "Please select a place from search results",
          variant: "destructive",
        });
        return;
      }
      venueData = {
        name: selectedPlace.name,
        address: selectedPlace.address,
        googlePlaceId: selectedPlace.placeId,
        googlePlaceTypes: selectedPlace.types,
        notes,
        ...timingData,
      };
    }

    if (!venueData) return;

    // If onAdd is provided (shopping cart mode), use it
    if (onAdd) {
      onAdd(venueData);
      resetForm();
      onOpenChange(false);
      toast({
        title: "Location added!",
        description: "The location has been added to your cart",
      });
      return;
    }

    // Otherwise, save to itinerary (event details mode)
    if (itineraryId) {
      addVenueMutation.mutate(venueData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Custom Location</DialogTitle>
          <DialogDescription>
            Add a friend's house, parking spot, or any other location to your itinerary
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">
              <MapPin className="h-4 w-4 mr-1" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-1" />
              Search
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="h-4 w-4 mr-1" />
              Maps URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="manual-name">Name *</Label>
              <Input
                id="manual-name"
                placeholder="e.g., Sarah's House, Main St Parking"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-address">Address *</Label>
              <Input
                id="manual-address"
                placeholder="123 Main St, San Francisco, CA"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-notes">Notes (optional)</Label>
              <Textarea
                id="manual-notes"
                placeholder="Ring doorbell, park in driveway, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-arrival-time">Arrival Time (optional)</Label>
              <Input
                id="manual-arrival-time"
                type="datetime-local"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-departure-time">Departure Time (optional)</Label>
              <Input
                id="manual-departure-time"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-travel-notes">Travel Instructions (optional)</Label>
              <Input
                id="manual-travel-notes"
                placeholder="e.g., Uber from previous location (15 min)"
                value={travelNotes}
                onChange={(e) => setTravelNotes(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Search for a place</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  placeholder="Garden Creamery, coffee shop near me..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending ? "..." : "Search"}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <Label>Select a place</Label>
                {searchResults.map((place, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectPlace(place)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedPlace?.placeId === place.placeId
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">{place.name}</div>
                    <div className="text-sm text-muted-foreground">{place.address}</div>
                    {place.rating && (
                      <div className="text-sm text-muted-foreground mt-1">
                        ⭐ {place.rating}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedPlace && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="search-notes">Notes (optional)</Label>
                  <Textarea
                    id="search-notes"
                    placeholder="Additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-arrival-time">Arrival Time (optional)</Label>
                  <Input
                    id="search-arrival-time"
                    type="datetime-local"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-departure-time">Departure Time (optional)</Label>
                  <Input
                    id="search-departure-time"
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-travel-notes">Travel Instructions (optional)</Label>
                  <Input
                    id="search-travel-notes"
                    placeholder="e.g., Uber from previous location (15 min)"
                    value={travelNotes}
                    onChange={(e) => setTravelNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">Google Maps URL</Label>
              <Input
                id="url-input"
                placeholder="https://maps.google.com/..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Google Maps link to automatically extract location details
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-name">Name (optional)</Label>
              <Input
                id="url-name"
                placeholder="Custom name for this location"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the name from Google Maps
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-notes">Notes (optional)</Label>
              <Textarea
                id="url-notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-arrival-time">Arrival Time (optional)</Label>
              <Input
                id="url-arrival-time"
                type="datetime-local"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-departure-time">Departure Time (optional)</Label>
              <Input
                id="url-departure-time"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-travel-notes">Travel Instructions (optional)</Label>
              <Input
                id="url-travel-notes"
                placeholder="e.g., Uber from previous location (15 min)"
                value={travelNotes}
                onChange={(e) => setTravelNotes(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addVenueMutation.isPending}
          >
            {addVenueMutation.isPending ? "Adding..." : "Add Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
