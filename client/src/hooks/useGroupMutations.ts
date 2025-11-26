/**
 * useGroupMutations - Custom hook for all group-related mutations
 * Extracted from group-detail.tsx for better organization and reusability
 */

import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";

interface UseGroupMutationsOptions {
  groupId: string;
  // Callbacks for state updates that need to happen in the parent component
  callbacks?: {
    onEditGroupSuccess?: () => void;
    onEditMemberSuccess?: () => void;
    onSaveItinerarySuccess?: () => void;
    onDuplicateItinerarySuccess?: (newItinerary: any) => void;
    onDeleteItinerarySuccess?: () => void;
    onCreateEventSuccess?: (data: any) => void;
    onSendItinerarySuccess?: () => void;
    onFinalizeSuccess?: () => void;
  };
}

export function useGroupMutations({ groupId, callbacks = {} }: UseGroupMutationsOptions) {
  const { toast } = useToast();

  // ============================================
  // GROUP MANAGEMENT MUTATIONS
  // ============================================

  const updateGroupMutation = useMutation({
    mutationFn: async ({ updates, newMembers }: { updates: any; newMembers: { name: string; email: string }[] }) => {
      const response = await apiRequest("PATCH", `/api/groups/${groupId}`, updates);

      if (newMembers.length > 0) {
        await Promise.all(
          newMembers.map(member => {
            const memberData: any = {
              isOrganizer: false,
              invitationSent: false,
              hasJoined: false,
            };
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
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events", "timeline"] });
      callbacks.onEditGroupSuccess?.();

      let description = "Your group details have been saved";
      let variant: "default" | "destructive" | undefined = undefined;

      if (data?.cadenceChange) {
        const { oldCadence, newCadence, eventsCleared, eventsCreated } = data.cadenceChange;
        description = `Cadence changed from ${oldCadence} to ${newCadence}. Cleared ${eventsCleared} old event(s) and created ${eventsCreated} new event(s) with the new schedule.`;
      } else if (data?.geocodingResult === 'failed') {
        description = "Group updated, but location couldn't be geocoded. Venue suggestions may be less accurate. Try using a more specific location like 'Oakland, California' instead of just 'Oakland'.";
        variant = "destructive";
      }

      toast({ title: "Group updated", description, variant });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateRadiusMutation = useMutation({
    mutationFn: async (radius: number) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}`, { searchRadiusMiles: radius });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      toast({ title: "Search radius updated", description: "Your venue search radius has been updated" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // MEMBER MANAGEMENT MUTATIONS
  // ============================================

  const sendInvitationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/send-invitations`, {});
    },
    onSuccess: (data: any) => {
      toast({ title: "Invitations sent!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return await apiRequest("DELETE", `/api/members/${memberId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      toast({ title: "Member removed", description: "The member has been removed from the group" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: { name?: string; email?: string } }) => {
      return await apiRequest("PATCH", `/api/members/${memberId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      callbacks.onEditMemberSuccess?.();
      toast({ title: "Member updated", description: "Member details have been updated" });
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
      toast(getErrorToast(error));
    },
  });

  const inviteGuestMutation = useMutation({
    mutationFn: async ({ itineraryId, guestName, guestEmail, response }: { itineraryId: string; guestName: string; guestEmail: string; response: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/guest-invite`, { guestName, guestEmail, response });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      toast({ title: "Guest added", description: `${data.guestName || 'Guest'} has been added to the event` });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // PREFERENCES MUTATIONS
  // ============================================

  const updateMyPreferencesMutation = useMutation({
    mutationFn: async (preferences: {
      budgetOverrideMin?: number | null;
      budgetOverrideMax?: number | null;
      categoryPreferencesOverride?: string[] | null;
      availabilityOverride?: any;
      meetingFrequencyOverride?: string | null
    }) => {
      return await apiRequest("PATCH", `/api/groups/${groupId}/my-preferences`, preferences);
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Your preferences for this group have been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-preferences"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // ITINERARY MUTATIONS
  // ============================================

  const saveItineraryMutation = useMutation({
    mutationFn: async ({ itineraryId, name, timingRecommendations }: { itineraryId: string; name: string; timingRecommendations?: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/save`, { name, timingRecommendations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
      callbacks.onSaveItinerarySuccess?.();
      toast({ title: "Itinerary saved", description: "You can now send this itinerary to your group anytime" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const deleteSavedItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      toast({ title: "Itinerary deleted", description: "The saved itinerary has been removed" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const duplicateItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/duplicate`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      callbacks.onDuplicateItinerarySuccess?.(data);
      toast({ title: "Itinerary duplicated", description: "A copy has been created and is ready to edit" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateItineraryMutation = useMutation({
    mutationFn: async ({ itineraryId, updates }: { itineraryId: string; updates: { name?: string; venues?: any[] } }) => {
      return await apiRequest("PATCH", `/api/itineraries/${itineraryId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      toast({ title: "Itinerary updated", description: "Your changes have been saved" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const deleteItineraryMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events", "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      callbacks.onDeleteItinerarySuccess?.();
      toast({ title: "Event deleted", description: "The event has been removed" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const addItineraryItemsMutation = useMutation({
    mutationFn: async ({ itineraryId, items }: {
      itineraryId: string;
      items: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>
    }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/items`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      toast({ title: "Venues added", description: "The venues have been added to your itinerary" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const validateItineraryMutation = useMutation({
    mutationFn: async (venues: Array<{sourceType: 'activity' | 'voting_event' | 'ad_hoc' | 'google_place', sourceId: string, adHocData?: any}>) => {
      return await apiRequest("POST", `/api/groups/${groupId}/validate-itinerary`, { venues });
    },
  });

  // ============================================
  // EVENT CREATION & MANAGEMENT MUTATIONS
  // ============================================

  const createEventMutation = useMutation({
    mutationFn: async ({
      venues,
      eventDate,
      scheduleMethod,
      proposedTimeSlots,
      rsvpDeadline,
      name,
      timingRecommendations,
      backupOf
    }: {
      venues: Array<{sourceType: 'activity' | 'voting_event' | 'ad_hoc', sourceId: string, adHocData?: any}>;
      eventDate?: Date;
      scheduleMethod: 'pick_time' | 'vote_on_times';
      proposedTimeSlots?: Array<{ proposedDateTime: Date; label?: string }>;
      rsvpDeadline?: Date;
      name?: string;
      timingRecommendations?: any;
      backupOf?: string;
    }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/create-event`, {
        venues,
        eventDate: eventDate?.toISOString(),
        scheduleMethod,
        proposedTimeSlots: proposedTimeSlots?.map(slot => ({
          proposedDateTime: slot.proposedDateTime.toISOString(),
          label: slot.label
        })),
        rsvpDeadline: rsvpDeadline?.toISOString(),
        name,
        timingRecommendations,
        backupOf
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events", "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      callbacks.onCreateEventSuccess?.(data);
      toast({ title: "Event created!", description: "Invitations will be sent to group members" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const sendItineraryMutation = useMutation({
    mutationFn: async (params: { itineraryId: string; eventDate?: string; eventDates?: string[]; autoScheduleConfig?: any }) => {
      return await apiRequest("POST", `/api/itineraries/${params.itineraryId}/send`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      callbacks.onSendItinerarySuccess?.();
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const sendBackupMutation = useMutation({
    mutationFn: async ({ savedItineraryId, originalItineraryId }: { savedItineraryId: string; originalItineraryId: string }) => {
      return await apiRequest("POST", `/api/itineraries/${savedItineraryId}/send-backup`, { originalItineraryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      toast({ title: "Backup plan sent", description: "Alternative plan sent to members with constraints" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const finalizePlanMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/finalize`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      callbacks.onFinalizeSuccess?.();
      toast({ title: "Plan finalized!", description: "The event is now confirmed" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (itineraryId: string) => {
      return await apiRequest("DELETE", `/api/itineraries/${itineraryId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events", "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({ title: "Event cancelled", description: "The event has been cancelled" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ itineraryId, updates }: { itineraryId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/itineraries/${itineraryId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({ title: "Event updated", description: "Your changes have been saved" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const createRsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, response, constraintText }: { itineraryId: string; response: 'yes' | 'no' | 'yes_with_constraint'; constraintText?: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/rsvps`, { response, constraintText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // AI & GENERATION MUTATIONS
  // ============================================

  const getAiTimeSuggestionMutation = useMutation({
    mutationFn: async ({ itineraryId, venues, constraints }: { itineraryId?: string; venues: any[]; constraints?: any }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/ai-time-suggestion`, { itineraryId, venues, constraints });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const generateCategoryMutation = useMutation({
    mutationFn: async ({ category, forceFresh }: { category: string; forceFresh?: boolean }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/generate-category`, { category, forceFresh });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
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
      toast({
        title: "New suggestions generated!",
        description: `Replaced unchecked ${variables.category} suggestions`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const retryGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/retry-generation`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      toast({ title: "Retrying generation", description: "Attempting to generate venues again..." });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const cancelGenerationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/cancel-generation`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
      toast({ title: "Generation cancelled", description: "Venue generation has been stopped" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // AUTOMATION MUTATIONS
  // ============================================

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
      // Rollback on error
      if (context?.previousGroup) {
        queryClient.setQueryData(["/api/groups", groupId], context.previousGroup);
      }
      toast(getErrorToast(error));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    },
  });

  const triggerAutoScheduleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/groups/${groupId}/trigger-auto-schedule`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "auto-scheduled-events", "timeline"] });
      toast({
        title: "Auto-schedule triggered",
        description: data.message || "Checking for events to schedule...",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // ============================================
  // ACTIVITY/VENUE MUTATIONS
  // ============================================

  const clearActivitiesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/groups/${groupId}/activities`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      toast({ title: "Activities cleared", description: "All generated activities have been removed" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const createActivityFromCategoryResultMutation = useMutation({
    mutationFn: async (venue: any) => {
      return await apiRequest("POST", `/api/groups/${groupId}/activities/from-category-result`, venue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
      toast({ title: "Venue added", description: "The venue has been added to your library" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ activityId, feedback }: { activityId: string; feedback: 'positive' | 'negative' }) => {
      return await apiRequest("POST", `/api/activities/${activityId}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    },
  });

  // ============================================
  // VOTING MUTATIONS
  // ============================================

  const addVotingEventMutation = useMutation({
    mutationFn: async (venue: {
      title: string;
      venueType?: string;
      venueAddress?: string;
      photoUrl?: string;
      rating?: string;
      reviewCount?: number;
      priceLevel?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      city?: string;
      addToCart?: boolean;
      showToast?: boolean;
      allowDuplicate?: boolean;
    }) => {
      return await apiRequest("POST", `/api/groups/${groupId}/voting-events`, venue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      toast({ title: "Venue added to favorites", description: "Group members can now vote on this venue" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const updateVotingEventMutation = useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/voting-events/${eventId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      toast({ title: "Favorite updated", description: "Your changes have been saved" });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
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
      toast(getErrorToast(error));
    },
  });

  const removeVoteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${eventId}/vote`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  return {
    // Group management
    updateGroup: updateGroupMutation,
    updateRadius: updateRadiusMutation,

    // Member management
    sendInvitations: sendInvitationsMutation,
    deleteMember: deleteMemberMutation,
    updateMember: updateMemberMutation,
    toggleHosting: toggleHostingMutation,
    inviteGuest: inviteGuestMutation,

    // Preferences
    updateMyPreferences: updateMyPreferencesMutation,

    // Itinerary management
    saveItinerary: saveItineraryMutation,
    deleteSavedItinerary: deleteSavedItineraryMutation,
    duplicateItinerary: duplicateItineraryMutation,
    updateItinerary: updateItineraryMutation,
    deleteItinerary: deleteItineraryMutation,
    addItineraryItems: addItineraryItemsMutation,
    validateItinerary: validateItineraryMutation,

    // Event creation & management
    createEvent: createEventMutation,
    sendItinerary: sendItineraryMutation,
    sendBackup: sendBackupMutation,
    finalizePlan: finalizePlanMutation,
    deleteEvent: deleteEventMutation,
    updateEvent: updateEventMutation,
    createRsvp: createRsvpMutation,

    // AI & generation
    getAiTimeSuggestion: getAiTimeSuggestionMutation,
    generateCategory: generateCategoryMutation,
    regenerateCategory: regenerateCategoryMutation,
    retryGeneration: retryGenerationMutation,
    cancelGeneration: cancelGenerationMutation,

    // Automation
    toggleAutomation: toggleAutomationMutation,
    triggerAutoSchedule: triggerAutoScheduleMutation,

    // Activities/Venues
    clearActivities: clearActivitiesMutation,
    createActivityFromCategoryResult: createActivityFromCategoryResultMutation,
    feedback: feedbackMutation,

    // Voting
    addVotingEvent: addVotingEventMutation,
    updateVotingEvent: updateVotingEventMutation,
    vote: voteMutation,
    removeVote: removeVoteMutation,
  };
}
