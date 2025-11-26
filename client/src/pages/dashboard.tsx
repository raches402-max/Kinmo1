// Reference: javascript_log_in_with_replit blueprint
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Sparkles, Users, MapPin, Calendar, CheckCircle, XCircle, HelpCircle, ExternalLink, Settings, LogOut, MoreVertical, ChevronDown, ChevronUp, ChevronRight, Pencil, Trash2, FolderOpen, UserCheck, Bot, UserPlus, Star, MessageSquare, Copy, Check, Baby } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast, ErrorDisplay } from "@/components/ErrorDisplay";
import { LoadingState, SkeletonCard } from "@/components/LoadingState";
import type { Group, User, UserProfile, GroupCollection } from "@shared/schema";
import { useState, useEffect, useMemo } from "react";
import EventsTable from "@/components/EventsTable";
import { GroupCard } from "@/components/GroupCard";
import { DraggableGroupCard } from "@/components/DraggableGroupCard";
import { Header } from "@/components/Header";
import { UnifiedEventCreationModal } from "@/components/UnifiedEventCreationModal";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  userId?: string | null;
  isOrganizer?: boolean;
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
  inviteSentAt: string | null;
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

// Date grouping utilities
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

function groupEventsByTime(events: UserEvent[]): Map<TimeCategory, UserEvent[]> {
  const groups = new Map<TimeCategory, UserEvent[]>();
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

// Group events by group (for "By Group" sort mode)
type GroupedByGroup = {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  groupAccentColor: string | null;
  events: UserEvent[];
  nextEventDate: Date | null;
};

function groupEventsByGroup(events: UserEvent[]): GroupedByGroup[] {
  // Group events by groupId
  const grouped = new Map<string, UserEvent[]>();
  events.forEach(event => {
    if (!grouped.has(event.groupId)) {
      grouped.set(event.groupId, []);
    }
    grouped.get(event.groupId)!.push(event);
  });

  // Convert to array with metadata
  const result = Array.from(grouped.entries()).map(([groupId, groupEvents]) => {
    // Sort events within group by date
    const sortedEvents = [...groupEvents].sort((a, b) => {
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });

    const firstEvent = sortedEvents[0];
    return {
      groupId,
      groupName: firstEvent.groupName,
      groupEmoji: firstEvent.groupEmoji,
      groupAccentColor: firstEvent.groupAccentColor,
      events: sortedEvents,
      nextEventDate: firstEvent.eventDate ? new Date(firstEvent.eventDate) : null
    };
  });

  // Sort groups by next event date (soonest first)
  return result.sort((a, b) => {
    if (!a.nextEventDate) return 1;
    if (!b.nextEventDate) return -1;
    return a.nextEventDate.getTime() - b.nextEventDate.getTime();
  });
}

export default function Dashboard() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameCollectionName, setRenameCollectionName] = useState("");
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [isPastEventsExpanded, setIsPastEventsExpanded] = useState(false);
  const [showArchivedEvents, setShowArchivedEvents] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Drag-and-drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create event dialog state
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Event sort mode state
  const [eventSortMode, setEventSortMode] = useState<'date' | 'group'>('date');

  // Tab state from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "my-events";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab state with URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get("tab") || "my-events";
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [window.location.search]);

  // Onboarding checklist state
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem('onboardingDismissed') === 'true';
  });

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem('onboardingDismissed', 'true');
  };
  
  // Test account switcher dialog state
  const [showTestAccountDialog, setShowTestAccountDialog] = useState(false);
  
  // Feedback dialog state (for RSVP feedback)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState<{event: UserEvent, response: string} | null>(null);
  const [budgetConcern, setBudgetConcern] = useState(false);
  const [timeConcern, setTimeConcern] = useState(false);
  const [locationConcern, setLocationConcern] = useState(false);
  const [activityTypeConcern, setActivityTypeConcern] = useState(false);
  const [otherConcern, setOtherConcern] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  
  // Post-event feedback dialog state
  const [showPostEventFeedback, setShowPostEventFeedback] = useState(false);
  const [postEventData, setPostEventData] = useState<UserEvent | null>(null);
  const [actuallyAttended, setActuallyAttended] = useState<string>(""); // "yes" or "no"
  const [venueRating, setVenueRating] = useState<number>(0);
  const [frequencyPreference, setFrequencyPreference] = useState<string>("");
  const [wouldDoAgain, setWouldDoAgain] = useState<string>("");
  const [improvementNotes, setImprovementNotes] = useState("");
  
  // Test account switcher state (admin only)
  const isAdmin = user?.email === 'raches402@gmail.com';
  const { data: testAccounts = [] } = useQuery<Array<{id: string, email: string, firstName: string | null, lastName: string | null}>>({
    queryKey: ["/api/admin/test-accounts"],
    enabled: isAdmin,
  });
  
  const { data: groups = [], isLoading, error: groupsError, refetch: refetchGroups } = useQuery<Array<Group & { members: SafeMember[] }>>({
    queryKey: ["/api/user/groups"],
    enabled: !!user,
  });

  const { data: collections = [], isLoading: collectionsLoading, error: collectionsError, refetch: refetchCollections } = useQuery<GroupCollection[]>({
    queryKey: ["/api/user/collections"],
    enabled: !!user,
  });

  const { data: rawEvents = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery<UserEvent[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
    retry: 1,
    retryDelay: 1000,
  });

  // Deduplicate events by itineraryId (client-side safety check)
  const events = useMemo(() => {
    const seen = new Map<string, UserEvent>();

    for (const event of rawEvents) {
      if (event.itineraryId) {
        // Only keep first occurrence of each itineraryId
        if (!seen.has(event.itineraryId)) {
          seen.set(event.itineraryId, event);
        }
      } else {
        // Virtual events without itineraryId - always include
        // Use inviteId as unique key for these
        if (!seen.has(event.inviteId)) {
          seen.set(event.inviteId, event);
        }
      }
    }

    const deduplicated = Array.from(seen.values());

    if (deduplicated.length < rawEvents.length) {
      console.log(`[Dashboard] Removed ${rawEvents.length - deduplicated.length} duplicate events`);
    }

    return deduplicated;
  }, [rawEvents]);

  // DEBUG: Log events query state
  console.log('[Dashboard] Events query state:', {
    eventsCount: events.length,
    isLoading: eventsLoading,
    error: eventsError,
    errorMessage: eventsError instanceof Error ? eventsError.message : null,
    userExists: !!user,
    userId: user?.id,
    firstEvent: events[0]
  });

  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  // Calculate past events needing feedback
  const currentTime = new Date();
  const pastEventsNeedingFeedback = events.filter(event => {
    const isPast = event.eventDate && new Date(event.eventDate) < currentTime;
    const attendedOrOrganizer = event.rsvp?.response === 'yes';
    const noFeedbackYet = !event.rsvp?.postEventFeedback;
    return isPast && attendedOrOrganizer && noFeedbackYet;
  });

  // Auto-open feedback dialog for most recent past event (one-time per event)
  // Create stable signature of events needing feedback for dependency tracking
  const pendingFeedbackSignature = pastEventsNeedingFeedback
    .map(e => e.itineraryId)
    .sort()
    .join(',');

  useEffect(() => {
    if (eventsLoading || pastEventsNeedingFeedback.length === 0) return;
    
    // Sort by most recent first
    const sortedEvents = [...pastEventsNeedingFeedback].sort((a, b) => {
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateB - dateA;
    });

    // Get list of already-prompted events
    const promptedEvents = JSON.parse(localStorage.getItem('feedbackPrompted') || '[]');
    
    // Find the first event that hasn't been prompted yet
    const unpromptedEvent = sortedEvents.find(event => !promptedEvents.includes(event.itineraryId));
    
    if (unpromptedEvent) {
      // Mark as prompted and show dialog after short delay
      const timeoutId = setTimeout(() => {
        const updatedPrompted = [...promptedEvents, unpromptedEvent.itineraryId];
        localStorage.setItem('feedbackPrompted', JSON.stringify(updatedPrompted));
        handlePostEventFeedback(unpromptedEvent);
      }, 1500);
      
      // Cleanup timeout on unmount to prevent calling on unmounted component
      return () => clearTimeout(timeoutId);
    }
  }, [eventsLoading, pendingFeedbackSignature]);

  // Collection mutations
  const createCollectionMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const orderIndex = collections.length;
      return await apiRequest("POST", "/api/user/collections", { name, orderIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      setCreateCollectionOpen(false);
      setNewCollectionName("");
      toast({
        title: "Collection created",
        description: "Your new collection has been created",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const updateCollectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/user/collections/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      setRenamingCollectionId(null);
      setRenameCollectionName("");
      toast({
        title: "Collection renamed",
        description: "Collection name has been updated",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/user/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Collection deleted",
        description: "Groups moved to All Groups",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: async (groupOrders: Array<{ id: string; orderIndex: number }>) => {
      return await apiRequest("PATCH", `/api/groups/reorder`, { groupOrders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
    },
  });

  const moveGroupToCollectionMutation = useMutation({
    mutationFn: async ({ groupId, collectionId }: { groupId: string; collectionId: string | null }) => {
      const targetGroups = collectionId
        ? groups.filter(g => g.collectionId === collectionId)
        : groups.filter(g => !g.collectionId);
      const orderIndex = targetGroups.length;
      return await apiRequest("PATCH", `/api/groups/${groupId}/collection`, { collectionId, orderIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Group moved",
        description: "Group has been moved to the collection",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return await apiRequest("DELETE", `/api/groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      // Separate virtual from real events
      const virtualEventIds = eventIds.filter(id => id.startsWith('virtual-'));
      const realEventIds = eventIds.filter(id => !id.startsWith('virtual-'));

      // Process real event deletions
      if (realEventIds.length > 0) {
        await Promise.all(
          realEventIds.map(async (eventId) => {
            // Determine if this is an itinerary or an invite
            const event = events.find(e => e.itineraryId === eventId || e.inviteId === eventId);
            if (!event) throw new Error("Event not found");

            // Use the appropriate endpoint based on whether it's an itinerary or invite
            const endpoint = event.itineraryId
              ? `/api/itineraries/${event.itineraryId}`
              : `/api/itinerary-invites/${event.inviteId}`;

            await apiRequest("DELETE", endpoint);
          })
        );
      }

      return { virtualEventIds, realEventIds };
    },
    onMutate: async (eventIds) => {
      // For any events being deleted, optimistically remove from UI
      if (eventIds.length > 0) {
        await queryClient.cancelQueries({ queryKey: ["/api/user/events"] });
        const previousEvents = queryClient.getQueryData(["/api/user/events"]);

        queryClient.setQueryData(["/api/user/events"], (old: any) => {
          if (!old) return old;
          return old.filter((e: any) => {
            const id = e.itineraryId || e.inviteId;
            return !eventIds.includes(id);
          });
        });

        return { previousEvents };
      }
    },
    onSuccess: (data, variables, context: any) => {
      // Only invalidate queries if we deleted real events
      if (data?.realEventIds && data.realEventIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      }

      toast({
        title: "Events deleted",
        description: `${variables.length} event${variables.length > 1 ? 's' : ''} deleted successfully`
      });
      setDeleteConfirmOpen(false);
      setSelectedEvents(new Set());
    },
    onError: (error: any, eventIds, context: any) => {
      // Rollback optimistic update
      if (context?.previousEvents) {
        queryClient.setQueryData(["/api/user/events"], context.previousEvents);
      }
      toast({
        title: "Error deleting events",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async ({ groupId, memberId }: { groupId: string; memberId: string }) => {
      return await apiRequest("DELETE", `/api/groups/${groupId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Left group",
        description: "You have left the group successfully",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Switch user mutation (admin only)
  const switchUserMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return await apiRequest("POST", "/api/admin/switch-user", { targetUserId });
    },
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // RSVP mutation for members
  const rsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, inviteToken, response, rsvpFeedback }: { itineraryId: string; inviteToken: string; response: string; rsvpFeedback?: any }) => {
      return await apiRequest("POST", `/api/rsvps`, { itineraryId, inviteToken, response, rsvpFeedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setShowFeedbackDialog(false);
      resetFeedbackForm();
      toast({
        title: "RSVP submitted!",
        description: "Your response has been recorded",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // RSVP mutation for organizers
  const organizerRsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, response, rsvpFeedback }: { itineraryId: string; response: string; rsvpFeedback?: any }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/organizer-rsvp`, { response, rsvpFeedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setShowFeedbackDialog(false);
      resetFeedbackForm();
      toast({
        title: "RSVP submitted!",
        description: "Your response has been recorded",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Volunteer to host mutation
  const volunteerToHostMutation = useMutation({
    mutationFn: async ({ itineraryId }: { itineraryId: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/volunteer-host`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "You're now hosting!",
        description: "You've been set as the event host and RSVP'd as attending",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Hand off host mutation
  const handOffHostMutation = useMutation({
    mutationFn: async ({ itineraryId, newHostMemberId }: { itineraryId: string; newHostMemberId: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/hand-off-host`, { newHostMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Host handed off",
        description: "The hosting role has been transferred",
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Post-event feedback mutation
  const postEventFeedbackMutation = useMutation({
    mutationFn: async ({ itineraryId, actuallyAttended, venueRating, frequencyPreference, wouldDoAgain, improvementNotes }: {
      itineraryId: string;
      actuallyAttended: string;
      venueRating: number;
      frequencyPreference: string;
      wouldDoAgain: string;
      improvementNotes: string;
    }) => {
      console.log('[Post Event Feedback] Starting mutation:', { itineraryId, actuallyAttended, venueRating, frequencyPreference, wouldDoAgain, improvementNotes });

      // Build request body with only defined optional fields
      const requestBody: any = {
        actuallyAttended: actuallyAttended === "yes",
      };

      // Only include optional fields if they have valid values
      if (venueRating > 0) requestBody.venueRating = venueRating;
      if (frequencyPreference) requestBody.frequencyPreference = frequencyPreference;
      if (wouldDoAgain) requestBody.wouldDoAgain = wouldDoAgain;
      if (improvementNotes) requestBody.improvementNotes = improvementNotes;

      console.log('[Post Event Feedback] Request body:', requestBody);
      const result = await apiRequest("POST", `/api/itineraries/${itineraryId}/post-event-feedback`, requestBody);
      console.log('[Post Event Feedback] API response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Post Event Feedback] Mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setShowPostEventFeedback(false);
      resetPostEventForm();
      toast({
        title: "Feedback submitted",
      });
    },
    onError: (error: any) => {
      console.error('[Post Event Feedback] Mutation error:', error);
      toast(getErrorToast(error));
    },
  });

  // Approve guest RSVP mutation
  const approveGuestRsvpMutation = useMutation({
    mutationFn: async ({ rsvpId, guestName }: { rsvpId: string; guestName: string }) => {
      return await apiRequest("POST", `/api/rsvps/${rsvpId}/approve`, {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Guest approved!",
        description: `${variables.guestName} has been approved to join the event`,
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Deny guest RSVP mutation
  const denyGuestRsvpMutation = useMutation({
    mutationFn: async ({ rsvpId, guestName }: { rsvpId: string; guestName: string }) => {
      return await apiRequest("POST", `/api/rsvps/${rsvpId}/deny`, {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "Guest denied",
        description: `${variables.guestName}'s request has been declined`,
      });
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  // Feedback helper functions
  const resetFeedbackForm = () => {
    setBudgetConcern(false);
    setTimeConcern(false);
    setLocationConcern(false);
    setActivityTypeConcern(false);
    setOtherConcern(false);
    setFeedbackText("");
    setFeedbackEvent(null);
  };

  const resetPostEventForm = () => {
    setActuallyAttended("");
    setVenueRating(0);
    setFrequencyPreference("");
    setWouldDoAgain("");
    setImprovementNotes("");
    setPostEventData(null);
  };

  const handlePostEventFeedback = (event: UserEvent) => {
    setPostEventData(event);
    setShowPostEventFeedback(true);
  };

  const handleSubmitPostEventFeedback = () => {
    console.log('[Post Event Feedback] handleSubmit called', { postEventData, actuallyAttended });
    if (!postEventData || !postEventData.itineraryId) {
      console.error('[Post Event Feedback] Missing data:', { postEventData, itineraryId: postEventData?.itineraryId });
      return;
    }

    console.log('[Post Event Feedback] Calling mutation...');
    postEventFeedbackMutation.mutate({
      itineraryId: postEventData.itineraryId,
      actuallyAttended,
      venueRating,
      frequencyPreference,
      wouldDoAgain,
      improvementNotes
    });
  };

  const handleRsvpClick = (event: UserEvent, response: string) => {
    if (!event.itineraryId) return; // Guard for virtual events

    if (response === 'yes') {
      // Yes responses don't need feedback - submit directly
      if (event.isOrganizer) {
        organizerRsvpMutation.mutate({ itineraryId: event.itineraryId, response });
      } else {
        rsvpMutation.mutate({ itineraryId: event.itineraryId, inviteToken: event.inviteToken, response });
      }
    } else {
      // Maybe/No responses - show feedback dialog
      setFeedbackEvent({ event, response });
      setShowFeedbackDialog(true);
    }
  };

  const handleSubmitFeedback = () => {
    if (!feedbackEvent || !feedbackEvent.event.itineraryId) return;

    const feedback: any = {};
    if (budgetConcern) feedback.budgetConcern = true;
    if (timeConcern) feedback.timeConcern = true;
    if (locationConcern) feedback.locationConcern = true;
    if (activityTypeConcern) feedback.activityTypeConcern = true;
    if (otherConcern) feedback.otherConcern = true;
    if (feedbackText.trim()) feedback.notes = feedbackText.trim();

    const rsvpFeedback = Object.keys(feedback).length > 0 ? feedback : undefined;

    if (feedbackEvent.event.isOrganizer) {
      organizerRsvpMutation.mutate({
        itineraryId: feedbackEvent.event.itineraryId,
        response: feedbackEvent.response,
        rsvpFeedback
      });
    } else {
      rsvpMutation.mutate({
        itineraryId: feedbackEvent.event.itineraryId,
        inviteToken: feedbackEvent.event.inviteToken,
        response: feedbackEvent.response,
        rsvpFeedback
      });
    }
  };

  const copyInviteLink = (event: UserEvent) => {
    if (!event.itineraryId) return; // Guard for virtual events

    const url = `${window.location.origin}/rsvp/${event.itineraryId}/${event.inviteToken}`;

    // Fallback function using textarea and execCommand - returns true on success
    const fallbackCopy = (): boolean => {
      // Check if execCommand is supported
      if (!document.queryCommandSupported || !document.queryCommandSupported('copy')) {
        return false;
      }
      
      let textarea: HTMLTextAreaElement | null = null;
      try {
        textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, url.length); // For mobile support
        const success = document.execCommand('copy');
        return success;
      } catch (error) {
        return false;
      } finally {
        if (textarea && textarea.parentNode) {
          document.body.removeChild(textarea);
        }
      }
    };
    
    // Try modern Clipboard API first (requires secure context)
    if (window.isSecureContext && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: "Link copied!",
          description: "Event invite link copied to clipboard",
        });
      }).catch(() => {
        // If Clipboard API fails (e.g., permission denied), try fallback
        const fallbackSuccess = fallbackCopy();
        if (fallbackSuccess) {
          toast({
            title: "Link copied!",
            description: "Event invite link copied to clipboard",
          });
        } else {
          toast({
            title: "Failed to copy",
            description: "Please try again",
            variant: "destructive",
          });
        }
      });
    } else {
      // Non-secure context or Clipboard API unavailable - use fallback directly
      const fallbackSuccess = fallbackCopy();
      if (fallbackSuccess) {
        toast({
          title: "Link copied!",
          description: "Event invite link copied to clipboard",
        });
      } else {
        toast({
          title: "Failed to copy",
          description: "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  // Categorize events
  const now = new Date();
  // Pending: Non-organizer events with no RSVP
  const pendingInvites = events.filter(e => !e.isOrganizer && !e.rsvp && (!e.eventDate || new Date(e.eventDate) > now));
  // Guest Approvals: Organizer events with pending guest RSVPs
  const guestApprovalEvents = events.filter(e => e.isOrganizer && e.pendingGuestRsvps && e.pendingGuestRsvps.length > 0 && (!e.eventDate || new Date(e.eventDate) > now));
  // Upcoming: Organizers OR events with RSVP (excluding 'no') that haven't happened yet
  const upcomingEvents = events.filter(e => {
    const isFutureOrTBD = !e.eventDate || new Date(e.eventDate) > now;
    if (e.isOrganizer) return isFutureOrTBD;
    return e.rsvp && e.rsvp.response !== 'no' && isFutureOrTBD;
  });

  // Limit events per group to avoid overwhelming the dashboard
  const MAX_EVENTS_PER_GROUP = 3;
  const limitEventsPerGroup = (events: typeof upcomingEvents) => {
    const eventsByGroup = new Map<string, typeof upcomingEvents>();
    const limitedEvents: typeof upcomingEvents = [];
    let hiddenCount = 0;

    // Group events by groupId
    events.forEach(event => {
      if (!eventsByGroup.has(event.groupId)) {
        eventsByGroup.set(event.groupId, []);
      }
      eventsByGroup.get(event.groupId)!.push(event);
    });

    // For each group, take only the first MAX_EVENTS_PER_GROUP events
    eventsByGroup.forEach((groupEvents) => {
      const sortedEvents = groupEvents.sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
        const dateB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
        return dateA - dateB;
      });

      limitedEvents.push(...sortedEvents.slice(0, MAX_EVENTS_PER_GROUP));
      hiddenCount += Math.max(0, sortedEvents.length - MAX_EVENTS_PER_GROUP);
    });

    // Sort all limited events by date
    return {
      events: limitedEvents.sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
        const dateB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
        return dateA - dateB;
      }),
      hiddenCount
    };
  };

  const { events: displayedUpcomingEvents, hiddenCount: hiddenEventsCount } = limitEventsPerGroup(upcomingEvents);

  // Past events should only include events that:
  // 1. Have a date that has passed
  // 2. Were actually sent out (inviteSentAt exists) OR have a status indicating they happened
  // 3. Are not in draft status (unless they were sent)
  const pastEvents = events.filter(e => {
    if (!e.eventDate || new Date(e.eventDate) > now) return false;

    // Exclude draft events that were never sent
    if (e.status === 'draft' && !e.inviteSentAt) return false;

    // Exclude saved events that were never sent
    if (e.status === 'saved' && !e.inviteSentAt) return false;

    // Include events that were sent or have a real status (proposed, scheduled, completed, rejected)
    return true;
  });

  // Split past events into recent (last 90 days) and archived (older)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentPastEvents = pastEvents.filter(event =>
    event.eventDate && new Date(event.eventDate) >= ninetyDaysAgo
  );
  const archivedPastEvents = pastEvents.filter(event =>
    event.eventDate && new Date(event.eventDate) < ninetyDaysAgo
  );
  const displayedPastEvents = showArchivedEvents ? pastEvents : recentPastEvents;

  // Organize groups by collection
  const uncategorizedGroups = groups.filter(g => !g.collectionId);
  const collectionGroups = collections.map(collection => ({
    collection,
    groups: groups.filter(g => g.collectionId === collection.id),
  }));

  const toggleCollection = (collectionId: string) => {
    setOpenCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Drag-and-drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    // Find which collection this drag happened in
    const activeGroup = groups.find(g => g.id === active.id);
    if (!activeGroup) return;

    // Get all groups in the same collection
    const sameCollectionGroups = groups
      .filter(g => g.collectionId === activeGroup.collectionId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const oldIndex = sameCollectionGroups.findIndex(g => g.id === active.id);
    const newIndex = sameCollectionGroups.findIndex(g => g.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the groups
    const reorderedGroups = arrayMove(sameCollectionGroups, oldIndex, newIndex);

    // Create the update payload
    const groupOrders = reorderedGroups.map((g, index) => ({
      id: g.id,
      orderIndex: index,
    }));

    // Optimistically update the UI
    queryClient.setQueryData(["/api/user/groups"], (old: any) => {
      if (!old) return old;
      return old.map((g: Group) => {
        const newOrder = groupOrders.find(order => order.id === g.id);
        return newOrder ? { ...g, orderIndex: newOrder.orderIndex } : g;
      });
    });

    // Persist to server
    reorderGroupsMutation.mutate(groupOrders);
  };

  const handleGroupSelect = (groupId: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      setSelectedGroupIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(groupId)) {
          newSet.delete(groupId);
        } else {
          newSet.add(groupId);
        }
        return newSet;
      });
    } else {
      // Single select (clear others)
      setSelectedGroupIds(new Set([groupId]));
    }
  };

  const getFirstInitial = (name?: string | null) => {
    if (!name) return "U";
    const firstWord = name.trim().split(" ")[0];
    return firstWord[0]?.toUpperCase() || "U";
  };

  const getMeetingAtText = (items: Array<{venueName: string}>) => {
    if (!items || items.length === 0) return "TBD";
    if (items.length === 1) return items[0].venueName;
    return `${items[0].venueName} + ${items.length - 1}`;
  };

  const getGoogleMapsUrl = (venue: {venueName?: string | null, venueAddress?: string | null, googlePlaceId?: string | null}) => {
    if (venue.googlePlaceId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`;
    }
    if (venue.venueAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueAddress)}`;
    }
    return null;
  };

  const displayName = profile?.displayName || user?.firstName || "User";

  const formatRsvpName = (rsvp: any) => {
    const parts = [];
    
    // Add additional attendees
    if (rsvp.additionalAttendees && rsvp.additionalAttendees.length > 0) {
      const attendee = rsvp.additionalAttendees[0];
      // Show name if available, otherwise show "+1 guest"
      if (attendee.name) {
        parts.push(`+${attendee.name}`);
      } else {
        parts.push('+1 guest');
      }
    }
    
    // Add kids count
    if (rsvp.numberOfKids > 0) {
      parts.push(`${rsvp.numberOfKids} kids`);
    }
    
    // Combine all parts inside parentheses if there are any
    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    return `${rsvp.name}${suffix}`;
  };

  // Wrapper for the new GroupCard component with drag-and-drop
  const GroupCardWrapper = ({ group, showMenu = true }: { group: Group & { members: SafeMember[] }; showMenu?: boolean }) => (
    <DraggableGroupCard
      group={group}
      showMenu={showMenu}
      collections={collections}
      currentUserMemberId={group.members.find(m => m.userId === user?.id)?.id}
      onMoveToCollection={(groupId, collectionId) =>
        moveGroupToCollectionMutation.mutate({ groupId, collectionId })
      }
      onDeleteGroup={(groupId) => deleteGroupMutation.mutate(groupId)}
      onLeaveGroup={(groupId, memberId) => leaveGroupMutation.mutate({ groupId, memberId })}
      isSelected={selectedGroupIds.has(group.id)}
      onSelect={handleGroupSelect}
      isDragging={activeDragId === group.id}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header
        testAccounts={testAccounts}
        onShowTestAccountDialog={() => setShowTestAccountDialog(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-bold">
            Welcome back, {displayName.split(" ")[0]}!
          </h2>
          <div className="flex items-center gap-4">
            <Button
              variant="default"
              onClick={() => setShowCreateEventDialog(true)}
              data-testid="button-create-event"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
            <Link href="/create-group">
              <Button variant="outline" data-testid="button-create-group">
                <Plus className="mr-2 h-4 w-4" />
                New Group
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist - show for new users */}
        {!isLoading && !onboardingDismissed && (
          <div className="mb-6">
            <OnboardingChecklist
              groups={groups}
              profile={profile}
              userId={user?.id}
              hasEvents={events.length > 0}
              onDismiss={handleDismissOnboarding}
              onOpenDiscoverVenues={(groupId) => setLocation(`/group/${groupId}?action=discover`)}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="my-events" data-testid="tab-my-events">My Events</TabsTrigger>
            <TabsTrigger value="my-groups" data-testid="tab-my-groups">My Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="my-events" data-testid="content-my-events">
            {/* Global Delete Button - Floating */}
            {selectedEvents.size > 0 && (
              <div className="fixed bottom-8 right-8 z-50">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="shadow-lg"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {selectedEvents.size} Event{selectedEvents.size > 1 ? 's' : ''}
                </Button>
              </div>
            )}

            <div className="space-y-6">
              {/* Consolidated Action Required Card */}
              {!eventsLoading && (pendingInvites.length > 0 || guestApprovalEvents.length > 0 || pastEventsNeedingFeedback.length > 0) && (
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200/50 dark:border-amber-800/30 shadow-warm" data-testid="card-action-required">
                  <CardContent className="py-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2.5 rounded-softer bg-amber-100 dark:bg-amber-900/50">
                        <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">Action Required</h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {pendingInvites.length > 0 && (
                            <Badge variant="secondary" className="rounded-pill bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                              {pendingInvites.length} RSVP{pendingInvites.length > 1 ? 's' : ''} needed
                            </Badge>
                          )}
                          {guestApprovalEvents.reduce((count, e) => count + e.pendingGuestRsvps.length, 0) > 0 && (
                            <Badge variant="secondary" className="rounded-pill bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                              {guestApprovalEvents.reduce((count, e) => count + e.pendingGuestRsvps.length, 0)} guest{guestApprovalEvents.reduce((count, e) => count + e.pendingGuestRsvps.length, 0) > 1 ? 's' : ''} to approve
                            </Badge>
                          )}
                          {pastEventsNeedingFeedback.length > 0 && (
                            <Badge variant="secondary" className="rounded-pill bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                              {pastEventsNeedingFeedback.length} feedback{pastEventsNeedingFeedback.length > 1 ? 's' : ''} needed
                            </Badge>
                          )}
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex flex-wrap gap-2">
                          {pendingInvites.length > 0 && pendingInvites[0].itineraryId && (
                            <Link href={`/rsvp/${pendingInvites[0].itineraryId}/${pendingInvites[0].inviteToken}`}>
                              <Button size="sm" variant="outline" className="gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" />
                                RSVP Now
                              </Button>
                            </Link>
                          )}
                          {pastEventsNeedingFeedback.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePostEventFeedback(pastEventsNeedingFeedback[0])}
                              className="gap-1.5"
                              data-testid="button-banner-feedback"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Leave Feedback
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Loading State */}
              {eventsLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}

              {/* Error State */}
              {!eventsLoading && eventsError && (
                <ErrorDisplay
                  error={eventsError}
                  onRetry={() => refetchEvents()}
                  className="mb-4"
                />
              )}

              {/* Upcoming Events Section - Unified List */}
              {!eventsLoading && upcomingEvents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Upcoming Events</h3>
                    <div className="flex items-center gap-3">
                      {hiddenEventsCount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          +{hiddenEventsCount} more
                        </span>
                      )}
                      <Select value={eventSortMode} onValueChange={(v) => setEventSortMode(v as 'date' | 'group')}>
                        <SelectTrigger className="w-[130px] h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">By Date</SelectItem>
                          <SelectItem value="group">By Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {eventSortMode === 'date' ? (
                    <EventsTable
                      events={displayedUpcomingEvents}
                      expandedEvents={expandedEvents}
                      onToggleExpand={toggleEventExpand}
                    />
                  ) : (
                    <div className="space-y-6">
                      {groupEventsByGroup(displayedUpcomingEvents).map(group => (
                        <div key={group.groupId}>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                            <span className="text-xl">{group.groupEmoji}</span>
                            <span className="font-medium">{group.groupName}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <EventsTable
                            events={group.events}
                            expandedEvents={expandedEvents}
                            onToggleExpand={toggleEventExpand}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Past Events Section */}
              {!eventsLoading && pastEvents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setIsPastEventsExpanded(!isPastEventsExpanded)}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <h3 className="text-xl font-bold">Past Events ({pastEvents.length})</h3>
                      {isPastEventsExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                    {isPastEventsExpanded && archivedPastEvents.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {showArchivedEvents
                          ? `Showing all ${pastEvents.length} events`
                          : `Showing ${recentPastEvents.length} recent • ${archivedPastEvents.length} archived`
                        }
                      </span>
                    )}
                  </div>
                  {isPastEventsExpanded && (
                    <>
                      <div className="opacity-75">
                        <EventsTable
                          events={displayedPastEvents as any}
                          expandedEvents={expandedEvents}
                          onToggleExpand={toggleEventExpand}
                          isPastEvents={true}
                          onLeaveFeedback={handlePostEventFeedback as any}
                        />
                      </div>
                      {!showArchivedEvents && archivedPastEvents.length > 0 && (
                        <div className="mt-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowArchivedEvents(true)}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            View all past events ({archivedPastEvents.length} older) →
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Empty State - contextual guidance based on user state */}
              {!eventsLoading && events.length === 0 && (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <Calendar className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                      {groups.length === 0 ? (
                        <>
                          <p className="text-muted-foreground mb-4">
                            Create a group to start planning events with friends
                          </p>
                          <Link href="/create-group">
                            <Button>
                              <Plus className="mr-2 h-4 w-4" />
                              Create Your First Group
                            </Button>
                          </Link>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground mb-4">
                            Ready to plan something? Pick a group and schedule an event.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <Link href={`/group/${groups[0]?.id}`}>
                              <Button>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Plan an Event
                              </Button>
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-groups" data-testid="content-my-groups">
            <div className="space-y-6">
              {/* Incomplete Profile Banner */}
              {!isLoading && groups.length > 0 && groups.some(g => 
                g.members.some(m => m.profileCompleted === false)
              ) && (
                <Card className="bg-primary/15 border-primary/20" data-testid="banner-complete-profile">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-primary/25">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Complete Your Profile</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Complete your profile to get personalized activity suggestions
                        </p>
                        <Link href={`/member-profile-setup/${groups.find(g => g.members.find(m => m.profileCompleted === false))?.members.find(m => m.profileCompleted === false)?.id}`}>
                          <Button size="sm" data-testid="button-banner-complete-profile">
                            Complete Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoading || collectionsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i}>
                        <CardHeader className="pb-3">
                          <Skeleton className="h-5 w-3/4 mb-1" />
                          <Skeleton className="h-3 w-full" />
                        </CardHeader>
                        <CardContent className="pb-4">
                          <Skeleton className="h-16 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (groupsError || collectionsError) ? (
                <ErrorDisplay
                  error={groupsError || collectionsError}
                  onRetry={() => {
                    refetchGroups();
                    refetchCollections();
                  }}
                />
              ) : groups.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                      <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                        Groups help you plan events with the same people regularly. Create one for your friend circle, family, or coworkers.
                      </p>
                      <Link href="/create-group">
                        <Button data-testid="button-create-first-group">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Group
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-5">
                    {/* Collections Header */}
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">Collections</h2>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                        onClick={() => setCreateCollectionOpen(true)}
                        data-testid="button-new-collection"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Collection Sections */}
                    {collectionGroups.map(({ collection, groups: collectionGroupsList }) => (
                    <Collapsible
                      key={collection.id}
                      open={!openCollections.has(collection.id)}
                      onOpenChange={() => toggleCollection(collection.id)}
                      data-testid={`collapsible-collection-${collection.id}`}
                    >
                      <div className="border border-border/50 rounded-softer p-5 bg-gradient-to-br from-card to-muted/20 shadow-warm">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -ml-2 flex-1" data-testid={`trigger-collection-${collection.id}`}>
                            {openCollections.has(collection.id) ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <h3 className="text-lg font-semibold">
                              {renamingCollectionId === collection.id ? (
                                <Input
                                  value={renameCollectionName}
                                  onChange={(e) => setRenameCollectionName(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      updateCollectionMutation.mutate({ id: collection.id, name: renameCollectionName });
                                    } else if (e.key === 'Escape') {
                                      setRenamingCollectionId(null);
                                      setRenameCollectionName("");
                                    }
                                  }}
                                  onBlur={() => {
                                    if (renameCollectionName && renameCollectionName !== collection.name) {
                                      updateCollectionMutation.mutate({ id: collection.id, name: renameCollectionName });
                                    } else {
                                      setRenamingCollectionId(null);
                                      setRenameCollectionName("");
                                    }
                                  }}
                                  autoFocus
                                  className="h-7"
                                  data-testid={`input-rename-collection-${collection.id}`}
                                />
                              ) : (
                                collection.name
                              )}
                            </h3>
                            <span className="text-sm text-muted-foreground ml-1">
                              ({collectionGroupsList.length})
                            </span>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingCollectionId(collection.id);
                                setRenameCollectionName(collection.name);
                              }}
                              data-testid={`button-rename-collection-${collection.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${collection.name}" collection? Groups will be moved to All Groups.`)) {
                                  deleteCollectionMutation.mutate(collection.id);
                                }
                              }}
                              data-testid={`button-delete-collection-${collection.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          {collectionGroupsList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              No groups in this collection yet
                            </p>
                          ) : (
                            <SortableContext
                              items={collectionGroupsList.map(g => g.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {collectionGroupsList.map((group) => (
                                  <GroupCardWrapper key={group.id} group={group} />
                                ))}
                              </div>
                            </SortableContext>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}

                  {/* All Groups (Uncategorized) Section */}
                  {uncategorizedGroups.length > 0 && (
                    <Collapsible
                      open={!openCollections.has('uncategorized')}
                      onOpenChange={() => toggleCollection('uncategorized')}
                      data-testid="collapsible-all-groups"
                    >
                      <div className="border border-border/50 rounded-softer p-5 bg-gradient-to-br from-card to-muted/20 shadow-warm">
                        <div className="flex items-center gap-2 mb-3">
                          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -ml-2 flex-1" data-testid="trigger-all-groups">
                            {openCollections.has('uncategorized') ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <h3 className="text-lg font-semibold">All Groups</h3>
                            <span className="text-sm text-muted-foreground ml-1">
                              ({uncategorizedGroups.length})
                            </span>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <SortableContext
                            items={uncategorizedGroups.map(g => g.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {uncategorizedGroups.map((group) => (
                                <GroupCardWrapper key={group.id} group={group} />
                              ))}
                            </div>
                          </SortableContext>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                  </div>
                </DndContext>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Collection Dialog */}
      <Dialog open={createCollectionOpen} onOpenChange={setCreateCollectionOpen}>
        <DialogContent data-testid="dialog-create-collection">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., Family Groups, Work Friends, Book Clubs"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCollectionName.trim()) {
                    createCollectionMutation.mutate({ name: newCollectionName.trim() });
                  }
                }}
                data-testid="input-collection-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCollectionOpen(false);
                setNewCollectionName("");
              }}
              data-testid="button-cancel-collection"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newCollectionName.trim()) {
                  createCollectionMutation.mutate({ name: newCollectionName.trim() });
                }
              }}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
              data-testid="button-create-collection"
            >
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={(open) => {
        if (!open) {
          resetFeedbackForm();
        }
        setShowFeedbackDialog(open);
      }}>
        <DialogContent data-testid="dialog-rsvp-feedback">
          <DialogHeader>
            <DialogTitle>
              {(feedbackEvent?.response === 'maybe' || feedbackEvent?.response === 'yes_with_constraint') ? 'What concerns do you have?' : 'Why not?'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="budget-concern" 
                  checked={budgetConcern} 
                  onCheckedChange={(checked) => setBudgetConcern(checked as boolean)}
                  data-testid="checkbox-budget-concern"
                />
                <Label htmlFor="budget-concern" className="cursor-pointer">
                  Budget concerns
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="time-concern" 
                  checked={timeConcern} 
                  onCheckedChange={(checked) => setTimeConcern(checked as boolean)}
                  data-testid="checkbox-time-concern"
                />
                <Label htmlFor="time-concern" className="cursor-pointer">
                  Time doesn't work
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="location-concern" 
                  checked={locationConcern} 
                  onCheckedChange={(checked) => setLocationConcern(checked as boolean)}
                  data-testid="checkbox-location-concern"
                />
                <Label htmlFor="location-concern" className="cursor-pointer">
                  Location is inconvenient
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="activity-type-concern" 
                  checked={activityTypeConcern} 
                  onCheckedChange={(checked) => setActivityTypeConcern(checked as boolean)}
                  data-testid="checkbox-activity-type-concern"
                />
                <Label htmlFor="activity-type-concern" className="cursor-pointer">
                  Not interested in these activities
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="other-concern" 
                  checked={otherConcern} 
                  onCheckedChange={(checked) => setOtherConcern(checked as boolean)}
                  data-testid="checkbox-other-concern"
                />
                <Label htmlFor="other-concern" className="cursor-pointer">
                  Other reason
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-text">Additional details (optional)</Label>
              <Textarea
                id="feedback-text"
                placeholder="Any other details you'd like to share..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                data-testid="textarea-feedback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFeedbackDialog(false);
                resetFeedbackForm();
              }}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={rsvpMutation.isPending || organizerRsvpMutation.isPending}
              data-testid="button-submit-feedback"
            >
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Event Feedback Dialog */}
      <Dialog open={showPostEventFeedback} onOpenChange={(open) => {
        if (!open) {
          resetPostEventForm();
        }
        setShowPostEventFeedback(open);
      }}>
        <DialogContent data-testid="dialog-post-event-feedback">
          <DialogHeader>
            <DialogTitle>How was the event?</DialogTitle>
          </DialogHeader>

          {/* Event Details */}
          {postEventData && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3 space-y-1">
                <div className="font-semibold text-base">{postEventData.itineraryName}</div>
                <div className="text-sm text-muted-foreground">
                  {postEventData.groupName}
                </div>
                {postEventData.eventDate && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(new Date(postEventData.eventDate), 'MMMM d, yyyy')} at {format(new Date(postEventData.eventDate), 'h:mm a')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Did you actually attend this event?</Label>
              <div className="flex gap-2">
                <Button
                  variant={actuallyAttended === "yes" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setActuallyAttended("yes")}
                  data-testid="button-attended-yes"
                >
                  Yes
                </Button>
                <Button
                  variant={actuallyAttended === "no" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setActuallyAttended("no")}
                  data-testid="button-attended-no"
                >
                  No
                </Button>
              </div>
            </div>

            {/* Only show venue questions if they attended */}
            {actuallyAttended === "yes" && (
              <>
                <div className="space-y-2">
                  <Label>How would you rate the venue?</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    variant={venueRating === rating ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVenueRating(rating)}
                    className="gap-1"
                    data-testid={`button-rating-${rating}`}
                  >
                    <Star className={`h-4 w-4 ${venueRating >= rating ? 'fill-current' : ''}`} />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>How often would you like events like this?</Label>
              <div className="space-y-2">
                <Button
                  variant={frequencyPreference === "more_frequent" ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setFrequencyPreference("more_frequent")}
                  data-testid="button-frequency-more"
                >
                  More often
                </Button>
                <Button
                  variant={frequencyPreference === "just_right" ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setFrequencyPreference("just_right")}
                  data-testid="button-frequency-right"
                >
                  This is perfect
                </Button>
                <Button
                  variant={frequencyPreference === "less_frequent" ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setFrequencyPreference("less_frequent")}
                  data-testid="button-frequency-less"
                >
                  Less often
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Would you do this again?</Label>
              <div className="flex gap-2">
                <Button
                  variant={wouldDoAgain === "yes" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWouldDoAgain("yes")}
                  data-testid="button-again-yes"
                >
                  Yes
                </Button>
                <Button
                  variant={wouldDoAgain === "maybe" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWouldDoAgain("maybe")}
                  data-testid="button-again-maybe"
                >
                  Maybe
                </Button>
                <Button
                  variant={wouldDoAgain === "no" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWouldDoAgain("no")}
                  data-testid="button-again-no"
                >
                  No
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="improvement-notes">What would make it better? (optional)</Label>
              <Textarea
                id="improvement-notes"
                placeholder="Share your thoughts..."
                value={improvementNotes}
                onChange={(e) => setImprovementNotes(e.target.value)}
                data-testid="textarea-improvement"
              />
            </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPostEventFeedback(false);
                resetPostEventForm();
              }}
              data-testid="button-cancel-post-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPostEventFeedback}
              disabled={postEventFeedbackMutation.isPending || !actuallyAttended}
              data-testid="button-submit-post-feedback"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Event Creation Modal */}
      <UnifiedEventCreationModal
        open={showCreateEventDialog}
        onOpenChange={(open) => {
          setShowCreateEventDialog(open);
          if (!open) setSelectedGroupId("");
        }}
        onNavigateToManualTab={(groupId) => {
          setLocation(`/group/${groupId}?tab=build`);
        }}
        onOpenScheduleModal={async (groupId) => {
          // Trigger AI generation directly, then navigate to see result
          toast({
            title: "Creating event...",
            description: "AI is generating your event",
          });
          try {
            await apiRequest("POST", `/api/groups/${groupId}/trigger-auto-schedule`, {});
            queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events"] });
            toast({
              title: "Event created!",
              description: "Check the group page to review your new event",
            });
            setLocation(`/group/${groupId}`);
          } catch (error: any) {
            // Graceful fallback: if AI can't generate, switch to manual creation
            const errorMsg = error.message || "";
            const isConfigError = errorMsg.includes("No viable") ||
                                  errorMsg.includes("not enabled") ||
                                  errorMsg.includes("No venues");

            if (isConfigError) {
              // Missing prerequisites - fallback to manual creation
              toast({
                title: "Switching to manual creation",
                description: "Add venues or enable auto-scheduling first",
              });
              setLocation(`/group/${groupId}?tab=build`);
            } else {
              // Other error - show error but still offer manual option
              toast({
                title: "AI generation failed",
                description: "Opening manual creation instead",
                variant: "destructive",
              });
              setLocation(`/group/${groupId}?tab=build`);
            }
          }
        }}
        onOpenDiscoverVenues={(groupId) => {
          setLocation(`/group/${groupId}`);
        }}
      />

      {/* Test Account Switcher Dialog */}
      <Dialog open={showTestAccountDialog} onOpenChange={setShowTestAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch to Test Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {testAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  switchUserMutation.mutate(account.id);
                  setShowTestAccountDialog(false);
                }}
                className="w-full text-left p-3 rounded-md border border-border hover-elevate transition-colors"
                data-testid={`button-switch-to-${account.id}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{account.email}</div>
                  {(account.firstName || account.lastName) && (
                    <div className="text-sm text-muted-foreground">
                      {[account.firstName, account.lastName].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedEvents.size} Event{selectedEvents.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteEventMutation.mutate(Array.from(selectedEvents));
              }}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEventMutation.isPending ? "Deleting..." : `Delete ${selectedEvents.size} Event${selectedEvents.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
