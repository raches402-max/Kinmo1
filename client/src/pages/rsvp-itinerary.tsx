import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Check, X, HelpCircle, User, Users, Baby, CalendarPlus, Star, Sparkles, ChevronRight, UserPlus, Minus, Plus, Lock, PartyPopper } from "lucide-react";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { format } from "date-fns";
import { TimeSlotVoting } from "@/components/TimeSlotVoting";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { cn } from "@/lib/utils";
import { GangsAllHereCelebration } from "@/components/GangsAllHereCelebration";
import { fireKinmoConfetti } from "@/lib/kinmo-confetti";
import { motion, AnimatePresence } from "framer-motion";

type Member = {
  id: string;
  name: string;
  email: string | null;
  isOrganizer?: boolean;
};

type Itinerary = {
  id: string;
  name: string;
  groupId: string;
  eventDate: string | null;
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
    rating: string | null;
    googleMapsUrl: string | null;
    googlePlaceId?: string | null;
    arrivalTime?: string | null;
    departureTime?: string | null;
    travelNotes?: string | null;
    notes?: string | null;
  }>;
  proposedTimeSlots?: Array<{
    id: string;
    proposedDateTime: string;
    label?: string;
    yesCount: number;
    maybeCount: number;
    noCount: number;
  }>;
};

type Group = {
  id: string;
  name: string;
  emoji: string;
  locationBase: string;
};

type RsvpData = {
  id: string;
  response: string;
  rsvpFeedback: any;
  guestName?: string | null;
  additionalAttendees?: Array<{type: 'member' | 'guest'; memberId?: string; name: string}> | null;
  numberOfKids?: number;
};

type AdditionalAttendee = {
  type: 'member' | 'guest';
  memberId?: string;
  name: string;
};

// Type for stored RSVP data retrieved by token
type StoredRsvpData = {
  id: string;
  response: string;
  guestName: string | null;
  memberName?: string | null;
  memberId?: string | null;
  createdAt: string;
};

// Type for guest list data
type GuestListData = {
  guestList: Array<{
    id: string;
    response: string;
    name: string;
    additionalName: string | null;
    numberOfKids: number;
  }>;
  counts: {
    yes: number;
    maybe: number;
    no: number;
  };
};

export default function RsvpItineraryPage() {
  const [location] = useLocation();
  const { toast } = useToast();

  // Parse URL directly to avoid wouter's useRoute edge cases
  // URL pattern: /rsvp/:itineraryId or /rsvp/:itineraryId/:inviteToken
  const pathParts = location.split('/').filter(Boolean);
  // pathParts[0] = "rsvp", pathParts[1] = itineraryId, pathParts[2] = inviteToken (optional)
  const itineraryId = pathParts[1] || null;
  const urlInviteToken = pathParts[2] || null;

  console.log('[RSVP Page] URL:', location, 'itineraryId:', itineraryId, 'urlInviteToken:', urlInviteToken);

  // Fetch shareable invite token if URL doesn't have one (for group chat links like /rsvp/:itineraryId)
  const { data: shareableTokenData } = useQuery<{ inviteToken: string }>({
    queryKey: ["/api/itineraries", itineraryId, "shareable-token"],
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${itineraryId}/shareable-token`);
      if (!response.ok) throw new Error("No shareable token found");
      return response.json();
    },
    enabled: !!itineraryId && !urlInviteToken,
  });

  // Use URL token if available, otherwise use fetched shareable token
  const inviteToken = urlInviteToken || shareableTokenData?.inviteToken || null;

  // Stored RSVP token for returning users
  const [storedRsvpToken, setStoredRsvpToken] = useState<string | null>(null);

  // Identity claiming state
  const [identityClaimed, setIdentityClaimed] = useState(false);
  const [claimedMemberId, setClaimedMemberId] = useState<string | null>(null);
  const [claimedIdentity, setClaimedIdentity] = useState<'member' | 'guest'>('member');
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [tempGuestName, setTempGuestName] = useState("");
  const [tempGuestEmail, setTempGuestEmail] = useState("");
  const [inviteMemberLocked, setInviteMemberLocked] = useState(false);

  // RSVP state
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Additional attendees and kids state
  const [additionalAttendeeType, setAdditionalAttendeeType] = useState<'none' | 'member' | 'guest'>('none');
  const [additionalMemberId, setAdditionalMemberId] = useState<string>("");
  const [additionalGuestName, setAdditionalGuestName] = useState("");
  const [numberOfKids, setNumberOfKids] = useState(0);

  // Feedback form state - availability grid
  const [feedbackAvailability, setFeedbackAvailability] = useState<Record<string, {morning: boolean; afternoon: boolean; evening: boolean}>>({
    Mon: { morning: false, afternoon: false, evening: false },
    Tue: { morning: false, afternoon: false, evening: false },
    Wed: { morning: false, afternoon: false, evening: false },
    Thu: { morning: false, afternoon: false, evening: false },
    Fri: { morning: false, afternoon: false, evening: false },
    Sat: { morning: false, afternoon: false, evening: false },
    Sun: { morning: false, afternoon: false, evening: false },
  });
  const [freeformFeedback, setFreeformFeedback] = useState("");

  // Gang's all here celebration state
  const [showCelebration, setShowCelebration] = useState(false);

  // Check for stored RSVP token on mount
  useEffect(() => {
    if (itineraryId) {
      const token = localStorage.getItem(`rsvp_token_${itineraryId}`);
      if (token) {
        setStoredRsvpToken(token);
      }
    }
  }, [itineraryId]);

  // Fetch existing RSVP by stored token (for returning users)
  const { data: storedRsvp, isLoading: storedRsvpLoading } = useQuery<StoredRsvpData>({
    queryKey: [`/api/guest-rsvp/${storedRsvpToken}`],
    enabled: !!storedRsvpToken && !identityClaimed,
  });

  // Fetch itinerary
  const { data: itinerary, isLoading: itineraryLoading } = useQuery<Itinerary>({
    queryKey: ["/api/itineraries", itineraryId],
    enabled: !!itineraryId,
  });

  // Fetch group
  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", itinerary?.groupId],
    enabled: !!itinerary?.groupId,
  });

  // Fetch group members for identity claiming
  const { data: groupMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/groups", itinerary?.groupId, "members"],
    enabled: !!itinerary?.groupId,
  });

  // Fetch invite info to check if it's tied to a specific member
  const { data: inviteInfo, isLoading: inviteLoading } = useQuery<{ id: string | null; name: string; email: string | null; isOrganizer?: boolean; hasAccount?: boolean }>({
    queryKey: ["/api/members/verify-claim", inviteToken],
    queryFn: async () => {
      const response = await fetch(`/api/members/verify-claim/${inviteToken}`);
      if (!response.ok) {
        throw new Error("Invalid invite");
      }
      return response.json();
    },
    enabled: !!inviteToken,
  });

  // Auto-select member if invite is for a specific person (personal invite only)
  // Shareable links (isOrganizer with id=null) should NOT auto-select - let user pick
  useEffect(() => {
    if (identityClaimed) return;

    if (inviteInfo?.id) {
      // Personal invite with member ID - auto-select the member and lock the selection
      setClaimedMemberId(inviteInfo.id);
      setClaimedIdentity('member');
      setInviteMemberLocked(true);
      setIdentityClaimed(true);
    }
    // Note: Shareable links (inviteInfo?.isOrganizer && !inviteInfo?.id) should NOT auto-select
    // Users should see the member picker to choose who they are
  }, [inviteInfo, identityClaimed, groupMembers]);

  // Fetch existing RSVP - only if identity is claimed (works with or without token)
  const { data: existingRsvp } = useQuery<RsvpData>({
    queryKey: ["/api/rsvps/itinerary", itineraryId, "member", claimedMemberId, "token", inviteToken || "none"],
    queryFn: async () => {
      if (!claimedMemberId || claimedIdentity === 'guest') return null;
      const tokenParam = inviteToken ? `?inviteToken=${inviteToken}` : '';
      const url = `/api/rsvps/itinerary/${itineraryId}/member/${claimedMemberId}${tokenParam}`;
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!itineraryId && !!claimedMemberId && identityClaimed && claimedIdentity === 'member',
  });

  // Fetch guest list (RSVPs) - always fetch but only show after user RSVPs
  const { data: guestListData, refetch: refetchGuestList } = useQuery<GuestListData>({
    queryKey: ["/api/itineraries", itineraryId, "guest-list"],
    queryFn: async () => {
      const response = await fetch(`/api/itineraries/${itineraryId}/guest-list`);
      if (!response.ok) throw new Error("Failed to fetch guest list");
      return response.json();
    },
    enabled: !!itineraryId,
  });

  // Update local response state when existing RSVP loads
  useEffect(() => {
    if (existingRsvp?.response) {
      setSelectedResponse(existingRsvp.response);
      if (existingRsvp.numberOfKids !== undefined) {
        setNumberOfKids(existingRsvp.numberOfKids);
      }
      if (existingRsvp.additionalAttendees && existingRsvp.additionalAttendees.length > 0) {
        const attendee = existingRsvp.additionalAttendees[0];
        setAdditionalAttendeeType(attendee.type);
        if (attendee.type === 'member' && attendee.memberId) {
          setAdditionalMemberId(attendee.memberId);
        } else if (attendee.type === 'guest') {
          setAdditionalGuestName(attendee.name);
        }
      }
    }
  }, [existingRsvp]);

  // RSVP mutation with optimistic updates
  const rsvpMutation = useMutation({
    mutationFn: async ({ response, feedback }: { response: string; feedback?: any }) => {
      // Build additional attendees array
      let additionalAttendees: AdditionalAttendee[] | null = null;
      if (additionalAttendeeType === 'member' && additionalMemberId) {
        const member = groupMembers?.find(m => m.id === additionalMemberId);
        if (member) {
          additionalAttendees = [{
            type: 'member',
            memberId: member.id,
            name: member.name || member.email || 'Unknown',
          }];
        }
      } else if (additionalAttendeeType === 'guest' && additionalGuestName.trim()) {
        additionalAttendees = [{
          type: 'guest',
          name: additionalGuestName.trim(),
        }];
      }

      console.log('[RSVP Submit] inviteToken:', inviteToken, 'itineraryId:', itineraryId);
      if (!inviteToken) {
        throw new Error("Invite token is missing from URL");
      }
      return await apiRequest("POST", `/api/rsvps`, {
        itineraryId,
        inviteToken,
        claimedMemberId: claimedIdentity === 'member' ? claimedMemberId : null,
        guestName: claimedIdentity === 'guest' ? guestName : null,
        guestEmail: claimedIdentity === 'guest' && guestEmail ? guestEmail : null,
        response,
        rsvpFeedback: feedback,
        additionalAttendees,
        numberOfKids,
      });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/rsvps/itinerary", itineraryId] });

      // Optimistically update the UI immediately
      setSelectedResponse(variables.response);

      // Return context for rollback
      return { previousResponse: selectedResponse };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rsvps/itinerary", itineraryId] });

      // Refetch guest list to show updated attendees
      refetchGuestList();

      // Store RSVP token for returning users
      if (data?.guestToken && itineraryId) {
        localStorage.setItem(`rsvp_token_${itineraryId}`, data.guestToken);
        setStoredRsvpToken(data.guestToken);
      }

      // Check if this RSVP completed the group (all members said yes)
      if (data.isCompletingVote && data.gangsAllHere) {
        setShowCelebration(true);
      } else {
        // Fire Kinmo confetti celebration for successful RSVP
        fireKinmoConfetti();
        toast({
          title: "RSVP recorded",
          description: "Your response has been saved",
        });
      }
      setShowFeedbackForm(false);
    },
    onError: (error: Error, _, context) => {
      // Rollback optimistic update on error
      if (context?.previousResponse) {
        setSelectedResponse(context.previousResponse);
      }
      toast(getErrorToast(error));
    },
  });

  const handleContinueIdentity = () => {
    if (claimedIdentity === 'guest') {
      if (!tempGuestName.trim()) {
        toast({
          title: "Name required",
          description: "Please enter your name",
          variant: "destructive",
        });
        return;
      }
      setGuestName(tempGuestName.trim());
      setGuestEmail(tempGuestEmail.trim());
    } else if (!claimedMemberId) {
      toast({
        title: "Selection required",
        description: "Please select who you are",
        variant: "destructive",
      });
      return;
    }
    setIdentityClaimed(true);
  };

  const handleRsvp = (response: string) => {
    if (response === "yes") {
      rsvpMutation.mutate({ response });
    } else {
      setSelectedResponse(response);
      setShowFeedbackForm(true);
    }
  };

  const handleSubmitFeedback = () => {
    const feedback: any = {};

    // Include availability grid data
    const hasAnyAvailability = Object.values(feedbackAvailability).some(
      day => day.morning || day.afternoon || day.evening
    );
    if (hasAnyAvailability) {
      feedback.availability = feedbackAvailability;
    }

    if (freeformFeedback.trim()) {
      feedback.freeformFeedback = freeformFeedback.trim();
    }

    rsvpMutation.mutate({
      response: selectedResponse!,
      feedback: Object.keys(feedback).length > 0 ? feedback : undefined
    });
  };

  // Get display name based on claimed identity
  const getDisplayName = () => {
    if (claimedIdentity === 'guest') {
      return guestName;
    } else if (claimedMemberId) {
      // Always prefer inviteInfo name if available (handles case where organizer's
      // member record is filtered from groupMembers list)
      if (inviteInfo?.name) {
        return inviteInfo.name;
      }
      const member = groupMembers?.find(m => m.id === claimedMemberId);
      return member?.name || member?.email || 'Unknown';
    }
    return '';
  };

  // Get available members for additional attendees (exclude claimed member)
  const availableMembers = groupMembers?.filter(m => m.id !== claimedMemberId) || [];

  // Loading state - only wait for inviteLoading if there's a token
  const isLoading = itineraryLoading || groupLoading || membersLoading || storedRsvpLoading || (inviteToken && inviteLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(38,40%,97%)] to-[hsl(35,35%,94%)] flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] mx-auto mb-4 animate-pulse shadow-[0_4px_20px_rgba(245,192,48,0.35)]" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-[hsl(44,91%,57%)] mx-auto animate-ping opacity-20" />
          </div>
          <p className="text-[hsl(25,20%,40%)] font-medium">Loading event details...</p>
        </motion.div>
      </div>
    );
  }

  // Error states
  if (!itinerary || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(38,40%,97%)] to-[hsl(35,35%,94%)] flex items-center justify-center p-4">
        <motion.div
          className="max-w-md w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="rounded-3xl border-2 border-[hsl(350,40%,85%)] bg-white p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
            <div className="w-16 h-16 rounded-full bg-[hsl(350,45%,95%)] flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-[hsl(350,50%,55%)]" />
            </div>
            <h2 className="text-2xl font-bold text-[hsl(25,30%,14%)] font-display">Event not found</h2>
            <p className="text-[hsl(25,15%,45%)] mt-2">This event link may be invalid or expired</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Format event date for display
  const eventDate = itinerary.eventDate ? new Date(itinerary.eventDate) : null;
  const isPastEvent = eventDate && eventDate < new Date();

  // Step 1: Identity Claiming (show first, before event details)
  if (!identityClaimed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[hsl(38,40%,97%)] to-[hsl(35,35%,94%)]">
        {/* Decorative background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[hsl(44,91%,57%)] opacity-[0.08] blur-3xl" />
          <div className="absolute top-1/3 -left-32 w-48 h-48 rounded-full bg-[hsl(350,45%,72%)] opacity-[0.06] blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-[hsl(145,25%,72%)] opacity-[0.05] blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto p-4 py-8 sm:py-12 space-y-6">
          {/* Event Header Card */}
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-white border border-[hsl(32,25%,88%)] shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Gold accent stripe */}
            <div className="h-1.5 bg-gradient-to-r from-[hsl(44,91%,57%)] via-[hsl(38,85%,52%)] to-[hsl(44,91%,57%)]" />

            <div className="p-6 sm:p-8 text-center">
              {/* Group emoji */}
              <motion.div
                className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] shadow-[0_8px_24px_rgba(245,192,48,0.4)] mb-5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              >
                <span className="text-4xl sm:text-5xl">{group.emoji}</span>
              </motion.div>

              {/* Event name */}
              <motion.h1
                className="text-2xl sm:text-3xl font-bold text-[hsl(25,30%,14%)] mb-2 font-display leading-tight"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {itinerary.name}
              </motion.h1>

              {/* Group name */}
              <motion.p
                className="text-[hsl(25,15%,45%)] mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                from <span className="font-semibold text-[hsl(25,25%,35%)]">{group.name}</span>
              </motion.p>

              {/* Date/Time pill */}
              {eventDate && (
                <motion.div
                  className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[hsl(44,80%,96%)] border border-[hsl(44,60%,85%)]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-1.5 text-[hsl(25,30%,25%)]">
                    <Calendar className="h-4 w-4 text-[hsl(44,87%,50%)]" />
                    <span className="font-semibold text-sm">{format(eventDate, "EEE, MMM d")}</span>
                  </div>
                  <div className="w-px h-4 bg-[hsl(44,60%,80%)]" />
                  <div className="flex items-center gap-1.5 text-[hsl(25,30%,25%)]">
                    <Clock className="h-4 w-4 text-[hsl(44,87%,50%)]" />
                    <span className="font-semibold text-sm">{format(eventDate, "h:mm a")}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Show existing RSVP status if found */}
          <AnimatePresence>
            {storedRsvp && (
              <motion.div
                className={cn(
                  "rounded-2xl border-2 overflow-hidden",
                  storedRsvp.response === 'yes' && "border-[hsl(145,45%,65%)] bg-[hsl(145,50%,97%)]",
                  storedRsvp.response === 'maybe' && "border-[hsl(44,60%,70%)] bg-[hsl(44,80%,97%)]",
                  storedRsvp.response === 'no' && "border-[hsl(350,45%,70%)] bg-[hsl(350,50%,97%)]"
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-full",
                      storedRsvp.response === 'yes' && "bg-[hsl(145,50%,45%)] text-white",
                      storedRsvp.response === 'maybe' && "bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)]",
                      storedRsvp.response === 'no' && "bg-[hsl(350,50%,50%)] text-white"
                    )}>
                      {storedRsvp.response === 'yes' && <Check className="h-5 w-5" />}
                      {storedRsvp.response === 'maybe' && <HelpCircle className="h-5 w-5" />}
                      {storedRsvp.response === 'no' && <X className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "font-semibold text-base",
                        storedRsvp.response === 'yes' && "text-[hsl(145,50%,25%)]",
                        storedRsvp.response === 'maybe' && "text-[hsl(44,60%,25%)]",
                        storedRsvp.response === 'no' && "text-[hsl(350,50%,30%)]"
                      )}>
                        You RSVP'd: {storedRsvp.response === 'yes' ? "Going!" : storedRsvp.response === 'maybe' ? "Maybe" : "Can't make it"}
                      </p>
                      <p className="text-sm text-[hsl(25,15%,45%)]">
                        as {storedRsvp.memberName || storedRsvp.guestName || 'Guest'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[hsl(25,15%,50%)] mt-3 pl-14">
                    Select your name below to update your response
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Identity Claiming Card */}
          <motion.div
            className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Card Header */}
            <div className="relative px-6 py-5 border-b border-[hsl(32,20%,90%)] bg-gradient-to-r from-[hsl(38,45%,98%)] to-[hsl(44,50%,97%)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] text-[hsl(25,30%,14%)] shadow-[0_4px_12px_rgba(245,192,48,0.3)]">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[hsl(25,30%,14%)]">Who's RSVPing?</h2>
                  <p className="text-sm text-[hsl(25,15%,45%)]">Select your name to continue</p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-6 space-y-5">
              <RadioGroup
                value={claimedIdentity === 'guest' ? 'guest' : (claimedMemberId || '')}
                onValueChange={(value) => {
                  if (value === 'guest') {
                    setClaimedIdentity('guest');
                    setClaimedMemberId(null);
                  } else {
                    setClaimedIdentity('member');
                    setClaimedMemberId(value);
                  }
                }}
              >
                {groupMembers && groupMembers.length > 0 && (
                  <div className="space-y-2.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[hsl(25,15%,50%)]">Group Members</Label>
                    {groupMembers.map((member, index) => (
                      <motion.label
                        key={member.id}
                        htmlFor={`member-${member.id}`}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl cursor-pointer",
                          "border-2 transition-all duration-200",
                          claimedMemberId === member.id
                            ? "border-[hsl(44,91%,57%)] bg-gradient-to-r from-[hsl(44,85%,97%)] to-[hsl(44,80%,95%)] shadow-[0_2px_12px_rgba(245,192,48,0.15)]"
                            : "border-[hsl(32,20%,90%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(38,60%,98%)]"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.05 }}
                      >
                        <RadioGroupItem
                          value={member.id}
                          id={`member-${member.id}`}
                          data-testid={`radio-member-${member.id}`}
                          className="border-[hsl(32,20%,80%)] text-[hsl(44,91%,50%)] h-5 w-5"
                        />
                        <span className={cn(
                          "font-medium",
                          claimedMemberId === member.id ? "text-[hsl(25,35%,18%)]" : "text-[hsl(25,25%,25%)]"
                        )}>
                          I'm {member.name || member.email}
                        </span>
                        {claimedMemberId === member.id && (
                          <Check className="h-4 w-4 ml-auto text-[hsl(44,87%,45%)]" />
                        )}
                      </motion.label>
                    ))}
                  </div>
                )}

                <div className="pt-5 border-t border-[hsl(32,20%,90%)] space-y-3">
                  <motion.label
                    htmlFor="guest"
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl cursor-pointer",
                      "border-2 transition-all duration-200",
                      claimedIdentity === 'guest'
                        ? "border-[hsl(350,45%,72%)] bg-gradient-to-r from-[hsl(350,50%,98%)] to-[hsl(350,45%,96%)]"
                        : "border-[hsl(32,20%,90%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(350,40%,80%)] hover:bg-[hsl(350,50%,99%)]"
                    )}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <RadioGroupItem
                      value="guest"
                      id="guest"
                      data-testid="radio-guest"
                      className="border-[hsl(32,20%,80%)] text-[hsl(350,50%,60%)] h-5 w-5"
                    />
                    <span className={cn(
                      "font-medium",
                      claimedIdentity === 'guest' ? "text-[hsl(350,40%,30%)]" : "text-[hsl(25,25%,25%)]"
                    )}>I'm a guest (not on the list)</span>
                  </motion.label>

                  <AnimatePresence>
                    {claimedIdentity === 'guest' && (
                      <motion.div
                        className="ml-4 space-y-3 pl-4 border-l-2 border-[hsl(350,40%,85%)]"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="guest-name" className="text-sm font-medium text-[hsl(25,30%,20%)]">Your name</Label>
                          <Input
                            id="guest-name"
                            placeholder="Enter your name"
                            value={tempGuestName}
                            onChange={(e) => setTempGuestName(e.target.value)}
                            data-testid="input-guest-name"
                            className="border-[hsl(32,20%,85%)] focus:border-[hsl(350,50%,70%)] focus:ring-[hsl(350,45%,72%)] h-12 text-base rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="guest-email" className="text-sm font-medium text-[hsl(25,30%,20%)]">Email <span className="text-[hsl(25,15%,55%)] font-normal">(optional)</span></Label>
                          <Input
                            id="guest-email"
                            type="email"
                            placeholder="your@email.com"
                            value={tempGuestEmail}
                            onChange={(e) => setTempGuestEmail(e.target.value)}
                            data-testid="input-guest-email"
                            className="border-[hsl(32,20%,85%)] focus:border-[hsl(350,50%,70%)] focus:ring-[hsl(350,45%,72%)] h-12 text-base rounded-xl"
                          />
                          <p className="text-sm text-[hsl(25,15%,50%)]">Get updates about this event</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RadioGroup>

              <Button
                onClick={handleContinueIdentity}
                className={cn(
                  "w-full h-14 text-base font-bold rounded-2xl",
                  "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)]",
                  "text-[hsl(25,30%,14%)]",
                  "hover:from-[hsl(44,91%,52%)] hover:to-[hsl(38,85%,47%)]",
                  "shadow-[0_4px_16px_rgba(245,192,48,0.35)]",
                  "transition-all duration-200 hover:shadow-[0_6px_20px_rgba(245,192,48,0.45)]"
                )}
                data-testid="button-continue-identity"
              >
                Continue to RSVP
                <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          </motion.div>

          {/* Kinmo branding */}
          <motion.p
            className="text-center text-sm text-[hsl(25,15%,55%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Powered by <span className="font-semibold text-[hsl(44,87%,45%)]">Kinmo</span>
          </motion.p>
        </div>
      </div>
    );
  }

  // Step 2+: Show full event details and RSVP
  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(38,40%,97%)] to-[hsl(35,35%,94%)]">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[hsl(44,91%,57%)] opacity-[0.08] blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-48 h-48 rounded-full bg-[hsl(145,30%,65%)] opacity-[0.06] blur-3xl" />
      </div>

      {/* Gang's all here celebration */}
      <GangsAllHereCelebration
        show={showCelebration}
        onComplete={() => {
          setShowCelebration(false);
          toast({
            title: "RSVP recorded",
            description: "You completed the group! Everyone's in.",
          });
        }}
      />

      <div className="relative max-w-3xl mx-auto p-4 py-8 sm:py-12 space-y-5">
        {/* Compact Event Header */}
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-white border border-[hsl(32,25%,88%)] shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="h-1.5 bg-gradient-to-r from-[hsl(44,91%,57%)] via-[hsl(38,85%,52%)] to-[hsl(44,91%,57%)]" />

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {/* Group emoji */}
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] shadow-[0_4px_16px_rgba(245,192,48,0.35)] shrink-0">
                <span className="text-2xl sm:text-3xl">{group.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[hsl(25,30%,14%)] font-display leading-tight truncate">
                  {itinerary.name}
                </h1>
                <p className="text-sm text-[hsl(25,15%,45%)] mt-0.5">from {group.name}</p>

                {/* Claimed identity badge with optional change button */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(44,80%,95%)] border border-[hsl(44,60%,85%)]">
                    <User className="h-3.5 w-3.5 text-[hsl(44,70%,45%)]" />
                    <span className="text-xs font-medium text-[hsl(44,60%,30%)]" data-testid="text-claimed-identity">
                      {claimedIdentity === 'guest' ? guestName : getDisplayName()}
                    </span>
                  </div>
                  {/* Show change button if not locked to a specific member */}
                  {!inviteMemberLocked && (
                    <button
                      onClick={() => {
                        setIdentityClaimed(false);
                        setClaimedMemberId(null);
                        setClaimedIdentity('member');
                        setGuestName("");
                        setGuestEmail("");
                        setTempGuestName("");
                        setTempGuestEmail("");
                      }}
                      className="text-xs text-[hsl(44,70%,40%)] hover:text-[hsl(44,80%,35%)] underline underline-offset-2"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Date/Time row */}
            {eventDate && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[hsl(32,20%,92%)]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[hsl(44,80%,94%)]">
                    <Calendar className="h-4 w-4 text-[hsl(44,80%,45%)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(25,30%,20%)]">
                      {format(eventDate, "EEEE, MMMM d")}
                    </p>
                    {isPastEvent && (
                      <p className="text-xs text-[hsl(350,50%,50%)]">Past event</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[hsl(44,80%,94%)]">
                    <Clock className="h-4 w-4 text-[hsl(44,80%,45%)]" />
                  </div>
                  <p className="text-sm font-semibold text-[hsl(25,30%,20%)]">
                    {format(eventDate, "h:mm a")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Time Slot Voting */}
        {itinerary.proposedTimeSlots && itinerary.proposedTimeSlots.length > 0 && claimedMemberId && (
          <motion.div
            className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-5">
              <TimeSlotVoting
                itineraryId={itinerary.id}
                memberId={claimedMemberId}
                isOrganizer={false}
                isHost={false}
              />
            </div>
          </motion.div>
        )}

        {/* Itinerary Items */}
        <motion.div
          className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Card Header */}
          <div className="relative px-5 sm:px-6 py-4 border-b border-[hsl(32,20%,92%)] bg-gradient-to-r from-[hsl(38,45%,98%)] to-[hsl(44,50%,97%)]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(145,35%,60%)] to-[hsl(145,40%,50%)] text-white shadow-[0_2px_8px_rgba(120,180,130,0.3)]">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-[hsl(25,30%,14%)]">The Plan</span>
                <p className="text-xs text-[hsl(25,15%,50%)]">{itinerary.items.length} {itinerary.items.length === 1 ? 'stop' : 'stops'}</p>
              </div>
            </div>
          </div>

          {/* Card Content - Venues Timeline */}
          <div className="p-5">
            <ItineraryTimeline items={itinerary.items} />
          </div>
        </motion.div>

        {/* RSVP Section */}
        <AnimatePresence mode="wait">
          {showFeedbackForm ? (
            <motion.div
              key="feedback"
              className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Card Header */}
              <div className="relative px-5 sm:px-6 py-4 border-b border-[hsl(32,20%,92%)] bg-gradient-to-r from-[hsl(38,45%,98%)] to-[hsl(44,50%,97%)]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(245,192,48,0.3)]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[hsl(25,30%,14%)]">When works for you?</span>
                    <p className="text-xs text-[hsl(25,15%,50%)]">Help us find a better time (optional)</p>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-5 space-y-5">
                {/* Availability Grid */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-[hsl(25,30%,14%)]">Your availability</Label>
                  <AvailabilityGrid
                    value={feedbackAvailability}
                    onChange={setFeedbackAvailability}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback" className="text-sm font-semibold text-[hsl(25,30%,14%)]">Additional notes <span className="font-normal text-[hsl(25,15%,50%)]">(optional)</span></Label>
                  <Textarea
                    id="feedback"
                    placeholder="Any other constraints or preferences?"
                    value={freeformFeedback}
                    onChange={(e) => setFreeformFeedback(e.target.value)}
                    data-testid="textarea-feedback"
                    rows={2}
                    className="border-[hsl(32,20%,88%)] focus:border-[hsl(44,70%,75%)] rounded-xl resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={rsvpMutation.isPending}
                    className={cn(
                      "flex-1 h-12 font-bold rounded-xl",
                      "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)]",
                      "text-[hsl(25,30%,14%)]",
                      "hover:from-[hsl(44,91%,52%)] hover:to-[hsl(38,85%,47%)]",
                      "shadow-[0_4px_16px_rgba(245,192,48,0.3)]"
                    )}
                    data-testid="button-submit-feedback"
                  >
                    {rsvpMutation.isPending ? "Submitting..." : "Submit Response"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedbackForm(false)}
                    data-testid="button-cancel-feedback"
                    className="border-[hsl(32,20%,88%)] text-[hsl(25,30%,30%)] hover:bg-[hsl(35,40%,97%)] rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="rsvp"
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* RSVP Response Buttons */}
              <motion.div
                className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Card Header */}
                <div className="relative px-5 sm:px-6 py-4 border-b border-[hsl(32,20%,92%)] bg-gradient-to-r from-[hsl(38,45%,98%)] to-[hsl(44,50%,97%)]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(245,192,48,0.3)]">
                      <Star className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-[hsl(25,30%,14%)]">Can you make it?</span>
                      <p className="text-xs text-[hsl(25,15%,50%)]">
                        {selectedResponse ? "Tap to update your response" : "Let us know if you can join"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 space-y-3">
                  {/* Yes Button */}
                  <motion.button
                    onClick={() => handleRsvp("yes")}
                    disabled={rsvpMutation.isPending}
                    data-testid="button-rsvp-yes"
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl",
                      "border-2 transition-all duration-200",
                      selectedResponse === "yes"
                        ? "border-[hsl(145,50%,50%)] bg-gradient-to-r from-[hsl(145,50%,97%)] to-[hsl(145,45%,95%)] shadow-[0_2px_12px_rgba(100,180,120,0.15)]"
                        : "border-[hsl(32,20%,90%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(145,40%,70%)] hover:bg-[hsl(145,50%,98%)]"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl transition-colors",
                      selectedResponse === "yes"
                        ? "bg-[hsl(145,50%,45%)] text-white"
                        : "bg-[hsl(145,40%,92%)] text-[hsl(145,50%,35%)]"
                    )}>
                      <Check className="h-6 w-6" />
                    </div>
                    <div className="text-left flex-1">
                      <div className={cn(
                        "font-bold text-base",
                        selectedResponse === "yes" ? "text-[hsl(145,50%,28%)]" : "text-[hsl(25,30%,14%)]"
                      )}>Yes, I'll be there!</div>
                      <div className="text-sm text-[hsl(25,15%,50%)]">Count me in</div>
                    </div>
                    {selectedResponse === "yes" && (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[hsl(145,50%,45%)] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </motion.button>

                  {/* Maybe Button */}
                  <motion.button
                    onClick={() => handleRsvp("maybe")}
                    disabled={rsvpMutation.isPending}
                    data-testid="button-rsvp-maybe"
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl",
                      "border-2 transition-all duration-200",
                      selectedResponse === "maybe"
                        ? "border-[hsl(44,70%,55%)] bg-gradient-to-r from-[hsl(44,80%,97%)] to-[hsl(44,75%,95%)] shadow-[0_2px_12px_rgba(245,200,80,0.15)]"
                        : "border-[hsl(32,20%,90%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(44,70%,70%)] hover:bg-[hsl(44,80%,98%)]"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl transition-colors",
                      selectedResponse === "maybe"
                        ? "bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)]"
                        : "bg-[hsl(44,60%,92%)] text-[hsl(44,60%,40%)]"
                    )}>
                      <HelpCircle className="h-6 w-6" />
                    </div>
                    <div className="text-left flex-1">
                      <div className={cn(
                        "font-bold text-base",
                        selectedResponse === "maybe" ? "text-[hsl(44,60%,22%)]" : "text-[hsl(25,30%,14%)]"
                      )}>Maybe</div>
                      <div className="text-sm text-[hsl(25,15%,50%)]">Not sure about this time</div>
                    </div>
                    {selectedResponse === "maybe" && (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[hsl(44,87%,55%)] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-[hsl(25,30%,14%)]" />
                      </div>
                    )}
                  </motion.button>

                  {/* No Button */}
                  <motion.button
                    onClick={() => handleRsvp("no")}
                    disabled={rsvpMutation.isPending}
                    data-testid="button-rsvp-no"
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl",
                      "border-2 transition-all duration-200",
                      selectedResponse === "no"
                        ? "border-[hsl(350,50%,60%)] bg-gradient-to-r from-[hsl(350,50%,97%)] to-[hsl(350,45%,95%)] shadow-[0_2px_12px_rgba(200,120,120,0.15)]"
                        : "border-[hsl(32,20%,90%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(350,40%,75%)] hover:bg-[hsl(350,50%,98%)]"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl transition-colors",
                      selectedResponse === "no"
                        ? "bg-[hsl(350,50%,50%)] text-white"
                        : "bg-[hsl(350,40%,93%)] text-[hsl(350,50%,45%)]"
                    )}>
                      <X className="h-6 w-6" />
                    </div>
                    <div className="text-left flex-1">
                      <div className={cn(
                        "font-bold text-base",
                        selectedResponse === "no" ? "text-[hsl(350,50%,32%)]" : "text-[hsl(25,30%,14%)]"
                      )}>Can't make it</div>
                      <div className="text-sm text-[hsl(25,15%,50%)]">This time doesn't work</div>
                    </div>
                    {selectedResponse === "no" && (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[hsl(350,50%,50%)] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </motion.button>

                  {/* Add to Calendar button - shown for all RSVP responses */}
                  {selectedResponse && itinerary.eventDate && (
                    <motion.div
                      className="mt-4 pt-4 border-t border-[hsl(32,20%,92%)]"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <a
                        href={generateCalendarUrlFromItinerary({
                          groupName: group.name,
                          eventName: itinerary.name || group.name,
                          eventDate: itinerary.eventDate,
                          venues: itinerary.items.map(item => ({
                            venueName: item.venueName,
                            venueAddress: item.venueAddress,
                          })),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-[hsl(44,60%,80%)] text-[hsl(25,30%,20%)] hover:bg-[hsl(44,85%,96%)] hover:border-[hsl(44,70%,65%)] transition-all duration-200"
                      >
                        <CalendarPlus className="h-5 w-5 text-[hsl(44,80%,45%)]" />
                        <span className="font-semibold">Add to Google Calendar</span>
                      </a>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Additional Attendees and Kids Count - Only show after selecting a response */}
              {selectedResponse === "yes" && (
                <motion.div
                  className="rounded-3xl border border-[hsl(44,60%,80%)] bg-gradient-to-br from-white to-[hsl(44,60%,99%)] overflow-hidden shadow-[0_4px_20px_rgba(245,192,48,0.08)]"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="p-5 sm:p-6 space-y-5">
                    {/* Compact +1 Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(44,85%,92%)] to-[hsl(38,80%,88%)] flex items-center justify-center">
                            <UserPlus className="h-4 w-4 text-[hsl(44,70%,40%)]" />
                          </div>
                          <span className="text-sm font-semibold text-[hsl(25,30%,18%)]">Bringing a +1?</span>
                        </div>
                        <span className="text-xs text-[hsl(25,15%,55%)]">optional</span>
                      </div>

                      {/* Toggle chips instead of dropdown */}
                      <div className="flex flex-wrap gap-2">
                        <motion.button
                          type="button"
                          onClick={() => {
                            setAdditionalAttendeeType('member');
                            setAdditionalGuestName("");
                          }}
                          className={cn(
                            "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                            additionalAttendeeType === 'member'
                              ? "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(245,192,48,0.3)]"
                              : "bg-[hsl(38,40%,96%)] text-[hsl(25,25%,35%)] hover:bg-[hsl(38,50%,93%)] border border-[hsl(44,40%,88%)]"
                          )}
                          whileTap={{ scale: 0.97 }}
                          data-testid="chip-add-member"
                        >
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            Group member
                          </span>
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => {
                            setAdditionalAttendeeType('guest');
                            setAdditionalMemberId("");
                          }}
                          className={cn(
                            "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                            additionalAttendeeType === 'guest'
                              ? "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(245,192,48,0.3)]"
                              : "bg-[hsl(38,40%,96%)] text-[hsl(25,25%,35%)] hover:bg-[hsl(38,50%,93%)] border border-[hsl(44,40%,88%)]"
                          )}
                          whileTap={{ scale: 0.97 }}
                          data-testid="chip-add-guest"
                        >
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            Outside guest
                          </span>
                        </motion.button>
                      </div>

                      {/* Conditional input based on selection */}
                      <AnimatePresence>
                        {additionalAttendeeType === 'member' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Select
                              value={additionalMemberId}
                              onValueChange={setAdditionalMemberId}
                            >
                              <SelectTrigger
                                data-testid="select-additional-member"
                                className="border-[hsl(44,50%,82%)] bg-white focus:ring-[hsl(44,91%,57%)] focus:border-[hsl(44,91%,57%)] h-11 rounded-xl mt-2"
                              >
                                <SelectValue placeholder="Who's coming with you?" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableMembers.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.name || member.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalAttendeeType('none');
                                setAdditionalMemberId("");
                              }}
                              className="mt-2 text-xs text-[hsl(25,20%,50%)] hover:text-[hsl(25,30%,35%)] transition-colors"
                            >
                              Never mind, just me
                            </button>
                          </motion.div>
                        )}

                        {additionalAttendeeType === 'guest' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Input
                              id="additional-guest-name"
                              placeholder="Guest's name"
                              value={additionalGuestName}
                              onChange={(e) => setAdditionalGuestName(e.target.value)}
                              data-testid="input-additional-guest-name"
                              className="border-[hsl(44,50%,82%)] bg-white focus:ring-[hsl(44,91%,57%)] focus:border-[hsl(44,91%,57%)] h-11 rounded-xl mt-2"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalAttendeeType('none');
                                setAdditionalGuestName("");
                              }}
                              className="mt-2 text-xs text-[hsl(25,20%,50%)] hover:text-[hsl(25,30%,35%)] transition-colors"
                            >
                              Never mind, just me
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Compact Kids Section - inline stepper style */}
                    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-[hsl(38,45%,97%)] border border-[hsl(44,40%,90%)]">
                      <div className="flex items-center gap-2">
                        <Baby className="h-4 w-4 text-[hsl(44,70%,45%)]" />
                        <span className="text-sm font-medium text-[hsl(25,30%,20%)]">Kids</span>
                        <span className="text-xs text-[hsl(25,15%,55%)]">(ages 0-12)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <motion.button
                          type="button"
                          onClick={() => setNumberOfKids(Math.max(0, numberOfKids - 1))}
                          disabled={numberOfKids === 0}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                            numberOfKids === 0
                              ? "bg-[hsl(38,30%,92%)] text-[hsl(25,15%,70%)] cursor-not-allowed"
                              : "bg-white border border-[hsl(44,50%,80%)] text-[hsl(25,30%,30%)] hover:border-[hsl(44,70%,65%)] active:scale-95"
                          )}
                          whileTap={numberOfKids > 0 ? { scale: 0.9 } : {}}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </motion.button>
                        <span className="w-8 text-center font-semibold text-[hsl(25,30%,18%)]" data-testid="kids-count-display">
                          {numberOfKids}
                        </span>
                        <motion.button
                          type="button"
                          onClick={() => setNumberOfKids(Math.min(10, numberOfKids + 1))}
                          disabled={numberOfKids >= 10}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                            numberOfKids >= 10
                              ? "bg-[hsl(38,30%,92%)] text-[hsl(25,15%,70%)] cursor-not-allowed"
                              : "bg-white border border-[hsl(44,50%,80%)] text-[hsl(25,30%,30%)] hover:border-[hsl(44,70%,65%)] active:scale-95"
                          )}
                          whileTap={numberOfKids < 10 ? { scale: 0.9 } : {}}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </motion.button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={() => rsvpMutation.mutate({ response: selectedResponse })}
                      disabled={rsvpMutation.isPending}
                      className={cn(
                        "w-full h-12 font-bold text-base rounded-2xl",
                        "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)]",
                        "text-[hsl(25,30%,14%)]",
                        "hover:from-[hsl(44,91%,52%)] hover:to-[hsl(38,85%,47%)]",
                        "shadow-[0_4px_16px_rgba(245,192,48,0.35)]",
                        "transition-all duration-200"
                      )}
                      data-testid="button-submit-rsvp"
                    >
                      {rsvpMutation.isPending ? "Saving..." : "Save RSVP"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Guest List Section */}
              {guestListData && (guestListData.counts.yes > 0 || guestListData.counts.maybe > 0) && (
                <motion.div
                  className="rounded-3xl border border-[hsl(32,25%,88%)] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Header */}
                  <div className="relative px-5 sm:px-6 py-4 border-b border-[hsl(32,20%,92%)] bg-gradient-to-r from-[hsl(38,45%,98%)] to-[hsl(44,50%,97%)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(350,55%,62%)] to-[hsl(350,50%,55%)] text-white shadow-[0_2px_8px_rgba(220,100,120,0.25)]">
                          <PartyPopper className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-[hsl(25,30%,14%)]">Who's Coming</span>
                          <p className="text-xs text-[hsl(25,15%,50%)]">
                            {guestListData.counts.yes} going{guestListData.counts.maybe > 0 ? `, ${guestListData.counts.maybe} maybe` : ''}
                          </p>
                        </div>
                      </div>
                      {!selectedResponse && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(25,20%,92%)] text-[hsl(25,20%,45%)]">
                          <Lock className="h-3 w-3" />
                          <span className="text-xs font-medium">RSVP to see</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 sm:p-6">
                    <AnimatePresence mode="wait">
                      {!selectedResponse ? (
                        /* Locked state - blurred teaser */
                        <motion.div
                          key="locked"
                          className="relative"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {/* Blurred avatar row */}
                          <div className="flex items-center gap-2 blur-sm select-none pointer-events-none">
                            {[...Array(Math.min(guestListData.counts.yes + guestListData.counts.maybe, 5))].map((_, i) => (
                              <div
                                key={i}
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(44,60%,85%)] to-[hsl(38,55%,80%)] flex items-center justify-center"
                              >
                                <span className="text-sm font-bold text-[hsl(44,50%,40%)]">
                                  {String.fromCharCode(65 + i)}
                                </span>
                              </div>
                            ))}
                            {(guestListData.counts.yes + guestListData.counts.maybe) > 5 && (
                              <div className="w-10 h-10 rounded-full bg-[hsl(25,15%,90%)] flex items-center justify-center">
                                <span className="text-xs font-medium text-[hsl(25,20%,50%)]">
                                  +{(guestListData.counts.yes + guestListData.counts.maybe) - 5}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Overlay message */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border border-[hsl(32,20%,88%)] shadow-sm">
                              <p className="text-sm font-medium text-[hsl(25,25%,30%)]">
                                RSVP to see who's coming
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        /* Unlocked state - full guest list */
                        <motion.div
                          key="unlocked"
                          className="space-y-3"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Going section */}
                          {guestListData.guestList.filter(g => g.response === 'yes' || g.response === 'going').length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-[hsl(145,50%,92%)] flex items-center justify-center">
                                  <Check className="h-3 w-3 text-[hsl(145,50%,40%)]" />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(145,40%,35%)]">Going</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {guestListData.guestList
                                  .filter(g => g.response === 'yes' || g.response === 'going')
                                  .map((guest, i) => (
                                    <motion.div
                                      key={guest.id}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[hsl(145,45%,95%)] to-[hsl(145,40%,93%)] border border-[hsl(145,35%,85%)]"
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                    >
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(145,50%,60%)] to-[hsl(145,45%,50%)] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                        {guest.name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-medium text-[hsl(145,40%,25%)]">{guest.name}</span>
                                      {guest.additionalName && (
                                        <span className="text-xs text-[hsl(145,30%,40%)]">+{guest.additionalName}</span>
                                      )}
                                      {guest.numberOfKids > 0 && (
                                        <span className="text-xs text-[hsl(145,30%,45%)] flex items-center gap-0.5">
                                          <Baby className="h-3 w-3" />{guest.numberOfKids}
                                        </span>
                                      )}
                                    </motion.div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Maybe section */}
                          {guestListData.guestList.filter(g => g.response === 'maybe' || g.response === 'tentative').length > 0 && (
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-[hsl(44,60%,92%)] flex items-center justify-center">
                                  <HelpCircle className="h-3 w-3 text-[hsl(44,60%,40%)]" />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(44,50%,35%)]">Maybe</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {guestListData.guestList
                                  .filter(g => g.response === 'maybe' || g.response === 'tentative')
                                  .map((guest, i) => (
                                    <motion.div
                                      key={guest.id}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[hsl(44,55%,96%)] to-[hsl(44,50%,94%)] border border-[hsl(44,45%,85%)]"
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 + 0.2 }}
                                    >
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(44,70%,60%)] to-[hsl(44,65%,50%)] flex items-center justify-center text-[hsl(25,30%,20%)] text-xs font-bold shadow-sm">
                                        {guest.name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-medium text-[hsl(44,40%,25%)]">{guest.name}</span>
                                      {guest.additionalName && (
                                        <span className="text-xs text-[hsl(44,30%,40%)]">+{guest.additionalName}</span>
                                      )}
                                    </motion.div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Join Group CTA - show after RSVP details when member doesn't have an account */}
              {(selectedResponse === 'yes' || selectedResponse === 'maybe') && claimedMemberId && !inviteInfo?.hasAccount && (
                <motion.div
                  className="rounded-3xl border-2 border-[hsl(44,70%,78%)] bg-gradient-to-br from-[hsl(44,70%,98%)] to-[hsl(38,60%,96%)] overflow-hidden shadow-[0_4px_20px_rgba(245,192,48,0.12)]"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(44,91%,57%)] to-[hsl(38,85%,48%)] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(245,192,48,0.3)]">
                        <Sparkles className="h-5 w-5 text-[hsl(25,35%,18%)]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-[hsl(25,35%,18%)] text-lg mb-1">
                          Join {group.name}
                        </h3>
                        <p className="text-sm text-[hsl(25,20%,40%)] mb-4">
                          Create an account to see all your {group.name} events in one place and get notified when new plans are made.
                        </p>
                        <Button
                          className={cn(
                            "w-full h-12 font-bold rounded-xl",
                            "bg-gradient-to-r from-[hsl(44,91%,57%)] to-[hsl(38,85%,52%)]",
                            "text-[hsl(25,30%,14%)]",
                            "hover:from-[hsl(44,91%,52%)] hover:to-[hsl(38,85%,47%)]",
                            "shadow-[0_4px_16px_rgba(245,192,48,0.35)]"
                          )}
                          onClick={() => {
                            // Store memberId for account linking
                            if (claimedMemberId) {
                              localStorage.setItem("linkMemberId", claimedMemberId);
                              localStorage.setItem("linkReturnPath", `/rsvp/${itineraryId}/${inviteToken}`);
                            }
                            // Redirect to auth with return to link page
                            window.location.href = "/api/login?returnTo=" + encodeURIComponent("/link-member-account");
                          }}
                        >
                          Create Account
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kinmo branding */}
        <motion.p
          className="text-center text-sm text-[hsl(25,15%,55%)] pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Powered by <span className="font-semibold text-[hsl(44,87%,45%)]">Kinmo</span>
        </motion.p>
      </div>
    </div>
  );
}
