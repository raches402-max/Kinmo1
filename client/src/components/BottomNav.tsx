/**
 * Mobile Bottom Navigation
 * Provides easy thumb-friendly navigation on mobile devices
 * Hidden on desktop (md and above)
 */

import { useLocation } from "wouter";
import { Home, Users, Calendar, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    icon: Home,
    path: "/",
  },
  {
    label: "Groups",
    icon: Users,
    path: "/?tab=my-groups",
  },
  {
    label: "Events",
    icon: Calendar,
    path: "/?tab=my-events",
  },
  {
    label: "Alerts",
    icon: Bell,
    path: "/notifications",
  },
  {
    label: "Profile",
    icon: User,
    path: "/profile",
  },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();

  // Fetch unread notification count for badge
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  const isActive = (path: string) => {
    // Handle tab-based paths (e.g., "/?tab=my-groups")
    if (path.includes("?tab=")) {
      const tabParam = new URLSearchParams(path.split("?")[1]).get("tab");
      const currentTab = new URLSearchParams(window.location.search).get("tab");
      return location === "/" && currentTab === tabParam;
    }
    // Home is active when on "/" with no tab param or with my-events tab (default)
    if (path === "/") {
      const currentTab = new URLSearchParams(window.location.search).get("tab");
      return location === "/" && (!currentTab || currentTab === "my-events");
    }
    return location.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const showBadge = item.path === "/notifications" && unreadCount > 0;

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {showBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px] font-semibold"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-xs transition-all",
                  active ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
