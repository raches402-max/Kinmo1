# Kinmo Development Session Notes

## Session: December 12, 2025

### What We Did Today

**1. Fixed RSVP Bugs for Rachel L. Account**
- Fixed Zod validation schema for `additionalAttendees` in `server/validation-schemas.ts`
- Fixed `requireMemberAccess()` middleware ordering in `server/authorization.ts` (check claim token before getUserId)
- Fixed `getDisplayName()` in `rsvp-itinerary.tsx` to use `inviteInfo.name` when available
- Fixed RSVP lookup to check by `user_id` if no result by `member_id` (for organizers)

**2. Fixed Address Truncation on Mobile**
- Fixed 4 files where addresses were being cut off with `truncate` class
- Applied `break-words whitespace-normal leading-relaxed` pattern to:
  - `ItineraryTimeline.tsx`
  - `VenueCard.tsx`
  - `event-details.tsx`
  - `WhereTimeline.tsx`

**3. Fixed Copy Issues on RSVP Pages**
- Grammar: "never miss a event" → "never miss an event"
- Updated CTA copy to be friendlier: "Find your groups" instead of tactical language
- Updated in both `event-invite.tsx` and `rsvp-itinerary.tsx`

**4. Comprehensive User Flow Audit**
- Launched 3 parallel exploration agents to audit all user flows
- Identified 4 critical issues, 14 high priority UX issues, and many polish opportunities
- Created detailed audit document at `/home/runner/.claude/plans/glittery-sniffing-lagoon.md`

**5. Fixed 3 Critical Issues from Audit**

| Issue | File | Fix |
|-------|------|-----|
| Auth endpoint inconsistency | `rsvp-itinerary.tsx`, `link-member-account.tsx` | Standardized to `/api/login?returnTo=...` |
| localStorage race condition | `claim-member.tsx` | Moved `removeItem` to `onSuccess` callback |
| Link error still redirects | `link-member-account.tsx` | Added error state with retry button |

**Deferred**: Event cancellation feature (requires backend + frontend + email notifications)

---

### Key Findings from User Flow Audit

**Critical Issues:**
1. ~~Auth endpoint inconsistency~~ ✅ Fixed
2. ~~localStorage race condition~~ ✅ Fixed
3. ~~Link error still redirects~~ ✅ Fixed
4. No event cancellation (deferred - larger feature)

**High Priority UX Issues to Address:**
- RSVP: Locked identity has no "Not you?" escape
- RSVP: Create Account CTA appears before completing form
- Event creation: No back button from mobile builder
- Group creation: Empty member rows allowed
- Account linking: Guest registration is dead end

**Missing Features Identified:**
- Event editing after send
- Draft event management
- Standalone event email notifications
- Granular email preferences
- Co-organizer roles
- Past event history page

---

### Files Modified Today

- `server/validation-schemas.ts` - RSVP additionalAttendees schema
- `server/authorization.ts` - requireMemberAccess middleware order
- `server/routes.ts` - RSVP lookup by userId fallback
- `client/src/pages/rsvp-itinerary.tsx` - Display name fix, auth endpoint, copy updates
- `client/src/pages/event-invite.tsx` - Copy updates
- `client/src/pages/claim-member.tsx` - localStorage race condition fix
- `client/src/pages/link-member-account.tsx` - Error handling with retry
- `client/src/components/ItineraryTimeline.tsx` - Address wrapping
- `client/src/components/venue-discovery/VenueCard.tsx` - Address wrapping
- `client/src/pages/event-details.tsx` - Address wrapping
- `client/src/components/event-detail/WhereTimeline.tsx` - Address wrapping

---

## Session: December 10, 2025

### What We Did Today

**Implemented Phase 2 of the AI Event Assistant (Option C: Hybrid Approach)**

The AI chat agent can now observe and influence the auto-scheduler pipeline, acting as a "human-in-the-loop" interface.

#### New Tools Added to `server/agent-mcp-server.ts`

**Observation Tools (read-only):**
1. `getUpcomingEvents` - Shows scheduled and pending auto-scheduled events for a group
2. `getEventRsvpStatus` - Shows who has RSVP'd, who hasn't, with response breakdown
3. `getMemberAvailability` - Gets weekly availability patterns and finds best time slots
4. `analyzeSchedulingConflicts` - Checks if a proposed date/time works for members

**Influence Tools (write actions):**
5. `suggestEventTimes` - Calls the existing AI time picker to get 3-5 suggested times
6. `rescheduleEvent` - Changes the event date/time
7. `sendRsvpReminder` - Returns list of members to remind (actual email sending pending)

#### Updated System Prompt (`server/ai-agent-chat.ts`)

The agent now knows about scheduling capabilities and has rules for:
- Checking availability before suggesting times
- Proactively checking RSVP status and offering reminders
- Explaining timing decisions with reasoning

#### Testing Results

All Phase 2 tools tested successfully:

| Tool | Result | Sample Output |
|------|--------|---------------|
| `getUpcomingEvents` | ✅ | Found 2 scheduled + 4 pending auto events |
| `getEventRsvpStatus` | ✅ | 0 yes, 1 maybe, 2 not responded |
| `getMemberAvailability` | ✅ | 2 members, neither has availability set |
| `analyzeSchedulingConflicts` | ✅ | Saturday 7pm works for everyone |

#### Blocker Found

The AI chat doesn't work yet because `ANTHROPIC_API_KEY` is not set in Replit secrets. Added a clearer error message to the route handler.

---

### Recommended Next Steps

#### 1. **Add ANTHROPIC_API_KEY** (Required to test)
- Go to Replit Secrets (padlock icon)
- Add `ANTHROPIC_API_KEY` = your key from console.anthropic.com
- Restart server and test the full chat flow

#### 2. **Test End-to-End Flow** (High priority)
Once the API key is set, try conversations like:
- "What's happening with our next event?"
- "Who hasn't RSVP'd?"
- "Can we move it to Saturday?"

#### 3. **Improve Chat Placement** (Medium priority)
The chat is buried in EditVenueDialog's AI tab. Better locations:
- Floating button on group page
- Integrated into event detail view
- Group-level "Ask Kinmo" entry point

#### 4. **Wire Up Actual RSVP Reminder Sending** (Medium priority)
`sendRsvpReminder` currently returns "who would be reminded" but doesn't send emails. Could connect to existing `email-service.ts`.

#### 5. **Add Proactive Notifications** (Future)
The "planner friend" mental model shines when the agent reaches out first:
"Hey, 2 people haven't RSVP'd and the deadline is tomorrow - want me to nudge them?"

---

### Files Modified Today

- `server/agent-mcp-server.ts` - Added 7 new Phase 2 tools (~400 lines)
- `server/ai-agent-chat.ts` - Updated system prompt with scheduling capabilities
- `server/routes.ts` - Added ANTHROPIC_API_KEY check with clear error message

### Architecture Note

**The Hybrid Approach (Option C):**
- Auto-scheduler handles **proactive coordination** (background, cron-driven)
- Chat agent handles **responsive problem-solving** (foreground, user-initiated)
- Chat agent is now a **human-in-the-loop interface** to the automation
- User stays informed and in control via conversational adjustments

---

*Last updated: December 10, 2025*
