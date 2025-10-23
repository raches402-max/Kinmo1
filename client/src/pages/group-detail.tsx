import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus, Heart, Plus, X, ChevronDown, ChevronRight, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, UtensilsCrossed, ChefHat, Croissant, Beer, ShoppingBasket, Palette, Film, Laugh, GraduationCap, Target, GripVertical, CheckCircle2, Circle, XCircle, ShoppingCart, Search, ArrowUpDown, Save, Send, Bot, Bell, Edit2, Edit, Compass } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { ReadOnlyAvailabilityGrid } from "@/components/ReadOnlyAvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { calculateDistance, getDistanceCategory, formatDistance } from "@/lib/distance";
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Timezone helper functions
function getTimezoneIdentifier(location: string): string {
  const loc = location.toLowerCase().trim();
  
  const matchesWord = (text: string, pattern: string): boolean => {
    const regex = new RegExp(`(^|[\\s,])${pattern}($|[\\s,])`, 'i');
    return regex.test(text);
  };
  
  const pacificCities = [
    'san francisco', 'los angeles', 'oakland', 'san diego', 'san jose', 'sacramento',
    'seattle', 'portland', 'spokane', 'tacoma', 'vancouver', 'eugene', 'salem',
    'las vegas', 'reno', 'henderson'
  ];
  const pacificStates = ['california', 'oregon', 'nevada'];
  const pacificAbbrevs = ['ca', 'or', 'nv', 'wa'];
  
  const mountainCities = [
    'denver', 'colorado springs', 'aurora', 'boulder', 'fort collins',
    'salt lake', 'provo', 'west jordan', 'orem',
    'albuquerque', 'santa fe', 'las cruces',
    'boise', 'nampa', 'meridian',
    'billings', 'missoula', 'great falls',
    'cheyenne', 'casper'
  ];
  const mountainStates = ['colorado', 'utah', 'new mexico', 'wyoming', 'montana', 'idaho'];
  const mountainAbbrevs = ['co', 'ut', 'nm', 'wy', 'mt', 'id'];
  
  const arizonaCities = ['phoenix', 'tucson', 'mesa', 'chandler', 'scottsdale', 'gilbert'];
  const arizonaStates = ['arizona'];
  const arizonaAbbrevs = ['az'];
  
  const centralCities = [
    'chicago', 'houston', 'dallas', 'austin', 'san antonio', 'fort worth', 'arlington',
    'minneapolis', 'st paul', 'milwaukee', 'madison', 'kansas city', 'st louis',
    'new orleans', 'baton rouge', 'nashville', 'memphis', 'oklahoma city', 'tulsa',
    'des moines', 'omaha', 'lincoln', 'wichita', 'little rock', 'birmingham', 'jackson'
  ];
  const centralStates = [
    'texas', 'illinois', 'minnesota', 'wisconsin', 'missouri',
    'louisiana', 'tennessee', 'oklahoma', 'iowa', 'nebraska',
    'kansas', 'arkansas', 'alabama', 'mississippi'
  ];
  const centralAbbrevs = ['tx', 'il', 'mn', 'wi', 'mo', 'la', 'tn', 'ok', 'ia', 'ne', 'ks', 'ar', 'al', 'ms'];
  
  const easternCities = [
    'new york', 'nyc', 'brooklyn', 'queens', 'bronx', 'manhattan', 'buffalo', 'rochester', 'syracuse',
    'boston', 'worcester', 'springfield', 'cambridge',
    'philadelphia', 'pittsburgh', 'allentown',
    'washington', 'baltimore',
    'miami', 'tampa', 'orlando', 'jacksonville',
    'atlanta', 'augusta', 'savannah',
    'charlotte', 'raleigh', 'greensboro', 'durham',
    'detroit', 'grand rapids', 'indianapolis', 'cleveland', 'cincinnati',
    'richmond', 'virginia beach', 'charleston', 'louisville'
  ];
  const easternStates = [
    'massachusetts', 'pennsylvania', 'florida', 'georgia',
    'north carolina', 'michigan', 'indiana', 'ohio',
    'virginia', 'south carolina', 'kentucky', 'maryland',
    'district of columbia', 'maine', 'new hampshire', 'vermont',
    'connecticut', 'rhode island', 'new jersey', 'delaware',
    'west virginia', 'new york'
  ];
  const easternAbbrevs = ['ma', 'pa', 'fl', 'ga', 'nc', 'mi', 'in', 'oh', 'va', 'sc', 'ky', 'md', 'dc', 'd.c.', 'me', 'nh', 'vt', 'ct', 'ri', 'nj', 'de', 'wv', 'ny'];
  
  if ((loc.includes('washington') || matchesWord(loc, 'wa')) && 
      !loc.includes('dc') && !loc.includes('d.c.') && 
      !loc.includes('washington,') && !loc.includes('washington d')) {
    return 'America/Los_Angeles';
  }
  
  if (pacificCities.some(p => loc.includes(p))) return 'America/Los_Angeles';
  if (mountainCities.some(p => loc.includes(p))) return 'America/Denver';
  if (arizonaCities.some(p => loc.includes(p))) return 'America/Phoenix';
  if (centralCities.some(p => loc.includes(p))) return 'America/Chicago';
  if (easternCities.some(p => loc.includes(p))) return 'America/New_York';
  
  if (pacificStates.some(p => loc.includes(p))) return 'America/Los_Angeles';
  if (mountainStates.some(p => loc.includes(p))) return 'America/Denver';
  if (arizonaStates.some(p => loc.includes(p))) return 'America/Phoenix';
  if (centralStates.some(p => loc.includes(p))) return 'America/Chicago';
  if (easternStates.some(p => loc.includes(p))) return 'America/New_York';
  
  if (pacificAbbrevs.some(p => matchesWord(loc, p))) return 'America/Los_Angeles';
  if (mountainAbbrevs.some(p => matchesWord(loc, p))) return 'America/Denver';
  if (arizonaAbbrevs.some(p => matchesWord(loc, p))) return 'America/Phoenix';
  if (centralAbbrevs.some(p => matchesWord(loc, p))) return 'America/Chicago';
  if (easternAbbrevs.some(p => matchesWord(loc, p))) return 'America/New_York';
  
  return 'America/Los_Angeles';
}

function getTimezoneName(tzIdentifier: string): string {
  const names: { [key: string]: string } = {
    'America/Los_Angeles': 'Pacific Time',
    'America/Denver': 'Mountain Time',
    'America/Phoenix': 'Mountain Time (no DST)',
    'America/Chicago': 'Central Time',
    'America/New_York': 'Eastern Time',
    'Europe/London': 'UK Time',
    'Europe/Paris': 'Central European Time',
    'Europe/Berlin': 'Central European Time',
    'Europe/Rome': 'Central European Time',
    'Europe/Madrid': 'Central European Time',
    'Europe/Amsterdam': 'Central European Time',
    'Asia/Tokyo': 'Japan Time',
    'Asia/Shanghai': 'China Time',
    'Asia/Hong_Kong': 'Hong Kong Time',
    'Asia/Singapore': 'Singapore Time',
    'Asia/Dubai': 'UAE Time',
    'Australia/Sydney': 'Australian Eastern Time',
    'Australia/Melbourne': 'Australian Eastern Time',
    'Australia/Perth': 'Australian Western Time',
    'Pacific/Auckland': 'New Zealand Time',
    'America/Toronto': 'Eastern Time',
    'America/Vancouver': 'Pacific Time',
    'America/Mexico_City': 'Central Time',
  };
  return names[tzIdentifier] || tzIdentifier;
}

// Type for member constraints
type MemberConstraints = {
  scheduleConflicts?: string[];
  budgetConcern?: boolean;
  distanceConcern?: boolean;
  notes?: string;
};

const closenessLabels = ["Acquaintances", "Friends", "Good Friends", "Close Friends", "Best Friends"];
const noveltyLabels = ["We like our usual spots", "Leaning familiar", "Open sometimes", "Pretty adventurous", "Always up for new things!"];

const groupEmojis = [
  "🎉", "🎊", "🎈", "🍕", "🍔", "🍰", "🎮", "🎬", 
  "🎵", "🎨", "🏀", "⚽", "🎯", "🎭", "🎪", "🎤"
];

const activityCategories = [
  { id: "restaurants", label: "Restaurants", icon: ChefHat },
  { id: "brunch", label: "Brunch Spots", icon: Croissant },
  { id: "cafes", label: "Cafes", icon: Coffee },
  { id: "wine-bars", label: "Wine / Cocktail Bars", icon: Wine },
  { id: "breweries", label: "Breweries / Beer Gardens", icon: Beer },
  { id: "food-markets", label: "Food Markets / Food Halls", icon: ShoppingBasket },
  { id: "potlucks", label: "Potlucks", icon: UtensilsCrossed },
  { id: "concerts", label: "Concerts", icon: Music },
  { id: "karaoke", label: "Karaoke", icon: Mic2 },
  { id: "dancing", label: "Dancing / Clubs", icon: PartyPopper },
  { id: "comedy", label: "Comedy Shows", icon: Laugh },
  { id: "movies", label: "Movie Theaters", icon: Film },
  { id: "museums", label: "Museums / Art Galleries", icon: Palette },
  { id: "sports", label: "Sports Games", icon: Trophy },
  { id: "outdoors", label: "Hikes / Outdoors", icon: Mountain },
  { id: "game-nights", label: "Game Nights", icon: Gamepad2 },
  { id: "trivia", label: "Trivia Nights", icon: GraduationCap },
];

function formatMeetingFrequency(freq: string): string {
  // Handle old format
  if (freq === "weekly") return "Every week";
  if (freq === "biweekly") return "Every 2 weeks";
  if (freq === "monthly") return "Every month";
  if (freq === "flexible") return "Flexible";
  
  // Handle new format: "2-week", "1-month", etc. (both singular and plural)
  if (freq.includes("-")) {
    const [num, unit] = freq.split("-");
    const number = parseInt(num);
    // Remove 's' if plural for consistency
    const singularUnit = unit.endsWith("s") ? unit.slice(0, -1) : unit;
    
    if (number === 1) {
      return `Every ${singularUnit}`;
    }
    // Add 's' for plural display
    return `Every ${number} ${singularUnit}s`;
  }
  
  return freq;
}

type ActivityCategory = 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';

function getActivityCategory(activity: { venueType: string; category?: string | null }): ActivityCategory {
  // Use stored AI category if available
  if (activity.category) {
    return activity.category as ActivityCategory;
  }
  
  // Fallback to keyword matching for backwards compatibility
  const lowerType = activity.venueType.toLowerCase();
  
  // Strong meal indicators - if these exist, it's definitely a meal venue
  const mealKeywords = ['restaurant', 'food hall', 'food market', 'kitchen', 'diner', 
                       'eatery', 'bistro', 'grill', 'bbq', 'pizzeria', 'steakhouse'];
  const isMealVenue = mealKeywords.some(keyword => lowerType.includes(keyword));
  
  if (isMealVenue) {
    return 'meal';
  }
  
  // CAFES - coffee shops, cafes
  if (lowerType.includes('cafe') || lowerType.includes('coffee')) {
    return 'cafes';
  }
  
  // DESSERT - boba, ice cream, dessert shops, tea shops (check BEFORE drinks to catch "boba bar", "dessert bar")
  if (lowerType.includes('boba') || lowerType.includes('ice cream') || 
      lowerType.includes('dessert') || lowerType.includes('bakery') ||
      lowerType.includes('sweet') || lowerType.includes('milk bar') ||
      lowerType.includes('tea shop') || lowerType.includes('bubble tea') || 
      lowerType.includes('milk tea') || lowerType.includes('gelato')) {
    return 'dessert';
  }
  
  // DRINKS - bars, breweries, wine bars, cocktail lounges, and generic "drink"
  // Check AFTER meal and dessert to avoid false positives
  const drinksKeywords = ['drink', 'brewery', 'wine bar', 'cocktail', 'pub', 'lounge', 'taproom', 'speakeasy', 'sake bar', 'taphouse', 'tasting room'];
  const hasDrinkKeyword = drinksKeywords.some(keyword => lowerType.includes(keyword));
  
  // Use regex for standalone "bar" but be careful with punctuation
  const hasStandaloneBar = /\bbar\b/.test(lowerType);
  
  if (hasDrinkKeyword || hasStandaloneBar) {
    return 'drinks';
  }
  
  // EXPERIENCES - everything else (museums, parks, concerts, etc.)
  return 'experiences';
}

// Sortable itinerary item component
function SortableItineraryItem({ item, index, onRemove }: { item: any; index: number; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-md bg-card border hover-elevate"
      data-testid={`itinerary-item-${item.id}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.venueName}</p>
        <p className="text-xs text-muted-foreground truncate">{item.venueType}</p>
      </div>
      {item.rating && (
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3 fill-current" />
          {item.rating}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 flex-shrink-0"
        data-testid={`button-remove-itinerary-${item.id}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Itinerary display component with drag-to-reorder
function ItineraryDisplay({ itinerary, groupId }: { itinerary: any; groupId: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState(itinerary.items || []);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      return await apiRequest("PATCH", `/api/itineraries/${itinerary.id}/order`, {
        proposedOrder: newOrder,
      });
    },
    onSuccess: () => {
      // Note: No need to invalidate nearby-suggestions on reorder
      // Nearby suggestions are based on WHICH venues are present, not their order
      toast({
        title: "Order updated",
        description: "Your itinerary has been reordered",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/itinerary-items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "nearby-suggestions"] });
      toast({
        title: "Venue removed",
        description: "The venue has been removed from your itinerary",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing venue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item: any) => item.id === active.id);
      const newIndex = items.findIndex((item: any) => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      // Update on server
      const newOrder = newItems.map((item: any) => item.sourceId);
      updateOrderMutation.mutate(newOrder);
    }
  }

  const handleRemoveItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item: any, index: number) => (
            <SortableItineraryItem 
              key={item.id} 
              item={item} 
              index={index} 
              onRemove={() => handleRemoveItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableCartVenue({ id, index, venueName, venueType, photoUrl, onRemove, distanceToNext, lat, lng, placeId, groupId, expandedNearbyId, onToggleNearby, nearbySuggestions, onAddNearby, addVenueLoading, selectedVenueIds }: {
  id: string;
  index: number;
  venueName: string;
  venueType: string;
  photoUrl: string;
  onRemove: () => void;
  distanceToNext?: { distance: number; category: 'close' | 'moderate' | 'far' } | null;
  lat?: number;
  lng?: number;
  placeId?: string;
  groupId?: string;
  expandedNearbyId: string | null;
  onToggleNearby: (venueId: string, lat?: number, lng?: number, placeId?: string) => void;
  nearbySuggestions?: any[];
  onAddNearby: (suggestion: any) => void;
  addVenueLoading: boolean;
  selectedVenueIds: string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const isExpanded = expandedNearbyId === id;
  const [loadingNearby, setLoadingNearby] = useState(false);

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 p-2 rounded-md bg-accent/20 border hover-elevate"
        data-testid={`cart-venue-${id}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex-shrink-0 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </div>
        {photoUrl && (
          <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
            <img src={photoUrl} alt={venueName} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{venueName}</p>
          {venueType && (
            <p className="text-xs text-muted-foreground truncate">{venueType}</p>
          )}
        </div>
        {lat && lng && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleNearby(id, lat, lng, placeId)}
            className="h-7 w-7 p-0 flex-shrink-0"
            data-testid={`button-nearby-${id}`}
          >
            <Compass className={`h-4 w-4 ${isExpanded ? 'text-primary' : ''}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 flex-shrink-0"
          data-testid={`button-remove-cart-${id}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Nearby suggestions inline expansion */}
      {isExpanded && nearbySuggestions && nearbySuggestions.length > 0 && (
        <div className="mt-2 ml-8 space-y-2 p-2 rounded-md bg-background/50 border">
          <p className="text-xs text-muted-foreground mb-2">Within 0.5 miles:</p>
          {nearbySuggestions.map((suggestion) => {
            const alreadyAdded = selectedVenueIds.includes(suggestion.placeId);
            return (
              <button
                key={suggestion.placeId}
                onClick={() => onAddNearby(suggestion)}
                disabled={alreadyAdded || addVenueLoading}
                className={`flex gap-2 p-2 rounded-md border text-left w-full transition-all hover-elevate ${
                  alreadyAdded || addVenueLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                data-testid={`nearby-suggestion-${suggestion.placeId}`}
              >
                {suggestion.photoUrl && (
                  <img 
                    src={suggestion.photoUrl} 
                    alt={suggestion.name}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{suggestion.name}</p>
                  {suggestion.rating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{suggestion.rating}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {suggestion.address}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {distanceToNext && (
        <div className="flex items-center justify-center py-1">
          <div className={`text-xs font-medium ${
            distanceToNext.category === 'close' ? 'text-green-600 dark:text-green-400' : 
            distanceToNext.category === 'moderate' ? 'text-yellow-600 dark:text-yellow-400' : 
            'text-red-600 dark:text-red-400'
          }`}>
            ↓ {formatDistance(distanceToNext.distance)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupDetail() {
  const [, params] = useRoute("/group/:id");
  const groupId = params?.id;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editBudgetRange, setEditBudgetRange] = useState<number[]>([50, 250]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [activeTab, setActiveTab] = useState("activities");
  const [editCloseness, setEditCloseness] = useState(3);
  const [editNovelty, setEditNovelty] = useState(3);
  const [editAvailability, setEditAvailability] = useState(createEmptyAvailability());
  const [editFrequencyNumber, setEditFrequencyNumber] = useState(1);
  const [editFrequencyUnit, setEditFrequencyUnit] = useState("weeks");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editGeneralAvailability, setEditGeneralAvailability] = useState("");
  const [editGroupData, setEditGroupData] = useState({
    name: "",
    emoji: "🎉",
    locationBase: "",
    pastPreferences: "",
    additionalInstructions: ""
  });
  const [newMembers, setNewMembers] = useState<{ name: string; email: string }[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [membersOpen, setMembersOpen] = useState(true);
  const [showSwipeSession, setShowSwipeSession] = useState(false);
  const [showEnrichmentConfirm, setShowEnrichmentConfirm] = useState(false);
  const [pendingEventTitle, setPendingEventTitle] = useState("");
  const [selectedVenues, setSelectedVenues] = useState<Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>>([]);
  const [regeneratingCategory, setRegeneratingCategory] = useState<string | null>(null);
  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [categorySortMode, setCategorySortMode] = useState<Record<string, 'rating' | 'votes'>>({});
  const [activitiesSubTab, setActivitiesSubTab] = useState("ai-suggested");
  const [addedSuggestionPlaceIds, setAddedSuggestionPlaceIds] = useState<Set<string>>(new Set());
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [debouncedVenueSearchQuery, setDebouncedVenueSearchQuery] = useState("");
  const [saveItineraryOpen, setSaveItineraryOpen] = useState(false);
  const [itineraryName, setItineraryName] = useState("");
  const [savingItineraryId, setSavingItineraryId] = useState<string | null>(null);
  const [timingRecommendations, setTimingRecommendations] = useState("");
  const [timingNotesOpen, setTimingNotesOpen] = useState(false);
  const [aiTimeOptions, setAiTimeOptions] = useState<Array<{ id: string; eventDate: string; dayLabel: string; timeLabel: string }>>([]);
  const [selectedTimeOptionIds, setSelectedTimeOptionIds] = useState<string[]>([]);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [aiTimeLoading, setAiTimeLoading] = useState(false);
  const [selectedItineraryForScheduling, setSelectedItineraryForScheduling] = useState<any | null>(null);
  const [scheduleMethod, setScheduleMethod] = useState<'manual' | 'ai'>('ai');
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");
  const [rsvpConstraintOpen, setRsvpConstraintOpen] = useState(false);
  const [rsvpItineraryId, setRsvpItineraryId] = useState<string | null>(null);
  const [constraintText, setConstraintText] = useState("");
  const [sendBackupOpen, setSendBackupOpen] = useState(false);
  const [backupForItineraryId, setBackupForItineraryId] = useState<string | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [editAvailabilityOpen, setEditAvailabilityOpen] = useState(false);
  const [editAvailabilityData, setEditAvailabilityData] = useState(createEmptyAvailability());
  const [editAvailabilityNotes, setEditAvailabilityNotes] = useState("");
  const [editMeetingFreqNumber, setEditMeetingFreqNumber] = useState(1);
  const [editMeetingFreqUnit, setEditMeetingFreqUnit] = useState("weeks");
  const [editItineraryOpen, setEditItineraryOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<any | null>(null);
  const [editItineraryName, setEditItineraryName] = useState("");
  const [editItineraryItems, setEditItineraryItems] = useState<any[]>([]);
  const [editTimingRecommendations, setEditTimingRecommendations] = useState("");
  const [editProposedDate, setEditProposedDate] = useState("");
  const [addVenueDialogOpen, setAddVenueDialogOpen] = useState(false);
  const [venuesToAdd, setVenuesToAdd] = useState<Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>>([]);
  const [expandedNearbyVenueId, setExpandedNearbyVenueId] = useState<string | null>(null);
  const [venueNearbySuggestions, setVenueNearbySuggestions] = useState<Record<string, any[]>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", groupId],
    enabled: !!groupId,
    refetchInterval: (query) => {
      const group = query.state.data as Group | undefined;
      // Poll every 3 seconds if generation is pending or in progress
      return group?.activityGenerationStatus === "pending" || 
             group?.activityGenerationStatus === "generating" 
        ? 3000 
        : false;
    },
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/groups", groupId, "activities"],
    enabled: !!groupId,
    refetchInterval: () => {
      // Poll every 3 seconds while generating new activities
      return group?.activityGenerationStatus === "pending" || 
             group?.activityGenerationStatus === "generating"
        ? 3000 
        : false;
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/groups", groupId, "members"],
    enabled: !!groupId,
  });

  const { data: itineraries = [], isLoading: itinerariesLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "itineraries"],
    enabled: !!groupId,
  });

  const { data: savedItineraries = [], isLoading: savedItinerariesLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "saved-itineraries"],
    enabled: !!groupId,
  });

  const { data: proposedItineraries = [], isLoading: proposedItinerariesLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "proposed-itineraries"],
    enabled: !!groupId,
  });

  // Check if user is group owner
  const isOwner = user?.id === group?.userId;

  // Track copied state for invite links
  const [copiedLinks, setCopiedLinks] = useState<Record<string, boolean>>({});

  // Fetch nearby suggestions when venues are selected or itinerary exists
  const { data: nearbySuggestions = [] } = useQuery<any[]>({
    queryKey: [
      "/api/groups", 
      groupId, 
      "nearby-suggestions",
      // Cart state: include selectedVenues
      selectedVenues,
      // Post-checkout state: include stable itinerary content identifier
      itineraries.length > 0 
        ? itineraries.flatMap(it => it.items || []).map((item: any) => item.id || item.activityId).sort().join(',')
        : ''
    ],
    queryFn: async () => {
      // Derive venue selection from either cart or itinerary
      let venuesForSuggestions = selectedVenues;
      
      if (selectedVenues.length === 0 && itineraries.length > 0) {
        // Use itinerary items as the basis for suggestions
        venuesForSuggestions = itineraries[0].items?.map((item: any) => ({
          sourceType: 'activity' as const,
          sourceId: item.activityId || item.id
        })) || [];
      }
      
      if (venuesForSuggestions.length === 0) return [];
      
      const response = await apiRequest("POST", `/api/groups/${groupId}/nearby-suggestions`, {
        selectedVenues: venuesForSuggestions
      });
      return response.suggestions || [];
    },
    enabled: !!groupId && (selectedVenues.length > 0 || itineraries.length > 0),
  });

  // Debounced venue search query
  const { data: venueSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "search-venues", debouncedVenueSearchQuery.trim()],
    queryFn: async () => {
      if (!debouncedVenueSearchQuery.trim() || debouncedVenueSearchQuery.trim().length < 2) {
        return [];
      }
      const response = await fetch(`/api/groups/${groupId}/search-venues?query=${encodeURIComponent(debouncedVenueSearchQuery.trim())}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!groupId && debouncedVenueSearchQuery.trim().length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Track previous generation status to detect when generation completes
  const prevStatusRef = useRef<string | undefined>();
  
  useEffect(() => {
    if (group?.activityGenerationStatus === "completed" && 
        (prevStatusRef.current === "generating" || prevStatusRef.current === "pending")) {
      // Generation just completed - force refetch activities to show results immediately
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      setGenerationStartTime(null);
    }
    prevStatusRef.current = group?.activityGenerationStatus;
  }, [group?.activityGenerationStatus, groupId]);

  // Track when generation starts and enforce 60-second timeout
  useEffect(() => {
    const status = group?.activityGenerationStatus;
    
    // Start timer when generation begins
    if ((status === "pending" || status === "generating") && !generationStartTime) {
      setGenerationStartTime(Date.now());
    }
    
    // Clear timer when generation completes or fails
    if (status === "completed" || status === "failed") {
      setGenerationStartTime(null);
    }
    
    // Check for timeout every second while generating
    if (generationStartTime && (status === "pending" || status === "generating")) {
      const checkTimeout = setInterval(() => {
        const elapsed = Date.now() - generationStartTime;
        if (elapsed > 180000) {
          // 180 seconds elapsed - force status to failed
          console.warn("AI generation timed out after 180 seconds");
          setGenerationStartTime(null);
          toast({
            title: "Generation timed out",
            description: "AI generation took too long. Please try again.",
            variant: "destructive",
          });
          // Stop polling by invalidating
          queryClient.setQueryData(["/api/groups", groupId], (old: any) => ({
            ...old,
            activityGenerationStatus: "failed",
            activityGenerationError: "Generation timed out after 60 seconds"
          }));
        }
      }, 1000);
      
      return () => clearInterval(checkTimeout);
    }
  }, [group?.activityGenerationStatus, generationStartTime, groupId, toast]);

  // Debounce venue search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedVenueSearchQuery(venueSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [venueSearchQuery]);

  // Initialize form fields from group data when it loads
  useEffect(() => {
    if (group) {
      setEditGroupData({
        name: group.name,
        emoji: group.emoji || "🎉",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || ""
      });
      setEditBudgetRange([group.budgetMin, group.budgetMax]);
      setEditCloseness(group.closenessLevel);
      setEditNovelty(group.noveltyPreference);
      setEditCategories(group.activityCategories || []);
      
      // Parse meeting frequency
      const freq = group.meetingFrequency;
      if (freq === "weekly") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      } else if (freq === "biweekly") {
        setEditFrequencyNumber(2);
        setEditFrequencyUnit("week");
      } else if (freq === "monthly") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("month");
      } else if (freq === "flexible") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      } else if (freq && freq.includes("-")) {
        // New format: "2-week", "1-month", etc.
        const [num, unit] = freq.split("-");
        const parsedNum = parseInt(num) || 1;
        // Convert old plural forms to singular
        let singularUnit = unit || "week";
        if (singularUnit.endsWith("s")) {
          singularUnit = singularUnit.slice(0, -1);
        }
        setEditFrequencyNumber(parsedNum);
        setEditFrequencyUnit(singularUnit);
      } else {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      }
      
      // Check if availability has the expected structure
      const availability = group.availability && typeof group.availability === 'object' && Object.keys(group.availability).length > 0
        ? group.availability
        : createEmptyAvailability();
      setEditAvailability(availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>);
    }
  }, [group]);

  const sendInvitationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/send-invitations`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invitations sent!",
        description: data.message,
      });
      // Invalidate members query to refresh invitation status
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending invitations",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retryGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/retry-generation`, {
        tempInstructions: tempInstructions.trim() || undefined
      });
    },
    onSuccess: () => {
      toast({
        title: "Retrying generation",
        description: "AI is creating new activity suggestions...",
      });
      setTempInstructions(""); // Clear the temp instructions after use
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error retrying",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/activities/cancel-generation`, {});
    },
    onSuccess: () => {
      toast({
        title: "Generation cancelled",
        description: "Activity generation has been stopped.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error cancelling",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearActivitiesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/groups/${groupId}/activities`, {});
    },
    onSuccess: () => {
      toast({
        title: "Activities cleared",
        description: "All AI suggestions have been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error clearing activities",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateCategoryMutation = useMutation({
    mutationFn: async ({ category, currentVenueNames, checkedActivityIds }: { category: string; currentVenueNames: string[]; checkedActivityIds: string[] }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/activities/regenerate-category`, {
        category,
        currentVenueNames,
        checkedActivityIds
      });
    },
    onSuccess: (newActivities: any[], variables: { category: string; currentVenueNames: string[]; checkedActivityIds: string[] }) => {
      setRegeneratingCategory(null);
      toast({
        title: "New suggestions generated!",
        description: `Replaced unchecked ${variables.category} suggestions`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      setRegeneratingCategory(null);
      toast({
        title: "Error regenerating",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ activityId, feedback }: { activityId: string; feedback: string | null }) => {
      return await apiRequest("PATCH", `/api/activities/${activityId}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      toast({
        title: "Feedback saved",
        description: "Your preference has been recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRadiusMutation = useMutation({
    mutationFn: async ({ searchRadius }: { searchRadius: number }) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}/radius`, { searchRadius });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/groups", groupId] });
      toast({
        title: "Search radius updated",
        description: "New suggestions will use this search area",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating radius",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ updates, newMembers }: { updates: any; newMembers: { name: string; email: string }[] }) => {
      // First update the group
      const response = await apiRequest("PATCH", `/api/groups/${groupId}`, updates);
      
      // Then add new members if any
      if (newMembers.length > 0) {
        await Promise.all(
          newMembers.map(member => {
            const memberData: any = {
              isOrganizer: false,
              invitationSent: false,
              hasJoined: false,
            };
            // Only include name/email if they have values (not empty strings)
            if (member.name.trim()) {
              memberData.name = member.name.trim();
            }
            if (member.email.trim()) {
              memberData.email = member.email.trim();
            }
            return apiRequest("POST", `/api/groups/${groupId}/join`, memberData);
          })
        );
      }
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      setEditGroupOpen(false);
      
      let description = "Your group details have been saved";
      let variant: "default" | "destructive" | undefined = undefined;
      
      if (data?.geocodingResult === 'failed') {
        description = "Group updated, but location couldn't be geocoded. Venue suggestions may be less accurate. Try using a more specific location like 'Oakland, California' instead of just 'Oakland'.";
        variant = "destructive";
      }
      
      toast({
        title: "Group updated",
        description,
        variant,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return await apiRequest("DELETE", `/api/members/${memberId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the group",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: { name?: string; email?: string } }) => {
      return await apiRequest("PATCH", `/api/members/${memberId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      setEditingMemberId(null);
      toast({
        title: "Member updated",
        description: "Member details have been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Itinerary validation mutation
  const validateItineraryMutation = useMutation({
    mutationFn: async (venues: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>) => {
      return await apiRequest("POST", `/api/groups/${groupId}/itineraries/validate`, { selectedVenues: venues });
    },
    onSuccess: () => {
      setSelectedVenues([]);
      setAddedSuggestionPlaceIds(new Set()); // Clear tracking set
      setActiveTab("build");
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "nearby-suggestions"] });
      toast({
        title: "Itinerary created!",
        description: "AI has validated and organized your evening plan",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Validation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleVenueSelection = (sourceType: 'activity' | 'voting_event', sourceId: string) => {
    setSelectedVenues(prev => {
      const exists = prev.some(v => v.sourceType === sourceType && v.sourceId === sourceId);
      if (exists) {
        return prev.filter(v => !(v.sourceType === sourceType && v.sourceId === sourceId));
      } else {
        if (prev.length >= 5) {
          toast({
            title: "Maximum reached",
            description: "You can select up to 5 venues",
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, { sourceType, sourceId }];
      }
    });
  };

  // Handle nearby suggestions toggle
  const handleToggleNearby = async (venueId: string, lat?: number, lng?: number, placeId?: string) => {
    if (expandedNearbyVenueId === venueId) {
      // Collapse if already expanded
      setExpandedNearbyVenueId(null);
      return;
    }
    
    if (!lat || !lng || !groupId) return;
    
    // Expand and fetch suggestions
    setExpandedNearbyVenueId(venueId);
    
    // Check if we already have suggestions for this venue
    if (venueNearbySuggestions[venueId]) {
      return; // Already fetched
    }
    
    try {
      // Get all selected place IDs to exclude from suggestions
      const excludePlaceIds = selectedVenues.map(v => {
        if (v.sourceType === 'activity') {
          const activity = activities.find(a => a.id === v.sourceId);
          return activity?.googlePlaceId;
        } else {
          const event = votingEvents.find(e => e.id === v.sourceId);
          return event?.googlePlaceId;
        }
      }).filter(Boolean);
      
      const response = await apiRequest("POST", `/api/groups/${groupId}/venue-nearby-suggestions`, {
        lat,
        lng,
        placeId,
        excludePlaceIds,
      });
      
      setVenueNearbySuggestions(prev => ({
        ...prev,
        [venueId]: response.suggestions || []
      }));
    } catch (error) {
      console.error('Error fetching nearby suggestions:', error);
      toast({
        title: "Error",
        description: "Could not fetch nearby suggestions",
        variant: "destructive"
      });
    }
  };
  
  // Handle adding a nearby suggestion to cart
  const handleAddNearby = (suggestion: any) => {
    if (selectedVenues.length >= 5) {
      toast({
        title: "Maximum reached",
        description: "You can select up to 5 venues",
        variant: "destructive"
      });
      return;
    }
    
    addVotingEventMutation.mutate({
      title: suggestion.name,
      venueType: suggestion.types?.[0] || 'venue',
      venueAddress: suggestion.address,
      googlePlaceId: suggestion.placeId,
    });
  };

  // Handle category regeneration
  const handleRegenerateCategory = (category: string, categoryActivities: Activity[]) => {
    setRegeneratingCategory(category);
    
    // Collect all currently visible venue names for deduplication
    const currentVenueNames = [
      ...activities.map(a => a.venueName),
      ...votingEvents.map(e => e.title),
    ];
    
    // Collect checked activity IDs in this category to preserve them
    const checkedActivityIds = categoryActivities
      .filter(a => selectedVenues.some(v => v.sourceType === 'activity' && v.sourceId === a.id))
      .map(a => a.id);
    
    regenerateCategoryMutation.mutate({ category, currentVenueNames, checkedActivityIds });
  };

  // Voting functionality
  const [newEventTitle, setNewEventTitle] = useState("");
  const [addEventOpen, setAddEventOpen] = useState(false);

  const { data: votingEvents = [], isLoading: votingEventsLoading } = useQuery<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>({
    queryKey: ["/api/groups", groupId, "voting-events"],
    enabled: !!groupId,
  });

  const { data: myVotes = {} } = useQuery<Record<string, Vote>>({
    queryKey: ["/api/groups", groupId, "my-votes"],
    queryFn: async () => {
      if (!groupId) return {};
      const votes: Record<string, Vote> = {};
      for (const event of votingEvents) {
        const response = await fetch(`/api/voting-events/${event.id}/my-vote`);
        if (response.ok) {
          const vote = await response.json();
          if (vote) votes[event.id] = vote;
        }
      }
      return votes;
    },
    enabled: !!groupId && votingEvents.length > 0,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: { 
      title: string;
      description?: string;
      venueAddress?: string;
      venueType?: string;
      googlePlaceId?: string;
      rating?: string;
      priceLevel?: string;
      photoUrl?: string;
      aiReasoning?: string;
      priceEstimate?: string;
      timeConstraints?: string;
      complementaryPlaceName?: string;
      complementaryPlaceAddress?: string;
      complementaryPlaceId?: string;
      complementaryPlacePhotoUrl?: string;
      complementaryPlaceRating?: string;
      complementaryPlaceName2?: string;
      complementaryPlaceAddress2?: string;
      complementaryPlaceId2?: string;
      complementaryPlacePhotoUrl2?: string;
      complementaryPlaceRating2?: string;
      skipEnrichmentCheck?: boolean;
    }) => {
      return await apiRequest("POST", "/api/voting-events", { groupId, ...eventData });
    },
    onSuccess: (data: { event?: any; enrichmentStatus: 'success' | 'no_results' | 'error' | 'skipped' }) => {
      // Check if Google Places found the venue
      if (data.enrichmentStatus === 'no_results') {
        // Show confirmation dialog - event was not created yet
        setPendingEventTitle(newEventTitle);
        setShowEnrichmentConfirm(true);
        setAddEventOpen(false); // Close the add event dialog
      } else if (data.event) {
        // Event was created successfully
        queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
        setNewEventTitle("");
        setAddEventOpen(false);
        toast({
          title: "Event added",
          description: data.enrichmentStatus === 'success' 
            ? "Your event has been added with venue details from Google Places"
            : "Your event has been added to the voting list",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addVotingEventMutation = useMutation({
    mutationFn: async (eventData: { 
      title: string;
      venueAddress?: string;
      venueType?: string;
      googlePlaceId?: string;
    }) => {
      return await apiRequest("POST", "/api/voting-events", { 
        groupId, 
        ...eventData, 
        skipEnrichmentCheck: true // Skip confirmation since we already have Google data
      });
    },
    onSuccess: (data: { event?: any }, variables) => {
      if (data.event) {
        // Track placeId only on success to allow retries on failure
        if (variables.googlePlaceId) {
          setAddedSuggestionPlaceIds(prev => new Set(Array.from(prev).concat(variables.googlePlaceId!)));
        }
        
        // Automatically add to selected venues BEFORE invalidating queries
        // This prevents race condition where hydration effect clears selectedVenues
        setSelectedVenues(prev => [...prev, {
          sourceType: 'voting_event',
          sourceId: data.event.id
        }]);
        
        queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
        
        toast({
          title: "Added to itinerary",
          description: "Nearby venue has been added to your selection",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding venue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveItineraryMutation = useMutation({
    mutationFn: async ({ itineraryId, name, timingRecommendations }: { itineraryId: string; name: string; timingRecommendations?: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/save`, { name, timingRecommendations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      setSaveItineraryOpen(false);
      setItineraryName("");
      setTimingRecommendations("");
      setTimingNotesOpen(false);
      setSavingItineraryId(null);
      toast({
        title: "Itinerary saved",
        description: "You can now send this itinerary to your group anytime",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving itinerary",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSavedItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/me/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Event deleted",
        description: "The event has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/duplicate`);
    },
    onSuccess: (duplicatedItinerary) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      setActiveTab('build');
      toast({
        title: "Plan duplicated",
        description: "The copy is now in your Build tab where you can edit it",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error duplicating plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateItineraryMutation = useMutation({
    mutationFn: async ({ itineraryId, updates }: { itineraryId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/itineraries/${itineraryId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/me/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setEditItineraryOpen(false);
      setEditingItinerary(null);
      toast({
        title: "Plan updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItineraryItemsMutation = useMutation({
    mutationFn: async ({ itineraryId, items }: { itineraryId: string; items: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}> }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/items`, { items });
    },
    onSuccess: (newItems) => {
      // Add the new items to the local state
      setEditItineraryItems(prev => [...prev, ...newItems]);
      setAddVenueDialogOpen(false);
      setVenuesToAdd([]);
      toast({
        title: "Venues added",
        description: `${newItems.length} venue(s) added to the plan`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding venues",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getAiTimeSuggestionMutation = useMutation({
    mutationFn: async ({ itineraryId, venues }: { itineraryId: string; venues?: Array<{ name: string; type: string }> }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/suggest-time`, { venues });
    },
    onSuccess: (data: { options: Array<{ id: string; eventDate: string; dayLabel: string; timeLabel: string }> }) => {
      setAiTimeOptions(data.options);
      // Auto-select first option
      if (data.options.length > 0) {
        setSelectedTimeOptionIds([data.options[0].id]);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error getting AI suggestion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendItineraryMutation = useMutation({
    mutationFn: async (params: { itineraryId: string; eventDate?: string; eventDates?: string[]; autoScheduleConfig?: any }) => {
      return await apiRequest("POST", `/api/itineraries/${params.itineraryId}/send`, params);
    },
    onSuccess: () => {
      // Only invalidate queries - state reset happens in button click handler
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const createRsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, response, constraintText }: { itineraryId: string; response: 'yes' | 'no' | 'yes_with_constraint'; constraintText?: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/rsvps`, { response, constraintText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      setRsvpConstraintOpen(false);
      setRsvpItineraryId(null);
      setConstraintText("");
      toast({
        title: "RSVP submitted",
        description: "Your response has been recorded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting RSVP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendBackupMutation = useMutation({
    mutationFn: async ({ savedItineraryId, originalItineraryId }: { savedItineraryId: string; originalItineraryId: string }) => {
      return await apiRequest("POST", `/api/itineraries/${savedItineraryId}/send-backup`, { originalItineraryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      setSendBackupOpen(false);
      setBackupForItineraryId(null);
      setSelectedBackupId(null);
      toast({
        title: "Backup plan sent",
        description: "Alternative plan sent to members with constraints",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending backup",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const finalizePlanMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      toast({
        title: "Plan finalized! 🎉",
        description: "This is now The Plan for your group",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error finalizing plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ eventId, voteType }: { eventId: string; voteType: 'upvote' | 'downvote' }) => {
      return await apiRequest("POST", `/api/voting-events/${eventId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error voting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeVoteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${eventId}/vote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleEditCategory = (categoryId: string) => {
    setEditCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleVote = (eventId: string, voteType: 'upvote' | 'downvote') => {
    const currentVote = myVotes[eventId];
    if (currentVote) {
      if (currentVote.voteType === voteType) {
        removeVoteMutation.mutate(eventId);
      } else {
        voteMutation.mutate({ eventId, voteType });
      }
    } else {
      voteMutation.mutate({ eventId, voteType });
    }
  };

  const openEditGroup = () => {
    if (group) {
      setEditGroupData({
        name: group.name,
        emoji: group.emoji || "🎉",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || ""
      });
      setEditBudgetRange([group.budgetMin, group.budgetMax]);
      setEditCloseness(group.closenessLevel);
      setEditNovelty(group.noveltyPreference);
      setEditCategories(group.activityCategories || []);
      
      // Parse meeting frequency
      const freq = group.meetingFrequency;
      if (freq === "weekly") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      } else if (freq === "biweekly") {
        setEditFrequencyNumber(2);
        setEditFrequencyUnit("week");
      } else if (freq === "monthly") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("month");
      } else if (freq === "flexible") {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      } else if (freq && freq.includes("-")) {
        // New format: "2-week", "1-month", etc.
        const [num, unit] = freq.split("-");
        const parsedNum = parseInt(num) || 1;
        // Convert old plural forms to singular
        let singularUnit = unit || "week";
        if (singularUnit.endsWith("s")) {
          singularUnit = singularUnit.slice(0, -1);
        }
        setEditFrequencyNumber(parsedNum);
        setEditFrequencyUnit(singularUnit);
      } else {
        setEditFrequencyNumber(1);
        setEditFrequencyUnit("week");
      }
      
      // Check if availability has the expected structure
      const availability = group.availability && typeof group.availability === 'object' && Object.keys(group.availability).length > 0
        ? group.availability
        : createEmptyAvailability();
      setEditAvailability(availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>);
      setEditGeneralAvailability(group.generalAvailability || "");
      setNewMembers([]);
      setEditGroupOpen(true);
    }
  };

  const addNewMember = () => {
    setNewMembers([...newMembers, { name: "", email: "" }]);
  };

  const removeNewMember = (index: number) => {
    setNewMembers(newMembers.filter((_, i) => i !== index));
  };

  const updateNewMember = (index: number, field: "name" | "email", value: string) => {
    const updated = [...newMembers];
    updated[index][field] = value;
    setNewMembers(updated);
  };

  const handleUpdateGroup = async () => {
    const updates = {
      name: editGroupData.name,
      emoji: editGroupData.emoji,
      locationBase: editGroupData.locationBase,
      budgetMin: editBudgetRange[0],
      budgetMax: editBudgetRange[1],
      meetingFrequency: `${editFrequencyNumber}-${editFrequencyUnit}`,
      closenessLevel: editCloseness,
      noveltyPreference: editNovelty,
      activityCategories: editCategories.length > 0 ? editCategories : undefined,
      availability: editAvailability,
      generalAvailability: editGeneralAvailability.trim() || undefined,
      pastPreferences: editGroupData.pastPreferences,
      additionalInstructions: editGroupData.additionalInstructions
    };
    
    // Filter out empty members (both name and email empty)
    const validNewMembers = newMembers.filter(m => m.name.trim() || m.email.trim());
    
    // Update group and add new members
    updateGroupMutation.mutate({ 
      updates, 
      newMembers: validNewMembers 
    });
  };

  const copyShareLink = () => {
    if (group?.shareableLink) {
      const fullUrl = `${window.location.origin}/join/${group.shareableLink}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with your group members",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAvailability = (availability: any): string => {
    if (typeof availability === 'string') {
      return availability.replace("-", " ");
    }
    
    if (typeof availability === 'object' && availability !== null) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const times = ['morning', 'afternoon', 'evening'];
      const selectedSlots: string[] = [];
      
      days.forEach(day => {
        if (availability[day]) {
          const dayTimes = times.filter(time => availability[day][time]);
          if (dayTimes.length > 0) {
            selectedSlots.push(`${day}: ${dayTimes.join(', ')}`);
          }
        }
      });
      
      return selectedSlots.length > 0 ? selectedSlots.join(' • ') : 'Not specified';
    }
    
    return 'Not specified';
  };

  if (groupLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Group not found</h2>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const priceDisplay = (level: string) => {
    const count = parseInt(level) || 0;
    return "$".repeat(Math.max(1, count));
  };

  const extractCity = (address: string | null | undefined): string => {
    if (!address) return "";
    // Address format is typically: "123 Street, City, State ZIP"
    const parts = address.split(",").map(p => p.trim());
    // Return the second part (city) if it exists
    return parts.length >= 2 ? parts[1] : "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl" data-testid="emoji-group-detail">{group.emoji || "🎉"}</span>
            <h1 className="text-xl font-semibold" data-testid="text-group-name">{group.name}</h1>
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      {/* How It Works Banner */}
      {activities.length > 0 && showInstructions && (
        <div className="border-b bg-primary/5 border-primary/20">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm flex-shrink-0 ${
                  itineraries.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'
                }`}>
                  {itineraries.length > 0 ? '2' : '1'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">
                    {itineraries.length > 0 ? 'Step 2: Create Your Itinerary' : 'Step 1: Discover Activities'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {itineraries.length > 0 
                      ? 'Select 1-5 venues to create your perfect evening. AI validates proximity and timing.'
                      : 'Browse AI-generated suggestions below. Use "Generate New Ideas" to explore more options.'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={itineraries.length > 0 ? 'line-through opacity-50' : 'font-medium text-primary'}>
                      1. Discover
                    </span>
                    <span>→</span>
                    <span className={itineraries.length > 0 ? 'font-medium text-primary' : ''}>
                      2. Itinerary
                    </span>
                    <span>→</span>
                    <span className="opacity-50">3. Schedule</span>
                    <span>→</span>
                    <span className="opacity-50">4. Invite</span>
                    <span>→</span>
                    <span className="opacity-50">5. Learn</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructions(false)}
                className="h-6 w-6 p-0 flex-shrink-0"
                data-testid="button-hide-instructions"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-5">
            <TabsTrigger value="preferences" data-testid="tab-preferences">1. Group Details</TabsTrigger>
            <TabsTrigger value="activities" data-testid="tab-activities">2. Activities</TabsTrigger>
            <TabsTrigger value="build" data-testid="tab-build">3. Itinerary</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">4. Schedule</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">5. Feedback</TabsTrigger>
          </TabsList>

          {/* Tab 1: Group Details */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Group Details Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Group Details</CardTitle>
                  <CardDescription>Basic information about your group</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-group-name">Group Name</Label>
                    <Input
                      id="edit-group-name"
                      value={editGroupData.name}
                      onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                      data-testid="input-edit-group-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inline-group-emoji">Group Icon</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{editGroupData.emoji || "🎉"}</div>
                        <Input 
                          id="inline-group-emoji"
                          value={editGroupData.emoji} 
                          onChange={(e) => setEditGroupData({ ...editGroupData, emoji: e.target.value })}
                          placeholder="🎉" 
                          className="w-20 text-center text-2xl"
                          data-testid="input-inline-group-emoji"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {groupEmojis.map((emoji) => (
                          <Button
                            key={emoji}
                            type="button"
                            variant={editGroupData.emoji === emoji ? "default" : "outline"}
                            size="sm"
                            onClick={() => setEditGroupData({ ...editGroupData, emoji })}
                            className="text-xl h-10 w-10 p-0"
                            data-testid={`button-inline-emoji-${emoji}`}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-location">Location Base</Label>
                    <Input
                      id="edit-location"
                      value={editGroupData.locationBase}
                      onChange={(e) => setEditGroupData({ ...editGroupData, locationBase: e.target.value })}
                      data-testid="input-edit-location"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Budget Range (per person)</Label>
                    <div className="space-y-3">
                      <Slider
                        min={0}
                        max={250}
                        step={10}
                        value={editBudgetRange}
                        onValueChange={setEditBudgetRange}
                        className="w-full"
                        data-testid="slider-edit-budget"
                      />
                      <div className="flex justify-between text-sm">
                        <span className="font-medium" data-testid="text-edit-budget-min">
                          {editBudgetRange[0] >= 200 ? "$200+" : `$${editBudgetRange[0]}`}
                        </span>
                        <span className="font-medium" data-testid="text-edit-budget-max">
                          {editBudgetRange[1] >= 200 ? "$200+" : `$${editBudgetRange[1]}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>How Often to Meet</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={editFrequencyNumber}
                          onChange={(e) => setEditFrequencyNumber(parseInt(e.target.value) || 1)}
                          data-testid="input-edit-frequency-number"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">x each</span>
                      <Select value={editFrequencyUnit} onValueChange={setEditFrequencyUnit}>
                        <SelectTrigger className="flex-1" data-testid="select-edit-frequency-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">day</SelectItem>
                          <SelectItem value="week">week</SelectItem>
                          <SelectItem value="month">month</SelectItem>
                          <SelectItem value="year">year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Group Availability</Label>
                    <>
                      <AvailabilityGrid 
                        value={editAvailability} 
                        onChange={setEditAvailability}
                      />
                    </>
                  </div>
                </CardContent>
              </Card>

              {/* Preferences Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Group Preferences</CardTitle>
                  <CardDescription>Help AI understand what your group enjoys</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-base">How willing is your group to try new things?</Label>
                    <div className="space-y-3">
                      <div className="text-center text-sm text-muted-foreground">
                        Group Openness to New Experiences
                      </div>
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[editNovelty]}
                        onValueChange={(value) => setEditNovelty(value[0])}
                        className="w-full"
                        data-testid="slider-edit-novelty"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>We like our usual spots</span>
                        <span>Open sometimes</span>
                        <span>Always up for new things!</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">What types of activities interest your group?</Label>
                    <p className="text-sm text-muted-foreground">Select all that apply (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {activityCategories.map((category) => {
                        const Icon = category.icon;
                        return (
                          <Button
                            key={category.id}
                            type="button"
                            variant={editCategories.includes(category.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleEditCategory(category.id)}
                            className="gap-1.5"
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{category.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-past-preferences">What Has Your Group Enjoyed in the Past?</Label>
                    <Textarea
                      id="edit-past-preferences"
                      value={editGroupData.pastPreferences}
                      onChange={(e) => setEditGroupData({ ...editGroupData, pastPreferences: e.target.value })}
                      placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                      className="resize-none h-24"
                      data-testid="textarea-edit-past-preferences"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-additional-instructions">Additional Instructions for AI (Optional)</Label>
                    <Textarea
                      id="edit-additional-instructions"
                      value={editGroupData.additionalInstructions}
                      onChange={(e) => setEditGroupData({ ...editGroupData, additionalInstructions: e.target.value })}
                      placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating, avoid crowded places..."
                      className="resize-none h-24"
                      data-testid="textarea-edit-additional-instructions"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AI Preference Insights Section */}
              {group.preferenceInsights && Array.isArray(group.preferenceInsights) && group.preferenceInsights.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-500" />
                          Your Group's Patterns
                        </CardTitle>
                        <CardDescription>AI-discovered preferences based on {group.feedbackCount || 0} feedback actions</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiRequest("POST", `/api/groups/${group.id}/analyze-patterns`, {});
                            queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id] });
                            toast({ title: "Insights refreshed successfully" });
                          } catch (error: any) {
                            toast({ 
                              title: "Failed to refresh insights", 
                              description: error.message,
                              variant: "destructive" 
                            });
                          }
                        }}
                        className="gap-2"
                        data-testid="button-refresh-insights"
                      >
                        <Sparkles className="w-4 h-4" />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.isArray(group.preferenceInsights) && group.preferenceInsights.map((insight: {icon: string; pattern: string; description: string}, index: number) => (
                      <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-md">
                        <div className="text-2xl flex-shrink-0">{insight.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{insight.pattern}</p>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Members Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>Manage group members and invitations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* RSVP Summary */}
                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b">
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {members.filter(m => m.rsvpStatus === "going").length} Going
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Circle className="w-3 h-3" />
                        {members.filter(m => m.rsvpStatus === "maybe").length} Maybe
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        {members.filter(m => m.rsvpStatus === "not_going").length} Can't make it
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        {members.filter(m => !m.rsvpStatus).length} No response
                      </Badge>
                    </div>
                  )}

                  {/* Group Constraint Insights */}
                  {(() => {
                    const scheduleConflicts = new Set<string>();
                    const budgetConcernCount = members.filter(m => (m.memberConstraints as MemberConstraints)?.budgetConcern).length;
                    const distanceConcernCount = members.filter(m => (m.memberConstraints as MemberConstraints)?.distanceConcern).length;
                    
                    members.forEach(m => {
                      const constraints = m.memberConstraints as MemberConstraints;
                      if (constraints?.scheduleConflicts) {
                        constraints.scheduleConflicts.forEach(conflict => scheduleConflicts.add(conflict));
                      }
                    });

                    const hasInsights = scheduleConflicts.size > 0 || budgetConcernCount > 0 || distanceConcernCount > 0;

                    return hasInsights ? (
                      <div className="space-y-2 pb-2 border-b">
                        <Label className="text-xs font-semibold">Group Insights</Label>
                        <div className="flex flex-wrap gap-2">
                          {scheduleConflicts.size > 0 && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Clock className="w-3 h-3" />
                              Schedule conflicts: {Array.from(scheduleConflicts).join(", ")}
                            </Badge>
                          )}
                          {budgetConcernCount > 0 && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <DollarSign className="w-3 h-3" />
                              {budgetConcernCount} {budgetConcernCount === 1 ? "member" : "members"} mentioned budget
                            </Badge>
                          )}
                          {distanceConcernCount > 0 && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <MapPin className="w-3 h-3" />
                              {distanceConcernCount} {distanceConcernCount === 1 ? "member" : "members"} mentioned distance
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* Existing Members */}
                  {members.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Current Members</Label>
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={member.id}>
                            {editingMemberId === member.id ? (
                              // Edit mode
                              <div className="flex gap-2 items-start p-2 bg-muted/50 rounded-md">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <Input
                                    placeholder="Name (optional)"
                                    value={editMemberData.name}
                                    onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })}
                                    data-testid={`input-edit-member-name-${member.id}`}
                                  />
                                  <Input
                                    type="email"
                                    placeholder="Email (optional)"
                                    value={editMemberData.email}
                                    onChange={(e) => setEditMemberData({ ...editMemberData, email: e.target.value })}
                                    data-testid={`input-edit-member-email-${member.id}`}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => {
                                    updateMemberMutation.mutate({
                                      memberId: member.id,
                                      data: {
                                        name: editMemberData.name.trim() || undefined,
                                        email: editMemberData.email.trim() || undefined,
                                      }
                                    });
                                  }}
                                  data-testid={`button-save-member-${member.id}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => setEditingMemberId(null)}
                                  data-testid={`button-cancel-edit-member-${member.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              // Display mode
                              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{member.name || "Member"}</p>
                                    {member.rsvpStatus && (
                                      <Badge 
                                        variant={member.rsvpStatus === "going" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {member.rsvpStatus === "going" && "✓ Going"}
                                        {member.rsvpStatus === "maybe" && "? Maybe"}
                                        {member.rsvpStatus === "not_going" && "✗ Can't make it"}
                                      </Badge>
                                    )}
                                  </div>
                                  {member.email && (
                                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  )}
                                  {member.memberLocation && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {member.memberLocation}
                                    </p>
                                  )}
                                  {(() => {
                                    const constraints = member.memberConstraints as MemberConstraints | null;
                                    if (!constraints) return null;
                                    return (
                                      <div className="text-xs text-muted-foreground space-y-1 mt-1">
                                        {constraints.scheduleConflicts && constraints.scheduleConflicts.length > 0 && (
                                          <p className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 
                                            {constraints.scheduleConflicts.join(", ")}
                                          </p>
                                        )}
                                        {constraints.budgetConcern && (
                                          <p className="flex items-center gap-1">
                                            <DollarSign className="w-3 h-3" /> Budget concern
                                          </p>
                                        )}
                                        {constraints.distanceConcern && (
                                          <p className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> Distance concern
                                          </p>
                                        )}
                                        {constraints.notes && (
                                          <p className="italic">"{constraints.notes}"</p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                {member.isOrganizer ? (
                                  <Badge variant="secondary" className="text-xs">Organizer</Badge>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setEditingMemberId(member.id);
                                        setEditMemberData({
                                          name: member.name || '',
                                          email: member.email || ''
                                        });
                                      }}
                                      data-testid={`button-edit-member-${member.id}`}
                                    >
                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7"
                                        >
                                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to remove {member.name || member.email || "this member"} from the group?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteMemberMutation.mutate(member.id)}
                                          >
                                            Remove
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Members */}
                  {newMembers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">New Members to Add</Label>
                      {newMembers.map((member, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input
                              placeholder="Name (optional)"
                              value={member.name}
                              onChange={(e) => updateNewMember(index, "name", e.target.value)}
                              data-testid={`input-new-member-name-${index}`}
                            />
                            <Input
                              type="email"
                              placeholder="Email (optional)"
                              value={member.email}
                              onChange={(e) => updateNewMember(index, "email", e.target.value)}
                              data-testid={`input-new-member-email-${index}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removeNewMember(index)}
                            data-testid={`button-remove-new-member-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewMember}
                    className="w-full"
                    data-testid="button-add-new-member"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>

                  {members.some(m => m.email && !m.invitationSent) && (
                    <div className="pt-2 border-t">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => sendInvitationsMutation.mutate()}
                        disabled={sendInvitationsMutation.isPending}
                        data-testid="button-send-invitations"
                      >
                        <Mail className="mr-2 h-3 w-3" />
                        {sendInvitationsMutation.isPending ? "Sending..." : "Send Invitations"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Preference Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Preference Learning</CardTitle>
                  <CardDescription>Refine AI understanding of your group's preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setShowSwipeSession(true)}
                    variant="outline"
                    data-testid="button-refine-ideas"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Refine Ideas
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Swipe through activity concepts to help AI learn your group's taste
                  </p>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleUpdateGroup} 
                  disabled={updateGroupMutation.isPending}
                  size="lg"
                  data-testid="button-save-group"
                >
                  {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Activities */}
          <TabsContent value="activities" className="space-y-6">
            <Tabs value={activitiesSubTab} onValueChange={setActivitiesSubTab}>
              <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
                <TabsTrigger value="ai-suggested" data-testid="subtab-ai-suggested">AI Suggested</TabsTrigger>
                <TabsTrigger value="search" data-testid="subtab-search">Search</TabsTrigger>
                <TabsTrigger value="favorites" data-testid="subtab-favorites">Favorites</TabsTrigger>
              </TabsList>

              {/* Sub-tab 1: AI Suggested */}
              <TabsContent value="ai-suggested" className="space-y-6">
                {/* Main Content - AI-Suggested Activities */}
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <h2 className="text-2xl font-bold" data-testid="text-activities-title">AI-Suggested Activities</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Select 1-5 venues to build your itinerary. Click the checkboxes to add venues to your plan.
              </p>
              
              {/* Search Radius Slider */}
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📍</span>
                  <div className="flex-1 relative">
                    <Slider
                      value={[
                        group?.searchRadius === 2 ? 0 :
                        group?.searchRadius === 10 ? 1 :
                        group?.searchRadius === 30 ? 2 : 3
                      ]}
                      onValueChange={(value) => {
                        const radiusMap = [2, 10, 30, 50];
                        const newRadius = radiusMap[value[0]];
                        updateRadiusMutation.mutate({ searchRadius: newRadius });
                      }}
                      max={3}
                      step={1}
                      className="w-full"
                      disabled={updateRadiusMutation.isPending}
                      data-testid="slider-search-radius"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">2mi</span>
                      <span className="text-xs text-muted-foreground">10mi</span>
                      <span className="text-xs text-muted-foreground">30mi</span>
                      <span className="text-xs text-muted-foreground">50mi</span>
                    </div>
                  </div>
                  <span className="text-lg">🛣️</span>
                  <span className="text-xs text-muted-foreground min-w-24">
                    {group?.searchRadius === 10 && "Citywide"}
                    {group?.searchRadius === 30 && "Special Trip"}
                    {group?.searchRadius === 50 && "Road Trip"}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Textarea
                    placeholder="Tell the AI what you want to see... (e.g., 'more outdoor activities' or 'include live music venues')"
                    value={tempInstructions}
                    onChange={(e) => setTempInstructions(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-temp-instructions"
                  />
                </div>
                <Button
                  onClick={() => {
                    const isGenerating = retryGenerationMutation.isPending || group?.activityGenerationStatus === "generating" || group?.activityGenerationStatus === "pending";
                    if (isGenerating) {
                      toast({
                        title: "Already generating",
                        description: "Please wait for the current generation to complete. This usually takes 10-20 seconds.",
                      });
                    } else {
                      retryGenerationMutation.mutate();
                    }
                  }}
                  aria-disabled={retryGenerationMutation.isPending || group?.activityGenerationStatus === "generating" || group?.activityGenerationStatus === "pending"}
                  className={(retryGenerationMutation.isPending || group?.activityGenerationStatus === "generating" || group?.activityGenerationStatus === "pending") ? "opacity-50 cursor-not-allowed" : ""}
                  variant="default"
                  data-testid="button-generate-suggestions"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {retryGenerationMutation.isPending ? "Generating..." : "Generate New Ideas"}
                </Button>
              </div>

              {activitiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="h-48 w-full rounded-t-lg" />
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  {group?.activityGenerationStatus === "failed" ? (
                    <>
                      <Calendar className="h-12 w-12 text-destructive mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
                      <p className="text-muted-foreground mb-4">
                        {group.activityGenerationError || "Unable to generate activity suggestions"}
                      </p>
                      <Button 
                        onClick={() => retryGenerationMutation.mutate()} 
                        variant="outline"
                        disabled={retryGenerationMutation.isPending}
                        data-testid="button-retry-generation"
                      >
                        {retryGenerationMutation.isPending ? "Retrying..." : "Retry Generation"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        AI is generating your suggestions...
                      </h3>
                      {group.activityGenerationError && (
                        <p className="text-sm text-primary mb-2" data-testid="text-generation-progress">
                          {group.activityGenerationError}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        This can take 30-120 seconds for groups with history
                      </p>
                      <Button
                        onClick={() => cancelGenerationMutation.mutate()}
                        variant="outline"
                        size="sm"
                        disabled={cancelGenerationMutation.isPending}
                        data-testid="button-cancel-generation"
                        className="mb-6"
                      >
                        {cancelGenerationMutation.isPending ? "Cancelling..." : "Cancel Generation"}
                      </Button>
                      
                      {/* Roadmap */}
                      <div className="max-w-2xl mx-auto mt-6">
                        <h4 className="text-sm font-semibold mb-4">How Kinmo Works</h4>
                        <div className="space-y-3 text-left">
                          <div className="flex items-start gap-3 p-3 rounded-md bg-primary/10 border-l-4 border-primary">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
                              1
                            </div>
                            <div>
                              <p className="font-medium text-sm">Discover</p>
                              <p className="text-xs text-muted-foreground">AI generates personalized activity suggestions</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm flex-shrink-0">
                              2
                            </div>
                            <div>
                              <p className="font-medium text-sm">Itinerary</p>
                              <p className="text-xs text-muted-foreground">Select 1-5 venues to create your itinerary</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm flex-shrink-0">
                              3
                            </div>
                            <div>
                              <p className="font-medium text-sm">Schedule <span className="text-xs text-muted-foreground">(coming soon)</span></p>
                              <p className="text-xs text-muted-foreground">Pick a date for your outing</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm flex-shrink-0">
                              4
                            </div>
                            <div>
                              <p className="font-medium text-sm">Invite <span className="text-xs text-muted-foreground">(coming soon)</span></p>
                              <p className="text-xs text-muted-foreground">Send to your group for RSVPs</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm flex-shrink-0">
                              5
                            </div>
                            <div>
                              <p className="font-medium text-sm">Learn <span className="text-xs text-muted-foreground">(coming soon)</span></p>
                              <p className="text-xs text-muted-foreground">AI gets smarter from your group's feedback</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <>
                {/* Group activities by food/beverage category */}
                {(() => {
                  const filteredActivities = activities
                    .filter(activity => activity.feedback !== "less")
                    .sort((a, b) => {
                      // Sort by rating (highest first), then by review count (highest first)
                      const ratingA = parseFloat(a.rating || "0");
                      const ratingB = parseFloat(b.rating || "0");
                      if (ratingA !== ratingB) {
                        return ratingB - ratingA;
                      }
                      const reviewCountA = a.reviewCount || 0;
                      const reviewCountB = b.reviewCount || 0;
                      return reviewCountB - reviewCountA;
                    });

                  const groupedByCategory = {
                    meal: filteredActivities.filter(a => getActivityCategory(a) === 'meal'),
                    cafes: filteredActivities.filter(a => getActivityCategory(a) === 'cafes'),
                    drinks: filteredActivities.filter(a => getActivityCategory(a) === 'drinks'),
                    dessert: filteredActivities.filter(a => getActivityCategory(a) === 'dessert'),
                    experiences: filteredActivities.filter(a => getActivityCategory(a) === 'experiences'),
                  };

                  const categoryLabels = {
                    meal: { icon: "🍽️", title: "MEAL", subtitle: "Restaurants, food markets, food halls" },
                    cafes: { icon: "☕", title: "CAFES", subtitle: "Coffee shops, cafes" },
                    drinks: { icon: "🍸", title: "DRINKS", subtitle: "Bars, cocktail lounges, breweries" },
                    dessert: { icon: "🍰", title: "DESSERT", subtitle: "Boba, ice cream, dessert shops" },
                    experiences: { icon: "🎭", title: "EXPERIENCES", subtitle: "Museums, concerts, parks, activities" },
                  };

                  return (
                    <div className="space-y-8">
                      {(['meal', 'cafes', 'drinks', 'dessert', 'experiences'] as const).map((category) => {
                        const categoryActivities = groupedByCategory[category];
                        if (categoryActivities.length === 0) return null;

                        const label = categoryLabels[category];
                        
                        // Check if all cards in this category are checked
                        const checkedCount = categoryActivities.filter(a => 
                          selectedVenues.some(v => v.sourceType === 'activity' && v.sourceId === a.id)
                        ).length;
                        const allChecked = checkedCount === categoryActivities.length;
                        const isRegenerating = regeneratingCategory === category;
                        
                        return (
                          <div key={category} className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{label.icon}</span>
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold tracking-wide">{label.title}</h3>
                                <p className="text-xs text-muted-foreground">{label.subtitle}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRegenerateCategory(category, categoryActivities)}
                                disabled={allChecked || isRegenerating}
                                className="h-8 w-8 p-0 text-[#ffffff] bg-[#6419e6]"
                                data-testid={`button-regenerate-${category}`}
                              >
                                {isRegenerating ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                              {categoryActivities.map((activity) => {
                  // Determine label for complementary places
                  const isRestaurant = ['restaurant', 'cafe', 'bar', 'brewery', 'bakery', 'food'].some(type => 
                    activity.venueType.toLowerCase().includes(type)
                  );
                  const isOutdoor = ['park', 'outdoor', 'beach', 'hiking', 'trail'].some(type => 
                    activity.venueType.toLowerCase().includes(type)
                  );
                  
                  let complementaryLabel = "Grab food nearby:";
                  if (isRestaurant) {
                    complementaryLabel = "Complete the experience:";
                  } else if (isOutdoor) {
                    complementaryLabel = "Grab food nearby:";
                  }
                  
                  const isSelected = selectedVenues.some(v => v.sourceType === 'activity' && v.sourceId === activity.id);
                  
                  return (
                    <Card 
                      key={activity.id} 
                      className={`relative overflow-hidden hover-elevate transition-all flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`} 
                      data-testid={`activity-${activity.id}`}
                    >
                      {activity.photoUrl && (
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                          <img
                            src={activity.photoUrl}
                            alt={activity.venueName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVenueSelection('activity', activity.id)}
                          className="h-6 w-6 bg-white border-2"
                          data-testid={`checkbox-activity-${activity.id}`}
                        />
                      </div>
                      <button
                        className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${
                          activity.feedback === "love"
                            ? "bg-pink-500/90 hover:bg-pink-600/90"
                            : "bg-black/40 hover:bg-black/60 border-2 border-white"
                        }`}
                        onClick={(e) => {
                        e.stopPropagation();
                          if (activity.feedback === "love") {
                            // Remove feedback and delete from Favorites list
                            feedbackMutation.mutate({ activityId: activity.id, feedback: null });
                            
                            // Find the voting event with matching venueName and delete it
                            const matchingEvent = votingEvents.find(event => event.title === activity.venueName);
                            if (matchingEvent) {
                              deleteEventMutation.mutate(matchingEvent.id);
                            }
                          } else {
                            // Add feedback and add to Favorites list (only if not already there)
                            feedbackMutation.mutate({ activityId: activity.id, feedback: "love" });
                            
                            // Check if event already exists before creating
                            const eventExists = votingEvents.some(event => event.title === activity.venueName);
                            if (!eventExists) {
                              createEventMutation.mutate({
                                title: activity.venueName,
                                description: activity.description,
                                venueAddress: activity.venueAddress,
                                venueType: activity.venueType,
                                googlePlaceId: activity.googlePlaceId || undefined,
                                rating: activity.rating || undefined,
                                priceLevel: activity.priceLevel || undefined,
                                photoUrl: activity.photoUrl || undefined,
                                aiReasoning: activity.aiReasoning || undefined,
                                priceEstimate: activity.priceEstimate || undefined,
                                timeConstraints: activity.timeConstraints || undefined,
                                complementaryPlaceName: activity.complementaryPlaceName || undefined,
                                complementaryPlaceAddress: activity.complementaryPlaceAddress || undefined,
                                complementaryPlaceId: activity.complementaryPlaceId || undefined,
                                complementaryPlacePhotoUrl: activity.complementaryPlacePhotoUrl || undefined,
                                complementaryPlaceRating: activity.complementaryPlaceRating || undefined,
                                complementaryPlaceName2: activity.complementaryPlaceName2 || undefined,
                                complementaryPlaceAddress2: activity.complementaryPlaceAddress2 || undefined,
                                complementaryPlaceId2: activity.complementaryPlaceId2 || undefined,
                                complementaryPlacePhotoUrl2: activity.complementaryPlacePhotoUrl2 || undefined,
                                complementaryPlaceRating2: activity.complementaryPlaceRating2 || undefined,
                              });
                            }
                          }
                        }}
                        data-testid={`button-love-${activity.id}`}
                      >
                        <Heart 
                          className={`h-6 w-6 transition-all ${
                            activity.feedback === "love" 
                              ? "fill-white stroke-white" 
                              : "fill-none stroke-white"
                          }`} 
                          strokeWidth={2.5}
                        />
                      </button>
                      <CardHeader className="space-y-2 flex-1 flex flex-col pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base mb-1">{activity.venueName}</CardTitle>
                            <CardDescription className="line-clamp-1 text-xs">
                              {activity.description || activity.googleReview}
                            </CardDescription>
                          </div>
                          {activity.googlePlaceId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-6 px-2 flex-shrink-0"
                              data-testid={`button-google-link-${activity.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${activity.googlePlaceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="text-xs">Maps</span>
                              </a>
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activity.rating && (
                            <Badge variant="secondary" className="gap-1 text-xs" data-testid={`badge-rating-${activity.id}`}>
                              <Star className="h-3 w-3 fill-current" />
                              {activity.rating}
                              {activity.reviewCount && ` (${activity.reviewCount})`}
                            </Badge>
                          )}
                          {activity.priceLevel && (
                            <Badge variant="secondary" className="text-xs">
                              {priceDisplay(activity.priceLevel)}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{activity.venueType}</Badge>
                        </div>

                        <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{activity.venueAddress}</span>
                        </div>

                        {(activity.priceEstimate || activity.timeConstraints) && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {activity.priceEstimate && (
                              <div className="flex items-center gap-1">
                                <Ticket className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{activity.priceEstimate}</span>
                              </div>
                            )}
                            {activity.timeConstraints && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{activity.timeConstraints}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-2 border-t mt-auto">
                          <div className="flex gap-1.5">
                            <Button
                              variant={activity.feedback === "more" ? "default" : "outline"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                feedbackMutation.mutate({ activityId: activity.id, feedback: "more" });
                              }}
                              className="flex-1 gap-1 h-7 text-xs"
                              data-testid={`button-more-${activity.id}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              More
                            </Button>
                            <Button
                              variant={activity.feedback === "less" ? "default" : "outline"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                feedbackMutation.mutate({ activityId: activity.id, feedback: "less" });
                              }}
                              className="flex-1 gap-1 h-7 text-xs"
                              data-testid={`button-less-${activity.id}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                              Not this
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
            </div>

            {/* Floating Cart Badge - only visible when venues selected */}
            {selectedVenues.length > 0 && (
              <div className="fixed bottom-6 right-6 z-50" data-testid="floating-cart-badge">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="default"
                      size="lg"
                      className="shadow-lg h-14 px-4 gap-3"
                      data-testid="button-cart-trigger"
                    >
                      <div className="relative">
                        <ShoppingCart className="h-5 w-5" />
                        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-background text-foreground text-xs font-bold flex items-center justify-center border-2 border-primary">
                          {selectedVenues.length}
                        </div>
                      </div>
                      <span className="text-sm font-medium">{selectedVenues.length} Venue{selectedVenues.length !== 1 ? 's' : ''}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-96 p-0" 
                    align="end"
                    side="top"
                    sideOffset={8}
                    data-testid="cart-popover-content"
                  >
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-base mb-1">Your Itinerary Cart</h3>
                      <p className="text-xs text-muted-foreground">{selectedVenues.length} of 5 venues selected</p>
                      {(() => {
                        // Calculate total route distance
                        let totalDistance = 0;
                        let hasAllCoords = true;
                        
                        for (let i = 0; i < selectedVenues.length - 1; i++) {
                          const current = selectedVenues[i];
                          const next = selectedVenues[i + 1];
                          
                          let currentLat, currentLng, nextLat, nextLng;
                          
                          if (current.sourceType === 'activity') {
                            const activity = activities.find(a => a.id === current.sourceId);
                            currentLat = parseFloat(activity?.latitude || '0');
                            currentLng = parseFloat(activity?.longitude || '0');
                          } else {
                            const event = votingEvents.find(e => e.id === current.sourceId);
                            currentLat = parseFloat(event?.latitude || '0');
                            currentLng = parseFloat(event?.longitude || '0');
                          }
                          
                          if (next.sourceType === 'activity') {
                            const activity = activities.find(a => a.id === next.sourceId);
                            nextLat = parseFloat(activity?.latitude || '0');
                            nextLng = parseFloat(activity?.longitude || '0');
                          } else {
                            const event = votingEvents.find(e => e.id === next.sourceId);
                            nextLat = parseFloat(event?.latitude || '0');
                            nextLng = parseFloat(event?.longitude || '0');
                          }
                          
                          if (currentLat && currentLng && nextLat && nextLng) {
                            totalDistance += calculateDistance(currentLat, currentLng, nextLat, nextLng);
                          } else {
                            hasAllCoords = false;
                          }
                        }
                        
                        if (selectedVenues.length > 1 && hasAllCoords) {
                          const category = getDistanceCategory(totalDistance);
                          const colorClass = category === 'close' ? 'text-green-600 dark:text-green-400' : 
                                            category === 'moderate' ? 'text-yellow-600 dark:text-yellow-400' : 
                                            'text-red-600 dark:text-red-400';
                          return (
                            <p className={`text-xs font-medium mt-1 ${colorClass}`}>
                              Total route: {formatDistance(totalDistance)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (over && active.id !== over.id) {
                          setSelectedVenues((venues) => {
                            const oldIndex = venues.findIndex(v => `${v.sourceType}-${v.sourceId}` === active.id);
                            const newIndex = venues.findIndex(v => `${v.sourceType}-${v.sourceId}` === over.id);
                            return arrayMove(venues, oldIndex, newIndex);
                          });
                        }
                      }}
                    >
                      <SortableContext
                        items={selectedVenues.map(v => `${v.sourceType}-${v.sourceId}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="max-h-96 overflow-y-auto p-3 space-y-0">
                          {selectedVenues.map((venue, index) => {
                            const venueId = `${venue.sourceType}-${venue.sourceId}`;
                            let venueName = '';
                            let venueType = '';
                            let photoUrl = '';
                            let lat = 0, lng = 0;
                            let placeId = '';
                            
                            if (venue.sourceType === 'activity') {
                              const activity = activities.find(a => a.id === venue.sourceId);
                              venueName = activity?.venueName || 'Unknown';
                              venueType = activity?.venueType || '';
                              photoUrl = activity?.photoUrl || '';
                              lat = parseFloat(activity?.latitude || '0');
                              lng = parseFloat(activity?.longitude || '0');
                              placeId = activity?.googlePlaceId || '';
                            } else {
                              const event = votingEvents.find(e => e.id === venue.sourceId);
                              venueName = event?.title || 'Unknown';
                              venueType = event?.venueType || '';
                              photoUrl = event?.photoUrl || '';
                              lat = parseFloat(event?.latitude || '0');
                              lng = parseFloat(event?.longitude || '0');
                              placeId = event?.googlePlaceId || '';
                            }
                            
                            // Calculate distance to next venue
                            let distanceToNext = null;
                            if (index < selectedVenues.length - 1) {
                              const nextVenue = selectedVenues[index + 1];
                              let nextLat = 0, nextLng = 0;
                              
                              if (nextVenue.sourceType === 'activity') {
                                const activity = activities.find(a => a.id === nextVenue.sourceId);
                                nextLat = parseFloat(activity?.latitude || '0');
                                nextLng = parseFloat(activity?.longitude || '0');
                              } else {
                                const event = votingEvents.find(e => e.id === nextVenue.sourceId);
                                nextLat = parseFloat(event?.latitude || '0');
                                nextLng = parseFloat(event?.longitude || '0');
                              }
                              
                              if (lat && lng && nextLat && nextLng) {
                                const distance = calculateDistance(lat, lng, nextLat, nextLng);
                                distanceToNext = {
                                  distance,
                                  category: getDistanceCategory(distance)
                                };
                              }
                            }
                            
                            // Get all selected place IDs for checking if a suggestion is already selected
                            const selectedVenueIds = selectedVenues.map(v => {
                              if (v.sourceType === 'activity') {
                                return activities.find(a => a.id === v.sourceId)?.googlePlaceId;
                              } else {
                                return votingEvents.find(e => e.id === v.sourceId)?.googlePlaceId;
                              }
                            }).filter(Boolean) as string[];

                            return (
                              <SortableCartVenue
                                key={venueId}
                                id={venueId}
                                index={index}
                                venueName={venueName}
                                venueType={venueType}
                                photoUrl={photoUrl}
                                onRemove={() => toggleVenueSelection(venue.sourceType, venue.sourceId)}
                                distanceToNext={distanceToNext}
                                lat={lat}
                                lng={lng}
                                placeId={placeId}
                                groupId={groupId}
                                expandedNearbyId={expandedNearbyVenueId}
                                onToggleNearby={handleToggleNearby}
                                nearbySuggestions={venueNearbySuggestions[venueId]}
                                onAddNearby={handleAddNearby}
                                addVenueLoading={addVotingEventMutation.isPending}
                                selectedVenueIds={selectedVenueIds}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <div className="p-3 border-t flex gap-2">
                      <Button
                        onClick={() => setActiveTab("build")}
                        disabled={selectedVenues.length < 1}
                        className="flex-1"
                        size="sm"
                        data-testid="button-build-itinerary-cart"
                      >
                        Build Itinerary
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedVenues([]);
                          setAddedSuggestionPlaceIds(new Set()); // Clear tracking set
                        }}
                        variant="outline"
                        size="sm"
                        data-testid="button-clear-cart"
                      >
                        Clear
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
              </TabsContent>

              {/* Sub-tab 2: Search */}
              <TabsContent value="search" className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Search for Venues</h2>
                    <p className="text-muted-foreground mb-4">
                      Find specific places you want to add to your itinerary
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search for parks, restaurants, cafes, or any venue..."
                      value={venueSearchQuery}
                      onChange={(e) => setVenueSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-venue-search"
                    />
                  </div>

                  {/* Search Results */}
                  {venueSearchQuery.trim() && venueSearchQuery.trim().length >= 2 && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Search results for "{venueSearchQuery}"
                      </p>
                      {venueSearchResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {venueSearchResults.map((result: any) => {
                            const alreadySelected = activities.some(a => a.googlePlaceId === result.placeId) ||
                              votingEvents.some(e => e.googlePlaceId === result.placeId) ||
                              addedSuggestionPlaceIds.has(result.placeId);

                            return (
                              <button
                                key={result.placeId}
                                onClick={() => {
                                  if (alreadySelected || addVotingEventMutation.isPending) return;
                                  if (selectedVenues.length >= 5) {
                                    toast({
                                      title: "Maximum reached",
                                      description: "You can select up to 5 venues",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  addVotingEventMutation.mutate({
                                    title: result.name,
                                    venueType: result.types?.[0] || 'venue',
                                    venueAddress: result.address,
                                    googlePlaceId: result.placeId,
                                  });
                                }}
                                disabled={alreadySelected || addVotingEventMutation.isPending}
                                className={`flex gap-3 p-3 rounded-md border text-left transition-all hover-elevate active-elevate-2 ${
                                  alreadySelected || addVotingEventMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                data-testid={`search-result-${result.placeId}`}
                              >
                                {result.photoUrl && (
                                  <img 
                                    src={result.photoUrl} 
                                    alt={result.name}
                                    className="w-20 h-20 rounded object-cover flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{result.name}</p>
                                  {result.rating && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                      <span className="text-xs font-medium">{result.rating}</span>
                                      {result.reviewCount && (
                                        <span className="text-xs text-muted-foreground">({result.reviewCount})</span>
                                      )}
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {result.address}
                                  </p>
                                  {alreadySelected ? (
                                    <p className="text-xs text-muted-foreground mt-2">✓ Added to cart</p>
                                  ) : (
                                    <p className="text-xs text-primary mt-2">Click to add to cart</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center text-muted-foreground">
                            <p className="text-sm">No results found for "{venueSearchQuery}"</p>
                            <p className="text-xs mt-1">Try a different search term</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {!venueSearchQuery.trim() && (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">Start typing to search for specific venues</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try searching for "Golden Gate Park" or "pizza near Mission"
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Sub-tab 3: Favorites */}
              <TabsContent value="favorites" className="space-y-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Your Favorites</h2>
                      <p className="text-muted-foreground">
                        Vote on group favorites and select venues to add to your itinerary
                      </p>
                    </div>
                    <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="button-add-favorite-tab">
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent data-testid="dialog-add-favorite-tab">
                        <DialogHeader>
                          <DialogTitle>Add to Favorites</DialogTitle>
                          <DialogDescription>
                            Add a place you'd like your group to vote on
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="event-title-tab">Place Name</Label>
                            <Input
                              id="event-title-tab"
                              value={newEventTitle}
                              onChange={(e) => setNewEventTitle(e.target.value)}
                              placeholder="e.g., The Blue Room"
                              data-testid="input-event-title-tab"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAddEventOpen(false);
                              setNewEventTitle("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              if (newEventTitle.trim()) {
                                createEventMutation.mutate({ 
                                  title: newEventTitle,
                                  skipEnrichmentCheck: false 
                                });
                              }
                            }}
                            disabled={!newEventTitle.trim() || createEventMutation.isPending}
                            data-testid="button-save-favorite-tab"
                          >
                            {createEventMutation.isPending ? "Adding..." : "Add to Favorites"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

              {votingEvents.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Heart className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No favorites yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add venues from the Activities tab</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search favorites by name..."
                      value={favoritesSearch}
                      onChange={(e) => setFavoritesSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-favorites-search"
                    />
                  </div>

                  {(() => {
                    // Categorize voting events
                    const categorizeVenue = (venueType: string | null): 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences' => {
                      if (!venueType) return 'experiences';
                      const lower = venueType.toLowerCase();
                      
                      if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('café')) return 'cafes';
                      if (lower.includes('bar') || lower.includes('brewery') || lower.includes('wine') || lower.includes('cocktail')) return 'drinks';
                      if (lower.includes('dessert') || lower.includes('ice cream') || lower.includes('boba') || lower.includes('bakery')) return 'dessert';
                      if (lower.includes('restaurant') || lower.includes('food') || lower.includes('dining') || lower.includes('sushi') || 
                          lower.includes('pizza') || lower.includes('taco') || lower.includes('burger')) return 'meal';
                      
                      return 'experiences';
                    };

                    const categoryConfig = {
                      meal: { label: 'MEALS' },
                      cafes: { label: 'CAFES' },
                      drinks: { label: 'DRINKS' },
                      dessert: { label: 'DESSERT' },
                      experiences: { label: 'EXPERIENCES' }
                    };

                    // Filter voting events by search
                    const filteredEvents = votingEvents.filter(event => 
                      event.title.toLowerCase().includes(favoritesSearch.toLowerCase())
                    );

                    // Group voting events by category
                    const grouped = filteredEvents.reduce((acc, event) => {
                      const category = categorizeVenue(event.venueType);
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(event);
                      return acc;
                    }, {} as Record<string, typeof votingEvents>);

                    // Sort each category
                    Object.keys(grouped).forEach(category => {
                      const sortMode = categorySortMode[category] || 'rating';
                      grouped[category].sort((a, b) => {
                        if (sortMode === 'rating') {
                          const ratingA = parseFloat(a.rating || '0');
                          const ratingB = parseFloat(b.rating || '0');
                          return ratingB - ratingA;
                        } else {
                          return (b.netVotes || 0) - (a.netVotes || 0);
                        }
                      });
                    });

                    // Function to add all venues from a category
                    const addAllFromCategory = (categoryKey: string) => {
                      const categoryEvents = grouped[categoryKey];
                      if (!categoryEvents) return;
                      
                      const newSelections = categoryEvents
                        .filter(event => !selectedVenues.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id))
                        .map(event => ({ sourceType: 'voting_event' as const, sourceId: event.id }));
                      
                      const totalAfterAdd = selectedVenues.length + newSelections.length;
                      if (totalAfterAdd > 5) {
                        toast({
                          title: "Maximum 5 venues",
                          description: `You can only select up to 5 venues total`,
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      setSelectedVenues([...selectedVenues, ...newSelections]);
                    };

                    return Object.entries(categoryConfig).map(([categoryKey, config]) => {
                      const categoryEvents = grouped[categoryKey];
                      if (!categoryEvents || categoryEvents.length === 0) return null;

                      const sortMode = categorySortMode[categoryKey] || 'rating';

                      return (
                        <Card key={categoryKey}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base">{config.label}</CardTitle>
                                <Badge variant="secondary">{categoryEvents.length}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCategorySortMode({ ...categorySortMode, [categoryKey]: sortMode === 'rating' ? 'votes' : 'rating' })}
                                  data-testid={`button-sort-${categoryKey}`}
                                >
                                  <ArrowUpDown className="h-3 w-3 mr-1" />
                                  {sortMode === 'rating' ? 'Rating' : 'Votes'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addAllFromCategory(categoryKey)}
                                  data-testid={`button-add-all-${categoryKey}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add All
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {categoryEvents.map(event => {
                                const myVote = myVotes[event.id];
                                const isSelected = selectedVenues.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id);
                                
                                return (
                                  <HoverCard key={event.id}>
                                    <HoverCardTrigger asChild>
                                      <div 
                                        className="flex items-center gap-3 p-3 rounded-md border hover-elevate transition-colors cursor-pointer"
                                        data-testid={`favorites-row-${event.id}`}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleVenueSelection('voting_event', event.id)}
                                          className="h-5 w-5"
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`checkbox-favorite-${event.id}`}
                                        />
                                        
                                        {event.photoUrl && (
                                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                                            <img
                                              src={event.photoUrl}
                                              alt={event.title}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        )}
                                        
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium text-sm truncate">{event.title}</h4>
                                          {event.venueType && (
                                            <p className="text-xs text-muted-foreground truncate">{event.venueType}</p>
                                          )}
                                        </div>

                                        {event.rating && (
                                          <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                                            <Star className="h-3 w-3 fill-current" />
                                            {event.rating}
                                            {event.reviewCount && ` (${event.reviewCount})`}
                                          </Badge>
                                        )}

                                        <div className="flex items-center gap-1 shrink-0">
                                          <Badge variant="outline" className="text-xs">
                                            {event.netVotes > 0 ? '+' : ''}{event.netVotes || 0}
                                          </Badge>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <Button
                                            variant={myVote?.voteType === "upvote" ? "default" : "ghost"}
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleVote(event.id, "upvote");
                                            }}
                                            className="h-8 w-8"
                                            data-testid={`button-upvote-${event.id}`}
                                          >
                                            <ThumbsUp className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant={myVote?.voteType === "downvote" ? "default" : "ghost"}
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleVote(event.id, "downvote");
                                            }}
                                            className="h-8 w-8"
                                            data-testid={`button-downvote-${event.id}`}
                                          >
                                            <ThumbsDown className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>

                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 shrink-0"
                                              data-testid={`button-view-details-${event.id}`}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="h-3.5 w-3.5" />
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="max-w-2xl">
                                            <DialogHeader>
                                              <DialogTitle>{event.title}</DialogTitle>
                                              {event.description && (
                                                <DialogDescription>{event.description}</DialogDescription>
                                              )}
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              {event.photoUrl && (
                                                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                                                  <img
                                                    src={event.photoUrl}
                                                    alt={event.title}
                                                    className="w-full h-full object-cover"
                                                  />
                                                </div>
                                              )}
                                              
                                              <div className="grid gap-2">
                                                {event.venueAddress && (
                                                  <div className="flex items-start gap-2">
                                                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                                    <p className="text-sm">{event.venueAddress}</p>
                                                  </div>
                                                )}
                                                
                                                <div className="flex flex-wrap items-center gap-2">
                                                  {event.rating && (
                                                    <Badge variant="secondary" className="gap-1">
                                                      <Star className="h-3 w-3 fill-current" />
                                                      {event.rating}
                                                      {event.reviewCount && ` (${event.reviewCount})`}
                                                    </Badge>
                                                  )}
                                                  {event.priceLevel && (
                                                    <Badge variant="secondary">
                                                      {priceDisplay(event.priceLevel)}
                                                    </Badge>
                                                  )}
                                                  {event.venueType && (
                                                    <Badge variant="outline">{event.venueType}</Badge>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {event.googlePlaceId && (
                                                <Button
                                                  variant="outline"
                                                  asChild
                                                  className="w-full"
                                                >
                                                  <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.title)}&query_place_id=${event.googlePlaceId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <MapPin className="mr-2 h-4 w-4" />
                                                    View on Google Maps
                                                  </a>
                                                </Button>
                                              )}
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      </div>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-80" side="left">
                                      <div className="space-y-2">
                                        <h4 className="font-medium">{event.title}</h4>
                                        {event.venueAddress && (
                                          <p className="text-sm text-muted-foreground">{event.venueAddress}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                          {event.rating && (
                                            <Badge variant="secondary" className="gap-1">
                                              <Star className="h-3 w-3 fill-current" />
                                              {event.rating}
                                            </Badge>
                                          )}
                                          {event.priceLevel && (
                                            <Badge variant="secondary">
                                              {priceDisplay(event.priceLevel)}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tab 3: Itinerary */}
          <TabsContent value="build" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Create Your Itinerary</h2>
                <p className="text-muted-foreground">
                  {selectedVenues.length > 0
                    ? "Select 1-5 venues from Activities or Favorites, then click Create Itinerary"
                    : itineraries.length > 0
                      ? "Your evening itinerary is ready! Drag to reorder venues."
                      : "Switch to Activities tab to browse and select venues for your itinerary"
                  }
                </p>
              </div>

              {/* Selected Venues Display */}
              {selectedVenues.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Selected Venues ({selectedVenues.length}/5)</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => validateItineraryMutation.mutate(selectedVenues)}
                          disabled={validateItineraryMutation.isPending || selectedVenues.length < 1}
                          variant="default"
                          size="sm"
                          data-testid="button-validate-itinerary-build"
                        >
                          {validateItineraryMutation.isPending ? "Validating..." : "Create Itinerary"}
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedVenues([]);
                            setAddedSuggestionPlaceIds(new Set()); // Clear tracking set
                          }}
                          variant="outline"
                          size="sm"
                          data-testid="button-cancel-selection-build"
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedVenues.map((venue, index) => {
                      let venueName = '';
                      let venueType = '';
                      
                      if (venue.sourceType === 'activity') {
                        const activity = activities.find(a => a.id === venue.sourceId);
                        venueName = activity?.venueName || 'Unknown';
                        venueType = activity?.venueType || '';
                      } else {
                        const event = votingEvents.find(e => e.id === venue.sourceId);
                        venueName = event?.title || 'Unknown';
                        venueType = event?.venueType || '';
                      }

                      return (
                        <div
                          key={`${venue.sourceType}-${venue.sourceId}`}
                          className="flex items-center gap-3 p-2 rounded-md bg-accent/20 border"
                          data-testid={`selected-venue-build-${venue.sourceId}`}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{venueName}</p>
                            {venueType && (
                              <p className="text-xs text-muted-foreground truncate">{venueType}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVenueSelection(venue.sourceType, venue.sourceId)}
                            className="h-6 w-6 p-0"
                            data-testid={`button-remove-venue-build-${venue.sourceId}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}


              {/* Itinerary Display */}
              {itineraries.length > 0 && selectedVenues.length === 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          Your Itinerary
                        </CardTitle>
                        <CardDescription className="mt-1">
                          AI has organized your selections - drag to reorder
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (itineraries.length > 0) {
                              setSavingItineraryId(itineraries[0].id);
                              setSaveItineraryOpen(true);
                            }
                          }}
                          data-testid="button-save-itinerary"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Plan
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab("activities")}
                          data-testid="button-add-more-stops"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add More Stops
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {itineraries.map((itinerary: any) => (
                      <ItineraryDisplay key={itinerary.id} itinerary={itinerary} groupId={groupId!} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Empty State */}
              {selectedVenues.length === 0 && itineraries.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Create Your Itinerary?</h3>
                    <p className="text-muted-foreground mb-4">
                      Go to the Activities tab, browse suggestions, and click "I'm Ready, Let's Do This!" to start selecting venues
                    </p>
                    <Button onClick={() => setActiveTab("activities")} data-testid="button-go-to-activities">
                      Browse Activities
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Nearby Add-on Suggestions - Bottom Checkout Style */}
              {(selectedVenues.length > 0 || itineraries.length > 0) && nearbySuggestions.length > 0 && (() => {
                // Determine contextual message based on venue types (from selected or itinerary)
                let venueTypes: string[] = [];
                
                if (selectedVenues.length > 0) {
                  // Get types from selected venues
                  venueTypes = selectedVenues.map(venue => {
                    if (venue.sourceType === 'activity') {
                      const activity = activities.find(a => a.id === venue.sourceId);
                      return activity?.venueType?.toLowerCase() || '';
                    } else {
                      const event = votingEvents.find(e => e.id === venue.sourceId);
                      return event?.venueType?.toLowerCase() || '';
                    }
                  }).filter(Boolean);
                } else if (itineraries.length > 0) {
                  // Get types from itinerary items
                  venueTypes = itineraries[0].items?.map((item: any) => 
                    item.venueType?.toLowerCase() || ''
                  ).filter(Boolean) || [];
                }

                const hasMeal = venueTypes.some(type => 
                  type.includes('restaurant') || type.includes('food') || type.includes('meal') || 
                  type.includes('dining') || type.includes('breakfast') || type.includes('lunch') || type.includes('dinner')
                );
                const hasDrinksDessert = venueTypes.some(type => 
                  type.includes('bar') || type.includes('drink') || type.includes('cocktail') || 
                  type.includes('dessert') || type.includes('ice cream') || type.includes('boba') || type.includes('cafe')
                );

                let contextualMessage = "Round it out with these nearby spots?";
                if (hasMeal && !hasDrinksDessert) {
                  contextualMessage = "Feeling like dessert or drinks after?";
                } else if (hasDrinksDessert && !hasMeal) {
                  contextualMessage = "Want to add a meal stop?";
                }

                return (
                  <Card className="mt-8 border-2 border-primary/20 bg-primary/5" data-testid="enhanced-nearby-suggestions">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Compass className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{contextualMessage}</CardTitle>
                          <CardDescription>
                            High-rated spots within 0.5 miles • Click to add to your itinerary
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {nearbySuggestions.map((suggestion: any) => {
                        const alreadySelected = activities.some(a => a.googlePlaceId === suggestion.placeId) ||
                          votingEvents.some(e => e.googlePlaceId === suggestion.placeId) ||
                          addedSuggestionPlaceIds.has(suggestion.placeId);

                        return (
                          <button
                            key={suggestion.placeId}
                            onClick={() => {
                              if (alreadySelected || addVotingEventMutation.isPending) return;
                              if (selectedVenues.length >= 5) {
                                toast({
                                  title: "Maximum reached",
                                  description: "You can select up to 5 venues",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              addVotingEventMutation.mutate({
                                title: suggestion.name,
                                venueType: suggestion.types?.[0] || 'venue',
                                venueAddress: suggestion.address,
                                googlePlaceId: suggestion.placeId,
                              });
                            }}
                            disabled={alreadySelected || addVotingEventMutation.isPending}
                            className={`flex gap-3 p-3 rounded-md border text-left transition-all hover-elevate active-elevate-2 ${
                              alreadySelected || addVotingEventMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            data-testid={`suggestion-${suggestion.placeId}`}
                          >
                            {suggestion.photoUrl && (
                              <img 
                                src={suggestion.photoUrl} 
                                alt={suggestion.name}
                                className="w-16 h-16 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{suggestion.name}</p>
                              {suggestion.rating && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs font-medium">{suggestion.rating}</span>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {suggestion.address}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Saved Plans Section */}
              {!savedItinerariesLoading && savedItineraries.length > 0 && (
                <div className="mt-12 pt-8 border-t">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-2">Saved Plans</h3>
                    <p className="text-sm text-muted-foreground">
                      Your library of saved itineraries - send any of these to your group
                    </p>
                  </div>
                  <div className="space-y-4">
                    {savedItineraries.map((itinerary: any) => (
                      <Card key={itinerary.id} data-testid={`saved-itinerary-${itinerary.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg truncate">{itinerary.name}</CardTitle>
                              <CardDescription className="mt-1 space-y-1">
                                <div>
                                  {itinerary.items?.length || 0} {(itinerary.items?.length || 0) === 1 ? 'stop' : 'stops'}
                                </div>
                                {itinerary.timingRecommendations && (
                                  <div className="flex items-center gap-1.5 text-xs" data-testid={`timing-notes-${itinerary.id}`}>
                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{itinerary.timingRecommendations}</span>
                                  </div>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedItineraryForScheduling(itinerary);
                                  setActiveTab('schedule');
                                }}
                                data-testid={`button-schedule-itinerary-${itinerary.id}`}
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule This →
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingItinerary(itinerary);
                                  setEditItineraryName(itinerary.name || "");
                                  setEditItineraryItems(itinerary.items || []);
                                  setEditTimingRecommendations(itinerary.timingRecommendations || "");
                                  setEditItineraryOpen(true);
                                }}
                                data-testid={`button-edit-itinerary-${itinerary.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  duplicateItineraryMutation.mutate(itinerary.id);
                                }}
                                disabled={duplicateItineraryMutation.isPending}
                                data-testid={`button-duplicate-itinerary-${itinerary.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete "${itinerary.name}"?`)) {
                                    deleteSavedItineraryMutation.mutate(itinerary.id);
                                  }
                                }}
                                disabled={deleteSavedItineraryMutation.isPending}
                                data-testid={`button-delete-itinerary-${itinerary.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {itinerary.items?.map((item: any, index: number) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 p-2 rounded-md bg-accent/20 border"
                                data-testid={`saved-itinerary-item-${item.id}`}
                              >
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.venueName}</p>
                                  {item.venueType && (
                                    <p className="text-xs text-muted-foreground truncate">{item.venueType}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 4: Schedule */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Group Availability Reminder */}
              <Card data-testid="card-availability-reminder">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Group Availability</CardTitle>
                      <CardDescription>Quick reference for scheduling</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Initialize dialog with current values
                        if (group?.availability) {
                          setEditAvailabilityData(group.availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>);
                        }
                        if (group?.generalAvailability) {
                          setEditAvailabilityNotes(group.generalAvailability);
                        }
                        if (group?.meetingFrequency) {
                          const freq = group.meetingFrequency;
                          // Handle new format (e.g., "2-week")
                          if (freq.includes("-")) {
                            const [num, unit] = freq.split("-");
                            setEditMeetingFreqNumber(parseInt(num));
                            setEditMeetingFreqUnit(unit.endsWith("s") ? unit : unit + "s");
                          }
                          // Handle legacy formats
                          else if (freq === "weekly") {
                            setEditMeetingFreqNumber(1);
                            setEditMeetingFreqUnit("weeks");
                          } else if (freq === "biweekly") {
                            setEditMeetingFreqNumber(2);
                            setEditMeetingFreqUnit("weeks");
                          } else if (freq === "monthly") {
                            setEditMeetingFreqNumber(1);
                            setEditMeetingFreqUnit("months");
                          } else if (freq === "flexible") {
                            setEditMeetingFreqNumber(1);
                            setEditMeetingFreqUnit("months");
                          }
                        }
                        setEditAvailabilityOpen(true);
                      }}
                      data-testid="button-edit-availability"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {group?.availability && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">When is the group free?</p>
                        <>
                          <ReadOnlyAvailabilityGrid 
                            value={group.availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>} 
                            compact={true}
                          />
                        </>
                      </div>
                    )}
                    {group?.generalAvailability && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Additional Notes</p>
                        <p className="text-sm text-muted-foreground">{group.generalAvailability}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Meeting Frequency</p>
                      <p className="text-sm text-muted-foreground">
                        {group?.meetingFrequency ? formatMeetingFrequency(group.meetingFrequency) : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Schedule Event Section */}
              <Card data-testid="card-schedule-event">
                <CardHeader>
                  <CardTitle className="text-lg">Schedule Event</CardTitle>
                  <CardDescription>Choose a saved plan and pick a time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Itinerary Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="select-itinerary">Select a Saved Plan</Label>
                    <Select
                      value={selectedItineraryForScheduling?.id || ""}
                      onValueChange={(value) => {
                        const itinerary = savedItineraries.find((i: any) => i.id === value);
                        setSelectedItineraryForScheduling(itinerary || null);
                        setAiTimeOptions([]);
                        setSelectedTimeOptionIds([]);
                      }}
                    >
                      <SelectTrigger id="select-itinerary" data-testid="select-itinerary">
                        <SelectValue placeholder="Choose an itinerary..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedItineraries.map((itinerary: any) => (
                          <SelectItem key={itinerary.id} value={itinerary.id}>
                            {itinerary.name} ({itinerary.items?.length || 0} stops)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItineraryForScheduling && (
                    <>
                      {/* Show selected itinerary preview */}
                      <div className="space-y-2 p-3 bg-accent/10 rounded-lg border">
                        <p className="text-sm font-medium">{selectedItineraryForScheduling.name}</p>
                        <div className="space-y-1">
                          {selectedItineraryForScheduling.items?.slice(0, 3).map((item: any, index: number) => (
                            <p key={item.id} className="text-xs text-muted-foreground">
                              {index + 1}. {item.venueName}
                            </p>
                          ))}
                          {selectedItineraryForScheduling.items?.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{selectedItineraryForScheduling.items.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Scheduling Method Selection */}
                      <div className="space-y-4">
                        <Label>Choose scheduling method</Label>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              id="method-manual"
                              name="schedule-method"
                              checked={scheduleMethod === 'manual'}
                              onChange={() => {
                                setScheduleMethod('manual');
                                setAiTimeOptions([]);
                                setSelectedTimeOptionIds([]);
                              }}
                              className="mt-1"
                              data-testid="radio-manual-time"
                            />
                            <div className="flex-1">
                              <Label htmlFor="method-manual" className="cursor-pointer">I have a time/date in mind</Label>
                              {scheduleMethod === 'manual' && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label htmlFor="event-date">Date</Label>
                                    <Input
                                      id="event-date"
                                      type="date"
                                      value={eventDate}
                                      onChange={(e) => setEventDate(e.target.value)}
                                      data-testid="input-event-date"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="event-time">Time</Label>
                                    <Input
                                      id="event-time"
                                      type="time"
                                      value={eventTime}
                                      onChange={(e) => setEventTime(e.target.value)}
                                      data-testid="input-event-time"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              id="method-ai"
                              name="schedule-method"
                              checked={scheduleMethod === 'ai'}
                              onChange={() => setScheduleMethod('ai')}
                              className="mt-1"
                              data-testid="radio-ai-time"
                            />
                            <div className="flex-1">
                              <Label htmlFor="method-ai" className="cursor-pointer">AI generated time and date</Label>
                              {scheduleMethod === 'ai' && (
                                <div className="mt-3 space-y-3">
                                  {aiTimeOptions.length === 0 && !getAiTimeSuggestionMutation.isPending && (
                                    <Button
                                      onClick={() => {
                                        if (!selectedItineraryForScheduling) return;
                                        const venues = selectedItineraryForScheduling.items?.map((item: any) => ({
                                          name: item.venueName,
                                          type: item.venueType,
                                        })) || [];
                                        getAiTimeSuggestionMutation.mutate({ 
                                          itineraryId: selectedItineraryForScheduling.id, 
                                          venues 
                                        });
                                      }}
                                      className="w-full gap-2"
                                      data-testid="button-get-ai-suggestion"
                                    >
                                      <Bot className="h-4 w-4" />
                                      Get AI Suggestions
                                    </Button>
                                  )}

                                  {getAiTimeSuggestionMutation.isPending && (
                                    <div className="text-center py-4 text-sm text-muted-foreground">
                                      Analyzing group availability...
                                    </div>
                                  )}

                                  {aiTimeOptions.length > 0 && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <p className="text-sm font-medium">Select one or more times to send:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          {aiTimeOptions.map((option) => {
                                            const groupTz = group?.timezone || (group?.locationBase ? getTimezoneIdentifier(group.locationBase) : 'America/Los_Angeles');
                                            const tzName = getTimezoneName(groupTz);
                                            
                                            return (
                                            <div key={option.id} className="relative">
                                              {editingOptionId === option.id ? (
                                                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5 space-y-2">
                                                  <div className="text-xs text-muted-foreground mb-1">
                                                    Times shown in {tzName}
                                                  </div>
                                                  <Input
                                                    type="date"
                                                    value={(() => {
                                                      const utcDate = new Date(option.eventDate);
                                                      const localDate = toZonedTime(utcDate, groupTz);
                                                      const year = localDate.getFullYear();
                                                      const month = String(localDate.getMonth() + 1).padStart(2, '0');
                                                      const day = String(localDate.getDate()).padStart(2, '0');
                                                      return `${year}-${month}-${day}`;
                                                    })()}
                                                    onChange={(e) => {
                                                      const utcDate = new Date(option.eventDate);
                                                      const localDate = toZonedTime(utcDate, groupTz);
                                                      const [year, month, day] = e.target.value.split('-').map(Number);
                                                      const newLocalDate = new Date(year, month - 1, day, localDate.getHours(), localDate.getMinutes(), 0, 0);
                                                      const newUtcDate = fromZonedTime(newLocalDate, groupTz);
                                                      
                                                      setAiTimeOptions(prev => prev.map(opt => 
                                                        opt.id === option.id 
                                                          ? {
                                                              ...opt,
                                                              eventDate: newUtcDate.toISOString(),
                                                              dayLabel: toZonedTime(newUtcDate, groupTz).toLocaleDateString('en-US', { 
                                                                weekday: 'short', 
                                                                month: 'short', 
                                                                day: 'numeric',
                                                                timeZone: groupTz
                                                              }),
                                                            }
                                                          : opt
                                                      ));
                                                    }}
                                                    className="text-sm"
                                                    data-testid={`edit-date-${option.id}`}
                                                  />
                                                  <Input
                                                    type="time"
                                                    value={(() => {
                                                      const utcDate = new Date(option.eventDate);
                                                      const localDate = toZonedTime(utcDate, groupTz);
                                                      const hours = String(localDate.getHours()).padStart(2, '0');
                                                      const minutes = String(localDate.getMinutes()).padStart(2, '0');
                                                      return `${hours}:${minutes}`;
                                                    })()}
                                                    onChange={(e) => {
                                                      const utcDate = new Date(option.eventDate);
                                                      const localDate = toZonedTime(utcDate, groupTz);
                                                      const [hours, minutes] = e.target.value.split(':').map(Number);
                                                      const newLocalDate = new Date(
                                                        localDate.getFullYear(),
                                                        localDate.getMonth(),
                                                        localDate.getDate(),
                                                        hours,
                                                        minutes,
                                                        0,
                                                        0
                                                      );
                                                      const newUtcDate = fromZonedTime(newLocalDate, groupTz);
                                                      
                                                      setAiTimeOptions(prev => prev.map(opt => 
                                                        opt.id === option.id 
                                                          ? {
                                                              ...opt,
                                                              eventDate: newUtcDate.toISOString(),
                                                              timeLabel: toZonedTime(newUtcDate, groupTz).toLocaleTimeString('en-US', { 
                                                                hour: 'numeric', 
                                                                minute: '2-digit',
                                                                timeZone: groupTz
                                                              }),
                                                            }
                                                          : opt
                                                      ));
                                                    }}
                                                    className="text-sm"
                                                    data-testid={`edit-time-${option.id}`}
                                                  />
                                                  <Button
                                                    size="sm"
                                                    onClick={() => setEditingOptionId(null)}
                                                    className="w-full"
                                                    data-testid={`done-edit-${option.id}`}
                                                  >
                                                    Done
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div
                                                  onClick={() => {
                                                    setSelectedTimeOptionIds(prev => 
                                                      prev.includes(option.id)
                                                        ? prev.filter(id => id !== option.id)
                                                        : [...prev, option.id]
                                                    );
                                                  }}
                                                  className={`w-full p-3 rounded-lg border-2 cursor-pointer text-left transition-colors ${
                                                    selectedTimeOptionIds.includes(option.id)
                                                      ? 'border-primary bg-primary/5'
                                                      : 'border-border hover-elevate'
                                                  }`}
                                                  data-testid={`time-option-${option.id}`}
                                                >
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-2 flex-1">
                                                      <input
                                                        type="checkbox"
                                                        checked={selectedTimeOptionIds.includes(option.id)}
                                                        onChange={() => {}}
                                                        className="mt-0.5"
                                                        data-testid={`checkbox-time-${option.id}`}
                                                      />
                                                      <div className="flex-1">
                                                        <p className="font-medium text-sm">{option.dayLabel}</p>
                                                        <p className="text-sm text-muted-foreground">{option.timeLabel}</p>
                                                      </div>
                                                    </div>
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingOptionId(option.id);
                                                      }}
                                                      className="h-6 w-6 shrink-0"
                                                      data-testid={`edit-button-${option.id}`}
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                          })}
                                        </div>
                                        {selectedTimeOptionIds.length > 0 && (
                                          <p className="text-sm text-muted-foreground">
                                            {selectedTimeOptionIds.length} time{selectedTimeOptionIds.length === 1 ? '' : 's'} selected
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        variant="outline"
                                        onClick={async () => {
                                          setAiTimeOptions([]);
                                          setSelectedTimeOptionIds([]);
                                          if (!selectedItineraryForScheduling) return;
                                          const venues = selectedItineraryForScheduling.items?.map((item: any) => ({
                                            name: item.venueName,
                                            type: item.venueType,
                                          })) || [];
                                          await getAiTimeSuggestionMutation.mutateAsync({ 
                                            itineraryId: selectedItineraryForScheduling.id, 
                                            venues 
                                          });
                                        }}
                                        className="w-full gap-2"
                                        disabled={getAiTimeSuggestionMutation.isPending}
                                        data-testid="button-try-different-times"
                                      >
                                        <Bot className="h-4 w-4" />
                                        Get Different Options
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Send Button */}
                      <Button
                        onClick={async () => {
                          if (!selectedItineraryForScheduling) return;
                          
                          const eventDates: string[] = [];
                          
                          if (scheduleMethod === 'manual' && eventDate && eventTime) {
                            eventDates.push(`${eventDate}T${eventTime}:00`);
                          } else if (scheduleMethod === 'ai' && selectedTimeOptionIds.length > 0) {
                            const selectedOptions = aiTimeOptions.filter(opt => 
                              selectedTimeOptionIds.includes(opt.id)
                            );
                            eventDates.push(...selectedOptions.map(opt => opt.eventDate));
                          }

                          if (eventDates.length === 0) {
                            toast({
                              title: "Missing time selection",
                              description: "Please select at least one time before sending",
                              variant: "destructive",
                            });
                            return;
                          }

                          try {
                            // If multiple dates, send as array; otherwise send single eventDate
                            if (eventDates.length > 1) {
                              await sendItineraryMutation.mutateAsync({
                                itineraryId: selectedItineraryForScheduling.id,
                                eventDates,
                              });
                            } else {
                              await sendItineraryMutation.mutateAsync({
                                itineraryId: selectedItineraryForScheduling.id,
                                eventDate: eventDates[0],
                              });
                            }
                            
                            // Reset state after mutation completes
                            setAiTimeOptions([]);
                            setSelectedTimeOptionIds([]);
                            setEventDate("");
                            setEventTime("19:00");
                            setSelectedItineraryForScheduling(null);
                            setScheduleMethod('ai');
                            
                            toast({
                              title: eventDates.length === 1 ? "Plan sent to group" : "Plans sent to group",
                              description: eventDates.length === 1 
                                ? "Members can now RSVP to your itinerary"
                                : `${eventDates.length} time options sent - members can RSVP to their preferred time`,
                            });
                          } catch (error) {
                            // Error toast is handled by mutation
                          }
                        }}
                        disabled={
                          sendItineraryMutation.isPending ||
                          (scheduleMethod === 'manual' && (!eventDate || !eventTime)) ||
                          (scheduleMethod === 'ai' && selectedTimeOptionIds.length === 0)
                        }
                        className="w-full gap-2"
                        data-testid="button-send-to-group"
                      >
                        <Send className="h-4 w-4" />
                        {sendItineraryMutation.isPending 
                          ? "Sending..." 
                          : scheduleMethod === 'ai' && selectedTimeOptionIds.length > 1
                            ? `Send ${selectedTimeOptionIds.length} Time Options`
                            : "Send to Group"}
                      </Button>
                    </>
                  )}

                  {savedItineraries.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No saved plans yet. Build one in the Itinerary tab!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pending Auto-Scheduled Event - Temporarily hidden until component is added */}
              {/* {isOwner && (
                <PendingEventCard groupId={groupId} onApprove={() => queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'pending-auto-event'] })} />
              )} */}

              {/* Active Plans Section */}
              <div>
                <h2 className="text-2xl font-bold mb-2">Active Plans</h2>
                <p className="text-muted-foreground mb-4">
                  Track RSVPs for plans you've sent to the group
                </p>
              </div>

              {proposedItinerariesLoading ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">Loading active plans...</p>
                  </CardContent>
                </Card>
              ) : proposedItineraries.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Active Plans Yet</h3>
                    <p className="text-muted-foreground">
                      When you send a plan to the group, it will appear here for RSVP tracking
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {proposedItineraries.map((itinerary: any) => {
                    const userRsvp = itinerary.rsvps?.find((r: any) => r.userId === user?.id);
                    const isPlanner = itinerary.createdBy === user?.id;
                    const yesCount = itinerary.rsvps?.filter((r: any) => r.response === 'yes').length || 0;
                    const conditionalCount = itinerary.rsvps?.filter((r: any) => r.response === 'yes_with_constraint').length || 0;
                    const noCount = itinerary.rsvps?.filter((r: any) => r.response === 'no').length || 0;
                    const totalResponses = itinerary.rsvps?.length || 0;
                    
                    return (
                      <Card key={itinerary.id} data-testid={`proposed-itinerary-${itinerary.id}`} className={itinerary.status === 'scheduled' ? 'border-primary' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg truncate">
                                {itinerary.name}
                                {itinerary.status === 'scheduled' && (
                                  <Badge variant="default" className="ml-2 bg-primary">✨ The Plan</Badge>
                                )}
                                {isPlanner && itinerary.status !== 'scheduled' && <Badge variant="secondary" className="ml-2">Your Plan</Badge>}
                              </CardTitle>
                              <CardDescription className="mt-1 space-y-1">
                                <div>{itinerary.items?.length || 0} stops • {totalResponses} responses</div>
                                {itinerary.eventDate && (
                                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>
                                      {group?.timezone 
                                        ? formatInTimeZone(new Date(itinerary.eventDate), group.timezone, "EEE, MMM d 'at' h:mm a")
                                        : format(new Date(itinerary.eventDate), "EEE, MMM d 'at' h:mm a")
                                      }
                                      {group?.timezone && group.timezone !== 'America/Los_Angeles' && group.timezone !== 'America/New_York' && (
                                        <span className="text-muted-foreground ml-1">
                                          ({group.timezone.split('/')[1]?.replace('_', ' ') || 'Local'} Time)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </CardDescription>
                            </div>
                            {!isPlanner && userRsvp && (
                              <Badge variant={userRsvp.response === 'yes' ? 'default' : userRsvp.response === 'yes_with_constraint' ? 'secondary' : 'outline'}>
                                {userRsvp.response === 'yes' ? 'Yes' : userRsvp.response === 'yes_with_constraint' ? 'Yes, if...' : 'No'}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              {itinerary.items?.map((item: any, index: number) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-md bg-accent/20 border"
                                  data-testid={`proposed-itinerary-item-${item.id}`}
                                >
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.venueName}</p>
                                    {item.venueType && (
                                      <p className="text-xs text-muted-foreground truncate">{item.venueType}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Edit and Delete actions for proposed itineraries - always visible for owners */}
                            {isOwner && itinerary.status !== 'scheduled' && (
                              <div className="pt-2 border-t space-y-2">
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                      setEditingItinerary(itinerary);
                                      setEditItineraryName(itinerary.name || '');
                                      setEditItineraryItems(itinerary.items || []);
                                      setEditTimingRecommendations(itinerary.timingRecommendations || '');
                                      setEditProposedDate(itinerary.eventDate || '');
                                      setEditItineraryOpen(true);
                                    }}
                                    data-testid={`button-edit-proposed-${itinerary.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 text-destructive hover:text-destructive"
                                        data-testid={`button-delete-proposed-${itinerary.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete "{itinerary.name || 'this event'}" and remove all RSVPs. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteSavedItineraryMutation.mutate(itinerary.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          data-testid="button-confirm-delete"
                                        >
                                          Delete Event
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/itineraries/${itinerary.id}/invite-summary`, {
                                        credentials: 'include',
                                      });
                                      const data = await response.json();
                                      
                                      if (data.shareableLink) {
                                        await navigator.clipboard.writeText(data.shareableLink);
                                        setCopiedLinks(prev => ({ ...prev, [itinerary.id]: true }));
                                        setTimeout(() => {
                                          setCopiedLinks(prev => ({ ...prev, [itinerary.id]: false }));
                                        }, 2000);
                                        toast({
                                          title: "Link copied!",
                                          description: "Share this in your group chat",
                                        });
                                      } else {
                                        toast({
                                          title: "No invites sent yet",
                                          description: "This plan hasn't been sent to the group",
                                          variant: "destructive",
                                        });
                                      }
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: "Couldn't copy link",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  data-testid={`button-copy-link-${itinerary.id}`}
                                >
                                  {copiedLinks[itinerary.id] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                  {copiedLinks[itinerary.id] ? 'Copied!' : 'Copy Invite Link'}
                                </Button>
                              </div>
                            )}
                            
                            {isPlanner && totalResponses > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-sm font-medium mb-3">RSVP Summary</p>
                                <div className="space-y-3">
                                  <div className="flex gap-2 text-sm">
                                    <Badge variant="default" className="gap-1">
                                      <Check className="h-3 w-3" />
                                      {yesCount} Yes
                                    </Badge>
                                    {conditionalCount > 0 && (
                                      <Badge variant="secondary" className="gap-1">
                                        {conditionalCount} Conditional
                                      </Badge>
                                    )}
                                    {noCount > 0 && (
                                      <Badge variant="outline" className="gap-1">
                                        <X className="h-3 w-3" />
                                        {noCount} No
                                      </Badge>
                                    )}
                                  </div>

                                  {yesCount > 0 && itinerary.status !== 'scheduled' && (
                                    <Button
                                      onClick={() => finalizePlanMutation.mutate(itinerary.id)}
                                      disabled={finalizePlanMutation.isPending}
                                      className="w-full"
                                      data-testid={`button-finalize-${itinerary.id}`}
                                    >
                                      {finalizePlanMutation.isPending ? "Finalizing..." : "Finalize as The Plan"}
                                    </Button>
                                  )}

                                  {conditionalCount > 0 && (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-muted-foreground">Constraints:</p>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setBackupForItineraryId(itinerary.id);
                                            setSendBackupOpen(true);
                                          }}
                                          data-testid={`button-send-backup-${itinerary.id}`}
                                        >
                                          <Send className="h-4 w-4 mr-2" />
                                          Send Backup Plan
                                        </Button>
                                      </div>
                                      {itinerary.rsvps
                                        ?.filter((r: any) => r.response === 'yes_with_constraint')
                                        .map((rsvp: any) => (
                                          <div
                                            key={rsvp.id}
                                            className="p-2 rounded-md bg-secondary/50 border border-secondary"
                                            data-testid={`constraint-${rsvp.id}`}
                                          >
                                            <p className="text-xs font-medium">{rsvp.memberName || 'Member'}</p>
                                            <p className="text-sm mt-1">{rsvp.constraintText}</p>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {!isPlanner && !userRsvp && (
                              <div className="pt-2 border-t">
                                <p className="text-sm font-medium mb-3">Your RSVP</p>
                                <div className="flex gap-2">
                                  <Button
                                    variant="default"
                                    onClick={() => {
                                      createRsvpMutation.mutate({
                                        itineraryId: itinerary.id,
                                        response: 'yes'
                                      });
                                    }}
                                    disabled={createRsvpMutation.isPending}
                                    data-testid={`button-rsvp-yes-${itinerary.id}`}
                                  >
                                    Yes, I'm In
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setRsvpItineraryId(itinerary.id);
                                      setRsvpConstraintOpen(true);
                                    }}
                                    data-testid={`button-rsvp-conditional-${itinerary.id}`}
                                  >
                                    Yes, if...
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      createRsvpMutation.mutate({
                                        itineraryId: itinerary.id,
                                        response: 'no'
                                      });
                                    }}
                                    disabled={createRsvpMutation.isPending}
                                    data-testid={`button-rsvp-no-${itinerary.id}`}
                                  >
                                    Can't Make It
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 5: Feedback */}
          <TabsContent value="feedback" className="space-y-6">
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Share Your Feedback</CardTitle>
                <CardDescription className="text-base mt-2">
                  Coming Soon
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8">
                <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  AI learns from your group's feedback - launching soon!
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Group Dialog */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>Edit Group Details</DialogTitle>
            <DialogDescription>
              Update your group's information and preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Group Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Group Details</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-group-name">Group Name</Label>
                  <Input
                    id="edit-group-name"
                    value={editGroupData.name}
                    onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                    data-testid="input-edit-group-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-group-emoji">Group Icon</Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{editGroupData.emoji || "🎉"}</div>
                      <Input 
                        id="edit-group-emoji"
                        value={editGroupData.emoji} 
                        onChange={(e) => setEditGroupData({ ...editGroupData, emoji: e.target.value })}
                        placeholder="🎉" 
                        className="w-20 text-center text-2xl"
                        data-testid="input-edit-group-emoji"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groupEmojis.map((emoji) => (
                        <Button
                          key={emoji}
                          type="button"
                          variant={editGroupData.emoji === emoji ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditGroupData({ ...editGroupData, emoji })}
                          className="text-xl h-10 w-10 p-0"
                          data-testid={`button-edit-emoji-${emoji}`}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location Base</Label>
                  <Input
                    id="edit-location"
                    value={editGroupData.locationBase}
                    onChange={(e) => setEditGroupData({ ...editGroupData, locationBase: e.target.value })}
                    data-testid="input-edit-location"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Budget Range (per person)</Label>
                  <div className="space-y-3">
                    <Slider
                      min={0}
                      max={250}
                      step={10}
                      value={editBudgetRange}
                      onValueChange={setEditBudgetRange}
                      className="w-full"
                      data-testid="slider-edit-budget"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="font-medium" data-testid="text-edit-budget-min">
                        {editBudgetRange[0] >= 200 ? "$200+" : `$${editBudgetRange[0]}`}
                      </span>
                      <span className="font-medium" data-testid="text-edit-budget-max">
                        {editBudgetRange[1] >= 200 ? "$200+" : `$${editBudgetRange[1]}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>How Often to Meet</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={editFrequencyNumber}
                        onChange={(e) => setEditFrequencyNumber(parseInt(e.target.value) || 1)}
                        data-testid="input-edit-frequency-number"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">x each</span>
                    <Select value={editFrequencyUnit} onValueChange={setEditFrequencyUnit}>
                      <SelectTrigger className="flex-1" data-testid="select-edit-frequency-unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">day</SelectItem>
                        <SelectItem value="week">week</SelectItem>
                        <SelectItem value="month">month</SelectItem>
                        <SelectItem value="year">year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Group Availability</Label>
                  <AvailabilityGrid 
                    value={editAvailability} 
                    onChange={setEditAvailability}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-general-availability">General Availability (Optional)</Label>
                  <Input
                    id="edit-general-availability"
                    value={editGeneralAvailability}
                    onChange={(e) => setEditGeneralAvailability(e.target.value)}
                    placeholder="e.g., Weekday evenings, Weekends, Friday/Saturday nights"
                    data-testid="input-edit-general-availability"
                  />
                  <p className="text-xs text-muted-foreground">
                    Simple description to help AI pick the best time for your group
                  </p>
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Group Preferences</h3>
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base">How willing is your group to try new things?</Label>
                  <div className="space-y-3">
                    <div className="text-center text-sm text-muted-foreground">
                      Group Openness to New Experiences
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[editNovelty]}
                      onValueChange={(value) => setEditNovelty(value[0])}
                      className="w-full"
                      data-testid="slider-edit-novelty"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>We like our usual spots</span>
                      <span>Open sometimes</span>
                      <span>Always up for new things!</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">What types of activities interest your group?</Label>
                  <p className="text-sm text-muted-foreground">Select all that apply (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {activityCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <Button
                          key={category.id}
                          type="button"
                          variant={editCategories.includes(category.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleEditCategory(category.id)}
                          className="gap-1.5"
                          data-testid={`button-edit-category-${category.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{category.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-past-preferences">What Has Your Group Enjoyed in the Past?</Label>
                  <Textarea
                    id="edit-past-preferences"
                    value={editGroupData.pastPreferences}
                    onChange={(e) => setEditGroupData({ ...editGroupData, pastPreferences: e.target.value })}
                    placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                    className="resize-none h-24"
                    data-testid="textarea-edit-past-preferences"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-additional-instructions">Additional Instructions for AI (Optional)</Label>
                  <Textarea
                    id="edit-additional-instructions"
                    value={editGroupData.additionalInstructions}
                    onChange={(e) => setEditGroupData({ ...editGroupData, additionalInstructions: e.target.value })}
                    placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating, avoid crowded places..."
                    className="resize-none h-24"
                    data-testid="textarea-edit-additional-instructions"
                  />
                </div>
              </div>
            </div>

            {/* Members Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Members</h3>
              
              {/* Existing Members */}
              {members.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current Members</Label>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name || "Member"}</p>
                          {member.email && (
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          )}
                        </div>
                        {member.isOrganizer ? (
                          <Badge variant="secondary" className="text-xs">Organizer</Badge>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.name || member.email || "this member"} from the group?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMemberMutation.mutate(member.id)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Members */}
              {newMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">New Members to Add</Label>
                  {newMembers.map((member, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          placeholder="Name (optional)"
                          value={member.name}
                          onChange={(e) => updateNewMember(index, "name", e.target.value)}
                          data-testid={`input-new-member-name-${index}`}
                        />
                        <Input
                          type="email"
                          placeholder="Email (optional)"
                          value={member.email}
                          onChange={(e) => updateNewMember(index, "email", e.target.value)}
                          data-testid={`input-new-member-email-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeNewMember(index)}
                        data-testid={`button-remove-new-member-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNewMember}
                className="w-full"
                data-testid="button-add-new-member"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateGroup} 
              disabled={updateGroupMutation.isPending}
              data-testid="button-save-group"
            >
              {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Itinerary Dialog */}
      <Dialog open={saveItineraryOpen} onOpenChange={setSaveItineraryOpen}>
        <DialogContent data-testid="dialog-save-itinerary">
          <DialogHeader>
            <DialogTitle>Save Itinerary</DialogTitle>
            <DialogDescription>
              Name it yourself or let AI create a name based on your venues
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itinerary-name">Itinerary Name (optional)</Label>
              <Input
                id="itinerary-name"
                placeholder="Leave blank for AI to name it (e.g., 'Dinner at Ryoko's - Oakland')"
                value={itineraryName}
                onChange={(e) => setItineraryName(e.target.value)}
                data-testid="input-itinerary-name"
              />
            </div>
            
            <Collapsible open={timingNotesOpen} onOpenChange={setTimingNotesOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 px-0"
                  data-testid="button-toggle-timing-notes"
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${timingNotesOpen ? 'rotate-90' : ''}`} />
                  <span className="text-sm text-muted-foreground">Add timing notes (optional)</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <Label htmlFor="timing-recommendations" className="text-xs text-muted-foreground">
                  When does this plan work best?
                </Label>
                <Textarea
                  id="timing-recommendations"
                  placeholder="e.g., 'Best for Saturday brunch' or 'Sunday when there's a Monday holiday'"
                  value={timingRecommendations}
                  onChange={(e) => setTimingRecommendations(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-timing-recommendations"
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSaveItineraryOpen(false);
                setItineraryName("");
                setTimingRecommendations("");
                setTimingNotesOpen(false);
                setSavingItineraryId(null);
              }}
              data-testid="button-cancel-save-itinerary"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (savingItineraryId) {
                  saveItineraryMutation.mutate({
                    itineraryId: savingItineraryId,
                    name: itineraryName.trim(),
                    timingRecommendations: timingRecommendations.trim() || undefined,
                  });
                }
              }}
              disabled={saveItineraryMutation.isPending}
              data-testid="button-confirm-save-itinerary"
            >
              {saveItineraryMutation.isPending ? "Saving..." : "Save Itinerary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RSVP Constraint Dialog */}
      <Dialog 
        open={rsvpConstraintOpen} 
        onOpenChange={(open) => {
          setRsvpConstraintOpen(open);
          if (!open) {
            setRsvpItineraryId(null);
            setConstraintText("");
          }
        }}
      >
        <DialogContent data-testid="dialog-rsvp-constraint">
          <DialogHeader>
            <DialogTitle>Conditional RSVP</DialogTitle>
            <DialogDescription>
              Let the group know what would make this work for you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="constraint-text">Your Constraint</Label>
              <Input
                id="constraint-text"
                placeholder="e.g., only if we meet in Oakland, only if we start after 7pm"
                value={constraintText}
                onChange={(e) => setConstraintText(e.target.value)}
                data-testid="input-constraint-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRsvpConstraintOpen(false);
                setRsvpItineraryId(null);
                setConstraintText("");
              }}
              data-testid="button-cancel-constraint"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rsvpItineraryId && constraintText.trim()) {
                  createRsvpMutation.mutate({
                    itineraryId: rsvpItineraryId,
                    response: 'yes_with_constraint',
                    constraintText: constraintText.trim()
                  });
                }
              }}
              disabled={!constraintText.trim() || createRsvpMutation.isPending}
              data-testid="button-confirm-constraint"
            >
              {createRsvpMutation.isPending ? "Submitting..." : "Submit RSVP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Backup Dialog */}
      <Dialog 
        open={sendBackupOpen} 
        onOpenChange={(open) => {
          setSendBackupOpen(open);
          if (!open) {
            setBackupForItineraryId(null);
            setSelectedBackupId(null);
          }
        }}
      >
        <DialogContent data-testid="dialog-send-backup">
          <DialogHeader>
            <DialogTitle>Send Backup Plan</DialogTitle>
            <DialogDescription>
              Select an alternative plan to send to members with location constraints
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {savedItineraries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No saved plans available. Save a plan first to send it as a backup.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Backup Plan</Label>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {savedItineraries.map((itinerary: any) => (
                    <button
                      key={itinerary.id}
                      onClick={() => setSelectedBackupId(itinerary.id)}
                      className={`w-full text-left p-3 rounded-md border transition-all hover-elevate active-elevate-2 ${
                        selectedBackupId === itinerary.id ? 'border-primary bg-primary/10' : ''
                      }`}
                      data-testid={`backup-option-${itinerary.id}`}
                    >
                      <p className="text-sm font-medium">{itinerary.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {itinerary.items?.length || 0} stops
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSendBackupOpen(false);
                setBackupForItineraryId(null);
                setSelectedBackupId(null);
              }}
              data-testid="button-cancel-backup"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBackupId && backupForItineraryId) {
                  sendBackupMutation.mutate({
                    savedItineraryId: selectedBackupId,
                    originalItineraryId: backupForItineraryId
                  });
                }
              }}
              disabled={!selectedBackupId || sendBackupMutation.isPending}
              data-testid="button-confirm-backup"
            >
              {sendBackupMutation.isPending ? "Sending..." : "Send Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Itinerary Dialog */}
      <Dialog 
        open={editItineraryOpen} 
        onOpenChange={(open) => {
          setEditItineraryOpen(open);
          if (!open) {
            setEditingItinerary(null);
            setEditItineraryName("");
            setEditItineraryItems([]);
            setEditTimingRecommendations("");
            setEditProposedDate("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-itinerary">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Update the plan name, add new venues, reorder, or remove venues
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Name Input */}
            <div className="space-y-3">
              <Label htmlFor="edit-itinerary-name">Plan Name</Label>
              <Input
                id="edit-itinerary-name"
                value={editItineraryName}
                onChange={(e) => setEditItineraryName(e.target.value)}
                placeholder="Enter plan name"
                data-testid="input-edit-itinerary-name"
              />
            </div>

            {/* Event Date/Time Input */}
            {editingItinerary?.eventDate && (
              <div className="space-y-3">
                <Label htmlFor="edit-event-date">Event Date & Time</Label>
                <Input
                  id="edit-event-date"
                  type="datetime-local"
                  value={editProposedDate ? (
                    group?.timezone 
                      ? formatInTimeZone(new Date(editProposedDate), group.timezone, "yyyy-MM-dd'T'HH:mm")
                      : format(new Date(editProposedDate), "yyyy-MM-dd'T'HH:mm")
                  ) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const dateString = e.target.value; // Format: "2025-10-23T19:30"
                      if (group?.timezone) {
                        // Parse components from the datetime-local string
                        const [datePart, timePart] = dateString.split('T');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hour, minute] = timePart.split(':').map(Number);
                        
                        // Create Date with these components - they become the viewer's local time
                        // but fromZonedTime will use these component values as the group's timezone
                        const wallTime = new Date(year, month - 1, day, hour, minute);
                        
                        // fromZonedTime interprets the Date's local components as being in the specified timezone
                        const utcTime = fromZonedTime(wallTime, group.timezone);
                        setEditProposedDate(utcTime.toISOString());
                      } else {
                        setEditProposedDate(new Date(dateString).toISOString());
                      }
                    } else {
                      setEditProposedDate('');
                    }
                  }}
                  data-testid="input-edit-event-date"
                />
                <p className="text-xs text-muted-foreground">
                  {group?.timezone ? `Times shown in ${group.timezone.split('/')[1]?.replace('_', ' ') || 'group\'s local'} time` : 'Times shown in your local time'}
                </p>
              </div>
            )}

            {/* Timing Notes Input */}
            <div className="space-y-3">
              <Label htmlFor="edit-timing-recommendations">Timing Notes (optional)</Label>
              <Textarea
                id="edit-timing-recommendations"
                value={editTimingRecommendations}
                onChange={(e) => setEditTimingRecommendations(e.target.value)}
                placeholder="e.g., 'Best for Saturday lunch, 12:00-2:00 PM'"
                className="min-h-[80px]"
                data-testid="textarea-edit-timing-recommendations"
              />
            </div>

            {/* Venues List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Venues ({editItineraryItems.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddVenueDialogOpen(true)}
                  data-testid="button-add-venue"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Venue
                </Button>
              </div>
              {editItineraryItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No venues in this plan
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event;
                    if (over && active.id !== over.id) {
                      const oldIndex = editItineraryItems.findIndex((item: any) => item.id === active.id);
                      const newIndex = editItineraryItems.findIndex((item: any) => item.id === over.id);
                      const newItems = arrayMove(editItineraryItems, oldIndex, newIndex);
                      setEditItineraryItems(newItems);
                    }
                  }}
                >
                  <SortableContext
                    items={editItineraryItems.map((item: any) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {editItineraryItems.map((item: any, index: number) => (
                        <SortableItineraryItem
                          key={item.id}
                          item={item}
                          index={index}
                          onRemove={() => {
                            setEditItineraryItems(prev => prev.filter(i => i.id !== item.id));
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditItineraryOpen(false)}
              data-testid="button-cancel-edit-itinerary"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingItinerary) return;
                if (!editItineraryName.trim()) {
                  toast({
                    title: "Name required",
                    description: "Please enter a name for the plan",
                    variant: "destructive",
                  });
                  return;
                }
                if (editItineraryItems.length === 0) {
                  toast({
                    title: "No venues",
                    description: "Please add at least one venue to the plan",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Prepare updates
                const proposedOrder = editItineraryItems.map((item: any) => item.sourceId);
                const updates: any = {
                  name: editItineraryName.trim(),
                  proposedOrder,
                  timingRecommendations: editTimingRecommendations.trim() || null,
                };
                
                // Include eventDate if it was edited
                if (editingItinerary.eventDate && editProposedDate) {
                  updates.eventDate = editProposedDate;
                }
                
                updateItineraryMutation.mutate({
                  itineraryId: editingItinerary.id,
                  updates,
                });
              }}
              disabled={updateItineraryMutation.isPending || !editItineraryName.trim() || editItineraryItems.length === 0}
              data-testid="button-save-edit-itinerary"
            >
              {updateItineraryMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Venue to Itinerary Dialog */}
      <Dialog open={addVenueDialogOpen} onOpenChange={setAddVenueDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-venue">
          <DialogHeader>
            <DialogTitle>Add Venues to Plan</DialogTitle>
            <DialogDescription>
              Select venues from your activities and voting events
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Activities */}
            {activities.length > 0 && (
              <div className="space-y-3">
                <Label>AI Suggested Activities</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activities.map((activity: Activity) => {
                    const isAlreadyInPlan = editItineraryItems.some((item: any) => item.sourceType === 'activity' && item.sourceId === activity.id);
                    const isSelected = venuesToAdd.some(v => v.sourceType === 'activity' && v.sourceId === activity.id);
                    
                    return (
                      <div
                        key={activity.id}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                          isAlreadyInPlan ? 'opacity-50 cursor-not-allowed' :
                          isSelected ? 'border-primary bg-primary/10 hover-elevate' : 'hover-elevate active-elevate-2 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isAlreadyInPlan) return;
                          if (isSelected) {
                            setVenuesToAdd(prev => prev.filter(v => !(v.sourceType === 'activity' && v.sourceId === activity.id)));
                          } else {
                            setVenuesToAdd(prev => [...prev, { sourceType: 'activity', sourceId: activity.id }]);
                          }
                        }}
                        data-testid={`add-venue-activity-${activity.id}`}
                      >
                        <Checkbox 
                          checked={isSelected}
                          disabled={isAlreadyInPlan}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{activity.venueName}</p>
                          <p className="text-sm text-muted-foreground truncate">{activity.venueType}</p>
                        </div>
                        {isAlreadyInPlan && (
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
                  {votingEvents.map((event: VotingEvent) => {
                    const isAlreadyInPlan = editItineraryItems.some((item: any) => item.sourceType === 'voting_event' && item.sourceId === event.id);
                    const isSelected = venuesToAdd.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id);
                    
                    return (
                      <div
                        key={event.id}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                          isAlreadyInPlan ? 'opacity-50 cursor-not-allowed' :
                          isSelected ? 'border-primary bg-primary/10 hover-elevate' : 'hover-elevate active-elevate-2 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isAlreadyInPlan) return;
                          if (isSelected) {
                            setVenuesToAdd(prev => prev.filter(v => !(v.sourceType === 'voting_event' && v.sourceId === event.id)));
                          } else {
                            setVenuesToAdd(prev => [...prev, { sourceType: 'voting_event', sourceId: event.id }]);
                          }
                        }}
                        data-testid={`add-venue-event-${event.id}`}
                      >
                        <Checkbox 
                          checked={isSelected}
                          disabled={isAlreadyInPlan}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{event.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{event.venueType || 'Venue'}</p>
                        </div>
                        {isAlreadyInPlan && (
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
              onClick={() => {
                setAddVenueDialogOpen(false);
                setVenuesToAdd([]);
              }}
              data-testid="button-cancel-add-venue"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingItinerary || venuesToAdd.length === 0) return;
                addItineraryItemsMutation.mutate({
                  itineraryId: editingItinerary.id,
                  items: venuesToAdd
                });
              }}
              disabled={venuesToAdd.length === 0 || addItineraryItemsMutation.isPending}
              data-testid="button-confirm-add-venue"
            >
              {addItineraryItemsMutation.isPending ? "Adding..." : `Add ${venuesToAdd.length} Venue${venuesToAdd.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Availability Dialog */}
      <Dialog open={editAvailabilityOpen} onOpenChange={setEditAvailabilityOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-availability">
          <DialogHeader>
            <DialogTitle>Edit Group Availability</DialogTitle>
            <DialogDescription>
              Update when the group is typically free to meet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Availability Grid */}
            <div className="space-y-3">
              <Label>When is the group free?</Label>
              <AvailabilityGrid 
                value={editAvailabilityData} 
                onChange={setEditAvailabilityData}
              />
            </div>

            {/* Meeting Frequency */}
            <div className="space-y-3">
              <Label>Meeting Frequency</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="1"
                  value={editMeetingFreqNumber}
                  onChange={(e) => setEditMeetingFreqNumber(parseInt(e.target.value) || 1)}
                  className="w-20"
                  data-testid="input-frequency-number"
                />
                <Select
                  value={editMeetingFreqUnit}
                  onValueChange={setEditMeetingFreqUnit}
                >
                  <SelectTrigger className="flex-1" data-testid="select-frequency-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">days</SelectItem>
                    <SelectItem value="weeks">weeks</SelectItem>
                    <SelectItem value="months">months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-3">
              <Label htmlFor="edit-availability-notes">Additional Notes (Optional)</Label>
              <Input
                id="edit-availability-notes"
                value={editAvailabilityNotes}
                onChange={(e) => setEditAvailabilityNotes(e.target.value)}
                placeholder="e.g., Prefer evenings after 6pm"
                data-testid="input-availability-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditAvailabilityOpen(false)}
              data-testid="button-cancel-edit-availability"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const meetingFrequency = `${editMeetingFreqNumber}-${editMeetingFreqUnit.replace(/s$/, '')}`;
                updateGroupMutation.mutate({
                  updates: {
                    availability: editAvailabilityData,
                    generalAvailability: editAvailabilityNotes.trim() || null,
                    meetingFrequency
                  },
                  newMembers: []
                });
                setEditAvailabilityOpen(false);
              }}
              disabled={updateGroupMutation.isPending}
              data-testid="button-save-availability"
            >
              {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swipe Session Dialog */}
      {groupId && (
        <SwipeSession
          groupId={groupId}
          open={showSwipeSession}
          onOpenChange={setShowSwipeSession}
          onComplete={() => {
            setShowSwipeSession(false);
            toast({
              title: "Preferences refined!",
              description: "Your feedback will improve future suggestions.",
            });
          }}
        />
      )}
    </div>
  );
}
