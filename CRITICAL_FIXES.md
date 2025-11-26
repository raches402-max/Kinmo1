# Critical Auto-Scheduling Fixes Required

## Executive Summary

The auto-scheduling system has **7 critical bugs** and **5 race conditions** that are causing duplicate events, incorrect frequency scheduling, and data integrity issues. The AI Event Planning Agent (`server/ai-event-agent.ts`) handles venue selection but does NOT validate auto-scheduling operations.

---

## P0 - Critical Fixes (Implement Immediately)

### Fix 1: Add Database Unique Constraint

**Problem**: No database-level prevention of duplicate events on same date.

**Solution**:
```sql
-- Migration: Add unique constraint
ALTER TABLE auto_scheduled_events
ADD CONSTRAINT unique_group_date
UNIQUE (group_id, DATE(proposed_date AT TIME ZONE 'UTC'));
```

**Impact**: Prevents duplicates at database level, even if application logic fails.

---

### Fix 2: Implement Per-Group Mutex Locks

**Problem**: Multiple scheduler runs can process the same group simultaneously.

**Current Code** (`server/reminder-scheduler.ts:1187-1213`):
```typescript
// ❌ No lock - can run multiple times
processAutoScheduling().catch(err => { ... });
setInterval(() => {
  processAutoScheduling().catch(err => { ... });
}, AUTO_SCHEDULE_INTERVAL_MS);
```

**Solution** (using PostgreSQL advisory locks):
```typescript
async function maintainEventPipeline(groupId: string, storage: any) {
  // Try to acquire lock for this group
  const lockResult = await db.execute(
    sql`SELECT pg_try_advisory_lock(hashtext(${groupId}))`
  );

  if (!lockResult.rows[0].pg_try_advisory_lock) {
    console.log(`[Event Pipeline] Group ${groupId} is already being processed, skipping`);
    return 0;
  }

  try {
    // ... existing pipeline logic ...
  } finally {
    // Always release lock
    await db.execute(
      sql`SELECT pg_advisory_unlock(hashtext(${groupId}))`
    );
  }
}
```

**Impact**: Ensures only one process can modify a group's events at a time.

---

### Fix 3: Use Timezone-Aware Date Comparisons

**Problem**: String-based date comparisons are timezone-dependent.

**Current Code** (`server/auto-scheduler.ts:1049-1055`):
```typescript
// ❌ Timezone-dependent
const eventDateStr = eventDate.toISOString().split('T')[0]; // "2025-11-30"
sql`DATE(${autoScheduledEvents.proposedDate}) = ${eventDateStr}`
```

**Solution**:
```typescript
// ✅ Timezone-aware
const startOfDay = new Date(eventDate);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(eventDate);
endOfDay.setHours(23, 59, 59, 999);

const existingEventsOnDate = await db
  .select()
  .from(autoScheduledEvents)
  .where(and(
    eq(autoScheduledEvents.groupId, groupId),
    gte(autoScheduledEvents.proposedDate, startOfDay),
    lte(autoScheduledEvents.proposedDate, endOfDay)
  ));
```

**Impact**: Prevents date mismatches across timezones.

---

### Fix 4: Wrap Event Creation in Transactions

**Problem**: Partial failures leave orphaned records.

**Current Code** (`server/auto-scheduler.ts:1044-1090`):
```typescript
// ❌ No transaction
try {
  const autoEvent = await storage.createAutoScheduledEvent({ ... });
  await Promise.all(selection.options.map(async (option) => {
    await db.insert(itineraryOptions).values({ ... });
  }));
  createdCount++;
} catch (error) {
  console.error(`Failed to create event...`);
  continue; // ❌ Orphaned autoEvent remains in DB
}
```

**Solution**:
```typescript
// ✅ Atomic transaction
await db.transaction(async (tx) => {
  // Create event
  const [autoEvent] = await tx
    .insert(autoScheduledEvents)
    .values({ ... })
    .returning();

  // Create options (within same transaction)
  await tx.insert(itineraryOptions).values(
    selection.options.map(option => ({
      autoEventId: autoEvent.id,
      // ... other fields
    }))
  );

  createdCount++;
});
```

**Impact**: Ensures all-or-nothing event creation - no orphaned records.

---

## P1 - High Priority (Fix Within 1 Week)

### Fix 5: Check Both autoScheduledEvents AND itineraries Tables

**Problem**: Manual itineraries and auto-events can have same date.

**Solution**:
```typescript
// Check BOTH tables for existing events on this date
const [existingAutoEvents, existingItineraries] = await Promise.all([
  db.select().from(autoScheduledEvents).where(and(
    eq(autoScheduledEvents.groupId, groupId),
    gte(autoScheduledEvents.proposedDate, startOfDay),
    lte(autoScheduledEvents.proposedDate, endOfDay)
  )),
  db.select().from(itineraries).where(and(
    eq(itineraries.groupId, groupId),
    gte(itineraries.eventDate, startOfDay),
    lte(itineraries.eventDate, endOfDay)
  ))
]);

if (existingAutoEvents.length > 0 || existingItineraries.length > 0) {
  console.log(`Event already exists on ${eventDateStr}, skipping`);
  continue;
}
```

---

### Fix 6: Redefine `countFutureEvents()` Status Logic

**Problem**: Includes `pending_approval` events in count, making pipeline think it's full when events are just waiting for approval.

**Current Code** (`server/storage.ts:1725-1745`):
```typescript
inArray(autoScheduledEvents.status, [
  'pending_approval', // ❌ Should this count?
  'auto_approved',
  'approved',
  'auto_sent',
  'scheduled'
])
```

**Solution**: Only count finalized events:
```typescript
inArray(autoScheduledEvents.status, [
  'auto_approved',  // ✅ Actually approved
  'auto_sent',      // ✅ Invites sent
  'scheduled'       // ✅ Finalized
])
// Don't count 'pending_approval' - those are drafts
```

---

### Fix 7: Add Validation for autoSendAt vs proposedDate

**Problem**: `autoSendAt` could be AFTER `proposedDate` (invites sent after event happens).

**Solution**:
```typescript
// In event creation logic
if (autoSendAt >= proposedDate) {
  throw new Error(`autoSendAt (${autoSendAt}) must be before proposedDate (${proposedDate})`);
}
```

---

## P2 - Medium Priority (Fix Within 2 Weeks)

### Fix 8: Add Retry Logic for Failed AI Calls

**Problem**: If `selectBestItineraryForAutoSchedule()` fails, event creation is skipped with no retry.

**Solution**: Implement exponential backoff:
```typescript
async function selectBestItineraryWithRetry(storage: any, group: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await selectBestItineraryForAutoSchedule(storage, group);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`[Event Pipeline] Retry ${attempt}/${maxRetries} after ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

---

### Fix 9: Add Idempotency Tracking

**Problem**: No way to know if group was recently processed.

**Solution**: Add `lastPipelineRunAt` timestamp to groups table:
```typescript
// Before processing group
const group = await db.select().from(groups).where(eq(groups.id, groupId));
const now = new Date();
const minSecondsBetweenRuns = 3600; // 1 hour

if (group.lastPipelineRunAt) {
  const secondsSinceLastRun = (now.getTime() - group.lastPipelineRunAt.getTime()) / 1000;
  if (secondsSinceLastRun < minSecondsBetweenRuns) {
    console.log(`[Event Pipeline] Group processed ${secondsSinceLastRun}s ago, skipping`);
    return 0;
  }
}

// Update timestamp
await db.update(groups)
  .set({ lastPipelineRunAt: now })
  .where(eq(groups.id, groupId));
```

---

### Fix 10: Add Orphaned Record Cleanup Job

**Problem**: Past failures may have left orphaned records.

**Solution**: Create daily cleanup job:
```typescript
// server/cleanup-orphaned-events.ts
async function cleanupOrphanedEvents() {
  // Find auto_scheduled_events with no itinerary_options
  const orphanedEvents = await db
    .select()
    .from(autoScheduledEvents)
    .where(sql`
      NOT EXISTS (
        SELECT 1 FROM itinerary_options
        WHERE itinerary_options.auto_event_id = auto_scheduled_events.id
      )
    `);

  if (orphanedEvents.length > 0) {
    console.log(`Found ${orphanedEvents.length} orphaned events, deleting...`);
    await db.delete(autoScheduledEvents)
      .where(inArray(autoScheduledEvents.id, orphanedEvents.map(e => e.id)));
  }
}
```

---

## Implementation Plan

### Phase 1 (Today)
1. Add database unique constraint
2. Implement per-group mutex locks
3. Fix timezone-aware date comparisons
4. Wrap event creation in transactions

### Phase 2 (This Week)
5. Check both autoScheduledEvents and itineraries
6. Redefine countFutureEvents() status logic
7. Add autoSendAt validation

### Phase 3 (Next Week)
8. Add retry logic for AI calls
9. Implement idempotency tracking
10. Create orphaned record cleanup job

---

## Testing Checklist

After implementing fixes:

- [ ] Test concurrent `maintainEventPipeline()` calls (simulate race condition)
- [ ] Test across timezone boundaries (PST group with UTC database)
- [ ] Test failure scenarios (OpenAI API down, database unavailable)
- [ ] Test manual itinerary + auto-event on same date
- [ ] Test frequency calculations (2x month = 15 days, 1x week = 7 days)
- [ ] Test cleanup job finds and removes orphaned records
- [ ] Test idempotency (running pipeline twice in 1 hour should skip second run)

---

## Monitoring Recommendations

Add logging for:
1. Lock acquisition failures (group already being processed)
2. Duplicate prevention triggers (event already exists on date)
3. Transaction rollbacks (partial failure recovery)
4. Orphaned record detection (cleanup job findings)
5. Timezone conversion issues (date mismatch warnings)

---

## About the AI Agent

The **AI Event Planning Agent** (`server/ai-event-agent.ts`) you mentioned is designed for **venue selection**, not auto-scheduling validation. It:

✅ Selects diverse venues (no duplicate categories)
✅ Validates geographic proximity
✅ Checks time appropriateness
✅ Creates logical event flow

❌ Does NOT prevent duplicate events
❌ Does NOT validate frequency calculations
❌ Does NOT check for race conditions
❌ Does NOT validate database integrity

The agent operates **after** auto-scheduling creates an event, helping choose which venues to include in the itinerary.

---

## Root Cause Analysis

The duplicate events and scheduling issues stem from:

1. **Architectural Gap**: No database-level uniqueness constraints
2. **Race Conditions**: Multiple processes can modify same group simultaneously
3. **Lack of Transactions**: Partial failures leave inconsistent state
4. **Timezone Handling**: String-based date comparisons fail across timezones
5. **Missing Validation**: No check for manual itineraries vs auto-events on same date

The AI Event Planning Agent cannot prevent these issues because they occur at the **infrastructure and database layer**, not at the **business logic layer** where the agent operates.

---

## Next Steps

Would you like me to:
1. Implement the P0 critical fixes (unique constraint, mutex locks, transactions)?
2. Create a migration script to safely add the database constraint?
3. Test the fixes against your current production data?
