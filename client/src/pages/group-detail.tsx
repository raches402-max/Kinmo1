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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, MapPin, Star, DollarSign, Calendar, Mail, Share2, Copy, Check, Sparkles, ExternalLink, Flame, ThumbsUp, ThumbsDown, Clock, Ticket, Settings, Pencil, Trash2, UserPlus, Heart, Plus, X, ChevronDown, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, UtensilsCrossed, ChefHat, Croissant, Beer, ShoppingBasket, Palette, Film, Laugh, GraduationCap, Target, MessageCircle, GripVertical, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, Activity, Member, VotingEvent, Vote } from "@shared/schema";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
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

export default function GroupDetail() {
  const [, params] = useRoute("/group/:id");
  const groupId = params?.id;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tempInstructions, setTempInstructions] = useState("");
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editBudgetRange, setEditBudgetRange] = useState<number[]>([50, 250]);
  const [editCloseness, setEditCloseness] = useState(3);
  const [editNovelty, setEditNovelty] = useState(3);
  const [editAvailability, setEditAvailability] = useState(createEmptyAvailability());
  const [editFrequencyNumber, setEditFrequencyNumber] = useState(1);
  const [editFrequencyUnit, setEditFrequencyUnit] = useState("weeks");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editGroupData, setEditGroupData] = useState({
    name: "",
    locationBase: "",
    pastPreferences: "",
    additionalInstructions: ""
  });
  const [newMembers, setNewMembers] = useState<{ name: string; email: string }[]>([]);
  const [membersOpen, setMembersOpen] = useState(true);
  const [showSwipeSession, setShowSwipeSession] = useState(false);
  const [showEnrichmentConfirm, setShowEnrichmentConfirm] = useState(false);
  const [pendingEventTitle, setPendingEventTitle] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>>([]);

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

  // Itinerary validation mutation
  const validateItineraryMutation = useMutation({
    mutationFn: async (venues: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>) => {
      return await apiRequest("POST", `/api/groups/${groupId}/itineraries/validate`, { selectedVenues: venues });
    },
    onSuccess: () => {
      setSelectionMode(false);
      setSelectedVenues([]);
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
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

  const handleReadyClick = () => {
    if (selectedVenues.length < 2) {
      toast({
        title: "Select more venues",
        description: "Please select at least 2 venues for an itinerary",
        variant: "destructive",
      });
      return;
    }
    validateItineraryMutation.mutate(selectedVenues);
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
          <h1 className="text-xl font-semibold" data-testid="text-group-name">{group.name}</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Group Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Group Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Group Details</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={openEditGroup}
                    data-testid="button-edit-group"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.locationBase}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="text-sm font-medium">${group.budgetMin}-${group.budgetMax}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="text-sm font-medium">{formatMeetingFrequency(group.meetingFrequency)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Availability</p>
                  <p className="text-xs leading-relaxed">{formatAvailability(group.availability)}</p>
                </div>

                {/* Members Section */}
                <Collapsible open={membersOpen} onOpenChange={setMembersOpen} className="pt-2 border-t">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer hover-elevate -mx-2 px-2 py-1 rounded-md">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${membersOpen ? "" : "-rotate-90"}`} />
                        <div>
                          <p className="text-xs text-muted-foreground">Members</p>
                          <p className="text-sm font-medium">
                            {members.length} {members.length === 1 ? "member" : "members"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyShareLink();
                        }}
                        data-testid="button-copy-link"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    {membersLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : members.length > 0 ? (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center gap-2" data-testid={`member-${member.id}`}>
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{member.name || "Member"}</p>
                              {member.email && (
                                <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                              )}
                            </div>
                            {member.isOrganizer ? (
                              <Badge variant="secondary" className="text-[10px] h-5">Organizer</Badge>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    data-testid={`button-delete-member-${member.id}`}
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
                                    <AlertDialogCancel data-testid="button-cancel-delete-member">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMemberMutation.mutate(member.id)}
                                      data-testid="button-confirm-delete-member"
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
                    ) : (
                      <p className="text-xs text-muted-foreground">No members yet</p>
                    )}

                    {members.some(m => m.email && !m.invitationSent) && (
                      <div className="pt-2 mt-2 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full justify-start h-8 text-xs"
                          onClick={() => sendInvitationsMutation.mutate()}
                          disabled={sendInvitationsMutation.isPending}
                          data-testid="button-send-invitations"
                        >
                          <Mail className="mr-2 h-3 w-3" />
                          {sendInvitationsMutation.isPending ? "Sending..." : "Send Invitations"}
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Favorites Voting Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Favorites</CardTitle>
                    <CardDescription>Top 10 Events - Vote Now!</CardDescription>
                  </div>
                  <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-event">
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Event to Favorites</DialogTitle>
                        <DialogDescription>
                          Suggest an event for the group to vote on
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="event-title">Event Title</Label>
                          <Input
                            id="event-title"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            placeholder="e.g., Karaoke Night at Sing Sing"
                            data-testid="input-event-title"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createEventMutation.mutate({ title: newEventTitle })}
                          disabled={!newEventTitle.trim() || createEventMutation.isPending}
                          data-testid="button-submit-event"
                        >
                          {createEventMutation.isPending ? "Adding..." : "Add Event"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Confirmation Dialog when Google Places finds nothing */}
                  <Dialog open={showEnrichmentConfirm} onOpenChange={setShowEnrichmentConfirm}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Venue Not Found</DialogTitle>
                        <DialogDescription>
                          Google Places couldn't find "{pendingEventTitle}". This might be a private event or there might be a typo in the name.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Would you like to edit the details or add it anyway?
                        </p>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowEnrichmentConfirm(false);
                            setAddEventOpen(true);
                          }}
                          data-testid="button-edit-event-details"
                        >
                          Edit Details
                        </Button>
                        <Button
                          onClick={() => {
                            // Create the event with enrichment check skipped
                            createEventMutation.mutate({ 
                              title: pendingEventTitle, 
                              skipEnrichmentCheck: true 
                            });
                            setShowEnrichmentConfirm(false);
                          }}
                          disabled={createEventMutation.isPending}
                          data-testid="button-add-anyway"
                        >
                          {createEventMutation.isPending ? "Adding..." : "Add Anyway"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {votingEventsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : votingEvents.length > 0 ? (
                  <div className="space-y-2">
                    {votingEvents.map((event, index) => {
                      const currentVote = myVotes[event.id];
                      const hasUpvoted = currentVote?.voteType === 'upvote';
                      const hasDownvoted = currentVote?.voteType === 'downvote';
                      const isSelected = selectedVenues.some(v => v.sourceType === 'voting_event' && v.sourceId === event.id);
                      
                      return (
                        <Popover key={event.id}>
                          <PopoverTrigger asChild>
                            <div 
                              className={`flex items-center gap-1 p-2 rounded-md hover-elevate cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                              data-testid={`voting-event-${event.id}`}
                              onClick={(e) => {
                                if (selectionMode) {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleVenueSelection('voting_event', event.id);
                                }
                              }}
                            >
                              {selectionMode && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    toggleVenueSelection('voting_event', event.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4"
                                  data-testid={`checkbox-event-${event.id}`}
                                />
                              )}
                              {!selectionMode && <span className="text-xs font-medium text-muted-foreground w-5">#{index + 1}</span>}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{event.title}</p>
                                {extractCity(event.venueAddress) && (
                                  <p className="text-[10px] text-muted-foreground truncate">{extractCity(event.venueAddress)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant={hasUpvoted ? "default" : "ghost"}
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVote(event.id, 'upvote');
                                  }}
                                  data-testid={`button-upvote-${event.id}`}
                                >
                                  <ThumbsUp className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-[10px] font-medium w-4 text-center" data-testid={`upvote-count-${event.id}`}>
                                  {event.upvotes}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant={hasDownvoted ? "default" : "ghost"}
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVote(event.id, 'downvote');
                                  }}
                                  data-testid={`button-downvote-${event.id}`}
                                >
                                  <ThumbsDown className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-[10px] font-medium w-4 text-center" data-testid={`downvote-count-${event.id}`}>
                                  {event.downvotes}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <span className="text-[10px] font-bold w-6 text-center" data-testid={`net-votes-${event.id}`}>
                                  {event.netVotes > 0 ? `+${event.netVotes}` : event.netVotes}
                                </span>
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" side="right">
                            <Card className="border-0 shadow-none">
                              {event.photoUrl && (
                                <div className="aspect-video w-full overflow-hidden bg-muted">
                                  <img
                                    src={event.photoUrl}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <CardHeader className="space-y-3">
                                <div>
                                  <CardTitle className="text-lg">{event.title}</CardTitle>
                                  {event.description && (
                                    <CardDescription className="mt-2">{event.description}</CardDescription>
                                  )}
                                </div>
                                
                                {(event.rating || event.priceLevel || event.venueType || event.googlePlaceId) && (
                                  <div className="flex flex-wrap gap-2 items-center">
                                    {event.rating && (
                                      <Badge variant="secondary" className="gap-1" data-testid={`badge-rating-event-${event.id}`}>
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
                                    {event.googlePlaceId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                        data-testid={`button-google-link-event-${event.id}`}
                                      >
                                        <a
                                          href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${event.googlePlaceId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="gap-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Google
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {event.venueAddress && (
                                  <div className="text-sm text-muted-foreground flex items-start gap-2">
                                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{event.venueAddress}</span>
                                  </div>
                                )}

                                {event.aiReasoning && (
                                  <div className="text-sm bg-primary/5 rounded-md p-3">
                                    <p className="text-primary font-medium mb-2">Why we suggest this:</p>
                                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                                      {event.aiReasoning.split(/[.!]\s+/).filter(s => s.trim()).slice(0, 3).map((point, i) => (
                                        <li key={i} className="text-sm">{point.trim()}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {(event.priceEstimate || event.timeConstraints) && (
                                  <div className="space-y-2">
                                    {event.priceEstimate && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Ticket className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">Price:</span>
                                        <span className="text-muted-foreground">{event.priceEstimate}</span>
                                      </div>
                                    )}
                                    {event.timeConstraints && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">When:</span>
                                        <span className="text-muted-foreground">{event.timeConstraints}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(event.complementaryPlaceName || event.complementaryPlaceName2) && (
                                  <div className="bg-accent/20 rounded-md p-3">
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      Grab food nearby:
                                    </p>
                                    <div className="space-y-2">
                                      {event.complementaryPlaceName && (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{event.complementaryPlaceName}</p>
                                            {event.complementaryPlaceRating && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <Star className="h-3 w-3 fill-current text-yellow-500" />
                                                <span className="text-xs text-muted-foreground">{event.complementaryPlaceRating}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {event.complementaryPlaceName2 && (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{event.complementaryPlaceName2}</p>
                                            {event.complementaryPlaceRating2 && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <Star className="h-3 w-3 fill-current text-yellow-500" />
                                                <span className="text-xs text-muted-foreground">{event.complementaryPlaceRating2}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {event.googlePlaceId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="w-full"
                                  >
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${event.googlePlaceId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="gap-2"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      View on Google Maps
                                    </a>
                                  </Button>
                                )}
                              </CardHeader>
                            </Card>
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No events yet. Add one to get started!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Activities */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="text-2xl font-bold" data-testid="text-activities-title">AI-Suggested Activities</h2>
                {!selectionMode && (activities.length > 0 || votingEvents.length > 0) && (
                  <Button
                    onClick={() => setSelectionMode(true)}
                    variant="default"
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-ready"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    I'm Ready, Let's Do This!
                  </Button>
                )}
                {selectionMode && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="px-3 py-1">
                      {selectedVenues.length} / 5 selected
                    </Badge>
                    <Button
                      onClick={handleReadyClick}
                      disabled={validateItineraryMutation.isPending || selectedVenues.length < 2}
                      variant="default"
                      data-testid="button-validate-itinerary"
                    >
                      {validateItineraryMutation.isPending ? "Validating..." : "Create Itinerary"}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedVenues([]);
                      }}
                      variant="outline"
                      data-testid="button-cancel-selection"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground mb-4">
                {selectionMode 
                  ? "Select 2-5 venues to create your evening itinerary. AI will validate proximity, hours, and flow."
                  : "Personalized recommendations based on your group's preferences"
                }
              </p>

              {/* Itinerary Proposals Display */}
              {itineraries.length > 0 && !selectionMode && (
                <Card className="mb-6">
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
                    </div>
                  </CardHeader>
                  <CardContent>
                    {itineraries.map((itinerary: any) => (
                      <ItineraryDisplay key={itinerary.id} itinerary={itinerary} />
                    ))}
                  </CardContent>
                </Card>
              )}
              
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
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {group?.activityGenerationStatus === "generating" ? "Generating suggestions..." : "Finding perfect activities..."}
                      </h3>
                      <p className="text-muted-foreground">
                        Our AI is analyzing your group's preferences
                      </p>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <>
                {/* Group activities by time category */}
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

                  const groupedByTime = {
                    standard: filteredActivities.filter(a => a.timeCategory === 'standard'),
                    quick: filteredActivities.filter(a => a.timeCategory === 'quick'),
                    large: filteredActivities.filter(a => a.timeCategory === 'large'),
                  };

                  const timeCategoryLabels = {
                    standard: { icon: "🍽️", title: "STANDARD", subtitle: "1-3 hours" },
                    quick: { icon: "⚡", title: "QUICK", subtitle: "Under 90 min" },
                    large: { icon: "🎯", title: "EXPERIENCE", subtitle: "4+ hours" },
                  };

                  return (
                    <div className="space-y-8">
                      {(['standard', 'quick', 'large'] as const).map((category) => {
                        const categoryActivities = groupedByTime[category];
                        if (categoryActivities.length === 0) return null;

                        const label = timeCategoryLabels[category];
                        
                        return (
                          <div key={category} className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{label.icon}</span>
                              <div>
                                <h3 className="text-sm font-semibold tracking-wide">{label.title}</h3>
                                <p className="text-xs text-muted-foreground">{label.subtitle}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Card key={activity.id} className={`relative overflow-hidden hover-elevate transition-all flex flex-col ${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`} data-testid={`activity-${activity.id}`} onClick={() => selectionMode && toggleVenueSelection('activity', activity.id)}>
                      {activity.photoUrl && (
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                          <img
                            src={activity.photoUrl}
                            alt={activity.venueName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {selectionMode && (
                        <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVenueSelection('activity', activity.id)}
                            className="h-6 w-6 bg-white border-2"
                            data-testid={`checkbox-activity-${activity.id}`}
                          />
                        </div>
                      )}
                      {!selectionMode && (
                        <button
                          className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${
                            activity.feedback === "love"
                              ? "bg-pink-500/90 hover:bg-pink-600/90"
                              : "bg-black/40 hover:bg-black/60 border-2 border-white"
                          }`}
                          onClick={() => {
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
                      )}
                      <CardHeader className="space-y-3 flex-1 flex flex-col">
                        <div>
                          <CardTitle className="text-lg mb-2">{activity.venueName}</CardTitle>
                          <CardDescription className="line-clamp-2">{activity.description}</CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            {activity.rating && (
                              <Badge variant="secondary" className="gap-1" data-testid={`badge-rating-${activity.id}`}>
                                <Star className="h-3 w-3 fill-current" />
                                {activity.rating}
                                {activity.reviewCount && ` (${activity.reviewCount})`}
                              </Badge>
                            )}
                            {activity.priceLevel && (
                              <Badge variant="secondary">
                                {priceDisplay(activity.priceLevel)}
                              </Badge>
                            )}
                            <Badge variant="outline">{activity.venueType}</Badge>
                          </div>
                          {activity.googlePlaceId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              data-testid={`button-google-link-${activity.id}`}
                            >
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${activity.googlePlaceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Google
                              </a>
                            </Button>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{activity.venueAddress}</span>
                        </div>

                        {activity.googleReview && (
                          <div className="text-sm bg-primary/5 rounded-md p-3">
                            <p className="text-primary font-medium mb-2 flex items-center gap-2">
                              <MessageCircle className="h-4 w-4" />
                              Why we suggest this:
                            </p>
                            <p className="text-muted-foreground italic" data-testid={`text-review-${activity.id}`}>
                              {activity.googleReview}
                            </p>
                          </div>
                        )}

                        {(activity.priceEstimate || activity.timeConstraints) && (
                          <div className="space-y-2">
                            {activity.priceEstimate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Ticket className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Price:</span>
                                <span className="text-muted-foreground">{activity.priceEstimate}</span>
                              </div>
                            )}
                            {activity.timeConstraints && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">When:</span>
                                <span className="text-muted-foreground">{activity.timeConstraints}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {(activity.complementaryPlaceName || activity.complementaryPlaceName2) && (
                          <div className="bg-accent/20 rounded-md p-3">
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {complementaryLabel}
                            </p>
                            <div className="space-y-2">
                              {activity.complementaryPlaceName && (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{activity.complementaryPlaceName}</p>
                                    {activity.complementaryPlaceRating && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                                        <span className="text-xs text-muted-foreground">{activity.complementaryPlaceRating}</span>
                                      </div>
                                    )}
                                  </div>
                                  {activity.complementaryPlaceId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                      data-testid={`button-complementary-link-${activity.id}`}
                                    >
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.complementaryPlaceName)}&query_place_id=${activity.complementaryPlaceId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        View
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              )}
                              {activity.complementaryPlaceName2 && (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{activity.complementaryPlaceName2}</p>
                                    {activity.complementaryPlaceRating2 && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                                        <span className="text-xs text-muted-foreground">{activity.complementaryPlaceRating2}</span>
                                      </div>
                                    )}
                                  </div>
                                  {activity.complementaryPlaceId2 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                      data-testid={`button-complementary-link-2-${activity.id}`}
                                    >
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.complementaryPlaceName2)}&query_place_id=${activity.complementaryPlaceId2}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        View
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t mt-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Your feedback:</p>
                          <div className="flex gap-2">
                            <Button
                              variant={activity.feedback === "more" ? "default" : "outline"}
                              size="sm"
                              onClick={() => feedbackMutation.mutate({ activityId: activity.id, feedback: "more" })}
                              className="flex-1 gap-1"
                              data-testid={`button-more-${activity.id}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              More like this
                            </Button>
                            <Button
                              variant={activity.feedback === "less" ? "default" : "outline"}
                              size="sm"
                              onClick={() => feedbackMutation.mutate({ activityId: activity.id, feedback: "less" })}
                              className="flex-1 gap-1"
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
        </div>
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
