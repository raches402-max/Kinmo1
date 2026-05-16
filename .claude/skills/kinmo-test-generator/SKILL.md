---
name: kinmo-test-generator
description: Generate Vitest tests for Kinmo. Use when adding tests to ensure code reliability and prevent regressions. Covers pure functions, storage (DB-touching), and validation schemas — the patterns that actually run today. Documents what's blocked (API routes, AI, email, components) and why.
---

# Kinmo Test Generator

Generates tests that **actually run** in this repo today. If something isn't documented here, it's because the infrastructure to test it doesn't exist yet — see "Blocked categories" at the bottom for what would unblock each.

Honest principle: a smaller skill that produces working tests beats a large skill that produces aspirational broken ones.

---

## Quick start

```bash
npm test              # run once
npm run test:watch    # re-run on save
```

Vitest config: `vitest.config.ts`. Setup file: `tests/setup.ts` (loads `.env`).

**File conventions:**
- **Pure functions** → colocate as `*.test.ts` next to the source file (e.g., `server/trust-state.test.ts` next to `server/trust-state.ts`).
- **DB-touching** → put in `tests/*.test.ts` (e.g., `tests/storage-trust-state.test.ts`).
- **Avoid** putting tests under `client/` — vitest is configured to skip that path.

Tests run **serially** (`fileParallelism: false`) so DB-touching tests don't trample each other against the shared dev DB.

---

## Pattern 1: Pure-function tests (highest ROI)

Use for any module with no DB / network / time / randomness — helpers, validators, transformers, calculators.

**Where these live in Kinmo:**
- `server/trust-state.ts` — already tested
- `server/lib/safe-error.ts`
- `server/google-places.ts` → `calculateNameSimilarity`, URL parsers (the pure parts)
- `client/src/lib/event-utils.ts` — event dedup/merge logic
- `client/src/lib/utils.ts` — `cn`, timezone formatters
- `client/src/lib/distance.ts` — geo math
- `client/src/lib/aiReadinessCheck.ts` — readiness predicate logic

**Template** (mirrors `server/trust-state.test.ts`):

```typescript
import { describe, it, expect } from "vitest";
import { functionUnderTest } from "./module-name";

describe("functionUnderTest", () => {
  it("handles the common case", () => {
    expect(functionUnderTest("input")).toBe("expected");
  });

  it("handles the edge case (empty input)", () => {
    expect(functionUnderTest("")).toBeNull();
  });

  it("handles the edge case (boundary)", () => {
    // boundary tests catch the bugs that production exposes
  });
});
```

**Coverage checklist for a pure function:**
- Happy path (typical input)
- Empty / null / undefined inputs
- Boundary values (0, max, negative if numeric)
- Each branch in the function body

---

## Pattern 2: Storage / DB-touching tests

Use for any function in `server/storage.ts` or anywhere else that reads/writes the DB.

**The proven pattern** (mirrors `tests/storage-trust-state.test.ts`):

1. In `beforeAll`, find an anchor row (an existing group/itinerary/user) — read-only on the anchor.
2. In each test, create rows attached to the anchor, push their IDs into a tracking array.
3. In `afterEach`, delete all tracked rows. The DB ends clean.
4. Run against the real dev DB via `DATABASE_URL` (loaded by `tests/setup.ts`).

**Template:**

```typescript
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { itineraries, itineraryItems } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

let anchorItineraryId: string;
const createdIds: string[] = [];

beforeAll(async () => {
  const [it] = await db.select().from(itineraries).orderBy(desc(itineraries.createdAt)).limit(1);
  if (!it) throw new Error("No itinerary in DB; can't run.");
  anchorItineraryId = it.id;
});

afterEach(async () => {
  for (const id of createdIds) {
    await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
  }
  createdIds.length = 0;
});

describe("storage.someFunction", () => {
  it("creates a row with expected fields", async () => {
    const item = await storage.someFunction(/* args */);
    createdIds.push(item.id);
    expect(item.someField).toBe("expected");
  });
});
```

**Anchor strategy:**
- For tests that need a `groupId`: anchor on the most recent group (`groups`).
- For tests that need an `itineraryId`: anchor on the most recent itinerary.
- For tests that need a `userId`: anchor on a known dev user (or look one up by email).
- If the table is empty, the test should `throw` with a clear message — don't try to seed from scratch.

**Coverage checklist for storage functions:**
- Happy path returns expected shape.
- Side effects fire correctly (see "Side-effect warnings" below).
- Trust state lands as expected (see "Trust state requirement" below).
- For update functions: identifying-field changes flip `trustState`; non-identifying fields don't.

---

## Pattern 3: Validation schema tests

Use for any Zod schema in `shared/schema.ts` (`insertGroupSchema`, `insertVotingEventSchema`, etc.) or route-specific schemas.

**Template:**

```typescript
import { describe, it, expect } from "vitest";
import { insertGroupSchema } from "@shared/schema";

describe("insertGroupSchema", () => {
  it("accepts valid input", () => {
    const result = insertGroupSchema.safeParse({
      // minimum valid shape
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required field X", () => {
    const result = insertGroupSchema.safeParse({ /* missing X */ });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("X");
    }
  });

  it("enforces refinement / range", () => {
    // e.g., budgetMin < budgetMax, or enum constraints
  });
});
```

**Coverage checklist for schemas:**
- Valid minimum shape passes.
- Each required field rejects when missing.
- Each enum / range / refinement rejects when violated.
- Unexpected extra fields are stripped (or rejected, depending on schema config).

---

## Pitfalls and conventions you must respect

These are non-obvious and have bitten the codebase before. Tests that ignore them will pass while creating bad data.

### Trust state requirement

Venue-bearing tables (`activities`, `voting_events`, `itinerary_items`) carry `trustState` / `trustSource` / `verifiedAt` columns. **Direct `db.insert` calls must include trust fields** or the row lands as `unknown`, which is a smell signal.

Use the storage helpers (which set trust correctly), or import from `server/trust-state.ts`:

```typescript
import { trustFieldsForSource } from "../server/trust-state";

await db.insert(itineraryItems).values({
  // ... regular fields ...
  ...trustFieldsForSource("manual"),
});
```

The smoke-test pattern at the bottom of `tests/storage-trust-state.test.ts` asserts the `unknown` default works — that's the safety net you don't want to break.

### Side-effect warnings (storage functions that do more than they look like)

| Function | Side effect |
|---|---|
| `storage.createVotingEvent` | Auto-upvotes for the creator (inserts a `votes` row) |
| `storage.createGroup` | Auto-creates organizer + invited members (`members` rows) |
| `storage.createItinerary` | Auto-creates RSVP rows for all group members |
| Updates touching `name`/`address`/`placeId` on venue rows | Flip `trustState` to `needs_review` |

When testing, either assert the side effects fired correctly, or clean them up too.

### Soft deletes

Groups use `deletedAt` (not a hard delete). Many storage queries filter `isNull(deletedAt)`. If a test fixture group "disappears," check whether it was soft-deleted, not removed.

### Tests run against the real dev DB

Not a separate test DB. Be careful with destructive operations — only delete rows your test created, never wipe tables. The cleanup pattern above is the safe default.

---

## Blocked categories (and what would unblock each)

These are *deliberately* not in this skill — the infrastructure to test them doesn't exist yet. Don't generate tests for these without first doing the unblock work, or you'll write code that doesn't run.

### API route tests via HTTP

**Blocked by:** Two things.
1. `server/index.ts` doesn't export the express `app` instance (it's wrapped in an IIFE that immediately calls `listen`). `supertest` needs `app`.
2. There's no auth bypass for tests. Real auth uses Passport sessions via `googleAuth.ts`, so you can't just set a header.

**To unblock:** (a) refactor `server/index.ts` to export `app` (or extract `registerRoutes` into a callable that returns `app`); (b) add a TEST_MODE-gated middleware that injects `req.user` from a header or env var. Then `supertest` works.

**Until then:** test routes by exercising their storage functions directly. You lose coverage of the auth/validation/middleware path but get the business logic.

### AI call tests (OpenAI / Anthropic)

**Blocked by:** No mock infrastructure for `openai` or `@anthropic-ai/sdk`. Calling the real APIs in tests is slow and costs money per run. Mock setup is non-trivial because tool use, streaming, and structured outputs each need different mock shapes.

**To unblock:** create `server/ai-mocks.ts` with `vi.mock`-ready stubs for the most common shapes (text completion, JSON output, tool use). Then tests can `vi.mock('openai', () => ...)` consistently.

**Until then:** test the *callers* of AI functions only via dependency injection or by extracting pure helpers (e.g., the prompt-building function vs. the API call).

### Email tests (Resend)

**Blocked by:** `email-service.ts` calls `resend.emails.send()` directly with no injection point. Tests would either spam real emails or need a global `vi.mock('resend')`.

**To unblock:** wrap the Resend client in a thin module that's easy to mock, OR add an `EMAIL_ENABLED=false` env flag that no-ops sends in test environments.

### Cron / background job tests

**Blocked by:** `reminder-scheduler.ts` and `auto-scheduler.ts` start on server boot via `setInterval`. They have no test mode and no way to advance time deterministically.

**To unblock:** decouple the "what should fire now" calculation from the timer that fires it. Test the calculation pure-function-style; leave the timer plumbing untested.

### React component tests

**Blocked by:** `@testing-library/react`, `@testing-library/user-event`, and `jsdom` (or `happy-dom`) are not installed. `vitest.config.ts` excludes `client/**` from test discovery. There's no test wrapper for `QueryClientProvider` / `ThemeProvider` / `Toaster`.

**To unblock:** install the three packages, add a `client/test-utils.tsx` with provider wrappers, change vitest config to include `client/**` and use `jsdom` environment. Then point at the 452 existing `data-testid` markers and start writing.

**Realistic note:** for a solo dev, **Playwright e2e tests** would likely give better return than per-component unit tests, given how modal-heavy and provider-heavy the UI is. The 452 data-testids are already the hardest part of e2e setup. Consider this path before investing in component-test infrastructure.

### React mutation tests

**Blocked by:** Same React testing infrastructure as above, plus you need to mock `apiRequest` from `client/src/lib/queryClient.ts`. Doable once components are testable.

**Until then:** test the server side of each mutation (the storage function it ultimately calls). That covers the actual logic; the mutation itself is just a wrapper around `apiRequest`.

---

## When to ignore this skill

- One-off scripts that run manually — don't bother with tests.
- Throwaway prototypes — wait until the code stabilizes.
- Code that's purely about wiring two things together (e.g., a route handler that's literally three lines calling one storage function and returning the result) — the storage function's tests cover it.

Tests are for code that's load-bearing or has subtle behavior. Spending time on the rest is friction without payoff.
