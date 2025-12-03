/**
 * Mobile Bottom Navigation - Quick Action Center Design
 * Features a prominent floating "+" button for creating events
 * Hidden on desktop (md and above)
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, Users, Plus, Heart, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  position: "left" | "right";
}

const navItems: NavItem[] = [
  {
    label: "Events",
    icon: CalendarDays,
    path: "/",
    position: "left",
  },
  {
    label: "Groups",
    icon: Users,
    path: "/?tab=my-groups",
    position: "left",
  },
  {
    label: "Places",
    icon: Heart,
    path: "/places",
    position: "right",
  },
  {
    label: "Profile",
    icon: User,
    path: "/profile",
    position: "right",
  },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const [fabOpen, setFabOpen] = useState(false);

  const isActive = (path: string) => {
    // Handle tab-based paths (e.g., "/?tab=my-groups")
    if (path.includes("?tab=")) {
      const tabParam = new URLSearchParams(path.split("?")[1]).get("tab");
      const currentTab = new URLSearchParams(window.location.search).get("tab");
      return location === "/" && currentTab === tabParam;
    }
    // Events is active when on "/" with no tab param or with my-events tab (default)
    if (path === "/") {
      const currentTab = new URLSearchParams(window.location.search).get("tab");
      return location === "/" && (!currentTab || currentTab === "my-events");
    }
    return location.startsWith(path);
  };

  const leftItems = navItems.filter((item) => item.position === "left");
  const rightItems = navItems.filter((item) => item.position === "right");

  const handleFabClick = () => {
    // Navigate to dashboard with create param to trigger event creation modal
    // This ensures the modal opens regardless of which page you're on
    if (location === "/" || location.startsWith("/?")) {
      // Already on dashboard - just dispatch the event
      window.dispatchEvent(new CustomEvent("kinmo:create-event"));
    } else {
      // Navigate to dashboard with query param to trigger modal
      setLocation("/?action=create-event");
    }
    setFabOpen(false);
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        onClick={() => setLocation(item.path)}
        className={cn(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
          active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
      >
        <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
        <span
          className={cn(
            "text-xs transition-all",
            active ? "font-semibold" : "font-medium"
          )}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Backdrop when FAB menu is open */}
      {fabOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50 safe-area-inset-bottom"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center h-16 px-2">
          {/* Left side items */}
          <div className="flex flex-1 items-center justify-evenly">
            {leftItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </div>

          {/* Center FAB */}
          <div className="flex items-center justify-center w-16 relative">
            <button
              onClick={handleFabClick}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-6 border-4 border-background transition-all duration-200",
                fabOpen
                  ? "bg-muted rotate-45"
                  : "bg-gradient-to-br from-primary to-primary/80 hover:shadow-xl hover:scale-105 active:scale-95"
              )}
              aria-label={fabOpen ? "Close menu" : "Create new event"}
            >
              {fabOpen ? (
                <X className="h-6 w-6 text-foreground stroke-[2.5]" />
              ) : (
                <Plus className="h-6 w-6 text-primary-foreground stroke-[2.5]" />
              )}
            </button>
          </div>

          {/* Right side items */}
          <div className="flex flex-1 items-center justify-evenly">
            {rightItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
