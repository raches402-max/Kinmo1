import { useState, useCallback } from "react";

interface TimeOption {
  id: string;
  eventDate: string;
  dayLabel: string;
  timeLabel: string;
}

interface Itinerary {
  id: string;
  name?: string;
  items?: any[];
  [key: string]: any;
}

interface UseSchedulingFlowReturn {
  // Scheduling dialog state
  isOpen: boolean;
  selectedItinerary: Itinerary | null;
  scheduleMethod: 'manual' | 'ai';
  eventDate: string;
  eventTime: string;

  // AI time options
  aiTimeOptions: TimeOption[];
  selectedTimeOptionIds: string[];
  editingOptionId: string | null;
  isAiTimeLoading: boolean;

  // Actions
  openScheduling: (itinerary: Itinerary) => void;
  closeScheduling: () => void;
  setScheduleMethod: (method: 'manual' | 'ai') => void;
  setEventDate: (date: string) => void;
  setEventTime: (time: string) => void;
  setAiTimeOptions: React.Dispatch<React.SetStateAction<TimeOption[]>>;
  setSelectedTimeOptionIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleTimeOption: (optionId: string) => void;
  setEditingOptionId: (id: string | null) => void;
  setIsAiTimeLoading: (loading: boolean) => void;
  updateTimeOption: (optionId: string, updates: Partial<TimeOption>) => void;
  reset: () => void;
}

export type { TimeOption };

export function useSchedulingFlow(): UseSchedulingFlowReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [scheduleMethod, setScheduleMethod] = useState<'manual' | 'ai'>('ai');
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");

  const [aiTimeOptions, setAiTimeOptions] = useState<TimeOption[]>([]);
  const [selectedTimeOptionIds, setSelectedTimeOptionIds] = useState<string[]>([]);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [isAiTimeLoading, setIsAiTimeLoading] = useState(false);

  const openScheduling = useCallback((itinerary: Itinerary) => {
    setSelectedItinerary(itinerary);
    setIsOpen(true);
    // Reset AI options when opening
    setAiTimeOptions([]);
    setSelectedTimeOptionIds([]);
  }, []);

  const closeScheduling = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleTimeOption = useCallback((optionId: string) => {
    setSelectedTimeOptionIds(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      }
      return [...prev, optionId];
    });
  }, []);

  const updateTimeOption = useCallback((optionId: string, updates: Partial<TimeOption>) => {
    setAiTimeOptions(prev =>
      prev.map(opt => opt.id === optionId ? { ...opt, ...updates } : opt)
    );
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setSelectedItinerary(null);
    setScheduleMethod('ai');
    setEventDate("");
    setEventTime("19:00");
    setAiTimeOptions([]);
    setSelectedTimeOptionIds([]);
    setEditingOptionId(null);
    setIsAiTimeLoading(false);
  }, []);

  return {
    // State
    isOpen,
    selectedItinerary,
    scheduleMethod,
    eventDate,
    eventTime,
    aiTimeOptions,
    selectedTimeOptionIds,
    editingOptionId,
    isAiTimeLoading,

    // Actions
    openScheduling,
    closeScheduling,
    setScheduleMethod,
    setEventDate,
    setEventTime,
    setAiTimeOptions,
    setSelectedTimeOptionIds,
    toggleTimeOption,
    setEditingOptionId,
    setIsAiTimeLoading,
    updateTimeOption,
    reset,
  };
}
