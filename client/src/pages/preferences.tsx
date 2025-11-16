import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Settings,
  ChevronLeft,
  DollarSign,
  Bell,
  Calendar,
  Heart,
  Check,
  X,
} from "lucide-react";

type ActivityCategory = "meal" | "cafes" | "drinks" | "dessert" | "experiences";

const ACTIVITY_CATEGORIES: { value: ActivityCategory; label: string; icon: string }[] = [
  { value: "meal", label: "Restaurants & Meals", icon: "🍽️" },
  { value: "cafes", label: "Cafes & Coffee", icon: "☕" },
  { value: "drinks", label: "Bars & Drinks", icon: "🍷" },
  { value: "dessert", label: "Dessert & Sweets", icon: "🍰" },
  { value: "experiences", label: "Experiences & Activities", icon: "🎨" },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
type TimeSlot = typeof TIME_SLOTS[number];

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Morning (6am-12pm)",
  afternoon: "Afternoon (12pm-6pm)",
  evening: "Evening (6pm-12am)",
};

export default function Preferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch global preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/user/preferences"],
  });

  // Local state for form
  const [budget, setBudget] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([]);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [availability, setAvailability] = useState<Record<string, Record<TimeSlot, boolean>>>({});

  // Initialize form when data loads
  useEffect(() => {
    if (preferences) {
      setBudget(preferences.budget || null);
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
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      budget: budget || null,
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

  const toggleAvailability = (day: string, slot: TimeSlot) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slot]: !prev[day]?.[slot],
      },
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6" />
              <h1 className="text-2xl font-black">My Preferences</h1>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        {/* Budget Preference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget Preference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget per person ($)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                step="5"
                value={budget || ""}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : null;
                  setBudget(value);
                  setHasChanges(true);
                }}
                placeholder="e.g., 50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Activity Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Activity Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACTIVITY_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.value);
                const activityColorMap = {
                  meal: { bg: "bg-activity-meals/25", border: "border-activity-meals", text: "text-activity-meals" },
                  cafes: { bg: "bg-activity-cafes/25", border: "border-activity-cafes", text: "text-activity-cafes" },
                  drinks: { bg: "bg-activity-drinks/25", border: "border-activity-drinks", text: "text-activity-drinks" },
                  dessert: { bg: "bg-activity-dessert/25", border: "border-activity-dessert", text: "text-activity-dessert" },
                  experiences: { bg: "bg-activity-experiences/25", border: "border-activity-experiences", text: "text-activity-experiences" },
                };
                const colors = activityColorMap[category.value];
                return (
                  <button
                    key={category.value}
                    onClick={() => toggleCategory(category.value)}
                    className={`
                      flex items-center justify-between p-4 rounded-lg border-2 transition-all
                      ${isSelected
                        ? `${colors.border} ${colors.bg}`
                        : "border-border hover:border-muted-foreground/50"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <span className="font-semibold">{category.label}</span>
                    </div>
                    {isSelected && (
                      <Check className={`h-5 w-5 ${colors.text}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Availability Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Personal Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-medium text-sm"></th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot} className="text-center p-2 font-medium text-sm">
                        {TIME_SLOT_LABELS[slot].split(' (')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS_OF_WEEK.map(day => (
                    <tr key={day} className="border-t">
                      <td className="p-2 font-medium text-sm">{day}</td>
                      {TIME_SLOTS.map(slot => (
                        <td key={slot} className="text-center p-2">
                          <button
                            onClick={() => toggleAvailability(day, slot)}
                            className={`
                              w-10 h-10 rounded-md border-2 transition-all flex items-center justify-center
                              ${availability[day]?.[slot]
                                ? "border-green-500 bg-green-500/10"
                                : "border-gray-300 hover:border-gray-400"
                              }
                            `}
                          >
                            {availability[day]?.[slot] ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications" className="text-base font-medium">
                  Email notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive email updates for event invites and reminders
                </p>
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
          </CardContent>
        </Card>

        {/* Save Button (mobile) */}
        {hasChanges && (
          <div className="md:hidden sticky bottom-6">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full"
              size="lg"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
