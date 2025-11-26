# RSVP & Member Onboarding Flow Specification

## Vision
Create a seamless, low-friction system where members can participate in group events with just their name, while incentivizing account creation through progressive feature unlocks.

## Key Principles
1. **Zero-friction participation**: Members can RSVP with just a name (no email/account required)
2. **Event-by-event invites**: Members without accounts receive individual event invites
3. **Account as dashboard unlock**: Creating an account reveals all group events in one place
4. **Clear member/guest distinction**: Members are recurring, guests are one-time
5. **Organizer control**: Share links allow organizers to add members to the recurring list

---

## User Types & Access Levels

### 1. Members (Unlinked)
**Definition**: Person on the group's recurring member list who hasn't created an account yet

**Access**:
- ✅ Receives individual invites to each event
- ✅ Can RSVP with just their name
- ✅ Email is optional
- ✅ Can provide feedback/constraints for the specific event they're invited to
- ✅ Their feedback influences whether THAT event gets rescheduled
- ❌ Cannot see group dashboard with all events
- ❌ Cannot see other upcoming events
- ❌ Cannot set broad preferences that affect ALL future events
- ❌ Cannot vote on future venue options or set standing availability rules

**Example**: Sarah is on the Taco Tuesday group. She gets invited to Tuesday's event and can say "Can't make Thursday, but Friday works!" which might trigger a reschedule. But she can't set a rule like "never schedule on Thursdays" without creating an account.

**Entry Point**: `/event/{eventId}/invite?member={memberId}`

---

### 2. Members (Linked with Account)
**Definition**: Member who has created an account and linked it to their membership

**Access**:
- ✅ Full group dashboard showing ALL events
- ✅ Can see past and upcoming events in one place
- ✅ Can provide feedback/constraints for specific events (same as unlinked)
- ✅ PLUS: Can set broad preferences that affect ALL future scheduling
- ✅ Can set standing availability rules (e.g., "Never schedule on Mondays")
- ✅ Can vote on venue options for future events
- ✅ Can influence scheduling through patterns and preferences
- ✅ Still receives individual event invites (redundant but friendly)

**Entry Point**: `/groups/{groupId}` (dashboard)

---

### 3. Guests (One-time)
**Definition**: Person invited to a single event who is NOT on the recurring member list

**Access**:
- ✅ Can RSVP to the specific event they were invited to
- ✅ Name and email entry
- ❌ NOT added to recurring member list
- ❌ Will NOT be invited to future events automatically
- ❌ Cannot see group information

**Example**: James is invited to one Taco Tuesday as a guest. He won't be invited to future Taco Tuesdays unless explicitly invited again.

**Entry Point**: `/event/{eventId}/guest?guestToken={token}`

---

## Key Distinction: Event-Specific vs Broad Influence

This is a critical design principle:

### Event-Specific Influence (No Account Needed)
**Members (unlinked)** can provide feedback that influences the specific event they're invited to:
- "Can't make Thursday, but Friday works"
- "7pm is too late, could we do 6pm?"
- "Love the restaurant choice, but not a fan of the bar"

This feedback goes to the organizer who can decide whether to reschedule/adjust THAT event.

**Why**: Sarah is a recurring member. Even without an account, she deserves a voice in whether this week's event works for her.

### Broad Influence (Account Required)
**Members (linked)** can set preferences that influence ALL future scheduling automatically:
- Standing rules: "Never schedule on Mondays"
- Dietary restrictions: "I'm vegetarian"
- Time preferences: "I prefer evening events"
- Venue voting: Choose between options for next month's event

**Why**: These preferences affect the entire group's future. Accounts ensure persistence, prevent abuse, and maintain data integrity.

### The Unlock
Creating an account transforms:
- **"I can't make THIS Thursday"** → **"Never schedule on Thursdays"**
- **"Could we do 6pm THIS time?"** → **"I prefer 6-7pm time slot"**
- **Seeing one event** → **Seeing all past and future events**

---

## Entry Points & User Flows

### Flow 1A: Member Receives Event Invite via Email (Has Email on File)

**URL**: `/event/{eventId}/invite?member={memberId}`

**Experience**:
1. Member receives email notification with personalized link
2. Clicks link, sees event details (date, time, venues, itinerary)
3. Name is pre-filled (recognized from member record)
4. Can RSVP with options:
   - **Going** - "I'll be there!"
   - **Maybe** - Optional: "What would make this work better for you?" (time/venue feedback)
   - **Can't Make It** - "What would work better?" (alternative times/days)
5. If providing feedback, simple form appears:
   - "This time doesn't work because..." (optional text)
   - "Would these times work instead?" (day/time picker)
6. Success: "You're all set for Taco Tuesday! Your feedback has been shared with the organizer."
7. **CTA**: "Create an account to see all upcoming {groupName} events in one place" → Links to account creation

**Technical**:
- URL contains `memberId` (not sensitive data)
- Backend validates member exists and is part of this group
- No authentication required for RSVP
- Store RSVP in database linked to memberId
- Store event-specific feedback/constraints
- Flag event for organizer review if multiple members provide conflicting feedback

---

### Flow 1B: Member Receives Event Invite via Group Thread (No Email on File)

**URL**: `/event/{eventId}/invite` (generic link shared by organizer)

**Experience**:
1. Organizer shares link in group chat/thread
2. Member clicks link, sees event details
3. Sees dropdown: "Who are you?" with list of group member names
4. Selects their name from list
5. Can RSVP with options (same as Flow 1A):
   - **Going** - "I'll be there!"
   - **Maybe** - Optional: "What would make this work better for you?" (time/venue feedback)
   - **Can't Make It** - "What would work better?" (alternative times/days)
6. If providing feedback, same simple form appears
7. Success: "You're all set for Taco Tuesday! Your feedback has been shared with the organizer."
8. **CTA**: "Add your email to get automatic invites and help reduce work for your organizer" → Links to profile/settings

**Technical**:
- Generic URL without memberId
- Backend loads all members for this group/event
- Frontend shows member selection UI
- After selection, same RSVP flow as 1A (including feedback capability)
- Optional: Store selection in localStorage to skip next time
- Store event-specific feedback/constraints
- Encourage email addition through CTA

---

### Flow 2: Member Creates Account & Unlocks Dashboard

**URL**: `/claim-member?token={claimToken}` or `/auth/replit` with prompt

**Experience**:
1. Member decides to create account (from event invite CTA or organizer prompt)
2. Clicks "Create Account" button
3. Replit OAuth authentication
4. Backend links Replit userId to existing member record
5. **Unlock moment**: Dashboard reveals showing ALL group events
6. Success: "Welcome to {groupName}! Here are all your upcoming events."

**Technical**:
- Use Replit OAuth for authentication
- Link `user.id` to `members.userId` in database
- Member now has access to `/groups/{groupId}` dashboard
- All past RSVPs are preserved and visible
- Can now vote, set availability, and influence scheduling

---

### Flow 3: Guest Receives One-Time Event Invite

**URL**: `/event/{eventId}/guest?guestToken={guestToken}`

**Experience**:
1. Guest clicks link from invite
2. Sees event details
3. Must enter name (and optionally email)
4. Can RSVP (Going / Maybe / Can't Make It)
5. Success: "You're all set! See you there."
6. **NO CTA** to join group (they're not a member)

**Technical**:
- `guestToken` is unique per guest per event
- Creates temporary guest record linked to this event only
- Guest does NOT become a member
- Guest will NOT receive future event invites automatically
- Organizer can separately add them as a member via share link if desired

---

### Flow 4: Organizer Adds Members via Share Link

**URL**: `/join/{shareableLink}`

**Experience**:
1. Organizer shares link in group chat/thread
2. Person clicks link
3. Sees: "Join {groupName}!"
4. Enters name (required)
5. Email field with helpful messaging:
   - Label: "Email (Optional)"
   - Helper text: "Help reduce the manual lift for your organizer by providing your email address, and we'll let you know when the next {groupName} event is directly—so your organizer doesn't have to drop it into the group thread every time."
6. Can optionally set preferences/availability
7. Success: "You're now a member of {groupName}! You'll be invited to upcoming events."
8. **CTA**: "Create an account to see all events in one dashboard"

**Technical**:
- Creates member record with `name`, optional `email`, `groupId`
- Member is added to recurring invite list
- `userId` is null (unlinked account)
- If email provided: Member receives automatic email invites
- If email NOT provided: Organizer must share invite links in thread
- Can later claim membership with account

---

## Data Model Changes

### Members Table (Current → Proposed)

```typescript
// CURRENT
members {
  id: string
  groupId: string
  name: string
  email: string | null          // ✅ Already nullable
  userId: string | null         // ✅ Already nullable (for unlinked members)
  ...
}

// PROPOSED (minimal changes needed)
members {
  id: string
  groupId: string
  name: string
  email: string | null          // Keep nullable
  userId: string | null         // Keep nullable - null = unlinked
  accountStatus: 'unlinked' | 'linked'  // NEW: Track account link status
  invitePreference: 'individual' | 'dashboard' | 'both'  // NEW: How they want invites
  ...
}
```

### Event Invites Table (NEW)

```typescript
eventInvites {
  id: string
  eventId: string
  memberId: string              // Link to member record
  status: 'pending' | 'going' | 'maybe' | 'not_going'
  respondedAt: timestamp | null
  invitedAt: timestamp
  reminderSentAt: timestamp | null
}
```

### Guest RSVPs Table (Current → Keep)

```typescript
// Already exists, no changes needed
guestRsvps {
  id: string
  eventId: string
  name: string
  email: string | null
  status: 'going' | 'maybe' | 'not_going'
  guestToken: string
  ...
}
```

---

## Implementation Phases

### Phase 1: Event-by-Event Invite System
**Goal**: Members can RSVP to individual events without accounts

**Tasks**:
1. Create `eventInvites` table
2. Build `/event/{eventId}/invite?member={memberId}` page
3. Add RSVP submission endpoint (no auth required)
4. Update event notification system to generate invite links
5. Add "Create Account" CTA on event invite page

**Success Criteria**:
- Member can click invite link and RSVP with one click
- Name is pre-filled from member record
- RSVP is saved without authentication
- Event details are displayed clearly

---

### Phase 2: Account Dashboard Unlock
**Goal**: Creating account reveals all group events in one place

**Tasks**:
1. Add account creation flow from event invite page
2. Link Replit OAuth to existing member record
3. Update dashboard to show all events (past + future)
4. Migrate existing single-event RSVPs to member record
5. Add "Dashboard Unlocked" celebration moment

**Success Criteria**:
- Member can create account from event invite
- Dashboard shows all group events immediately after linking
- Past RSVPs are visible in account
- Clear visual distinction between pre-account and post-account state

---

### Phase 3: Guest vs Member Distinction
**Goal**: Separate one-time guests from recurring members

**Tasks**:
1. Create `/event/{eventId}/guest?guestToken={token}` page
2. Update guest invite generation to use new URL pattern
3. Ensure guests are NOT added to member list
4. Update organizer invite UI to distinguish "Add Member" vs "Invite Guest"
5. Remove any automatic member promotion from guest RSVPs

**Success Criteria**:
- Guests can RSVP to single event
- Guests do NOT receive future invites
- Organizer can clearly choose between member/guest when inviting
- No confusion between member and guest flows

---

### Phase 4: Share Link for Member Addition
**Goal**: Organizers can easily add members via shareable link

**Tasks**:
1. Update `/join/{shareableLink}` to add member to recurring list
2. Remove forced account creation from join flow
3. Add "Create Account Later" option
4. Update member addition confirmation messaging
5. Add organizer management UI for viewing/removing members

**Success Criteria**:
- Person can join as member with just name
- Member is added to recurring invite list
- No forced account creation
- Clear CTA to create account for dashboard access

---

### Phase 5: Cleanup & Consolidation
**Goal**: Remove old fragmented flows

**Tasks**:
1. Deprecate old invite.tsx patterns
2. Consolidate claim-member.tsx into new account linking flow
3. Remove redundant token types
4. Update all notification systems to use new invite URLs
5. Migration script for existing members to new pattern

**Success Criteria**:
- Single source of truth for each user type
- No duplicate flows
- Clear URL patterns
- All existing members migrated successfully

---

## URL Structure Summary

| User Type | Access Level | URL Pattern | Auth Required | Distribution Method |
|-----------|-------------|-------------|---------------|---------------------|
| Member (with email) | Single event RSVP | `/event/{eventId}/invite?member={memberId}` | ❌ No | Automatic email |
| Member (no email) | Single event RSVP | `/event/{eventId}/invite` | ❌ No | Organizer shares in thread |
| Member (linked) | Full dashboard | `/groups/{groupId}` | ✅ Yes | Login |
| Guest | Single event RSVP | `/event/{eventId}/guest?guestToken={token}` | ❌ No | Organizer sends invite |
| New Member Join | Add to recurring list | `/join/{shareableLink}` | ❌ No | Organizer shares link |
| Account Creation | Link to member | `/claim-member?token={claimToken}` | ✅ Yes (OAuth) | CTA from event RSVP |

---

## Organizer Experience

### Event Creation & Invite Distribution

When an organizer creates/approves an event, the system handles invite distribution intelligently:

**Dashboard View**:
```
✅ Taco Tuesday - March 12 created!

📨 Invite Status:
✅ 8 members will receive automatic emails
📋 3 members need manual invite (share link below)

[📋 Copy Invite Link for Thread]

Members needing manual invite:
• Mike (no email on file)
• Jessica (no email on file)
• Alex (no email on file)

💡 Tip: Encourage members to add their email to reduce your workload!
```

**Copy Link Action**:
- Copies generic invite link: `/event/{eventId}/invite`
- Shows suggested message to paste in group thread
- Tracks which members have RSVP'd to show organizer progress

**Member Management**:
```
Members List:

Sarah Johnson          ✉️ sarah@email.com       ✅ Email invites
Mike Chen              📱 No email on file      📋 Manual invites needed
Jessica Rodriguez      ✉️ jessica@email.com     ✅ Email invites
Alex Kim               📱 No email on file      📋 Manual invites needed

[Bulk Actions ▼]
- Send email reminder to all
- Copy thread invite link
- Export member list
```

### Progressive Workload Reduction

As more members add emails, organizer workload decreases:

**New Group (0-20% emails)**:
- "You'll need to share invite links in your group thread for most events"
- Encourage members to add emails during onboarding

**Growing Group (20-60% emails)**:
- "Half your members get automatic invites! Encourage others to add emails."
- Show progress bar toward full automation

**Mature Group (60%+ emails)**:
- "Most invites are automatic! Just share the link for a few members."
- Celebrate the reduced workload

---

## Key UX Moments

### 1. The Unlock Moment
When a member creates an account, the dashboard should dramatically reveal all events:

```
Before Account (Event RSVP Page):
"Taco Tuesday - March 12"
[Single event view]

RSVP: Going ✓
"Can't make it? Let us know what would work better"
[Feedback for this event only]

---

After Account (Dashboard):
"Welcome to Taco Tuesday Group! 🎉"
[Grid of all past and future events]

• March 5 - Attended ✓
• March 12 - Going ✓
• March 19 - Coming up
• March 26 - Coming up
• April 2 - Coming up

[Set Your Preferences]
• Time preferences: Evening (6-8pm)
• Days to avoid: Mondays, Fridays
• Dietary restrictions: Vegetarian
• Favorite venue types: Tacos, Italian

"You've been going to 8 events over the past 3 months!"
```

---

### 2. The Invitation Email/Notification

**For Members WITH Email**:
```
Subject: You're invited to Taco Tuesday - March 12!

Hey Sarah,

Taco Tuesday is happening on March 12 at 7:00 PM!

📍 Tacos El Gordo → Craft Beer Bar → Ice Cream Shop

[RSVP: Going] [Maybe] [Can't Make It]

---
Create an account to see all upcoming Taco Tuesday events in one place →
```

**For Organizer to Share (Members WITHOUT Email)**:
```
Organizer Dashboard shows:
"📋 Copy invite link to share in group thread"
[Copy Link: https://app.com/event/xyz123/invite]

Suggested message:
"Hey everyone! Taco Tuesday is happening March 12 at 7PM. Click to RSVP: [link]"
```

**For Guests**:
```
Subject: You're invited to Taco Tuesday - March 12!

Hey James,

You've been invited to join us for Taco Tuesday on March 12!

📍 Tacos El Gordo → Craft Beer Bar → Ice Cream Shop

[RSVP Here]

---
(No account CTA - they're a one-time guest)
```

---

## Migration Strategy

### Existing Members
1. Keep all existing member records
2. Add `accountStatus` field (default: 'linked' if userId exists, 'unlinked' if null)
3. Continue supporting current dashboard access for linked members
4. Gradually migrate to new invite system as events are created

### Existing Guests
1. Keep existing guest RSVP records
2. No migration needed (they remain one-time)
3. Future invites use new URL patterns

---

## Email Strategy: Optional But Encouraged

### The Approach
Email is **optional** but framed as helping reduce organizer workload.

**Member Join Messaging**:
> "Help reduce the manual lift for your organizer by providing your email address, and we'll let you know when the next {GroupName} event is directly—so your organizer doesn't have to drop it into the group thread every time."

### Distribution Strategy

**Members WITH Email**:
- Receive automatic email notifications with personalized invite link
- Link format: `/event/{eventId}/invite?member={memberId}`
- Zero organizer effort

**Members WITHOUT Email**:
- Organizer shares event invite link in group thread
- Link format: `/event/{eventId}/invite` (generic, asks member to select their name)
- Requires manual organizer action for each event

### Progressive Adoption
- **Early stages**: Organizer shares most links in thread (few emails collected)
- **Middle stages**: Mix of automatic emails + thread sharing
- **Mature groups**: Most members have emails, minimal organizer work

### Benefits
1. **No friction barrier**: Can join and participate without email
2. **Clear incentive**: "Help your organizer" + convenience
3. **Organic adoption**: Members see others getting auto-invites, motivated to add email
4. **Flexibility**: Works for both casual and committed groups

---

## Open Questions to Validate

1. **Name Selection UI**: For thread-shared links, how do members identify themselves?
   - **Proposed**: Dropdown/list of group members, select your name to RSVP

2. **Name Claiming**: What if two people have the same name in the group?
   - **Proposed**: Organizer adds members with unique identifiers (e.g., "Sarah M." vs "Sarah K."), member ID in URL is unique

3. **Privacy**: Should members without accounts be able to see other attendees?
   - **Proposed**: Yes, show other RSVPs for social proof and coordination

4. **RSVP Changes**: Can unlinked members change their RSVP after submission?
   - **Proposed**: Yes, store a temporary token in localStorage for 30 days

5. **Account Incentive**: What features are locked behind accounts besides dashboard?
   - **Answer**:
     - Full dashboard showing all events (past + future)
     - Setting BROAD preferences (e.g., "Never schedule on Mondays")
     - Standing availability rules that affect all future events
     - Voting on venue options for future events
     - Event history and analytics
   - **Not locked**: Event-specific feedback for the event they're invited to

---

## Success Metrics

- **Activation**: % of members who create accounts after seeing dashboard CTA
- **Friction**: Time from invite click to RSVP submission
- **Clarity**: % of users who understand member vs guest distinction
- **Engagement**: RSVP rate for members (with vs without accounts)
- **Retention**: Do unlinked members eventually create accounts?

---

## Next Steps

1. **Review & Validate**: Confirm this spec matches your vision
2. **Technical Design**: Database schema changes, API endpoints
3. **UI Mockups**: Visual design for each flow
4. **Phase 1 Implementation**: Start with event-by-event invites
5. **User Testing**: Test with real group before full rollout
