import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Link } from "wouter";
import { FavoriteVenuesManager } from "@/components/FavoriteVenuesManager";
import { Header } from "@/components/Header";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { cn } from "@/lib/utils";
import {
  Settings,
  ChevronLeft,
  DollarSign,
  Bell,
  Calendar,
  Heart,
  Check,
  X,
  Lightbulb,
  Loader2,
  Sparkles,
  Coffee,
  Users,
  Mail,
  BellRing,
} from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";

type ActivityCategory = "meal" | "cafes" | "drinks" | "dessert" | "experiences";

const ACTIVITY_CATEGORIES: { value: ActivityCategory; label: string; shortLabel: string; icon: string; description: string }[] = [
  { value: "meal", label: "Restaurants & Meals", shortLabel: "Meals", icon: "🍽️", description: "Dinner, lunch, brunch spots" },
  { value: "cafes", label: "Cafes & Coffee", shortLabel: "Cafes", icon: "☕", description: "Coffee shops, tea houses" },
  { value: "drinks", label: "Bars & Drinks", shortLabel: "Drinks", icon: "🍷", description: "Bars, cocktail lounges" },
  { value: "dessert", label: "Dessert & Sweets", shortLabel: "Dessert", icon: "🍰", description: "Ice cream, bakeries" },
  { value: "experiences", label: "Experiences & Activities", shortLabel: "Activities", icon: "🎨", description: "Events, shows, fun outings" },
];

// Budget level indicators for visual feedback
const BUDGET_LEVELS = [
  { max: 20, label: "Budget-friendly", emoji: "$" },
  { max: 40, label: "Moderate", emoji: "$$" },
  { max: 80, label: "Upscale", emoji: "$$$" },
  { max: 150, label: "Fine dining", emoji: "$$$$" },
  { max: 250, label: "Luxury", emoji: "$$$$$" },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
type TimeSlot = typeof TIME_SLOTS[number];

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Morning (6am-12pm)",
  afternoon: "Afternoon (12pm-6pm)",
  evening: "Evening (6pm-12am)",
};

// Component for per-group budget override with dual-track slider
function GroupBudgetOverride({
  groupId,
  groupName,
  groupEmoji,
  groupBudgetMin,
  groupBudgetMax,
  globalBudgetRange,
}: {
  groupId: string;
  groupName: string;
  groupEmoji: string | null;
  groupBudgetMin: number;
  groupBudgetMax: number;
  globalBudgetRange: [number, number];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(false);
  const [budgetOverride, setBudgetOverride] = useState<[number, number]>(globalBudgetRange);

  // Fetch group-specific preferences
  const { data: groupPrefs, isLoading } = useQuery({
    queryKey: ["/api/user/preferences/groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/user/preferences/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group preferences");
      return res.json();
    },
  });

  // Handle data initialization when fetched
  useEffect(() => {
    if (groupPrefs?.budgetOverrideMin !== null && groupPrefs?.budgetOverrideMax !== null) {
      setIsEnabled(true);
      setBudgetOverride([groupPrefs.budgetOverrideMin, groupPrefs.budgetOverrideMax]);
    }
  }, [groupPrefs]);

  // Save group budget override
  const saveMutation = useMutation({
    mutationFn: async (data: { budgetOverrideMin: number | null; budgetOverrideMax: number | null }) => {
      const res = await fetch(`/api/user/preferences/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save group preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences/groups", groupId] });
      toast({
        title: "Saved",
        description: `Your budget for ${groupName} updated`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (!enabled) {
      // Clear override
      saveMutation.mutate({ budgetOverrideMin: null, budgetOverrideMax: null });
    } else {
      // Default to group's budget range when enabling
      setBudgetOverride([groupBudgetMin, groupBudgetMax]);
    }
  };

  const handleSave = () => {
    if (isEnabled) {
      saveMutation.mutate({
        budgetOverrideMin: budgetOverride[0],
        budgetOverrideMax: budgetOverride[1],
      });
    }
  };

  // Calculate percentage positions for the group budget range indicator
  const maxSlider = 250;
  const groupStartPercent = (groupBudgetMin / maxSlider) * 100;
  const groupWidthPercent = ((groupBudgetMax - groupBudgetMin) / maxSlider) * 100;

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-xl" />;
  }

  return (
    <div className={cn(
      "rounded-xl border-2 transition-all duration-200",
      isEnabled
        ? "p-4 bg-primary/5 border-primary/20 shadow-sm"
        : "px-4 py-3 bg-muted/30 border-transparent hover:border-muted-foreground/10"
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={cn("text-lg", isEnabled ? "text-xl" : "text-base")}>
            {groupEmoji || "👥"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={cn("font-semibold truncate", !isEnabled && "text-sm")}>{groupName}</h4>
              {isEnabled ? (
                <Badge variant="default" className="font-mono text-xs shrink-0 bg-primary/90">
                  ${budgetOverride[0]}-${budgetOverride[1]}
                </Badge>
              ) : (
                <Badge variant="outline" className="font-mono text-xs shrink-0 text-muted-foreground">
                  ${groupBudgetMin}-${groupBudgetMax}
                </Badge>
              )}
            </div>
            {!isEnabled && (
              <p className="text-xs text-muted-foreground mt-0.5">Group budget</p>
            )}
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={saveMutation.isPending}
        />
      </div>

      {/* Expanded slider section */}
      {isEnabled && (
        <div className="mt-4 pt-4 border-t border-primary/10 space-y-3">
          {/* Group budget label */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Group allows:</span>
            <span className="font-mono font-medium text-primary/70">${groupBudgetMin}-${groupBudgetMax}</span>
          </div>

          {/* Dual-track slider */}
          <div className="relative">
            {/* Group range indicator (gold background track) */}
            <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-primary/25 pointer-events-none"
              style={{
                left: `${groupStartPercent}%`,
                width: `${groupWidthPercent}%`,
              }}
            />
            {/* Personal preference slider */}
            <Slider
              min={0}
              max={250}
              step={10}
              value={budgetOverride}
              onValueChange={(value) => setBudgetOverride(value as [number, number])}
              className="w-full relative z-10"
            />
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-2xs text-muted-foreground/60 px-1">
            <span>$0</span>
            <span>$50</span>
            <span>$100</span>
            <span>$150</span>
            <span>$200+</span>
          </div>

          {/* Save button row */}
          <div className="flex justify-between items-center pt-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Your budget:</span>
              <span className="font-mono font-semibold text-foreground">
                ${budgetOverride[0]}-${budgetOverride[1]}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="min-w-[70px]"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions to convert between full day names (Monday) and short names (Mon)
const DAY_NAME_MAP: Record<string, string> = {
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday",
  "Sat": "Saturday",
  "Sun": "Sunday"
};

const SHORT_DAY_MAP: Record<string, string> = {
  "Monday": "Mon",
  "Tuesday": "Tue",
  "Wednesday": "Wed",
  "Thursday": "Thu",
  "Friday": "Fri",
  "Saturday": "Sat",
  "Sunday": "Sun"
};

// Convert from full names to short names for AvailabilityGrid
function toShortDayFormat(availability: Record<string, Record<TimeSlot, boolean>>) {
  const result: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> = {};
  Object.entries(availability).forEach(([day, slots]) => {
    const shortDay = SHORT_DAY_MAP[day] || day;
    result[shortDay] = slots;
  });
  return result;
}

// Convert from short names to full names for API
function toFullDayFormat(availability: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>) {
  const result: Record<string, Record<TimeSlot, boolean>> = {};
  Object.entries(availability).forEach(([day, slots]) => {
    const fullDay = DAY_NAME_MAP[day] || day;
    result[fullDay] = slots;
  });
  return result;
}

export default function Preferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch global preferences
  const { data: preferences, isLoading } = useQuery<{
    budgetMin?: number;
    budgetMax?: number;
    activityPreferences?: ActivityCategory[];
    emailNotifications?: boolean;
    personalAvailability?: Record<string, Record<TimeSlot, boolean>>;
  }>({
    queryKey: ["/api/user/preferences"],
  });

  // Fetch user's groups to get member ID for favorites
  const { data: userGroups } = useQuery<Array<{
    id: string;
    name: string;
    emoji: string | null;
    budgetMin: number;
    budgetMax: number;
    members: Array<{ id: string; userId: string | null; homeBaseLocation: string | null }>;
  }>>({
    queryKey: ["/api/user/groups"],
  });

  // Get the first member ID (user's primary member profile)
  const primaryMember = userGroups?.flatMap(g => g.members).find(m => m.userId);
  const memberId = primaryMember?.id;
  const memberHomeLocation = primaryMember?.homeBaseLocation || "San Francisco, CA";

  // Fetch AI constraint analysis
  const { data: constraintAnalysis, isLoading: constraintsLoading, refetch: refetchConstraints } = useQuery<{
    currentConstraints: any;
    patterns: {
      budgetConcernCount: number;
      locationConcernCount: number;
      timeConcernCount: number;
      unavailableDays: string[];
      totalRSVPs: number;
    };
    suggestions: Array<{
      type: string;
      title: string;
      description: string;
      confidence: number;
      action: string;
      data?: any;
    }>;
  }>({
    queryKey: ["/api/members", memberId, "constraint-analysis"],
    enabled: !!memberId,
  });

  // Local state for form
  const [budgetRange, setBudgetRange] = useState<[number, number]>([0, 60]);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([]);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [availability, setAvailability] = useState<Record<string, Record<TimeSlot, boolean>>>({});

  // Initialize form when data loads
  useEffect(() => {
    if (preferences) {
      const min = preferences.budgetMin ?? 0;
      const max = preferences.budgetMax ?? 60;
      setBudgetRange([min, max]);
      setSelectedCategories(preferences.activityPreferences || []);
      setEmailNotifications(preferences.emailNotifications ?? true);

      // Initialize availability grid
      if (preferences.personalAvailability) {
        setAvailability(preferences.personalAvailability);
      } else {
        // Default: all times available
        const defaultAvailability: Record<string, Record<TimeSlot, boolean>> = {};
        DAYS_OF_WEEK.forEach(day => {
          defaultAvailability[day] = {
            morning: false,
            afternoon: false,
            evening: false,
          };
        });
        setAvailability(defaultAvailability);
      }
    }
  }, [preferences]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update preferences");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      setHasChanges(false);
      toast({
        title: "Preferences saved",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Constraint action mutation (accept/dismiss AI suggestions)
  const constraintMutation = useMutation({
    mutationFn: async ({ action, constraintType, data }: { action: string; constraintType: string; data?: any }) => {
      if (!memberId) throw new Error("Member ID not found");

      const response = await fetch(`/api/members/${memberId}/constraints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, constraintType, data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update constraints");
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      refetchConstraints();
      toast({
        title: variables.action === 'accept' ? "Constraint accepted" : "Suggestion dismissed",
        description: variables.action === 'accept' ? "We'll use this when planning events" : undefined,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      activityPreferences: selectedCategories,
      emailNotifications,
      personalAvailability: availability,
    });
  };

  const toggleCategory = (category: ActivityCategory) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(newCategories);
    setHasChanges(true);
  };

  const handleAvailabilityChange = (newAvailability: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>) => {
    setAvailability(toFullDayFormat(newAvailability));
    setHasChanges(true);
  };

  // Helper to get budget level indicator
  const getBudgetLevel = (amount: number) => {
    for (const level of BUDGET_LEVELS) {
      if (amount <= level.max) return level;
    }
    return BUDGET_LEVELS[BUDGET_LEVELS.length - 1];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          {/* Cards skeleton */}
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-5 sm:space-y-8">
        {/* Page Header - Simplified for mobile */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Preferences</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Customize how Kinmo plans for you
          </p>
          {/* Desktop save button */}
          {hasChanges && (
            <div className="hidden sm:block pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="shadow-sm"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* AI Insights - Learned Constraints */}
        {memberId && constraintAnalysis && constraintAnalysis.suggestions.length > 0 && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Smart Insights</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Patterns from your RSVPs
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
              {constraintAnalysis.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 sm:p-4 rounded-xl bg-background/80 backdrop-blur-sm border shadow-sm"
                >
                  <div className="mb-3">
                    <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {suggestion.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        constraintMutation.mutate({
                          action: 'accept',
                          constraintType: suggestion.type,
                          data: suggestion.data,
                        });
                      }}
                      disabled={constraintMutation.isPending}
                      className="h-8 px-3 text-xs flex-1 sm:flex-none"
                    >
                      {constraintMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Apply
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        constraintMutation.mutate({
                          action: 'dismiss',
                          constraintType: suggestion.type,
                        });
                      }}
                      disabled={constraintMutation.isPending}
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Budget Preference */}
        <Card className="overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Budget Range</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Per event spending comfort
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
            {/* Visual budget indicator - more compact on mobile */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 sm:py-4 px-4 sm:px-6 bg-muted/50 rounded-xl">
              <div className="text-center">
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                  {budgetRange[0] >= 200 ? "$200+" : `$${budgetRange[0]}`}
                </span>
                <p className="text-2xs sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  {getBudgetLevel(budgetRange[0]).label}
                </p>
              </div>
              <div className="text-xl sm:text-2xl text-muted-foreground/50">—</div>
              <div className="text-center">
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                  {budgetRange[1] >= 200 ? "$200+" : `$${budgetRange[1]}`}
                </span>
                <p className="text-2xs sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  {getBudgetLevel(budgetRange[1]).label}
                </p>
              </div>
            </div>

            {/* Slider */}
            <div className="px-1 sm:px-2">
              <Slider
                min={0}
                max={250}
                step={10}
                value={budgetRange}
                onValueChange={(value) => {
                  setBudgetRange(value as [number, number]);
                  setHasChanges(true);
                }}
                className="w-full"
              />
              {/* Scale markers */}
              <div className="flex justify-between mt-2 text-2xs sm:text-xs text-muted-foreground">
                <span>$0</span>
                <span>$50</span>
                <span>$100</span>
                <span>$150</span>
                <span>$200+</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Preferences */}
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center shrink-0">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg flex items-center">
                    Activity Types
                    <HelpTooltip
                      content="Your preferences help us suggest venues the whole group will enjoy."
                    />
                  </CardTitle>
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="text-2xs sm:text-xs shrink-0">
                      {selectedCategories.length} selected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  What do you enjoy?
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {ACTIVITY_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.value);
                const activityColorMap = {
                  meal: {
                    bg: "bg-activity-meals/15",
                    bgHover: "hover:bg-activity-meals/10",
                    border: "border-activity-meals",
                    text: "text-activity-meals",
                    ring: "ring-activity-meals/30"
                  },
                  cafes: {
                    bg: "bg-activity-cafes/15",
                    bgHover: "hover:bg-activity-cafes/10",
                    border: "border-activity-cafes",
                    text: "text-activity-cafes",
                    ring: "ring-activity-cafes/30"
                  },
                  drinks: {
                    bg: "bg-activity-drinks/15",
                    bgHover: "hover:bg-activity-drinks/10",
                    border: "border-activity-drinks",
                    text: "text-activity-drinks",
                    ring: "ring-activity-drinks/30"
                  },
                  dessert: {
                    bg: "bg-activity-dessert/15",
                    bgHover: "hover:bg-activity-dessert/10",
                    border: "border-activity-dessert",
                    text: "text-activity-dessert",
                    ring: "ring-activity-dessert/30"
                  },
                  experiences: {
                    bg: "bg-activity-experiences/15",
                    bgHover: "hover:bg-activity-experiences/10",
                    border: "border-activity-experiences",
                    text: "text-activity-experiences",
                    ring: "ring-activity-experiences/30"
                  },
                };
                const colors = activityColorMap[category.value];
                return (
                  <button
                    key={category.value}
                    onClick={() => toggleCategory(category.value)}
                    className={cn(
                      "group relative flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      isSelected
                        ? `${colors.border} ${colors.bg} shadow-sm`
                        : `border-transparent bg-muted/40 ${colors.bgHover} hover:border-muted-foreground/20`
                    )}
                  >
                    <span className={cn(
                      "text-xl sm:text-2xl transition-transform duration-200",
                      isSelected && "scale-110"
                    )}>
                      {category.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm">{category.shortLabel}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                        {category.description}
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                      isSelected
                        ? `${colors.border} ${colors.bg}`
                        : "border-muted-foreground/30"
                    )}>
                      {isSelected && (
                        <Check className={`h-3 w-3 ${colors.text}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4 text-center py-2 bg-muted/30 rounded-lg">
                Select at least one activity type
              </p>
            )}
          </CardContent>
        </Card>

        {/* Availability Grid */}
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Availability</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  When are you free?
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <AvailabilityGrid
              value={toShortDayFormat(availability)}
              onChange={handleAvailabilityChange}
            />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <BellRing className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  How to reach you
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-transparent hover:border-muted-foreground/10 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-background flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="email-notifications" className="text-sm font-semibold cursor-pointer">
                      Email notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Invites & reminders
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-Group Budget Overrides */}
        {userGroups && userGroups.length > 0 && (
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Group Budgets</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Personal budget per group
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                {userGroups.map((group) => (
                  <GroupBudgetOverride
                    key={group.id}
                    groupId={group.id}
                    groupName={group.name}
                    groupEmoji={group.emoji}
                    groupBudgetMin={group.budgetMin}
                    groupBudgetMax={group.budgetMax}
                    globalBudgetRange={budgetRange}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Favorite Venues */}
        {memberId && (
          <FavoriteVenuesManager
            memberId={memberId}
            homeLocation={memberHomeLocation}
            showTitle={true}
            showDescription={true}
          />
        )}

        {/* Save Button (mobile) - Sticky above BottomNav */}
        {hasChanges && (
          <div className="md:hidden fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full shadow-lg"
              size="lg"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        )}

        {/* Bottom padding for mobile save button */}
        {hasChanges && <div className="md:hidden h-20" />}
      </div>
    </div>
  );
}
