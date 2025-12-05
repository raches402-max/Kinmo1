/**
 * Prototype: Group Details Desktop - Subtle Refined Style
 *
 * Aesthetic: Warm, elegant, and inviting (matching event-details-desktop)
 * - Golden accent borders and glows
 * - Warm beige backgrounds (hsl 35, 40%, 95%)
 * - Smooth cubic-bezier transitions
 * - Subtle gradient overlays
 * - Collapsible cards with expand/collapse animation
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft,
  ChevronDown,
  Settings,
  Info,
  Users,
  Layers,
  Zap,
  Calendar,
  MapPin,
  Plus,
  UserPlus,
  Search,
  Home,
  Compass,
  Hammer,
} from "lucide-react";

// ============================================================================
// MOCK DATA
// ============================================================================

type MemberRole = "owner" | "host" | "member";

const mockGroup = {
  id: "1",
  name: "Friday Night Foodies",
  emoji: "🍕",
  locationBase: "San Francisco, CA",
  budgetValue: 2, // 1-4 scale ($, $$, $$$, $$$$)
  frequencyNumber: 2,
  frequencyUnit: "month" as const,
};

const mockMembers = [
  { id: "1", name: "Jane Doe", email: "jane@example.com", initials: "JD", role: "owner" as MemberRole },
  { id: "2", name: "Mike Smith", email: "mike@example.com", initials: "MS", role: "host" as MemberRole },
  { id: "3", name: "Sarah Johnson", email: "sarah@example.com", initials: "SJ", role: "member" as MemberRole },
  { id: "4", name: "Alex Chen", email: "alex@example.com", initials: "AC", role: "member" as MemberRole },
  { id: "5", name: "Emily Davis", email: "emily@example.com", initials: "ED", role: "member" as MemberRole },
  { id: "6", name: "Chris Wilson", email: "chris@example.com", initials: "CW", role: "member" as MemberRole },
];

const mockCategories = [
  { id: "meal", emoji: "🍽️", name: "Meals", enabled: true },
  { id: "cafe", emoji: "☕", name: "Cafes", enabled: true },
  { id: "drinks", emoji: "🍺", name: "Drinks", enabled: true },
  { id: "dessert", emoji: "🍰", name: "Dessert", enabled: false },
  { id: "experiences", emoji: "🎭", name: "Experiences", enabled: true },
];

const mockAutomation = {
  discoverSpots: true,
  draftPlans: true,
  autoSchedule: false,
};

const mockStats = {
  eventsThisYear: 12,
  activeMembers: 6,
  venuesExplored: 24,
};

const mockNextEvent = {
  title: "Holiday Dinner",
  month: "Dec",
  day: 14,
  daysUntil: 9,
};

// ============================================================================
// TABS DATA
// ============================================================================

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "build", label: "Build", icon: Hammer },
];

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

/**
 * RefinedTabs - Warm styled tabs matching the mockup
 */
function RefinedTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-[hsl(35,25%,93%)] rounded-xl max-w-[600px] mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
              "text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-white text-[hsl(25,30%,14%)] shadow-sm"
                : "text-[hsl(25,15%,45%)] hover:text-[hsl(25,30%,14%)]"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * RefinedCollapsibleCard - Card with expand/collapse functionality
 */
function RefinedCollapsibleCard({
  icon: Icon,
  title,
  badge,
  children,
  defaultExpanded = false,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "rounded-2xl border bg-white overflow-hidden",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isExpanded
          ? "border-[hsl(44,70%,75%)] shadow-[0_4px_16px_rgba(242,201,76,0.12)]"
          : "border-[hsl(32,20%,88%)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      )}
    >
      {/* Header - always visible, clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full relative px-5 py-4 flex items-center justify-between",
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isExpanded ? "bg-[hsl(35,40%,95%)]" : "bg-white hover:bg-[hsl(38,50%,99%)]"
        )}
        style={
          isExpanded
            ? {
                background:
                  "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              isExpanded
                ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] shadow-[0_2px_8px_rgba(242,201,76,0.3)] scale-105"
                : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-[13px] font-bold uppercase tracking-[0.08em]",
              "transition-colors duration-300",
              isExpanded ? "text-[hsl(25,30%,14%)]" : "text-[hsl(25,15%,45%)]"
            )}
          >
            {title}
          </span>
          {badge && (
            <span className="text-xs text-[hsl(25,15%,45%)] font-normal normal-case tracking-normal">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-[hsl(25,15%,45%)] transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Content - animated expand/collapse */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-5 py-5 border-t border-[hsl(32,20%,88%)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * RefinedMemberCard - Member list item with role badge
 */
function RefinedMemberCard({ member }: { member: (typeof mockMembers)[0] }) {
  const roleColors = {
    owner: "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
    host: "bg-[hsl(110,40%,90%)] text-[hsl(110,40%,30%)]",
    member: "",
  };

  const avatarColors = [
    "bg-[hsl(44,87%,63%)]",
    "bg-[hsl(200,70%,60%)]",
    "bg-[hsl(280,60%,60%)]",
    "bg-[hsl(350,60%,60%)]",
    "bg-[hsl(160,50%,50%)]",
    "bg-[hsl(30,70%,55%)]",
  ];

  const colorIndex = parseInt(member.id) % avatarColors.length;

  return (
    <div className="flex items-center gap-3 p-3 bg-[hsl(38,50%,98%)] rounded-xl">
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className={cn("text-sm font-semibold text-white", avatarColors[colorIndex])}
        >
          {member.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-[hsl(25,30%,14%)]">{member.name}</div>
        <div className="text-xs text-[hsl(25,15%,45%)] truncate">{member.email}</div>
      </div>
      {member.role !== "member" && (
        <Badge className={cn("text-[11px] px-2 py-0.5 font-medium", roleColors[member.role])}>
          {member.role === "owner" ? "Owner" : "Host"}
        </Badge>
      )}
    </div>
  );
}

/**
 * RefinedCategoryPill - Toggleable category chip
 */
function RefinedCategoryPill({
  category,
  onToggle,
}: {
  category: (typeof mockCategories)[0];
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
        "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        category.enabled
          ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]"
          : "bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]",
        "hover:scale-[1.02] active:scale-[0.98]"
      )}
    >
      <span>{category.emoji}</span>
      <span>{category.name}</span>
    </button>
  );
}

/**
 * RefinedToggleRow - Automation toggle with label and description
 */
function RefinedToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[hsl(35,25%,90%)] text-[hsl(25,15%,45%)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-[hsl(25,30%,14%)]">{label}</div>
        <div className="text-xs text-[hsl(25,15%,45%)]">{description}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[hsl(44,87%,63%)]"
      />
    </div>
  );
}

/**
 * RefinedStatCard - Quick stat display for sidebar
 */
function RefinedStatCard({
  icon: Icon,
  value,
  label,
  iconBg = "bg-[hsl(44,87%,63%)]",
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[hsl(38,50%,98%)] rounded-xl">
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg text-[hsl(25,30%,14%)]",
          iconBg
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-bold text-[hsl(25,30%,14%)]">{value}</div>
        <div className="text-xs text-[hsl(25,15%,45%)]">{label}</div>
      </div>
    </div>
  );
}

/**
 * RefinedSlider - Budget range slider with warm styling
 */
function RefinedSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const labels = ["$", "$$", "$$$", "$$$$"];
  const percentage = ((value - 1) / 3) * 100;

  return (
    <div className="p-4 bg-[hsl(38,50%,98%)] rounded-xl">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold text-[hsl(25,30%,14%)]">Budget Range</span>
        <span className="text-sm font-bold text-[hsl(25,30%,14%)]">{labels[value - 1]}</span>
      </div>
      <div className="relative h-2 bg-[hsl(35,25%,90%)] rounded-full">
        <div
          className="absolute h-full bg-[hsl(44,87%,63%)] rounded-full transition-all duration-200"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={1}
          max={4}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[hsl(44,87%,63%)] rounded-full shadow-md transition-all duration-200"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-[hsl(25,15%,45%)]">
        <span>$</span>
        <span>$$$$</span>
      </div>
    </div>
  );
}

/**
 * RefinedActionButton - Warm-styled action button with icon
 */
function RefinedActionButton({
  icon: Icon,
  children,
  variant = "secondary",
  onClick,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
        "text-sm font-semibold transition-all duration-200",
        "active:scale-[0.98]",
        variant === "primary"
          ? "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(44,87%,55%)] shadow-[0_4px_12px_rgba(242,201,76,0.3)]"
          : "bg-[hsl(35,25%,93%)] text-[hsl(25,30%,14%)] hover:bg-[hsl(35,25%,88%)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/**
 * SidebarCard - Sidebar card wrapper
 */
function SidebarCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[hsl(32,20%,88%)] rounded-2xl p-5 mb-4">
      {title && (
        <div className="text-sm font-bold uppercase tracking-[0.05em] text-[hsl(25,15%,45%)] mb-4">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PrototypeGroupDetailsDesktop() {
  const [activeTab, setActiveTab] = useState("settings");
  const [group] = useState(mockGroup);
  const [members] = useState(mockMembers);
  const [categories, setCategories] = useState(mockCategories);
  const [automation, setAutomation] = useState(mockAutomation);
  const [budget, setBudget] = useState(group.budgetValue);

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, enabled: !cat.enabled } : cat))
    );
  };

  const enabledCategoriesCount = categories.filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen bg-[hsl(38,50%,98%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[hsl(32,20%,88%)]">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,93%)] hover:text-[hsl(25,30%,14%)] transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{group.emoji}</span>
              <span className="text-lg font-semibold text-[hsl(25,30%,14%)]">{group.name}</span>
            </div>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(25,15%,45%)] hover:bg-[hsl(35,25%,93%)] hover:text-[hsl(25,30%,14%)] transition-all">
            <Settings className="h-4 w-4" />
            Settings
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-[hsl(25,15%,45%)] mb-4">
          <a href="#" className="hover:text-[hsl(25,30%,14%)] transition-colors">
            Groups
          </a>
          <span className="mx-2">/</span>
          <span>{group.name}</span>
        </div>

        {/* Tabs */}
        <RefinedTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Main Content Column */}
          <div className="space-y-5">
            {/* Basic Info Card */}
            <RefinedCollapsibleCard
              icon={Info}
              title="Basic Info"
              badge="Group details"
              defaultExpanded={true}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                    Group Name
                  </label>
                  <Input
                    defaultValue={group.name}
                    className="bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                    Location
                  </label>
                  <Input
                    defaultValue={group.locationBase}
                    className="bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-1.5">
                    Meeting Frequency
                  </label>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      defaultValue={group.frequencyNumber}
                      className="w-20 bg-[hsl(38,50%,98%)] border-[hsl(32,20%,88%)] focus:border-[hsl(44,87%,63%)] focus:ring-[hsl(44,87%,63%)]/20"
                    />
                    <select className="flex-1 px-3 py-2 rounded-lg bg-[hsl(38,50%,98%)] border border-[hsl(32,20%,88%)] text-sm text-[hsl(25,30%,14%)] focus:border-[hsl(44,87%,63%)] focus:outline-none focus:ring-2 focus:ring-[hsl(44,87%,63%)]/20">
                      <option value="week">weeks</option>
                      <option value="month" selected>
                        times per month
                      </option>
                      <option value="year">months</option>
                    </select>
                  </div>
                </div>
                <RefinedSlider value={budget} onChange={setBudget} />
              </div>
            </RefinedCollapsibleCard>

            {/* Members Card */}
            <RefinedCollapsibleCard
              icon={Users}
              title="Members"
              badge={`${members.length} members`}
              defaultExpanded={true}
            >
              <div className="space-y-3">
                {members.map((member) => (
                  <RefinedMemberCard key={member.id} member={member} />
                ))}
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(32,20%,88%)] bg-white text-[hsl(25,30%,14%)] text-sm font-medium transition-all duration-200 hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)] hover:shadow-[0_2px_8px_rgba(242,201,76,0.1)] active:scale-[0.98]">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  Add Member
                </button>
              </div>
            </RefinedCollapsibleCard>

            {/* Activity Preferences Card */}
            <RefinedCollapsibleCard
              icon={Layers}
              title="Activity Preferences"
              badge={`${enabledCategoriesCount} categories`}
              defaultExpanded={false}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[hsl(25,30%,14%)] mb-3">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <RefinedCategoryPill
                        key={category.id}
                        category={category}
                        onToggle={() => toggleCategory(category.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </RefinedCollapsibleCard>

            {/* Automation Card */}
            <RefinedCollapsibleCard
              icon={Zap}
              title="Automation"
              badge="Smart Features"
              defaultExpanded={false}
            >
              <div className="space-y-3">
                <RefinedToggleRow
                  icon={Search}
                  label="Discover Spots"
                  description="AI finds venues matching your preferences"
                  checked={automation.discoverSpots}
                  onCheckedChange={(checked) =>
                    setAutomation((prev) => ({ ...prev, discoverSpots: checked }))
                  }
                />
                <RefinedToggleRow
                  icon={Layers}
                  label="Draft Plans"
                  description="Auto-generate event itineraries"
                  checked={automation.draftPlans}
                  onCheckedChange={(checked) =>
                    setAutomation((prev) => ({ ...prev, draftPlans: checked }))
                  }
                />
                <RefinedToggleRow
                  icon={Calendar}
                  label="Auto Schedule"
                  description="Schedule based on group availability"
                  checked={automation.autoSchedule}
                  onCheckedChange={(checked) =>
                    setAutomation((prev) => ({ ...prev, autoSchedule: checked }))
                  }
                />
              </div>
            </RefinedCollapsibleCard>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <SidebarCard title="Quick Stats">
              <div className="space-y-2">
                <RefinedStatCard
                  icon={Calendar}
                  value={mockStats.eventsThisYear}
                  label="Events this year"
                  iconBg="bg-[hsl(44,87%,63%)]"
                />
                <RefinedStatCard
                  icon={Users}
                  value={mockStats.activeMembers}
                  label="Active members"
                  iconBg="bg-[hsl(110,40%,60%)]"
                />
                <RefinedStatCard
                  icon={MapPin}
                  value={mockStats.venuesExplored}
                  label="Venues explored"
                  iconBg="bg-[hsl(280,50%,60%)]"
                />
              </div>
            </SidebarCard>

            {/* Next Event */}
            <SidebarCard title="Next Event">
              <div className="flex gap-4 p-4 bg-white border border-[hsl(32,20%,88%)] rounded-xl mb-3">
                <div className="text-center px-3 py-2 bg-[hsl(38,50%,98%)] rounded-lg border border-[hsl(32,20%,88%)]">
                  <div className="text-[11px] uppercase font-semibold text-[hsl(25,15%,45%)]">
                    {mockNextEvent.month}
                  </div>
                  <div className="text-2xl font-bold text-[hsl(25,30%,14%)]">
                    {mockNextEvent.day}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[hsl(25,30%,14%)]">{mockNextEvent.title}</div>
                  <div className="text-sm text-[hsl(25,15%,45%)]">
                    In {mockNextEvent.daysUntil} days
                  </div>
                </div>
              </div>
              <RefinedActionButton icon={Calendar} variant="primary">
                View Details
              </RefinedActionButton>
            </SidebarCard>

            {/* Create Event */}
            <SidebarCard title="Create Event">
              <div className="space-y-2">
                <RefinedActionButton icon={Plus} variant="primary">
                  New Event
                </RefinedActionButton>
                <RefinedActionButton icon={Search} variant="secondary">
                  Discover Venues
                </RefinedActionButton>
              </div>
            </SidebarCard>
          </div>
        </div>
      </main>
    </div>
  );
}
