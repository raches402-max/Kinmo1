# Manual E2E Testing Checklist

**Purpose:** Verify all critical user flows work before launch
**Time estimate:** 2-3 hours
**Last updated:** 2025-12-03

---

## How to Use This Checklist

1. Start the app: `npm run dev` or use the Replit Run button
2. Open in browser (preferably Chrome with DevTools open)
3. Work through each section in order
4. **Mark items as you test:**
   - `[x]` = ✅ Works
   - `[-]` = ❌ Broken (add details to Issues table below)
   - `[ ]` = Not tested yet
5. For mobile tests, use Chrome DevTools device mode (Cmd+Shift+M / Ctrl+Shift+M)

---

## 1. Authentication Flow

### Sign In
- [x] Click "Sign in with Replit" on landing page
- [x] Redirects to Replit OAuth
- [x] After auth, redirects back to dashboard
- [x] User name/avatar appears in header
- [x] Session persists after page refresh

### Sign Out
- [x] Click profile menu → Sign Out
- [x] Redirects to landing page
- [x] Cannot access /dashboard directly (redirects to login)

---

## 2. Group Management

### Create Group
- [x] Click "Create Group" button on dashboard
- [x] Fill in group name (required)
- [x] Set location (e.g., "Oakland, CA")
- [x ] Set budget range
- [x] Set preferred days/times
- [x] Submit → Group is created
- [x] Redirects to group detail page
- [x] Group appears in "My Groups" tab

### Edit Group
- [x] Open a group → Click settings/edit
- [x] Change group name → Save → Name updates
- [x] Change location → Save → Location updates
- [x] Change emoji → Save → Emoji updates

### Invite Member
- [x] Open a group → Click "Invite"
- [x] Enter name and email
- [x] Submit → Member appears in members list (as pending)
- [ x] Check: Invite email sent? (check spam folder) 

---

## 3. Event Creation

### Quick Create (AI-Powered)
- [x] Open a group with some Favorites
- [ ] Click "Schedule Now" or equivalent
- [ ] AI generates itinerary options
- [ ] Options show venues with details
- [ ] Can select an option
- [ ] Event is created with selected venues

### Manual Create
- [x ] Click "Create Event" (+ button on mobile)
- [x ] Select a group
- [x] Set event name
- [ x] Set date/time
- [x ] Add venues manually (search or from library)
- [ x] Save → Event appears in Events list

### Standalone Event (New Feature)
- [ x] On dashboard, click "Create Event" dropdown
- [x ] Select "Standalone Event"
- [ x] Enter event name
- [x ] Select contacts from multiple groups
- [ ] Create → Event appears in Events list
- [ ] Event shows "Standalone" indicator

---

## 4. Venue Discovery & Swiping

### Discover Venues
- [x] Open a group → Go to swipe/discover section
- [ x] Venue cards appear with photos
- [x] Swipe right (or click like) → Adds to Favorites
- [ x] Swipe left (or click skip) → Moves to next card
- [ ] After swiping several, check Favorites has new venues

### Venue Library/Favorites
- [ x] Open group → Go to Favorites/Library tab
- [x ] Shows venues that were liked
- [ x] Can view venue details
- [ ] Can remove venue from Favorites

### Search Venues
- [ x] Go to Edit Venue dialog → Find tab
- [ x] Search for a venue (e.g., "coffee")
- [ x] Results appear
- [x ] Can select a result
- [ ] "Search near" dropdown appears if itinerary has venues

---

## 5. Event Management

### View Event Details
- [ x] Click on an event
- [ x] Shows event name, date, time
- [ x] Shows venue itinerary with addresses
- [ x] Shows member list / RSVPs
- [ x] Shows map or venue locations

### Edit Event
- [ x] Open event → Click Edit (pencil icon)
- [ x] Can change event name
- [ x] Can change date/time
- [ ] Can reorder venues (drag and drop)
- [ x] Save → Changes persist

### RSVP Flow (as organizer)
- [ x] Open event you created
- [ x] Set your RSVP (Yes/Maybe/No)
- [ x] RSVP status updates immediately

---

## 6. Invite & RSVP Flow (as Guest)

### Send Invite
- [ x] Open an event
- [ x] Click "Send Invites" or similar
- [ x] Confirm sending
- [ x] "Invite sent" status appears on event

### Receive & Respond (use incognito or second browser)
- [ x] Open invite link from email
- [x ] Page shows event details without login required
- [ x] Select RSVP response (Yes/Maybe/No)
- [ x] Submit → Confirmation shown
- [ x] Back on main account: RSVP appears on event

---

## 7. Mobile-Specific Tests

Open Chrome DevTools → Toggle device mode → Select "iPhone 12 Pro" or similar

### Navigation
- [ ] Bottom nav bar appears (Events, Groups, Places, Profile)
- [ ] Tapping each icon navigates correctly
- [ ] + button (center) opens event creation modal
- [ ] + button works on ALL pages (not just dashboard)

### Touch Interactions
- [x ] Swipe cards respond to touch/drag
- [ ] Pull-to-refresh works on lists (if implemented)
- [ x] Modals/dialogs fit on screen
- [x ] Can scroll long content

### Responsive Layout
- [ ] No horizontal scrolling
- [ x] Text is readable (not too small)
- [ ] Buttons are tappable (adequate touch targets)
- [ x] Forms are usable on mobile keyboard

---

## 8. Error Handling

### Network Errors
- [ ] Disable network in DevTools → Try an action
- [ ] Shows error message (not blank screen)
- [ ] Re-enable network → Can retry/recover

### Invalid Input
- [ ] Try submitting empty required fields
- [ ] Shows validation errors
- [ ] Try very long input (1000+ chars)
- [ ] Handles gracefully

### Not Found
- [ ] Go to /groups/fake-id-12345
- [ ] Shows 404 or "not found" message
- [ ] Can navigate back to safety

---

## 9. Notifications

- [ ] Perform an action that triggers notification (e.g., RSVP)
- [ x] Bell icon shows unread count
- [ x] Click bell → Notification panel opens
- [x ] Shows recent notifications
- [ x] Click notification → Marks as read
- [ x] "Mark all read" works

---

## 10. Quick Sanity Checks

- [ ] Console has no red errors during normal use
- [ ] Pages load in < 3 seconds
- [ ] No "undefined" or "null" text visible in UI
- [ ] Images load (no broken image icons)
- [ ] Dates display correctly (not "Invalid Date")

---

## Issues Found

| # | Description | Severity | Page/Flow |
|---|-------------|----------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Severity levels:** 🔴 Blocker, 🟡 Major, 🟢 Minor

---

## Sign-Off

- [ ] All critical flows tested
- [ ] No 🔴 blockers found
- [ ] Ready for Phase 3 (Email setup)

**Tested by:** _______________
**Date:** _______________
