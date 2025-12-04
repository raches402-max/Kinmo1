import { useQuery, useMutation } from "@tanstack/react-query";
import { useGroupMutations } from "@/hooks/useGroupMutations";
import { useRoute, Link, useLocation } from "wouter";
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
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogDescription as DialogDescription, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogTrigger as DialogTrigger, ResponsiveDialogFooter as DialogFooter } from "@/components/ui/responsive-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus, Heart, Plus, X, ChevronDown, ChevronRight, ChevronLeft, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, UtensilsCrossed, ChefHat, Croissant, Beer, ShoppingBasket, Palette, Film, Laugh, GraduationCap, Target, GripVertical, CheckCircle2, Circle, XCircle, ShoppingCart, Search, ArrowUpDown, Save, Send, Bot, Bell, Edit2, Edit, Compass, Home, UserCheck, MessageCircle, TrendingUp, AlertCircle, Users, Loader2, Map as MapIcon, Info, MoreVertical, Zap, Brain } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { ReadOnlyAvailabilityGrid } from "@/components/ReadOnlyAvailabilityGrid";
import { GroupAvailabilityHeatmap } from "@/components/GroupAvailabilityHeatmap";
import { GroupBudgetInfluence } from "@/components/GroupBudgetInfluence";
import { AutoScheduleQueue } from "@/components/AutoScheduleQueue";
import { SwipeSession } from "@/components/SwipeSession";
import { FavoritesMap } from "@/components/FavoritesMap";
import { AddAdHocVenueDialog } from "@/components/AddAdHocVenueDialog";
import { GroupInsights } from "@/components/GroupInsights";
import { FeedbackTab } from "@/components/FeedbackTab";
import { UnifiedEventCreationModal } from "@/components/UnifiedEventCreationModal";
import { DiscoverVenuesModal } from "@/components/DiscoverVenuesModal";
import { VenueDiscoveryModule, type VenueData } from "@/components/venue-discovery";
import { AIAssistantModal } from "@/components/AIAssistantModal";
import { ItineraryDisplay, SortableItineraryItem } from "@/components/ItineraryDisplay";
import EventsTable from "@/components/EventsTable";
import { EventTimeline } from "@/components/EventTimeline";
import { DateFirstEventCreator } from "@/components/DateFirstEventCreator";
import { UnifiedEventSidebar } from "@/components/UnifiedEventSidebar";
import { mergeAndDeduplicateEvents, UnifiedEvent, formatVenueTypeForDisplay } from "@/lib/event-utils";
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
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PlanningInsightBanner } from "@/components/PlanningInsightBanner";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HomeTab, GroupDetailMobileNav, ActivitiesTab, SelectedVenuesCard, ItineraryCard, AddMoreStopsCard, TimeSelectionTabs, InlineSchedulingCard, SaveItineraryDialog, SendBackupDialog, InviteGuestDialog, AutoSchedulePreviewDialog, EditAvailabilityDialog, RsvpConstraintDialog, AddVenueDialog, EditGroupDialog, MembersSection } from "@/components/group-detail";
import { useItineraryEditor } from "@/hooks/useItineraryEditor";
import { useVenueSelection } from "@/hooks/useVenueSelection";
import { useSchedulingFlow } from "@/hooks/useSchedulingFlow";

// Type definition for user events
type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  openToHosting?: boolean;
  profileCompleted?: boolean;
};

type UserEvent = {
  inviteId: string;
  inviteToken: string;
  itineraryId: string | null;
  itineraryName: string;
  eventDate: string | null;
  status: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  groupTimezone: string | null;
  isOrganizer: boolean;
  isVirtual?: boolean;
  meetingFrequency?: string;
  hostMemberId: string | null;
  hostMemberName: string | null;
  currentUserMemberId: string | null;
  currentUserOpenToHosting: boolean;
  members: SafeMember[];
  rsvp: {
    response: string;
    rsvpFeedback: any;
    postEventFeedback: any;
  } | null;
  rsvpSummary: {
    yes: string[];
    maybe: string[];
    no: string[];
  };
  detailedRsvps: Array<{
    name: string;
    response: string;
    additionalAttendees: any[];
    numberOfKids: number;
    isGuest: boolean;
  }>;
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
    rating: string | null;
    googlePlaceId: string | null;
  }>;
  pendingGuestRsvps: Array<{
    id: string;
    guestName: string;
    response: string;
    additionalAttendees: any;
    numberOfKids: number;
  }>;
};

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

// ItineraryDisplay is now imported from @/components/ItineraryDisplay

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
        className="flex items-center gap-3 p-2 rounded-md bg-accent/20 border"
        data-testid={`cart-venue-${id}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/25 text-primary font-bold text-xs flex-shrink-0 cursor-grab active:cursor-grabbing"
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
          {formatVenueTypeForDisplay(venueType) && (
            <p className="text-xs text-muted-foreground truncate">{formatVenueTypeForDisplay(venueType)}</p>
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
                  alreadyAdded || addVenueLoading ? 'opacity-50' : ''
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

// Time-based event grouping utilities
type TimeCategory = 'Today' | 'Tomorrow' | 'This Week' | 'Next Week' | 'Later';

function getEventTimeCategory(eventDate: string | null): TimeCategory {
  if (!eventDate) return 'Later';

  const now = new Date();
  const event = new Date(eventDate);

  // Reset times to midnight for date comparison
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventMidnight = new Date(event.getFullYear(), event.getMonth(), event.getDate());

  const diffMs = eventMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffDays === 0) return 'Today';

  // Tomorrow
  if (diffDays === 1) return 'Tomorrow';

  // This week (next 7 days excluding today and tomorrow)
  if (diffDays >= 2 && diffDays <= 7) return 'This Week';

  // Next week (8-14 days)
  if (diffDays >= 8 && diffDays <= 14) return 'Next Week';

  // Everything else
  return 'Later';
}

function groupEventsByTime<T extends { eventDate: string | null }>(events: T[]): Map<TimeCategory, T[]> {
  const groups = new Map<TimeCategory, T[]>();
  const categoryOrder: TimeCategory[] = ['Today', 'Tomorrow', 'This Week', 'Next Week', 'Later'];

  // Initialize all categories
  categoryOrder.forEach(cat => groups.set(cat, []));

  // Group events
  events.forEach(event => {
    const category = getEventTimeCategory(event.eventDate);
    groups.get(category)?.push(event);
  });

  return groups;
}

export default function GroupDetail() {
  const [, params] = useRoute("/group/:id");
  const [, navigate] = useLocation();
  const groupId = params?.id;
  const { toast } = useToast();

  // Centralized mutations hook for simple mutations without local state callbacks
  const mutations = useGroupMutations({ groupId: groupId || '' });

  // Custom hooks for organized state management
  const itineraryEditor = useItineraryEditor();
  const venueSelection = useVenueSelection();
  const schedulingFlow = useSchedulingFlow();

  // Parse URL search params for auto-opening edit dialog
  const urlParams = new URLSearchParams(window.location.search);
  const editItineraryIdFromUrl = urlParams.get('edit');
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editBudgetRange, setEditBudgetRange] = useState<number[]>([50, 250]);
  const [activeTab, setActiveTab] = useState("home");
  const [createEventSubTab, setCreateEventSubTab] = useState("quick"); // quick (date-first), manual (venue-first), or auto
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
    accentColor: "#60A5FA",
    locationBase: "",
    pastPreferences: "",
    additionalInstructions: "",
    mealEnabled: true,
    cafeEnabled: true,
    drinksEnabled: true,
    dessertEnabled: true,
    experiencesEnabled: true,
    defaultQuorumThreshold: 50
  });
  const [newMembers, setNewMembers] = useState<{ name: string; email: string }[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [membersOpen, setMembersOpen] = useState(true);
  const [showSwipeSession, setShowSwipeSession] = useState(false);
  const [showEnrichmentConfirm, setShowEnrichmentConfirm] = useState(false);
  const [pendingEventTitle, setPendingEventTitle] = useState("");
  // selectedVenues state now managed by venueSelection hook (see legacy aliases below)
  const [regeneratingCategory, setRegeneratingCategory] = useState<string | null>(null);
  const [showAddAdHocDialog, setShowAddAdHocDialog] = useState(false);
  const [pendingAdHocItineraryId, setPendingAdHocItineraryId] = useState<string | null>(null);
  
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
  // addedSuggestionPlaceIds state now managed by venueSelection hook (see legacy aliases below)
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [debouncedVenueSearchQuery, setDebouncedVenueSearchQuery] = useState("");
  const [addMoreStopsOpen, setAddMoreStopsOpen] = useState(false);
  const [saveItineraryOpen, setSaveItineraryOpen] = useState(false);
  const [itineraryName, setItineraryName] = useState("");
  const [savingItineraryId, setSavingItineraryId] = useState<string | null>(null);
  const [timingRecommendations, setTimingRecommendations] = useState("");
  const [timingNotesOpen, setTimingNotesOpen] = useState(false);
  // Scheduling flow state now managed by schedulingFlow hook (see legacy aliases below)
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
  // Itinerary editor state now managed by itineraryEditor hook
  // Legacy aliases for compatibility during migration:
  const editItineraryOpen = itineraryEditor.isOpen;
  const setEditItineraryOpen = itineraryEditor.setIsOpen;
  const editingItinerary = itineraryEditor.editingItinerary;
  const editItineraryName = itineraryEditor.name;
  const setEditItineraryName = itineraryEditor.setName;
  const editItineraryItems = itineraryEditor.items;
  const setEditItineraryItems = itineraryEditor.setItems;
  const editTimingRecommendations = itineraryEditor.timingRecommendations;
  const setEditTimingRecommendations = itineraryEditor.setTimingRecommendations;
  const editProposedDate = itineraryEditor.proposedDate;
  const setEditProposedDate = itineraryEditor.setProposedDate;

  // Venue selection state now managed by venueSelection hook
  // Legacy aliases for compatibility during migration:
  const selectedVenues = venueSelection.selectedVenues;
  const setSelectedVenues = venueSelection.setVenues;
  const addedSuggestionPlaceIds = venueSelection.addedSuggestionPlaceIds;
  const setAddedSuggestionPlaceIds = venueSelection.setPlaceIds;

  // Scheduling flow state now managed by schedulingFlow hook
  // Legacy aliases for compatibility during migration:
  const aiTimeOptions = schedulingFlow.aiTimeOptions;
  const setAiTimeOptions = schedulingFlow.setAiTimeOptions;
  const selectedTimeOptionIds = schedulingFlow.selectedTimeOptionIds;
  const setSelectedTimeOptionIds = schedulingFlow.setSelectedTimeOptionIds;
  const editingOptionId = schedulingFlow.editingOptionId;
  const setEditingOptionId = schedulingFlow.setEditingOptionId;
  const aiTimeLoading = schedulingFlow.isAiTimeLoading;
  const setAiTimeLoading = schedulingFlow.setIsAiTimeLoading;
  const selectedItineraryForScheduling = schedulingFlow.selectedItinerary;
  const setSelectedItineraryForScheduling = (itinerary: any) => {
    if (itinerary) {
      schedulingFlow.openScheduling(itinerary);
    } else {
      schedulingFlow.closeScheduling();
    }
  };
  const scheduleMethod = schedulingFlow.scheduleMethod;
  const setScheduleMethod = schedulingFlow.setScheduleMethod;
  const eventDate = schedulingFlow.eventDate;
  const setEventDate = schedulingFlow.setEventDate;
  const eventTime = schedulingFlow.eventTime;
  const setEventTime = schedulingFlow.setEventTime;

  const [addVenueDialogOpen, setAddVenueDialogOpen] = useState(false);
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

  // Schedule flow state
  const [showInlineScheduling, setShowInlineScheduling] = useState(false);
  const [ephemeralItinerary, setEphemeralItinerary] = useState<any | null>(null);
  const [categoryLocation, setCategoryLocation] = useState("");
  const [categoryRadius, setCategoryRadius] = useState<number>(2);
  const [categoryResults, setCategoryResults] = useState<any[]>([]);
  const [multiVenueMode, setMultiVenueMode] = useState(false);
  
  // Event creation modal state
  const [eventCreationModalOpen, setEventCreationModalOpen] = useState(false);

  // Handle URL parameters for actions and tab navigation
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle ?action=schedule - open event creation modal
    if (params.get('action') === 'schedule') {
      setEventCreationModalOpen(true);
    }

    // Handle ?action=discover - open discover venues modal
    if (params.get('action') === 'discover') {
      setDiscoverVenuesModalOpen(true);
    }

    // Handle ?tab=build (or other tabs) - navigate to specific tab
    const tabParam = params.get('tab');
    if (tabParam && ['home', 'preferences', 'activities', 'build', 'feedback'].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    // Clean up URL after processing
    if (params.get('action') || params.get('tab')) {
      setTimeout(() => {
        window.history.replaceState({}, '', `/group/${groupId}`);
      }, 100);
    }
  }, [groupId]);

  // Discover venues modal state
  const [discoverVenuesModalOpen, setDiscoverVenuesModalOpen] = useState(false);

  // AI Assistant modal state
  const [aiAssistantModalOpen, setAiAssistantModalOpen] = useState(false);

  // Auto-schedule preview dialog state
  const [autoSchedulePreviewOpen, setAutoSchedulePreviewOpen] = useState(false);

  // Automation sidebar state
  const [automationSidebarCollapsed, setAutomationSidebarCollapsed] = useState(false);

  // Reset modal states when groupId changes to prevent cross-group state bleed
  useEffect(() => {
    setDiscoverVenuesModalOpen(false);
    setAiAssistantModalOpen(false);
    setAutoSchedulePreviewOpen(false);
    setEventCreationModalOpen(false);
  }, [groupId]);

  // Auto-refresh state for countdowns
  const [, forceUpdate] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper function to calculate next event date based on meeting frequency
  const calculateNextEventDate = (lastEventDate: string | null, frequencyNumber: number, frequencyUnit: string): Date => {
    const now = new Date();
    const startDate = lastEventDate ? new Date(lastEventDate) : now;

    // Calculate interval in days
    let intervalDays = 0;
    const unit = frequencyUnit.replace(/s$/, ''); // Remove trailing 's'

    switch (unit) {
      case 'day':
        intervalDays = 1 / frequencyNumber; // e.g., 2x day = every 0.5 days
        break;
      case 'week':
        intervalDays = 7 / frequencyNumber; // e.g., 1x week = every 7 days, 2x week = every 3.5 days
        break;
      case 'month':
        intervalDays = 30 / frequencyNumber; // e.g., 1x month = every 30 days
        break;
      case 'year':
        intervalDays = 365 / frequencyNumber;
        break;
      default:
        intervalDays = 30; // Default to monthly
    }

    const nextDate = new Date(startDate);
    nextDate.setDate(nextDate.getDate() + Math.round(intervalDays));

    // If calculated date is in the past (and we used lastEventDate), default to 30 days from now
    if (nextDate < now && lastEventDate) {
      const fallbackDate = new Date(now);
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      return fallbackDate;
    }

    return nextDate;
  };

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

  // Fetch user events filtered by this group (server-side filtering for better performance)
  const { data: groupEvents = [], isLoading: eventsLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user/events", { groupId }],
    queryFn: async () => {
      const response = await fetch(`/api/user/events?groupId=${groupId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
    enabled: !!user && !!groupId,
  });

  // Transform pending auto-events into UserEvent format and merge with regular events
  const autoEventsAsUserEvents: UserEvent[] = pendingAutoEvents.map((autoEvent: any) => ({
    inviteId: autoEvent.id,
    inviteToken: '',
    itineraryId: autoEvent.itineraryId,
    itineraryName: autoEvent.itinerary?.name || 'Auto-Generated Event',
    eventDate: autoEvent.proposedDate,
    status: autoEvent.status,
    groupId: groupId || '',
    groupName: group?.name || '',
    groupEmoji: group?.emoji || '🎉',
    groupAccentColor: group?.accentColor || null,
    groupTimezone: group?.timezone || null,
    isOrganizer: true, // Auto-events are always for organizers
    isAutoScheduled: true, // Custom flag to identify auto-events
    autoSendAt: autoEvent.autoSendAt, // Deadline for auto-send
    confidenceScore: autoEvent.confidenceScore,
    requiresReview: autoEvent.requiresReview,
    hostMemberId: null,
    hostMemberName: null,
    currentUserMemberId: members.find(m => m.userId === user?.id)?.id || null,
    currentUserOpenToHosting: false,
    members: [],
    rsvp: null,
    rsvpSummary: { yes: [], maybe: [], no: [] },
    detailedRsvps: [],
    items: autoEvent.itinerary?.items?.map((item: any) => ({
      id: item.id,
      venueName: item.venueName,
      venueType: item.venueType,
      venueAddress: item.venueAddress || '',
      photoUrl: item.photoUrl || null,
      rating: item.rating || null,
      googlePlaceId: item.googlePlaceId || null,
    })) || [],
    pendingGuestRsvps: [],
  } as UserEvent & { isAutoScheduled?: boolean; autoSendAt?: string; confidenceScore?: number; requiresReview?: boolean }));

  // Merge auto-events with regular events, deduplicating by itineraryId and date
  // Auto-events from the dedicated endpoint take priority (they have more complete data)
  const allGroupEvents = useMemo(() => {
    // Build set of itinerary IDs from auto-events to avoid duplicates
    const autoEventItineraryIds = new Set(
      autoEventsAsUserEvents
        .filter(e => e.itineraryId)
        .map(e => e.itineraryId)
    );

    const autoEventDates = new Set(
      autoEventsAsUserEvents.map(e =>
        e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : null
      ).filter(Boolean)
    );

    // Filter out groupEvents that duplicate auto-events (by itineraryId or date for virtual)
    const filteredGroupEvents = groupEvents.filter(e => {
      // Skip if this itinerary is already covered by an auto-event
      if (e.itineraryId && autoEventItineraryIds.has(e.itineraryId)) {
        return false;
      }

      // For virtual events, check if there's an auto-event for the same date
      if (e.isVirtual) {
        const eventDate = e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : null;
        if (eventDate && autoEventDates.has(eventDate)) {
          return false;
        }
      }

      return true;
    });

    return [...filteredGroupEvents, ...autoEventsAsUserEvents];
  }, [groupEvents, autoEventsAsUserEvents]);

  // Deduplicated events for EventTimeline (fixes duplicate display bug)
  const deduplicatedTimelineEvents = useMemo(() => {
    return mergeAndDeduplicateEvents(
      itineraries as any[],
      proposedItineraries as any[],
      pendingAutoEvents as any[]
    );
  }, [itineraries, proposedItineraries, pendingAutoEvents]);

  // Sorted auto-scheduled events for sidebar (chronological order)
  const sortedPendingAutoEvents = useMemo(() => {
    return [...pendingAutoEvents].sort((a: any, b: any) => {
      const aDate = a.proposedDate ? new Date(a.proposedDate).getTime() : Infinity;
      const bDate = b.proposedDate ? new Date(b.proposedDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [pendingAutoEvents]);

  // Categorize group events (including auto-events)
  // Memoize event categorization to prevent recalculation on unrelated state changes
  const { pendingInvites, guestApprovalEvents, upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    return {
      pendingInvites: allGroupEvents.filter(e => !e.isOrganizer && !e.rsvp && (!e.eventDate || new Date(e.eventDate) > now)),
      guestApprovalEvents: allGroupEvents.filter(e => e.isOrganizer && e.pendingGuestRsvps && e.pendingGuestRsvps.length > 0 && (!e.eventDate || new Date(e.eventDate) > now)),
      upcomingEvents: allGroupEvents.filter(e => {
        const isFutureOrTBD = !e.eventDate || new Date(e.eventDate) > now;
        if (e.isOrganizer) return isFutureOrTBD;
        return e.rsvp && e.rsvp.response !== 'no' && isFutureOrTBD;
      }),
      pastEvents: allGroupEvents.filter(e => e.eventDate && new Date(e.eventDate) <= now)
    };
  }, [allGroupEvents]);

  // Memoize grouped events to prevent recalculation on unrelated state changes
  const groupedUpcomingEvents = useMemo(() => {
    return groupEventsByTime(upcomingEvents);
  }, [upcomingEvents]);

  // State for expanded events in the table
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpand = useCallback((eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  // Check if user is group owner
  const isOwner = user?.id === group?.userId;

  // Get current user's member record in this group
  const currentUserMember = useMemo(() => {
    return members.find(m => m.userId === user?.id) || null;
  }, [members, user?.id]);

  // Sort members: current user appears last so you see who else is in the group first
  const sortedMembers = useMemo(() => {
    if (!user?.id) return members;

    // Separate current user from others
    const currentUser = members.find(m => m.userId === user.id);
    const otherMembers = members.filter(m => m.userId !== user.id);

    // Return others first, then current user at the end
    return currentUser ? [...otherMembers, currentUser] : otherMembers;
  }, [members, user?.id]);

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

  // Auto-refresh countdowns every minute
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-open edit dialog when URL contains ?edit=<itineraryId>
  useEffect(() => {
    if (editItineraryIdFromUrl && proposedItineraries.length > 0 && !itineraryEditor.isOpen) {
      const itinerary = proposedItineraries.find((it: any) => it.id === editItineraryIdFromUrl);
      if (itinerary) {
        itineraryEditor.openEditor(itinerary);

        // Clear URL parameter after opening (optional - keeps URL cleaner)
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [editItineraryIdFromUrl, proposedItineraries, itineraryEditor.isOpen]);

  // Fetch member group preferences
  const { data: memberPreferences } = useQuery({
    queryKey: ["/api/groups", groupId, "my-preferences"],
    enabled: !!user && !!groupId,
  });

  // Fetch all members' availability for the heatmap
  const { data: membersAvailabilityData } = useQuery<{
    membersAvailability: Array<{
      memberId: string;
      memberName: string;
      userId: string | null;
      availability: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> | null;
    }>;
    currentUserMemberId: string | null;
    totalMembers: number;
  }>({
    queryKey: ["/api/groups", groupId, "members-availability"],
    enabled: !!user && !!groupId,
  });

  // Fetch group members' budget data for GroupBudgetInfluence component
  const { data: membersBudgetsData } = useQuery<{
    membersBudgets: Array<{
      memberId: string;
      memberName: string;
      userId: string | null;
      budgetMin: number;
      budgetMax: number;
    }>;
    currentUserMemberId: string | null;
    groupBudgetMin: number;
    groupBudgetMax: number;
    totalMembers: number;
  }>({
    queryKey: ["/api/groups", groupId, "members-budgets"],
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
        accentColor: group.accentColor || "#60A5FA",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || "",
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true,
        defaultQuorumThreshold: group.defaultQuorumThreshold ?? 50
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

  const triggerAutoScheduleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/trigger-auto-schedule`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      toast({
        title: "Event created!",
        description: "Check the Pending Auto-Events section on the Home tab",
      });
    },
    onError: (error: any) => {
      const errorMsg = error.message || "";

      // Don't show error if it's just "not within window" - this is expected
      if (errorMsg.includes("Not within 10-day creation window")) {
        console.log("Auto-schedule trigger skipped - not within window");
        return;
      }

      // Graceful fallback: if AI can't generate, switch to manual creation
      const isConfigError = errorMsg.includes("No viable") ||
                            errorMsg.includes("not enabled") ||
                            errorMsg.includes("No venues");

      if (isConfigError) {
        // Missing prerequisites - fallback to manual creation
        toast({
          title: "Switching to manual creation",
          description: "Add venues or enable auto-scheduling first",
        });
        setActiveTab("build");
      } else {
        // Other error - show error but offer manual as alternative
        toast({
          title: "AI generation failed",
          description: "Try creating manually instead",
          variant: "destructive",
        });
        setActiveTab("build");
      }
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

  // deleteMemberMutation - now using mutations.deleteMember from useGroupMutations hook

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

  // toggleHostingMutation - now using mutations.toggleHosting from useGroupMutations hook

  // Itinerary validation mutation
  const validateItineraryMutation = useMutation({
    mutationFn: async (venues: Array<{sourceType: 'activity' | 'voting_event' | 'ad_hoc', sourceId: string, adHocData?: any}>) => {
      return await apiRequest("POST", `/api/groups/${groupId}/itineraries/validate`, { selectedVenues: venues });
    },
    onSuccess: async (data: any) => {
      setSelectedVenues([]);
      setAddedSuggestionPlaceIds(new Set()); // Clear tracking set
      setActiveTab("build");
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "nearby-suggestions"] });

      // Auto-show scheduling section after creating itinerary
      if (data.itinerary) {
        setEphemeralItinerary(data.itinerary);
        setSelectedItineraryForScheduling(data.itinerary);
        setShowInlineScheduling(true);

        // Scroll to scheduling section
        setTimeout(() => {
          document.getElementById('inline-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Validation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleVenueSelection = (sourceType: 'activity' | 'voting_event' | 'ad_hoc', sourceId: string, forceAdd: boolean = false) => {
    setSelectedVenues(prev => {
      // Allow duplicates: only remove if clicking the same venue in the UI (forceAdd=false and exists)
      // But allow adding the same venue multiple times when explicitly requested (forceAdd=true)
      if (!forceAdd) {
        const exists = prev.some(v => v.sourceType === sourceType && v.sourceId === sourceId);
        if (exists) {
          // Remove the first instance of this venue
          const indexToRemove = prev.findIndex(v => v.sourceType === sourceType && v.sourceId === sourceId);
          return prev.filter((_, idx) => idx !== indexToRemove);
        }
      }

      // Add venue (even if it already exists)
      if (prev.length >= 5) {
        toast({
          title: "Maximum reached",
          description: "You can select up to 5 venues",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, { sourceType, sourceId }];
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

  // deleteSavedItineraryMutation - now using mutations.deleteSavedItinerary from useGroupMutations hook

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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", { groupId }] });
      itineraryEditor.reset();
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", { groupId }] });
      itineraryEditor.reset();
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/events", { groupId }] });
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

  // voteMutation, removeVoteMutation - now using mutations.vote, mutations.removeVote from useGroupMutations hook

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
        mutations.removeVote.mutate(eventId);
      } else {
        mutations.vote.mutate({ eventId, voteType });
      }
    } else {
      mutations.vote.mutate({ eventId, voteType });
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
        accentColor: "#60A5FA",
        locationBase: group.locationBase,
        pastPreferences: group.pastPreferences || "",
        additionalInstructions: group.additionalInstructions || "",
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true,
        defaultQuorumThreshold: group.defaultQuorumThreshold ?? 50
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
      accentColor: editGroupData.accentColor,
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
      additionalInstructions: editGroupData.additionalInstructions,
      defaultQuorumThreshold: editGroupData.defaultQuorumThreshold
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
          <Button
            variant="ghost"
            size="sm"
            onClick={openEditGroup}
            data-testid="button-edit-group"
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: group.name || "Group" }
          ]}
          className="mb-4"
        />

        {/* Planning Agent Insights Banner */}
        {groupId && isOwner && (
          <PlanningInsightBanner groupId={groupId} />
        )}

        {/* Profile completion prompt for members who haven't set preferences */}
        {currentUserMember && !isOwner && (
          <ProfileCompletionBanner
            memberId={currentUserMember.id}
            hasAvailability={!!myPreferencesAvailability}
            hasBudget={!!myPreferencesBudget}
            onSetAvailability={() => {
              setActiveTab("preferences");
              setGroupSubTab("details");
            }}
            onSetBudget={() => {
              setActiveTab("preferences");
              setGroupSubTab("details");
            }}
            className="mb-4"
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-20 sm:pb-0">
          {/* Desktop tabs - hidden on mobile */}
          <TabsList className="hidden sm:grid w-full max-w-3xl mx-auto grid-cols-5">
            <TabsTrigger value="home" data-testid="tab-home">Home</TabsTrigger>
            <TabsTrigger value="preferences" data-testid="tab-preferences">Group</TabsTrigger>
            <TabsTrigger value="activities" data-testid="tab-activities">Explore</TabsTrigger>
            <TabsTrigger value="build" data-testid="tab-build">Create Event</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Insights</TabsTrigger>
          </TabsList>

          {/* Mobile bottom navigation */}
          <GroupDetailMobileNav
            activeTab={activeTab as "home" | "preferences" | "activities" | "build" | "feedback"}
            onTabChange={setActiveTab}
          />

          {/* Home Tab */}
          <TabsContent value="home" className="space-y-6">
            <HomeTab
              eventsLoading={eventsLoading}
              allGroupEvents={allGroupEvents}
              pendingInvites={pendingInvites}
              guestApprovalEvents={guestApprovalEvents}
              upcomingEvents={upcomingEvents}
              pastEvents={pastEvents}
              groupedUpcomingEvents={groupedUpcomingEvents}
              expandedEvents={expandedEvents}
              onToggleExpand={toggleEventExpand}
              onOpenEventCreation={() => setEventCreationModalOpen(true)}
              onOpenDiscoverVenues={() => setDiscoverVenuesModalOpen(true)}
            />
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
                  {/* Accordion-based Group Settings */}
                  <Accordion type="multiple" defaultValue={[]} className="space-y-6">

                    {/* Section 1: Basic Info (Always visible by default) */}
                    <AccordionItem value="basic-info" className="border rounded-lg">
                      <Card className="border-0">
                        <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/25 rounded-md">
                              <Settings className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2 text-base">
                                Basic Info
                                <Badge variant="outline" className="text-xs font-normal">
                                  For Everyone
                                </Badge>
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {editGroupData.name} • ${editBudgetRange[0]}-${editBudgetRange[1]} • {formatMeetingFrequency(`${editFrequencyNumber}x ${editFrequencyUnit}`)}
                              </CardDescription>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <CardContent className="space-y-4 pt-2">
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

                  {/* Group Color Palette */}
                  <div className="space-y-2">
                    {(() => {
                      // Curated palette with good variety - no duplicates
                      const colorPalette = [
                        // Row 1: Warm spectrum
                        { hex: '#E07A5F', name: 'Terracotta' },
                        { hex: '#E63946', name: 'Coral' },
                        { hex: '#F72585', name: 'Magenta' },
                        { hex: '#C9ADA7', name: 'Dusty Rose' },
                        { hex: '#E6B89C', name: 'Peach' },
                        { hex: '#F4A261', name: 'Marigold' },
                        { hex: '#EAB308', name: 'Sunflower' },
                        { hex: '#FACC15', name: 'Lemon' },
                        // Row 2: Earth & greens
                        { hex: '#BC6C25', name: 'Caramel' },
                        { hex: '#9C6644', name: 'Copper' },
                        { hex: '#78716C', name: 'Stone' },
                        { hex: '#606C38', name: 'Olive' },
                        { hex: '#84CC16', name: 'Lime' },
                        { hex: '#22C55E', name: 'Emerald' },
                        { hex: '#2A9D8F', name: 'Teal' },
                        { hex: '#14B8A6', name: 'Mint' },
                        // Row 3: Blues & purples
                        { hex: '#06B6D4', name: 'Cyan' },
                        { hex: '#0EA5E9', name: 'Sky' },
                        { hex: '#3B82F6', name: 'Blue' },
                        { hex: '#1D3557', name: 'Navy' },
                        { hex: '#6366F1', name: 'Indigo' },
                        { hex: '#8B5CF6', name: 'Violet' },
                        { hex: '#A855F7', name: 'Purple' },
                        { hex: '#7209B7', name: 'Grape' },
                        // Row 4: Neutrals & darks
                        { hex: '#EC4899', name: 'Pink' },
                        { hex: '#6B5B6E', name: 'Plum' },
                        { hex: '#64748B', name: 'Slate' },
                        { hex: '#475569', name: 'Charcoal' },
                        { hex: '#1F2937', name: 'Graphite' },
                        { hex: '#0F172A', name: 'Midnight' },
                        { hex: '#44403C', name: 'Espresso' },
                        { hex: '#292524', name: 'Coal' },
                      ];
                      const currentColor = editGroupData.accentColor || group?.accentColor || "#6B5B6E";
                      const currentColorName = colorPalette.find(c => c.hex.toUpperCase() === currentColor.toUpperCase())?.name || 'Custom';

                      return (
                        <Collapsible>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Label>Group Color</Label>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full border-2 border-background shadow-sm"
                                  style={{ backgroundColor: currentColor }}
                                />
                                <span className="text-sm text-muted-foreground">{currentColorName}</span>
                              </div>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                                Change
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="pt-3">
                            <div className="grid grid-cols-8 gap-2">
                              {colorPalette.map((color) => (
                                <button
                                  key={color.hex}
                                  type="button"
                                  onClick={() => setEditGroupData({ ...editGroupData, accentColor: color.hex })}
                                  className={`w-8 h-8 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                                    currentColor.toUpperCase() === color.hex.toUpperCase()
                                      ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                                      : ''
                                  }`}
                                  style={{ backgroundColor: color.hex }}
                                  title={color.name}
                                  data-testid={`color-swatch-${color.hex.slice(1)}`}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })()}
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
                                const uniqueBudgets: number[] = Object.keys(budgetCounts).map(Number);
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
                    {membersAvailabilityData && membersAvailabilityData.currentUserMemberId ? (
                      <GroupAvailabilityHeatmap
                        membersAvailability={membersAvailabilityData.membersAvailability.map(m => ({
                          memberId: m.memberId,
                          memberName: m.memberName,
                          availability: m.availability || createEmptyAvailability(),
                        }))}
                        currentMemberId={membersAvailabilityData.currentUserMemberId}
                        myAvailability={editAvailability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>}
                        onMyAvailabilityChange={(newAvailability) => {
                          setEditAvailability(newAvailability);
                        }}
                        showMemberDetails={true}
                        compact={true}
                        mobileMode="compact-week"
                      />
                    ) : (
                      <AvailabilityGrid
                        value={editAvailability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>}
                        onChange={setEditAvailability}
                      />
                    )}
                  </div>

                  {/* Default Quorum Threshold */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Default Quorum for Events</Label>
                      <span className="text-sm font-semibold text-primary">{editGroupData.defaultQuorumThreshold}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimum percentage of members needed to confirm an event. New events will use this as the default.
                    </p>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={editGroupData.defaultQuorumThreshold}
                      onChange={(e) => setEditGroupData({ ...editGroupData, defaultQuorumThreshold: parseInt(e.target.value) })}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-2xs text-muted-foreground">
                      <span>10%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                          </CardContent>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>

              {/* Section 2: Automation & Smart Features (Promoted to top, owner-only) */}
              {isOwner && (
                <AccordionItem value="automation" className="border rounded-lg">
                  <Card className="border-0 bg-primary/5">
                    <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-primary/25 rounded-md">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <span>Automation & Smart Features</span>
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                              ✨ AI-Powered
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {[
                              group?.autoActivitiesEnabled && "Auto-activities",
                              group?.autoItineraryEnabled && "Auto-itineraries",
                              group?.autoScheduleEnabled && "Auto-schedule"
                            ].filter(Boolean).join(" • ") || "Let AI handle planning"}
                          </CardDescription>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent className="space-y-4 pt-2">
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
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <Label htmlFor="auto-activities" className="cursor-pointer font-medium">
                              Auto-generate Activities
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm space-y-2">
                                <div className="font-semibold">How it works:</div>
                                <p className="text-muted-foreground">
                                  AI discovers new venues weekly matching your group's taste. It analyzes your feedback → finds similar places → adds them to your Activities tab.
                                </p>
                                <div className="text-xs text-muted-foreground pt-1 border-t">
                                  <strong>Example:</strong> Based on your ❤️ for Marufuku Ramen, AI might suggest Ippudo and Mensho Tokyo
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
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
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <Label htmlFor="auto-itinerary" className="cursor-pointer font-medium">
                              Auto-create Itinerary Drafts
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm space-y-2">
                                <div className="font-semibold">How it works:</div>
                                <p className="text-muted-foreground">
                                  AI builds 2-3 venue itineraries you can review and schedule. Priority: <strong>Saved plans</strong> → <strong>favorited venues</strong> → <strong>AI suggestions</strong>
                                </p>
                                <div className="text-xs text-muted-foreground pt-1 border-t">
                                  <strong>Example:</strong> Creates "Dinner at Ryoko's & Dessert at Bi-Rite" from your favorited venues
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>

                      {/* Auto-schedule Events */}
                      <div className="flex items-start gap-3 p-3 bg-background rounded-md">
                        <Switch
                          id="auto-schedule"
                          checked={group?.autoScheduleEnabled || false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Show preview dialog before enabling
                              setAutoSchedulePreviewOpen(true);
                            } else {
                              // Disable immediately without preview
                              toggleAutomationMutation.mutate({
                                field: 'autoScheduleEnabled',
                                value: false
                              });
                            }
                          }}
                          data-testid="switch-auto-schedule"
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <Label htmlFor="auto-schedule" className="cursor-pointer font-medium">
                              Auto-schedule Events
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm space-y-2">
                                <div className="font-semibold">How it works:</div>
                                <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
                                  <li><strong>10 days before target:</strong> AI creates a draft event</li>
                                  <li><strong>48-hour window:</strong> Members marked "open to hosting" can volunteer</li>
                                  <li><strong>Auto-sends:</strong> If no one volunteers, AI sends the event automatically</li>
                                </ul>
                                <p className="text-muted-foreground text-xs">
                                  <strong>Content:</strong> Saved plans → favorites → viable activities
                                </p>
                                <div className="text-xs text-muted-foreground pt-1 border-t">
                                  <strong>What does hosting mean?</strong> The host sends event details to the group and coordinates attendance.
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
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
                                variant="ghost" 
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
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              )}

              {/* Section 3: Activity Preferences (Collapsed by default) */}
              <AccordionItem value="preferences" className="border rounded-lg">
                <Card className="border-0">
                  <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 bg-muted rounded-md">
                        <Target className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">Activity Preferences</CardTitle>
                        <CardDescription className="text-xs">
                          {noveltyLabels[editNovelty - 1]} • {[
                            editGroupData.mealEnabled !== false && "Meals",
                            editGroupData.cafeEnabled !== false && "Cafes",
                            editGroupData.drinksEnabled !== false && "Drinks",
                            editGroupData.dessertEnabled !== false && "Dessert",
                            editGroupData.experiencesEnabled !== false && "Experiences"
                          ].filter(Boolean).join(", ")}
                        </CardDescription>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-6 pt-2">
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
                  </AccordionContent>
                </Card>
              </AccordionItem>

            </Accordion>

              {/* Members Section (Always visible, outside accordion) */}
              <>
              <MembersSection
                members={members}
                sortedMembers={sortedMembers}
                user={user}
                isOwner={isOwner}
                editingMemberId={editingMemberId}
                setEditingMemberId={setEditingMemberId}
                editMemberData={editMemberData}
                setEditMemberData={setEditMemberData}
                newMembers={newMembers}
                addNewMember={addNewMember}
                updateNewMember={updateNewMember}
                removeNewMember={removeNewMember}
                onUpdateMember={(memberId, data) => updateMemberMutation.mutate({ memberId, data })}
                isUpdatingMember={updateMemberMutation.isPending}
                onToggleHosting={(memberId, openToHosting) => mutations.toggleHosting.mutate({ memberId, openToHosting })}
                onDeleteMember={(memberId) => mutations.deleteMember.mutate(memberId)}
                onSendInvitations={() => sendInvitationsMutation.mutate()}
                isSendingInvitations={sendInvitationsMutation.isPending}
              />

              {/* AI Preference Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Preference Learning
                  </CardTitle>
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
              </>

                  {/* Save Button for Group Settings - Primary CTA */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleUpdateGroup}
                      disabled={updateGroupMutation.isPending}
                      size="lg"
                      className="min-w-[200px]"
                      data-testid="button-save-group"
                    >
                      {updateGroupMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Group Settings
                        </>
                      )}
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
                        {membersBudgetsData && membersBudgetsData.currentUserMemberId ? (
                          <GroupBudgetInfluence
                            membersBudgets={membersBudgetsData.membersBudgets}
                            currentMemberId={membersBudgetsData.currentUserMemberId}
                            groupBudgetMin={membersBudgetsData.groupBudgetMin}
                            groupBudgetMax={membersBudgetsData.groupBudgetMax}
                            myBudget={myPreferencesBudget}
                            onMyBudgetChange={(budget) => {
                              setMyPreferencesBudget(budget);
                              // Auto-save when budget changes
                              updateMyPreferencesMutation.mutate({
                                budgetOverrideMin: budget?.min ?? null,
                                budgetOverrideMax: budget?.max ?? null,
                              });
                              // Invalidate the members-budgets query to refresh
                              queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members-budgets"] });
                            }}
                          />
                        ) : (
                          <>
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
                                </div>
                                <div className="text-sm font-medium" data-testid="text-my-budget">
                                  ${myPreferencesBudget.min}-{myPreferencesBudget.max >= 200 ? "$200+" : `$${myPreferencesBudget.max}`}
                                </div>
                              </div>
                            )}
                          </>
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
                        {membersAvailabilityData && membersAvailabilityData.currentUserMemberId ? (
                          <GroupAvailabilityHeatmap
                            membersAvailability={membersAvailabilityData.membersAvailability.map(m => ({
                              memberId: m.memberId,
                              memberName: m.memberName,
                              availability: m.availability || createEmptyAvailability(),
                            }))}
                            currentMemberId={membersAvailabilityData.currentUserMemberId}
                            myAvailability={myPreferencesAvailability || createEmptyAvailability()}
                            onMyAvailabilityChange={(newAvailability) => {
                              setMyPreferencesAvailability(newAvailability);
                              // Auto-save when availability changes
                              updateMyPreferencesMutation.mutate({
                                availabilityOverride: newAvailability,
                              });
                              // Invalidate the members-availability query to refresh the heatmap
                              queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members-availability"] });
                            }}
                            showMemberDetails={true}
                            mobileMode="compact-week"
                          />
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-base font-medium">My Availability</Label>
                            <AvailabilityGrid
                              value={myPreferencesAvailability || createEmptyAvailability()}
                              onChange={setMyPreferencesAvailability}
                            />
                          </div>
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

          {/* Tab 2: Explore (Venue Discovery) */}
          <TabsContent value="activities" className="space-y-6">
            <ActivitiesTab
              groupId={groupId || ""}
              groupLocation={group?.locationBase || ""}
              onCreateEvent={(venues: VenueData[]) => {
                const venuesForValidation = venues.map((v, index) => ({
                  sourceType: 'ad_hoc' as const,
                  sourceId: `temp-${v.googlePlaceId || index}`,
                  adHocData: {
                    name: v.name,
                    address: v.address,
                    googlePlaceId: v.googlePlaceId,
                    googleMapsUrl: v.googleMapsUrl,
                    venueType: v.venueType || v.category || 'venue',
                  }
                }));
                validateItineraryMutation.mutate(venuesForValidation);
              }}
              onStartSwipe={() => setDiscoverVenuesModalOpen(true)}
              showSummaryStrip={true}
              groupContext={{
                name: group?.name || "Group",
                emoji: group?.emoji || "👥",
                memberCount: members?.length,
              }}
              timezone={group?.timezone ?? undefined}
            />
          </TabsContent>

          {/* Tab 3: Itinerary */}
          <TabsContent value="build" className="space-y-5">
            {/* Event Timeline - Command Center */}
            <EventTimeline
              groupId={groupId || ""}
              groupName={group?.name || "Group"}
              groupTimezone={group?.timezone || undefined}
              itineraries={deduplicatedTimelineEvents.map((event) => ({
                id: event.id,
                name: event.name,
                status: event.status,
                eventDate: event.eventDate || undefined,
                inviteSentAt: event.inviteSentAt,
                hostMemberName: event.hostMemberName,
                items: event.items.map((item) => ({
                  id: item.id,
                  venueName: item.venueName || "Venue",
                  venueAddress: item.venueAddress,
                  venueType: item.venueType,
                  photoUrl: item.photoUrl,
                })),
                rsvpCount: event.rsvpCount,
                confidenceScore: event.confidenceScore,
                autoSendAt: event.autoSendAt,
              }))}
              onCreateEvent={() => setEventCreationModalOpen(true)}
              onEditItinerary={(id) => {
                const itinerary = [...itineraries, ...proposedItineraries].find((it: any) => it.id === id);
                if (itinerary) {
                  itineraryEditor.openEditor(itinerary);
                }
              }}
              onSendInvites={(id) => {
                const itinerary = [...itineraries, ...proposedItineraries].find((it: any) => it.id === id);
                if (itinerary) {
                  setSelectedItineraryForScheduling(itinerary);
                  setShowInlineScheduling(true);
                }
              }}
              isAutoScheduleEnabled={group?.autoItineraryEnabled}
            />

            {/* Sub-tabs for Manual vs Auto Schedule */}
            <Tabs value={createEventSubTab} onValueChange={setCreateEventSubTab} className="space-y-6">
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
                <TabsTrigger value="quick">Quick Create</TabsTrigger>
                <TabsTrigger value="manual">From Venues</TabsTrigger>
                <TabsTrigger value="auto">Auto Schedule</TabsTrigger>
              </TabsList>

              {/* Quick Create Tab - Date-First Flow */}
              <TabsContent value="quick" className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
                  {/* Main Content - Calendar */}
                  <DateFirstEventCreator
                    groupId={groupId || ""}
                    groupLocation={group?.locationBase || ""}
                    events={deduplicatedTimelineEvents}
                    onEventCreated={(eventId) => {
                      queryClient.invalidateQueries({
                        queryKey: ["/api/groups", groupId, "itineraries"],
                      });
                    }}
                    onSendInvites={(eventId) => {
                      const itinerary = itineraries.find((it: any) => it.id === eventId);
                      if (itinerary) {
                        setSelectedItineraryForScheduling(itinerary);
                        setShowInlineScheduling(true);
                      }
                    }}
                  />

                  {/* Sidebar - Unified Event List */}
                  <UnifiedEventSidebar
                    events={deduplicatedTimelineEvents}
                    isLoading={itinerariesLoading}
                    onEventClick={(event) => {
                      const itinerary = [...itineraries, ...proposedItineraries].find((it: any) => it.id === event.id);
                      if (itinerary) {
                        itineraryEditor.openEditor(itinerary);
                      }
                    }}
                    onEditEvent={(event) => {
                      const itinerary = [...itineraries, ...proposedItineraries].find((it: any) => it.id === event.id);
                      if (itinerary) {
                        itineraryEditor.openEditor(itinerary);
                      }
                    }}
                    onSendInvites={(event) => {
                      const itinerary = itineraries.find((it: any) => it.id === event.id);
                      if (itinerary) {
                        setSelectedItineraryForScheduling(itinerary);
                        setShowInlineScheduling(true);
                      }
                    }}
                    showCreateButton={false}
                    className="hidden lg:block"
                  />
                </div>
              </TabsContent>

              {/* Manual Event Creation Tab - Venue-First Flow */}
              <TabsContent value="manual" className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
                  {/* Main Content */}
                  <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">Create Event</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedVenues.length > 0
                        ? "Select 1-5 venues, then create your itinerary"
                        : itineraries.length > 0
                          ? "Your itinerary is ready — drag to reorder"
                          : "Browse Activities to select venues for your event"
                      }
                    </p>
                  </div>

              {/* Selected Venues Display */}
              <SelectedVenuesCard
                selectedVenues={selectedVenues}
                resolveVenue={(venue) => {
                  if (venue.sourceType === 'activity') {
                    const activity = activities.find(a => a.id === venue.sourceId);
                    return { name: activity?.venueName || 'Unknown', type: activity?.venueType || '', isAdHoc: false };
                  } else if (venue.sourceType === 'voting_event') {
                    const event = votingEvents.find(e => e.id === venue.sourceId);
                    return { name: event?.title || 'Unknown', type: event?.venueType || '', isAdHoc: false };
                  } else {
                    return { name: venue.adHocData?.name || 'Custom Location', type: venue.adHocData?.address || '', isAdHoc: true };
                  }
                }}
                onAddCustomVenue={() => setShowAddAdHocDialog(true)}
                onClearSelection={() => {
                  setSelectedVenues([]);
                  setAddedSuggestionPlaceIds(new Set());
                }}
                onCreateItinerary={() => validateItineraryMutation.mutate(selectedVenues)}
                onRemoveVenue={toggleVenueSelection}
                isCreating={validateItineraryMutation.isPending}
              />


              {/* Itinerary Display */}
              {selectedVenues.length === 0 && (
                <ItineraryCard
                  itineraries={itineraries}
                  groupId={groupId!}
                  showInlineScheduling={showInlineScheduling}
                  addMoreStopsOpen={addMoreStopsOpen}
                  onSaveItinerary={(id) => {
                    setSavingItineraryId(id);
                    setSaveItineraryOpen(true);
                  }}
                  onToggleAddMoreStops={() => setAddMoreStopsOpen(!addMoreStopsOpen)}
                />
              )}

              {/* Inline Scheduling Section */}
              {showInlineScheduling && selectedItineraryForScheduling && (
                <InlineSchedulingCard
                  group={group}
                  formatMeetingFrequency={formatMeetingFrequency}
                  scheduleMethod={scheduleMethod}
                  onMethodChange={setScheduleMethod}
                  eventDate={eventDate}
                  onEventDateChange={setEventDate}
                  eventTime={eventTime}
                  onEventTimeChange={setEventTime}
                  aiTimeOptions={aiTimeOptions}
                  onAiTimeOptionsChange={setAiTimeOptions}
                  selectedTimeOptionIds={selectedTimeOptionIds}
                  onSelectedTimeOptionIdsChange={setSelectedTimeOptionIds}
                  onToggleTimeOption={(optionId) => {
                    setSelectedTimeOptionIds(prev =>
                      prev.includes(optionId)
                        ? prev.filter(id => id !== optionId)
                        : [...prev, optionId]
                    );
                  }}
                  onGetAiSuggestions={() => {
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
                  isLoadingAi={getAiTimeSuggestionMutation.isPending}
                  onSaveForLater={() => {
                    if (ephemeralItinerary) {
                      setSavingItineraryId(ephemeralItinerary.id);
                      setSaveItineraryOpen(true);
                    }
                  }}
                  onSendToGroup={async () => {
                    if (!selectedItineraryForScheduling) return;

                    const eventDates: string[] = [];

                    if (scheduleMethod === 'manual' && eventDate && eventTime) {
                      eventDates.push(new Date(`${eventDate}T${eventTime}:00`).toISOString());
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

                      // Reset inline scheduling
                      setShowInlineScheduling(false);
                      setSelectedItineraryForScheduling(null);
                      setEphemeralItinerary(null);
                      setEventDate("");
                      setEventTime("19:00");
                      setAiTimeOptions([]);
                      setSelectedTimeOptionIds([]);

                      toast({
                        title: "Plan sent to group",
                        description: eventDates.length === 1
                          ? "Members can now RSVP to your itinerary"
                          : `Sent with ${eventDates.length} time options - members can vote on their preferred time`,
                      });
                    } catch (error) {
                      // Error toast is handled by mutation
                    }
                  }}
                  isSending={sendItineraryMutation.isPending}
                  testIdPrefix="inline"
                />
              )}

              {/* Add More Stops Search - Collapsible */}
              {itineraries.length > 0 && addMoreStopsOpen && (
                <AddMoreStopsCard
                  venueSearchQuery={venueSearchQuery}
                  onSearchQueryChange={setVenueSearchQuery}
                  venueSearchResults={venueSearchResults}
                  isVenueInItinerary={(placeId) =>
                    itineraries.some((itinerary: any) =>
                      itinerary.items?.some((item: any) => {
                        if (item.sourceType === 'voting_event') {
                          const votingEvent = votingEvents.find(e => e.id === item.sourceId);
                          return votingEvent?.googlePlaceId === placeId;
                        } else if (item.sourceType === 'activity') {
                          const activity = activities.find(a => a.id === item.sourceId);
                          return activity?.googlePlaceId === placeId;
                        }
                        return false;
                      })
                    )
                  }
                  isVenueAlreadyAdded={(placeId) =>
                    activities.some(a => !a.archivedAt && a.googlePlaceId === placeId) ||
                    votingEvents.some(e => e.googlePlaceId === placeId) ||
                    addedSuggestionPlaceIds.has(placeId)
                  }
                  onAddVenue={(result) => {
                    addVotingEventMutation.mutate({
                      title: result.name,
                      venueType: result.types?.[0] || 'venue',
                      venueAddress: result.address,
                      googlePlaceId: result.placeId,
                      photoUrl: result.photoUrl,
                      rating: result.rating?.toString(),
                      reviewCount: result.reviewCount,
                      priceLevel: result.priceLevel?.toString(),
                      latitude: result.location?.lat?.toString(),
                      longitude: result.location?.lng?.toString(),
                      city: result.city,
                    });
                  }}
                  isAddingVenue={addVotingEventMutation.isPending}
                  onGoToActivities={() => {
                    setActiveTab("activities");
                    setAddMoreStopsOpen(false);
                  }}
                />
              )}

              {/* Venue Search - Empty State */}
              {selectedVenues.length === 0 && itineraries.length === 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Search className="h-5 w-5" />
                          Search for Venues
                        </CardTitle>
                        <CardDescription>
                          Search for restaurants, cafes, parks, or any venue to add to your itinerary
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => setShowAddAdHocDialog(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                      >
                        <MapPin className="h-4 w-4" />
                        Add Custom
                      </Button>
                    </div>
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
                                  className={`flex gap-3 p-3 rounded-md border text-left transition-all ${
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
                  <Card className="mt-8 border-2 border-primary/20 bg-primary/15" data-testid="enhanced-nearby-suggestions">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/25 flex items-center justify-center flex-shrink-0">
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
                            className={`flex gap-3 p-3 rounded-md border text-left transition-all ${
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
                          {savedItineraries.filter((itinerary: any) => itinerary.id).map((itinerary: any) => (
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
                                  {!!group?.availability && (
                                    <div className="space-y-1.5">
                                      <p className="text-xs font-medium text-muted-foreground">Group Availability</p>
                                      <ReadOnlyAvailabilityGrid 
                                        value={group.availability as Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>} 
                                        compact={true}
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
                          <TimeSelectionTabs
                            scheduleMethod={scheduleMethod}
                            onMethodChange={(method) => {
                              setScheduleMethod(method);
                              setAiTimeOptions([]);
                              setSelectedTimeOptionIds([]);
                            }}
                            eventDate={eventDate}
                            onEventDateChange={setEventDate}
                            eventTime={eventTime}
                            onEventTimeChange={setEventTime}
                            aiTimeOptions={aiTimeOptions}
                            selectedTimeOptionIds={selectedTimeOptionIds}
                            onToggleTimeOption={(optionId) => {
                              setSelectedTimeOptionIds(prev =>
                                prev.includes(optionId)
                                  ? prev.filter(id => id !== optionId)
                                  : [...prev, optionId]
                              );
                            }}
                            onGetAiSuggestions={() => {
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
                            onGetDifferentOptions={async () => {
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
                            isLoadingAi={getAiTimeSuggestionMutation.isPending}
                            editable={true}
                            editingOptionId={editingOptionId}
                            onEditOption={setEditingOptionId}
                            onUpdateOption={(optionId, updates) => {
                              setAiTimeOptions(prev => prev.map(opt =>
                                opt.id === optionId ? { ...opt, ...updates } : opt
                              ));
                            }}
                            timezone={group?.timezone || (group?.locationBase ? getTimezoneIdentifier(group.locationBase) : 'America/Los_Angeles')}
                            timezoneName={getTimezoneName(group?.timezone || (group?.locationBase ? getTimezoneIdentifier(group.locationBase) : 'America/Los_Angeles'))}
                          />
                        </div>

                        {/* Send Button */}
                        <Button
                          onClick={async () => {
                            if (!selectedItineraryForScheduling) return;
                            
                            const eventDates: string[] = [];
                            
                            if (scheduleMethod === 'manual' && eventDate && eventTime) {
                              eventDates.push(new Date(`${eventDate}T${eventTime}:00`).toISOString());
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

              {/* Automation Sidebar */}
            {group?.autoScheduleEnabled && (
              <div className="space-y-4 lg:block hidden">
                <Collapsible
                  open={!automationSidebarCollapsed}
                  onOpenChange={(open) => setAutomationSidebarCollapsed(!open)}
                >
                  <Card className="border-primary/30 bg-primary/[0.02] sticky top-4 shadow-subtle">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-3 cursor-pointer hover:bg-primary/15 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <div className="flex items-center gap-1.5">
                              <CardTitle className="text-base">Auto-scheduling</CardTitle>
                              <span className="text-xs text-muted-foreground">
                                · Every {editFrequencyNumber} {editFrequencyUnit}{editFrequencyNumber !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              ON
                            </Badge>
                            {automationSidebarCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {/* Next Event Section */}
                        {group?.nextEventDueDate && (() => {
                          const nextDue = new Date(group.nextEventDueDate);
                          const now = new Date();
                          const daysAway = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                          const dateStr = nextDue.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: nextDue.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                          });

                          const countdownStr = daysAway === 0 ? 'today' :
                                              daysAway === 1 ? 'tomorrow' :
                                              daysAway > 0 && daysAway <= 14 ? `${daysAway} days away` : '';

                          // Get favorited venues (includes both activities and voting events/Favorites)
                          // Combine activities and voting events, then sort by quality
                          const activityVenues = activities
                            ?.filter((a: any) => !a.archivedAt)
                            .map((a: any) => ({
                              name: a.venueName,
                              type: 'activity' as const,
                              score: a.feedback === 'love' || a.feedback === 'favorite' ? 3 : a.feedback === 'more_like_this' ? 2 : 1
                            })) || [];

                          const votingEventVenues = votingEvents
                            ?.filter((ve: any) => ve.netVotes >= 0) // Only include non-downvoted favorites
                            .map((ve: any) => ({
                              name: ve.title,
                              type: 'voting_event' as const,
                              score: 2 + Math.min(ve.netVotes * 0.5, 1.5) // Base score 2, up to 3.5 with upvotes
                            })) || [];

                          const favoritedActivities = [...activityVenues, ...votingEventVenues]
                            .sort((a, b) => b.score - a.score) // Sort by score descending
                            .slice(0, 3);

                          return (
                            <div className="space-y-3">
                              {/* Next Event Label */}
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Next Event
                                </span>
                              </div>

                              {/* Date with countdown inline */}
                              <div className="text-sm font-medium">
                                {dateStr}
                                {countdownStr && (
                                  <span className="text-xs text-muted-foreground font-normal"> · {countdownStr}</span>
                                )}
                              </div>

                              {/* Smart "Using" Display */}
                              <div className="flex items-start gap-2 text-xs">
                                {itineraries && itineraries.length > 0 ? (
                                  <>
                                    <span className="text-base">📋</span>
                                    <div className="flex-1">
                                      <span className="text-muted-foreground">Using:</span>
                                      <span className="ml-1 font-medium">{itineraries[0].name}</span>
                                    </div>
                                  </>
                                ) : favoritedActivities.length > 0 ? (
                                  <>
                                    <span className="text-base">🏆</span>
                                    <div className="flex-1">
                                      <span className="text-muted-foreground">Top venues:</span>
                                      <span className="ml-1 font-medium">
                                        {favoritedActivities[0].name}
                                        {favoritedActivities.length > 1 && ` +${favoritedActivities.length - 1}`}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-base">💡</span>
                                    <div className="flex-1 text-muted-foreground">
                                      Favorite venues to customize auto-scheduling
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Section C: Upcoming Events Pipeline */}
                        {sortedPendingAutoEvents && sortedPendingAutoEvents.length > 0 && (
                          <div className="border-t pt-4 space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">Upcoming Events</span>
                                <Badge variant="outline" className="text-xs">
                                  {sortedPendingAutoEvents.length} scheduled
                                </Badge>
                              </div>
                              {sortedPendingAutoEvents.length > 0 && sortedPendingAutoEvents[sortedPendingAutoEvents.length - 1]?.proposedDate && (
                                <p className="text-xs text-muted-foreground">
                                  Events through {new Date(sortedPendingAutoEvents[sortedPendingAutoEvents.length - 1].proposedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                              {sortedPendingAutoEvents.map((event: any, index: number) => {
                                const proposedDate = event.proposedDate ? new Date(event.proposedDate) : null;
                                const now = new Date();
                                const isNext = index === 0;

                                // Calculate days until event
                                let daysUntil = 0;
                                if (proposedDate) {
                                  const diffMs = proposedDate.getTime() - now.getTime();
                                  daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                }

                                return (
                                  <div
                                    key={event.id}
                                    className={`bg-background rounded-md p-3 space-y-2 border ${isNext ? 'border-primary/50 bg-primary/5' : 'border-transparent'}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 space-y-1">
                                        {proposedDate && (
                                          <p className="text-sm font-medium">
                                            {proposedDate.toLocaleDateString('en-US', {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric',
                                              year: proposedDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                                            })}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                          {daysUntil <= 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                                        </p>
                                      </div>
                                      {isNext && (
                                        <Badge variant="secondary" className="text-xs">
                                          Next
                                        </Badge>
                                      )}
                                    </div>
                                    {event.itinerary?.items && event.itinerary.items.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {event.itinerary.items[0].venueName}
                                        {event.itinerary.items.length > 1 && ` +${event.itinerary.items.length - 1} more`}
                                      </p>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      Status: {event.status === 'pending_approval' ? 'Awaiting approval' : event.status.replace('_', ' ')}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => setActiveTab('home')}
                            >
                              View All on Home
                            </Button>
                          </div>
                        )}

                        {/* Footer Info */}
                        {(!sortedPendingAutoEvents || sortedPendingAutoEvents.length === 0) && group?.nextEventDueDate && (
                          <div className="border-t pt-4">
                            <p className="text-xs text-muted-foreground">
                              AI creates events 10 days before target
                            </p>
                          </div>
                        )}

                        {/* Manage Automation Button */}
                        <div className="border-t pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs w-full justify-center gap-1.5 hover:bg-primary/25"
                            onClick={() => setActiveTab('preferences')}
                          >
                            <span>⚙️</span>
                            Manage automation
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            )}
            </div>
              </TabsContent>

              {/* Auto Schedule Tab */}
              <TabsContent value="auto" className="space-y-5">
                <AutoScheduleQueue
                  groupId={group.id}
                  isOrganizer={isOwner}
                  onNavigateToTab={(tab) => {
                    // Handle nested tabs
                    if (tab === 'favorites') {
                      setActiveTab('activities');
                      setActivitiesSubTab('favorites');
                    } else {
                      setActiveTab(tab);
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
          {/* Tab 5: Feedback */}
          <TabsContent value="feedback" className="space-y-6">
            {groupId && <FeedbackTab groupId={groupId} />}
          </TabsContent>
        </Tabs>
      </div>
      {/* Edit Group Dialog */}
      <EditGroupDialog
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
        initialData={editGroupData}
        initialBudgetRange={[editBudgetRange[0], editBudgetRange[1]]}
        initialFrequencyNumber={editFrequencyNumber}
        initialFrequencyUnit={editFrequencyUnit}
        initialNovelty={editNovelty}
        initialCategories={editCategories}
        initialAvailability={editAvailability}
        initialGeneralAvailability={editGeneralAvailability}
        members={members}
        onSave={({ updates, newMembers: validNewMembers }) => {
          updateGroupMutation.mutate({ updates, newMembers: validNewMembers });
        }}
        onDeleteMember={(memberId) => mutations.deleteMember.mutate(memberId)}
        isSaving={updateGroupMutation.isPending}
      />

      {/* Save Itinerary Dialog */}
      <SaveItineraryDialog
        open={saveItineraryOpen}
        onOpenChange={(open) => {
          setSaveItineraryOpen(open);
          if (!open) setSavingItineraryId(null);
        }}
        onSave={(data) => {
          if (savingItineraryId) {
            saveItineraryMutation.mutate({
              itineraryId: savingItineraryId,
              name: data.name,
              timingRecommendations: data.timingRecommendations,
            });
          }
        }}
        isSaving={saveItineraryMutation.isPending}
      />
      {/* RSVP Constraint Dialog */}
      <RsvpConstraintDialog
        open={rsvpConstraintOpen}
        onOpenChange={(open) => {
          setRsvpConstraintOpen(open);
          if (!open) setRsvpItineraryId(null);
        }}
        onSubmit={(constraintText) => {
          if (rsvpItineraryId) {
            createRsvpMutation.mutate({
              itineraryId: rsvpItineraryId,
              response: 'yes_with_constraint',
              constraintText
            });
          }
        }}
        isSubmitting={createRsvpMutation.isPending}
      />
      {/* Send Backup Dialog */}
      <SendBackupDialog
        open={sendBackupOpen}
        onOpenChange={(open) => {
          setSendBackupOpen(open);
          if (!open) setBackupForItineraryId(null);
        }}
        savedItineraries={savedItineraries}
        onSend={(savedItineraryId) => {
          if (backupForItineraryId) {
            sendBackupMutation.mutate({
              savedItineraryId,
              originalItineraryId: backupForItineraryId
            });
          }
        }}
        isSending={sendBackupMutation.isPending}
      />
      {/* Edit Itinerary Dialog */}
      <Dialog
        open={itineraryEditor.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            itineraryEditor.reset();
          } else {
            itineraryEditor.setIsOpen(open);
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
                          editable={true}
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
      <AddVenueDialog
        open={addVenueDialogOpen}
        onOpenChange={setAddVenueDialogOpen}
        groupId={groupId || ""}
        activities={activities}
        votingEvents={votingEvents}
        currentItineraryItems={editItineraryItems}
        editingItineraryId={editingItinerary?.id || null}
        onAddFromSearch={async (result) => {
          try {
            const newEvent = await addVotingEventMutation.mutateAsync({
              title: result.name,
              venueType: result.types?.[0] || 'venue',
              venueAddress: result.address,
              googlePlaceId: result.placeId,
            });
            if (editingItinerary && newEvent?.event?.id) {
              await addItineraryItemsMutation.mutateAsync({
                itineraryId: editingItinerary.id,
                items: [{ sourceType: 'voting_event', sourceId: newEvent.event.id }]
              });
              toast({
                title: "Venue added",
                description: `${result.name} has been added to your plan`,
              });
            }
          } catch (error) {
            toast({
              title: "Error adding venue",
              description: "Please try again",
              variant: "destructive",
            });
          }
        }}
        onAddSelected={(items) => {
          if (!editingItinerary) return;
          addItineraryItemsMutation.mutate({
            itineraryId: editingItinerary.id,
            items
          });
        }}
        isAddingFromSearch={addVotingEventMutation.isPending}
        isAddingSelected={addItineraryItemsMutation.isPending}
      />
      {/* Edit Availability Dialog */}
      <EditAvailabilityDialog
        open={editAvailabilityOpen}
        onOpenChange={setEditAvailabilityOpen}
        initialAvailability={editAvailabilityData}
        initialFrequencyNumber={editMeetingFreqNumber}
        initialFrequencyUnit={editMeetingFreqUnit}
        initialNotes={editAvailabilityNotes}
        onSave={(data) => {
          updateGroupMutation.mutate({
            updates: data,
            newMembers: []
          });
        }}
        isSaving={updateGroupMutation.isPending}
      />
      {/* Invite Guest Dialog */}
      <InviteGuestDialog
        open={inviteGuestDialogOpen}
        onOpenChange={setInviteGuestDialogOpen}
        onInvite={(data) => {
          if (inviteGuestItineraryId) {
            inviteGuestMutation.mutate({
              itineraryId: inviteGuestItineraryId,
              ...data,
            });
          }
        }}
        isInviting={inviteGuestMutation.isPending}
        onValidationError={(message) => {
          toast({
            title: "Name required",
            description: message,
            variant: "destructive",
          });
        }}
      />

      {/* Auto-schedule Preview Dialog */}
      <AutoSchedulePreviewDialog
        open={autoSchedulePreviewOpen}
        onOpenChange={setAutoSchedulePreviewOpen}
        frequencyNumber={editFrequencyNumber}
        frequencyUnit={editFrequencyUnit}
        lastEventDate={group?.lastEventDate || null}
        calculateNextEventDate={calculateNextEventDate}
        suggestedPlanName={itineraries && itineraries.length > 0 ? itineraries[0].name : undefined}
        favoritedVenueCount={activities?.filter((a: any) => a.feedback === 'love' || a.feedback === 'favorite').length || 0}
        onConfirm={async (withinTriggerWindow) => {
          await toggleAutomationMutation.mutateAsync({
            field: 'autoScheduleEnabled',
            value: true
          });
          if (withinTriggerWindow) {
            await triggerAutoScheduleMutation.mutateAsync();
          }
        }}
        isEnabling={toggleAutomationMutation.isPending || triggerAutoScheduleMutation.isPending}
      />

      {/* Event Creation Modal */}
      {groupId && (
        <UnifiedEventCreationModal
          open={eventCreationModalOpen}
          onOpenChange={setEventCreationModalOpen}
          groupId={groupId}
          onOpenScheduleModal={(_groupId) => {
            // Trigger AI auto-generation immediately
            triggerAutoScheduleMutation.mutate();
          }}
          onNavigateToManualTab={(_groupId) => setActiveTab("build")}
          onOpenDiscoverVenues={(_groupId) => setDiscoverVenuesModalOpen(true)}
        />
      )}

      {/* Discover Venues Modal */}
      {groupId && (
        <DiscoverVenuesModal
          open={discoverVenuesModalOpen}
          onOpenChange={setDiscoverVenuesModalOpen}
          groupId={groupId}
          groupLocation={group?.locationBase}
          onStartSwipeSession={() => setShowSwipeSession(true)}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* AI Assistant Modal */}
      <AIAssistantModal
        open={aiAssistantModalOpen}
        onOpenChange={setAiAssistantModalOpen}
        onOpenScheduleModal={() => setEventCreationModalOpen(true)}
        onOpenDiscoverModal={() => setDiscoverVenuesModalOpen(true)}
      />

      {/* Swipe Session Dialog */}
      {groupId && (
        <SwipeSession
          groupId={groupId}
          open={showSwipeSession}
          onOpenChange={setShowSwipeSession}
          onComplete={() => {
            setShowSwipeSession(false);
            toast({
              title: "Discovery Complete!",
              description: "Your favorites have been updated. Check the Favorites tab!",
            });
            // Refresh voting events to show newly added favorites
            queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
          }}
        />
      )}

      {/* Add Ad-hoc Venue Dialog */}
      <AddAdHocVenueDialog
        open={showAddAdHocDialog}
        onOpenChange={setShowAddAdHocDialog}
        itineraryId={pendingAdHocItineraryId || undefined}
        onAdd={(venueData) => {
          // Add to shopping cart
          const tempId = `temp-${Date.now()}`;
          setSelectedVenues(prev => [...prev, {
            sourceType: 'ad_hoc',
            sourceId: tempId,
            adHocData: venueData
          }]);
        }}
        onSuccess={() => {
          // When adding to existing itinerary
          if (pendingAdHocItineraryId) {
            queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
            setPendingAdHocItineraryId(null);
          }
        }}
      />

      {/* Floating AI Assistant Button */}
      <Button
        onClick={() => setAiAssistantModalOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
        data-testid="button-ai-assistant"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    </div>
  );
}
