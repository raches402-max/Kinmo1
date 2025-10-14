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
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus, Heart, Plus, X, ChevronDown, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, UtensilsCrossed, ChefHat, Croissant, Beer, ShoppingBasket, Palette, Film, Laugh, GraduationCap, Target, GripVertical, CheckCircle2, ShoppingCart } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { calculateDistance, getDistanceCategory, formatDistance } from "@/lib/distance";
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
function SortableItineraryItem({ item, index }: { item: any; index: number }) {
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
    </div>
  );
}

// Itinerary display component with drag-to-reorder
function ItineraryDisplay({ itinerary }: { itinerary: any }) {
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

  return (
    <div className="space-y-3">
      {itinerary.aiValidationNotes && (
        <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium mb-1">AI Notes:</p>
          <p>{itinerary.aiValidationNotes}</p>
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item: any, index: number) => (
            <SortableItineraryItem key={item.id} item={item} index={index} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableCartVenue({ id, index, venueName, venueType, photoUrl, onRemove, distanceToNext }: {
  id: string;
  index: number;
  venueName: string;
  venueType: string;
  photoUrl: string;
  onRemove: () => void;
  distanceToNext?: { distance: number; category: 'close' | 'moderate' | 'far' } | null;
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Track previous generation status to detect when generation completes
  const prevStatusRef = useRef<string | undefined>();
  
  useEffect(() => {
    if (group?.activityGenerationStatus === "completed" && 
        (prevStatusRef.current === "generating" || prevStatusRef.current === "pending")) {
      // Generation just completed - force refetch activities to show results immediately
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    }
    prevStatusRef.current = group?.activityGenerationStatus;
  }, [group?.activityGenerationStatus, groupId]);

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
      await apiRequest("PATCH", `/api/groups/${groupId}`, updates);
      
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      setEditGroupOpen(false);
      toast({
        title: "Group updated",
        description: "Your group details have been saved",
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
      setActiveTab("build");
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
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
      } else if (freq.includes("-")) {
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
      setEditAvailability(availability as any);
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
                      ? 'Select 2-5 venues to create your perfect evening. AI validates proximity and timing.'
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
                    <AvailabilityGrid 
                      value={editAvailability} 
                      onChange={setEditAvailability}
                    />
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

              {/* Members Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>Manage group members and invitations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                                  <p className="text-sm font-medium truncate">{member.name || "Member"}</p>
                                  {member.email && (
                                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                  )}
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
          <TabsContent value="activities" className="flex flex-col xl:flex-row gap-6">
            {/* Main Content - AI-Suggested Activities */}
            <div className="flex-1 space-y-6 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="text-2xl font-bold" data-testid="text-activities-title">AI-Suggested Activities</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Select venues to build your itinerary. Click the checkboxes to add venues to your plan.
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
                    {group?.searchRadius === 2 && "Nearby"}
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
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
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
                    
                    <Button
                      onClick={() => setShowSwipeSession(true)}
                      variant="outline"
                      data-testid="button-refine-ideas"
                    >
                      <Target className="mr-2 h-4 w-4" />
                      Refine Ideas
                    </Button>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activities.length === 0 || clearActivitiesMutation.isPending}
                        data-testid="button-clear-activities"
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all AI suggestions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all activity suggestions for this group. You can generate new ones anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => clearActivitiesMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
                      <p className="text-sm text-muted-foreground mb-6">
                        This usually takes 10-20 seconds
                      </p>
                      
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
                              <p className="text-xs text-muted-foreground">Select 2-5 venues to create your itinerary</p>
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
                                className="h-8 w-8 p-0"
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

            {/* Right Sidebar - Favorites Voting */}
            <div className="w-full xl:w-80 xl:flex-shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" data-testid="text-favorites-title">Favorites</h3>
                <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-add-favorite">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-add-favorite">
                    <DialogHeader>
                      <DialogTitle>Add to Favorites</DialogTitle>
                      <DialogDescription>
                        Add a place you'd like your group to vote on
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-title">Place Name</Label>
                        <Input
                          id="event-title"
                          value={newEventTitle}
                          onChange={(e) => setNewEventTitle(e.target.value)}
                          placeholder="e.g., The Blue Room"
                          data-testid="input-event-title"
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
                        data-testid="button-save-favorite"
                      >
                        {createEventMutation.isPending ? "Adding..." : "Add to Favorites"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Vote on favorites or add your own places
              </p>

              {/* Voting Events List */}
              <div className="space-y-2">
                {votingEventsLoading ? (
                  <Card>
                    <CardContent className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ) : votingEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Heart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No favorites yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Click + Add to create one</p>
                    </CardContent>
                  </Card>
                ) : (
                  votingEvents
                    .sort((a, b) => (b.netVotes || 0) - (a.netVotes || 0))
                    .map((event) => {
                      const myVote = myVotes[event.id];
                      const isSelected = selectedVenues.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id);
                      
                      // Show venueAddress or a fallback
                      const locationText = event.venueAddress || event.venueType || '';
                      
                      return (
                        <HoverCard key={event.id} openDelay={200}>
                          <HoverCardTrigger asChild>
                            <Card 
                              className={`hover-elevate transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
                              data-testid={`voting-event-${event.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2 mb-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleVenueSelection('voting_event', event.id)}
                                    className="h-5 w-5 mt-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`checkbox-event-${event.id}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate" data-testid={`text-event-title-${event.id}`}>
                                      {event.title}
                                    </h4>
                                    {locationText && (
                                      <p className="text-xs text-muted-foreground truncate">{locationText}</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="mb-2"></div>
                                
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant={myVote?.voteType === "upvote" ? "default" : "outline"}
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVote(event.id, "upvote");
                                    }}
                                    className="flex-1 gap-1 h-7 text-xs"
                                    data-testid={`button-upvote-${event.id}`}
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                    {event.upvotes || 0}
                                  </Button>
                                  <Button
                                    variant={myVote?.voteType === "downvote" ? "default" : "outline"}
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVote(event.id, "downvote");
                                    }}
                                    className="flex-1 gap-1 h-7 text-xs"
                                    data-testid={`button-downvote-${event.id}`}
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                    {event.downvotes || 0}
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => e.stopPropagation()}
                                        data-testid={`button-delete-event-${event.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove from Favorites?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently remove "{event.title}" from your group's favorites.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteEventMutation.mutate(event.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </CardContent>
                            </Card>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" side="left" align="start">
                            <div className="space-y-3">
                              {event.photoUrl && (
                                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                                  <img
                                    src={event.photoUrl}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mb-2">{event.description}</p>
                                )}
                                {event.venueAddress && (
                                  <p className="text-xs text-muted-foreground">{event.venueAddress}</p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {event.rating && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Star className="h-3 w-3 fill-current" />
                                    {event.rating}
                                    {event.reviewCount && ` (${event.reviewCount})`}
                                  </Badge>
                                )}
                                {event.priceLevel && (
                                  <Badge variant="secondary" className="text-xs">
                                    {priceDisplay(event.priceLevel)}
                                  </Badge>
                                )}
                                {event.venueType && (
                                  <Badge variant="outline" className="text-xs">{event.venueType}</Badge>
                                )}
                              </div>
                              
                              {event.googlePlaceId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="w-full"
                                >
                                  <a
                                    href={`https://www.google.com/maps/place/?q=place_id:${event.googlePlaceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid={`link-maps-event-${event.id}`}
                                  >
                                    <MapPin className="h-3 w-3 mr-2" />
                                    View on Google Maps
                                  </a>
                                </Button>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })
                )}
              </div>
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
                            
                            if (venue.sourceType === 'activity') {
                              const activity = activities.find(a => a.id === venue.sourceId);
                              venueName = activity?.venueName || 'Unknown';
                              venueType = activity?.venueType || '';
                              photoUrl = activity?.photoUrl || '';
                              lat = parseFloat(activity?.latitude || '0');
                              lng = parseFloat(activity?.longitude || '0');
                            } else {
                              const event = votingEvents.find(e => e.id === venue.sourceId);
                              venueName = event?.title || 'Unknown';
                              venueType = event?.venueType || '';
                              photoUrl = event?.photoUrl || '';
                              lat = parseFloat(event?.latitude || '0');
                              lng = parseFloat(event?.longitude || '0');
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
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <div className="p-3 border-t flex gap-2">
                      <Button
                        onClick={() => setActiveTab("build")}
                        disabled={selectedVenues.length < 2}
                        className="flex-1"
                        size="sm"
                        data-testid="button-build-itinerary-cart"
                      >
                        Build Itinerary
                      </Button>
                      <Button
                        onClick={() => setSelectedVenues([])}
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

          {/* Tab 3: Itinerary */}
          <TabsContent value="build" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Create Your Itinerary</h2>
                <p className="text-muted-foreground">
                  {selectedVenues.length > 0
                    ? "Select 2-5 venues from Activities or Favorites, then click Create Itinerary"
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
                          disabled={validateItineraryMutation.isPending || selectedVenues.length < 2}
                          variant="default"
                          size="sm"
                          data-testid="button-validate-itinerary-build"
                        >
                          {validateItineraryMutation.isPending ? "Validating..." : "Create Itinerary"}
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedVenues([]);
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
                          Your Evening Itinerary
                        </CardTitle>
                        <CardDescription className="mt-1">
                          AI has organized your selections - drag to reorder
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("activities")}
                        data-testid="button-add-more-stops"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add More Stops
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {itineraries.map((itinerary: any) => (
                      <ItineraryDisplay key={itinerary.id} itinerary={itinerary} />
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
            </div>
          </TabsContent>

          {/* Tab 4: Schedule */}
          <TabsContent value="schedule" className="space-y-6">
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Schedule Your Outing</CardTitle>
                <CardDescription className="text-base mt-2">
                  Coming Soon
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Date scheduling and RSVP collection - launching soon!
                </p>
              </CardContent>
            </Card>
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
