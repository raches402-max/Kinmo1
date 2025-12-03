# Existing Kinmo Endpoint Patterns

This reference shows real patterns extracted from the Kinmo codebase for consistent code generation.

## Route Organization in routes.ts

Routes are organized by resource type with section comments:

```typescript
// ========== USER ROUTES ==========
app.get("/api/user/profile", ...);
app.patch("/api/user/profile", ...);

// ========== GROUP ROUTES ==========
app.get("/api/groups/:groupId", ...);
app.patch("/api/groups/:groupId", ...);

// ========== MEMBER ROUTES ==========
app.get("/api/groups/:groupId/members", ...);
app.post("/api/groups/:groupId/members", ...);

// ========== ACTIVITY ROUTES ==========
app.get("/api/groups/:groupId/activities", ...);
app.post("/api/groups/:groupId/activities", ...);

// ========== ITINERARY ROUTES ==========
app.get("/api/itineraries/:itineraryId", ...);
app.patch("/api/itineraries/:itineraryId", ...);

// ========== VOTING ROUTES ==========
app.get("/api/groups/:groupId/voting-events", ...);
app.post("/api/voting-events/:eventId/votes", ...);
```

## Import Pattern

Always use this import structure at the top of validation-schemas.ts:

```typescript
import { z } from 'zod';
```

And in routes.ts:

```typescript
import { safeParse } from './validation-middleware';
import {
  myNewSchema,
  // ... other schemas
} from './validation-schemas';
```

## Real Endpoint Examples from Kinmo

### Pattern: Simple GET with Group Access

```typescript
app.get("/api/groups/:groupId/activities", isAuthenticated, requireGroupAccess(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const activities = await storage.getGroupActivities(groupId);
    res.json(activities);
  } catch (error: any) {
    console.error("[Get Activities] Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch activities" });
  }
});
```

### Pattern: POST with Validation

```typescript
app.post("/api/groups/:groupId/members", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    const parseResult = safeParse(insertMemberSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const data = parseResult.data;

    const member = await storage.createMember({
      ...data,
      groupId,
    });

    res.status(201).json(member);
  } catch (error: any) {
    console.error("[Create Member] Error:", error);
    res.status(500).json({ error: error.message || "Failed to create member" });
  }
});
```

### Pattern: PATCH with Ownership Check

```typescript
app.patch("/api/groups/:groupId", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    const parseResult = safeParse(updateGroupSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const updates = parseResult.data;

    const group = await storage.updateGroup(groupId, updates);

    res.json(group);
  } catch (error: any) {
    console.error("[Update Group] Error:", error);
    res.status(500).json({ error: error.message || "Failed to update group" });
  }
});
```

### Pattern: DELETE with Cascade

```typescript
app.delete("/api/members/:memberId", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { memberId } = req.params;
    const userId = await getUserId(req);

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Verify user owns the group this member belongs to
    const group = await storage.getGroup(member.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteMember(memberId);

    console.log(`[Delete Member] User ${userId} deleted member ${memberId}`);

    res.status(204).send();
  } catch (error: any) {
    console.error("[Delete Member] Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete member" });
  }
});
```

### Pattern: Complex Validation with Refinement

```typescript
// From validation-schemas.ts
export const pauseAutomationSchema = z.object({
  pauseType: z.enum(['events', 'until'], {
    errorMap: () => ({ message: "Pause type must be 'events' or 'until'" })
  }),
  value: z.union([
    z.number().int().min(1, "Number of events must be at least 1"),
    z.string().datetime("Invalid date format"),
  ]),
}).refine(
  (data) => {
    if (data.pauseType === 'events') {
      return typeof data.value === 'number';
    }
    if (data.pauseType === 'until') {
      return typeof data.value === 'string';
    }
    return false;
  },
  { message: "Value must be a number for 'events' or a date string for 'until'" }
);
```

### Pattern: Batch Operation

```typescript
app.post("/api/groups/:groupId/activities/batch", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    const parseResult = safeParse(batchActivitiesSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const { activities } = parseResult.data;

    const created = await storage.createActivitiesBatch(
      activities.map(a => ({ ...a, groupId, addedBy: userId }))
    );

    res.status(201).json({
      created: created.length,
      activities: created,
    });
  } catch (error: any) {
    console.error("[Batch Create Activities] Error:", error);
    res.status(500).json({ error: error.message || "Failed to create activities" });
  }
});
```

## Storage Layer Patterns

### Single Record Operations

```typescript
// Get by ID with soft delete check
async getGroup(id: string): Promise<Group | undefined> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, id), isNull(groups.deletedAt)));
  return group || undefined;
}

// Update with returning
async updateGroup(id: string, updates: UpdateGroup): Promise<Group> {
  const [group] = await db
    .update(groups)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(groups.id, id))
    .returning();
  return group;
}

// Soft delete
async deleteGroup(id: string): Promise<void> {
  await db
    .update(groups)
    .set({ deletedAt: sql`now()` })
    .where(eq(groups.id, id));
}
```

### List Operations

```typescript
// Filtered list
async getGroupMembers(groupId: string): Promise<Member[]> {
  return await db
    .select()
    .from(members)
    .where(eq(members.groupId, groupId))
    .orderBy(members.createdAt);
}

// With multiple conditions
async getActiveVotingEvents(groupId: string): Promise<VotingEvent[]> {
  return await db
    .select()
    .from(votingEvents)
    .where(and(
      eq(votingEvents.groupId, groupId),
      eq(votingEvents.status, 'active'),
      isNull(votingEvents.deletedAt)
    ))
    .orderBy(desc(votingEvents.createdAt));
}
```

### Transaction Pattern

```typescript
async createGroupWithOwner(
  groupData: InsertGroup,
  userId: string
): Promise<{ group: Group; member: Member }> {
  return await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ ...groupData, userId })
      .returning();

    const [member] = await tx
      .insert(members)
      .values({
        groupId: group.id,
        userId,
        name: 'Owner',
        isOrganizer: true,
      })
      .returning();

    return { group, member };
  });
}
```

## Error Handling Standards

```typescript
// Validation error (400)
if (!parseResult.success) {
  return res.status(400).json({
    error: parseResult.error.errors[0]?.message || "Invalid request"
  });
}

// Not found (404)
const item = await storage.getItem(id);
if (!item) {
  return res.status(404).json({ error: "Item not found" });
}

// Forbidden (403)
if (item.userId !== userId) {
  return res.status(403).json({ error: "Not authorized" });
}

// Server error (500)
catch (error: any) {
  console.error("[Endpoint Name] Error:", error);
  res.status(500).json({ error: error.message || "Failed to process request" });
}
```

## Logging Standards

```typescript
// Success logging (for important operations)
console.log(`[Create Group] User ${userId} created group ${group.id}`);

// State change logging
console.log(`[Update Group] Cadence changed from ${oldCadence} to ${newCadence}`);

// Error logging (always)
console.error("[Endpoint Name] Error:", error);
```
