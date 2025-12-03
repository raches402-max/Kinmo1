import { Home, Settings, Compass, Calendar, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabValue = "home" | "preferences" | "activities" | "build" | "feedback";

interface NavItem {
  value: TabValue;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { value: "home", label: "Home", icon: Home },
  { value: "preferences", label: "Group", icon: Settings },
  { value: "activities", label: "Explore", icon: Compass },
  { value: "build", label: "Create", icon: Calendar },
  { value: "feedback", label: "Insights", icon: TrendingUp },
];

interface GroupDetailMobileNavProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

export function GroupDetailMobileNav({ activeTab, onTabChange }: GroupDetailMobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 sm:hidden safe-area-pb">
      <div className="flex justify-around py-1">
        {navItems.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onTabChange(value)}
            className={cn(
              // Improved touch target: min 44x44px
              "flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1.5 rounded-lg transition-colors",
              activeTab === value
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground active:text-foreground"
            )}
            aria-current={activeTab === value ? "page" : undefined}
            aria-label={label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-2xs mt-0.5 font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
