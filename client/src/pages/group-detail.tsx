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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus, Heart, Plus, X, ChevronDown, ChevronRight, ChevronLeft, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, UtensilsCrossed, ChefHat, Croissant, Beer, ShoppingBasket, Palette, Film, Laugh, GraduationCap, Target, GripVertical, CheckCircle2, Circle, XCircle, ShoppingCart, Search, ArrowUpDown, Save, Send, Bot, Bell, Edit2, Edit, Compass, Home, UserCheck, MessageCircle, TrendingUp, AlertCircle, Users, Loader2, Map, Info, MoreVertical } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { ReadOnlyAvailabilityGrid } from "@/components/ReadOnlyAvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { FavoritesMap } from "@/components/FavoritesMap";
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
import EmojiPicker from 'emoji-picker-react';

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
  { id: "family", label: "Family Activities", icon: Users },
];

function formatMeetingFrequency(freq: string): string {
  // Handle old format
  if (freq === "weekly") return "Every week";
  if (freq === "biweekly") return "Every 2 weeks";
  if (freq === "monthly") return "Every month";
  if (freq === "flexible") return "Flexible";
  
  // Handle new format "2x week" or old format "2-week"
  if (freq.includes("x ") || freq.includes("-")) {
    const parts = freq.includes("x ") ? freq.split("x ") : freq.split("-");
    const [num, unit] = parts;
    const number = parseInt(num);
    // Remove 's' if plural for consistency
    const singularUnit = unit?.trim().endsWith("s") ? unit.trim().slice(0, -1) : unit?.trim() || "week";
    
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
              <div
                key={suggestion.placeId}
                className={`flex gap-2 p-2 rounded-md border transition-all ${
                  alreadyAdded || addVenueLoading ? 'opacity-50' : 'hover-elevate'
                }`}
                data-testid={`nearby-suggestion-${suggestion.placeId}`}
              >
                <button
                  onClick={() => onAddNearby(suggestion)}
                  disabled={alreadyAdded || addVenueLoading}
                  className="flex gap-2 flex-1 min-w-0 text-left"
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
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-auto px-1 py-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${suggestion.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
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
  
  // Parse URL search params for auto-opening edit dialog
  const urlParams = new URLSearchParams(window.location.search);
  const editItineraryIdFromUrl = urlParams.get('edit');
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editBudgetRange, setEditBudgetRange] = useState<number[]>([50, 250]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
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
    additionalInstructions: "",
    mealEnabled: true,
    cafeEnabled: true,
    drinksEnabled: true,
    dessertEnabled: true,
    experiencesEnabled: true
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
  
  // Pagination state for each category
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({
    meal: 0,
    cafes: 0,
    drinks: 0,
    dessert: 0,
    experiences: 0,
  });

  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [categorySortMode, setCategorySortMode] = useState<Record<string, 'rating' | 'votes'>>({});
  const [activitiesSubTab, setActivitiesSubTab] = useState("ai-suggested");
  const [groupSubTab, setGroupSubTab] = useState("details");
  const [myPreferencesBudget, setMyPreferencesBudget] = useState<{ min: number; max: number } | null>(null);
  const [myPreferencesCategories, setMyPreferencesCategories] = useState<string[] | null>(null);
  const [myPreferencesAvailability, setMyPreferencesAvailability] = useState<any>(null);
  const [myPreferencesMeetingFrequency, setMyPreferencesMeetingFrequency] = useState<{ number: number; unit: string } | null>(null);
  const [myPreferencesMeetingFrequencyOriginal, setMyPreferencesMeetingFrequencyOriginal] = useState<string | null>(null);
  const [hoveredFavoriteId, setHoveredFavoriteId] = useState<string | null>(null);
  const [showFavoritesMap, setShowFavoritesMap] = useState(false);
  const [favoriteToDelete, setFavoriteToDelete] = useState<VotingEvent | null>(null);
  const [editFavoriteOpen, setEditFavoriteOpen] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<VotingEvent | null>(null);
  const [editFavoriteData, setEditFavoriteData] = useState({
    title: "",
    description: "",
    venueType: "",
    priceLevel: ""
  });
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateEventData, setDuplicateEventData] = useState<any>(null);
  const [existingDuplicate, setExistingDuplicate] = useState<VotingEvent | null>(null);
  const [addedSuggestionPlaceIds, setAddedSuggestionPlaceIds] = useState<Set<string>>(new Set());
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [debouncedVenueSearchQuery, setDebouncedVenueSearchQuery] = useState("");
  const [addMoreStopsOpen, setAddMoreStopsOpen] = useState(false);
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
  const [dialogVenueSearchQuery, setDialogVenueSearchQuery] = useState("");
  const [debouncedDialogSearchQuery, setDebouncedDialogSearchQuery] = useState("");
  const [expandedNearbyVenueId, setExpandedNearbyVenueId] = useState<string | null>(null);
  const [venueNearbySuggestions, setVenueNearbySuggestions] = useState<Record<string, any[]>>({});
  
  // Guest invitation state
  const [inviteGuestDialogOpen, setInviteGuestDialogOpen] = useState(false);
  const [inviteGuestItineraryId, setInviteGuestItineraryId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  
  // Emoji picker state for inline group edit
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  
  // Category-specific generation state
  const [selectedCategories, setSelectedCategories] = useState<('meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences')[]>([]);
  const [categoryLocation, setCategoryLocation] = useState("");
  const [categoryRadius, setCategoryRadius] = useState<number>(2);
  const [categoryResults, setCategoryResults] = useState<any[]>([]);
  const [multiVenueMode, setMultiVenueMode] = useState(false);
  
  // Natural language scheduling state
  const [schedulePromptDialogOpen, setSchedulePromptDialogOpen] = useState(false);
  const [schedulePrompt, setSchedulePrompt] = useState("");
  const [schedulePromptLoading, setSchedulePromptLoading] = useState(false);
  
  // Auto-refresh state for countdowns
  const [, forceUpdate] = useState(0);

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

  // Fetch pending auto-scheduled events
  const { data: pendingAutoEvents = [], isLoading: pendingAutoEventsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "auto-scheduled-events"],
    enabled: !!groupId,
  });

  // Fetch feedback summary
  const { data: feedbackSummary, isLoading: feedbackLoading } = useQuery<any>({
    queryKey: ["/api/groups", groupId, "feedback-summary"],
    enabled: !!groupId && !!user,
  });

  // Fetch post-event feedback summary
  const { data: postEventFeedbackSummary, isLoading: postEventFeedbackLoading } = useQuery<any>({
    queryKey: ["/api/groups", groupId, "post-event-feedback-summary"],
    enabled: !!groupId && !!user,
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

  // Dialog venue search query
  const { data: dialogVenueSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", groupId, "search-venues-dialog", debouncedDialogSearchQuery.trim()],
    queryFn: async () => {
      if (!debouncedDialogSearchQuery.trim() || debouncedDialogSearchQuery.trim().length < 2) {
        return [];
      }
      const response = await fetch(`/api/groups/${groupId}/search-venues?query=${encodeURIComponent(debouncedDialogSearchQuery.trim())}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!groupId && addVenueDialogOpen && debouncedDialogSearchQuery.trim().length >= 2,
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
        if (elapsed > 300000) {
          // 300 seconds (5 minutes) elapsed - force status to failed
          console.warn("AI generation timed out after 300 seconds");
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

  // Debounce dialog venue search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDialogSearchQuery(dialogVenueSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [dialogVenueSearchQuery]);

  // Auto-refresh countdowns every minute
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-open edit dialog when URL contains ?edit=<itineraryId>
  useEffect(() => {
    if (editItineraryIdFromUrl && proposedItineraries.length > 0 && !editItineraryOpen) {
      const itinerary = proposedItineraries.find((it: any) => it.id === editItineraryIdFromUrl);
      if (itinerary) {
        setEditingItinerary(itinerary);
        setEditItineraryName(itinerary.name || "");
        setEditItineraryItems(itinerary.items || []);
        setEditTimingRecommendations(itinerary.timingRecommendations || "");
        setEditProposedDate(itinerary.eventDate || "");
        setEditItineraryOpen(true);
        
        // Clear URL parameter after opening (optional - keeps URL cleaner)
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [editItineraryIdFromUrl, proposedItineraries, editItineraryOpen]);

  // Fetch member group preferences
  const { data: memberPreferences } = useQuery({
    queryKey: ["/api/groups", groupId, "my-preferences"],
    enabled: !!user && !!groupId,
  });

  // Update member group preferences
  const updateMyPreferencesMutation = useMutation({
    mutationFn: async (preferences: { budgetOverrideMin?: number | null; budgetOverrideMax?: number | null; categoryPreferencesOverride?: string[] | null; availabilityOverride?: any; meetingFrequencyOverride?: string | null }) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}/my-preferences`, preferences);
    },
    onSuccess: (data, variables) => {
      // Update local state immediately from the saved values
      if (variables.budgetOverrideMin !== undefined && variables.budgetOverrideMax !== undefined) {
        if (variables.budgetOverrideMin !== null && variables.budgetOverrideMax !== null) {
          setMyPreferencesBudget({ min: variables.budgetOverrideMin, max: variables.budgetOverrideMax });
        } else {
          setMyPreferencesBudget(null);
        }
      }
      if (variables.categoryPreferencesOverride !== undefined) {
        setMyPreferencesCategories(variables.categoryPreferencesOverride);
      }
      if (variables.availabilityOverride !== undefined) {
        setMyPreferencesAvailability(variables.availabilityOverride);
      }
      
      toast({
        title: "Preferences saved",
        description: "Your preferences for this group have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-preferences"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving preferences",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize my preferences from fetched data
  useEffect(() => {
    if (memberPreferences) {
      // Handle both camelCase and snake_case from API
      const budgetMin = (memberPreferences as any).budgetOverrideMin ?? (memberPreferences as any).budget_override_min;
      const budgetMax = (memberPreferences as any).budgetOverrideMax ?? (memberPreferences as any).budget_override_max;
      
      if (budgetMin !== undefined && budgetMax !== undefined && 
          budgetMin !== null && budgetMax !== null) {
        setMyPreferencesBudget({ min: budgetMin, max: budgetMax });
      } else {
        setMyPreferencesBudget(null);
      }
      
      const categories = (memberPreferences as any).categoryPreferencesOverride ?? (memberPreferences as any).category_preferences_override;
      setMyPreferencesCategories(categories || null);
      
      const availability = (memberPreferences as any).availabilityOverride ?? (memberPreferences as any).availability_override;
      setMyPreferencesAvailability(availability || null);
      
      const meetingFreq = (memberPreferences as any).meetingFrequencyOverride ?? (memberPreferences as any).meeting_frequency_override;
      if (meetingFreq) {
        // Store the original value to preserve it if user doesn't edit
        setMyPreferencesMeetingFrequencyOriginal(meetingFreq);
        
        // Handle both legacy and new frequency formats for display
        if (meetingFreq === "weekly") {
          setMyPreferencesMeetingFrequency({ number: 1, unit: 'weeks' });
        } else if (meetingFreq === "biweekly") {
          setMyPreferencesMeetingFrequency({ number: 2, unit: 'weeks' });
        } else if (meetingFreq === "monthly") {
          setMyPreferencesMeetingFrequency({ number: 1, unit: 'months' });
        } else if (meetingFreq === "flexible") {
          setMyPreferencesMeetingFrequency({ number: 1, unit: 'months' });
        } else if (meetingFreq.includes("x ")) {
          // New format: "{number}x {unit}"
          const match = meetingFreq.match(/^(\d+)x\s+(\w+)$/);
          if (match) {
            const [, num, unit] = match;
            const normalizedUnit = unit.endsWith('s') ? unit : unit + 's';
            setMyPreferencesMeetingFrequency({ number: parseInt(num, 10), unit: normalizedUnit });
          } else {
            // Invalid format, clear state
            setMyPreferencesMeetingFrequency(null);
            setMyPreferencesMeetingFrequencyOriginal(null);
          }
        } else if (meetingFreq.includes("-")) {
          // Old format: "{number}-{unit}"
          const parts = meetingFreq.split("-");
          if (parts.length === 2) {
            const [num, unit] = parts;
            const normalizedUnit = unit.trim().endsWith('s') ? unit.trim() : unit.trim() + 's';
            setMyPreferencesMeetingFrequency({ number: parseInt(num, 10), unit: normalizedUnit });
          } else {
            setMyPreferencesMeetingFrequency(null);
            setMyPreferencesMeetingFrequencyOriginal(null);
          }
        } else {
          // Unknown format, clear state
          setMyPreferencesMeetingFrequency(null);
          setMyPreferencesMeetingFrequencyOriginal(null);
        }
      } else {
        setMyPreferencesMeetingFrequency(null);
        setMyPreferencesMeetingFrequencyOriginal(null);
      }
    }
  }, [memberPreferences]);

  // Initialize form fields from group data when it loads
  useEffect(() => {
    if (group) {
      setEditGroupData({
        name: group.name,
        emoji: group.emoji || "🎉",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || "",
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true
      });
      setEditBudgetRange([group.budgetMin, group.budgetMax]);
      setEditCloseness(group.closenessLevel);
      setEditNovelty(group.noveltyPreference);
      setEditCategories(group.activityCategories || []);
      
      // Parse meeting frequency - handle both old ("1-week") and new ("1x week") formats
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
      } else if (freq && (freq.includes("-") || freq.includes("x "))) {
        // Handle both formats: "2-week" (old) and "2x week" (new)
        const parts = freq.includes("x ") ? freq.split("x ") : freq.split("-");
        const [num, unit] = parts;
        const parsedNum = parseInt(num) || 1;
        // Convert old plural forms to singular
        let singularUnit = unit?.trim() || "week";
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

  // Initialize selectedCategories from group preferences
  useEffect(() => {
    if (group && selectedCategories.length === 0) {
      const initialCategories: ('meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences')[] = [];
      
      if (group.mealEnabled) initialCategories.push('meal');
      if (group.cafeEnabled) initialCategories.push('cafes');
      if (group.drinksEnabled) initialCategories.push('drinks');
      if (group.dessertEnabled) initialCategories.push('dessert');
      if (group.experiencesEnabled) initialCategories.push('experiences');
      
      setSelectedCategories(initialCategories);
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

  // ARCHIVED: General AI generation mutation (Nov 2025)
  // Replaced with category-specific generation
  /*
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
  */

  const generateCategoryMutation = useMutation({
    mutationFn: async ({ categories, location, radius, sortBy, tempInstructions }: { categories: string[]; location?: { address: string; lat: number; lng: number }; radius?: number; sortBy?: 'distance' | 'rating'; tempInstructions?: string }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/generate-category`, {
        categories,
        location,
        radius,
        count: 9,
        sortBy: sortBy || 'rating',
        tempInstructions: tempInstructions?.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      // Clear old results and set new ones
      setCategoryResults(data);
      setTempInstructions(""); // Clear the temp instructions after use
      const totalResults = Array.isArray(data) ? data.length : Object.values(data).flat().length;
      toast({
        title: "Generated suggestions",
        description: `Found ${totalResults} venues across ${selectedCategories.length} ${selectedCategories.length === 1 ? 'category' : 'categories'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
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

  const inviteGuestMutation = useMutation({
    mutationFn: async ({ itineraryId, guestName, guestEmail, response }: { itineraryId: string; guestName: string; guestEmail: string; response: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/guest-rsvp`, {
        guestName,
        guestEmail,
        response,
      });
    },
    onSuccess: () => {
      toast({
        title: "Guest invited!",
        description: "Guest RSVP has been added to the event.",
      });
      // Reset form
      setGuestName("");
      setGuestEmail("");
      setInviteGuestDialogOpen(false);
      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error inviting guest",
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

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}/automation`, {
        [field]: value
      });
    },
    onMutate: async ({ field, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/groups", groupId] });
      
      // Snapshot the previous value
      const previousGroup = queryClient.getQueryData(["/api/groups", groupId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(["/api/groups", groupId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          [field]: value
        };
      });
      
      // Return context with the snapshot
      return { previousGroup };
    },
    onSuccess: (_, variables) => {
      const fieldNames: Record<string, string> = {
        autoActivitiesEnabled: "Auto-generate Activities",
        autoItineraryEnabled: "Auto-create Itinerary Drafts",
        autoScheduleEnabled: "Auto-schedule Events",
        meal_enabled: "Meals",
        cafe_enabled: "Cafes",
        drinks_enabled: "Drinks",
        dessert_enabled: "Dessert",
        experiences_enabled: "Experiences"
      };
      const isCategoryToggle = variables.field.endsWith('_enabled');
      const title = isCategoryToggle 
        ? (variables.value ? "Category enabled" : "Category disabled")
        : (variables.value ? "Automation enabled" : "Automation disabled");
      toast({
        title,
        description: `${fieldNames[variables.field]} ${variables.value ? 'turned on' : 'turned off'}`,
      });
    },
    onError: (error: Error, _, context) => {
      // Roll back to previous value on error
      if (context?.previousGroup) {
        queryClient.setQueryData(["/api/groups", groupId], context.previousGroup);
      }
      toast({
        title: "Error updating automation",
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

  const createActivityFromCategoryResultMutation = useMutation({
    mutationFn: async ({ activityData, googlePlaceId }: { activityData: any; googlePlaceId: string }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/activities/from-category-result`, {
        activityData,
      });
    },
    onSuccess: (_data, variables) => {
      // Refresh voting events since we created a new favorite
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      
      // Update local categoryResults to mark this item as favorited
      // Match on either googlePlaceId or placeId since variables.googlePlaceId could be either
      setCategoryResults(prev => {
        if (Array.isArray(prev)) {
          return prev.map(result => {
            if (variables.googlePlaceId && 
                (result.googlePlaceId === variables.googlePlaceId || 
                 result.placeId === variables.googlePlaceId)) {
              return { ...result, feedback: "love" };
            }
            return result;
          });
        }
        // If it's grouped by category (object), update within each category
        if (typeof prev === 'object' && prev !== null) {
          const updated: any = {};
          for (const [category, venues] of Object.entries(prev)) {
            updated[category] = (venues as any[]).map((result: any) => {
              if (variables.googlePlaceId && 
                  (result.googlePlaceId === variables.googlePlaceId || 
                   result.placeId === variables.googlePlaceId)) {
                return { ...result, feedback: "love" };
              }
              return result;
            });
          }
          return updated;
        }
        return prev;
      });
      
      toast({
        title: "Added to favorites",
        description: "Your group can now vote on this venue",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding to favorites",
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
  });

  const toggleHostingMutation = useMutation({
    mutationFn: async ({ memberId, openToHosting }: { memberId: string; openToHosting: boolean }) => {
      return await apiRequest("PATCH", `/api/members/${memberId}/hosting-toggle`, { openToHosting });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      toast({
        title: variables.openToHosting ? "Hosting enabled" : "Hosting disabled",
        description: variables.openToHosting 
          ? "Member is now open to hosting events" 
          : "Member will no longer be asked to host events",
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
      photoUrl: suggestion.photoUrl,
      rating: suggestion.rating,
      reviewCount: suggestion.reviewCount,
      priceLevel: suggestion.priceLevel,
      latitude: suggestion.location?.lat?.toString(),
      longitude: suggestion.location?.lng?.toString(),
      city: suggestion.city,
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
      allowDuplicate?: boolean;
    }) => {
      if (!groupId) {
        throw new Error("Group ID is required");
      }

      // Custom fetch to handle 409 duplicates specially
      const res = await fetch("/api/voting-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, ...eventData }),
        credentials: "include",
      });

      if (res.status === 409) {
        // Parse duplicate response
        const data = await res.json();
        throw { isDuplicate: true, ...data };
      }

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
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
    onError: (error: any, variables) => {
      if (error.isDuplicate) {
        // Show duplicate dialog
        setExistingDuplicate(error.existingEvent);
        setDuplicateEventData(variables);
        setDuplicateDialogOpen(true);
      } else {
        toast({
          title: "Error adding event",
          description: error.message || "Failed to add favorite",
          variant: "destructive",
        });
      }
    },
  });

  const addVotingEventMutation = useMutation({
    mutationFn: async (eventData: {
      title: string;
      venueAddress?: string;
      venueType?: string;
      googlePlaceId?: string;
      photoUrl?: string;
      rating?: string;
      reviewCount?: number;
      priceLevel?: string;
      latitude?: string;
      longitude?: string;
      city?: string;
      addToCart?: boolean; // Flag to control whether to add to cart
      showToast?: boolean; // Flag to control toast display
      allowDuplicate?: boolean; // Allow override for duplicates
    }) => {
      if (!groupId) {
        throw new Error("Group ID is required");
      }

      // Custom fetch to handle 409 duplicates
      const res = await fetch("/api/voting-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: eventData.title,
          venueAddress: eventData.venueAddress,
          venueType: eventData.venueType,
          googlePlaceId: eventData.googlePlaceId,
          photoUrl: eventData.photoUrl,
          rating: eventData.rating,
          reviewCount: eventData.reviewCount,
          priceLevel: eventData.priceLevel,
          latitude: eventData.latitude,
          longitude: eventData.longitude,
          city: eventData.city,
          skipEnrichmentCheck: true,
          allowDuplicate: eventData.allowDuplicate
        }),
        credentials: "include",
      });

      if (res.status === 409) {
        const data = await res.json();
        throw { isDuplicate: true, ...data };
      }

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    onSuccess: (data: { event?: any }, variables) => {
      if (data.event) {
        // Track placeId only on success to allow retries on failure
        if (variables.googlePlaceId) {
          setAddedSuggestionPlaceIds(prev => new Set(Array.from(prev).concat(variables.googlePlaceId!)));
        }
        
        // Only add to cart if explicitly requested
        if (variables.addToCart) {
          setSelectedVenues(prev => [...prev, {
            sourceType: 'voting_event',
            sourceId: data.event.id
          }]);
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
        
        // Show toast based on context
        if (variables.showToast !== false) {
          toast({
            title: variables.addToCart ? "Added to itinerary" : "Added to favorites",
            description: variables.addToCart 
              ? "Venue has been added to your selection" 
              : "Added to your group's voting list",
          });
        }
      }
    },
    onError: (error: any, variables) => {
      if (error.isDuplicate) {
        // For duplicates, just show a toast since this is from AI suggestions
        toast({
          title: "Already in favorites",
          description: `"${variables.title}" is already in your favorites list`,
        });
      } else {
        toast({
          title: "Error adding venue",
          description: error.message || "Failed to add venue",
          variant: "destructive",
        });
      }
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

  const deleteItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members/me/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setEditItineraryOpen(false);
      setEditingItinerary(null);
      toast({
        title: "Event deleted",
        description: "The event has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting event",
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
      setFavoriteToDelete(null);
      toast({
        title: "Favorite deleted",
        description: "The favorite has been removed from your list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing event",
        description: error.message,
        variant: "destructive",
      });
      setFavoriteToDelete(null);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/voting-events/${eventId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      setEditFavoriteOpen(false);
      setEditingFavorite(null);
      toast({
        title: "Favorite updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating favorite",
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

  const openEditFavorite = (event: VotingEvent) => {
    setEditingFavorite(event);
    setEditFavoriteData({
      title: event.title,
      description: event.description || "",
      venueType: event.venueType || "",
      priceLevel: event.priceLevel || ""
    });
    setEditFavoriteOpen(true);
  };

  const handleSaveEditFavorite = () => {
    if (!editingFavorite) return;

    updateEventMutation.mutate({
      eventId: editingFavorite.id,
      updates: {
        groupId: editingFavorite.groupId,
        title: editFavoriteData.title,
        description: editFavoriteData.description || null,
        venueType: editFavoriteData.venueType || null,
        priceLevel: editFavoriteData.priceLevel || null
      }
    });
  };

  const openEditGroup = () => {
    if (group) {
      setEditGroupData({
        name: group.name,
        emoji: group.emoji || "🎉",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || "",
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true
      });
      setEditBudgetRange([group.budgetMin, group.budgetMax]);
      setEditCloseness(group.closenessLevel);
      setEditNovelty(group.noveltyPreference);
      setEditCategories(group.activityCategories || []);
      
      // Parse meeting frequency - handle both old ("1-week") and new ("1x week") formats
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
      } else if (freq && (freq.includes("-") || freq.includes("x "))) {
        // Handle both formats: "2-week" (old) and "2x week" (new)
        const parts = freq.includes("x ") ? freq.split("x ") : freq.split("-");
        const [num, unit] = parts;
        const parsedNum = parseInt(num) || 1;
        // Convert old plural forms to singular
        let singularUnit = unit?.trim() || "week";
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
      meetingFrequency: `${editFrequencyNumber}x ${editFrequencyUnit}`,
      closenessLevel: editCloseness,
      noveltyPreference: editNovelty,
      activityCategories: editCategories.length > 0 ? editCategories : undefined,
      availability: editAvailability,
      generalAvailability: editGeneralAvailability.trim() || undefined,
      mealEnabled: editGroupData.mealEnabled,
      cafeEnabled: editGroupData.cafeEnabled,
      drinksEnabled: editGroupData.drinksEnabled,
      dessertEnabled: editGroupData.dessertEnabled,
      experiencesEnabled: editGroupData.experiencesEnabled,
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
    // Handle PRICE_LEVEL_X format from curated venues
    if (level.startsWith('PRICE_LEVEL_')) {
      const levelMap: Record<string, number> = {
        'PRICE_LEVEL_FREE': 0,
        'PRICE_LEVEL_INEXPENSIVE': 1,
        'PRICE_LEVEL_MODERATE': 2,
        'PRICE_LEVEL_EXPENSIVE': 3,
        'PRICE_LEVEL_VERY_EXPENSIVE': 4,
      };
      const count = levelMap[level];
      // If unknown enum value, return original string as fallback
      if (count === undefined) {
        return level;
      }
      return count === 0 ? 'Free' : "$".repeat(count);
    }
    
    // Handle $ symbols from API (already formatted)
    if (level.startsWith('$')) {
      return level;
    }
    
    // Handle numeric strings (legacy format)
    const count = parseInt(level) || 0;
    return count === 0 ? 'Free' : "$".repeat(Math.max(1, count));
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
            <TabsTrigger value="home" data-testid="tab-home">Home</TabsTrigger>
            <TabsTrigger value="preferences" data-testid="tab-preferences">Group</TabsTrigger>
            <TabsTrigger value="activities" data-testid="tab-activities">Activities</TabsTrigger>
            <TabsTrigger value="build" data-testid="tab-build">Create Event</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Insights</TabsTrigger>
          </TabsList>

          {/* Home Tab */}
          <TabsContent value="home" className="space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Schedule Event Button */}
              <div className="flex justify-center">
                <Button
                  onClick={() => setSchedulePromptDialogOpen(true)}
                  size="lg"
                  className="gap-2"
                  data-testid="button-schedule-event"
                >
                  <Sparkles className="h-5 w-5" />
                  Schedule Event with AI
                </Button>
              </div>

              {/* Auto-Scheduling Info Card */}
              {group?.autoScheduleEnabled && group?.nextEventDueDate && (
                <Card className="border-primary/50 bg-primary/5" data-testid="card-next-auto-event">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Next Auto-Scheduled Event</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const nextDue = new Date(group.nextEventDueDate);
                      const now = new Date();
                      const msUntil = nextDue.getTime() - now.getTime();
                      const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
                      const daysUntil = Math.floor(msUntil / (1000 * 60 * 60 * 24));
                      const willTriggerSoon = daysUntil <= 10 && daysUntil >= 0;
                      
                      // Format time remaining
                      let timeRemainingText = '';
                      if (msUntil < 0) {
                        timeRemainingText = 'Overdue';
                      } else if (hoursUntil < 24) {
                        const minutesRemaining = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));
                        timeRemainingText = hoursUntil === 0 
                          ? `${minutesRemaining}m away` 
                          : `${hoursUntil}h ${minutesRemaining}m away`;
                      } else {
                        timeRemainingText = `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`;
                      }
                      
                      return (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">
                                Target: {nextDue.toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {timeRemainingText}
                              </p>
                            </div>
                            {willTriggerSoon && (
                              <Badge variant="default" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Creating soon
                              </Badge>
                            )}
                          </div>
                          
                          {willTriggerSoon ? (
                            <div className="text-xs text-muted-foreground bg-background/50 rounded-md p-3 space-y-1">
                              <p className="font-medium">Auto-scheduling activates 10 days before target:</p>
                              <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Event created from saved plans or favorites</li>
                                <li>48-hour window for members to volunteer as host</li>
                                <li>If no volunteers, event automatically sends</li>
                              </ol>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Auto-scheduling activates 10 days before the target date
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {(() => {
                const now = new Date();
                
                // Combine saved and proposed itineraries for the Home tab
                const allItineraries = [...savedItineraries, ...proposedItineraries];
                
                // Active plans (saved but not scheduled yet)
                const activePlans = savedItineraries
                  .filter(i => i.status === 'saved')
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                
                // Upcoming events (scheduled in the future)
                const upcomingEvents = proposedItineraries
                  .filter(i => i.status === 'proposed' && i.eventDate && new Date(i.eventDate) > now)
                  .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
                
                // Past events (scheduled in the past)
                const pastEvents = proposedItineraries
                  .filter(i => i.status === 'proposed' && i.eventDate && new Date(i.eventDate) <= now)
                  .sort((a, b) => new Date(b.eventDate!).getTime() - new Date(a.eventDate!).getTime())
                  .slice(0, 5); // Show last 5 past events
                
                const nextEvent = upcomingEvents[0];
                const hasAnyContent = activePlans.length > 0 || upcomingEvents.length > 0 || pastEvents.length > 0;

                if (!hasAnyContent) {
                  return (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Get started by creating your first event for this group
                        </p>
                        <Button 
                          onClick={() => setActiveTab('build')}
                          data-testid="button-create-first-event"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Event
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <>
                    {/* Pending Auto-Scheduled Events */}
                    {pendingAutoEvents.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            Pending Auto-Events
                          </h2>
                        </div>
                        <div className="grid gap-4">
                          {pendingAutoEvents.map((autoEvent: any) => {
                            const autoSendTime = new Date(autoEvent.autoSendAt);
                            const msUntilAutoSend = autoSendTime.getTime() - now.getTime();
                            const hoursUntilAutoSend = Math.max(0, Math.floor(msUntilAutoSend / (1000 * 60 * 60)));
                            const minutesUntilAutoSend = Math.max(0, Math.floor((msUntilAutoSend % (1000 * 60 * 60)) / (1000 * 60)));
                            
                            // Format countdown text
                            let countdownText = '';
                            let countdownBadge = '';
                            if (msUntilAutoSend <= 0) {
                              countdownText = 'Auto-sending now';
                              countdownBadge = 'Sending';
                            } else if (hoursUntilAutoSend < 1) {
                              countdownText = `Auto-send in ${minutesUntilAutoSend}m unless someone volunteers`;
                              countdownBadge = `${minutesUntilAutoSend}m left`;
                            } else if (hoursUntilAutoSend < 24) {
                              countdownText = `Auto-send in ${hoursUntilAutoSend}h ${minutesUntilAutoSend}m unless someone volunteers`;
                              countdownBadge = `${hoursUntilAutoSend}h left`;
                            } else {
                              const daysLeft = Math.floor(hoursUntilAutoSend / 24);
                              countdownText = `Auto-send in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} unless someone volunteers`;
                              countdownBadge = `${daysLeft}d left`;
                            }
                            
                            const itinerary = autoEvent.itinerary;
                            
                            return (
                              <Card key={autoEvent.id} data-testid={`card-pending-auto-event-${autoEvent.id}`} className="border-primary/50 bg-primary/5">
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h3 className="font-semibold">{itinerary?.name || 'Auto-Generated Event'}</h3>
                                          <Badge variant="secondary" className="gap-1 text-xs">
                                            <Clock className="h-3 w-3" />
                                            {countdownBadge}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          Proposed: {new Date(autoEvent.proposedDate).toLocaleDateString('en-US', { 
                                            weekday: 'short',
                                            month: 'short', 
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                        {itinerary?.items && itinerary.items.length > 0 && (
                                          <div className="space-y-1">
                                            {itinerary.items.slice(0, 2).map((item: any, idx: number) => (
                                              <p key={item.id} className="text-xs text-muted-foreground">
                                                {idx + 1}. {item.venueName}
                                              </p>
                                            ))}
                                            {itinerary.items.length > 2 && (
                                              <p className="text-xs text-muted-foreground">
                                                +{itinerary.items.length - 2} more
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <Button 
                                          variant="default" 
                                          size="sm"
                                          className="gap-1"
                                          data-testid={`button-volunteer-host-${autoEvent.id}`}
                                        >
                                          <UserCheck className="h-4 w-4" />
                                          Volunteer to Host
                                        </Button>
                                        {isOwner && (
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            data-testid={`button-edit-auto-event-${autoEvent.id}`}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-xs bg-background/50 rounded-md p-2 border-l-2 border-primary">
                                      <p className="text-muted-foreground">
                                        <strong>48-hour volunteer window:</strong> {countdownText}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active Plans (Not Scheduled Yet) */}
                    {activePlans.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold">Active Plans</h2>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setActiveTab('build')}
                            data-testid="button-view-all-plans"
                          >
                            View All Plans
                          </Button>
                        </div>
                        <div className="grid gap-4">
                          {activePlans.map((plan) => (
                            <Card key={plan.id} data-testid={`card-active-plan-${plan.id}`} className="border-primary/30">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{plan.name}</h3>
                                      <Badge variant="secondary" className="gap-1 text-xs">
                                        <Clock className="h-3 w-3" />
                                        Ready to Schedule
                                      </Badge>
                                    </div>
                                    <p className="text-sm mb-2">
                                      {plan.items.length} venue{plan.items.length !== 1 ? 's' : ''}
                                    </p>
                                    {plan.items.slice(0, 2).map((item: any, idx: number) => {
                                      const venue = item.sourceType === 'activity' 
                                        ? activities.find(a => a.id === item.sourceId)
                                        : votingEvents.find(v => v.id === item.sourceId);
                                      
                                      if (!venue) return null;
                                      
                                      const venueName = 'venueName' in venue ? venue.venueName : venue.title;
                                      
                                      return (
                                        <p key={item.id} className="text-xs text-muted-foreground">
                                          {idx + 1}. {venueName}
                                        </p>
                                      );
                                    })}
                                    {plan.items.length > 2 && (
                                      <p className="text-xs text-muted-foreground">
                                        +{plan.items.length - 2} more
                                      </p>
                                    )}
                                  </div>
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    onClick={() => setActiveTab('schedule')}
                                    data-testid={`button-schedule-plan-${plan.id}`}
                                  >
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Schedule
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Next Event Hero */}
                    {nextEvent && (() => {
                      // Calculate RSVP counts - separate members from guests
                      const memberRsvps = nextEvent.rsvps?.filter((r: any) => !r.isGuest) || [];
                      const guestRsvps = nextEvent.rsvps?.filter((r: any) => r.isGuest) || [];
                      
                      const memberYes = memberRsvps.filter((r: any) => r.response === 'yes').length;
                      // Handle both 'maybe' and legacy 'yes_with_constraint'
                      const memberConditional = memberRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length;
                      const totalMemberAttending = memberYes + memberConditional;
                      
                      const guestYes = guestRsvps.filter((r: any) => r.response === 'yes').length;
                      const guestConditional = guestRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length;
                      const totalGuestAttending = guestYes + guestConditional;
                      
                      const totalAttending = totalMemberAttending + totalGuestAttending;
                      
                      // Get first venue for primary location
                      const firstItem = nextEvent.items?.[0];
                      const firstVenue = firstItem ? (
                        firstItem.sourceType === 'activity' 
                          ? activities.find(a => a.id === firstItem.sourceId)
                          : votingEvents.find(v => v.id === firstItem.sourceId)
                      ) : null;
                      const firstVenueName = firstVenue ? ('venueName' in firstVenue ? firstVenue.venueName : firstVenue.title) : null;
                      const googlePlaceId = firstVenue?.googlePlaceId;
                      
                      return (
                        <Card className="border-primary/20 bg-primary/5">
                          <CardHeader>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                  <Calendar className="h-5 w-5" />
                                  Next Event
                                </CardTitle>
                                <CardDescription className="space-y-1 mt-1">
                                  <div className="font-medium text-base">
                                    {formatInTimeZone(
                                      new Date(nextEvent.eventDate!), 
                                      group.timezone || 'America/Los_Angeles',
                                      "EEEE, MMMM d 'at' h:mm a"
                                    )}
                                  </div>
                                  {firstVenueName && (
                                    <div className="flex items-start gap-1.5 text-sm">
                                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium">{firstVenueName}</span>
                                        {firstVenue?.venueAddress && (
                                          <span className="text-muted-foreground block truncate">{firstVenue.venueAddress}</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {totalAttending > 0 && (
                                    <div className="flex items-center gap-1.5 text-sm">
                                      <Users className="h-4 w-4" />
                                      {totalGuestAttending > 0 ? (
                                        <span>
                                          {totalMemberAttending} {totalMemberAttending === 1 ? 'member' : 'members'} + {totalGuestAttending} {totalGuestAttending === 1 ? 'guest' : 'guests'} attending
                                          {(memberConditional + guestConditional) > 0 && (
                                            <span className="text-muted-foreground"> ({memberConditional + guestConditional} conditional)</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span>
                                          {totalMemberAttending} {totalMemberAttending === 1 ? 'person' : 'people'} attending
                                          {memberConditional > 0 && (
                                            <span className="text-muted-foreground"> ({memberConditional} conditional)</span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </CardDescription>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                {nextEvent.hostMemberId && (
                                  <Badge variant="outline" className="gap-1">
                                    <UserCheck className="h-3 w-3" />
                                    Hosted by {members.find(m => m.id === nextEvent.hostMemberId)?.name || 'Member'}
                                  </Badge>
                                )}
                                {googlePlaceId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      window.open(`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${googlePlaceId}`, '_blank');
                                    }}
                                    className="gap-1.5"
                                    data-testid="button-open-google-maps"
                                  >
                                    <MapPin className="h-3.5 w-3.5" />
                                    Open in Maps
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        <CardContent className="space-y-4">
                          <h3 className="font-semibold text-lg">{nextEvent.name}</h3>
                          
                          {/* Venues */}
                          <div className="space-y-2">
                            {nextEvent.items.slice(0, 3).map((item: any, idx: number) => {
                              const venue = item.sourceType === 'activity' 
                                ? activities.find(a => a.id === item.sourceId)
                                : votingEvents.find(v => v.id === item.sourceId);
                              
                              if (!venue) return null;
                              
                              const venueName = 'venueName' in venue ? venue.venueName : venue.title;
                              
                              return (
                                <div key={item.id} className="flex items-start gap-3 p-3 bg-background rounded-lg">
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">{venueName}</p>
                                    {venue.venueAddress && (
                                      <p className="text-sm text-muted-foreground truncate">{venue.venueAddress}</p>
                                    )}
                                  </div>
                                  {venue.rating && (
                                    <Badge variant="secondary" className="gap-1 flex-shrink-0">
                                      <Star className="h-3 w-3 fill-current" />
                                      {venue.rating}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                            {nextEvent.items.length > 3 && (
                              <p className="text-sm text-muted-foreground text-center">
                                +{nextEvent.items.length - 3} more venue{nextEvent.items.length - 3 !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <Button 
                              size="sm"
                              onClick={() => {
                                setActiveTab('schedule');
                              }}
                              data-testid="button-view-event-details"
                            >
                              View Details
                            </Button>
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const inviteUrl = `${window.location.origin}/rsvp/${nextEvent.id}`;
                                navigator.clipboard.writeText(inviteUrl);
                                toast({ title: "Invite link copied!" });
                              }}
                              data-testid="button-copy-invite-link"
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </Button>
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setInviteGuestItineraryId(nextEvent.id);
                                setInviteGuestDialogOpen(true);
                              }}
                              data-testid="button-invite-guests"
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Invite Guests
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    })()}

                    {/* Upcoming Events */}
                    {upcomingEvents.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">Upcoming Events</h2>
                        <div className="grid gap-4">
                          {upcomingEvents.map((event) => {
                            // Extract first venue details
                            const firstItem = event.items[0];
                            const firstVenue = firstItem?.sourceType === 'activity' 
                              ? activities.find(a => a.id === firstItem.sourceId)
                              : votingEvents.find(v => v.id === firstItem.sourceId);
                            const firstVenueName = firstVenue ? ('venueName' in firstVenue ? firstVenue.venueName : firstVenue.title) : '';
                            const googlePlaceId = firstVenue?.googlePlaceId;
                            
                            // Calculate RSVP counts - separate members from guests
                            const memberRsvps = event.rsvps?.filter((r: any) => !r.isGuest) || [];
                            const guestRsvps = event.rsvps?.filter((r: any) => r.isGuest) || [];
                            
                            const memberYes = memberRsvps.filter((r: any) => r.response === 'yes').length;
                            // Handle both 'maybe' and legacy 'yes_with_constraint'
                            const memberConditional = memberRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length;
                            const totalMemberAttending = memberYes + memberConditional;
                            
                            const guestYes = guestRsvps.filter((r: any) => r.response === 'yes').length;
                            const guestConditional = guestRsvps.filter((r: any) => r.response === 'maybe' || r.response === 'yes_with_constraint').length;
                            const totalGuestAttending = guestYes + guestConditional;
                            
                            const totalAttending = totalMemberAttending + totalGuestAttending;

                            return (
                              <Card key={event.id} data-testid={`card-upcoming-event-${event.id}`}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">{event.name}</CardTitle>
                                        {event.hostMemberId && (
                                          <Badge variant="outline" className="gap-1 text-xs">
                                            <UserCheck className="h-3 w-3" />
                                            {members.find(m => m.id === event.hostMemberId)?.name || 'Hosted'}
                                          </Badge>
                                        )}
                                      </div>
                                      <CardDescription className="space-y-2">
                                        <div className="font-medium text-base">
                                          {formatInTimeZone(
                                            new Date(event.eventDate!), 
                                            group.timezone || 'America/Los_Angeles',
                                            "EEE, MMM d 'at' h:mm a"
                                          )}
                                        </div>
                                        {firstVenueName && (
                                          <div className="flex items-start gap-1.5 text-sm">
                                            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                              <span className="font-medium">{firstVenueName}</span>
                                              {firstVenue?.venueAddress && (
                                                <span className="text-muted-foreground block truncate">{firstVenue.venueAddress}</span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {totalAttending > 0 && (
                                          <div className="flex items-center gap-1.5 text-sm">
                                            <Users className="h-4 w-4" />
                                            {totalGuestAttending > 0 ? (
                                              <span>
                                                {totalMemberAttending} {totalMemberAttending === 1 ? 'member' : 'members'} + {totalGuestAttending} {totalGuestAttending === 1 ? 'guest' : 'guests'} attending
                                                {(memberConditional + guestConditional) > 0 && (
                                                  <span className="text-muted-foreground"> ({memberConditional + guestConditional} conditional)</span>
                                                )}
                                              </span>
                                            ) : (
                                              <span>
                                                {totalMemberAttending} {totalMemberAttending === 1 ? 'person' : 'people'} attending
                                                {memberConditional > 0 && (
                                                  <span className="text-muted-foreground"> ({memberConditional} conditional)</span>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                      {googlePlaceId && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            window.open(`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${googlePlaceId}`, '_blank');
                                          }}
                                          className="gap-1.5"
                                          data-testid={`button-open-google-maps-${event.id}`}
                                        >
                                          <MapPin className="h-3.5 w-3.5" />
                                          Open in Maps
                                        </Button>
                                      )}
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setActiveTab('schedule')}
                                        data-testid={`button-view-upcoming-${event.id}`}
                                      >
                                        View Details
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Past Events */}
                    {pastEvents.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">Recent Past Events</h2>
                        <div className="grid gap-4">
                          {pastEvents.map((event) => (
                            <Card key={event.id} className="opacity-75" data-testid={`card-past-event-${event.id}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{event.name}</h3>
                                      {event.hostMemberId && (
                                        <Badge variant="outline" className="gap-1 text-xs">
                                          <UserCheck className="h-3 w-3" />
                                          {members.find(m => m.id === event.hostMemberId)?.name || 'Hosted'}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {formatInTimeZone(
                                        new Date(event.eventDate!), 
                                        group.timezone || 'America/Los_Angeles',
                                        "EEE, MMM d, yyyy 'at' h:mm a"
                                      )}
                                    </p>
                                    <p className="text-sm">
                                      {event.items.length} venue{event.items.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setActiveTab('feedback')}
                                    data-testid={`button-feedback-past-${event.id}`}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Feedback
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </TabsContent>

          {/* Tab 2: Group */}
          <TabsContent value="preferences" className="space-y-6">
            <Tabs value={groupSubTab} onValueChange={setGroupSubTab}>
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="details" data-testid="subtab-group-details">
                  <Settings className="h-4 w-4 mr-2" />
                  Group Settings
                </TabsTrigger>
                <TabsTrigger value="my-preferences" data-testid="subtab-my-preferences">
                  <UserCheck className="h-4 w-4 mr-2" />
                  My Preferences
                </TabsTrigger>
              </TabsList>

              {/* Subtab 1: Group Details */}
              <TabsContent value="details" className="space-y-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Group Details Section */}
                  <Card className="border-primary/20">
                    <CardHeader className="bg-primary/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Settings className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Group Settings
                            <Badge variant="outline" className="text-xs font-normal">
                              For Everyone
                            </Badge>
                          </CardTitle>
                          <CardDescription>Configure settings that apply to all members</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Label htmlFor="edit-location">Location Base</Label>
                      <Input
                        id="edit-location"
                        value={editGroupData.locationBase}
                        onChange={(e) => setEditGroupData({ ...editGroupData, locationBase: e.target.value })}
                        data-testid="input-edit-location"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="inline-group-emoji">Group Icon</Label>
                    <div className="flex items-center gap-3">
                      <div className="text-5xl" data-testid="text-selected-emoji">{editGroupData.emoji || "🎉"}</div>
                      <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={true}>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            data-testid="button-choose-emoji"
                          >
                            Choose emoji 🙂
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="overflow-hidden rounded-lg">
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setEditGroupData({ ...editGroupData, emoji: emojiData.emoji });
                                setEmojiPickerOpen(false);
                              }}
                              width={350}
                              height={400}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Budget + Meeting Frequency - side by side on desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label>Budget Range (per person)</Label>
                      <div className="space-y-3">
                        <div className="relative">
                          <Slider
                            min={0}
                            max={250}
                            step={10}
                            value={editBudgetRange}
                            onValueChange={setEditBudgetRange}
                            className="w-full"
                            data-testid="slider-edit-budget"
                          />
                          {/* Member budget dots overlay */}
                          {group && (group as any).memberBudgetStats && (
                            <div className="absolute inset-0 pointer-events-none">
                              {(() => {
                                const stats = (group as any).memberBudgetStats;
                                // Group budgets by value to show count on hover
                                const budgetCounts = stats.budgets.reduce((acc: Record<number, number>, budget: number) => {
                                  acc[budget] = (acc[budget] || 0) + 1;
                                  return acc;
                                }, {});
                                const uniqueBudgets = Object.keys(budgetCounts).map(Number);
                                const averagePosition = (stats.average / 250) * 100;
                                
                                return (
                                  <>
                                    {/* Show all member budget dots as small grey dots */}
                                    {uniqueBudgets.map((budget) => {
                                      const position = (budget / 250) * 100;
                                      const count = budgetCounts[budget];
                                      
                                      return (
                                        <Tooltip key={`member-${budget}`}>
                                          <TooltipTrigger asChild>
                                            <div
                                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto cursor-help"
                                              style={{ left: `${position}%` }}
                                              data-testid={`budget-dot-${budget}`}
                                            >
                                              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">
                                              ${budget} ({count} {count === 1 ? 'member' : 'members'})
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                    
                                    {/* Show average as a larger, distinct dot */}
                                    <Tooltip key="average">
                                      <TooltipTrigger asChild>
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto cursor-help"
                                          style={{ left: `${averagePosition}%` }}
                                          data-testid="budget-dot-average"
                                        >
                                          <div className="w-3 h-3 rounded-full bg-primary/60 ring-2 ring-primary/30" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs font-medium">
                                          Group Avg: ${stats.average}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
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
                  </div>
                  <div className="space-y-3">
                    <Label>Group Availability</Label>
                    <AvailabilityGrid 
                      value={editAvailability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>} 
                      onChange={setEditAvailability}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Automation Section */}
              {isOwner && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <CardTitle>Automation</CardTitle>
                    </div>
                    <CardDescription>
                      Let Kinmo handle the planning for you
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {/* Auto-generate Activities */}
                      <div className="flex items-start gap-3 p-3 bg-background rounded-md">
                        <Switch
                          id="auto-activities"
                          checked={group?.autoActivitiesEnabled || false}
                          onCheckedChange={(checked) => {
                            toggleAutomationMutation.mutate({ 
                              field: 'autoActivitiesEnabled', 
                              value: checked 
                            });
                          }}
                          data-testid="switch-auto-activities"
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="auto-activities" className="cursor-pointer font-medium">
                            Auto-generate Activities
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            AI suggests new venues weekly based on your group's preferences
                          </p>
                        </div>
                      </div>

                      {/* Auto-create Itinerary Drafts */}
                      <div className="flex items-start gap-3 p-3 bg-background rounded-md">
                        <Switch
                          id="auto-itinerary"
                          checked={group?.autoItineraryEnabled || false}
                          onCheckedChange={(checked) => {
                            toggleAutomationMutation.mutate({ 
                              field: 'autoItineraryEnabled', 
                              value: checked 
                            });
                          }}
                          data-testid="switch-auto-itinerary"
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="auto-itinerary" className="cursor-pointer font-medium">
                            Auto-create Itinerary Drafts
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Builds ready-to-schedule event plans from your favorites
                          </p>
                        </div>
                      </div>

                      {/* Auto-schedule Events */}
                      <div className="flex items-start gap-3 p-3 bg-background rounded-md">
                        <Switch
                          id="auto-schedule"
                          checked={group?.autoScheduleEnabled || false}
                          onCheckedChange={(checked) => {
                            toggleAutomationMutation.mutate({ 
                              field: 'autoScheduleEnabled', 
                              value: checked 
                            });
                          }}
                          data-testid="switch-auto-schedule"
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="auto-schedule" className="cursor-pointer font-medium">
                            Auto-schedule Events
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Creates and sends an event every {editFrequencyNumber} {editFrequencyUnit}{editFrequencyNumber !== 1 ? 's' : ''} automatically
                          </p>
                          {group?.autoScheduleEnabled && (
                            <div className="text-xs mt-1.5">
                              {group?.nextEventDueDate ? (
                                <span className="text-muted-foreground">
                                  → Next auto-event: {new Date(group.nextEventDueDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  → Auto-scheduling active
                                </span>
                              )}
                              {' '}
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs text-primary hover:underline"
                                onClick={() => setActiveTab('home')}
                                data-testid="link-view-home-tab"
                              >
                                (view on Home tab)
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                    <p className="text-sm text-muted-foreground">First, choose which broad categories to enable - AI will only generate suggestions from enabled categories</p>
                    
                    {/* High-level category filters */}
                    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                      <Label className="text-sm font-semibold">Enable/Disable Activity Categories</Label>
                      <p className="text-xs text-muted-foreground">Toggle to control which types of suggestions AI generates</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          type="button"
                          variant={editGroupData.mealEnabled !== false ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = editGroupData.mealEnabled === false ? true : false;
                            setEditGroupData({ ...editGroupData, mealEnabled: newValue });
                            toggleAutomationMutation.mutate({ field: 'meal_enabled', value: newValue });
                          }}
                          className="gap-1.5"
                          data-testid="button-toggle-meal"
                        >
                          <span>🍽️</span>
                          <span>Meals</span>
                        </Button>
                        <Button
                          type="button"
                          variant={editGroupData.cafeEnabled !== false ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = editGroupData.cafeEnabled === false ? true : false;
                            setEditGroupData({ ...editGroupData, cafeEnabled: newValue });
                            toggleAutomationMutation.mutate({ field: 'cafe_enabled', value: newValue });
                          }}
                          className="gap-1.5"
                          data-testid="button-toggle-cafe"
                        >
                          <span>☕</span>
                          <span>Cafes</span>
                        </Button>
                        <Button
                          type="button"
                          variant={editGroupData.drinksEnabled !== false ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = editGroupData.drinksEnabled === false ? true : false;
                            setEditGroupData({ ...editGroupData, drinksEnabled: newValue });
                            toggleAutomationMutation.mutate({ field: 'drinks_enabled', value: newValue });
                          }}
                          className="gap-1.5"
                          data-testid="button-toggle-drinks"
                        >
                          <span>🍺</span>
                          <span>Drinks</span>
                        </Button>
                        <Button
                          type="button"
                          variant={editGroupData.dessertEnabled !== false ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = editGroupData.dessertEnabled === false ? true : false;
                            setEditGroupData({ ...editGroupData, dessertEnabled: newValue });
                            toggleAutomationMutation.mutate({ field: 'dessert_enabled', value: newValue });
                          }}
                          className="gap-1.5"
                          data-testid="button-toggle-dessert"
                        >
                          <span>🍰</span>
                          <span>Dessert</span>
                        </Button>
                        <Button
                          type="button"
                          variant={editGroupData.experiencesEnabled !== false ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = editGroupData.experiencesEnabled === false ? true : false;
                            setEditGroupData({ ...editGroupData, experiencesEnabled: newValue });
                            toggleAutomationMutation.mutate({ field: 'experiences_enabled', value: newValue });
                          }}
                          className="gap-1.5"
                          data-testid="button-toggle-experiences"
                        >
                          <span>🎭</span>
                          <span>Experiences</span>
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">Then select specific experience types to further refine suggestions (optional)</p>
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
                    <Label htmlFor="edit-additional-instructions">Anything else we should know? (Optional)</Label>
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

              {/* Members Section */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle>Members</CardTitle>
                    <CardDescription>Manage group members and invitations</CardDescription>
                  </div>
                  {/* Button to edit user's own profile (availability, preferences, etc.) */}
                  {(() => {
                    const userMember = members.find(m => m.userId === user?.id);
                    return userMember ? (
                      <Link href={`/member-profile-setup/${userMember.id}`}>
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-edit-my-profile">
                          <Settings className="w-4 h-4" />
                          Edit My Profile
                        </Button>
                      </Link>
                    ) : null;
                  })()}
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
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Current Members</Label>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Home className="w-3 h-3" />
                          Volunteer to host events
                        </Label>
                      </div>
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={member.id}>
                            {editingMemberId === member.id ? (
                              // Edit mode
                              (<div className="flex gap-2 items-start p-2 bg-muted/50 rounded-md">
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
                              </div>)
                            ) : (
                              // Display mode
                              (<div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
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
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`hosting-${member.id}`}
                                    checked={member.openToHosting}
                                    onCheckedChange={(checked) => {
                                      toggleHostingMutation.mutate({
                                        memberId: member.id,
                                        openToHosting: checked === true
                                      });
                                    }}
                                    data-testid={`checkbox-hosting-volunteer-${member.id}`}
                                  />
                                  
                                  {/* Show badges and controls */}
                                  <div className="flex items-center gap-1">
                                    {member.isOrganizer && (
                                      <Badge variant="secondary" className="text-xs whitespace-nowrap">Organizer</Badge>
                                    )}
                                    
                                    {/* Show edit button if: 1) user is organizer, OR 2) it's their own member record */}
                                    {(isOwner || member.userId === user?.id) && (
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
                                    )}
                                    
                                    {/* Only organizer can delete members (but not themselves) */}
                                    {isOwner && !member.isOrganizer && (
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
                                </div>
                              </div>)
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

                  {/* Save Button for Group Settings */}
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpdateGroup} 
                      disabled={updateGroupMutation.isPending}
                      size="lg"
                      data-testid="button-save-group"
                    >
                      {updateGroupMutation.isPending ? "Saving..." : "Save Group Settings"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Subtab 2: My Preferences */}
              <TabsContent value="my-preferences" className="space-y-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card className="border-purple-500/20">
                    <CardHeader className="bg-purple-500/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-md">
                          <UserCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            My Personal Preferences
                            <Badge variant="secondary" className="text-xs font-normal bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                              Just For Me
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Override group settings with your own preferences. Leave unchecked to use group defaults.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="bg-muted/30 p-3 rounded-md text-sm">
                        <div className="flex items-start gap-2">
                          <p className="text-muted-foreground flex-1">
                            <strong>Note:</strong> These preferences override the group settings for you. Leave unchecked to use group defaults.
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs" side="left">
                              <p className="text-sm">
                                Your personal preferences only affect AI suggestions <strong>you</strong> generate. For example, if you set your budget to $10-$30 in a group with a $0-$60 default, you'll only see venues in your range—other members will still see the full $0-$60 range.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">My Budget (per person)</Label>
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={myPreferencesBudget !== null}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMyPreferencesBudget({ min: group?.budgetMin || 0, max: group?.budgetMax || 60 });
                              } else {
                                setMyPreferencesBudget(null);
                              }
                            }}
                            data-testid="checkbox-budget-override"
                          />
                          <span className="text-sm">
                            Set a personal budget 
                            <span className="text-muted-foreground ml-1">
                              (Group: ${group?.budgetMin}-${group?.budgetMax})
                            </span>
                          </span>
                        </div>
                        {myPreferencesBudget !== null && (
                          <div className="space-y-3">
                            <div className="relative pt-1">
                              <Slider
                                min={0}
                                max={250}
                                step={10}
                                value={[myPreferencesBudget.min, myPreferencesBudget.max]}
                                onValueChange={(vals) => setMyPreferencesBudget({ min: vals[0], max: vals[1] })}
                                className="w-full"
                                data-testid="slider-my-budget"
                              />
                              {/* Group budget range markers */}
                              {group?.budgetMin !== undefined && group?.budgetMax !== undefined && (
                                <>
                                  <div 
                                    className="absolute top-0 w-0.5 h-2 bg-muted-foreground/40 rounded-full"
                                    style={{ left: `${(group.budgetMin / 250) * 100}%` }}
                                    title={`Group min: $${group.budgetMin}`}
                                  />
                                  <div 
                                    className="absolute top-0 w-0.5 h-2 bg-muted-foreground/40 rounded-full"
                                    style={{ left: `${(group.budgetMax / 250) * 100}%` }}
                                    title={`Group max: $${group.budgetMax}`}
                                  />
                                </>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium" data-testid="text-my-budget">
                                ${myPreferencesBudget.min}-{myPreferencesBudget.max >= 200 ? "$200+" : `$${myPreferencesBudget.max}`}
                              </div>
                              {group?.budgetMin !== undefined && group?.budgetMax !== undefined && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full" />
                                  <span>Group: ${group.budgetMin}-${group.budgetMax}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">My Category Preferences</Label>
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={myPreferencesCategories !== null}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMyPreferencesCategories(['meal', 'cafes', 'drinks']);
                              } else {
                                setMyPreferencesCategories(null);
                              }
                            }}
                            data-testid="checkbox-categories-override"
                          />
                          <span className="text-sm">
                            Customize which categories I prefer
                            <span className="text-muted-foreground ml-1">
                              (Using group categories by default)
                            </span>
                          </span>
                        </div>
                        {myPreferencesCategories !== null && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={myPreferencesCategories.includes('meal') ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (myPreferencesCategories.includes('meal')) {
                                  setMyPreferencesCategories(myPreferencesCategories.filter(c => c !== 'meal'));
                                } else {
                                  setMyPreferencesCategories([...myPreferencesCategories, 'meal']);
                                }
                              }}
                              className="gap-1.5"
                              data-testid="button-my-category-meal"
                            >
                              <span>🍽️</span>
                              <span>Meals</span>
                            </Button>
                            <Button
                              type="button"
                              variant={myPreferencesCategories.includes('cafes') ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (myPreferencesCategories.includes('cafes')) {
                                  setMyPreferencesCategories(myPreferencesCategories.filter(c => c !== 'cafes'));
                                } else {
                                  setMyPreferencesCategories([...myPreferencesCategories, 'cafes']);
                                }
                              }}
                              className="gap-1.5"
                              data-testid="button-my-category-cafes"
                            >
                              <span>☕</span>
                              <span>Cafes</span>
                            </Button>
                            <Button
                              type="button"
                              variant={myPreferencesCategories.includes('drinks') ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (myPreferencesCategories.includes('drinks')) {
                                  setMyPreferencesCategories(myPreferencesCategories.filter(c => c !== 'drinks'));
                                } else {
                                  setMyPreferencesCategories([...myPreferencesCategories, 'drinks']);
                                }
                              }}
                              className="gap-1.5"
                              data-testid="button-my-category-drinks"
                            >
                              <span>🍺</span>
                              <span>Drinks</span>
                            </Button>
                            <Button
                              type="button"
                              variant={myPreferencesCategories.includes('dessert') ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (myPreferencesCategories.includes('dessert')) {
                                  setMyPreferencesCategories(myPreferencesCategories.filter(c => c !== 'dessert'));
                                } else {
                                  setMyPreferencesCategories([...myPreferencesCategories, 'dessert']);
                                }
                              }}
                              className="gap-1.5"
                              data-testid="button-my-category-dessert"
                            >
                              <span>🍰</span>
                              <span>Dessert</span>
                            </Button>
                            <Button
                              type="button"
                              variant={myPreferencesCategories.includes('experiences') ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (myPreferencesCategories.includes('experiences')) {
                                  setMyPreferencesCategories(myPreferencesCategories.filter(c => c !== 'experiences'));
                                } else {
                                  setMyPreferencesCategories([...myPreferencesCategories, 'experiences']);
                                }
                              }}
                              className="gap-1.5"
                              data-testid="button-my-category-experiences"
                            >
                              <span>🎭</span>
                              <span>Experiences</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">My Availability</Label>
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={myPreferencesAvailability !== null}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMyPreferencesAvailability(createEmptyAvailability());
                              } else {
                                setMyPreferencesAvailability(null);
                              }
                            }}
                            data-testid="checkbox-availability-override"
                          />
                          <span className="text-sm">
                            Set my personal availability schedule
                            <span className="text-muted-foreground ml-1">
                              (Using group availability by default)
                            </span>
                          </span>
                        </div>
                        {myPreferencesAvailability !== null && (
                          <AvailabilityGrid
                            value={myPreferencesAvailability}
                            onChange={setMyPreferencesAvailability}
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">My Meeting Frequency</Label>
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={myPreferencesMeetingFrequency !== null}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMyPreferencesMeetingFrequency({ number: 1, unit: 'weeks' });
                                setMyPreferencesMeetingFrequencyOriginal(null); // Clear original when user enables
                              } else {
                                setMyPreferencesMeetingFrequency(null);
                                setMyPreferencesMeetingFrequencyOriginal(null);
                              }
                            }}
                            data-testid="checkbox-frequency-override"
                          />
                          <span className="text-sm">
                            Set my preferred meeting frequency
                            <span className="text-muted-foreground ml-1">
                              (Using group frequency by default)
                            </span>
                          </span>
                        </div>
                        {myPreferencesMeetingFrequency !== null && (
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={myPreferencesMeetingFrequency.number}
                              onChange={(e) => {
                                setMyPreferencesMeetingFrequency({ 
                                  ...myPreferencesMeetingFrequency, 
                                  number: parseInt(e.target.value) || 1 
                                });
                                setMyPreferencesMeetingFrequencyOriginal(null); // Clear original when user edits
                              }}
                              className="w-20"
                              data-testid="input-my-frequency-number"
                            />
                            <Select
                              value={myPreferencesMeetingFrequency.unit}
                              onValueChange={(value) => {
                                setMyPreferencesMeetingFrequency({ 
                                  ...myPreferencesMeetingFrequency, 
                                  unit: value 
                                });
                                setMyPreferencesMeetingFrequencyOriginal(null); // Clear original when user edits
                              }}
                            >
                              <SelectTrigger className="flex-1" data-testid="select-my-frequency-unit">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="days">days</SelectItem>
                                <SelectItem value="weeks">weeks</SelectItem>
                                <SelectItem value="months">months</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={() => {
                            // Use original value if it exists (hasn't been edited), otherwise serialize current state
                            let frequencyValue = null;
                            if (myPreferencesMeetingFrequency) {
                              if (myPreferencesMeetingFrequencyOriginal) {
                                // User hasn't edited, preserve original format (including legacy values like "flexible")
                                frequencyValue = myPreferencesMeetingFrequencyOriginal;
                              } else {
                                // User has edited, use new serialized format
                                frequencyValue = `${myPreferencesMeetingFrequency.number}x ${myPreferencesMeetingFrequency.unit.replace(/s$/, '')}`;
                              }
                            }
                            
                            updateMyPreferencesMutation.mutate({
                              budgetOverrideMin: myPreferencesBudget?.min,
                              budgetOverrideMax: myPreferencesBudget?.max,
                              categoryPreferencesOverride: myPreferencesCategories,
                              availabilityOverride: myPreferencesAvailability,
                              meetingFrequencyOverride: frequencyValue,
                            });
                          }}
                          disabled={updateMyPreferencesMutation.isPending}
                          data-testid="button-save-my-preferences"
                        >
                          {updateMyPreferencesMutation.isPending ? "Saving..." : "Save My Preferences"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
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
              
              {/* Unified AI Generation Block */}
              <div className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">AI Activity Generation</span>
                </div>
                
                <div className="space-y-3">
                  {/* Location and radius controls */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={group?.locationBase || "Location"}
                      value={categoryLocation}
                      onChange={(e) => setCategoryLocation(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      data-testid="input-category-location"
                    />
                    <select
                      value={categoryRadius}
                      onChange={(e) => setCategoryRadius(Number(e.target.value))}
                      className="h-8 px-2 text-sm border rounded-md bg-background"
                      data-testid="slider-category-radius"
                    >
                      <option value={2}>2mi</option>
                      <option value={10}>10mi</option>
                      <option value={30}>30mi</option>
                      <option value={50}>50mi</option>
                    </select>
                  </div>

                  {/* Category quick filters */}
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <Button
                        variant={selectedCategories.includes('meal') ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (selectedCategories.includes('meal')) {
                            setSelectedCategories(selectedCategories.filter(c => c !== 'meal'));
                          } else {
                            setSelectedCategories([...selectedCategories, 'meal']);
                          }
                        }}
                        className="flex-1 h-8 gap-1.5"
                        data-testid="button-category-meal"
                      >
                        <span>🍽️</span>
                        <span className="text-xs">Meals</span>
                        {selectedCategories.includes('meal') && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                      <Button
                        variant={selectedCategories.includes('cafes') ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (selectedCategories.includes('cafes')) {
                            setSelectedCategories(selectedCategories.filter(c => c !== 'cafes'));
                          } else {
                            setSelectedCategories([...selectedCategories, 'cafes']);
                          }
                        }}
                        className="flex-1 h-8 gap-1.5"
                        data-testid="button-category-cafes"
                      >
                        <span>☕</span>
                        <span className="text-xs">Cafes</span>
                        {selectedCategories.includes('cafes') && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                      <Button
                        variant={selectedCategories.includes('drinks') ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (selectedCategories.includes('drinks')) {
                            setSelectedCategories(selectedCategories.filter(c => c !== 'drinks'));
                          } else {
                            setSelectedCategories([...selectedCategories, 'drinks']);
                          }
                        }}
                        className="flex-1 h-8 gap-1.5"
                        data-testid="button-category-drinks"
                      >
                        <span>🍺</span>
                        <span className="text-xs">Drinks</span>
                        {selectedCategories.includes('drinks') && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                      <Button
                        variant={selectedCategories.includes('dessert') ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (selectedCategories.includes('dessert')) {
                            setSelectedCategories(selectedCategories.filter(c => c !== 'dessert'));
                          } else {
                            setSelectedCategories([...selectedCategories, 'dessert']);
                          }
                        }}
                        className="flex-1 h-8 gap-1.5"
                        data-testid="button-category-dessert"
                      >
                        <span>🍰</span>
                        <span className="text-xs">Dessert</span>
                        {selectedCategories.includes('dessert') && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                      <Button
                        variant={selectedCategories.includes('experiences') ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (selectedCategories.includes('experiences')) {
                            setSelectedCategories(selectedCategories.filter(c => c !== 'experiences'));
                          } else {
                            setSelectedCategories([...selectedCategories, 'experiences']);
                          }
                        }}
                        className="flex-1 h-8 gap-1.5"
                        data-testid="button-category-experiences"
                      >
                        <span>🎭</span>
                        <span className="text-xs">Experiences</span>
                        {selectedCategories.includes('experiences') && <Check className="h-3 w-3 ml-1" />}
                      </Button>
                    </div>
                    
                    {/* Multi-venue mode toggle */}
                    {selectedCategories.length > 0 && (
                      <div className="flex items-center justify-between px-1 py-2 border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="multi-venue-mode"
                            checked={multiVenueMode}
                            onCheckedChange={setMultiVenueMode}
                            data-testid="switch-multi-venue"
                          />
                          <Label htmlFor="multi-venue-mode" className="text-sm cursor-pointer">
                            Multi-venue outing
                          </Label>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {multiVenueMode ? "Sorted by distance" : "Sorted by rating"}
                        </div>
                      </div>
                    )}
                    
                    {/* Contextual messaging */}
                    {selectedCategories.length > 0 && (
                      <div className="text-xs text-muted-foreground px-1">
                        {multiVenueMode ? (
                          <>Perfect for bar crawls or venue hopping! Results sorted by distance for easy route planning.</>
                        ) : (
                          <>
                            {selectedCategories.length === 1 ? (
                              <>
                                {selectedCategories.includes('drinks') && "Find the best bars in the area"}
                                {selectedCategories.includes('cafes') && "Find the best coffee shops"}
                                {selectedCategories.includes('meal') && "Discover top-rated restaurants"}
                                {selectedCategories.includes('dessert') && "Find the sweetest spots"}
                                {selectedCategories.includes('experiences') && "Explore fun activities"}
                              </>
                            ) : (
                              <>Generating {selectedCategories.length} categories with 9 results each</>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom AI instructions */}
                  <Textarea
                    placeholder="Refine your search... (e.g., 'Asian food', 'outdoor seating', 'live music')"
                    value={tempInstructions}
                    onChange={(e) => setTempInstructions(e.target.value)}
                    className="resize-none text-sm"
                    rows={2}
                    data-testid="input-temp-instructions"
                  />

                  {/* Category-Specific Generate Button */}
                  <Button
                    onClick={() => {
                      if (selectedCategories.length > 0) {
                        generateCategoryMutation.mutate({
                          categories: selectedCategories,
                          location: categoryLocation.trim() ? { address: categoryLocation.trim(), lat: 0, lng: 0 } : undefined,
                          radius: categoryRadius,
                          sortBy: multiVenueMode ? 'distance' : 'rating',
                          tempInstructions: tempInstructions.trim() || undefined,
                        });
                      }
                    }}
                    disabled={selectedCategories.length === 0 || generateCategoryMutation.isPending}
                    size="sm"
                    className="w-full h-8"
                    data-testid="button-generate-category"
                  >
                    <Sparkles className="mr-2 h-3 w-3" />
                    {generateCategoryMutation.isPending ? "Generating..." : 
                     selectedCategories.length > 0 ? (
                       selectedCategories.length === 1 
                         ? `Generate ${selectedCategories[0] === 'drinks' ? 'Bars' : selectedCategories[0] === 'cafes' ? 'Coffee' : selectedCategories[0] === 'meal' ? 'Meals' : selectedCategories[0] === 'dessert' ? 'Dessert' : 'Events'}`
                         : `Generate ${selectedCategories.length} Categories`
                     ) :
                     "Select a category above"}
                  </Button>
                </div>
              </div>

              {activitiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="h-40 w-full rounded-t-lg" />
                    <CardHeader>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : activities.length === 0 && categoryResults.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  {group?.activityGenerationStatus === "failed" ? (
                    <>
                      <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Ready to Explore</h3>
                      <p className="text-muted-foreground mb-4">
                        Select a category above (Bars, Coffee, Meals, Dessert, or Events) to discover venues
                      </p>
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
                {/* Category Search Results - Temporary explorations */}
                {(Array.isArray(categoryResults) ? categoryResults.length > 0 : Object.keys(categoryResults).length > 0) && (() => {
                  // Check if results are grouped by category (object) or flat array
                  const isGrouped = !Array.isArray(categoryResults);
                  const categoryLabels = {
                    meal: 'Meals',
                    cafes: 'Coffee',
                    drinks: 'Bars',
                    dessert: 'Dessert',
                    experiences: 'Events'
                  };
                  
                  // Helper to sort results
                  const sortResults = (results: any[]) => {
                    return [...results].sort((a, b) => {
                      if (multiVenueMode) {
                        // Sort by distance (closest first)
                        const distA = a.distanceFromGroupBase ?? 999;
                        const distB = b.distanceFromGroupBase ?? 999;
                        return distA - distB;
                      } else {
                        // Sort by rating (highest first)
                        const ratingA = parseFloat(a.rating || '0');
                        const ratingB = parseFloat(b.rating || '0');
                        if (ratingA !== ratingB) {
                          return ratingB - ratingA;
                        }
                        // Tie-breaker: review count
                        const reviewCountA = a.reviewCount || 0;
                        const reviewCountB = b.reviewCount || 0;
                        return reviewCountB - reviewCountA;
                      }
                    });
                  };
                  
                  const sortedResults = isGrouped ? null : sortResults(categoryResults as any[]);

                  return (
                    <div className="mb-8">
                      <Card className="border-primary/30">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Search Results
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Exploring options - heart (❤️) any venue to save it to your main list
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCategoryResults([])}
                              data-testid="button-dismiss-search-results"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                          
                          <>
                            {/* Single category - flat grid */}
                            {!isGrouped && sortedResults && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {sortedResults.map((result) => {
                                const tempActivity = {
                              id: result.placeId || result.googlePlaceId || `temp-${Math.random()}`,
                              groupId: groupId || '',
                              venueName: result.venueName,
                              venueAddress: result.venueAddress,
                              venueType: result.venueType || 'Venue',
                              description: result.description,
                              rating: result.rating?.toString() || null,
                              reviewCount: result.reviewCount || null,
                              priceLevel: result.priceLevel?.toString() || null,
                              photoUrl: result.photoUrl || null,
                              googlePlaceId: result.googlePlaceId || result.placeId || null,
                              feedback: (result as any).feedback || null,
                              category: result.category || null,
                            };
                            
                            const isSelected = selectedVenues.some(v => v.sourceType === 'activity' && v.sourceId === tempActivity.id);
                            
                            return (
                              <Card 
                                key={tempActivity.id} 
                                className={`relative overflow-hidden hover-elevate transition-all flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`} 
                                data-testid={`search-result-${tempActivity.id}`}
                              >
                                {tempActivity.photoUrl && (
                                  <div className="aspect-video w-full overflow-hidden bg-muted">
                                    <img
                                      src={tempActivity.photoUrl}
                                      alt={tempActivity.venueName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleVenueSelection('activity', tempActivity.id)}
                                    className="h-6 w-6 bg-white border-2"
                                    data-testid={`checkbox-search-result-${tempActivity.id}`}
                                  />
                                </div>
                                <button
                                  className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${
                                    tempActivity.feedback === "love"
                                      ? "bg-pink-500/90 hover:bg-pink-600/90"
                                      : "bg-black/40 hover:bg-black/60 border-2 border-white"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    
                                    if (tempActivity.feedback === "love") {
                                      toast({
                                        title: "Already saved",
                                        description: "This venue is already in your list",
                                      });
                                      return;
                                    }
                                    
                                    // Create voting event from category search result
                                    createActivityFromCategoryResultMutation.mutate({
                                      googlePlaceId: tempActivity.googlePlaceId || tempActivity.id,
                                      activityData: {
                                        venueName: tempActivity.venueName,
                                        venueAddress: tempActivity.venueAddress,
                                        venueType: tempActivity.venueType,
                                        description: tempActivity.description || '',
                                        googlePlaceId: tempActivity.googlePlaceId,
                                        rating: tempActivity.rating,
                                        priceLevel: tempActivity.priceLevel,
                                        photoUrl: tempActivity.photoUrl,
                                        reviewCount: tempActivity.reviewCount,
                                        category: tempActivity.category,
                                      },
                                    });
                                  }}
                                  data-testid={`button-favorite-search-${tempActivity.id}`}
                                >
                                  <Heart 
                                    className={`h-6 w-6 transition-all ${
                                      tempActivity.feedback === "love" 
                                        ? "fill-white stroke-white" 
                                        : "fill-none stroke-white"
                                    }`} 
                                    strokeWidth={2.5}
                                  />
                                </button>
                                <div className="p-4 flex-1 flex flex-col">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <h3 className="font-semibold line-clamp-1">{tempActivity.venueName}</h3>
                                    {tempActivity.googlePlaceId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                        className="h-6 px-2 flex-shrink-0"
                                        data-testid={`button-google-link-search-${tempActivity.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <a
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tempActivity.venueName)}&query_place_id=${tempActivity.googlePlaceId}`}
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
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{tempActivity.venueType}</p>
                                  
                                  <div className="flex items-center gap-3 mb-3">
                                    {tempActivity.rating && (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-sm font-medium">{tempActivity.rating}</span>
                                        {tempActivity.reviewCount && (
                                          <span className="text-xs text-muted-foreground">({tempActivity.reviewCount})</span>
                                        )}
                                      </div>
                                    )}
                                    {tempActivity.priceLevel && (
                                      <div className="text-sm text-muted-foreground">
                                        {priceDisplay(tempActivity.priceLevel)}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {tempActivity.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tempActivity.description}</p>
                                  )}
                                  
                                  <p className="text-xs text-muted-foreground mt-auto line-clamp-2">{tempActivity.venueAddress}</p>
                                </div>
                              </Card>
                            );
                              })}
                            </div>
                          )}
                          
                          {/* Multiple categories - grouped by category with headers */}
                          {isGrouped && (
                            <div className="space-y-8">
                              {Object.entries(categoryResults as Record<string, any[]>).map(([cat, venues]) => {
                                const sortedVenues = sortResults(venues);
                                const ITEMS_PER_PAGE = 6;
                                const currentPage = categoryPages[cat as keyof typeof categoryPages] || 0;
                                const totalPages = Math.ceil(sortedVenues.length / ITEMS_PER_PAGE);
                                const startIdx = currentPage * ITEMS_PER_PAGE;
                                const endIdx = startIdx + ITEMS_PER_PAGE;
                                const paginatedVenues = sortedVenues.slice(startIdx, endIdx);
                                
                                const handlePrevPage = () => {
                                  if (currentPage > 0) {
                                    setCategoryPages(prev => ({ ...prev, [cat]: currentPage - 1 }));
                                  }
                                };
                                
                                const handleNextPage = () => {
                                  if (currentPage < totalPages - 1) {
                                    setCategoryPages(prev => ({ ...prev, [cat]: currentPage + 1 }));
                                  }
                                };
                                
                                return (
                                  <div key={cat} className="space-y-3">
                                    <div className="flex items-center justify-between gap-2 border-b pb-2">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-md font-semibold">{categoryLabels[cat as keyof typeof categoryLabels]}</h4>
                                        <span className="text-sm text-muted-foreground">({sortedVenues.length} results)</span>
                                      </div>
                                      {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={currentPage === 0}
                                            className="h-7 w-7 p-0"
                                            data-testid={`button-prev-${cat}`}
                                          >
                                            <ChevronLeft className="h-4 w-4" />
                                          </Button>
                                          <span className="text-xs text-muted-foreground min-w-[4rem] text-center">
                                            {currentPage + 1} / {totalPages}
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={currentPage >= totalPages - 1}
                                            className="h-7 w-7 p-0"
                                            data-testid={`button-next-${cat}`}
                                          >
                                            <ChevronRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {paginatedVenues.map((result) => {
                                        const tempActivity = {
                                          id: result.placeId || result.googlePlaceId || `temp-${Math.random()}`,
                                          groupId: groupId || '',
                                          venueName: result.venueName,
                                          venueAddress: result.venueAddress,
                                          venueType: result.venueType || 'Venue',
                                          description: result.description,
                                          rating: result.rating?.toString() || null,
                                          reviewCount: result.reviewCount || null,
                                          priceLevel: result.priceLevel?.toString() || null,
                                          photoUrl: result.photoUrl || null,
                                          googlePlaceId: result.googlePlaceId || result.placeId || null,
                                          feedback: (result as any).feedback || null,
                                          category: result.category || null,
                                        };
                                        
                                        const isSelected = selectedVenues.some(v => v.sourceType === 'activity' && v.sourceId === tempActivity.id);
                                        
                                        return (
                                          <Card 
                                            key={tempActivity.id} 
                                            className={`relative overflow-hidden hover-elevate transition-all flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`} 
                                            data-testid={`search-result-${tempActivity.id}`}
                                          >
                                            {tempActivity.photoUrl && (
                                              <div className="aspect-video w-full overflow-hidden bg-muted">
                                                <img
                                                  src={tempActivity.photoUrl}
                                                  alt={tempActivity.venueName}
                                                  className="w-full h-full object-cover"
                                                />
                                              </div>
                                            )}
                                            <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleVenueSelection('activity', tempActivity.id)}
                                                className="h-6 w-6 bg-white border-2"
                                                data-testid={`checkbox-search-result-${tempActivity.id}`}
                                              />
                                            </div>
                                            <button
                                              className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${
                                                tempActivity.feedback === "love"
                                                  ? "bg-pink-500/90 hover:bg-pink-600/90"
                                                  : "bg-black/40 hover:bg-black/60 border-2 border-white"
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                
                                                if (tempActivity.feedback === "love") {
                                                  toast({
                                                    title: "Already saved",
                                                    description: "This venue is already in your list",
                                                  });
                                                  return;
                                                }
                                                
                                                createActivityFromCategoryResultMutation.mutate({
                                                  googlePlaceId: tempActivity.googlePlaceId || tempActivity.id,
                                                  activityData: {
                                                    venueName: tempActivity.venueName,
                                                    venueAddress: tempActivity.venueAddress,
                                                    venueType: tempActivity.venueType,
                                                    description: tempActivity.description || '',
                                                    googlePlaceId: tempActivity.googlePlaceId,
                                                    rating: tempActivity.rating,
                                                    priceLevel: tempActivity.priceLevel,
                                                    photoUrl: tempActivity.photoUrl,
                                                    reviewCount: tempActivity.reviewCount,
                                                    category: tempActivity.category,
                                                  },
                                                });
                                              }}
                                              data-testid={`button-favorite-search-${tempActivity.id}`}
                                            >
                                              <Heart 
                                                className={`h-6 w-6 transition-all ${
                                                  tempActivity.feedback === "love" 
                                                    ? "fill-white stroke-white" 
                                                    : "fill-none stroke-white"
                                                }`} 
                                                strokeWidth={2.5}
                                              />
                                            </button>
                                            <div className="p-4 flex-1 flex flex-col">
                                              <div className="flex items-start justify-between gap-2 mb-1">
                                                <h3 className="font-semibold line-clamp-1">{tempActivity.venueName}</h3>
                                                {tempActivity.googlePlaceId && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                    className="h-6 px-2 flex-shrink-0"
                                                    data-testid={`button-google-link-search-${tempActivity.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <a
                                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tempActivity.venueName)}&query_place_id=${tempActivity.googlePlaceId}`}
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
                                              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{tempActivity.venueType}</p>
                                              
                                              <div className="flex items-center gap-3 mb-3">
                                                {tempActivity.rating && (
                                                  <div className="flex items-center gap-1">
                                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                    <span className="text-sm font-medium">{tempActivity.rating}</span>
                                                    {tempActivity.reviewCount && (
                                                      <span className="text-xs text-muted-foreground">({tempActivity.reviewCount})</span>
                                                    )}
                                                  </div>
                                                )}
                                                {tempActivity.priceLevel && (
                                                  <div className="text-sm text-muted-foreground">
                                                    {priceDisplay(tempActivity.priceLevel)}
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {tempActivity.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tempActivity.description}</p>
                                              )}
                                              
                                              <p className="text-xs text-muted-foreground mt-auto line-clamp-2">{tempActivity.venueAddress}</p>
                                            </div>
                                          </Card>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          </>
                        </div>
                    </Card>
                  </div>
                  );
                })()}

                {/* ARCHIVED (Nov 2025): Old "Saved Activities" section from general AI generation flow */}
                {/* Divider between search results and saved activities */}
                {/* categoryResults.length > 0 && activities.length > 0 && (
                  <div className="my-8 flex items-center gap-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-sm text-muted-foreground font-medium">Your Saved Activities</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                ) */}

                {/* HIDDEN: Old category-based display (MEAL, CAFES, DRINKS, etc.) - disabled via {false && */}
                {false && (() => {
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

                  // Don't merge categoryResults - they're shown separately above
                  const allActivities = [...filteredActivities];

                  const groupedByCategory = {
                    meal: allActivities.filter(a => getActivityCategory(a) === 'meal'),
                    cafes: allActivities.filter(a => getActivityCategory(a) === 'cafes'),
                    drinks: allActivities.filter(a => getActivityCategory(a) === 'drinks'),
                    dessert: allActivities.filter(a => getActivityCategory(a) === 'dessert'),
                    experiences: allActivities.filter(a => getActivityCategory(a) === 'experiences'),
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
                        
                        // Pagination with auto-clamping to prevent empty pages after regeneration
                        const ITEMS_PER_PAGE = 5;
                        const totalPages = Math.ceil(categoryActivities.length / ITEMS_PER_PAGE);
                        let currentPage = categoryPages[category] || 0;
                        // Clamp to valid range: if current page is beyond available pages, reset to last valid page
                        if (currentPage >= totalPages && totalPages > 0) {
                          currentPage = totalPages - 1;
                          // Update state to reflect the clamped value
                          setCategoryPages(prev => ({ ...prev, [category]: currentPage }));
                        }
                        const startIndex = currentPage * ITEMS_PER_PAGE;
                        const endIndex = startIndex + ITEMS_PER_PAGE;
                        const paginatedActivities = categoryActivities.slice(startIndex, endIndex);
                        
                        const handlePrevPage = () => {
                          setCategoryPages(prev => ({
                            ...prev,
                            [category]: Math.max(0, (prev[category] || 0) - 1)
                          }));
                        };
                        
                        const handleNextPage = () => {
                          setCategoryPages(prev => ({
                            ...prev,
                            [category]: Math.min(totalPages - 1, (prev[category] || 0) + 1)
                          }));
                        };
                        
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {paginatedActivities.map((activity) => {
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
                          
                          // Check if this is a temporary activity from categoryResults
                          const isTempActivity = activity.id.startsWith('temp-') || 
                            !activities.find(a => a.id === activity.id);
                          
                          if (activity.feedback === "love") {
                            // Remove feedback and delete from Favorites list
                            if (isTempActivity) {
                              // Can't un-favorite a temporary activity - ignore
                              toast({
                                title: "Please save this first",
                                description: "Generated suggestions need to be saved before favoriting",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            feedbackMutation.mutate({ activityId: activity.id, feedback: null });
                            
                            // Find the voting event with matching venueName and delete it
                            const matchingEvent = votingEvents.find(event => event.title === activity.venueName);
                            if (matchingEvent) {
                              deleteEventMutation.mutate(matchingEvent.id);
                            }
                          } else {
                            if (isTempActivity) {
                              // Create voting event from category result
                              createActivityFromCategoryResultMutation.mutate({
                                googlePlaceId: activity.googlePlaceId || activity.id,
                                activityData: {
                                  venueName: activity.venueName,
                                  venueAddress: activity.venueAddress,
                                  venueType: activity.venueType,
                                  description: activity.description,
                                  googlePlaceId: activity.googlePlaceId,
                                  rating: activity.rating,
                                  priceLevel: activity.priceLevel,
                                  photoUrl: activity.photoUrl,
                                  aiReasoning: activity.aiReasoning,
                                  priceEstimate: activity.priceEstimate,
                                  timeConstraints: activity.timeConstraints,
                                  reviewCount: activity.reviewCount,
                                  googleReview: activity.googleReview,
                                  complementaryPlaceName: activity.complementaryPlaceName,
                                  complementaryPlaceAddress: activity.complementaryPlaceAddress,
                                  complementaryPlaceId: activity.complementaryPlaceId,
                                  complementaryPlacePhotoUrl: activity.complementaryPlacePhotoUrl,
                                  complementaryPlaceRating: activity.complementaryPlaceRating,
                                  complementaryPlaceName2: activity.complementaryPlaceName2,
                                  complementaryPlaceAddress2: activity.complementaryPlaceAddress2,
                                  complementaryPlaceId2: activity.complementaryPlaceId2,
                                  complementaryPlacePhotoUrl2: activity.complementaryPlacePhotoUrl2,
                                  complementaryPlaceRating2: activity.complementaryPlaceRating2,
                                },
                                feedback: "love",
                              });
                              
                              // Also create voting event
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
                            
                            {/* Pagination Navigation */}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-center gap-4 mt-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handlePrevPage}
                                  disabled={currentPage === 0}
                                  data-testid={`button-prev-${category}`}
                                  className="h-8 w-8 p-0"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground" data-testid={`text-page-${category}`}>
                                  Page {currentPage + 1} of {totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleNextPage}
                                  disabled={currentPage === totalPages - 1}
                                  data-testid={`button-next-${category}`}
                                  className="h-8 w-8 p-0"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
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
                            // Check if already favorited (ONLY in activities OR voting events - NOT optimistic tracker)
                            const inActivities = activities.some(a => !a.archivedAt && a.googlePlaceId && a.googlePlaceId === result.placeId);
                            const inVotingEvents = votingEvents.some(e => e.googlePlaceId && e.googlePlaceId === result.placeId);
                            const alreadyFavorited = inActivities || inVotingEvents;
                            
                            // Check if already in cart (selected venues OR existing itineraries OR optimistically added)
                            const inSelectedVenues = selectedVenues.some(v => {
                              if (v.sourceType === 'voting_event') {
                                const votingEvent = votingEvents.find(e => e.id === v.sourceId);
                                return votingEvent?.googlePlaceId === result.placeId;
                              } else if (v.sourceType === 'activity') {
                                const activity = activities.find(a => a.id === v.sourceId);
                                return activity?.googlePlaceId === result.placeId;
                              }
                              return false;
                            });
                            
                            const inExistingItinerary = itineraries.some(itinerary => 
                              itinerary.items.some((item: any) => {
                                if (item.sourceType === 'voting_event') {
                                  const votingEvent = votingEvents.find(e => e.id === item.sourceId);
                                  return votingEvent?.googlePlaceId === result.placeId;
                                } else if (item.sourceType === 'activity') {
                                  const activity = activities.find(a => a.id === item.sourceId);
                                  return activity?.googlePlaceId === result.placeId;
                                }
                                return false;
                              })
                            );
                            
                            // Use optimistic tracker ONLY for cart state, not favorite state
                            const alreadyInCart = inSelectedVenues || inExistingItinerary || addedSuggestionPlaceIds.has(result.placeId);

                            return (
                              <div
                                key={result.placeId}
                                className="flex gap-3 p-3 rounded-md border"
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
                                  <div className="flex items-center gap-2 mt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (!alreadyFavorited && !addVotingEventMutation.isPending) {
                                          addVotingEventMutation.mutate({
                                            title: result.name,
                                            venueType: result.types?.[0] || 'venue',
                                            venueAddress: result.address,
                                            googlePlaceId: result.placeId,
                                            photoUrl: result.photoUrl,
                                            rating: result.rating,
                                            reviewCount: result.reviewCount,
                                            priceLevel: result.priceLevel,
                                            latitude: result.location?.lat?.toString(),
                                            longitude: result.location?.lng?.toString(),
                                            city: result.city,
                                            addToCart: false, // Just favorite, don't add to cart
                                          });
                                        }
                                      }}
                                      disabled={alreadyFavorited || addVotingEventMutation.isPending}
                                      className="gap-1.5"
                                      data-testid={`button-favorite-search-${result.placeId}`}
                                    >
                                      <Heart className={`h-3.5 w-3.5 transition-all ${
                                        alreadyFavorited 
                                          ? 'fill-pink-500 text-pink-500' 
                                          : ''
                                      }`} />
                                      {alreadyFavorited ? "Favorited" : "Favorite"}
                                    </Button>
                                    <Button
                                      variant={alreadyInCart ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        if (alreadyInCart) return;
                                        
                                        // Optimistically track this placeId
                                        setAddedSuggestionPlaceIds(prev => new Set(Array.from(prev).concat(result.placeId)));
                                        
                                        // First add to favorites if not already there
                                        if (!alreadyFavorited && !addVotingEventMutation.isPending) {
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
                                            photoUrl: result.photoUrl,
                                            rating: result.rating,
                                            reviewCount: result.reviewCount,
                                            priceLevel: result.priceLevel,
                                            latitude: result.location?.lat?.toString(),
                                            longitude: result.location?.lng?.toString(),
                                            city: result.city,
                                            addToCart: true, // Favorite AND add to cart
                                          });
                                        } else if (alreadyFavorited) {
                                          // Already favorited, just add to cart
                                          // Check if it's in activities or voting events
                                          const activity = activities.find(a => a.googlePlaceId === result.placeId);
                                          const votingEvent = votingEvents.find(e => e.googlePlaceId === result.placeId);
                                          
                                          if (activity || votingEvent) {
                                            if (selectedVenues.length >= 5) {
                                              toast({
                                                title: "Maximum reached",
                                                description: "You can select up to 5 venues",
                                                variant: "destructive"
                                              });
                                              return;
                                            }
                                            
                                            if (activity) {
                                              setSelectedVenues([...selectedVenues, { sourceType: 'activity', sourceId: activity.id }]);
                                            } else if (votingEvent) {
                                              setSelectedVenues([...selectedVenues, { sourceType: 'voting_event', sourceId: votingEvent.id }]);
                                            }
                                          }
                                        }
                                      }}
                                      disabled={alreadyInCart}
                                      className="gap-1.5"
                                      data-testid={`button-add-cart-search-${result.placeId}`}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      {alreadyInCart ? "In Cart" : "Add to Cart"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
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
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
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
                    <Button
                      variant={showFavoritesMap ? "secondary" : "outline"}
                      onClick={() => setShowFavoritesMap(!showFavoritesMap)}
                      className="gap-2"
                      data-testid="button-toggle-map"
                    >
                      <Map className="h-4 w-4" />
                      {showFavoritesMap ? "Hide Map" : "Show Map"}
                    </Button>
                  </div>

                  {/* List and Map side-by-side */}
                  <div className={`grid grid-cols-1 gap-6 ${showFavoritesMap ? 'lg:grid-cols-2' : ''}`}>
                    {/* Favorites List */}
                    <div className="space-y-6">
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
                                        className={`flex items-center gap-3 p-3 rounded-md border hover-elevate transition-colors cursor-pointer ${hoveredFavoriteId === event.id ? 'ring-2 ring-primary' : ''}`}
                                        data-testid={`favorites-row-${event.id}`}
                                        onMouseEnter={() => setHoveredFavoriteId(event.id)}
                                        onMouseLeave={() => setHoveredFavoriteId(null)}
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

                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`button-favorite-menu-${event.id}`}
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditFavorite(event);
                                              }}
                                              data-testid={`menu-edit-${event.id}`}
                                            >
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit
                                            </DropdownMenuItem>
                                            {event.googlePlaceId && (
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.title)}&query_place_id=${event.googlePlaceId}`;
                                                  window.open(mapsUrl, '_blank');
                                                }}
                                              >
                                                <MapPin className="h-4 w-4 mr-2" />
                                                Open in Maps
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setFavoriteToDelete(event);
                                              }}
                                              className="text-destructive focus:text-destructive"
                                              data-testid={`menu-delete-${event.id}`}
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>

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
                    
                    {/* Map View - only render when showFavoritesMap is true */}
                    {showFavoritesMap && (
                      <div className="lg:sticky lg:top-6 h-[600px]">
                        <FavoritesMap 
                          venues={votingEvents.filter(event => 
                            event.title.toLowerCase().includes(favoritesSearch.toLowerCase())
                          )}
                          hoveredVenueId={hoveredFavoriteId}
                          onMarkerHover={setHoveredFavoriteId}
                          onMarkerClick={(venueId) => {
                            const element = document.querySelector(`[data-testid="favorites-row-${venueId}"]`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
                </div>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!favoriteToDelete} onOpenChange={(open) => !open && setFavoriteToDelete(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Favorite?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{favoriteToDelete?.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (favoriteToDelete) {
                            deleteEventMutation.mutate(favoriteToDelete.id);
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Edit Favorite Dialog */}
                <Dialog open={editFavoriteOpen} onOpenChange={setEditFavoriteOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Favorite</DialogTitle>
                      <DialogDescription>
                        Update the details for this favorite venue
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-title">Venue Name</Label>
                        <Input
                          id="edit-title"
                          value={editFavoriteData.title}
                          onChange={(e) => setEditFavoriteData({ ...editFavoriteData, title: e.target.value })}
                          placeholder="e.g., The Blue Room"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description (Optional)</Label>
                        <Textarea
                          id="edit-description"
                          value={editFavoriteData.description}
                          onChange={(e) => setEditFavoriteData({ ...editFavoriteData, description: e.target.value })}
                          placeholder="Add notes about this venue..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-venue-type">Venue Type (Optional)</Label>
                        <Input
                          id="edit-venue-type"
                          value={editFavoriteData.venueType}
                          onChange={(e) => setEditFavoriteData({ ...editFavoriteData, venueType: e.target.value })}
                          placeholder="e.g., Bar, Restaurant, Cafe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-price-level">Price Level (Optional)</Label>
                        <Select
                          value={editFavoriteData.priceLevel || "NONE"}
                          onValueChange={(value) => setEditFavoriteData({ ...editFavoriteData, priceLevel: value === "NONE" ? "" : value })}
                        >
                          <SelectTrigger id="edit-price-level">
                            <SelectValue placeholder="Select price level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">None</SelectItem>
                            <SelectItem value="PRICE_LEVEL_INEXPENSIVE">$ - Inexpensive</SelectItem>
                            <SelectItem value="PRICE_LEVEL_MODERATE">$$ - Moderate</SelectItem>
                            <SelectItem value="PRICE_LEVEL_EXPENSIVE">$$$ - Expensive</SelectItem>
                            <SelectItem value="PRICE_LEVEL_VERY_EXPENSIVE">$$$$ - Very Expensive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditFavoriteOpen(false);
                          setEditingFavorite(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveEditFavorite}
                        disabled={!editFavoriteData.title.trim() || updateEventMutation.isPending}
                      >
                        {updateEventMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Duplicate Confirmation Dialog */}
                <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Venue Already in Favorites</AlertDialogTitle>
                      <AlertDialogDescription>
                        {existingDuplicate && (
                          <>
                            "{existingDuplicate.title}" is already in your favorites list
                            {existingDuplicate.rating && (
                              <span> with a {existingDuplicate.rating} rating</span>
                            )}.
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setDuplicateDialogOpen(false);
                          setDuplicateEventData(null);
                          setExistingDuplicate(null);
                          setAddEventOpen(false);
                          setNewEventTitle("");
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (existingDuplicate) {
                            // Scroll to the existing favorite and highlight it
                            const element = document.querySelector(`[data-testid="favorites-row-${existingDuplicate.id}"]`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setHoveredFavoriteId(existingDuplicate.id);
                              setTimeout(() => setHoveredFavoriteId(null), 3000);
                            }
                            setDuplicateDialogOpen(false);
                            setDuplicateEventData(null);
                            setExistingDuplicate(null);
                            setAddEventOpen(false);
                            setNewEventTitle("");
                          }
                        }}
                      >
                        View Existing
                      </Button>
                      <AlertDialogAction
                        onClick={() => {
                          if (duplicateEventData) {
                            // Retry with allowDuplicate flag
                            createEventMutation.mutate({
                              ...duplicateEventData,
                              allowDuplicate: true
                            });
                          }
                          setDuplicateDialogOpen(false);
                          setDuplicateEventData(null);
                          setExistingDuplicate(null);
                          setAddEventOpen(false);
                          setNewEventTitle("");
                        }}
                      >
                        Add Anyway
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>
            </Tabs>

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
                                setActiveTab('build');
                                requestAnimationFrame(() => {
                                  setTimeout(() => {
                                    document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth' });
                                  }, 150);
                                });
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
                          onClick={() => setAddMoreStopsOpen(!addMoreStopsOpen)}
                          data-testid="button-add-more-stops"
                        >
                          {addMoreStopsOpen ? (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Hide Search
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add More Stops
                            </>
                          )}
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

              {/* Add More Stops Search - Collapsible */}
              {itineraries.length > 0 && addMoreStopsOpen && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Search for More Venues
                    </CardTitle>
                    <CardDescription>
                      Find additional stops to add to your itinerary
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search for parks, restaurants, cafes, or any venue..."
                        value={venueSearchQuery}
                        onChange={(e) => setVenueSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-add-more-stops-search"
                      />
                    </div>

                    {/* Search Results */}
                    {venueSearchQuery.trim() && venueSearchQuery.trim().length >= 2 && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Search results for "{venueSearchQuery}"
                        </p>
                        {venueSearchResults.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {venueSearchResults.map((result: any) => {
                              // Check if already added to itinerary
                              const alreadyInItinerary = itineraries.some((itinerary: any) => 
                                itinerary.items?.some((item: any) => {
                                  if (item.sourceType === 'voting_event') {
                                    const votingEvent = votingEvents.find(e => e.id === item.sourceId);
                                    return votingEvent?.googlePlaceId === result.placeId;
                                  } else if (item.sourceType === 'activity') {
                                    const activity = activities.find(a => a.id === item.sourceId);
                                    return activity?.googlePlaceId === result.placeId;
                                  }
                                  return false;
                                })
                              );

                              const alreadyAdded = activities.some(a => !a.archivedAt && a.googlePlaceId === result.placeId) ||
                                votingEvents.some(e => e.googlePlaceId === result.placeId) ||
                                addedSuggestionPlaceIds.has(result.placeId);

                              const disabled = alreadyInItinerary || alreadyAdded || addVotingEventMutation.isPending;

                              return (
                                <button
                                  key={result.placeId}
                                  onClick={() => {
                                    if (disabled) return;

                                    addVotingEventMutation.mutate({
                                      title: result.name,
                                      venueType: result.types?.[0] || 'venue',
                                      venueAddress: result.address,
                                      googlePlaceId: result.placeId,
                                      photoUrl: result.photoUrl,
                                      rating: result.rating,
                                      reviewCount: result.reviewCount,
                                      priceLevel: result.priceLevel,
                                      latitude: result.location?.lat?.toString(),
                                      longitude: result.location?.lng?.toString(),
                                      city: result.city,
                                    });
                                  }}
                                  disabled={disabled}
                                  className={`flex gap-3 p-3 rounded-md border text-left transition-all hover-elevate active-elevate-2 ${
                                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  data-testid={`search-result-add-more-${result.placeId}`}
                                >
                                  {result.photoUrl && (
                                    <img 
                                      src={result.photoUrl} 
                                      alt={result.name}
                                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{result.name}</p>
                                    {result.rating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">{result.rating}</span>
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {result.address}
                                    </p>
                                    {(alreadyInItinerary || alreadyAdded) && (
                                      <Badge variant="secondary" className="mt-1 text-xs">
                                        <Check className="h-3 w-3 mr-1" />
                                        Added
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No venues found. Try a different search.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Or Browse Activities CTA */}
                    {!venueSearchQuery.trim() && (
                      <div className="pt-4 border-t text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Or browse AI-generated suggestions
                        </p>
                        <Button 
                          onClick={() => {
                            setActiveTab("activities");
                            setAddMoreStopsOpen(false);
                          }} 
                          variant="outline"
                          data-testid="button-go-to-activities-from-add-more"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Browse Activities
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Venue Search - Empty State */}
              {selectedVenues.length === 0 && itineraries.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Search for Venues
                    </CardTitle>
                    <CardDescription>
                      Search for restaurants, cafes, parks, or any venue to add to your itinerary
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search for parks, restaurants, cafes, or any venue..."
                        value={venueSearchQuery}
                        onChange={(e) => setVenueSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-venue-search-build"
                      />
                    </div>

                    {/* Search Results */}
                    {venueSearchQuery.trim() && venueSearchQuery.trim().length >= 2 && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Search results for "{venueSearchQuery}"
                        </p>
                        {venueSearchResults.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {venueSearchResults.map((result: any) => {
                              // Check if already added to cart or favorited
                              const alreadyAdded = activities.some(a => !a.archivedAt && a.googlePlaceId === result.placeId) ||
                                votingEvents.some(e => e.googlePlaceId === result.placeId) ||
                                addedSuggestionPlaceIds.has(result.placeId);

                              return (
                                <button
                                  key={result.placeId}
                                  onClick={() => {
                                    if (alreadyAdded || addVotingEventMutation.isPending) return;
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
                                      photoUrl: result.photoUrl,
                                      rating: result.rating,
                                      reviewCount: result.reviewCount,
                                      priceLevel: result.priceLevel,
                                      latitude: result.location?.lat?.toString(),
                                      longitude: result.location?.lng?.toString(),
                                      city: result.city,
                                    });
                                  }}
                                  disabled={alreadyAdded || addVotingEventMutation.isPending}
                                  className={`flex gap-3 p-3 rounded-md border text-left transition-all hover-elevate active-elevate-2 ${
                                    alreadyAdded || addVotingEventMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  data-testid={`search-result-build-${result.placeId}`}
                                >
                                  {result.photoUrl && (
                                    <img 
                                      src={result.photoUrl} 
                                      alt={result.name}
                                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{result.name}</p>
                                    {result.rating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-medium">{result.rating}</span>
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {result.address}
                                    </p>
                                    {alreadyAdded && (
                                      <Badge variant="secondary" className="mt-1 text-xs">
                                        <Check className="h-3 w-3 mr-1" />
                                        Added
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No venues found. Try a different search.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Or Browse Activities CTA */}
                    {!venueSearchQuery.trim() && (
                      <div className="pt-4 border-t text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Or browse AI-generated suggestions
                        </p>
                        <Button 
                          onClick={() => setActiveTab("activities")} 
                          variant="outline"
                          data-testid="button-go-to-activities"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Browse Activities
                        </Button>
                      </div>
                    )}
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
                        const alreadySelected = activities.some(a => !a.archivedAt && a.googlePlaceId === suggestion.placeId) ||
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

              {/* Scheduling Section */}
              <div className="mt-12 pt-8 border-t" id="schedule-section">
                {/* Schedule Event Section */}
                <Card data-testid="card-schedule-event">
                  <CardHeader>
                    <CardTitle className="text-lg">Schedule Event</CardTitle>
                    <CardDescription>Pick a saved plan and choose when to meet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Saved Plan Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="select-itinerary" className="text-sm font-medium">Saved Plan</Label>
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
                          <SelectValue placeholder="Choose a saved plan..." />
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
                        {/* When to Meet Section */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">When to Meet</Label>
                            {/* Compact Availability Reference */}
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-muted-foreground" data-testid="button-view-availability">
                                  <Calendar className="h-3 w-3" />
                                  View Availability
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="p-3 bg-muted/30 rounded-md border space-y-3">
                                  {group?.availability && (
                                    <div className="space-y-1.5">
                                      <p className="text-xs font-medium text-muted-foreground">Group Availability</p>
                                      <ReadOnlyAvailabilityGrid 
                                        value={group.availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>} 
                                        compact={true as boolean}
                                      />
                                    </div>
                                  )}
                                  {group?.generalAvailability && (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground">Notes</p>
                                      <p className="text-xs text-muted-foreground">{group.generalAvailability}</p>
                                    </div>
                                  )}
                                  {group?.meetingFrequency && (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground">Frequency</p>
                                      <p className="text-xs text-muted-foreground">{formatMeetingFrequency(group.meetingFrequency)}</p>
                                    </div>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-7 text-xs"
                                    onClick={() => {
                                      if (group?.availability) {
                                        setEditAvailabilityData(group.availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>);
                                      }
                                      if (group?.generalAvailability) {
                                        setEditAvailabilityNotes(group.generalAvailability);
                                      }
                                      if (group?.meetingFrequency) {
                                        const freq = group.meetingFrequency;
                                        // Handle both old ("1-week") and new ("1x week") formats
                                        if (freq.includes("-") || freq.includes("x ")) {
                                          const parts = freq.includes("x ") ? freq.split("x ") : freq.split("-");
                                          const [num, unit] = parts;
                                          setEditMeetingFreqNumber(parseInt(num));
                                          const trimmedUnit = unit?.trim() || "weeks";
                                          setEditMeetingFreqUnit(trimmedUnit.endsWith("s") ? trimmedUnit : trimmedUnit + "s");
                                        } else if (freq === "weekly") {
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
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>

                          {/* Time Selection Tabs */}
                          <Tabs value={scheduleMethod} onValueChange={(v) => {
                            setScheduleMethod(v as 'manual' | 'ai');
                            setAiTimeOptions([]);
                            setSelectedTimeOptionIds([]);
                          }} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-9">
                              <TabsTrigger value="manual" className="text-xs" data-testid="tab-manual-time">Pick Date/Time</TabsTrigger>
                              <TabsTrigger value="ai" className="text-xs" data-testid="tab-ai-time">AI Suggestions</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="manual" className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor="event-date" className="text-xs">Date</Label>
                                  <Input
                                    id="event-date"
                                    type="date"
                                    value={eventDate}
                                    onChange={(e) => setEventDate(e.target.value)}
                                    className="h-9"
                                    data-testid="input-event-date"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="event-time" className="text-xs">Time</Label>
                                  <Input
                                    id="event-time"
                                    type="time"
                                    value={eventTime}
                                    onChange={(e) => setEventTime(e.target.value)}
                                    className="h-9"
                                    data-testid="input-event-time"
                                  />
                                </div>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="ai" className="mt-4 space-y-3">
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

                              {getAiTimeSuggestionMutation.isPending && (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  Analyzing group availability...
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>
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
                                title: eventDates.length === 1 ? "Plan sent to group" : "Plan sent to group",
                                description: eventDates.length === 1 
                                  ? "Members can now RSVP to your itinerary"
                                  : `Sent with ${eventDates.length} time options - members can vote on their preferred time`,
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
              </div>
            </div>
          </TabsContent>
          {/* Tab 5: Feedback */}
          <TabsContent value="feedback" className="space-y-6">
            {feedbackLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : feedbackSummary && feedbackSummary.totalResponses > 0 ? (
              <div className="space-y-6">
                {/* Overview Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Feedback Overview
                    </CardTitle>
                    <CardDescription>
                      Patterns from {feedbackSummary.totalResponses} member {feedbackSummary.totalResponses === 1 ? 'response' : 'responses'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Budget Concerns */}
                    {feedbackSummary.budgetConcerns > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Budget concerns</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {feedbackSummary.budgetConcerns} {feedbackSummary.budgetConcerns === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                        <Progress 
                          value={(feedbackSummary.budgetConcerns / feedbackSummary.totalResponses) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Time Concerns */}
                    {feedbackSummary.timeConcerns > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Time doesn't work</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {feedbackSummary.timeConcerns} {feedbackSummary.timeConcerns === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                        <Progress 
                          value={(feedbackSummary.timeConcerns / feedbackSummary.totalResponses) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Location Concerns */}
                    {feedbackSummary.locationConcerns > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Location is inconvenient</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {feedbackSummary.locationConcerns} {feedbackSummary.locationConcerns === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                        <Progress 
                          value={(feedbackSummary.locationConcerns / feedbackSummary.totalResponses) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Activity Type Concerns */}
                    {feedbackSummary.activityTypeConcerns > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Not interested in these activities</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {feedbackSummary.activityTypeConcerns} {feedbackSummary.activityTypeConcerns === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                        <Progress 
                          value={(feedbackSummary.activityTypeConcerns / feedbackSummary.totalResponses) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Other Concerns */}
                    {feedbackSummary.otherConcerns > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Other reasons</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {feedbackSummary.otherConcerns} {feedbackSummary.otherConcerns === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                        <Progress 
                          value={(feedbackSummary.otherConcerns / feedbackSummary.totalResponses) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Post-Event Feedback Card */}
                {!postEventFeedbackLoading && postEventFeedbackSummary && postEventFeedbackSummary.totalResponses > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="h-5 w-5" />
                        Post-Event Feedback
                      </CardTitle>
                      <CardDescription>
                        Insights from {postEventFeedbackSummary.totalResponses} event {postEventFeedbackSummary.totalResponses === 1 ? 'attendee' : 'attendees'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Average Venue Rating */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-medium">Average venue rating</Label>
                          </div>
                          <span className="text-lg font-semibold">
                            {postEventFeedbackSummary.averageRating}/5
                          </span>
                        </div>
                      </div>

                      {/* Frequency Preferences */}
                      <div className="space-y-2">
                        <Label className="font-medium">Event frequency preferences</Label>
                        <div className="space-y-2">
                          {postEventFeedbackSummary.moreFrequent > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">More often</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.moreFrequent} {postEventFeedbackSummary.moreFrequent === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                          )}
                          {postEventFeedbackSummary.justRight > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">This is perfect</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.justRight} {postEventFeedbackSummary.justRight === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                          )}
                          {postEventFeedbackSummary.lessFrequent > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Less often</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.lessFrequent} {postEventFeedbackSummary.lessFrequent === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Willingness to Repeat */}
                      <div className="space-y-2">
                        <Label className="font-medium">Would do this again?</Label>
                        <div className="space-y-2">
                          {postEventFeedbackSummary.wouldDoAgainYes > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Yes</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.wouldDoAgainYes} {postEventFeedbackSummary.wouldDoAgainYes === 1 ? 'response' : 'responses'}
                              </span>
                            </div>
                          )}
                          {postEventFeedbackSummary.wouldDoAgainMaybe > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Maybe</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.wouldDoAgainMaybe} {postEventFeedbackSummary.wouldDoAgainMaybe === 1 ? 'response' : 'responses'}
                              </span>
                            </div>
                          )}
                          {postEventFeedbackSummary.wouldDoAgainNo > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm">No</span>
                              <span className="text-sm text-muted-foreground">
                                {postEventFeedbackSummary.wouldDoAgainNo} {postEventFeedbackSummary.wouldDoAgainNo === 1 ? 'response' : 'responses'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recent Improvement Suggestions */}
                      {postEventFeedbackSummary.recentComments && postEventFeedbackSummary.recentComments.length > 0 && (
                        <div className="space-y-2">
                          <Label className="font-medium">Recent improvement suggestions</Label>
                          <div className="space-y-3">
                            {postEventFeedbackSummary.recentComments.map((comment: any) => (
                              <div key={comment.id} className="border-l-2 border-primary/20 pl-4 py-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{comment.itineraryName}</span>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`h-3 w-3 ${i < comment.rating ? 'fill-current text-primary' : 'text-muted-foreground'}`} 
                                      />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                  "{comment.notes}"
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Recent Feedback Comments */}
                {feedbackSummary.recentFeedback && feedbackSummary.recentFeedback.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Recent Comments
                      </CardTitle>
                      <CardDescription>
                        Latest feedback from your group members
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {feedbackSummary.recentFeedback.map((item: any) => (
                        <div key={item.id} className="border-l-2 border-primary/20 pl-4 py-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.itineraryName}</span>
                            <Badge variant={item.response === 'yes' ? 'default' : item.response === 'maybe' ? 'secondary' : 'outline'}>
                              {item.response}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {item.feedback.notes && (
                            <p className="text-sm text-muted-foreground italic">
                              "{item.feedback.notes}"
                            </p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">No Feedback Yet</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Member feedback will appear here
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    When members RSVP with "maybe" or "can't make it" and provide feedback, you'll see patterns here to help plan better events.
                  </p>
                </CardContent>
              </Card>
            )}
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
          <DialogFooter className="gap-2">
            <div className="flex-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={deleteItineraryMutation.isPending}
                    data-testid="button-delete-itinerary"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Event
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="dialog-confirm-delete-itinerary">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this event. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (editingItinerary) {
                          deleteItineraryMutation.mutate(editingItinerary.id);
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-delete"
                    >
                      {deleteItineraryMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
      <Dialog open={addVenueDialogOpen} onOpenChange={(open) => {
        setAddVenueDialogOpen(open);
        if (!open) {
          setDialogVenueSearchQuery("");
          setVenuesToAdd([]);
        }
      }}>
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
                  value={dialogVenueSearchQuery}
                  onChange={(e) => setDialogVenueSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-dialog-venue-search"
                />
              </div>

              {/* Search Results */}
              {dialogVenueSearchQuery.trim() && dialogVenueSearchQuery.trim().length >= 2 && (
                <div className="space-y-2">
                  {dialogVenueSearchResults.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {dialogVenueSearchResults.map((result: any) => {
                        const isAlreadyInPlan = editItineraryItems.some((item: any) => {
                          if (item.sourceType === 'voting_event') {
                            const event = votingEvents.find(e => e.id === item.sourceId);
                            return event?.googlePlaceId === result.placeId;
                          } else if (item.sourceType === 'activity') {
                            const activity = activities.find(a => a.id === item.sourceId);
                            return activity?.googlePlaceId === result.placeId;
                          }
                          return false;
                        });

                        return (
                          <button
                            key={result.placeId}
                            onClick={async () => {
                              if (isAlreadyInPlan || addVotingEventMutation.isPending) return;
                              
                              try {
                                // Create voting event first
                                const newEvent = await addVotingEventMutation.mutateAsync({
                                  title: result.name,
                                  venueType: result.types?.[0] || 'venue',
                                  venueAddress: result.address,
                                  googlePlaceId: result.placeId,
                                });

                                // Then add to itinerary
                                if (editingItinerary && newEvent?.event?.id) {
                                  await addItineraryItemsMutation.mutateAsync({
                                    itineraryId: editingItinerary.id,
                                    items: [{ sourceType: 'voting_event', sourceId: newEvent.event.id }]
                                  });

                                  toast({
                                    title: "Venue added",
                                    description: `${result.name} has been added to your plan`,
                                  });

                                  // Clear search after successful add
                                  setDialogVenueSearchQuery("");
                                }
                              } catch (error) {
                                toast({
                                  title: "Error adding venue",
                                  description: "Please try again",
                                  variant: "destructive",
                                });
                              }
                            }}
                            disabled={isAlreadyInPlan || addVotingEventMutation.isPending}
                            className={`flex gap-3 p-3 rounded-md border text-left transition-all w-full ${
                              isAlreadyInPlan || addVotingEventMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'hover-elevate active-elevate-2 cursor-pointer'
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
                            {isAlreadyInPlan && (
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
                const meetingFrequency = `${editMeetingFreqNumber}x ${editMeetingFreqUnit.replace(/s$/, '')}`;
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
      {/* Invite Guest Dialog */}
      <Dialog open={inviteGuestDialogOpen} onOpenChange={setInviteGuestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Additional Guests</DialogTitle>
            <DialogDescription>
              Add guests to this event. Guests will be able to RSVP but won't affect the group's preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Guest Name *</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g., Sarah Johnson"
                data-testid="input-guest-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-email">Guest Email (Optional)</Label>
              <Input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="e.g., sarah@example.com"
                data-testid="input-guest-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Guest RSVP Response</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!guestName.trim()) {
                      toast({
                        title: "Name required",
                        description: "Please enter the guest's name",
                        variant: "destructive",
                      });
                      return;
                    }
                    inviteGuestMutation.mutate({
                      itineraryId: inviteGuestItineraryId!,
                      guestName: guestName.trim(),
                      guestEmail: guestEmail.trim(),
                      response: "yes",
                    });
                  }}
                  disabled={inviteGuestMutation.isPending || !guestName.trim()}
                  data-testid="button-guest-rsvp-yes"
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Yes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!guestName.trim()) {
                      toast({
                        title: "Name required",
                        description: "Please enter the guest's name",
                        variant: "destructive",
                      });
                      return;
                    }
                    inviteGuestMutation.mutate({
                      itineraryId: inviteGuestItineraryId!,
                      guestName: guestName.trim(),
                      guestEmail: guestEmail.trim(),
                      response: "maybe",
                    });
                  }}
                  disabled={inviteGuestMutation.isPending || !guestName.trim()}
                  data-testid="button-guest-rsvp-maybe"
                  className="flex-1"
                >
                  <Circle className="h-4 w-4 mr-2" />
                  Maybe
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!guestName.trim()) {
                      toast({
                        title: "Name required",
                        description: "Please enter the guest's name",
                        variant: "destructive",
                      });
                      return;
                    }
                    inviteGuestMutation.mutate({
                      itineraryId: inviteGuestItineraryId!,
                      guestName: guestName.trim(),
                      guestEmail: guestEmail.trim(),
                      response: "no",
                    });
                  }}
                  disabled={inviteGuestMutation.isPending || !guestName.trim()}
                  data-testid="button-guest-rsvp-no"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  No
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteGuestDialogOpen(false);
                setGuestName("");
                setGuestEmail("");
              }}
              data-testid="button-cancel-invite-guest"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Schedule Event with AI Dialog */}
      <Dialog open={schedulePromptDialogOpen} onOpenChange={setSchedulePromptDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Schedule Event with AI
            </DialogTitle>
            <DialogDescription>
              Describe what you want to do in natural language. For example: "tacos next week at night on weekday in the mission"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-prompt">What do you want to do?</Label>
              <Textarea
                id="schedule-prompt"
                value={schedulePrompt}
                onChange={(e) => setSchedulePrompt(e.target.value)}
                placeholder='e.g., "tacos next week with haas mission friends at night on weekday in mission"'
                className="min-h-24"
                data-testid="input-schedule-prompt"
              />
              <p className="text-xs text-muted-foreground">
                Include activity type, time preferences, location, and any other details
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSchedulePromptDialogOpen(false);
                setSchedulePrompt("");
              }}
              data-testid="button-cancel-schedule-prompt"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!schedulePrompt.trim()) {
                  toast({
                    title: "Prompt required",
                    description: "Please describe what you want to do",
                    variant: "destructive",
                  });
                  return;
                }
                
                setSchedulePromptLoading(true);
                try {
                  const response = await apiRequest("POST", `/api/groups/${groupId}/schedule-from-prompt`, {
                    prompt: schedulePrompt.trim(),
                  });
                  
                  toast({
                    title: "Event created!",
                    description: "Your event has been scheduled with AI-generated time options",
                  });
                  
                  // Refresh itineraries
                  await queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
                  
                  setSchedulePromptDialogOpen(false);
                  setSchedulePrompt("");
                } catch (error: any) {
                  toast({
                    title: "Error scheduling event",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setSchedulePromptLoading(false);
                }
              }}
              disabled={schedulePromptLoading || !schedulePrompt.trim()}
              data-testid="button-submit-schedule-prompt"
            >
              {schedulePromptLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Event
                </>
              )}
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
