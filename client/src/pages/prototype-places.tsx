/**
 * Prototype: Places Tab (formerly Discover)
 *
 * Your personal & group venue library
 * - Personal favorites
 * - Group favorites (per group)
 * - Discover = Google Places search to add new venues
 */

import { useState } from "react";
import {
  Heart,
  MapPin,
  Search,
  Plus,
  Star,
  Grid,
  List,
  ChevronRight,
  ChevronDown,
  Utensils,
  Coffee,
  Wine,
  IceCream,
  Dumbbell,
  Compass,
  X,
  Check,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Mock groups
const mockGroups = [
  { id: "personal", name: "My Favorites", emoji: "❤️", isPersonal: true },
  { id: "g1", name: "Sweatpants", emoji: "👖", isPersonal: false },
  { id: "g2", name: "Mission Amigos", emoji: "🌮", isPersonal: false },
  { id: "g3", name: "AFC (Asian Food Crew)", emoji: "🍜", isPersonal: false },
];

// Mock places by group
const mockPlacesByGroup: Record<string, Place[]> = {
  personal: [
    {
      id: "1",
      name: "Dumpling Time",
      category: "Restaurant",
      cuisine: "Chinese",
      neighborhood: "Hayes Valley",
      rating: 4.5,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400",
      address: "11 Division St, San Francisco",
      addedBy: "You",
    },
    {
      id: "2",
      name: "Sightglass Coffee",
      category: "Coffee",
      cuisine: "Cafe",
      neighborhood: "SoMa",
      rating: 4.4,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
      address: "270 7th St, San Francisco",
      addedBy: "You",
    },
    {
      id: "3",
      name: "Trick Dog",
      category: "Bar",
      cuisine: "Cocktails",
      neighborhood: "Mission",
      rating: 4.5,
      priceLevel: 3,
      imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400",
      address: "3010 20th St, San Francisco",
      addedBy: "You",
    },
  ],
  g1: [
    {
      id: "4",
      name: "Souvla",
      category: "Restaurant",
      cuisine: "Greek",
      neighborhood: "Hayes Valley",
      rating: 4.6,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400",
      address: "517 Hayes St, San Francisco",
      addedBy: "Katie",
    },
    {
      id: "5",
      name: "Bi-Rite Creamery",
      category: "Dessert",
      cuisine: "Ice Cream",
      neighborhood: "Mission",
      rating: 4.7,
      priceLevel: 1,
      imageUrl: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400",
      address: "3692 18th St, San Francisco",
      addedBy: "Addison",
    },
  ],
  g2: [
    {
      id: "6",
      name: "La Taqueria",
      category: "Restaurant",
      cuisine: "Mexican",
      neighborhood: "Mission",
      rating: 4.5,
      priceLevel: 1,
      imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400",
      address: "2889 Mission St, San Francisco",
      addedBy: "Aidan",
    },
    {
      id: "7",
      name: "El Farolito",
      category: "Restaurant",
      cuisine: "Mexican",
      neighborhood: "Mission",
      rating: 4.3,
      priceLevel: 1,
      imageUrl: "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=400",
      address: "2779 Mission St, San Francisco",
      addedBy: "Meesh",
    },
    {
      id: "8",
      name: "Tartine Bakery",
      category: "Bakery",
      cuisine: "Bakery",
      neighborhood: "Mission",
      rating: 4.6,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
      address: "600 Guerrero St, San Francisco",
      addedBy: "You",
    },
  ],
  g3: [
    {
      id: "9",
      name: "Dumpling Time",
      category: "Restaurant",
      cuisine: "Chinese",
      neighborhood: "Hayes Valley",
      rating: 4.5,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400",
      address: "11 Division St, San Francisco",
      addedBy: "Delia",
    },
    {
      id: "10",
      name: "R&G Lounge",
      category: "Restaurant",
      cuisine: "Chinese",
      neighborhood: "Chinatown",
      rating: 4.4,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=400",
      address: "631 Kearny St, San Francisco",
      addedBy: "Jacqueline",
    },
    {
      id: "11",
      name: "Mister Jiu's",
      category: "Restaurant",
      cuisine: "Chinese-American",
      neighborhood: "Chinatown",
      rating: 4.6,
      priceLevel: 4,
      imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
      address: "28 Waverly Pl, San Francisco",
      addedBy: "Steph",
    },
    {
      id: "12",
      name: "Garden Creamery",
      category: "Dessert",
      cuisine: "Ice Cream",
      neighborhood: "Inner Sunset",
      rating: 4.8,
      priceLevel: 2,
      imageUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400",
      address: "3566 20th St, San Francisco",
      addedBy: "Angela",
    },
  ],
};

type Place = {
  id: string;
  name: string;
  category: string;
  cuisine: string;
  neighborhood: string;
  rating: number;
  priceLevel: number;
  imageUrl: string;
  address: string;
  addedBy?: string;
};

type ViewMode = "grid" | "list";

const categories = [
  { id: "all", label: "All", icon: Heart },
  { id: "restaurant", label: "Food", icon: Utensils },
  { id: "coffee", label: "Coffee", icon: Coffee },
  { id: "bar", label: "Drinks", icon: Wine },
  { id: "dessert", label: "Dessert", icon: IceCream },
  { id: "activity", label: "Activities", icon: Dumbbell },
];

export default function PrototypePlaces() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("personal");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showDiscover, setShowDiscover] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const currentGroup = mockGroups.find((g) => g.id === selectedGroup)!;
  const places = mockPlacesByGroup[selectedGroup] || [];

  const filteredPlaces = places.filter((place) => {
    const matchesSearch =
      place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.cuisine.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      place.category.toLowerCase() === selectedCategory ||
      (selectedCategory === "restaurant" && place.category === "Bakery");

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-stone-800">Places</h1>
            <Button
              onClick={() => setShowDiscover(true)}
              className="rounded-full gap-2"
              size="sm"
            >
              <Search className="h-4 w-4" />
              Add Place
            </Button>
          </div>

          {/* Group Picker */}
          <button
            onClick={() => setShowGroupPicker(true)}
            className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-xl mb-3 hover:bg-stone-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{currentGroup.emoji}</span>
              <div className="text-left">
                <p className="font-semibold text-stone-800">{currentGroup.name}</p>
                <p className="text-xs text-stone-500">
                  {places.length} place{places.length !== 1 ? "s" : ""} saved
                </p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-stone-400" />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-stone-50 border-stone-200 rounded-xl"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  isActive
                    ? "bg-stone-800 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* View Toggle & Count */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <p className="text-sm text-stone-500">
            {filteredPlaces.length} place{filteredPlaces.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "grid" ? "bg-white shadow-sm" : "text-stone-500"
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "list" ? "bg-white shadow-sm" : "text-stone-500"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {filteredPlaces.length === 0 ? (
          <EmptyState
            groupName={currentGroup.name}
            isPersonal={currentGroup.isPersonal}
            onDiscover={() => setShowDiscover(true)}
          />
        ) : viewMode === "grid" ? (
          <GridView places={filteredPlaces} showAddedBy={!currentGroup.isPersonal} />
        ) : (
          <ListView places={filteredPlaces} showAddedBy={!currentGroup.isPersonal} />
        )}
      </div>

      {/* Group Picker Modal */}
      {showGroupPicker && (
        <GroupPickerModal
          groups={mockGroups}
          selectedId={selectedGroup}
          onSelect={(id) => {
            setSelectedGroup(id);
            setShowGroupPicker(false);
          }}
          onClose={() => setShowGroupPicker(false)}
        />
      )}

      {/* Discover Modal/Sheet */}
      {showDiscover && (
        <DiscoverSheet
          groups={mockGroups}
          onClose={() => setShowDiscover(false)}
        />
      )}
    </div>
  );
}

// Grid View Component
function GridView({ places, showAddedBy }: { places: Place[]; showAddedBy: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {places.map((place) => (
        <div
          key={place.id}
          className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 active:scale-[0.98] transition-transform"
        >
          {/* Image */}
          <div className="relative aspect-[4/3]">
            <img
              src={place.imageUrl}
              alt={place.name}
              className="w-full h-full object-cover"
            />
            <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
              <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur rounded-full">
              <span className="text-xs font-medium text-stone-700">
                {"$".repeat(place.priceLevel)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="p-3">
            <h3 className="font-semibold text-stone-800 truncate">{place.name}</h3>
            <p className="text-xs text-stone-500 truncate">
              {place.cuisine} • {place.neighborhood}
            </p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium text-stone-700">{place.rating}</span>
              </div>
              {showAddedBy && place.addedBy && (
                <span className="text-xs text-stone-400">via {place.addedBy}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// List View Component
function ListView({ places, showAddedBy }: { places: Place[]; showAddedBy: boolean }) {
  return (
    <div className="space-y-2">
      {places.map((place) => (
        <div
          key={place.id}
          className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-stone-100 active:scale-[0.99] transition-transform"
        >
          {/* Image */}
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-stone-800 truncate">{place.name}</h3>
              <Heart className="h-4 w-4 text-rose-500 fill-rose-500 flex-shrink-0" />
            </div>
            <p className="text-sm text-stone-500">
              {place.cuisine} • {place.neighborhood}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium text-stone-700">{place.rating}</span>
              </div>
              <span className="text-xs text-stone-400">{"$".repeat(place.priceLevel)}</span>
            </div>
            {showAddedBy && place.addedBy && (
              <p className="text-xs text-stone-400 mt-1">Added by {place.addedBy}</p>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-stone-300 self-center flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Empty State Component
function EmptyState({
  groupName,
  isPersonal,
  onDiscover,
}: {
  groupName: string;
  isPersonal: boolean;
  onDiscover: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
        <Heart className="h-8 w-8 text-stone-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-2">No places saved yet</h3>
      <p className="text-sm text-stone-500 mb-6">
        {isPersonal
          ? "Search and save your favorite restaurants, cafes, and activities."
          : `Add places to ${groupName}'s shared collection for easier event planning.`}
      </p>
      <Button onClick={onDiscover} className="rounded-full gap-2">
        <Search className="h-4 w-4" />
        Search Places
      </Button>
    </div>
  );
}

// Group Picker Modal
function GroupPickerModal({
  groups,
  selectedId,
  onSelect,
  onClose,
}: {
  groups: typeof mockGroups;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
        <div className="px-4 pb-2">
          <h2 className="text-lg font-bold text-stone-800">View Places For</h2>
        </div>
        <div className="px-4 pb-6 space-y-1">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                selectedId === group.id
                  ? "bg-stone-100"
                  : "hover:bg-stone-50"
              )}
            >
              <span className="text-2xl">{group.emoji}</span>
              <div className="flex-1 text-left">
                <p className="font-semibold text-stone-800">{group.name}</p>
                <p className="text-xs text-stone-500">
                  {(mockPlacesByGroup[group.id] || []).length} places
                </p>
              </div>
              {selectedId === group.id && (
                <Check className="h-5 w-5 text-stone-800" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Discover Sheet Component with Google Places Search
function DiscoverSheet({
  groups,
  onClose,
}: {
  groups: typeof mockGroups;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [showSavePicker, setShowSavePicker] = useState<GooglePlaceResult | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set());

  // Mock Google Places results
  const mockGoogleResults: GooglePlaceResult[] = [
    {
      placeId: "gp1",
      name: "Tonga Room & Hurricane Bar",
      address: "950 Mason St, San Francisco, CA",
      rating: 4.5,
      priceLevel: 3,
      category: "Tiki Bar",
      photoUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400",
    },
    {
      placeId: "gp2",
      name: "Tosca Cafe",
      address: "242 Columbus Ave, San Francisco, CA",
      rating: 4.4,
      priceLevel: 3,
      category: "Italian Restaurant",
      photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
    },
    {
      placeId: "gp3",
      name: "Tony's Pizza Napoletana",
      address: "1570 Stockton St, San Francisco, CA",
      rating: 4.6,
      priceLevel: 2,
      category: "Pizza",
      photoUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
    },
    {
      placeId: "gp4",
      name: "Tadich Grill",
      address: "240 California St, San Francisco, CA",
      rating: 4.3,
      priceLevel: 3,
      category: "Seafood Restaurant",
      photoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
    },
  ];

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setResults(mockGoogleResults);
      setIsSearching(false);
    }, 800);
  };

  const handleSave = (place: GooglePlaceResult, groupId: string) => {
    setSavedPlaces((prev) => new Set([...Array.from(prev), `${place.placeId}-${groupId}`]));
    setShowSavePicker(null);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-stone-800">Add a Place</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center"
            >
              <X className="h-5 w-5 text-stone-500" />
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Search any restaurant, cafe, bar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-stone-50 border-stone-200 rounded-xl"
                autoFocus
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="rounded-xl px-4"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <Compass className="h-12 w-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">
                Search for a place to add it to your favorites
              </p>
              <p className="text-sm text-stone-400 mt-1">
                Try "Tongbar", "Blue Bottle Coffee", etc.
              </p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-stone-400 mx-auto mb-3 animate-spin" />
              <p className="text-stone-500">Searching Google Places...</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-stone-500 mb-2">
                {results.length} results for "{searchQuery}"
              </p>
              {results.map((place) => (
                <div
                  key={place.placeId}
                  className="bg-stone-50 rounded-xl p-3 flex gap-3"
                >
                  <img
                    src={place.photoUrl}
                    alt={place.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-800">{place.name}</h3>
                    <p className="text-sm text-stone-500 truncate">{place.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-medium">{place.rating}</span>
                      </div>
                      {place.priceLevel > 0 && (
                        <span className="text-xs text-stone-400">
                          {"$".repeat(place.priceLevel)}
                        </span>
                      )}
                      <span className="text-xs text-stone-400">{place.category}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSavePicker(place)}
                    className="w-10 h-10 rounded-full bg-stone-800 text-white flex items-center justify-center self-center hover:bg-stone-700 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save to Picker */}
        {showSavePicker && (
          <SaveToPicker
            place={showSavePicker}
            groups={groups}
            savedPlaces={savedPlaces}
            onSave={handleSave}
            onClose={() => setShowSavePicker(null)}
          />
        )}
      </div>
    </div>
  );
}

type GooglePlaceResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  priceLevel: number;
  category: string;
  photoUrl: string;
};

// Save To Picker
function SaveToPicker({
  place,
  groups,
  savedPlaces,
  onSave,
  onClose,
}: {
  place: GooglePlaceResult;
  groups: typeof mockGroups;
  savedPlaces: Set<string>;
  onSave: (place: GooglePlaceResult, groupId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-white rounded-t-3xl flex flex-col">
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 bg-stone-300 rounded-full" />
      </div>

      <div className="px-4 pb-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-stone-800">Save to...</h2>
          <div className="w-12" />
        </div>
      </div>

      {/* Place Preview */}
      <div className="px-4 py-4 border-b border-stone-100 bg-stone-50">
        <div className="flex gap-3">
          <img
            src={place.photoUrl}
            alt={place.name}
            className="w-14 h-14 rounded-lg object-cover"
          />
          <div>
            <h3 className="font-semibold text-stone-800">{place.name}</h3>
            <p className="text-sm text-stone-500">{place.category}</p>
          </div>
        </div>
      </div>

      {/* Group Options */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {groups.map((group) => {
          const isSaved = savedPlaces.has(`${place.placeId}-${group.id}`);
          return (
            <button
              key={group.id}
              onClick={() => !isSaved && onSave(place, group.id)}
              disabled={isSaved}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                isSaved
                  ? "border-green-200 bg-green-50"
                  : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              <span className="text-2xl">{group.emoji}</span>
              <div className="flex-1 text-left">
                <p className="font-semibold text-stone-800">{group.name}</p>
                <p className="text-xs text-stone-500">
                  {group.isPersonal ? "Your personal favorites" : "Shared with group"}
                </p>
              </div>
              {isSaved ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Saved</span>
                </div>
              ) : (
                <Plus className="h-5 w-5 text-stone-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
