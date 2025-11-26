# Preferences Page Testing Guide

## Test Setup
✅ Server running on: http://localhost:5001
✅ Route: `/preferences`

---

## Test Checklist

### 1. Navigation & Access ✅
- [ ] **Desktop**: Click user avatar → Dropdown menu → "Preferences" link
- [ ] **Mobile**: Click hamburger menu → "Preferences" link
- [ ] **Direct URL**: Navigate to `/preferences` directly
- [ ] Page loads without errors
- [ ] User is authenticated (redirected to login if not)

---

### 2. Global Preferences Tab ✅

#### Profile Section
- [ ] Display name input is visible and editable
- [ ] Bio input is visible and editable
- [ ] Changes trigger "unsaved changes" banner

#### Budget Preferences
- [ ] Budget range slider is visible
- [ ] Min and Max budget inputs work
- [ ] Values update in real-time
- [ ] Range displays correctly (e.g., "$0 - $100 per person")

#### Activity Preferences
- [ ] All 5 activity categories display:
  - 🍽️ Meals
  - ☕ Cafes
  - 🍷 Drinks
  - 🍰 Dessert
  - 🎭 Experiences
- [ ] Click to toggle categories on/off
- [ ] Selected categories show highlighted border
- [ ] Deselected categories show muted border

#### Notifications
- [ ] Email notifications toggle switch works
- [ ] Changes are reflected in UI

---

### 3. Availability Tab ✅

- [ ] Availability grid is visible
- [ ] **Desktop**: Shows full 7-day grid (Mon-Sun) with morning/afternoon/evening
- [ ] **Mobile**: Shows day selector tabs with time slots for selected day
- [ ] Click time slots to toggle availability
- [ ] Changes trigger "unsaved changes" banner

---

### 4. AI Insights Tab ✅

#### Auto-Learned Constraints
- [ ] Section displays "No auto-learned constraints yet" if empty
- [ ] If constraints exist, they display with:
  - Type badge (e.g., "schedule_conflict", "budget_concern")
  - Confidence percentage badge
  - Clear description
  - Source information (group name)
  - ✅ Confirm button (green)
  - ❌ Reject button (red)
- [ ] Clicking confirm/reject triggers API call
- [ ] Toast notification shows success/error
- [ ] List updates after action

---

### 5. **NEW: Per-Group Budget Overrides** 🎉

#### Per-Group Section
- [ ] Section only appears if user has groups
- [ ] Lists all user groups
- [ ] Each group card shows:
  - Group name
  - Current budget status (override or global)
  - Toggle switch to enable/disable override

#### Toggle Override ON
- [ ] Switch activates override mode
- [ ] Budget slider appears
- [ ] Default values match global budget
- [ ] Can adjust min/max independently
- [ ] "Save" button appears
- [ ] Click "Save" to persist changes
- [ ] Toast notification confirms save

#### Toggle Override OFF
- [ ] Switch deactivates override mode
- [ ] Slider disappears
- [ ] Shows "Using global: $X - $Y"
- [ ] Immediately sends API request to clear override
- [ ] Toast notification confirms

---

### 6. Save Functionality ✅

#### Unsaved Changes Banner
- [ ] Banner appears when any field is edited
- [ ] Banner shows "You have unsaved changes"
- [ ] "Save Changes" button in banner
- [ ] Clicking save persists all changes

#### Save Button
- [ ] Appears at bottom of page on mobile
- [ ] Appears in banner on desktop
- [ ] Shows loading state while saving
- [ ] Shows success toast after save
- [ ] "Unsaved changes" banner disappears after save
- [ ] Error toast appears if save fails

---

### 7. API Integration ✅

#### Endpoints Called
- [ ] `GET /api/user/profile` - Loads user profile data
- [ ] `GET /api/user/preferences` - Loads global preferences
- [ ] `PATCH /api/user/preferences` - Saves global preferences
- [ ] `GET /api/user/preferences/groups/:groupId` - Loads per-group overrides
- [ ] `PATCH /api/user/preferences/groups/:groupId` - Saves per-group overrides
- [ ] `GET /api/user/auto-learned-constraints` - Loads AI insights
- [ ] `POST /api/user/auto-learned-constraints` - Confirms/rejects constraints

---

### 8. Mobile Responsiveness ✅

- [ ] All sections display correctly on mobile (< 768px)
- [ ] Availability grid switches to mobile mode
- [ ] Buttons are thumb-friendly
- [ ] No horizontal scrolling
- [ ] Save button is sticky at bottom

---

### 9. Error Handling ✅

- [ ] Network errors show toast notification
- [ ] Failed saves show error message
- [ ] Failed API calls don't crash the page
- [ ] Loading states show during async operations

---

### 10. Integration with Other Features ✅

#### Favorite Venues Section
- [ ] Favorite venues manager appears if user has member ID
- [ ] Shows venues the user has favorited
- [ ] Can add/remove venues

---

## Testing the New Per-Group Budget Override

### Test Scenario 1: Enable Override
1. Navigate to `/preferences`
2. Scroll to "Per-Group Budget Overrides" section
3. Find a group (e.g., "Friday Night Crew")
4. Toggle the switch ON
5. **Expected**: Slider appears with global budget values
6. Adjust slider to different values (e.g., $40-$80)
7. Click "Save"
8. **Expected**: Toast shows "Group preferences saved"
9. Refresh page
10. **Expected**: Override persists with saved values

### Test Scenario 2: Disable Override
1. Find a group with override enabled
2. Toggle the switch OFF
3. **Expected**:
   - Slider disappears
   - Toast shows "Group preferences saved"
   - Shows "Using global: $X - $Y"
4. Refresh page
5. **Expected**: Override is cleared

### Test Scenario 3: Multiple Groups
1. Enable overrides for 3 different groups
2. Set different budget ranges for each
3. Save all
4. Refresh page
5. **Expected**: All overrides persist correctly

---

## Quick Test Commands

### Check Server Logs
```bash
# Filter for errors
curl http://localhost:5001/api/user/preferences 2>&1 | grep -i error

# Check if preferences endpoint responds
curl -I http://localhost:5001/api/user/preferences
```

### Check for Console Errors
Open browser console (F12) and look for:
- ❌ Red errors
- ⚠️ Yellow warnings
- ✅ Network requests completing successfully

---

## Expected Results

### ✅ All Tests Pass
- No console errors
- All features work as described
- Data persists across page reloads
- Mobile and desktop views work correctly
- Toast notifications appear for all actions

### 🎉 Success Criteria
- User can manage all preferences from one page
- Per-group budget overrides work independently
- AI insights are visible and actionable
- Navigation is intuitive
- No data loss on page refresh

---

## Known Limitations

1. **Auto-learned constraints** only appear after user has RSVP'd to events
2. **Favorite venues** section only shows if user has joined a group
3. **Per-group overrides** only appear if user has created/joined groups

---

**Test Date**: 2025-11-24
**Version**: 1.0
**Feature**: Member Preferences Management with Per-Group Budget Overrides
