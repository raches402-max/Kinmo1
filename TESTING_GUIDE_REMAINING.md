# Guide: How to Test Remaining Items

This guide explains how to test the unchecked items from TESTING_CHECKLIST.md

---

## Section 3: Event Creation

### Quick Create (AI-Powered) - Lines 67-72

**How to test:**
1. Open a group that has some venues in Favorites (if none, swipe on a few venues first)
2. On the group detail page, look for one of these buttons:
   - "Schedule Now" button
   - "Plan Event" button
   - "+" button → "Schedule Event with AI"
3. Click it - AI should analyze your favorites and generate venue suggestions
4. You should see 2-3 itinerary options with venues
5. Click on one option to select it
6. Event should be created with those venues

**If you can't find the button:**
- This feature might be in the group detail page under "Actions" or "Quick Actions"
- Try looking in the group's "Events" tab
- Alternative: This might be the "Auto Schedule" feature mentioned in your PRE_LAUNCH.md

---

## Section 4: Venue Discovery & Swiping

### After Swiping - Line 99
**How to test:**
1. After swiping right on 3-4 venues
2. Navigate to the group's "Favorites" or "Library" tab
3. The venues you swiped right on should appear there

### Remove from Favorites - Line 105
**How to test:**
1. Go to Favorites/Library tab
2. Hover over a venue card - look for:
   - A trash icon
   - A heart icon (click to unlike)
   - A three-dot menu with "Remove" option
3. Click it and confirm
4. Venue should disappear from Favorites

### Search Near Dropdown - Line 112
**How to test:**
1. Create or edit an event that already has 1+ venues
2. Open the "Add Venue" or "Edit Venue" dialog
3. Go to the "Find" or "Search" tab
4. Look for a dropdown that says "Search near..." or shows venue names
5. This lets you search for venues near existing ones in your itinerary

**Note:** This is the feature you added recently! It should show venue names from the current itinerary.

---

## Section 5: Event Management

### Reorder Venues - Line 129
**How to test:**
1. Open an event with 2+ venues
2. Click Edit or look for "Reorder" mode
3. Try one of these:
   - **Drag and drop**: Click and hold a venue card, drag up/down
   - **Arrows**: Look for up/down arrow buttons on each venue
   - **Handle**: Look for a "⋮⋮" drag handle icon on the left side
4. Reorder a venue (move it up or down)
5. Save the event
6. Refresh page - order should persist

**If drag-and-drop doesn't work:**
- Make sure you're on desktop (not mobile simulation)
- Try clicking the Edit button first to enter "edit mode"

---

## Section 7: Mobile Tests

### No Horizontal Scrolling - Line 173
**How to test:**
1. Open Chrome DevTools (F12)
2. Toggle device mode (Ctrl+Shift+M or Cmd+Shift+M)
3. Select "iPhone 12 Pro" or "Responsive"
4. Navigate through different pages (dashboard, group detail, event detail)
5. Try scrolling left/right with trackpad or mouse
6. **Pass**: Content fits width, no sideways scrolling
7. **Fail**: Can scroll sideways (content is too wide)

### Pull to Refresh - Line 168
**How to test in DevTools mobile mode:**
1. Open a list page (Events, Groups, etc.)
2. Scroll to the top of the page
3. Click and drag down from the very top
4. **If implemented**: You'll see a loading spinner/animation
5. **If not implemented**: Nothing happens (this is fine - it's optional)

**Note:** This feature is nice-to-have, not required for launch.

---

## Section 8: Error Handling

### Network Errors - Lines 183-185
**How to test:**
1. Open Chrome DevTools → Network tab
2. Find the "Throttling" dropdown (says "No throttling")
3. Select "Offline"
4. Try creating a group or sending an RSVP
5. You should see an error message like:
   - "Network error. Please check your connection."
   - "Something went wrong. Try again."
   - NOT: Blank screen or frozen UI
6. Switch back to "No throttling"
7. Try the action again - should work

### Invalid Input - Lines 188-191
**How to test empty fields:**
1. Open "Create Group" form
2. Leave the name field empty
3. Try to submit
4. Should show validation error: "Group name is required"

**How to test long input:**
1. Copy this text 20 times: "This is a very long group name with lots of characters "
2. Paste into group name field
3. Try to submit
4. Should either:
   - Show error: "Name too long (max 100 characters)"
   - Truncate the input automatically

### Not Found - Lines 194-196
**How to test:**
1. In address bar, go to: `http://localhost:5000/groups/fake-uuid-12345`
2. Should show:
   - "Group not found" message
   - 404 page
   - Or redirect to dashboard with error toast
3. Should NOT: Show blank page or crash

---

## Section 9: Notifications

### Trigger Notification - Line 202
**How to test:**
1. Have two browser windows:
   - Window A: Your main account
   - Window B: Incognito (acting as a guest)
2. In Window A: Create an event and send invite
3. In Window B: Open invite link and submit RSVP
4. In Window A: You should get a notification (may need to refresh)
5. Bell icon should show unread count

---

## Section 10: Quick Sanity Checks

### No Console Errors - Line 213
**How to test:**
1. Open Chrome DevTools → Console tab
2. Clear the console (trash icon)
3. Navigate through the app (create group, create event, RSVP)
4. **Pass**: Only blue/gray info messages or warnings
5. **Fail**: Red error messages appear

**Note:** Some warnings are okay (like React warnings). Red errors are the concern.

### Load Times - Line 214
**How to test:**
1. Open Chrome DevTools → Network tab
2. Check "Disable cache" checkbox
3. Refresh page
4. Look at bottom status bar: "Finish: 2.5s" or similar
5. **Pass**: < 3 seconds
6. **Fail**: > 3 seconds

### No "undefined" in UI - Line 215
**How to test:**
1. Navigate through all pages
2. Look at the actual rendered UI (not console)
3. **Pass**: All text displays properly
4. **Fail**: You see literal text "undefined" or "null" on screen

### Images Load - Line 216
**How to test:**
1. Look at venue cards with photos
2. Look at user avatars
3. **Pass**: Images display
4. **Fail**: See broken image icon (🖼️ with X)

### Dates Display - Line 217
**How to test:**
1. Look at event dates (e.g., "Dec 6, 2025")
2. Look at timestamps ("2 hours ago")
3. **Pass**: Dates show correctly
4. **Fail**: See "Invalid Date" or "NaN"

---

## Tips for Efficient Testing

1. **Use two accounts**: Your main account + incognito for guest flows
2. **Keep DevTools open**: Watch Console and Network tabs
3. **Test in order**: Some tests depend on data from earlier tests
4. **Take screenshots**: Of any issues you find
5. **Note the URL**: When you find a bug, copy the page URL

---

## Items You Can Skip (Nice-to-Have)

These won't block launch:
- ⏭️ Pull-to-refresh (Line 168) - Optional feature
- ⏭️ Very long input testing (Line 190) - Edge case
- ⏭️ All console.log cleanup - Can do post-launch

---

## Quick Test Script (30 minutes)

If short on time, test these critical flows only:

1. ✅ Create group
2. ✅ Create event
3. ✅ Send invite + RSVP as guest
4. ✅ Mobile navigation works
5. ✅ No console errors during above flows

This covers 80% of your core functionality!
