---
name: kinmo-test-generator
description: Generate integration and unit tests for Kinmo API endpoints, mutations, and components. Use when adding tests to ensure code reliability and prevent regressions.
---

# Kinmo Test Generator Patterns

When creating tests for Kinmo, follow these patterns. Tests should be practical, focused on real behavior, and catch actual bugs.

## File Locations & Structure

```
tests/
├── api/                    # API endpoint integration tests
│   ├── groups.test.ts
│   ├── members.test.ts
│   ├── itineraries.test.ts
│   └── auth.test.ts
├── mutations/              # Frontend mutation tests
│   └── useGroupMutations.test.ts
├── utils/                  # Utility function tests
│   └── validation.test.ts
├── setup.ts               # Test setup and utilities
└── fixtures.ts            # Test data factories
```

## Test Setup File

Create `tests/setup.ts`:

```typescript
import { db } from "../server/db";
import { users, groups, members, itineraries } from "@shared/schema";
import { eq } from "drizzle-orm";

// Test user for authenticated requests
export const TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  oauthProvider: "test",
  oauthId: "test-oauth-id",
};

// Create authenticated request helper
export function createAuthenticatedRequest(userId: string = TEST_USER.id) {
  return {
    headers: {
      "x-test-user-id": userId,
    },
  };
}

// Database cleanup helper
export async function cleanupTestData(testPrefix: string) {
  // Delete in reverse dependency order
  await db.delete(members).where(
    eq(members.groupId, testPrefix)
  );
  await db.delete(groups).where(
    eq(groups.id, testPrefix)
  );
}

// Setup test user
export async function setupTestUser() {
  const [user] = await db
    .insert(users)
    .values(TEST_USER)
    .onConflictDoNothing()
    .returning();
  return user || TEST_USER;
}
```

## Test Fixtures File

Create `tests/fixtures.ts`:

```typescript
import { db } from "../server/db";
import { groups, members, itineraries, activities } from "@shared/schema";

// Factory functions for creating test data
export const factories = {
  group: async (overrides: Partial<typeof groups.$inferInsert> = {}) => {
    const [group] = await db
      .insert(groups)
      .values({
        name: `Test Group ${Date.now()}`,
        emoji: "🎉",
        locationBase: "San Francisco, CA",
        budgetMin: 20,
        budgetMax: 60,
        meetingFrequency: "weekly",
        closenessLevel: 3,
        noveltyPreference: 3,
        ownerId: "test-user-id",
        ...overrides,
      })
      .returning();
    return group;
  },

  member: async (groupId: string, overrides: Partial<typeof members.$inferInsert> = {}) => {
    const [member] = await db
      .insert(members)
      .values({
        groupId,
        name: `Test Member ${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        isOrganizer: false,
        hasJoined: true,
        ...overrides,
      })
      .returning();
    return member;
  },

  itinerary: async (groupId: string, overrides: Partial<typeof itineraries.$inferInsert> = {}) => {
    const [itinerary] = await db
      .insert(itineraries)
      .values({
        groupId,
        name: `Test Itinerary ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        status: "draft",
        ...overrides,
      })
      .returning();
    return itinerary;
  },

  activity: async (groupId: string, overrides: Partial<typeof activities.$inferInsert> = {}) => {
    const [activity] = await db
      .insert(activities)
      .values({
        groupId,
        name: `Test Venue ${Date.now()}`,
        category: "meal",
        addedBy: "test-user-id",
        ...overrides,
      })
      .returning();
    return activity;
  },
};
```

## API Endpoint Test Template

Create `tests/api/groups.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../../server/index";
import request from "supertest";
import { factories } from "../fixtures";
import { cleanupTestData, setupTestUser, createAuthenticatedRequest } from "../setup";

describe("Groups API", () => {
  let testUser: any;
  let testGroup: any;

  beforeAll(async () => {
    testUser = await setupTestUser();
  });

  beforeEach(async () => {
    testGroup = await factories.group({ ownerId: testUser.id });
  });

  afterAll(async () => {
    await cleanupTestData("test-");
  });

  describe("GET /api/groups/:groupId", () => {
    it("returns group data for authorized user", async () => {
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set(createAuthenticatedRequest(testUser.id).headers);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: testGroup.id,
        name: testGroup.name,
        emoji: testGroup.emoji,
      });
    });

    it("returns 401 for unauthenticated request", async () => {
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}`);

      expect(res.status).toBe(401);
    });

    it("returns 404 for non-existent group", async () => {
      const res = await request(app)
        .get("/api/groups/non-existent-id")
        .set(createAuthenticatedRequest(testUser.id).headers);

      expect(res.status).toBe(404);
    });

    it("returns 403 for unauthorized user", async () => {
      const otherUser = await setupTestUser();
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set(createAuthenticatedRequest("other-user-id").headers);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/groups/:groupId", () => {
    it("updates group name", async () => {
      const res = await request(app)
        .patch(`/api/groups/${testGroup.id}`)
        .set(createAuthenticatedRequest(testUser.id).headers)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    it("validates budget range", async () => {
      const res = await request(app)
        .patch(`/api/groups/${testGroup.id}`)
        .set(createAuthenticatedRequest(testUser.id).headers)
        .send({ budgetMin: 100, budgetMax: 50 }); // Invalid: min > max

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("budget");
    });

    it("only allows owner to update", async () => {
      const res = await request(app)
        .patch(`/api/groups/${testGroup.id}`)
        .set(createAuthenticatedRequest("other-user-id").headers)
        .send({ name: "Hacked Name" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/groups", () => {
    it("creates a new group with valid data", async () => {
      const groupData = {
        name: "New Test Group",
        emoji: "🎯",
        locationBase: "Oakland, CA",
        budgetMin: 30,
        budgetMax: 80,
        meetingFrequency: "biweekly",
        closenessLevel: 4,
        noveltyPreference: 3,
        members: [
          { name: "Alice", email: "alice@example.com" },
        ],
      };

      const res = await request(app)
        .post("/api/groups")
        .set(createAuthenticatedRequest(testUser.id).headers)
        .send(groupData);

      expect(res.status).toBe(201);
      expect(res.body.group.name).toBe("New Test Group");
      expect(res.body.members).toHaveLength(2); // Owner + Alice
    });

    it("rejects invalid meeting frequency", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set(createAuthenticatedRequest(testUser.id).headers)
        .send({
          name: "Bad Group",
          meetingFrequency: "invalid",
        });

      expect(res.status).toBe(400);
    });
  });
});
```

## Validation Schema Test Template

Create `tests/utils/validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createGroupSchema,
  updateGroupSchema,
  castVoteSchema,
  pauseAutomationSchema,
} from "../../server/validation-schemas";

describe("Validation Schemas", () => {
  describe("createGroupSchema", () => {
    it("accepts valid group data", () => {
      const result = createGroupSchema.safeParse({
        name: "My Group",
        emoji: "🎉",
        locationBase: "San Francisco",
        budgetMin: 20,
        budgetMax: 60,
        meetingFrequency: "weekly",
        closenessLevel: 3,
        noveltyPreference: 3,
        members: [],
      });

      expect(result.success).toBe(true);
    });

    it("rejects empty group name", () => {
      const result = createGroupSchema.safeParse({
        name: "",
        locationBase: "SF",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain("name");
    });

    it("enforces closeness level range (1-5)", () => {
      const tooLow = createGroupSchema.safeParse({
        name: "Test",
        closenessLevel: 0,
      });
      const tooHigh = createGroupSchema.safeParse({
        name: "Test",
        closenessLevel: 6,
      });

      expect(tooLow.success).toBe(false);
      expect(tooHigh.success).toBe(false);
    });
  });

  describe("pauseAutomationSchema", () => {
    it("accepts pause by events count", () => {
      const result = pauseAutomationSchema.safeParse({
        pauseType: "events",
        value: 3,
      });

      expect(result.success).toBe(true);
    });

    it("accepts pause until date", () => {
      const result = pauseAutomationSchema.safeParse({
        pauseType: "until",
        value: "2024-12-31T00:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("rejects mismatched pauseType and value", () => {
      const result = pauseAutomationSchema.safeParse({
        pauseType: "events",
        value: "2024-12-31T00:00:00Z", // Should be number
      });

      expect(result.success).toBe(false);
    });
  });

  describe("castVoteSchema", () => {
    it("accepts valid vote types", () => {
      const yes = castVoteSchema.safeParse({ voteType: "yes" });
      const maybe = castVoteSchema.safeParse({ voteType: "maybe" });
      const no = castVoteSchema.safeParse({ voteType: "no" });

      expect(yes.success).toBe(true);
      expect(maybe.success).toBe(true);
      expect(no.success).toBe(true);
    });

    it("rejects invalid vote type", () => {
      const result = castVoteSchema.safeParse({ voteType: "invalid" });
      expect(result.success).toBe(false);
    });
  });
});
```

## Mutation Hook Test Template

Create `tests/mutations/useGroupMutations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGroupMutations } from "../../client/src/hooks/useGroupMutations";

// Mock apiRequest
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe("useGroupMutations", () => {
  const groupId = "test-group-id";
  let mockApiRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest = require("@/lib/queryClient").apiRequest;
  });

  describe("updateGroupMutation", () => {
    it("calls API with correct parameters", async () => {
      mockApiRequest.mockResolvedValue({ id: groupId, name: "Updated" });

      const { result } = renderHook(
        () => useGroupMutations({ groupId }),
        { wrapper: createWrapper() }
      );

      result.current.updateGroup.mutate({
        updates: { name: "Updated" },
        newMembers: [],
      });

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          "PATCH",
          `/api/groups/${groupId}`,
          { name: "Updated" }
        );
      });
    });

    it("calls callback on success", async () => {
      mockApiRequest.mockResolvedValue({ id: groupId });
      const onSuccess = vi.fn();

      const { result } = renderHook(
        () => useGroupMutations({
          groupId,
          callbacks: { onEditGroupSuccess: onSuccess },
        }),
        { wrapper: createWrapper() }
      );

      result.current.updateGroup.mutate({
        updates: { name: "Test" },
        newMembers: [],
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it("adds new members after group update", async () => {
      mockApiRequest.mockResolvedValue({ id: groupId });

      const { result } = renderHook(
        () => useGroupMutations({ groupId }),
        { wrapper: createWrapper() }
      );

      result.current.updateGroup.mutate({
        updates: { name: "Test" },
        newMembers: [
          { name: "Alice", email: "alice@test.com" },
          { name: "Bob", email: "bob@test.com" },
        ],
      });

      await waitFor(() => {
        // Initial PATCH + 2 POST for members
        expect(mockApiRequest).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe("deleteMemberMutation", () => {
    it("calls DELETE on correct endpoint", async () => {
      mockApiRequest.mockResolvedValue({});
      const memberId = "member-123";

      const { result } = renderHook(
        () => useGroupMutations({ groupId }),
        { wrapper: createWrapper() }
      );

      result.current.deleteMember.mutate(memberId);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          "DELETE",
          `/api/members/${memberId}`,
          {}
        );
      });
    });
  });
});
```

## AI Function Test Template

Create `tests/ai/openai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { categorizeVenue, generateActivitySuggestions } from "../../server/openai";

// Mock OpenAI client
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe("OpenAI Functions", () => {
  let mockCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = require("openai").default().chat.completions.create;
  });

  describe("categorizeVenue", () => {
    it("returns correct category from AI response", async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ category: "meal", confidence: 0.95 }),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      });

      const result = await categorizeVenue("Delfina Restaurant", "Italian restaurant");

      expect(result.category).toBe("meal");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("handles invalid JSON response gracefully", async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: "not valid json" },
        }],
      });

      await expect(categorizeVenue("Test", "Test")).rejects.toThrow();
    });
  });
});
```

## Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/", "tests/"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
```

## Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:api": "vitest run tests/api",
    "test:mutations": "vitest run tests/mutations"
  }
}
```

## Test Writing Checklist

When writing tests, cover these scenarios:

### API Endpoint Tests
- [ ] Happy path with valid data
- [ ] 401 for unauthenticated requests
- [ ] 403 for unauthorized users (wrong owner, non-member)
- [ ] 404 for non-existent resources
- [ ] 400 for invalid request body (validation errors)
- [ ] Edge cases (empty arrays, boundary values)

### Mutation Tests
- [ ] Correct API call parameters
- [ ] Success callback invoked
- [ ] Error callback invoked on failure
- [ ] Query invalidation happens
- [ ] Toast notifications shown

### Validation Schema Tests
- [ ] Valid data passes
- [ ] Each required field rejects when missing
- [ ] Type coercion works correctly
- [ ] Custom refinements validate properly
- [ ] Error messages are user-friendly

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/api/groups.test.ts

# Run tests matching pattern
npm test -- --grep "creates a new group"

# Run with coverage
npm run test:coverage

# Watch mode during development
npm test -- --watch
```
