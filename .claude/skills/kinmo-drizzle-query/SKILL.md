---
name: kinmo-drizzle-query
description: Create Drizzle ORM database queries for Kinmo with proper filtering, soft deletes, joins, transactions, and batch operations. Use when adding database operations to server/storage.ts or writing inline queries.
---

# Kinmo Drizzle Query Patterns

When creating database queries for Kinmo, follow these established patterns from the existing 166+ database operations.

## File Locations

- Storage layer: `server/storage.ts`
- Database connection: `server/db.ts`
- Schema definitions: `shared/schema.ts`

## Imports

```typescript
import { db } from "./db";
import { eq, desc, asc, sql, and, or, inArray, isNull, isNotNull, gte, lt, lte } from "drizzle-orm";
import {
  users, groups, members, activities, votingEvents, votes, itineraries, itineraryItems,
  // ... other tables as needed
  type User, type Group, type Member, type Activity,
  type InsertGroup, type UpdateGroup,
  // ... other types as needed
} from "@shared/schema";
```

## Basic SELECT Patterns

### Single Record by ID

```typescript
// Returns single record or undefined
async getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

// Alternative: explicit undefined return
async getGroup(id: string): Promise<Group | undefined> {
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  return group || undefined;
}
```

### All Records from Table

```typescript
async getAllGroups(): Promise<Group[]> {
  return await db.select().from(groups);
}
```

### Filtered List

```typescript
async getGroupMembers(groupId: string): Promise<Member[]> {
  return await db.select().from(members).where(eq(members.groupId, groupId));
}
```

## Soft Delete Pattern (CRITICAL)

Kinmo uses soft deletes with `deletedAt` column. Always filter for non-deleted records:

```typescript
// Single record with soft delete check
async getGroup(id: string): Promise<Group | undefined> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, id), isNull(groups.deletedAt)));
  return group || undefined;
}

// List with soft delete check
async getUserGroups(userId: string): Promise<Group[]> {
  return await db
    .select()
    .from(groups)
    .where(and(eq(groups.userId, userId), isNull(groups.deletedAt)));
}

// Performing soft delete
async softDeleteGroup(id: string): Promise<void> {
  await db
    .update(groups)
    .set({ deletedAt: sql`now()` })
    .where(eq(groups.id, id));
}
```

## Multiple WHERE Conditions

### AND Conditions

```typescript
// Multiple conditions with and()
const items = await db
  .select()
  .from(activities)
  .where(and(
    eq(activities.groupId, groupId),
    isNull(activities.archivedAt)
  ))
  .orderBy(activities.createdAt);

// Complex filter
const events = await db
  .select()
  .from(autoScheduledEvents)
  .where(and(
    eq(autoScheduledEvents.groupId, groupId),
    eq(autoScheduledEvents.status, "pending"),
    gte(autoScheduledEvents.scheduledDate, new Date())
  ));
```

### OR Conditions

```typescript
// Or conditions
const orphanedEvents = await db
  .select({ id: votingEvents.id })
  .from(votingEvents)
  .leftJoin(groups, eq(votingEvents.groupId, groups.id))
  .where(or(
    isNull(groups.id),           // group doesn't exist
    isNotNull(groups.deletedAt)  // group is soft deleted
  ));
```

### Combined AND/OR

```typescript
const results = await db
  .select()
  .from(members)
  .where(and(
    eq(members.groupId, groupId),
    or(
      eq(members.isOrganizer, true),
      isNotNull(members.userId)
    )
  ));
```

## Ordering and Limiting

```typescript
// Order by single column (descending - newest first)
const activities = await db
  .select()
  .from(activities)
  .where(eq(activities.groupId, groupId))
  .orderBy(desc(activities.createdAt));

// Order by single column (ascending - oldest first)
const members = await db
  .select()
  .from(members)
  .where(eq(members.groupId, groupId))
  .orderBy(asc(members.createdAt));

// With limit
const recentSearches = await db
  .select()
  .from(categorySearchHistory)
  .where(eq(categorySearchHistory.groupId, groupId))
  .orderBy(desc(categorySearchHistory.createdAt))
  .limit(limit || 10);
```

## JOIN Patterns

### Inner Join

```typescript
// Get groups where user is a member
const memberGroups = await db
  .selectDistinct()
  .from(groups)
  .innerJoin(members, eq(members.groupId, groups.id))
  .where(and(eq(members.userId, userId), isNull(groups.deletedAt)))
  .then(rows => rows.map(row => row.groups));
```

### Left Join (for checking existence)

```typescript
// Find orphaned records
const orphanedVotes = await db
  .select({ id: votes.id })
  .from(votes)
  .leftJoin(votingEvents, eq(votes.eventId, votingEvents.id))
  .where(isNull(votingEvents.id));
```

### Join with Multiple Conditions

```typescript
const orphanedGroups = await db
  .selectDistinct()
  .from(groups)
  .innerJoin(members, eq(members.groupId, groups.id))
  .where(and(
    isNull(groups.userId),           // Group has no owner
    eq(members.isOrganizer, true),   // Member is organizer
    eq(members.email, user.email),   // Email matches
    isNull(groups.deletedAt)         // Not soft-deleted
  ))
  .then(rows => rows.map(row => row.groups));
```

## INSERT Patterns

### Single Insert with Returning

```typescript
async createActivity(insertActivity: InsertActivity): Promise<Activity> {
  const [activity] = await db
    .insert(activities)
    .values(insertActivity)
    .returning();
  return activity;
}
```

### Batch Insert with Returning

```typescript
async createActivities(insertActivities: InsertActivity[]): Promise<Activity[]> {
  if (insertActivities.length === 0) return [];

  return await db
    .insert(activities)
    .values(insertActivities)
    .returning();
}
```

### Insert with Generated Values

```typescript
async createGroup(insertGroup: InsertGroup, userId: string): Promise<Group> {
  const shareableLink = randomBytes(16).toString('hex');

  const [group] = await db
    .insert(groups)
    .values({ ...insertGroup, userId, shareableLink })
    .returning();

  return group;
}
```

### Upsert (Insert or Update)

```typescript
async upsertUserProfile(userId: string, profile: InsertUserProfile): Promise<UserProfile> {
  const [result] = await db
    .insert(userProfiles)
    .values({ ...profile, userId })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        ...profile,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result;
}
```

### Insert Ignore Conflicts

```typescript
await db
  .insert(seenActivities)
  .values(seenItems)
  .onConflictDoNothing();
```

## UPDATE Patterns

### Simple Update with Returning

```typescript
async updateGroup(id: string, updates: UpdateGroup): Promise<Group> {
  const [group] = await db
    .update(groups)
    .set(updates)
    .where(eq(groups.id, id))
    .returning();
  return group;
}
```

### Update with Timestamp

```typescript
const [updatedUser] = await db
  .update(users)
  .set({
    firstName: userData.firstName,
    lastName: userData.lastName,
    updatedAt: new Date(),
  })
  .where(eq(users.id, existingUser.id))
  .returning();
```

### Bulk Update by Condition

```typescript
async markInvitationsSent(groupId: string): Promise<void> {
  await db
    .update(members)
    .set({ invitationSent: true })
    .where(eq(members.groupId, groupId));
}
```

### Update with Multiple IDs

```typescript
async reorderGroupCollections(orders: Array<{ id: string; orderIndex: number }>): Promise<void> {
  for (const { id, orderIndex } of orders) {
    await db
      .update(groupCollections)
      .set({ orderIndex })
      .where(eq(groupCollections.id, id));
  }
}
```

### Complex Update with SQL

```typescript
// Atomic array append (only if not already present)
async addRejectedVenue(groupId: string, venueName: string): Promise<void> {
  const normalized = venueName.trim().toLowerCase();

  await db
    .update(groups)
    .set({
      rejectedVenues: sql`CASE
        WHEN ${groups.rejectedVenues} IS NULL THEN ARRAY[${normalized}]::text[]
        WHEN NOT ${groups.rejectedVenues} @> ARRAY[${normalized}]::text[] THEN array_append(${groups.rejectedVenues}, ${normalized})
        ELSE ${groups.rejectedVenues}
      END`
    })
    .where(eq(groups.id, groupId));
}
```

## DELETE Patterns

### Hard Delete Single Record

```typescript
async deleteItinerary(id: string): Promise<void> {
  await db.delete(itineraries).where(eq(itineraries.id, id));
}
```

### Delete by Condition

```typescript
async deleteAllGroupActivities(groupId: string): Promise<void> {
  await db
    .delete(activities)
    .where(eq(activities.groupId, groupId));
}
```

### Delete with Multiple IDs

```typescript
if (eventIds.length > 0) {
  await db
    .delete(votes)
    .where(inArray(votes.eventId, eventIds));
}
```

### Delete with Returning (for counting)

```typescript
const deletedVotes = await db
  .delete(votes)
  .where(inArray(votes.eventId, orphanedEventIds))
  .returning();

const votesDeleted = deletedVotes.length;
```

## Transaction Pattern

```typescript
// Use transactions for multi-step operations that must succeed together
async createGroupWithMembers(
  insertGroup: InsertGroup,
  userId: string,
  memberInputs: Array<{name?: string, email?: string}>
): Promise<Group> {
  return await db.transaction(async (tx) => {
    // Step 1: Create group
    const [group] = await tx
      .insert(groups)
      .values({ ...insertGroup, userId })
      .returning();

    // Step 2: Create members
    if (memberInputs.length > 0) {
      const membersData = memberInputs.map((m, index) => ({
        groupId: group.id,
        name: m.name || null,
        email: m.email || null,
        isOrganizer: index === 0,
        userId: index === 0 ? userId : null,
      }));

      await tx.insert(members).values(membersData);
    }

    return group;
  });
}
```

## Aggregation Patterns

### Count

```typescript
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(itineraries)
  .where(and(
    eq(itineraries.groupId, groupId),
    eq(itineraries.status, 'proposed')
  ));
```

### Count with Group By

```typescript
const voteCounts = await db
  .select({
    timeSlotId: timeSlotVotes.timeSlotId,
    response: timeSlotVotes.response,
    count: sql<number>`count(*)::int`,
  })
  .from(timeSlotVotes)
  .where(inArray(timeSlotVotes.timeSlotId, slotIds))
  .groupBy(timeSlotVotes.timeSlotId, timeSlotVotes.response);
```

## Date Filtering

```typescript
// Greater than or equal
const futureEvents = await db
  .select()
  .from(autoScheduledEvents)
  .where(and(
    eq(autoScheduledEvents.groupId, groupId),
    gte(autoScheduledEvents.scheduledDate, new Date())
  ));

// Less than
const pastEvents = await db
  .select()
  .from(autoScheduledEvents)
  .where(lt(autoScheduledEvents.scheduledDate, new Date()));

// Date range
const eventsInRange = await db
  .select()
  .from(autoScheduledEvents)
  .where(and(
    gte(autoScheduledEvents.scheduledDate, startDate),
    lte(autoScheduledEvents.scheduledDate, endDate)
  ));
```

## Common Patterns Summary

| Operation | Pattern |
|-----------|---------|
| Single by ID | `const [item] = await db.select().from(table).where(eq(table.id, id))` |
| With soft delete | `.where(and(eq(table.id, id), isNull(table.deletedAt)))` |
| List filtered | `await db.select().from(table).where(eq(table.groupId, groupId))` |
| Ordered | `.orderBy(desc(table.createdAt))` |
| Insert + return | `const [item] = await db.insert(table).values(data).returning()` |
| Batch insert | `await db.insert(table).values(items).returning()` |
| Update + return | `const [item] = await db.update(table).set(updates).where(...).returning()` |
| Soft delete | `.set({ deletedAt: sql\`now()\` })` |
| Hard delete | `await db.delete(table).where(...)` |
| Join | `.innerJoin(other, eq(table.id, other.tableId))` |
| Transaction | `await db.transaction(async (tx) => { ... })` |

## Query Checklist

When writing a new query:

- [ ] Import needed operators (`eq`, `and`, `isNull`, etc.)
- [ ] Check if table uses soft deletes - add `isNull(table.deletedAt)` filter
- [ ] Use `and()` for multiple WHERE conditions
- [ ] Destructure single result: `const [item] = await db.select()...`
- [ ] Return `undefined` not `null` for not-found cases
- [ ] Use `.returning()` for INSERT/UPDATE when you need the result
- [ ] Use transactions for multi-step operations
- [ ] Add proper TypeScript return types
