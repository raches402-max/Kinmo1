---
name: kinmo-mutation
description: Create React Query mutations with toast notifications, error handling, and query invalidation for Kinmo. Use when adding new mutations to useGroupMutations hook or creating inline mutations.
---

# Kinmo Mutation Patterns

When creating mutations for Kinmo, follow these established patterns.

## Adding to useGroupMutations Hook

Location: `client/src/hooks/useGroupMutations.ts`

### Standard Mutation Template

```typescript
const myMutation = useMutation({
  mutationFn: async (params: { id: string; data: any }) => {
    return await apiRequest("PATCH", `/api/endpoint/${params.id}`, params.data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    toast({ title: "Success title", description: "Success description" });
    callbacks.onMyMutationSuccess?.();  // Optional callback for parent state updates
  },
  onError: (error: Error) => {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  },
});
```

### With Optimistic Updates (for toggles/quick actions)

```typescript
const toggleMutation = useMutation({
  mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
    return await apiRequest("PATCH", `/api/groups/${groupId}/settings`, { [field]: value });
  },
  onMutate: async ({ field, value }) => {
    await queryClient.cancelQueries({ queryKey: ["/api/groups", groupId] });
    const previousData = queryClient.getQueryData(["/api/groups", groupId]);
    queryClient.setQueryData(["/api/groups", groupId], (old: any) => ({
      ...old,
      [field]: value
    }));
    return { previousData };
  },
  onSuccess: (_, variables) => {
    toast({
      title: variables.value ? "Enabled" : "Disabled",
      description: `Setting has been ${variables.value ? 'turned on' : 'turned off'}`,
    });
  },
  onError: (error: Error, _, context) => {
    if (context?.previousData) {
      queryClient.setQueryData(["/api/groups", groupId], context.previousData);
    }
    toast({ title: "Error", description: error.message, variant: "destructive" });
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
  },
});
```

## Common Query Keys to Invalidate

```typescript
// Group data
["/api/groups", groupId]
["/api/groups", groupId, "members"]
["/api/groups", groupId, "activities"]
["/api/groups", groupId, "voting-events"]
["/api/groups", groupId, "my-votes"]
["/api/groups", groupId, "saved-itineraries"]
["/api/groups", groupId, "proposed-itineraries"]
["/api/groups", groupId, "auto-scheduled-events"]
["/api/groups", groupId, "nearby-suggestions"]

// User data
["/api/user/events"]
["/api/members/me/events"]
```

## Hook Return Structure

Add new mutations to the return object in the appropriate category:

```typescript
return {
  // Group management
  updateGroup: updateGroupMutation,
  updateRadius: updateRadiusMutation,

  // Member management
  deleteMember: deleteMemberMutation,
  updateMember: updateMemberMutation,
  toggleHosting: toggleHostingMutation,
  inviteGuest: inviteGuestMutation,

  // Itinerary management
  saveItinerary: saveItineraryMutation,
  deleteItinerary: deleteItineraryMutation,
  // ... add new mutations here

  // Voting
  vote: voteMutation,
  removeVote: removeVoteMutation,
};
```

## Callback Interface

If the mutation needs to update parent component state, add a callback:

```typescript
interface UseGroupMutationsOptions {
  groupId: string;
  callbacks?: {
    onEditGroupSuccess?: () => void;
    onSaveItinerarySuccess?: () => void;
    onMyNewMutationSuccess?: () => void;  // Add here
  };
}
```

## API Request Methods

```typescript
apiRequest("GET", url)
apiRequest("POST", url, body)
apiRequest("PATCH", url, body)
apiRequest("DELETE", url, body)
```

## Toast Patterns

```typescript
// Success
toast({ title: "Action completed", description: "Details here" });

// Error (always use variant: "destructive")
toast({ title: "Error", description: error.message, variant: "destructive" });

// With dynamic content
toast({
  title: value ? "Enabled" : "Disabled",
  description: `${itemName} has been ${value ? 'activated' : 'deactivated'}`,
});
```

## Using in Components

```typescript
// In group-detail.tsx or other components
const mutations = useGroupMutations({
  groupId: groupId || '',
  callbacks: {
    onMyMutationSuccess: () => setDialogOpen(false),
  }
});

// Usage
<Button onClick={() => mutations.myMutation.mutate({ id, data })}>
  {mutations.myMutation.isPending ? "Loading..." : "Submit"}
</Button>
```

## Enhanced Error Handling with getErrorToast

Always use `getErrorToast` for consistent, user-friendly error messages:

```typescript
import { getErrorToast } from "@/components/ErrorDisplay";

const myMutation = useMutation({
  mutationFn: async (data) => {
    return await apiRequest("POST", `/api/endpoint`, data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId] });
    toast({ title: "Success", description: "Action completed" });
  },
  onError: (error: Error) => {
    // Use getErrorToast for enhanced error messages with user actions
    toast(getErrorToast(error));
  },
});
```

## Inline Mutations (Outside useGroupMutations)

For page-specific mutations not in the shared hook:

```typescript
// In a component
const { toast } = useToast();

const customMutation = useMutation({
  mutationFn: async (data: MyDataType) => {
    return await apiRequest("POST", `/api/custom-endpoint`, data);
  },
  onSuccess: (data) => {
    // 1. Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ["/api/relevant-data"] });

    // 2. Show success toast
    toast({ title: "Done!", description: "Your action was successful" });

    // 3. Any UI updates (close dialogs, reset state)
    setDialogOpen(false);
  },
  onError: (error: Error) => {
    // Always use getErrorToast for errors
    toast(getErrorToast(error));
  },
});
```

## Query Invalidation Reference Table

| After mutating... | Invalidate these query keys |
|-------------------|----------------------------|
| Group settings | `["/api/groups", groupId]` |
| Group cadence | `["/api/groups", groupId]`, `["/api/groups", groupId, "auto-scheduled-events"]`, `["/api/groups", groupId, "auto-scheduled-events", "timeline"]` |
| Members | `["/api/groups", groupId, "members"]` |
| Activities/Venues | `["/api/groups", groupId, "activities"]` |
| Voting events | `["/api/groups", groupId, "voting-events"]` |
| User votes | `["/api/groups", groupId, "my-votes"]` |
| Saved itineraries | `["/api/groups", groupId, "saved-itineraries"]` |
| Proposed itineraries | `["/api/groups", groupId, "proposed-itineraries"]` |
| Auto-scheduled events | `["/api/groups", groupId, "auto-scheduled-events"]` |
| Nearby suggestions | `["/api/groups", groupId, "nearby-suggestions"]` |
| User events | `["/api/user/events"]`, `["/api/members/me/events"]` |
| Itinerary details | `["/api/itineraries", itineraryId]` |
| RSVPs | `["/api/itineraries", itineraryId, "rsvps"]` |

## Mutation Checklist

When creating a new mutation:

- [ ] Define `mutationFn` with proper TypeScript types
- [ ] Call `apiRequest` with correct method (GET/POST/PATCH/DELETE)
- [ ] In `onSuccess`: invalidate all affected query keys
- [ ] In `onSuccess`: call callback if parent needs state update
- [ ] In `onSuccess`: show success toast
- [ ] In `onError`: use `toast(getErrorToast(error))` for consistent error handling
- [ ] Add to return object in the appropriate category
- [ ] Update callback interface if adding new callback
