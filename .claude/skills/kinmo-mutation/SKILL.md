---
name: kinmo-mutation
description: Generate React Query mutations for Kinmo with toast notifications, error handling, query invalidation, and optimistic updates. Activates when user says "create mutation", "add mutation for", "frontend for endpoint", "call the API", "hook to", "mutation that", or describes needing to call a backend endpoint from React. This skill generates production-ready code that integrates with useGroupMutations or creates inline mutations.
---

# Kinmo Mutation Generator

**Version:** 2.0.0
**Type:** Code Generation Skill
**Created by:** Agent-Skill-Creator methodology

---

## Overview

This skill **generates complete, production-ready React Query mutations** for Kinmo. It creates the frontend code to call API endpoints with proper error handling, toast notifications, query invalidation, and optional optimistic updates.

### What This Skill Does

When activated, this skill will:
1. **Generate the mutation definition** with proper TypeScript types
2. **Select correct query keys to invalidate** based on what data changed
3. **Add toast notifications** for success and error states
4. **Include optimistic updates** when appropriate (toggles, quick actions)
5. **Wire up callbacks** for parent component state updates

### Key Features

- Autonomous code generation (not just patterns)
- Matches existing useGroupMutations patterns exactly
- Knows which query keys to invalidate for each resource
- Uses `getErrorToast()` for consistent error handling
- Supports both hook mutations and inline mutations

---

## Skill Activation

This skill uses a **3-Layer Activation System** for reliable detection.

### Phrases That Activate This Skill

#### Primary Activation Phrases
1. **"create mutation for..."**
   - Example: "create mutation for updating member preferences"

2. **"add mutation to call..."**
   - Example: "add mutation to call the mark-visited endpoint"

3. **"frontend for the [endpoint] endpoint"**
   - Example: "frontend for the member preferences endpoint"

#### Hook-Specific Activation
4. **"add to useGroupMutations..."**
   - Example: "add to useGroupMutations a mutation for archiving activities"

5. **"mutation in the hook for..."**
   - Example: "mutation in the hook for sending reminders"

#### Natural Language Activation
6. **"I need to call the API for..."**
   - Example: "I need to call the API for submitting feedback"

7. **"hook to [action]..."**
   - Example: "hook to delete a saved itinerary"

8. **"mutation that [action]..."**
   - Example: "mutation that marks an event as complete"

9. **"wire up the frontend for..."**
   - Example: "wire up the frontend for the new preferences endpoint"

10. **"call [endpoint] from React"**
    - Example: "call the visit-history endpoint from React"

### Phrases That Do NOT Activate

1. **Backend requests**
   - Example: "add an endpoint for preferences"
   - Reason: Use kinmo-api-endpoint skill instead

2. **Query (read) requests**
   - Example: "fetch the member list"
   - Reason: Queries use useQuery, not mutations

3. **Form building**
   - Example: "create a form for editing preferences"
   - Reason: Use kinmo-form-builder skill instead

---

## Autonomous Generation Protocol

When this skill activates, Claude will **autonomously**:

### Phase 1: Requirement Analysis
Extract from user request:
- **Endpoint**: What API is being called (method + path)
- **Parameters**: What data does the mutation need
- **Response**: What comes back from the API
- **Side effects**: What queries need to be invalidated

### Phase 2: Location Decision
Decide where to put the mutation:

| Scenario | Location | Reason |
|----------|----------|--------|
| Group-related operation | `useGroupMutations.ts` | Shared across group pages |
| Page-specific operation | Inline in component | Only used in one place |
| User-level operation | New hook or inline | Not group-scoped |

### Phase 3: Code Generation
Generate complete code including:
1. **TypeScript types** for parameters and response
2. **mutationFn** with apiRequest call
3. **onSuccess** with query invalidation + toast
4. **onError** with getErrorToast
5. **Callback integration** if needed

---

## Code Generation Templates

### Template 1: Standard Mutation (useGroupMutations)

```typescript
const {{mutationName}}Mutation = useMutation({
  mutationFn: async ({{params}}: {{ParamsType}}) => {
    return await apiRequest("{{METHOD}}", `{{endpoint}}`, {{body}});
  },
  onSuccess: ({{responseVar}}) => {
    {{#each queryKeysToInvalidate}}
    queryClient.invalidateQueries({ queryKey: {{this}} });
    {{/each}}
    {{#if hasCallback}}
    callbacks.{{callbackName}}?.({{callbackArgs}});
    {{/if}}
    toast({ title: "{{successTitle}}", description: "{{successDescription}}" });
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

### Template 2: Mutation with Optimistic Updates

```typescript
const {{mutationName}}Mutation = useMutation({
  mutationFn: async ({{params}}: {{ParamsType}}) => {
    return await apiRequest("{{METHOD}}", `{{endpoint}}`, {{body}});
  },
  onMutate: async ({{params}}) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: {{primaryQueryKey}} });

    // Snapshot previous value
    const previousData = queryClient.getQueryData({{primaryQueryKey}});

    // Optimistically update
    queryClient.setQueryData({{primaryQueryKey}}, (old: any) => ({
      ...old,
      {{optimisticUpdate}}
    }));

    return { previousData };
  },
  onSuccess: (_, variables) => {
    toast({
      title: "{{successTitle}}",
      description: `{{successDescriptionTemplate}}`,
    });
  },
  onError: (error: Error, _, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData({{primaryQueryKey}}, context.previousData);
    }
    toast(getErrorToast(error));
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: {{primaryQueryKey}} });
  },
});
```

### Template 3: Inline Mutation (Component)

```typescript
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";

// Inside component:
const { toast } = useToast();

const {{mutationName}} = useMutation({
  mutationFn: async ({{params}}: {{ParamsType}}) => {
    return await apiRequest("{{METHOD}}", `{{endpoint}}`, {{body}});
  },
  onSuccess: ({{responseVar}}) => {
    {{#each queryKeysToInvalidate}}
    queryClient.invalidateQueries({ queryKey: {{this}} });
    {{/each}}
    toast({ title: "{{successTitle}}", description: "{{successDescription}}" });
    {{#if closeDialog}}
    setDialogOpen(false);
    {{/if}}
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

---

## Real-World Examples

### Example 1: Add Mutation to useGroupMutations

**User Query:**
```
"add mutation for marking an activity as visited"
```

**Generated Code (add to useGroupMutations.ts):**

```typescript
// Add to interface if callback needed:
// onMarkVisitedSuccess?: () => void;

const markActivityVisitedMutation = useMutation({
  mutationFn: async ({ activityId, rating, notes }: {
    activityId: string;
    rating?: number;
    notes?: string;
  }) => {
    return await apiRequest("POST", `/api/groups/${groupId}/activities/${activityId}/visited`, {
      rating,
      notes
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "visit-history"] });
    toast({ title: "Visit recorded", description: "Your visit has been saved" });
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});

// Add to return object:
// markActivityVisited: markActivityVisitedMutation,
```

---

### Example 2: Mutation with Optimistic Update (Toggle)

**User Query:**
```
"mutation for toggling a member's notification preference"
```

**Generated Code:**

```typescript
const toggleMemberNotificationsMutation = useMutation({
  mutationFn: async ({ memberId, enabled }: { memberId: string; enabled: boolean }) => {
    return await apiRequest("PATCH", `/api/members/${memberId}/notifications`, { enabled });
  },
  onMutate: async ({ memberId, enabled }) => {
    await queryClient.cancelQueries({ queryKey: ["/api/groups", groupId, "members"] });

    const previousMembers = queryClient.getQueryData(["/api/groups", groupId, "members"]);

    queryClient.setQueryData(["/api/groups", groupId, "members"], (old: any[]) =>
      old?.map(m => m.id === memberId ? { ...m, notificationsEnabled: enabled } : m)
    );

    return { previousMembers };
  },
  onSuccess: (_, variables) => {
    toast({
      title: variables.enabled ? "Notifications enabled" : "Notifications disabled",
      description: `Member will ${variables.enabled ? 'now' : 'no longer'} receive notifications`,
    });
  },
  onError: (error: Error, _, context) => {
    if (context?.previousMembers) {
      queryClient.setQueryData(["/api/groups", groupId, "members"], context.previousMembers);
    }
    toast(getErrorToast(error));
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
  },
});
```

---

### Example 3: Inline Mutation in Component

**User Query:**
```
"create inline mutation for dismissing a notification"
```

**Generated Code (for use in NotificationBell.tsx):**

```typescript
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";

function NotificationBell() {
  const { toast } = useToast();

  const dismissNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest("DELETE", `/api/notifications/${notificationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      // No toast needed for dismiss - it's a subtle action
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Usage:
  // <Button onClick={() => dismissNotification.mutate(notification.id)}>
  //   {dismissNotification.isPending ? <Loader2 className="animate-spin" /> : <X />}
  // </Button>
}
```

---

### Example 4: Mutation for Existing Endpoint

**User Query:**
```
"frontend for the member preferences endpoint we just created"
```

**(Referencing the endpoint from kinmo-api-endpoint skill)**

**Generated Code:**

```typescript
const updateMemberPreferencesMutation = useMutation({
  mutationFn: async ({ memberId, preferences }: {
    memberId: string;
    preferences: {
      activityTypes?: string[];
      budgetPreference?: string;
      distanceWillingToTravel?: number;
      dietaryRestrictions?: string[];
    };
  }) => {
    return await apiRequest("PATCH", `/api/groups/${groupId}/members/${memberId}/preferences`, preferences);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
    callbacks.onEditMemberSuccess?.();
    toast({ title: "Preferences updated", description: "Member preferences have been saved" });
  },
  onError: (error: Error) => {
    toast(getErrorToast(error));
  },
});
```

---

## Query Key Reference

When generating mutations, use these query keys for invalidation:

| Resource Changed | Query Keys to Invalidate |
|------------------|-------------------------|
| Group settings | `["/api/groups", groupId]` |
| Group cadence | `["/api/groups", groupId]`, `["/api/groups", groupId, "auto-scheduled-events"]`, `["/api/groups", groupId, "auto-scheduled-events", "timeline"]` |
| Members | `["/api/groups", groupId, "members"]` |
| Member preferences | `["/api/groups", groupId, "members"]`, `["/api/groups", groupId, "my-preferences"]` |
| Activities/Venues | `["/api/groups", groupId, "activities"]` |
| Voting events | `["/api/groups", groupId, "voting-events"]` |
| User votes | `["/api/groups", groupId, "voting-events"]`, `["/api/groups", groupId, "my-votes"]` |
| Saved itineraries | `["/api/groups", groupId, "saved-itineraries"]` |
| Proposed itineraries | `["/api/groups", groupId, "proposed-itineraries"]` |
| Auto-scheduled events | `["/api/groups", groupId, "auto-scheduled-events"]`, `["/api/groups", groupId, "auto-scheduled-events", "timeline"]` |
| User events | `["/api/user/events"]`, `["/api/members/me/events"]` |
| Itinerary details | `["/api/itineraries", itineraryId]` |
| RSVPs | `["/api/itineraries", itineraryId, "rsvps"]` |
| Notifications | `["/api/notifications"]`, `["/api/notifications/unread-count"]` |

---

## When to Use Optimistic Updates

Use optimistic updates for:
- **Toggles** (on/off switches)
- **Quick status changes** (upvote/downvote)
- **Local-feeling actions** (dismiss, mark as read)

Do NOT use optimistic updates for:
- **Complex operations** (creating events)
- **Multi-step processes** (sending invitations)
- **Operations that might fail** (payment, external APIs)

---

## Callback Integration

When a mutation needs to trigger parent component state updates:

### 1. Add to UseGroupMutationsOptions interface:

```typescript
interface UseGroupMutationsOptions {
  groupId: string;
  callbacks?: {
    // ... existing callbacks
    onNewActionSuccess?: (data?: any) => void;  // Add new callback
  };
}
```

### 2. Call in onSuccess:

```typescript
onSuccess: (data) => {
  // ... invalidation and toast
  callbacks.onNewActionSuccess?.(data);  // Call the callback
},
```

### 3. Use in component:

```typescript
const mutations = useGroupMutations({
  groupId,
  callbacks: {
    onNewActionSuccess: () => {
      setDialogOpen(false);
      // or other state updates
    },
  },
});
```

---

## Return Object Organization

Mutations in useGroupMutations are organized by category:

```typescript
return {
  // Group management
  updateGroup: updateGroupMutation,
  updateRadius: updateRadiusMutation,

  // Member management
  deleteMember: deleteMemberMutation,
  updateMember: updateMemberMutation,
  toggleHosting: toggleHostingMutation,

  // Preferences
  updateMyPreferences: updateMyPreferencesMutation,

  // Itinerary management
  saveItinerary: saveItineraryMutation,
  deleteItinerary: deleteItineraryMutation,

  // Event creation & management
  createEvent: createEventMutation,
  sendItinerary: sendItineraryMutation,

  // Voting
  vote: voteMutation,
  removeVote: removeVoteMutation,

  // NEW CATEGORY (if needed)
  // newMutation: newMutationMutation,
};
```

---

## Required Imports

For useGroupMutations.ts (already present):
```typescript
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
```

For inline mutations in components:
```typescript
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
```

---

## Mutation Checklist

Before finalizing generated code, verify:

- [ ] `mutationFn` uses correct HTTP method and endpoint
- [ ] TypeScript types defined for parameters
- [ ] `apiRequest` call matches endpoint signature
- [ ] All affected query keys are invalidated in `onSuccess`
- [ ] Toast shows appropriate success message
- [ ] `onError` uses `toast(getErrorToast(error))`
- [ ] Callback called if parent needs notification
- [ ] Added to return object with descriptive name
- [ ] Optimistic update included if toggle/quick action

---

## Troubleshooting

### Skill Not Activating

**Solutions:**
1. Mention "mutation" explicitly
2. Reference the endpoint you're calling
3. Use "frontend for" or "call the API"

**Example Fix:**
```
❌ "update member preferences from the UI"
✅ "create mutation to call the update member preferences endpoint"
```

### Wrong Query Keys

**Solution:** Be explicit about what data changes:
```
❌ "mutation for editing"
✅ "mutation for editing member preferences - should invalidate members list"
```

---

## File Locations

| Purpose | File Path |
|---------|-----------|
| Shared group mutations | `client/src/hooks/useGroupMutations.ts` |
| Toast hook | `client/src/hooks/use-toast.ts` |
| API request utility | `client/src/lib/queryClient.ts` |
| Error display | `client/src/components/ErrorDisplay.tsx` |

---

**Generated by:** Agent-Skill-Creator methodology
**Last Updated:** 2024
**Activation System:** 3-Layer (Keywords + Patterns + Description)
