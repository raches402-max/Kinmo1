import { useState, useCallback } from "react";

export type VenueSourceType = 'activity' | 'voting_event' | 'ad_hoc';

export interface SelectedVenue {
  sourceType: VenueSourceType;
  sourceId: string;
  adHocData?: {
    name?: string;
    address?: string;
    googlePlaceId?: string;
    googleMapsUrl?: string;
    venueType?: string;
  };
}

interface UseVenueSelectionReturn {
  // State
  selectedVenues: SelectedVenue[];
  addedSuggestionPlaceIds: Set<string>;

  // Actions
  addVenue: (venue: SelectedVenue) => void;
  removeVenue: (sourceType: VenueSourceType, sourceId: string) => void;
  toggleVenue: (sourceType: VenueSourceType, sourceId: string, adHocData?: SelectedVenue['adHocData']) => void;
  clearSelection: () => void;
  isSelected: (sourceType: VenueSourceType, sourceId: string) => boolean;
  addSuggestionPlaceId: (placeId: string) => void;
  isSuggestionAdded: (placeId: string) => boolean;
  // Direct state setters for migration compatibility
  setVenues: React.Dispatch<React.SetStateAction<SelectedVenue[]>>;
  setPlaceIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Computed
  canAddMore: boolean;
  selectionCount: number;
}

const MAX_VENUES = 5;

export function useVenueSelection(): UseVenueSelectionReturn {
  const [selectedVenues, setSelectedVenues] = useState<SelectedVenue[]>([]);
  const [addedSuggestionPlaceIds, setAddedSuggestionPlaceIds] = useState<Set<string>>(new Set());

  const addVenue = useCallback((venue: SelectedVenue) => {
    setSelectedVenues(prev => {
      if (prev.length >= MAX_VENUES) return prev;
      // Avoid duplicates
      const exists = prev.some(v =>
        v.sourceType === venue.sourceType && v.sourceId === venue.sourceId
      );
      if (exists) return prev;
      return [...prev, venue];
    });
  }, []);

  const removeVenue = useCallback((sourceType: VenueSourceType, sourceId: string) => {
    setSelectedVenues(prev =>
      prev.filter(v => !(v.sourceType === sourceType && v.sourceId === sourceId))
    );
  }, []);

  const toggleVenue = useCallback((
    sourceType: VenueSourceType,
    sourceId: string,
    adHocData?: SelectedVenue['adHocData']
  ) => {
    setSelectedVenues(prev => {
      const existingIndex = prev.findIndex(v =>
        v.sourceType === sourceType && v.sourceId === sourceId
      );

      if (existingIndex >= 0) {
        // Remove
        return prev.filter((_, i) => i !== existingIndex);
      } else if (prev.length < MAX_VENUES) {
        // Add
        return [...prev, { sourceType, sourceId, adHocData }];
      }
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedVenues([]);
    setAddedSuggestionPlaceIds(new Set());
  }, []);

  const isSelected = useCallback((sourceType: VenueSourceType, sourceId: string) => {
    return selectedVenues.some(v =>
      v.sourceType === sourceType && v.sourceId === sourceId
    );
  }, [selectedVenues]);

  const addSuggestionPlaceId = useCallback((placeId: string) => {
    setAddedSuggestionPlaceIds(prev => new Set(Array.from(prev).concat(placeId)));
  }, []);

  const isSuggestionAdded = useCallback((placeId: string) => {
    return addedSuggestionPlaceIds.has(placeId);
  }, [addedSuggestionPlaceIds]);

  return {
    // State
    selectedVenues,
    addedSuggestionPlaceIds,

    // Actions
    addVenue,
    removeVenue,
    toggleVenue,
    clearSelection,
    isSelected,
    addSuggestionPlaceId,
    isSuggestionAdded,
    // Direct state setters for migration compatibility
    setVenues: setSelectedVenues,
    setPlaceIds: setAddedSuggestionPlaceIds,

    // Computed
    canAddMore: selectedVenues.length < MAX_VENUES,
    selectionCount: selectedVenues.length,
  };
}
