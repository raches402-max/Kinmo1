# Implementation Plan: Navigation Improvements

## Overview
Fix navigation issues and add breadcrumbs to improve app flow.

## Batch 1: Fix Broken Navigation Links (Quick Wins)

### Task 1.1: Fix BottomNav.tsx
**File:** `client/src/components/BottomNav.tsx`

**Current Issue:**
- `/groups` route doesn't exist (404)
- `/events` is a separate page duplicating dashboard functionality

**Changes:**
```tsx
// Line 25-33: Update navItems paths
const navItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Groups", icon: Users, path: "/?tab=my-groups" },  // was "/groups"
  { label: "Events", icon: Calendar, path: "/?tab=my-events" },  // was "/events"
  { label: "Alerts", icon: Bell, path: "/notifications" },
  { label: "Profile", icon: User, path: "/profile" },
];
```

**Also update isActive function to handle query params:**
```tsx
const isActive = (path: string) => {
  if (path === "/") {
    return location === "/" && !window.location.search;
  }
  if (path.includes("?tab=")) {
    const tabParam = new URLSearchParams(path.split("?")[1]).get("tab");
    const currentTab = new URLSearchParams(window.location.search).get("tab");
    return location === "/" && currentTab === tabParam;
  }
  return location.startsWith(path);
};
```

**Test:** Click Groups/Events in bottom nav → should switch dashboard tabs

---

### Task 1.2: Fix Header.tsx Mobile Drawer
**File:** `client/src/components/Header.tsx`

**Current Issue:**
- Line 167: Links to `/dashboard` which redirects to `/`
- Line 180: Links to `/member-dashboard` which doesn't exist

**Changes:**
```tsx
// Line 167-178: Change /dashboard to /
<Link href="/">
  <a onClick={() => setMobileMenuOpen(false)}>
    <Button variant="ghost" className="w-full justify-start h-12 text-base">
      <Home className="mr-3 h-5 w-5" />
      Dashboard
    </Button>
  </a>
</Link>

// Line 180-191: Change /member-dashboard to /?tab=my-events
<Link href="/?tab=my-events">
  <a onClick={() => setMobileMenuOpen(false)}>
    <Button variant="ghost" className="w-full justify-start h-12 text-base">
      <Calendar className="mr-3 h-5 w-5" />
      My Events
    </Button>
  </a>
</Link>
```

**Test:** Open mobile menu → click My Events → should go to dashboard with events tab

---

### Task 1.3: Update Dashboard.tsx Tab Handling
**File:** `client/src/pages/dashboard.tsx`

**Current:** Uses `defaultValue="my-events"` on Tabs component

**Changes:**
```tsx
// Add at top of component (around line 226):
const [searchParams] = useSearchParams();
const initialTab = searchParams.get("tab") || "my-events";

// Line 1208: Change Tabs component
<Tabs defaultValue={initialTab} className="w-full">
```

**Also add import:**
```tsx
import { useSearchParams } from "wouter"; // or react-router-dom equivalent
```

**Note:** wouter doesn't have useSearchParams built-in. We'll use window.location.search or add a hook.

**Test:** Navigate to `/?tab=my-groups` → should open groups tab

---

## Batch 2: Add Desktop Navigation to Header

### Task 2.1: Add Nav Links to Header
**File:** `client/src/components/Header.tsx`

**Current:** Center section is empty (`<div className="flex-1" />`)

**Changes:** Add visible nav links for desktop (hidden on mobile):

```tsx
// Replace line 72-73 with:
{/* Center: Desktop Navigation */}
<div className="hidden md:flex items-center gap-1 flex-1 justify-center">
  <Link href="/?tab=my-events">
    <a className={cn(
      "px-4 py-2 rounded-md text-sm font-medium transition-colors",
      "text-white/70 hover:text-white hover:bg-white/10"
    )}>
      Events
    </a>
  </Link>
  <Link href="/?tab=my-groups">
    <a className={cn(
      "px-4 py-2 rounded-md text-sm font-medium transition-colors",
      "text-white/70 hover:text-white hover:bg-white/10"
    )}>
      Groups
    </a>
  </Link>
</div>
```

**Test:** On desktop, see Events/Groups links in header → click to switch tabs

---

## Batch 3: Create Breadcrumbs Component

### Task 3.1: Create Breadcrumbs.tsx
**File:** `client/src/components/Breadcrumbs.tsx` (new file)

```tsx
import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
    >
      <Link href="/">
        <a className="hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </a>
      </Link>

      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href ? (
            <Link href={item.href}>
              <a className="hover:text-foreground transition-colors">
                {item.label}
              </a>
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

---

## Batch 4: Add Breadcrumbs to Pages

### Task 4.1: Add to group-detail.tsx
**File:** `client/src/pages/group-detail.tsx`

```tsx
// Add import
import { Breadcrumbs } from "@/components/Breadcrumbs";

// Add after Header component, before main content (around line where ArrowLeft button is):
<Breadcrumbs
  items={[
    { label: group?.name || "Group", href: undefined }
  ]}
  className="mb-4"
/>
```

**Replace or complement the existing back arrow navigation.**

---

### Task 4.2: Add to event-details.tsx
**File:** `client/src/pages/event-details.tsx`

```tsx
// Add import
import { Breadcrumbs } from "@/components/Breadcrumbs";

// Add breadcrumbs showing: Dashboard > Group Name > Event Name
<Breadcrumbs
  items={[
    { label: event?.groupName || "Group", href: `/group/${event?.groupId}` },
    { label: event?.name || "Event" }
  ]}
  className="mb-4"
/>
```

---

### Task 4.3: Add to learning-insights.tsx
**File:** `client/src/pages/learning-insights.tsx`

```tsx
// Add import
import { Breadcrumbs } from "@/components/Breadcrumbs";

// Add breadcrumbs showing: Dashboard > Group Name > Insights
<Breadcrumbs
  items={[
    { label: group?.name || "Group", href: `/group/${groupId}` },
    { label: "Insights" }
  ]}
  className="mb-4"
/>
```

---

## Testing Checklist

- [ ] Bottom nav: Home → Dashboard (no tab param)
- [ ] Bottom nav: Groups → Dashboard with groups tab
- [ ] Bottom nav: Events → Dashboard with events tab
- [ ] Mobile drawer: Dashboard → `/`
- [ ] Mobile drawer: My Events → Dashboard with events tab
- [ ] Desktop header: Events/Groups links visible and working
- [ ] Group detail: Breadcrumb shows "Dashboard > Group Name"
- [ ] Event details: Breadcrumb shows "Dashboard > Group > Event"
- [ ] Learning insights: Breadcrumb shows "Dashboard > Group > Insights"
- [ ] All breadcrumb links navigate correctly

---

## Files Changed Summary

| File | Type | Changes |
|------|------|---------|
| `client/src/components/BottomNav.tsx` | Edit | Fix paths, update isActive |
| `client/src/components/Header.tsx` | Edit | Fix mobile links, add desktop nav |
| `client/src/pages/dashboard.tsx` | Edit | Accept tab query param |
| `client/src/components/Breadcrumbs.tsx` | New | Create breadcrumb component |
| `client/src/pages/group-detail.tsx` | Edit | Add breadcrumbs |
| `client/src/pages/event-details.tsx` | Edit | Add breadcrumbs |
| `client/src/pages/learning-insights.tsx` | Edit | Add breadcrumbs |

---

## Out of Scope (Future Work)
- Active state highlighting for desktop nav links
- Route renaming (`/groups/:id/learning` → `/group/:id/learning`)
- Removing duplicate `/events` route entirely
