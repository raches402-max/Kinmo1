# Activation Guide

This document explains how to trigger the kinmo-api-endpoint-cskill skill effectively.

## Quick Reference

### Best Activation Phrases

| If you want to... | Say this... |
|-------------------|-------------|
| Create a new endpoint | "add an endpoint for [feature]" |
| Specify HTTP method | "POST route for [action]" |
| CRUD operation | "create API to [create/read/update/delete] [resource]" |
| Backend for feature | "add backend for the [feature] feature" |

### Complete Activation Examples

```
"add an endpoint for updating member preferences"
"create a POST route for importing venues"
"new PATCH endpoint to update itinerary status"
"DELETE route for removing a voting event"
"I need an API that lets users submit feedback"
"add backend for the new group insights feature"
"create the server side for venue bookmarking"
```

## Providing Good Context

The more context you provide, the better the generated code:

### Good Request (provides context)

```
"add an endpoint for updating member preferences - the member should be able
to set their activity types (meal, drinks, etc), budget preference, and
dietary restrictions. Only the member themselves or the group owner should
be able to update this."
```

This tells the skill:
- What fields are needed (activity types, budget, dietary restrictions)
- Authorization requirements (member or owner)
- Resource being modified (member preferences)

### Minimal Request (still works)

```
"add an endpoint for updating member preferences"
```

The skill will make reasonable assumptions based on existing Kinmo patterns.

## What You'll Get

When activated, the skill generates:

1. **Zod validation schema** - Full type-safe validation
2. **Express route** - Complete with middleware, error handling, logging
3. **Storage function** - If database operations needed
4. **Query keys** - For frontend cache invalidation

## Combining with Other Skills

After generating an endpoint, you might want to:

1. **kinmo-mutation** - Generate the frontend mutation to call this endpoint
2. **kinmo-test-generator** - Generate tests for the new endpoint
3. **kinmo-drizzle-query** - If you need complex database queries

Example workflow:
```
1. "add an endpoint for member preferences"
   → Generates backend code

2. "now create a mutation to call that endpoint"
   → kinmo-mutation generates frontend code

3. "add tests for the member preferences endpoint"
   → kinmo-test-generator creates tests
```

## Troubleshooting

### Skill not activating?

Make sure your request includes:
- An action verb: "add", "create", "make", "build"
- Reference to API/backend: "endpoint", "route", "API", "backend"
- What you're building: the feature or resource name

### Getting wrong authorization?

Be explicit about who needs access:
```
❌ "endpoint for editing group"
✅ "endpoint for group owner to edit group settings"
✅ "endpoint for any group member to view activities"
```

### Need a specific HTTP method?

Start with the method:
```
"POST route for..."
"GET endpoint that..."
"PATCH API to..."
"DELETE route for..."
```
