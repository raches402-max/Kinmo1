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
import { Calendar, MapPin, Clock, Check, X, HelpCircle, User, Users, Baby, CalendarPlus, Star, Sparkles } from "lucide-react";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { format } from "date-fns";
import { TimeSlotVoting } from "@/components/TimeSlotVoting";
import { generateCalendarUrlFromItinerary } from "@/lib/calendar";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { cn } from "@/lib/utils";
import { GangsAllHereCelebration } from "@/components/GangsAllHereCelebration";
import { fireKinmoConfetti } from "@/lib/kinmo-confetti";

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

  // Auto-select member if invite is for a specific person
  useEffect(() => {
    if (identityClaimed) return;

    if (inviteInfo?.id) {
      // Personal invite with member ID - auto-select the member and lock the selection
      setClaimedMemberId(inviteInfo.id);
      setClaimedIdentity('member');
      setInviteMemberLocked(true);
      setIdentityClaimed(true);
    } else if (inviteInfo?.isOrganizer && groupMembers) {
      // Organizer invite (no member ID in invite) - find organizer's member record from the group
      // The organizer entry in groupMembers now has their real member ID (if they have one)
      const organizerEntry = groupMembers.find(m => m.isOrganizer);

      if (organizerEntry && !organizerEntry.id.startsWith('organizer-')) {
        // Organizer has a real member ID - auto-select them
        setClaimedMemberId(organizerEntry.id);
        setClaimedIdentity('member');
        setInviteMemberLocked(true);
        setIdentityClaimed(true);
      }
      // If organizer only has virtual ID, let them choose manually
    }
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
      <div className="min-h-screen bg-[hsl(38,35%,97%)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(44,87%,63%)] mx-auto mb-4"></div>
          <p className="text-[hsl(25,15%,45%)]">Loading event details...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (!itinerary || !group) {
    return (
      <div className="min-h-screen bg-[hsl(38,35%,97%)] flex items-center justify-center p-4">
        <div className={cn(
          "max-w-md w-full rounded-2xl border bg-white overflow-hidden p-6",
          "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        )}>
          <h2 className="text-xl font-bold text-[hsl(25,30%,14%)]">Event not found</h2>
          <p className="text-[hsl(25,15%,45%)] mt-2">This event link may be invalid or expired</p>
        </div>
      </div>
    );
  }

  // Step 1: Identity Claiming (show first, before event details)
  if (!identityClaimed) {
    return (
      <div className="min-h-screen bg-[hsl(38,35%,97%)]">
        <div className="max-w-2xl mx-auto p-4 py-10 space-y-8">
          {/* Event Header */}
          <div className="text-center space-y-3">
            <div className={cn(
              "inline-flex items-center justify-center w-20 h-20 rounded-full",
              "bg-[hsl(44,87%,63%)] shadow-[0_4px_20px_rgba(242,201,76,0.4)]"
            )}>
              <span className="text-4xl">{group.emoji}</span>
            </div>
            <h1 className="text-3xl font-black text-[hsl(25,30%,14%)]">{itinerary.name}</h1>
            <p className="text-[hsl(25,15%,45%)]">from {group.name}</p>
          </div>

          {/* Show existing RSVP status if found */}
          {storedRsvp && (
            <div className={cn(
              "rounded-2xl border overflow-hidden",
              storedRsvp.response === 'yes' && "border-[hsl(145,50%,70%)] bg-[hsl(145,50%,97%)]",
              storedRsvp.response === 'maybe' && "border-[hsl(44,70%,70%)] bg-[hsl(44,80%,97%)]",
              storedRsvp.response === 'no' && "border-[hsl(350,50%,70%)] bg-[hsl(350,50%,97%)]"
            )}>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    storedRsvp.response === 'yes' && "bg-[hsl(145,50%,45%)] text-white",
                    storedRsvp.response === 'maybe' && "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                    storedRsvp.response === 'no' && "bg-[hsl(350,50%,50%)] text-white"
                  )}>
                    {storedRsvp.response === 'yes' && <Check className="h-5 w-5" />}
                    {storedRsvp.response === 'maybe' && <HelpCircle className="h-5 w-5" />}
                    {storedRsvp.response === 'no' && <X className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-semibold",
                      storedRsvp.response === 'yes' && "text-[hsl(145,50%,25%)]",
                      storedRsvp.response === 'maybe' && "text-[hsl(44,60%,25%)]",
                      storedRsvp.response === 'no' && "text-[hsl(350,50%,30%)]"
                    )}>
                      You already RSVP'd: {storedRsvp.response === 'yes' ? "Going" : storedRsvp.response === 'maybe' ? "Maybe" : "Can't make it"}
                    </p>
                    <p className="text-sm text-[hsl(25,15%,45%)]">
                      as {storedRsvp.memberName || storedRsvp.guestName || 'Guest'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[hsl(25,15%,50%)] mt-3">
                  Select your name below to update your response
                </p>
              </div>
            </div>
          )}

          {/* Identity Claiming Card */}
          <div className={cn(
            "rounded-2xl border bg-white overflow-hidden",
            "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          )}>
            {/* Card Header */}
            <div
              className="relative px-6 py-5 border-b border-[hsl(32,20%,88%)]"
              style={{
                background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                  "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                )}>
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[hsl(25,30%,14%)]">Who's RSVPing?</h2>
                  <p className="text-sm text-[hsl(25,15%,45%)]">Select your name or enter as a guest</p>
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
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide text-[hsl(25,15%,45%)]">Group Members</Label>
                    {groupMembers.map((member) => (
                      <label
                        key={member.id}
                        htmlFor={`member-${member.id}`}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl cursor-pointer",
                          "border border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)]",
                          "transition-all duration-200",
                          "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
                          claimedMemberId === member.id && "border-[hsl(44,87%,63%)] bg-[hsl(44,80%,97%)]"
                        )}
                      >
                        <RadioGroupItem
                          value={member.id}
                          id={`member-${member.id}`}
                          data-testid={`radio-member-${member.id}`}
                          className="border-[hsl(32,20%,80%)] text-[hsl(44,87%,50%)]"
                        />
                        <span className="font-medium text-[hsl(25,30%,14%)]">
                          I'm {member.name || member.email}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="pt-5 border-t border-[hsl(32,20%,88%)] space-y-3">
                  <label
                    htmlFor="guest"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer",
                      "border border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)]",
                      "transition-all duration-200",
                      "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
                      claimedIdentity === 'guest' && "border-[hsl(44,87%,63%)] bg-[hsl(44,80%,97%)]"
                    )}
                  >
                    <RadioGroupItem
                      value="guest"
                      id="guest"
                      data-testid="radio-guest"
                      className="border-[hsl(32,20%,80%)] text-[hsl(44,87%,50%)]"
                    />
                    <span className="font-medium text-[hsl(25,30%,14%)]">I'm a guest</span>
                  </label>

                  {claimedIdentity === 'guest' && (
                    <div className="ml-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="guest-name" className="text-sm text-[hsl(25,30%,14%)]">Your name</Label>
                        <Input
                          id="guest-name"
                          placeholder="Enter your name"
                          value={tempGuestName}
                          onChange={(e) => setTempGuestName(e.target.value)}
                          data-testid="input-guest-name"
                          className="border-[hsl(32,20%,88%)] focus:border-[hsl(44,70%,75%)] focus:ring-[hsl(44,87%,63%)]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guest-email" className="text-sm text-[hsl(25,30%,14%)]">Email (optional)</Label>
                        <Input
                          id="guest-email"
                          type="email"
                          placeholder="your@email.com"
                          value={tempGuestEmail}
                          onChange={(e) => setTempGuestEmail(e.target.value)}
                          data-testid="input-guest-email"
                          className="border-[hsl(32,20%,88%)] focus:border-[hsl(44,70%,75%)] focus:ring-[hsl(44,87%,63%)]"
                        />
                        <p className="text-xs text-[hsl(25,15%,50%)]">Get updates about this event</p>
                      </div>
                    </div>
                  )}
                </div>
              </RadioGroup>

              <Button
                onClick={handleContinueIdentity}
                className={cn(
                  "w-full h-12 text-base font-semibold",
                  "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                  "hover:bg-[hsl(44,87%,58%)]",
                  "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                )}
                data-testid="button-continue-identity"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2+: Show full event details and RSVP
  return (
    <div className="min-h-screen bg-[hsl(38,35%,97%)]">
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

      <div className="max-w-3xl mx-auto p-4 py-10 space-y-6">
        {/* Event Header with claimed identity */}
        <div className="text-center space-y-3">
          <div className={cn(
            "inline-flex items-center justify-center w-20 h-20 rounded-full",
            "bg-[hsl(44,87%,63%)] shadow-[0_4px_20px_rgba(242,201,76,0.4)]"
          )}>
            <span className="text-4xl">{group.emoji}</span>
          </div>
          <h1 className="text-3xl font-black text-[hsl(25,30%,14%)]">{itinerary.name}</h1>
          <p className="text-[hsl(25,15%,45%)]">from {group.name}</p>
          <div
            className="inline-block px-4 py-1.5 rounded-full bg-[hsl(44,80%,95%)] border border-[hsl(44,70%,80%)]"
            data-testid="text-claimed-identity"
          >
            <span className="text-sm font-medium text-[hsl(44,60%,30%)]">
              {claimedIdentity === 'guest' ? `RSVP as guest: ${guestName}` : `RSVP for ${getDisplayName()}`}
            </span>
          </div>
        </div>

        {/* Event Date/Time */}
        {itinerary.eventDate && (
          <div className={cn(
            "rounded-2xl border bg-white overflow-hidden",
            "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          )}>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-[hsl(25,30%,14%)]">
                    {format(new Date(itinerary.eventDate), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-[hsl(25,30%,14%)]">
                    {format(new Date(itinerary.eventDate), "h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Slot Voting */}
        {itinerary.proposedTimeSlots && itinerary.proposedTimeSlots.length > 0 && claimedMemberId && (
          <div className={cn(
            "rounded-2xl border bg-white overflow-hidden",
            "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          )}>
            <div className="p-5">
              <TimeSlotVoting
                itineraryId={itinerary.id}
                memberId={claimedMemberId}
                isOrganizer={false}
                isHost={false}
              />
            </div>
          </div>
        )}

        {/* Itinerary Items */}
        <div className={cn(
          "rounded-2xl border bg-white overflow-hidden",
          "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        )}>
          {/* Card Header */}
          <div
            className="relative px-6 py-4 border-b border-[hsl(32,20%,88%)]"
            style={{
              background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full",
                "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
              )}>
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">Plan</span>
                <p className="text-sm text-[hsl(25,15%,45%)]">Here's what we'll do</p>
              </div>
            </div>
          </div>

          {/* Card Content - Venues Timeline */}
          <div className="p-5">
            <ItineraryTimeline items={itinerary.items} />
          </div>
        </div>

        {/* RSVP Section */}
        {showFeedbackForm ? (
          <div className={cn(
            "rounded-2xl border bg-white overflow-hidden",
            "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          )}>
            {/* Card Header */}
            <div
              className="relative px-6 py-4 border-b border-[hsl(32,20%,88%)]"
              style={{
                background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full",
                  "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                  "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                )}>
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">When works for you?</span>
                  <p className="text-sm text-[hsl(25,15%,45%)]">Help us find a better time (optional)</p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-5 space-y-5">
              {/* Availability Grid */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-[hsl(25,30%,14%)]">Your availability</Label>
                <AvailabilityGrid
                  value={feedbackAvailability}
                  onChange={setFeedbackAvailability}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-sm font-medium text-[hsl(25,30%,14%)]">Additional notes (optional)</Label>
                <Textarea
                  id="feedback"
                  placeholder="Any other constraints or preferences?"
                  value={freeformFeedback}
                  onChange={(e) => setFreeformFeedback(e.target.value)}
                  data-testid="textarea-feedback"
                  rows={2}
                  className="border-[hsl(32,20%,88%)] focus:border-[hsl(44,70%,75%)]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={rsvpMutation.isPending}
                  className={cn(
                    "flex-1 h-11 font-semibold",
                    "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                    "hover:bg-[hsl(44,87%,58%)]",
                    "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                  )}
                  data-testid="button-submit-feedback"
                >
                  {rsvpMutation.isPending ? "Submitting..." : "Submit Response"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFeedbackForm(false)}
                  data-testid="button-cancel-feedback"
                  className="border-[hsl(32,20%,88%)] text-[hsl(25,30%,30%)] hover:bg-[hsl(35,40%,97%)]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* RSVP Response Buttons */}
            <div className={cn(
              "rounded-2xl border bg-white overflow-hidden",
              "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            )}>
              {/* Card Header */}
              <div
                className="relative px-6 py-4 border-b border-[hsl(32,20%,88%)]"
                style={{
                  background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full",
                    "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
                    "shadow-[0_2px_8px_rgba(242,201,76,0.3)]"
                  )}>
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">Can you make it?</span>
                    <p className="text-sm text-[hsl(25,15%,45%)]">
                      {selectedResponse ? "You can update your response anytime" : "Let us know if you can join"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-5 space-y-3">
                {/* Yes Button */}
                <button
                  onClick={() => handleRsvp("yes")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-yes"
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl",
                    "border transition-all duration-200",
                    selectedResponse === "yes"
                      ? "border-[hsl(145,50%,50%)] bg-[hsl(145,50%,97%)]"
                      : "border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(145,40%,70%)] hover:bg-[hsl(145,50%,98%)]"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    selectedResponse === "yes"
                      ? "bg-[hsl(145,50%,45%)] text-white"
                      : "bg-[hsl(145,40%,90%)] text-[hsl(145,50%,35%)]"
                  )}>
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-semibold",
                      selectedResponse === "yes" ? "text-[hsl(145,50%,30%)]" : "text-[hsl(25,30%,14%)]"
                    )}>Yes, I'll be there!</div>
                    <div className="text-xs text-[hsl(25,15%,50%)]">Count me in</div>
                  </div>
                </button>

                {/* Maybe Button */}
                <button
                  onClick={() => handleRsvp("maybe")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-maybe"
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl",
                    "border transition-all duration-200",
                    selectedResponse === "maybe"
                      ? "border-[hsl(44,70%,60%)] bg-[hsl(44,80%,97%)]"
                      : "border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(44,80%,98%)]"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    selectedResponse === "maybe"
                      ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
                      : "bg-[hsl(44,60%,90%)] text-[hsl(44,60%,35%)]"
                  )}>
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-semibold",
                      selectedResponse === "maybe" ? "text-[hsl(44,60%,25%)]" : "text-[hsl(25,30%,14%)]"
                    )}>Maybe</div>
                    <div className="text-xs text-[hsl(25,15%,50%)]">Not sure about this time</div>
                  </div>
                </button>

                {/* No Button */}
                <button
                  onClick={() => handleRsvp("no")}
                  disabled={rsvpMutation.isPending}
                  data-testid="button-rsvp-no"
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl",
                    "border transition-all duration-200",
                    selectedResponse === "no"
                      ? "border-[hsl(350,50%,60%)] bg-[hsl(350,50%,97%)]"
                      : "border-[hsl(32,20%,88%)] bg-[hsl(38,50%,99%)] hover:border-[hsl(350,40%,75%)] hover:bg-[hsl(350,50%,98%)]"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    selectedResponse === "no"
                      ? "bg-[hsl(350,50%,50%)] text-white"
                      : "bg-[hsl(350,40%,92%)] text-[hsl(350,50%,40%)]"
                  )}>
                    <X className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "font-semibold",
                      selectedResponse === "no" ? "text-[hsl(350,50%,35%)]" : "text-[hsl(25,30%,14%)]"
                    )}>Can't make it</div>
                    <div className="text-xs text-[hsl(25,15%,50%)]">This time doesn't work</div>
                  </div>
                </button>

                {selectedResponse && (
                  <div className={cn(
                    "mt-2 p-3 rounded-xl text-sm",
                    selectedResponse === "yes" && "bg-[hsl(145,50%,95%)] border border-[hsl(145,40%,80%)]",
                    selectedResponse === "maybe" && "bg-[hsl(44,80%,95%)] border border-[hsl(44,60%,80%)]",
                    selectedResponse === "no" && "bg-[hsl(350,50%,96%)] border border-[hsl(350,40%,85%)]"
                  )}>
                    <p className={cn(
                      "font-medium",
                      selectedResponse === "yes" && "text-[hsl(145,50%,30%)]",
                      selectedResponse === "maybe" && "text-[hsl(44,60%,25%)]",
                      selectedResponse === "no" && "text-[hsl(350,50%,35%)]"
                    )}>Your response: {
                      selectedResponse === "yes" ? "Going" :
                      selectedResponse === "maybe" ? "Maybe" :
                      "Can't make it"
                    }</p>
                  </div>
                )}

                {/* Add to Calendar button - shown for all RSVP responses */}
                {selectedResponse && itinerary.eventDate && (
                  <div className="mt-4 pt-4 border-t border-[hsl(44,70%,75%)]">
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
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-dashed border-[hsl(44,70%,75%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(44,87%,63%)]/10 hover:border-[hsl(44,87%,63%)] transition-all duration-200"
                    >
                      <CalendarPlus className="h-5 w-5 text-[hsl(44,87%,63%)]" />
                      <span className="font-medium">Add to Google Calendar</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Create Account CTA - show after RSVP when member doesn't have an account */}
            {(selectedResponse === 'yes' || selectedResponse === 'maybe') && claimedMemberId && !inviteInfo?.hasAccount && (
              <div className="rounded-2xl border border-[hsl(200,70%,85%)] bg-[hsl(200,50%,97%)] shadow-[0_2px_8px_rgba(59,130,246,0.12)] overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[hsl(200,70%,90%)] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-[hsl(200,70%,45%)]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[hsl(200,50%,25%)] mb-1">
                        Find your {group.name} events
                      </h3>
                      <p className="text-sm text-[hsl(200,40%,35%)] mb-4">
                        Create an account to see all upcoming events in one place and get notified when new plans are made.
                      </p>
                      <Button
                        className="w-full bg-[hsl(200,70%,50%)] hover:bg-[hsl(200,70%,45%)] text-white"
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
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Attendees and Kids Count - Only show after selecting a response */}
            {selectedResponse === "yes" && (
              <div className="rounded-2xl border border-[hsl(44,70%,75%)] bg-[hsl(38,50%,98%)] shadow-[0_2px_8px_rgba(242,201,76,0.12)] overflow-hidden">
                {/* Header with gradient */}
                <div className="px-5 py-4 bg-gradient-to-r from-[hsl(38,35%,97%)] to-[hsl(44,45%,96%)] border-b border-[hsl(44,70%,75%)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[hsl(44,87%,63%)]/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-[hsl(44,87%,63%)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)]">Additional Details</h3>
                      <p className="text-sm text-[hsl(25,20%,40%)]">Let us know if you're bringing anyone else</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Additional Attendees */}
                  <div className="space-y-3">
                    <Label htmlFor="additional-attendee" className="text-base font-semibold text-[hsl(25,30%,14%)]">
                      Also RSVPing for (optional)
                    </Label>
                    <p className="text-sm text-[hsl(25,20%,40%)]">
                      Maximum 2 people total including yourself
                    </p>

                    <Select
                      value={additionalAttendeeType}
                      onValueChange={(value: 'none' | 'member' | 'guest') => {
                        setAdditionalAttendeeType(value);
                        if (value === 'none') {
                          setAdditionalMemberId("");
                          setAdditionalGuestName("");
                        }
                      }}
                    >
                      <SelectTrigger
                        data-testid="select-additional-attendee-type"
                        className="border-[hsl(44,70%,75%)] bg-white focus:ring-[hsl(44,87%,63%)] focus:border-[hsl(44,87%,63%)]"
                      >
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No one else</SelectItem>
                        <SelectItem value="member">A group member</SelectItem>
                        <SelectItem value="guest">A guest</SelectItem>
                      </SelectContent>
                    </Select>

                    {additionalAttendeeType === 'member' && (
                      <div className="space-y-2">
                        <Label htmlFor="additional-member" className="text-[hsl(25,30%,14%)]">Select member</Label>
                        <Select
                          value={additionalMemberId}
                          onValueChange={setAdditionalMemberId}
                        >
                          <SelectTrigger
                            data-testid="select-additional-member"
                            className="border-[hsl(44,70%,75%)] bg-white focus:ring-[hsl(44,87%,63%)] focus:border-[hsl(44,87%,63%)]"
                          >
                            <SelectValue placeholder="Choose a member" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name || member.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {additionalAttendeeType === 'guest' && (
                      <div className="space-y-2">
                        <Label htmlFor="additional-guest-name" className="text-[hsl(25,30%,14%)]">Guest name</Label>
                        <Input
                          id="additional-guest-name"
                          placeholder="Enter guest name"
                          value={additionalGuestName}
                          onChange={(e) => setAdditionalGuestName(e.target.value)}
                          data-testid="input-additional-guest-name"
                          className="border-[hsl(44,70%,75%)] bg-white focus:ring-[hsl(44,87%,63%)] focus:border-[hsl(44,87%,63%)]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Kids Count */}
                  <div className="space-y-3">
                    <Label htmlFor="kids-count" className="text-base font-semibold text-[hsl(25,30%,14%)] flex items-center gap-2">
                      <Baby className="h-4 w-4 text-[hsl(44,87%,63%)]" />
                      Number of kids (optional)
                    </Label>
                    <Input
                      id="kids-count"
                      type="number"
                      min="0"
                      max="10"
                      value={numberOfKids}
                      onChange={(e) => setNumberOfKids(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                      data-testid="input-kids-count"
                      className="border-[hsl(44,70%,75%)] bg-white focus:ring-[hsl(44,87%,63%)] focus:border-[hsl(44,87%,63%)]"
                    />
                    <p className="text-xs text-[hsl(25,20%,40%)]">
                      Ages 0-12
                    </p>
                  </div>

                  {/* Submit Button for Additional Details */}
                  <Button
                    onClick={() => rsvpMutation.mutate({ response: selectedResponse })}
                    disabled={rsvpMutation.isPending}
                    className="w-full bg-[hsl(44,87%,63%)] hover:bg-[hsl(44,87%,55%)] text-[hsl(25,30%,14%)] font-semibold shadow-[0_2px_8px_rgba(242,201,76,0.3)] transition-all duration-200"
                    data-testid="button-submit-rsvp"
                  >
                    {rsvpMutation.isPending ? "Saving..." : "Save RSVP"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
