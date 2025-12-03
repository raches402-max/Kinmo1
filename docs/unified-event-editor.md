# Unified Event Editor Plan

## Vision

One unified experience for creating AND editing events. The core of an event is:

- **Where** (venues)
- **When** (date/time)
- **Who** (attendees)

Whether you're creating new or editing existing, you're working with the same thing.

## Current State

| Flow | Location | Experience |
|------|----------|------------|
| Create | `/group/:id?tab=build` | Multi-step, venue-first, clunky on mobile |
| Edit | `/event/:id` | Polished single-page editor, mobile-friendly |

## Target State

| Flow | Location | Experience |
|------|----------|------------|
| Create | `/event/new?groupId=xxx` | Same as edit, but starts blank |
| Edit | `/event/:id` | Same polished single-page editor |

## Implementation Approach

### Route Structure

```
/event/new?groupId=xxx  →  Create mode (blank event)
/event/:id              →  Edit mode (existing event)
```

### How It Works

**Create Mode (`/event/new?groupId=xxx`):**
1. Detect "new" route
2. Immediately create a draft itinerary via `POST /api/itineraries`
3. Redirect to `/event/:newId` (now in edit mode)
4. User sees empty event they can fill in

**Edit Mode (`/event/:id`):**
1. Load existing event (current behavior)
2. All fields pre-populated
3. Changes save automatically

### Key Changes to event-details.tsx

1. **Route detection:**
```typescript
const isCreateMode = location.pathname === '/event/new';
const groupIdFromQuery = new URLSearchParams(location.search).get('groupId');
```

2. **Auto-create on mount (create mode only):**
```typescript
useEffect(() => {
  if (isCreateMode && groupIdFromQuery) {
    createItineraryMutation.mutate(groupIdFromQuery);
  }
}, [isCreateMode, groupIdFromQuery]);
```

3. **Conditional UI:**
- Hide RSVP section for drafts
- Hide "Copy invite link" until sent
- Show prominent "Add Venues" when empty
- Show "Send Invites" as primary CTA for drafts

### What to Hide/Show by State

| Element | Draft (new) | Draft (has venues) | Sent |
|---------|-------------|-------------------|------|
| Add Venues (prominent) | ✅ | ✅ | ✅ |
| Date/Time picker | ✅ | ✅ | ✅ |
| Venue list | Empty state | ✅ | ✅ |
| Send Invites CTA | Hidden | ✅ Primary | Hidden |
| RSVP section | Hidden | Hidden | ✅ |
| Copy invite link | Hidden | Hidden | ✅ |
| Attendee list | Show members | Show members | Show RSVPs |

### UnifiedEventCreationModal Changes

Update "Manual" path to navigate to `/event/new?groupId=xxx` instead of `/group/:id?tab=build`.

```typescript
case "manual":
  onOpenChange(false);
  setLocation(`/event/new?groupId=${selectedGroupId}`);
  break;
```

## Files to Modify

1. **`client/src/App.tsx`** - Add `/event/new` route
2. **`client/src/pages/event-details.tsx`** - Add create mode support
3. **`client/src/components/UnifiedEventCreationModal.tsx`** - Update manual path

## Benefits

- **Consistent UX** - Same interface for create and edit
- **Mobile-friendly** - event-details already has good mobile support
- **Less code** - Remove Build tab complexity eventually
- **Clear mental model** - "Event editor" is one thing

## Future Cleanup (Phase 2)

Once unified editor is working:
- Remove Build tab from group-detail
- Simplify group-detail page
- Update any other entry points to use new flow
