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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Sparkles, Users, MapPin, Calendar, CheckCircle, XCircle, HelpCircle, ExternalLink, Settings, LogOut, MoreVertical, ChevronDown, ChevronRight, Pencil, Trash2, FolderOpen, UserCheck, Bot, UserPlus, Star, MessageSquare, Copy, Check, Baby } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, User, UserProfile, GroupCollection } from "@shared/schema";
import { useState, useEffect } from "react";

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
  itineraryId: string;
  itineraryName: string;
  eventDate: string | null;
  status: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  isOrganizer: boolean;
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

export default function Dashboard() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameCollectionName, setRenameCollectionName] = useState("");
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());
  
  // Create event dialog state
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  
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
  
  const { data: groups = [], isLoading } = useQuery<Array<Group & { members: SafeMember[] }>>({
    queryKey: ["/api/user/groups"],
    enabled: !!user,
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<GroupCollection[]>({
    queryKey: ["/api/user/collections"],
    enabled: !!user,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
  });

  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  // Calculate past events needing feedback
  const currentTime = new Date();
  const pastEventsNeedingFeedback = events.filter(event => {
    const isPast = event.eventDate && new Date(event.eventDate) < currentTime;
    const attendedOrOrganizer = event.rsvp?.response === 'yes' || event.isOrganizer;
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
      toast({
        title: "Error",
        description: error.message || "Failed to create collection",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to rename collection",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete collection",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to move group",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to switch user",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to submit RSVP",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to submit RSVP",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to volunteer as host",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to hand off host",
        variant: "destructive",
      });
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
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/post-event-feedback`, {
        actuallyAttended: actuallyAttended === "yes",
        venueRating,
        frequencyPreference,
        wouldDoAgain,
        improvementNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      setShowPostEventFeedback(false);
      resetPostEventForm();
      toast({
        title: "Thank you for your feedback!",
        description: "Your insights help us plan better events",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to approve guest",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to deny guest",
        variant: "destructive",
      });
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
    if (!postEventData) return;
    
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
    if (!feedbackEvent) return;

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
  const pastEvents = events.filter(e => e.eventDate && new Date(e.eventDate) <= now);

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

  const getFirstInitial = (name?: string | null) => {
    if (!name) return "U";
    const firstWord = name.trim().split(" ")[0];
    return firstWord[0]?.toUpperCase() || "U";
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

  const GroupCard = ({ group, showMenu = true }: { group: Group & { members: SafeMember[] }; showMenu?: boolean }) => (
    <Card className="hover-elevate active-elevate-2 transition-all h-full relative group" data-testid={`card-group-${group.id}`}>
      <Link href={`/group/${group.id}`} className="block">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-start justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              <span className="text-2xl" data-testid={`emoji-group-${group.id}`}>{group.emoji || "🎉"}</span>
              <span>{group.name}</span>
            </div>
            {group.activityGenerationStatus === "completed" && (
              <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            )}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-sm">
            <MapPin className="h-3 w-3" />
            {group.locationBase} • {group.meetingFrequency.charAt(0).toUpperCase() + group.meetingFrequency.slice(1)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-3">
          <div className="text-sm text-muted-foreground">
            Budget: ${group.budgetMin}-${group.budgetMax}
          </div>
          {group.activityGenerationStatus === "generating" && (
            <div className="text-sm text-primary">
              Generating suggestions...
            </div>
          )}
          {group.activityGenerationStatus === "failed" && (
            <div className="text-sm text-destructive">
              Generation failed
            </div>
          )}
          {group.members && group.members.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="flex -space-x-2" data-testid={`members-preview-${group.id}`}>
                {group.members.slice(0, 3).map((member, idx) => (
                  <Avatar key={member.id} className="h-6 w-6 border-2 border-background" data-testid={`avatar-member-${idx}`}>
                    <AvatarFallback className="text-xs bg-muted">
                      {getFirstInitial(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {group.members.length > 3 && (
                  <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center" data-testid="members-overflow">
                    <span className="text-xs text-muted-foreground">+{group.members.length - 3}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}
        </CardContent>
      </Link>
      {showMenu && (
        <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-group-menu-${group.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Group Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid={`menu-move-to-collection-${group.id}`}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Move to Collection
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem 
                    onClick={() => moveGroupToCollectionMutation.mutate({ groupId: group.id, collectionId: null })}
                    data-testid={`menu-move-none-${group.id}`}
                  >
                    None (All Groups)
                  </DropdownMenuItem>
                  {collections.map(collection => (
                    <DropdownMenuItem
                      key={collection.id}
                      onClick={() => moveGroupToCollectionMutation.mutate({ groupId: group.id, collectionId: collection.id })}
                      data-testid={`menu-move-${collection.id}-${group.id}`}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link href={`/group/${group.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Group
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Kinmo.ai</h1>
          </div>
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
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0" data-testid="button-user-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={user.profileImageUrl || undefined} 
                        alt={displayName}
                        className="object-cover"
                      />
                      <AvatarFallback>{getFirstInitial(displayName)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href="/profile">
                    <DropdownMenuItem data-testid="menu-profile">
                      <Settings className="mr-2 h-4 w-4" />
                      Profile Settings
                    </DropdownMenuItem>
                  </Link>
                  {user.email === 'raches402@gmail.com' && (
                    <>
                      <Link href="/admin">
                        <DropdownMenuItem data-testid="menu-admin">
                          <Sparkles className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </DropdownMenuItem>
                      </Link>
                      {testAccounts.length > 0 && (
                        <DropdownMenuItem 
                          onClick={() => setShowTestAccountDialog(true)}
                          data-testid="menu-switch-user"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Switch to Test Account
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => window.location.href = "/api/logout"}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {displayName.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground">
            Manage your group activities and get AI-powered suggestions
          </p>
          {user && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono" data-testid="badge-current-user">
                {user.email || user.id}
              </Badge>
              {user.email && user.email.endsWith('@example.com') && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-test-account">
                  Test Account
                </Badge>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="my-events" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="my-events" data-testid="tab-my-events">My Events</TabsTrigger>
            <TabsTrigger value="my-groups" data-testid="tab-my-groups">My Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="my-events" data-testid="content-my-events">
            <div className="space-y-8">
              {/* Feedback Banner */}
              {!eventsLoading && pastEventsNeedingFeedback.length > 0 && (
                <Card className="bg-primary/5 border-primary/20" data-testid="banner-pending-feedback">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Share Your Feedback</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {pastEventsNeedingFeedback.length} past {pastEventsNeedingFeedback.length === 1 ? 'event needs' : 'events need'} your feedback. Help us plan better future activities!
                        </p>
                        <Button 
                          size="sm" 
                          onClick={() => handlePostEventFeedback(pastEventsNeedingFeedback[0])}
                          className="gap-2"
                          data-testid="button-banner-feedback"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Leave Feedback
                        </Button>
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

              {/* Pending Invites Section */}
              {!eventsLoading && pendingInvites.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Pending Invites ({pendingInvites.length})</h3>
                  <div className="space-y-3">
                    {pendingInvites.map((event) => {
                      const canVolunteerToHost = !event.isOrganizer && event.currentUserOpenToHosting && !event.hostMemberId && event.currentUserMemberId;
                      
                      return (
                        <Card key={event.inviteId} className="hover-elevate" data-testid={`event-card-${event.itineraryId}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex-1">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <span className="text-xl">{event.groupEmoji}</span>
                                  {event.itineraryName}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {event.groupName}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                                  RSVP Needed
                                </Badge>
                                {event.hostMemberId && event.hostMemberName && (
                                  <Badge variant="default" className="gap-1" data-testid={`badge-host-${event.itineraryId}`}>
                                    <UserCheck className="h-3 w-3" />
                                    Hosted by {event.hostMemberName}
                                  </Badge>
                                )}
                                {!event.hostMemberId && (
                                  <Badge variant="secondary" className="gap-1" data-testid={`badge-ai-hosted-${event.itineraryId}`}>
                                    <Bot className="h-3 w-3" />
                                    AI-hosted
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              {event.items.map((venue, idx) => (
                                <div key={venue.id} className="flex items-start gap-2 text-sm">
                                  <Badge variant="outline" className="h-5 shrink-0">{idx + 1}</Badge>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{venue.venueName}</div>
                                    {venue.venueAddress && (
                                      <div className="text-xs text-muted-foreground">{venue.venueAddress}</div>
                                    )}
                                    <div className="flex items-center gap-3 mt-1">
                                      {venue.rating && (
                                        <span className="text-xs text-muted-foreground">
                                          ⭐ {venue.rating}
                                        </span>
                                      )}
                                      {venue.googlePlaceId && (
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline"
                                          data-testid={`link-maps-${venue.id}`}
                                        >
                                          View on Maps
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* <TimeSlotVoting
                              itineraryId={event.itineraryId}
                              userId={user?.id}
                              isOrganizer={false}
                            /> */}

                            <div className="flex gap-2 flex-wrap">
                              <Button 
                                variant="default"
                                size="sm"
                                onClick={() => handleRsvpClick(event, 'yes')}
                                disabled={rsvpMutation.isPending}
                                className="gap-1"
                                data-testid={`button-yes-${event.itineraryId}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                                Yes, I'm In
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleRsvpClick(event, 'maybe')}
                                disabled={rsvpMutation.isPending}
                                className="gap-1"
                                data-testid={`button-maybe-${event.itineraryId}`}
                              >
                                <HelpCircle className="h-4 w-4" />
                                Yes, if...
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleRsvpClick(event, 'no')}
                                disabled={rsvpMutation.isPending}
                                className="gap-1"
                                data-testid={`button-no-${event.itineraryId}`}
                              >
                                <XCircle className="h-4 w-4" />
                                Can't Make It
                              </Button>
                              {canVolunteerToHost && (
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => volunteerToHostMutation.mutate({ itineraryId: event.itineraryId })}
                                  disabled={volunteerToHostMutation.isPending}
                                  className="gap-1"
                                  data-testid={`button-volunteer-host-${event.itineraryId}`}
                                >
                                  <UserPlus className="h-4 w-4" />
                                  Volunteer to Host
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyInviteLink(event)}
                                className="gap-1"
                                data-testid={`button-copy-link-${event.itineraryId}`}
                              >
                                <Copy className="h-4 w-4" />
                                Copy Link
                              </Button>
                              <Link href={`/rsvp/${event.itineraryId}/${event.inviteToken}`}>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  <ExternalLink className="h-4 w-4" />
                                  Details
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guest Approvals Section */}
              {!eventsLoading && guestApprovalEvents.length > 0 && (
                <div data-testid="section-guest-approvals">
                  <h3 className="text-xl font-bold mb-4">Guest Approvals Needed ({guestApprovalEvents.reduce((count, event) => count + event.pendingGuestRsvps.length, 0)})</h3>
                  <div className="space-y-3">
                    {guestApprovalEvents.map((event) => (
                      <Card key={event.inviteId} className="hover-elevate" data-testid={`guest-approval-event-${event.itineraryId}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <span className="text-xl">{event.groupEmoji}</span>
                                {event.itineraryName}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {event.groupName}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                              {event.pendingGuestRsvps.length} Guest{event.pendingGuestRsvps.length !== 1 ? 's' : ''} Pending
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {event.pendingGuestRsvps.map((guestRsvp) => {
                            const responseIcon = {
                              yes: CheckCircle,
                              maybe: HelpCircle,
                              no: XCircle,
                            }[guestRsvp.response.toLowerCase()] || HelpCircle;
                            const ResponseIcon = responseIcon;

                            return (
                              <div key={guestRsvp.id} className="border rounded-md p-3 space-y-3" data-testid={`guest-rsvp-${guestRsvp.id}`}>
                                <div className="flex items-start gap-2">
                                  <UserPlus className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{guestRsvp.guestName} wants to join</div>
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                      <ResponseIcon className="h-3.5 w-3.5" />
                                      <span>Response: {guestRsvp.response}</span>
                                    </div>
                                    
                                    {guestRsvp.additionalAttendees && guestRsvp.additionalAttendees.length > 0 && (
                                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>
                                          Bringing: {guestRsvp.additionalAttendees.map((attendee: any) => {
                                            if (attendee.type === 'member' && attendee.name) {
                                              return attendee.name;
                                            } else if (attendee.type === 'guest' && attendee.name) {
                                              return attendee.name;
                                            } else {
                                              return '+1 guest';
                                            }
                                          }).join(', ')}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {guestRsvp.numberOfKids > 0 && (
                                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                        <Baby className="h-3.5 w-3.5" />
                                        <span>Kids: {guestRsvp.numberOfKids}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => approveGuestRsvpMutation.mutate({ rsvpId: guestRsvp.id, guestName: guestRsvp.guestName })}
                                    disabled={approveGuestRsvpMutation.isPending || denyGuestRsvpMutation.isPending}
                                    className="gap-1"
                                    data-testid={`button-approve-${guestRsvp.id}`}
                                  >
                                    <Check className="h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => denyGuestRsvpMutation.mutate({ rsvpId: guestRsvp.id, guestName: guestRsvp.guestName })}
                                    disabled={approveGuestRsvpMutation.isPending || denyGuestRsvpMutation.isPending}
                                    className="gap-1"
                                    data-testid={`button-deny-${guestRsvp.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Deny
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events Section */}
              {!eventsLoading && upcomingEvents.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Upcoming Events ({upcomingEvents.length})</h3>
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => {
                      // Organizer events get RSVP status badge and buttons
                      if (event.isOrganizer) {
                        const rsvpResponse = event.rsvp?.response;
                        const badgeConfig = {
                          yes: { variant: "default" as const, icon: CheckCircle, text: "Going", className: "" },
                          maybe: { variant: "secondary" as const, icon: HelpCircle, text: "Maybe", className: "" },
                          no: { variant: "outline" as const, icon: XCircle, text: "Declined", className: "" },
                        };
                        const organizerBadge = { variant: "default" as const, icon: Sparkles, text: "Organizer", className: "" };
                        const badge = rsvpResponse ? badgeConfig[rsvpResponse as 'yes' | 'maybe' | 'no'] : organizerBadge;

                        return (
                          <Card key={event.inviteId} className={`hover-elevate ${rsvpResponse === 'yes' ? 'border-primary/50' : ''}`} data-testid={`upcoming-event-${event.itineraryId}`}>
                            <CardContent className="p-4">
                              <div className="flex gap-4">
                                {/* Date/Time Block */}
                                <div className="flex-shrink-0 w-20">
                                  <div className="bg-primary text-primary-foreground rounded-lg p-2 text-center">
                                    <div className="text-xs font-semibold uppercase">
                                      {event.eventDate ? format(new Date(event.eventDate), 'MMM') : 'TBD'}
                                    </div>
                                    <div className="text-2xl font-bold leading-none my-1">
                                      {event.eventDate ? format(new Date(event.eventDate), 'd') : '--'}
                                    </div>
                                    <div className="text-xs">
                                      {event.eventDate ? format(new Date(event.eventDate), 'h:mm a') : ''}
                                    </div>
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-base flex items-center gap-2">
                                        <span className="text-xl">{event.groupEmoji}</span>
                                        {event.itineraryName}
                                      </h3>
                                      <p className="text-sm text-muted-foreground">{event.groupName}</p>
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                      <Badge variant="outline" className="gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        Organizer
                                      </Badge>
                                      {rsvpResponse && (
                                        <Badge variant={badge.variant} className={`gap-1 ${badge.className}`}>
                                          <badge.icon className="h-3 w-3" />
                                          {badge.text}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Simplified Venue Display */}
                                  {event.items.length > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <MapPin className="h-4 w-4 flex-shrink-0" />
                                      <span className="truncate">
                                        {event.items[0].venueName}
                                        {event.items.length > 1 && ` and ${event.items.length - 1} more`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="flex gap-2 flex-wrap pt-1">
                                    <Button 
                                      variant={rsvpResponse === 'yes' ? 'default' : 'ghost'}
                                      size="icon"
                                      onClick={() => handleRsvpClick(event, 'yes')}
                                      disabled={organizerRsvpMutation.isPending}
                                      data-testid={`button-yes-${event.itineraryId}`}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant={rsvpResponse === 'maybe' ? 'default' : 'ghost'}
                                      size="icon"
                                      onClick={() => handleRsvpClick(event, 'maybe')}
                                      disabled={organizerRsvpMutation.isPending}
                                      data-testid={`button-maybe-${event.itineraryId}`}
                                    >
                                      <HelpCircle className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant={rsvpResponse === 'no' ? 'default' : 'ghost'}
                                      size="icon"
                                      onClick={() => handleRsvpClick(event, 'no')}
                                      disabled={organizerRsvpMutation.isPending}
                                      data-testid={`button-no-${event.itineraryId}`}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                    <Link href={`/event/${event.itineraryId}`}>
                                      <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-${event.itineraryId}`}>
                                        <ExternalLink className="h-4 w-4" />
                                        View Details
                                      </Button>
                                    </Link>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => copyInviteLink(event)}
                                      className="gap-1"
                                      data-testid={`button-copy-link-${event.itineraryId}`}
                                    >
                                      <Copy className="h-4 w-4" />
                                      Copy Link
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      // Member events with RSVP
                      const rsvpResponse = event.rsvp?.response;
                      const badgeConfig = {
                        yes: { variant: "default" as const, icon: CheckCircle, text: "Going", className: "" },
                        maybe: { variant: "secondary" as const, icon: HelpCircle, text: "Maybe", className: "" },
                        no: { variant: "outline" as const, icon: XCircle, text: "Declined", className: "" },
                      };
                      const badge = badgeConfig[rsvpResponse as 'yes' | 'maybe' | 'no'] || badgeConfig.yes;
                      
                      const isCurrentHost = event.hostMemberId === event.currentUserMemberId;
                      const canVolunteerToHost = !event.isOrganizer && event.currentUserOpenToHosting && !event.hostMemberId && event.currentUserMemberId;
                      const hostableMembers = event.members.filter(m => m.openToHosting && m.id !== event.currentUserMemberId);

                      return (
                        <Card key={event.inviteId} className={`hover-elevate ${rsvpResponse === 'yes' ? 'border-primary/50' : ''}`} data-testid={`upcoming-event-${event.itineraryId}`}>
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              {/* Date/Time Block */}
                              <div className="flex-shrink-0 w-20">
                                <div className="bg-primary text-primary-foreground rounded-lg p-2 text-center">
                                  <div className="text-xs font-semibold uppercase">
                                    {event.eventDate ? format(new Date(event.eventDate), 'MMM') : 'TBD'}
                                  </div>
                                  <div className="text-2xl font-bold leading-none my-1">
                                    {event.eventDate ? format(new Date(event.eventDate), 'd') : '--'}
                                  </div>
                                  <div className="text-xs">
                                    {event.eventDate ? format(new Date(event.eventDate), 'h:mm a') : ''}
                                  </div>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-base flex items-center gap-2">
                                      <span className="text-xl">{event.groupEmoji}</span>
                                      {event.itineraryName}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{event.groupName}</p>
                                  </div>
                                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                                    <Badge variant={badge.variant} className={`gap-1 ${badge.className}`}>
                                      <badge.icon className="h-3 w-3" />
                                      {badge.text}
                                    </Badge>
                                    {event.hostMemberId && event.hostMemberName && (
                                      <Badge variant="default" className="gap-1" data-testid={`badge-host-${event.itineraryId}`}>
                                        <UserCheck className="h-3 w-3" />
                                        {isCurrentHost ? 'You\'re hosting' : `Hosted by ${event.hostMemberName}`}
                                      </Badge>
                                    )}
                                    {!event.hostMemberId && (
                                      <Badge variant="secondary" className="gap-1" data-testid={`badge-ai-hosted-${event.itineraryId}`}>
                                        <Bot className="h-3 w-3" />
                                        AI-hosted
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Simplified Venue Display */}
                                {event.items.length > 0 && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">
                                      {event.items[0].venueName}
                                      {event.items.length > 1 && ` and ${event.items.length - 1} more`}
                                    </span>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 flex-wrap pt-1">
                                  <Link href={`/event/${event.itineraryId}`}>
                                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-${event.itineraryId}`}>
                                      <ExternalLink className="h-4 w-4" />
                                      View Details
                                    </Button>
                                  </Link>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => copyInviteLink(event)}
                                    className="gap-1"
                                    data-testid={`button-copy-link-${event.itineraryId}`}
                                  >
                                    <Copy className="h-4 w-4" />
                                    Copy Link
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past Events Section */}
              {!eventsLoading && pastEvents.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Past Events ({pastEvents.length})</h3>
                  <div className="space-y-3">
                    {pastEvents.map((event) => (
                      <Card key={event.inviteId} className="hover-elevate opacity-75" data-testid={`past-event-${event.itineraryId}`}>
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {/* Date/Time Block - Muted for Past Events */}
                            <div className="flex-shrink-0 w-20">
                              <div className="bg-muted text-muted-foreground rounded-lg p-2 text-center">
                                <div className="text-xs font-semibold uppercase">
                                  {event.eventDate ? format(new Date(event.eventDate), 'MMM') : 'TBD'}
                                </div>
                                <div className="text-2xl font-bold leading-none my-1">
                                  {event.eventDate ? format(new Date(event.eventDate), 'd') : '--'}
                                </div>
                                <div className="text-xs">
                                  {event.eventDate ? format(new Date(event.eventDate), 'h:mm a') : ''}
                                </div>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base flex items-center gap-2">
                                    <span className="text-xl">{event.groupEmoji}</span>
                                    {event.itineraryName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {event.groupName} • {event.eventDate ? format(new Date(event.eventDate), 'MMM d, yyyy') : 'Date TBD'}
                                  </p>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                                  {event.isOrganizer ? (
                                    <Badge variant="outline" className="gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Organizer
                                    </Badge>
                                  ) : event.rsvp && (
                                    <Badge variant={event.rsvp.response === 'yes' ? 'default' : 'outline'}>
                                      {event.rsvp.response === 'yes' ? 'Attended' : (event.rsvp.response === 'maybe' || event.rsvp.response === 'yes_with_constraint') ? 'Maybe' : 'Declined'}
                                    </Badge>
                                  )}
                                  {event.rsvp?.postEventFeedback && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Star className="h-3 w-3" />
                                      Feedback Submitted
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Simplified Venue Display */}
                              {event.items.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    {event.items[0].venueName}
                                    {event.items.length > 1 && ` and ${event.items.length - 1} more`}
                                  </span>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 flex-wrap pt-1">
                                {(event.rsvp?.response === 'yes' || event.isOrganizer) && !event.rsvp?.postEventFeedback && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handlePostEventFeedback(event)}
                                    className="gap-2"
                                    data-testid={`button-feedback-${event.itineraryId}`}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                    Leave Feedback
                                  </Button>
                                )}
                                <Link href={`/event/${event.itineraryId}`}>
                                  <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-${event.itineraryId}`}>
                                    <ExternalLink className="h-4 w-4" />
                                    View Details
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!eventsLoading && events.length === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                    <p className="text-muted-foreground">
                      When you're invited to events or create plans for your groups, they'll appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-groups" data-testid="content-my-groups">
            <div className="space-y-6">
              {/* New Collection Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={() => setCreateCollectionOpen(true)}
                  data-testid="button-new-collection"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Collection
                </Button>
              </div>

              {/* Incomplete Profile Banner */}
              {!isLoading && groups.length > 0 && groups.some(g => 
                g.members.some(m => m.profileCompleted === false)
              ) && (
                <Card className="bg-primary/5 border-primary/20" data-testid="banner-complete-profile">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Complete Your Profile</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Help us personalize your experience by sharing your location, activity preferences, and availability. This helps AI suggest better activities for your groups.
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
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
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
              ) : groups.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Create your first group to get AI-powered activity suggestions
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
                <div className="space-y-4">
                  {/* Collection Sections */}
                  {collectionGroups.map(({ collection, groups: collectionGroupsList }) => (
                    <Collapsible
                      key={collection.id}
                      open={!openCollections.has(collection.id)}
                      onOpenChange={() => toggleCollection(collection.id)}
                      data-testid={`collapsible-collection-${collection.id}`}
                    >
                      <div className="border rounded-md p-4">
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
                            <Badge variant="secondary" className="ml-2">
                              {collectionGroupsList.length}
                            </Badge>
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
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                              {collectionGroupsList.map((group) => (
                                <GroupCard key={group.id} group={group} />
                              ))}
                            </div>
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
                      <div className="border rounded-md p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -ml-2 flex-1" data-testid="trigger-all-groups">
                            {openCollections.has('uncategorized') ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <h3 className="text-lg font-semibold">All Groups</h3>
                            <Badge variant="secondary" className="ml-2">
                              {uncategorizedGroups.length}
                            </Badge>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                            {uncategorizedGroups.map((group) => (
                              <GroupCard key={group.id} group={group} />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                </div>
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
            <DialogDescription>
              Organize your groups into collections for better management.
            </DialogDescription>
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
              {(feedbackEvent?.response === 'maybe' || feedbackEvent?.response === 'yes_with_constraint') ? 'What concerns do you have?' : 'Help us understand why'}
            </DialogTitle>
            <DialogDescription>
              {(feedbackEvent?.response === 'maybe' || feedbackEvent?.response === 'yes_with_constraint')
                ? 'Your feedback helps us plan better events for the group'
                : 'Your feedback helps us understand what to adjust for future events'
              }
            </DialogDescription>
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
            <DialogDescription>
              Your feedback helps us plan better future events
            </DialogDescription>
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
              disabled={postEventFeedbackMutation.isPending}
              data-testid="button-submit-post-feedback"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-event">
          <DialogHeader>
            <DialogTitle>Create an Event</DialogTitle>
            <DialogDescription>
              Select a group to create an event for, or create a new group first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {groups.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label>Select a Group</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`w-full text-left p-3 rounded-md border transition-colors hover-elevate ${
                          selectedGroupId === group.id 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border'
                        }`}
                        data-testid={`button-select-group-${group.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{group.emoji || '👥'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {group.members?.length || 0} members
                            </div>
                          </div>
                          {selectedGroupId === group.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <p className="mb-4">You don't have any groups yet.</p>
              </div>
            )}
            <Link href="/create-group">
              <Button variant="outline" className="w-full" data-testid="button-create-new-group">
                <Plus className="mr-2 h-4 w-4" />
                Create New Group
              </Button>
            </Link>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateEventDialog(false);
                setSelectedGroupId("");
              }}
              data-testid="button-cancel-create-event"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedGroupId) {
                  setShowCreateEventDialog(false);
                  setLocation(`/group/${selectedGroupId}`);
                  setSelectedGroupId("");
                }
              }}
              disabled={!selectedGroupId}
              data-testid="button-continue-create-event"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Account Switcher Dialog */}
      <Dialog open={showTestAccountDialog} onOpenChange={setShowTestAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch to Test Account</DialogTitle>
            <DialogDescription>
              Select a test account to switch to for testing purposes
            </DialogDescription>
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
    </div>
  );
}
