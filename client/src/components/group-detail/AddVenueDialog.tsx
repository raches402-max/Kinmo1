import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Activity {
  id: string;
  venueName: string;
  venueType: string;
  googlePlaceId?: string | null;
}

interface VotingEvent {
  id: string;
  title: string;
  venueType?: string | null;
  googlePlaceId?: string | null;
}

interface ItineraryItem {
  sourceType: 'activity' | 'voting_event';
  sourceId: string;
}

interface VenueToAdd {
  sourceType: 'activity' | 'voting_event';
  sourceId: string;
}

interface SearchResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  photoUrl?: string;
  types?: string[];
}

interface AddVenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  activities: Activity[];
  votingEvents: VotingEvent[];
  currentItineraryItems: ItineraryItem[];
  editingItineraryId: string | null;
  onAddFromSearch: (result: SearchResult) => Promise<void>;
  onAddSelected: (items: VenueToAdd[]) => void;
  isAddingFromSearch: boolean;
  isAddingSelected: boolean;
}

export function AddVenueDialog({
  open,
  onOpenChange,
  groupId,
  activities,
  votingEvents,
  currentItineraryItems,
  editingItineraryId,
  onAddFromSearch,
  onAddSelected,
  isAddingFromSearch,
  isAddingSelected,
}: AddVenueDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [venuesToAdd, setVenuesToAdd] = useState<VenueToAdd[]>([]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setVenuesToAdd([]);
    }
  }, [open]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search query
  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/groups", groupId, "search-venues-dialog", debouncedSearchQuery.trim()],
    queryFn: async () => {
      if (!debouncedSearchQuery.trim() || debouncedSearchQuery.trim().length < 2) {
        return [];
      }
      const response = await fetch(`/api/groups/${groupId}/search-venues?query=${encodeURIComponent(debouncedSearchQuery.trim())}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!groupId && open && debouncedSearchQuery.trim().length >= 2,
    staleTime: 30000,
  });

  const handleAddFromSearch = async (result: SearchResult) => {
    await onAddFromSearch(result);
    setSearchQuery("");
  };

  const handleAddSelected = () => {
    if (venuesToAdd.length === 0 || !editingItineraryId) return;
    onAddSelected(venuesToAdd);
    setVenuesToAdd([]);
  };

  const isAlreadyInPlan = (sourceType: 'activity' | 'voting_event', sourceId: string, placeId?: string) => {
    if (placeId) {
      // For search results, check by placeId
      return currentItineraryItems.some((item) => {
        if (item.sourceType === 'voting_event') {
          const event = votingEvents.find(e => e.id === item.sourceId);
          return event?.googlePlaceId === placeId;
        } else if (item.sourceType === 'activity') {
          const activity = activities.find(a => a.id === item.sourceId);
          return activity?.googlePlaceId === placeId;
        }
        return false;
      });
    }
    // For activities/voting events, check by sourceType and sourceId
    return currentItineraryItems.some((item) => item.sourceType === sourceType && item.sourceId === sourceId);
  };

  const toggleVenueSelection = (sourceType: 'activity' | 'voting_event', sourceId: string) => {
    const isSelected = venuesToAdd.some(v => v.sourceType === sourceType && v.sourceId === sourceId);
    if (isSelected) {
      setVenuesToAdd(prev => prev.filter(v => !(v.sourceType === sourceType && v.sourceId === sourceId)));
    } else {
      setVenuesToAdd(prev => [...prev, { sourceType, sourceId }]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-venue">
        <DialogHeader>
          <DialogTitle>Add Venues to Plan</DialogTitle>
          <DialogDescription>
            Search for venues or select from your activities and voting events
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Search for Venues */}
          <div className="space-y-3">
            <Label>Search for Venues</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for parks, restaurants, cafes, or any venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-dialog-venue-search"
              />
            </div>

            {/* Search Results */}
            {searchQuery.trim() && searchQuery.trim().length >= 2 && (
              <div className="space-y-2">
                {searchResults.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {searchResults.map((result) => {
                      const alreadyInPlan = isAlreadyInPlan('voting_event', '', result.placeId);

                      return (
                        <button
                          key={result.placeId}
                          onClick={() => {
                            if (alreadyInPlan || isAddingFromSearch) return;
                            handleAddFromSearch(result);
                          }}
                          disabled={alreadyInPlan || isAddingFromSearch}
                          className={`flex gap-3 p-3 rounded-md border text-left transition-all w-full ${
                            alreadyInPlan || isAddingFromSearch ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          data-testid={`dialog-search-result-${result.placeId}`}
                        >
                          {result.photoUrl && (
                            <img
                              src={result.photoUrl}
                              alt={result.name}
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            {result.rating && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs">{result.rating}</span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {result.address}
                            </p>
                          </div>
                          {alreadyInPlan && (
                            <Badge variant="secondary" className="text-xs">Added</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No venues found. Try a different search.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Activities */}
          {activities.length > 0 && (
            <div className="space-y-3">
              <Label>AI Suggested Activities</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activities.map((activity) => {
                  const alreadyInPlan = isAlreadyInPlan('activity', activity.id);
                  const isSelected = venuesToAdd.some(v => v.sourceType === 'activity' && v.sourceId === activity.id);

                  return (
                    <div
                      key={activity.id}
                      className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                        alreadyInPlan ? 'opacity-50 cursor-not-allowed' :
                        isSelected ? 'border-primary bg-primary/25' : 'cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!alreadyInPlan) {
                          toggleVenueSelection('activity', activity.id);
                        }
                      }}
                      data-testid={`add-venue-activity-${activity.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={alreadyInPlan}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{activity.venueName}</p>
                        <p className="text-sm text-muted-foreground truncate">{activity.venueType}</p>
                      </div>
                      {alreadyInPlan && (
                        <Badge variant="secondary" className="text-xs">Already added</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Voting Events */}
          {votingEvents.length > 0 && (
            <div className="space-y-3">
              <Label>Member Suggested Venues</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {votingEvents.map((event) => {
                  const alreadyInPlan = isAlreadyInPlan('voting_event', event.id);
                  const isSelected = venuesToAdd.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id);

                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                        alreadyInPlan ? 'opacity-50 cursor-not-allowed' :
                        isSelected ? 'border-primary bg-primary/25' : 'cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!alreadyInPlan) {
                          toggleVenueSelection('voting_event', event.id);
                        }
                      }}
                      data-testid={`add-venue-event-${event.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={alreadyInPlan}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{event.venueType || 'Venue'}</p>
                      </div>
                      {alreadyInPlan && (
                        <Badge variant="secondary" className="text-xs">Already added</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activities.length === 0 && votingEvents.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No venues available to add
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-add-venue"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddSelected}
            disabled={venuesToAdd.length === 0 || isAddingSelected}
            data-testid="button-confirm-add-venue"
          >
            {isAddingSelected ? "Adding..." : `Add ${venuesToAdd.length} Venue${venuesToAdd.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
