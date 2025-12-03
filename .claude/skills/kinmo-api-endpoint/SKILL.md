---
name: kinmo-api-endpoint-cskill
description: Generate complete Express API endpoints for Kinmo with Zod validation, authorization middleware, storage functions, and proper error handling. Activates when user says "add endpoint", "create API route", "new route for", "add API for", "endpoint that", "POST/GET/PATCH/DELETE route", or describes needing to add backend functionality. This skill generates production-ready code, not just patterns.
---

# Kinmo API Endpoint Generator

**Version:** 2.0.0
**Type:** Code Generation Skill
**Created by:** Agent-Skill-Creator methodology

---

## Overview

This skill **generates complete, production-ready API endpoints** for Kinmo. Unlike pattern documentation, this skill actively creates the code you need when you describe what an endpoint should do.

### What This Skill Does

When activated, this skill will:
1. **Generate a Zod validation schema** with proper types and error messages
2. **Select the correct authorization middleware** based on access requirements
3. **Write the complete Express route** with error handling and logging
4. **Create storage layer functions** if database operations are needed
5. **Document query keys** for frontend cache invalidation

### Key Features

- Autonomous code generation (not just patterns)
- Context-aware middleware selection
- Consistent with existing Kinmo codebase patterns
- Generates all layers: validation → route → storage

---

## Skill Activation

This skill uses a **3-Layer Activation System** for reliable detection.

### Phrases That Activate This Skill

#### Primary Activation Phrases
1. **"add an endpoint for..."**
   - Example: "add an endpoint for updating member preferences"

2. **"create API route for..."**
   - Example: "create API route for deleting itineraries"

3. **"new route that..."**
   - Example: "new route that lets users save favorite venues"

#### HTTP Method Activation
4. **"POST route for..."**
   - Example: "POST route for creating a new collection"

5. **"PATCH route to..."**
   - Example: "PATCH route to update group settings"

6. **"DELETE endpoint for..."**
   - Example: "DELETE endpoint for removing a member"

7. **"GET endpoint that..."**
   - Example: "GET endpoint that returns group analytics"

#### Natural Language Activation
8. **"I need an API that..."**
   - Example: "I need an API that lets members vote on time slots"

9. **"add backend for..."**
   - Example: "add backend for the new feedback feature"

10. **"create the server side for..."**
    - Example: "create the server side for venue bookmarking"

### Phrases That Do NOT Activate

1. **General coding questions**
   - Example: "how do API endpoints work?"
   - Reason: Educational question, not endpoint creation

2. **Frontend-only requests**
   - Example: "add a button for submitting votes"
   - Reason: UI task, use kinmo-mutation skill instead

3. **Database-only requests**
   - Example: "write a query to get all members"
   - Reason: Use kinmo-drizzle-query skill instead

---

## Autonomous Generation Protocol

When this skill activates, Claude will **autonomously**:

### Phase 1: Requirement Analysis
Extract from user request:
- **Resource**: What entity is being operated on (group, member, itinerary, etc.)
- **Operation**: CRUD action (create, read, update, delete)
- **Authorization**: Who should access this (owner only, members, anyone authenticated)
- **Data requirements**: What fields are needed in request/response

### Phase 2: Authorization Decision
Automatically select middleware based on patterns:

| Access Level | Middleware | When to Use |
|--------------|------------|-------------|
| Owner only | `requireGroupOwnership()` | Group settings, dangerous operations |
| Owner or member | `requireGroupAccess()` | Viewing group data, participating |
| Itinerary access | `requireItineraryAccess()` | Itinerary modifications |
| Authenticated user | `isAuthenticated` | User profile, cross-group |
| Admin only | `requireAdmin()` | System administration |
| Public | (none) | Public data, health checks |

### Phase 3: Code Generation
Generate complete code in this order:

1. **Zod Schema** → `server/validation-schemas.ts`
2. **Express Route** → `server/routes.ts`
3. **Storage Function** → `server/storage.ts` (if needed)
4. **Query Keys** → Document for frontend

---

## Code Generation Templates

### Template 1: Standard CRUD Endpoint

```typescript
// ===== 1. VALIDATION SCHEMA (server/validation-schemas.ts) =====

export const {{schemaName}}Schema = z.object({
  {{#each fields}}
  {{name}}: {{zodType}},
  {{/each}}
});

// ===== 2. EXPRESS ROUTE (server/routes.ts) =====

app.{{method}}("/api/{{resourcePath}}", isAuthenticated, {{middleware}}, async (req: any, res) => {
  try {
    {{#if hasParams}}
    const { {{params}} } = req.params;
    {{/if}}
    const userId = await getUserId(req);

    {{#if hasBody}}
    // Validate request body
    const parseResult = safeParse({{schemaName}}Schema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const data = parseResult.data;
    {{/if}}

    // Business logic
    const result = await storage.{{storageMethod}}({{storageArgs}});

    {{#if isCreate}}
    res.status(201).json(result);
    {{else if isDelete}}
    res.status(204).send();
    {{else}}
    res.json(result);
    {{/if}}
  } catch (error: any) {
    console.error("[{{endpointName}}] Error:", error);
    res.status(500).json({ error: error.message || "{{errorMessage}}" });
  }
});

// ===== 3. STORAGE FUNCTION (server/storage.ts) =====

async {{storageMethod}}({{storageParams}}): Promise<{{returnType}}> {
  {{#if isSelect}}
  const [result] = await db
    .select()
    .from({{table}})
    .where({{whereClause}});
  return result;
  {{/if}}
  {{#if isInsert}}
  const [result] = await db
    .insert({{table}})
    .values({{values}})
    .returning();
  return result;
  {{/if}}
  {{#if isUpdate}}
  const [result] = await db
    .update({{table}})
    .set({{updates}})
    .where({{whereClause}})
    .returning();
  return result;
  {{/if}}
  {{#if isDelete}}
  await db
    .delete({{table}})
    .where({{whereClause}});
  {{/if}}
}

// ===== 4. QUERY KEYS (for frontend invalidation) =====
// Affected: {{queryKeys}}
```

---

## Real-World Examples

### Example 1: Create Endpoint for Member Preferences

**User Query:**
```
"add an endpoint for updating a member's activity preferences"
```

**Generated Code:**

```typescript
// ===== server/validation-schemas.ts =====

export const updateMemberPreferencesSchema = z.object({
  activityTypes: z.array(z.enum(["meal", "drinks", "dessert", "experience", "cafes"])).optional(),
  budgetPreference: z.enum(["budget", "moderate", "upscale"]).optional(),
  distanceWillingToTravel: z.number().min(1).max(50).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
});

// ===== server/routes.ts =====

app.patch("/api/groups/:groupId/members/:memberId/preferences", isAuthenticated, requireGroupAccess(), async (req: any, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = await getUserId(req);

    // Validate request body
    const parseResult = safeParse(updateMemberPreferencesSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const data = parseResult.data;

    // Verify member belongs to group and user has access
    const member = await storage.getMember(memberId);
    if (!member || member.groupId !== groupId) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Only allow member to update their own preferences, or group owner
    const group = await storage.getGroup(groupId);
    if (member.userId !== userId && group?.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update this member's preferences" });
    }

    // Update preferences
    const updated = await storage.updateMemberPreferences(memberId, data);

    res.json(updated);
  } catch (error: any) {
    console.error("[Update Member Preferences] Error:", error);
    res.status(500).json({ error: error.message || "Failed to update preferences" });
  }
});

// ===== server/storage.ts =====

async updateMemberPreferences(
  memberId: string,
  preferences: {
    activityTypes?: string[];
    budgetPreference?: string;
    distanceWillingToTravel?: number;
    dietaryRestrictions?: string[];
  }
): Promise<Member> {
  const [member] = await db
    .update(members)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId))
    .returning();
  return member;
}

// ===== Query Keys =====
// Invalidate: ["/api/groups", groupId, "members"]
```

---

### Example 2: Create Endpoint for Batch Venue Import

**User Query:**
```
"POST route for importing multiple venues to a group's library"
```

**Generated Code:**

```typescript
// ===== server/validation-schemas.ts =====

export const importVenuesToGroupSchema = z.object({
  venues: z.array(z.object({
    name: z.string().min(1, "Venue name is required"),
    placeId: z.string().optional(),
    address: z.string().optional(),
    category: z.enum(["meal", "drinks", "dessert", "experience", "cafes"]),
    notes: z.string().max(500).optional(),
  })).min(1, "At least one venue is required").max(50, "Maximum 50 venues per import"),
});

// ===== server/routes.ts =====

app.post("/api/groups/:groupId/activities/import", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Validate request body
    const parseResult = safeParse(importVenuesToGroupSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const { venues } = parseResult.data;

    // Batch create activities
    const activitiesToCreate = venues.map(venue => ({
      groupId,
      name: venue.name,
      placeId: venue.placeId || null,
      address: venue.address || null,
      category: venue.category,
      notes: venue.notes || null,
      addedBy: userId,
      createdAt: new Date(),
    }));

    const created = await storage.createActivitiesBatch(groupId, activitiesToCreate);

    console.log(`[Import Venues] Imported ${created.length} venues to group ${groupId}`);

    res.status(201).json({
      imported: created.length,
      activities: created,
    });
  } catch (error: any) {
    console.error("[Import Venues] Error:", error);
    res.status(500).json({ error: error.message || "Failed to import venues" });
  }
});

// ===== server/storage.ts =====

async createActivitiesBatch(
  groupId: string,
  activitiesData: InsertActivity[]
): Promise<Activity[]> {
  if (activitiesData.length === 0) return [];

  return await db
    .insert(activities)
    .values(activitiesData)
    .returning();
}

// ===== Query Keys =====
// Invalidate: ["/api/groups", groupId, "activities"]
```

---

### Example 3: Delete Endpoint with Cascade

**User Query:**
```
"DELETE endpoint for removing a voting event and all its votes"
```

**Generated Code:**

```typescript
// ===== server/routes.ts =====
// (No validation schema needed for DELETE by ID)

app.delete("/api/groups/:groupId/voting-events/:eventId", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { groupId, eventId } = req.params;
    const userId = await getUserId(req);

    // Verify event belongs to group
    const event = await storage.getVotingEvent(eventId);
    if (!event || event.groupId !== groupId) {
      return res.status(404).json({ error: "Voting event not found" });
    }

    // Delete event and cascade to votes (handled in storage)
    await storage.deleteVotingEventWithVotes(eventId);

    console.log(`[Delete Voting Event] Deleted event ${eventId} from group ${groupId}`);

    res.status(204).send();
  } catch (error: any) {
    console.error("[Delete Voting Event] Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete voting event" });
  }
});

// ===== server/storage.ts =====

async deleteVotingEventWithVotes(eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete votes first (foreign key)
    await tx
      .delete(votes)
      .where(eq(votes.eventId, eventId));

    // Delete the event
    await tx
      .delete(votingEvents)
      .where(eq(votingEvents.id, eventId));
  });
}

// ===== Query Keys =====
// Invalidate:
//   ["/api/groups", groupId, "voting-events"]
//   ["/api/groups", groupId, "my-votes"]
```

---

## Zod Schema Patterns Reference

### Common Field Types

```typescript
// Required string
name: z.string().min(1, "Name is required").max(100, "Name too long"),

// Optional string
notes: z.string().max(500).optional(),

// Email
email: z.string().email("Invalid email address"),

// Number with range
amount: z.number().min(0, "Must be positive").max(1000, "Too high"),

// Integer
count: z.number().int().min(1),

// Enum
status: z.enum(["draft", "active", "completed"], {
  errorMap: () => ({ message: "Invalid status" }),
}),

// Boolean with default
isActive: z.boolean().default(false),

// Date string
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),

// DateTime (ISO)
timestamp: z.string().datetime("Invalid datetime"),

// Array with constraints
tags: z.array(z.string()).min(1, "At least one tag").max(10, "Max 10 tags"),

// Nested object
address: z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  zip: z.string().regex(/^\d{5}$/, "Invalid ZIP"),
}),

// Union type
value: z.union([z.string(), z.number()]),

// Cross-field validation
.refine(data => data.minValue <= data.maxValue, {
  message: "Min must be less than max",
  path: ["maxValue"],
})
```

---

## Authorization Decision Matrix

| Scenario | Middleware | Example Route |
|----------|------------|---------------|
| Modify group settings | `requireGroupOwnership()` | PATCH /api/groups/:groupId |
| View group data | `requireGroupAccess()` | GET /api/groups/:groupId |
| Member voting | `requireGroupAccess()` | POST /api/groups/:groupId/votes |
| Delete member | `requireGroupOwnership()` | DELETE /api/members/:memberId |
| Update own profile | `isAuthenticated` | PATCH /api/user/profile |
| View own events | `isAuthenticated` | GET /api/user/events |
| Modify itinerary | `requireItineraryAccess()` | PATCH /api/itineraries/:id |
| Admin operations | `requireAdmin()` | POST /api/admin/... |
| Public info | (none) | GET /api/health |

---

## Query Key Reference

When documenting what to invalidate:

| Resource Modified | Query Keys to Invalidate |
|-------------------|-------------------------|
| Group settings | `["/api/groups", groupId]` |
| Group members | `["/api/groups", groupId, "members"]` |
| Activities/Venues | `["/api/groups", groupId, "activities"]` |
| Voting events | `["/api/groups", groupId, "voting-events"]` |
| User votes | `["/api/groups", groupId, "my-votes"]` |
| Saved itineraries | `["/api/groups", groupId, "saved-itineraries"]` |
| Proposed itineraries | `["/api/groups", groupId, "proposed-itineraries"]` |
| Auto-scheduled events | `["/api/groups", groupId, "auto-scheduled-events"]` |
| User events | `["/api/user/events"]` |
| Itinerary details | `["/api/itineraries", itineraryId]` |
| RSVPs | `["/api/itineraries", itineraryId, "rsvps"]` |

---

## Endpoint Checklist

Before finalizing generated code, verify:

- [ ] HTTP method matches the operation (GET=read, POST=create, PATCH=update, DELETE=remove)
- [ ] Authorization middleware matches access requirements
- [ ] Zod schema validates all user inputs
- [ ] Error messages are user-friendly
- [ ] Logging uses consistent `[Endpoint Name]` format
- [ ] Status codes are correct (200/201/204/400/403/404/500)
- [ ] Storage function handles soft deletes if applicable
- [ ] Query keys documented for frontend team

---

## Troubleshooting

### Skill Not Activating

**Solutions:**
1. Use action verbs: "add", "create", "make", "build"
2. Mention "endpoint", "route", "API"
3. Specify HTTP method: "POST route", "PATCH endpoint"

**Example Fix:**
```
❌ "I want users to update preferences"
✅ "add an endpoint for updating user preferences"
```

### Wrong Authorization Selected

**Solution:** Be explicit about who should access:
```
❌ "endpoint for editing group"
✅ "endpoint for group owner to edit group settings"
```

---

## File Locations

| Purpose | File Path |
|---------|-----------|
| Validation schemas | `server/validation-schemas.ts` |
| Routes | `server/routes.ts` |
| Storage layer | `server/storage.ts` |
| Authorization | `server/authorization.ts` |
| Schema types | `shared/schema.ts` |

---

**Generated by:** Agent-Skill-Creator methodology
**Last Updated:** 2024
**Activation System:** 3-Layer (Keywords + Patterns + Description)
