# Existing Kinmo Mutation Patterns

This reference shows real mutation patterns extracted from the Kinmo codebase.

## File Structure

The main mutation hook is at `client/src/hooks/useGroupMutations.ts` with ~740 lines and 30+ mutations organized into categories:

- Group management
- Member management
- Preferences
- Itinerary management
- Event creation & management
- AI & generation
- Automation
- Activities/Venues
- Voting

## Pattern: Simple Mutation

```typescript
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
```

## Pattern: Mutation with Object Parameters

```typescript
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
```

## Pattern: Mutation with Callback

```typescript
const saveItineraryMutation = useMutation({
  mutationFn: async ({ itineraryId, name, timingRecommendations }: {
    itineraryId: string;
    name: string;
    timingRecommendations?: string
  }) => {
    return await apiRequest("POST", `/api/itineraries/${itineraryId}/save`, { name, timingRecommendations });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "saved-itineraries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "itineraries"] });
    callbacks.onSaveItinerarySuccess?.();  // Callback to parent
    toast({ title: "Itinerary saved", description: "You can now send this itinerary to your group anytime" });
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

## Pattern: Mutation with Response Data in Success

```typescript
const updateGroupMutation = useMutation({
  mutationFn: async ({ updates, newMembers }: { updates: any; newMembers: { name: string; email: string }[] }) => {
    const response = await apiRequest("PATCH", `/api/groups/${groupId}`, updates);

    if (newMembers.length > 0) {
      await Promise.all(
        newMembers.map(member => {
          const memberData: any = { isOrganizer: false, invitationSent: false, hasJoined: false };
          if (member.name.trim()) memberData.name = member.name.trim();
          if (member.email.trim()) memberData.email = member.email.trim();
          return apiRequest("POST", `/api/groups/${groupId}/join`, memberData);
        })
      );
    }
    return response;
  },
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
    callbacks.onEditGroupSuccess?.();

    // Dynamic toast based on response data
    let description = "Your group details have been saved";
    let variant: "default" | "destructive" | undefined = undefined;

    if (data?.cadenceChange) {
      const { oldCadence, newCadence, eventsCleared, eventsCreated } = data.cadenceChange;
      description = `Cadence changed from ${oldCadence} to ${newCadence}. Cleared ${eventsCleared} old event(s).`;
    } else if (data?.geocodingResult === 'failed') {
      description = "Group updated, but location couldn't be geocoded.";
      variant = "destructive";
    }

    toast({ title: "Group updated", description, variant });
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

## Pattern: Optimistic Update (Toggle)

```typescript
const toggleAutomationMutation = useMutation({
  mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
    return await apiRequest("PATCH", `/api/groups/${groupId}/automation`, { [field]: value });
  },
  onMutate: async ({ field, value }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["/api/groups", groupId] });

    // Snapshot the previous value
    const previousGroup = queryClient.getQueryData(["/api/groups", groupId]);

    // Optimistically update the cache
    queryClient.setQueryData(["/api/groups", groupId], (old: any) => {
      if (!old) return old;
      return { ...old, [field]: value };
    });

    // Return context with the snapshot
    return { previousGroup };
  },
  onSuccess: (_, variables) => {
    const fieldNames: Record<string, string> = {
      autoActivitiesEnabled: "Auto-generate Activities",
      autoItineraryEnabled: "Auto-create Itinerary Drafts",
      autoScheduleEnabled: "Auto-schedule Events",
    };
    toast({
      title: variables.value ? "Automation enabled" : "Automation disabled",
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
```

## Pattern: Complex Event Creation

```typescript
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
```

## Pattern: Mutation Without Toast (Silent)

```typescript
const voteMutation = useMutation({
  mutationFn: async ({ eventId, voteType }: { eventId: string; voteType: 'upvote' | 'downvote' }) => {
    return await apiRequest("POST", `/api/voting-events/${eventId}/vote`, { voteType });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "my-votes"] });
    // No toast - voting is a quick, silent action
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

## Pattern: Mutation with Dynamic Success Message

```typescript
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
```

## Return Object Pattern

```typescript
return {
  // Group management
  updateGroup: updateGroupMutation,
  updateRadius: updateRadiusMutation,

  // Member management
  deleteMember: deleteMemberMutation,
  updateMember: updateMemberMutation,
  toggleHosting: toggleHostingMutation,

  // ... more categories
};
```

## Usage in Components

```typescript
// Get mutations from hook
const mutations = useGroupMutations({
  groupId: groupId || '',
  callbacks: {
    onEditGroupSuccess: () => setEditDialogOpen(false),
  }
});

// Use in JSX
<Button
  onClick={() => mutations.deleteMember.mutate(memberId)}
  disabled={mutations.deleteMember.isPending}
>
  {mutations.deleteMember.isPending ? <Loader2 className="animate-spin" /> : "Delete"}
</Button>
```
