import { useState, useCallback } from "react";

// Using 'any' to match existing group-detail.tsx usage
// Can be typed more strictly once migration is complete
type ItineraryItem = any;
type Itinerary = any;

interface UseItineraryEditorReturn {
  // State
  isOpen: boolean;
  editingItinerary: Itinerary | null;
  name: string;
  items: ItineraryItem[];
  timingRecommendations: string;
  proposedDate: string;

  // Actions
  openEditor: (itinerary: Itinerary) => void;
  closeEditor: () => void;
  setName: (name: string) => void;
  setItems: React.Dispatch<React.SetStateAction<ItineraryItem[]>>;
  setTimingRecommendations: (recommendations: string) => void;
  setProposedDate: (date: string) => void;
  reorderItems: (oldIndex: number, newIndex: number) => void;
  removeItem: (itemId: string) => void;
  addItems: (newItems: ItineraryItem[]) => void;
  setIsOpen: (open: boolean) => void;
  reset: () => void;
}

export function useItineraryEditor(): UseItineraryEditorReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<Itinerary | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [timingRecommendations, setTimingRecommendations] = useState("");
  const [proposedDate, setProposedDate] = useState("");

  const openEditor = useCallback((itinerary: Itinerary) => {
    setEditingItinerary(itinerary);
    setName(itinerary.name || "");
    setItems(itinerary.items || []);
    setTimingRecommendations(itinerary.timingRecommendations || "");
    setProposedDate(itinerary.proposedDate || "");
    setIsOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsOpen(false);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setEditingItinerary(null);
    setName("");
    setItems([]);
    setTimingRecommendations("");
    setProposedDate("");
  }, []);

  const reorderItems = useCallback((oldIndex: number, newIndex: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const [removed] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, removed);
      return newItems;
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const addItems = useCallback((newItems: ItineraryItem[]) => {
    setItems(prev => [...prev, ...newItems]);
  }, []);

  return {
    // State
    isOpen,
    editingItinerary,
    name,
    items,
    timingRecommendations,
    proposedDate,

    // Actions
    openEditor,
    closeEditor,
    setName,
    setItems,
    setTimingRecommendations,
    setProposedDate,
    reorderItems,
    removeItem,
    addItems,
    setIsOpen,
    reset,
  };
}
