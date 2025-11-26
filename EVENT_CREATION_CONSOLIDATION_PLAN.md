# Event Creation Flow Consolidation Plan

**Goal:** Reduce 9 backend flows + multiple duplicate UI components into a streamlined experience without losing functionality.

**Status:** Ready for implementation
**Priority:** Medium (improves UX, reduces maintenance burden)
**Estimated Time:** 8-12 hours

---

## Current State Analysis

### Frontend Components (Duplicated)

| Component | Location | Purpose | Paths Offered |
|-----------|----------|---------|---------------|
| **UnifiedEventCreationModal** | Dashboard | Event creation with group selector | Quick AI, Build Custom, Favorites |
| **ManualEventCreationModal** | Group Detail | Event creation for specific group | Quick AI, Build Custom, Favorites |
| **ScheduleEventModal** | Group Detail | Quick AI scheduling only | Quick AI only |
| **Inline Plan Event Tab** | Group Detail → Events → Plan Event | Manual venue selection + scheduling | Build Custom |
| **AutoScheduleQueue** | Group Detail → Events → Auto-Schedule | Queue approval | Queue approval |

**Problem:** ManualEventCreationModal and UnifiedEventCreationModal are 95% identical (only difference: group selector). ScheduleEventModal duplicates Quick AI path.

### User Entry Points (Current)

**From Group Detail Home Tab:**
1. "Schedule Event" button → ScheduleEventModal (Quick AI)
2. Empty state "Create Event" → ManualEventCreationModal (3 paths)

**From Group Detail Events Tab:**
3. Timeline sub-tab → View only
4. Plan Event sub-tab → Inline venue selection
5. Auto-Schedule sub-tab → Queue approval

**From Dashboard:**
6. Create button → UnifiedEventCreationModal (group selector + 3 paths)

### Backend Flows (From TODO.md)

**User-Initiated (3):**
1. Quick AI Plan → `/api/groups/:id/schedule-from-prompt` (routes.ts:7242)
2. Build Custom → `/api/groups/:groupId/itineraries/validate` (routes.ts:8307)
3. Queue Approval → `/api/groups/:groupId/auto-schedule-queue/approve` (routes.ts:10349)

**System-Initiated (3):**
4. Auto-Schedule Draft → `/api/groups/:id/auto-schedule-next` (routes.ts:2591)
5. Manual Create Empty → `/api/itineraries` (routes.ts:9030)
6. Decide Now Population → `/api/itineraries/:id/decide-now` (routes.ts:9100)

**Management (3):**
7. Save Itinerary → `/api/itineraries/:id/save` (routes.ts:9421)
8. Duplicate Itinerary → `/api/itineraries/:id/duplicate` (routes.ts:9472)
9. Send Backup → `/api/itineraries/:id/send-backup` (routes.ts:10046)

---

## Consolidation Strategy

### Phase 1: Frontend Unification (High Priority)

**Goal:** Single event creation component used everywhere

#### Step 1.1: Consolidate Modal Components

**Action:** Merge ManualEventCreationModal + ScheduleEventModal into enhanced UnifiedEventCreationModal

**New Props:**
```typescript
interface UnifiedEventCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;              // Optional - shows group selector if not provided
  defaultPath?: CreationPath;    // Optional - pre-select a path (e.g., "quick")
  onOpenScheduleModal?: (groupId: string) => void;
  onNavigateToManualTab?: (groupId: string) => void;
  onOpenDiscoverVenues?: (groupId: string) => void;
}
```

**Changes:**
- Add `defaultPath` prop to pre-select Quick AI, Build Custom, or Favorites
- If `groupId` provided, skip group selector (use for Group Detail page)
- If `groupId` not provided, show group selector (use for Dashboard)
- Merge ScheduleEventModal's Quick AI implementation into UnifiedEventCreationModal

**Files to Update:**
- `client/src/components/UnifiedEventCreationModal.tsx` (enhance)
- Delete: `client/src/components/ManualEventCreationModal.tsx`
- Delete: `client/src/components/ScheduleEventModal.tsx`

#### Step 1.2: Update Group Detail Page

**Current:**
```tsx
// Home tab
<Button onClick={() => setScheduleEventModalOpen(true)}>Schedule Event</Button>
<Button onClick={() => setManualEventCreationModalOpen(true)}>Create Event</Button>

// Events tab structure
Timeline | Plan Event | Auto-Schedule
```

**Proposed:**
```tsx
// Home tab - Single unified button
<Button onClick={() => setEventCreationModalOpen(true)}>
  Create Event
</Button>

// Events tab structure (simplified)
Timeline | Create Event | Auto-Schedule
           ↓
    UnifiedEventCreationModal
```

**Changes:**
- Replace "Schedule Event" + empty state "Create Event" → Single "Create Event" button
- Replace Plan Event tab → Simple "Create Event" button that opens UnifiedEventCreationModal
- Keep Timeline tab (view only)
- Keep Auto-Schedule tab (queue approval)
- Remove all inline venue selection UI from Plan Event tab

**Files to Update:**
- `client/src/pages/group-detail.tsx:2914` (replace ScheduleEventModal)
- `client/src/pages/group-detail.tsx:2945` (replace ManualEventCreationModal)
- `client/src/pages/group-detail.tsx:3029` (simplify Plan Event tab)

#### Step 1.3: Simplify Events Tab Structure

**Current Nested Tabs:**
```
Events (main tab)
  ├─ Timeline (sub-tab)
  ├─ Plan Event (sub-tab with complex inline UI)
  └─ Auto-Schedule (sub-tab)
```

**Proposed:**
```
Events (main tab)
  ├─ Timeline (view all events)
  ├─ Create Event (button → UnifiedEventCreationModal)
  └─ Auto-Schedule (queue approval)
```

**Rationale:**
- Plan Event tab has 400+ lines of inline venue selection/scheduling UI
- This duplicates UnifiedEventCreationModal's Build Custom path
- Simplify to single button that opens modal

**Alternative (Keep Nested Tabs):**
```
Events (main tab)
  ├─ Timeline (view)
  ├─ Plan Event (opens UnifiedEventCreationModal with defaultPath="custom")
  └─ Auto-Schedule (queue)
```

**Recommendation:** Option 2 (keep tabs) - users may expect Plan Event tab

---

### Phase 2: Backend Consolidation (Medium Priority)

**Goal:** Reduce overlapping backend logic

#### Step 2.1: Consolidate Empty Itinerary Creation

**Current Problem:**
- Flow #5: Create empty itinerary → `/api/itineraries` (routes.ts:9030)
- Flow #6: Populate with "Decide Now" → `/api/itineraries/:id/decide-now` (routes.ts:9100)

**Why this exists:** Unclear - seems like a two-step process that could be one

**Proposed:**
- Remove "Create Empty" endpoint
- Make "Decide Now" create AND populate in one step
- OR: Clarify the use case (is empty itinerary used elsewhere?)

**Action Required:** Audit usage - is empty itinerary creation needed?

```bash
# Check if anything creates empty itineraries
grep -r "POST.*\/itineraries\"" client/src/
```

**Files to Review:**
- `server/routes.ts:9030` (create empty)
- `server/routes.ts:9100` (decide now)
- Check if UI uses this flow

#### Step 2.2: Extract Shared Itinerary Copy Logic

**Current Problem:**
- Flow #7 (Save Itinerary) and Flow #8 (Duplicate Itinerary) both copy itinerary items
- Similar code, slightly different purposes

**Proposed:**
- Create shared helper: `server/itinerary-utils.ts`
- Function: `copyItinerary(sourceId, options: { status, generateName, deleteOriginal })`

**Example:**
```typescript
// Save itinerary
await copyItinerary(itineraryId, {
  status: 'saved',
  generateName: true,
  deleteOriginal: true
});

// Duplicate itinerary
await copyItinerary(itineraryId, {
  status: 'draft',
  generateName: false,
  deleteOriginal: false
});
```

**Files to Update:**
- Create: `server/itinerary-utils.ts`
- Update: `server/routes.ts:9421` (save)
- Update: `server/routes.ts:9472` (duplicate)

#### Step 2.3: Unified Event Creation Service (Optional - Low Priority)

**Current State:**
- Flow #1, #2, #3 all create events with different inputs
- Deduplication logic already consolidated (✅ done 2025-11-24)

**Proposed (Future Enhancement):**
- Create: `server/event-creation-service.ts`
- Unified function that handles all 3 paths with options

**Rationale:** Low priority - current separation is reasonable (different input types)

---

### Phase 3: Remove Redundant Code (High Priority)

#### Step 3.1: Delete Unused Components

**After consolidation, delete:**
- ✅ `client/src/components/ManualEventCreationModal.tsx` (merged into Unified)
- ✅ `client/src/components/ScheduleEventModal.tsx` (merged into Unified)

#### Step 3.2: Simplify Group Detail Page

**Current:** `client/src/pages/group-detail.tsx` is **10,480 lines**

**Opportunities:**
- Remove inline venue selection UI from Plan Event tab (→ use modal)
- Remove duplicate scheduling UI
- Extract event display components

**Estimated Reduction:** 300-500 lines

---

## Proposed Final Architecture

### Frontend Structure

**User Entry Points (Consolidated):**

1. **Dashboard** → "Create Event" → UnifiedEventCreationModal (with group selector)
2. **Group Detail Home** → "Create Event" → UnifiedEventCreationModal (groupId provided)
3. **Group Detail Events → Create Event tab** → UnifiedEventCreationModal (groupId + defaultPath)
4. **Group Detail Events → Auto-Schedule** → AutoScheduleQueue (unique flow, keep as-is)

**Single Component:** UnifiedEventCreationModal with flexible props

### Backend Structure (Reduced to 6 Core Flows)

**User-Facing (3):**
1. Quick AI Plan → `POST /api/groups/:id/schedule-from-prompt`
2. Build Custom → `POST /api/groups/:groupId/itineraries/validate`
3. Queue Approval → `POST /api/groups/:groupId/auto-schedule-queue/approve`

**System/Management (3):**
4. Auto-Schedule Draft → `POST /api/groups/:id/auto-schedule-next`
5. Save/Duplicate Itinerary → Shared `copyItinerary()` helper
6. Send Backup → `POST /api/itineraries/:id/send-backup`

**Removed/Consolidated:**
- ❌ Create Empty Itinerary (merged or removed)
- ❌ Decide Now Population (merged or removed)

---

## Implementation Steps

### Step 1: Enhance UnifiedEventCreationModal (3-4 hours)

1. Add `defaultPath` prop to pre-select creation mode
2. Add `groupId` prop to skip group selector when provided
3. Test all 3 paths (Quick AI, Build Custom, Favorites)
4. Ensure mobile responsiveness (ResponsiveDialog)

**Files:**
- ✏️ `client/src/components/UnifiedEventCreationModal.tsx`

### Step 2: Update Group Detail Page (2-3 hours)

1. Replace ScheduleEventModal with UnifiedEventCreationModal
2. Replace ManualEventCreationModal with UnifiedEventCreationModal
3. Simplify Plan Event tab (remove inline UI, add button)
4. Update state management (remove old modal states)

**Files:**
- ✏️ `client/src/pages/group-detail.tsx`

### Step 3: Delete Old Components (30 mins)

1. Delete ManualEventCreationModal.tsx
2. Delete ScheduleEventModal.tsx
3. Remove imports from group-detail.tsx

**Files:**
- ❌ `client/src/components/ManualEventCreationModal.tsx`
- ❌ `client/src/components/ScheduleEventModal.tsx`

### Step 4: Backend Consolidation (2-3 hours)

1. Audit empty itinerary creation usage
2. Extract shared copy logic to `itinerary-utils.ts`
3. Update Save/Duplicate endpoints to use shared helper
4. Test all backend flows

**Files:**
- ➕ `server/itinerary-utils.ts` (new)
- ✏️ `server/routes.ts`

### Step 5: Testing (2 hours)

**Test Cases:**
- [ ] Dashboard → Create Event → Select group → Quick AI
- [ ] Dashboard → Create Event → Select group → Build Custom
- [ ] Dashboard → Create Event → Select group → Favorites
- [ ] Group Detail Home → Create Event → Quick AI
- [ ] Group Detail Home → Create Event → Build Custom
- [ ] Group Detail Events → Create Event → Build Custom
- [ ] Group Detail Events → Auto-Schedule → Approve queue
- [ ] Save itinerary flow
- [ ] Duplicate itinerary flow
- [ ] Mobile responsiveness on all flows

---

## Benefits

### User Experience
✅ **Single, consistent creation flow** - no more confusion about which button to use
✅ **Reduced cognitive load** - one modal, three clear paths
✅ **Faster event creation** - fewer clicks, clearer options
✅ **Better mobile experience** - ResponsiveDialog for all paths

### Developer Experience
✅ **Reduced code duplication** - 2 fewer modal components
✅ **Easier maintenance** - update one component instead of three
✅ **Smaller bundle size** - 300-500 fewer lines
✅ **Clearer architecture** - obvious entry points

### Technical Wins
✅ **Reduced frontend complexity** - 6 entry points → 4 entry points
✅ **Reduced backend complexity** - 9 flows → 6 meaningful flows
✅ **Better testability** - test one component instead of three
✅ **Performance** - less duplicate code loaded

---

## Risks & Mitigation

### Risk 1: Breaking Existing User Workflows

**Mitigation:**
- Keep same 3 creation paths (Quick AI, Build Custom, Favorites)
- Maintain all functionality, just consolidate UI
- Add feature flags if needed for gradual rollout

### Risk 2: URL-based Deep Links Breaking

**Current:** `?action=schedule` opens ScheduleEventModal

**Mitigation:**
```tsx
// In group-detail.tsx
const action = params.get('action');
if (action === 'schedule') {
  setEventCreationModalOpen(true);
  setDefaultPath('quick'); // Pre-select Quick AI
}
```

### Risk 3: Backend Flows Have Hidden Dependencies

**Mitigation:**
- Audit each backend flow before consolidating
- Add integration tests for all event creation paths
- Keep git history for rollback

---

## Success Metrics

After implementation:

✅ **Code Reduction:** 300-500 lines removed from group-detail.tsx
✅ **Component Reduction:** 2 fewer modal components
✅ **Entry Point Reduction:** 6 UI entry points → 4
✅ **Backend Flow Reduction:** 9 flows → 6 meaningful flows
✅ **User Testing:** 90%+ users can create events without confusion
✅ **No Functionality Lost:** All 3 creation paths + queue approval intact

---

## Questions to Resolve Before Implementation

1. **Empty Itinerary Creation (#5, #6):**
   - Is there a valid use case for creating empty itineraries?
   - Can we merge these into a single flow?

2. **Plan Event Tab:**
   - Keep as tab that opens modal? OR
   - Remove tab entirely and add button to Timeline tab?

3. **Feature Flags:**
   - Gradual rollout? OR
   - Single deployment?

4. **Mobile Testing:**
   - Test on actual devices? OR
   - Browser dev tools sufficient?

---

**Ready to proceed?** Let me know if you want to:
1. Start with Phase 1 (frontend unification) immediately
2. Answer questions first
3. Modify the plan

**Estimated Total Time:** 8-12 hours (frontend + backend + testing)
