---
name: kinmo-api-endpoint
description: Create Express API endpoints for Kinmo with Zod validation, authorization middleware, and proper error handling. Use when adding new API routes to server/routes.ts.
---

# Kinmo API Endpoint Patterns

When creating new API endpoints for Kinmo, follow these established patterns.

## File Locations

- Routes: `server/routes.ts`
- Validation schemas: `server/validation-schemas.ts`
- Authorization middleware: `server/authorization.ts`
- Storage layer: `server/storage.ts`

## Standard Endpoint Template

```typescript
// In server/routes.ts
app.post("/api/groups/:groupId/my-endpoint", isAuthenticated, requireGroupAccess(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Validate request body
    const parseResult = safeParse(myEndpointSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const data = parseResult.data;

    // Business logic
    const result = await storage.doSomething(groupId, data);

    res.json(result);
  } catch (error: any) {
    console.error("[My Endpoint] Error:", error);
    res.status(500).json({ error: error.message || "Failed to process request" });
  }
});
```

## Authorization Middleware

Choose the appropriate middleware based on access level:

```typescript
// Public endpoints (no auth required)
app.get("/api/public/endpoint", async (req, res) => { ... });

// Authenticated user only
app.get("/api/user/profile", isAuthenticated, async (req: any, res) => { ... });

// User must be group owner
app.patch("/api/groups/:groupId", isAuthenticated, requireGroupOwnership(), async (req: any, res) => { ... });

// User must have access to group (owner or member)
app.get("/api/groups/:groupId", isAuthenticated, requireGroupAccess(), async (req: any, res) => { ... });

// User must have access to specific itinerary
app.get("/api/itineraries/:itineraryId", isAuthenticated, requireItineraryAccess(), async (req: any, res) => { ... });

// Admin only
app.post("/api/admin/action", isAuthenticated, requireAdmin(), async (req: any, res) => { ... });
```

## Zod Validation Schemas

Add to `server/validation-schemas.ts`:

```typescript
// Simple schema
export const myEndpointSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  value: z.number().int().min(0).optional(),
  enabled: z.boolean().default(false),
});

// With unions for enum-like values
export const updateStatusSchema = z.object({
  status: z.union([z.literal("active"), z.literal("paused"), z.literal("completed")]),
});

// With arrays
export const batchUpdateSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    value: z.number(),
  })).min(1, "At least one item required"),
});

// With refinements
export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: "Start date must be before end date" }
);
```

## Route Organization

Group routes by resource type in `server/routes.ts`:

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

// ========== ITINERARY ROUTES ==========
app.get("/api/itineraries/:itineraryId", ...);
app.patch("/api/itineraries/:itineraryId", ...);
```

## HTTP Methods

```typescript
// GET - Read data
app.get("/api/groups/:groupId", ...);

// POST - Create new resource
app.post("/api/groups", ...);

// PATCH - Partial update
app.patch("/api/groups/:groupId", ...);

// DELETE - Remove resource
app.delete("/api/groups/:groupId/members/:memberId", ...);
```

## Error Handling

```typescript
try {
  // Validation errors
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
  }

  // Not found
  const item = await storage.getItem(id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Authorization (handled by middleware, but for custom checks)
  if (item.userId !== userId) {
    return res.status(403).json({ error: "Not authorized" });
  }

  // Success
  res.json(result);
} catch (error: any) {
  console.error("[Endpoint Name] Error:", error);
  res.status(500).json({ error: error.message || "Failed to process request" });
}
```

## Getting User ID

```typescript
// Inside authenticated routes
const userId = await getUserId(req);
```

## Database Operations

Use the storage layer (`server/storage.ts`) or direct Drizzle queries:

```typescript
// Via storage layer (preferred for complex operations)
const group = await storage.getGroup(groupId);
const members = await storage.getGroupMembers(groupId);

// Direct Drizzle queries for simple operations
const [result] = await db
  .update(groupsTable)
  .set({ name: data.name, updatedAt: new Date() })
  .where(eq(groupsTable.id, groupId))
  .returning();

// With multiple conditions
const items = await db
  .select()
  .from(itemsTable)
  .where(and(
    eq(itemsTable.groupId, groupId),
    eq(itemsTable.status, "active"),
    gte(itemsTable.createdAt, startDate)
  ))
  .orderBy(desc(itemsTable.createdAt));
```

## Common Query Keys (for frontend invalidation reference)

When documenting what the endpoint affects:

```
/api/groups/:groupId - Main group data
/api/groups/:groupId/members - Group members
/api/groups/:groupId/activities - Saved activities/venues
/api/groups/:groupId/voting-events - Favorites list
/api/groups/:groupId/saved-itineraries - Saved plans
/api/user/events - User's upcoming events
```

## Complete Endpoint Example with All Patterns

```typescript
// 1. Add validation schema to server/validation-schemas.ts
export const createBookingSchema = z.object({
  itineraryId: z.string().min(1, "Itinerary ID is required"),
  timeSlot: z.string().datetime("Invalid datetime"),
  notes: z.string().max(500, "Notes too long").optional(),
  attendees: z.array(z.string()).min(1, "At least one attendee required"),
});

// 2. Add route to server/routes.ts
app.post("/api/groups/:groupId/bookings", isAuthenticated, requireGroupAccess(), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Validate request body
    const parseResult = safeParse(createBookingSchema, req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const data = parseResult.data;

    // Verify itinerary belongs to group
    const itinerary = await storage.getItinerary(data.itineraryId);
    if (!itinerary || itinerary.groupId !== groupId) {
      return res.status(404).json({ error: "Itinerary not found" });
    }

    // Business logic
    const booking = await storage.createBooking({
      ...data,
      groupId,
      createdBy: userId,
      createdAt: new Date(),
    });

    // Optional: trigger side effects
    await notifyBookingCreated(booking);

    res.status(201).json(booking);
  } catch (error: any) {
    console.error("[Create Booking] Error:", error);
    res.status(500).json({ error: error.message || "Failed to create booking" });
  }
});
```

## Logging Best Practices

```typescript
// Use consistent log prefixes matching the endpoint
console.log(`[Create Booking] Creating booking for group ${groupId}`);
console.error("[Create Booking] Error:", error);

// Include relevant IDs for debugging
console.log(`[Update Member] User ${userId} updating member ${memberId} in group ${groupId}`);

// Log important state changes
console.log(`[Update Group] Cadence changed from ${oldCadence} to ${newCadence}, clearing ${count} events`);
```

## Response Patterns

```typescript
// Success with created resource (201)
res.status(201).json(createdResource);

// Success with updated resource (200)
res.json(updatedResource);

// Success with metadata
res.json({
  ...updatedGroup,
  cadenceChange: {
    oldCadence: "weekly",
    newCadence: "biweekly",
    eventsCleared: 3,
    eventsCreated: 2,
  },
});

// Success with no content (204)
res.status(204).send();

// Batch operation result
res.json({
  succeeded: successfulItems,
  failed: failedItems,
  message: `${successfulItems.length} of ${total} items processed`,
});
```

## Rate Limiting (for expensive operations)

```typescript
import rateLimit from 'express-rate-limit';

// Create limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { error: "Too many AI requests, please try again later" },
});

// Apply to specific routes
app.post("/api/groups/:groupId/ai-suggestions", isAuthenticated, aiLimiter, async (req, res) => {
  // ...
});
```

## Endpoint Checklist

When creating a new endpoint:

- [ ] Choose correct HTTP method (GET/POST/PATCH/DELETE)
- [ ] Add appropriate authorization middleware
- [ ] Create Zod validation schema in `validation-schemas.ts`
- [ ] Validate request body with `safeParse`
- [ ] Verify resource ownership/access if using IDs from request
- [ ] Use storage layer for database operations
- [ ] Return appropriate status codes (200/201/204/400/403/404/500)
- [ ] Add try/catch with consistent error logging
- [ ] Document affected query keys for frontend team
