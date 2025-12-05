/**
 * MobileEventBuilder - Mobile-first event creation flow
 *
 * Mirrors the event management accordion pattern (When, Where, Who)
 * while integrating venue selection, favorites, and search seamlessly.
 *
 * Design principles:
 * - Single full-screen view (no nested modals)
 * - Accordion sections for progressive disclosure
 * - Bottom sheet for venue selection
 * - Floating action bar for primary CTA
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Users,
  ChevronDown,
  ChevronLeft,
  X,
  Plus,
  Heart,
  Clock,
  Search,
  Star,
  Check,
  Sparkles,
  History,
  Globe,
  GripVertical,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Types
interface VenueItem {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  category?: string;
  isFavorite?: boolean;
  googlePlaceId?: string; // For API integration
}

interface GroupOption {
  id: string;
  name: string;
  emoji?: string;
  memberCount: number;
}

interface MobileEventBuilderProps {
  groups?: GroupOption[];
  preselectedGroupId?: string;
  favorites?: VenueItem[];
  recentVenues?: VenueItem[];
  groupLocation?: string; // For venue search
  onClose?: () => void;
  onCreateEvent?: (data: {
    groupId: string;
    eventDate: Date;
    eventTime: string;
    venues: VenueItem[];
    name?: string;
  }) => void;
  isCreating?: boolean;
}

// Quick date options
const QUICK_DATES = [
  { label: "Today", getValue: () => new Date() },
  { label: "Tomorrow", getValue: () => addDays(new Date(), 1) },
  { label: "This Weekend", getValue: () => {
    const today = new Date();
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
    return addDays(today, daysUntilSaturday);
  }},
  { label: "Next Week", getValue: () => addDays(new Date(), 7) },
];

// Time slots
const TIME_SLOTS = [
  { label: "Lunch", times: ["11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM"] },
  { label: "Happy Hour", times: ["4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM"] },
  { label: "Dinner", times: ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"] },
  { label: "Late Night", times: ["8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"] },
];

// Accordion Section Component
function AccordionSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  badge,
  children,
  isComplete,
  accentColor,
}: {
  icon: React.ElementType;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isComplete?: boolean;
  accentColor?: string;
}) {
  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          isExpanded && "bg-primary/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full transition-all",
              isComplete
                ? "bg-green-500 text-white"
                : isExpanded
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
            style={isExpanded && accentColor ? { backgroundColor: accentColor } : undefined}
          >
            {isComplete ? (
              <Check className="h-4 w-4" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <span
            className={cn(
              "text-sm font-semibold uppercase tracking-wide transition-colors",
              isExpanded ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {title}
          </span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Compact Venue Chip
function VenueChip({
  venue,
  index,
  onRemove,
  isDraggable,
}: {
  venue: VenueItem;
  index: number;
  onRemove?: () => void;
  isDraggable?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl group"
    >
      {isDraggable && (
        <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
      )}
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{venue.name}</span>
          {venue.rating != null && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {Number(venue.rating).toFixed(1)}
            </span>
          )}
          {venue.priceLevel && (
            <span className="text-xs text-muted-foreground">
              {"$".repeat(venue.priceLevel)}
            </span>
          )}
        </div>
        {venue.address && (
          <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
        )}
      </div>
      {venue.isFavorite && (
        <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" />
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </button>
      )}
    </motion.div>
  );
}

// Venue Selection Sheet
function VenueSelectionSheet({
  isOpen,
  onClose,
  favorites,
  recentVenues,
  selectedVenues,
  onSelectVenue,
  maxVenues = 5,
  groupLocation,
}: {
  isOpen: boolean;
  onClose: () => void;
  favorites: VenueItem[];
  recentVenues: VenueItem[];
  selectedVenues: VenueItem[];
  onSelectVenue: (venue: VenueItem) => void;
  maxVenues?: number;
  groupLocation?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"favorites" | "recent" | "search">("favorites");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search venues API
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/venues/search", debouncedQuery, groupLocation],
    queryFn: async () => {
      if (!debouncedQuery) return { results: [] };
      const params = new URLSearchParams({ query: debouncedQuery });
      if (groupLocation) params.append("location", groupLocation);
      const res = await fetch(`/api/venues/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    staleTime: 60000, // Cache for 1 minute
  });

  // Transform search results to VenueItem format
  const searchVenues: VenueItem[] = (searchResults?.results || []).map((r: any) => ({
    id: r.placeId || `search-${r.name}`,
    name: r.name,
    address: r.address,
    rating: r.rating,
    priceLevel: r.priceLevel,
    photoUrl: r.photoUrl,
    category: r.category,
    googlePlaceId: r.placeId,
  }));

  const isSelected = (venue: VenueItem) =>
    selectedVenues.some((v) => v.id === venue.id || v.googlePlaceId === venue.googlePlaceId);

  const canAddMore = selectedVenues.length < maxVenues;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl h-[85vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b">
              <h2 className="text-lg font-semibold">Add Venue</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search venues..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) setActiveTab("search");
                  }}
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-0"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-4 pb-3">
              {[
                { id: "favorites" as const, icon: Heart, label: "Places", count: favorites.length },
                { id: "recent" as const, icon: History, label: "Recent", count: recentVenues.length },
                { id: "search" as const, icon: Globe, label: "Search" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 rounded-full",
                      activeTab === tab.id ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Venue List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
              <AnimatePresence mode="wait">
                {activeTab === "favorites" && (
                  <motion.div
                    key="favorites"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-2 pb-4"
                  >
                    {favorites.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Heart className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No saved places yet</p>
                        <p className="text-xs mt-1">Swipe on venues to add places</p>
                      </div>
                    ) : (
                      favorites.map((venue) => (
                        <VenueSelectCard
                          key={venue.id}
                          venue={venue}
                          isSelected={isSelected(venue)}
                          onSelect={() => onSelectVenue(venue)}
                          disabled={!canAddMore && !isSelected(venue)}
                        />
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === "recent" && (
                  <motion.div
                    key="recent"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-2 pb-4"
                  >
                    {recentVenues.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No recent venues</p>
                        <p className="text-xs mt-1">Your past event venues will appear here</p>
                      </div>
                    ) : (
                      recentVenues.map((venue) => (
                        <VenueSelectCard
                          key={venue.id}
                          venue={venue}
                          isSelected={isSelected(venue)}
                          onSelect={() => onSelectVenue(venue)}
                          disabled={!canAddMore && !isSelected(venue)}
                        />
                      ))
                    )}
                  </motion.div>
                )}

                {activeTab === "search" && (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="pb-4"
                  >
                    {!searchQuery ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Search for any venue</p>
                        <p className="text-xs mt-1">Find restaurants, bars, cafes & more</p>
                      </div>
                    ) : isSearching ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 mx-auto mb-3 animate-spin" />
                        <p className="text-sm">Searching "{searchQuery}"...</p>
                      </div>
                    ) : searchVenues.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No results found</p>
                        <p className="text-xs mt-1">Try a different search term</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {searchVenues.map((venue) => (
                          <VenueSelectCard
                            key={venue.id}
                            venue={venue}
                            isSelected={isSelected(venue)}
                            onSelect={() => onSelectVenue(venue)}
                            disabled={!canAddMore && !isSelected(venue)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selection Status */}
            {selectedVenues.length > 0 && (
              <div className="border-t bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedVenues.length} of {maxVenues} venues selected
                  </span>
                  <Button size="sm" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Venue Select Card (for sheet)
function VenueSelectCard({
  venue,
  isSelected,
  onSelect,
  disabled,
}: {
  venue: VenueItem;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
        isSelected
          ? "bg-primary/10 border-2 border-primary"
          : "bg-muted/50 border-2 border-transparent hover:bg-muted",
        disabled && !isSelected && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Photo or placeholder */}
      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {venue.photoUrl ? (
          <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{venue.name}</span>
          {venue.isFavorite && (
            <Heart className="h-3 w-3 text-pink-500 fill-pink-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {venue.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {Number(venue.rating).toFixed(1)}
            </span>
          )}
          {venue.priceLevel && (
            <span>{"$".repeat(venue.priceLevel)}</span>
          )}
          {venue.category && (
            <span className="truncate">{venue.category}</span>
          )}
        </div>
        {venue.address && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{venue.address}</p>
        )}
      </div>

      {/* Selection indicator */}
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/30"
        )}
      >
        {isSelected && <Check className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

// Main Component
export function MobileEventBuilder({
  groups = [],
  preselectedGroupId,
  favorites = [],
  recentVenues = [],
  groupLocation,
  onClose,
  onCreateEvent,
  isCreating,
}: MobileEventBuilderProps) {
  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    when: true,
    where: false,
    who: false,
  });

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<VenueItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(preselectedGroupId || "");
  const [eventName, setEventName] = useState("");

  // UI state
  const [showVenueSheet, setShowVenueSheet] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Selected group
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // Completion status
  const isWhenComplete = !!selectedDate && !!selectedTime;
  const isWhereComplete = selectedVenues.length > 0;
  const isWhoComplete = !!selectedGroupId;
  const canCreate = isWhenComplete && isWhereComplete && isWhoComplete;

  // Progress
  const progress = [isWhenComplete, isWhereComplete, isWhoComplete].filter(Boolean).length;

  // Toggle section
  const toggleSection = (section: "when" | "where" | "who") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Auto-advance to next section
  const advanceToNext = useCallback(() => {
    if (!isWhenComplete) {
      setExpandedSections({ when: true, where: false, who: false });
    } else if (!isWhereComplete) {
      setExpandedSections({ when: false, where: true, who: false });
    } else if (!isWhoComplete) {
      setExpandedSections({ when: false, where: false, who: true });
    }
  }, [isWhenComplete, isWhereComplete, isWhoComplete]);

  // Handle venue toggle
  const handleToggleVenue = (venue: VenueItem) => {
    setSelectedVenues((prev) => {
      const exists = prev.some((v) => v.id === venue.id);
      if (exists) {
        return prev.filter((v) => v.id !== venue.id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, venue];
    });
  };

  // Handle create
  const handleCreate = () => {
    if (!canCreate || !selectedDate || !selectedTime) return;
    onCreateEvent?.({
      groupId: selectedGroupId,
      eventDate: selectedDate,
      eventTime: selectedTime,
      venues: selectedVenues,
      name: eventName || `Event on ${format(selectedDate, "MMM d")}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b bg-background/95 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm">Cancel</span>
        </button>
        <h1 className="font-semibold">Create Event</h1>
        <div className="w-16" /> {/* Spacer for centering */}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
        {/* WHEN Section */}
        <AccordionSection
          icon={Calendar}
          title="When"
          isExpanded={expandedSections.when}
          onToggle={() => toggleSection("when")}
          isComplete={isWhenComplete}
          badge={
            selectedDate ? (
              <Badge variant="secondary" className="ml-2 text-xs font-normal">
                {format(selectedDate, "EEE, MMM d")}
                {selectedTime && ` • ${selectedTime}`}
              </Badge>
            ) : null
          }
        >
          <div className="space-y-4">
            {/* Calendar picker - always visible */}
            <div className="flex justify-center">
              <CalendarPicker
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setShowTimePicker(true);
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-xl border"
              />
            </div>

            {/* Selected date display */}
            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-primary/5 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </p>
                    {selectedTime && (
                      <p className="text-muted-foreground">{selectedTime}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTimePicker(!showTimePicker)}
                  >
                    {selectedTime ? "Change" : "Pick time"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Time picker */}
            <AnimatePresence>
              {showTimePicker && selectedDate && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3">
                    {TIME_SLOTS.map((slot) => (
                      <div key={slot.label}>
                        <p className="text-xs text-muted-foreground mb-2">{slot.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {slot.times.map((time) => (
                            <button
                              key={time}
                              onClick={() => {
                                setSelectedTime(time);
                                setShowTimePicker(false);
                                // Auto-advance
                                setTimeout(() => {
                                  setExpandedSections({ when: false, where: true, who: false });
                                }, 300);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm transition-all",
                                selectedTime === time
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/80"
                              )}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AccordionSection>

        {/* Optional: Event Name / Description */}
        <div className="px-1">
          <Input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Add a note or description (optional)"
            className="border-0 bg-transparent text-sm placeholder:text-muted-foreground/50 px-0 h-auto py-2 focus-visible:ring-0"
          />
        </div>

        {/* WHERE Section */}
        <AccordionSection
          icon={MapPin}
          title="Where"
          isExpanded={expandedSections.where}
          onToggle={() => toggleSection("where")}
          isComplete={isWhereComplete}
          badge={
            selectedVenues.length > 0 ? (
              <Badge variant="secondary" className="ml-2 text-xs font-normal">
                {selectedVenues.length} venue{selectedVenues.length !== 1 ? "s" : ""}
              </Badge>
            ) : null
          }
        >
          <div className="space-y-3">
            {/* Selected venues */}
            <AnimatePresence>
              {selectedVenues.map((venue, index) => (
                <VenueChip
                  key={venue.id}
                  venue={venue}
                  index={index}
                  onRemove={() => handleToggleVenue(venue)}
                />
              ))}
            </AnimatePresence>

            {/* Add venue buttons */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2 h-12"
                onClick={() => setShowVenueSheet(true)}
              >
                <Heart className="h-4 w-4 text-pink-500" />
                Add from Favorites
                {favorites.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {favorites.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2 h-12"
                onClick={() => setShowVenueSheet(true)}
              >
                <Search className="h-4 w-4" />
                Search for a place
              </Button>
            </div>

            {selectedVenues.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Add at least one venue to continue
              </p>
            )}
          </div>
        </AccordionSection>

        {/* WHO Section */}
        <AccordionSection
          icon={Users}
          title="Who"
          isExpanded={expandedSections.who}
          onToggle={() => toggleSection("who")}
          isComplete={isWhoComplete}
          badge={
            selectedGroup ? (
              <Badge variant="secondary" className="ml-2 text-xs font-normal">
                {selectedGroup.emoji} {selectedGroup.name}
              </Badge>
            ) : null
          }
        >
          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No groups yet</p>
                <p className="text-xs mt-1">Create a group to schedule events</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                      selectedGroupId === group.id
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                      {group.emoji || "👥"}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedGroupId === group.id
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selectedGroupId === group.id && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </AccordionSection>
      </main>

      {/* Floating Action Bar - positioned above BottomNav */}
      <div className="fixed bottom-16 inset-x-0 bg-background/95 backdrop-blur-sm border-t p-4">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={cn(
                "h-1.5 rounded-full transition-all",
                step <= progress ? "bg-primary w-8" : "bg-muted w-4"
              )}
            />
          ))}
        </div>

        <Button
          onClick={handleCreate}
          disabled={!canCreate || isCreating}
          className="w-full h-12 text-base gap-2"
          size="lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Create & Send Invites
            </>
          )}
        </Button>

        {!canCreate && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {!isWhenComplete
              ? "Pick a date and time"
              : !isWhereComplete
              ? "Add at least one venue"
              : "Select a group"}
          </p>
        )}
      </div>

      {/* Venue Selection Sheet */}
      <VenueSelectionSheet
        isOpen={showVenueSheet}
        onClose={() => setShowVenueSheet(false)}
        favorites={favorites}
        recentVenues={recentVenues}
        selectedVenues={selectedVenues}
        onSelectVenue={handleToggleVenue}
        groupLocation={groupLocation}
      />
    </div>
  );
}

export default MobileEventBuilder;
