/**
 * AI Setup Wizard
 * Guides users through setting up their group for AI-powered event creation
 * Shows a checklist of requirements and helps complete them inline
 */

import React, { useState } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bot,
  MapPin,
  Sparkles,
  Check,
  ChevronRight,
  Loader2,
  Heart,
  Utensils,
  Coffee,
  Wine,
  IceCream,
  Ticket,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MiniSwipeSession } from "./MiniSwipeSession";

// Activity type options
const ACTIVITY_TYPES = [
  { id: "meal", label: "Meals", icon: Utensils },
  { id: "cafe", label: "Cafes", icon: Coffee },
  { id: "drinks", label: "Drinks", icon: Wine },
  { id: "dessert", label: "Dessert", icon: IceCream },
  { id: "experience", label: "Experiences", icon: Ticket },
];

interface AIReadiness {
  ready: boolean;
  hasLocation: boolean;
  hasCategories: boolean;
  hasPreferences: boolean;
  totalVenues: number;
  location?: string;
  categories?: string[];
}

interface AISetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  aiReadiness: AIReadiness;
  onComplete: () => void; // Called when setup is complete, triggers AI event creation
  onSkipToManual: () => void; // Called if user wants to skip and use manual instead
}

type SetupStep = "checklist" | "location" | "categories" | "swipe";

export function AISetupWizard({
  open,
  onOpenChange,
  groupId,
  aiReadiness,
  onComplete,
  onSkipToManual,
}: AISetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>("checklist");
  const [location, setLocation] = useState(aiReadiness.location || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    aiReadiness.categories || []
  );
  const { toast } = useToast();

  // Track what's been completed in this session
  const [completedInSession, setCompletedInSession] = useState({
    location: aiReadiness.hasLocation,
    categories: aiReadiness.hasCategories,
    preferences: aiReadiness.hasPreferences,
  });

  // Fetch fresh group data
  const { data: group, refetch: refetchGroup } = useQuery({
    queryKey: ["groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: open,
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async (newLocation: string) => {
      return apiRequest("PATCH", `/api/groups/${groupId}`, {
        location: newLocation,
      });
    },
    onSuccess: () => {
      setCompletedInSession((prev) => ({ ...prev, location: true }));
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      toast({ title: "Location saved!" });
      setCurrentStep("checklist");
    },
    onError: () => {
      toast({
        title: "Failed to save location",
        variant: "destructive",
      });
    },
  });

  // Update categories mutation
  const updateCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      return apiRequest("PATCH", `/api/groups/${groupId}`, {
        activityTypes: categories,
      });
    },
    onSuccess: () => {
      setCompletedInSession((prev) => ({ ...prev, categories: true }));
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      toast({ title: "Activity preferences saved!" });
      setCurrentStep("checklist");
    },
    onError: () => {
      toast({
        title: "Failed to save preferences",
        variant: "destructive",
      });
    },
  });

  const handleLocationSubmit = () => {
    if (location.trim()) {
      updateLocationMutation.mutate(location.trim());
    }
  };

  const handleCategoriesSubmit = () => {
    if (selectedCategories.length > 0) {
      updateCategoriesMutation.mutate(selectedCategories);
    }
  };

  const handleSwipeComplete = () => {
    setCompletedInSession((prev) => ({ ...prev, preferences: true }));
    setCurrentStep("checklist");
    // Refetch to get updated venue counts
    refetchGroup();
  };

  const handleContinueToAI = () => {
    onOpenChange(false);
    onComplete();
  };

  const allComplete =
    completedInSession.location &&
    completedInSession.categories &&
    completedInSession.preferences;

  // Checklist view
  const renderChecklist = () => (
    <div className="space-y-4">
      <div className="text-center pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-3">
          <Bot className="h-6 w-6 text-purple-600" />
        </div>
        <h3 className="font-medium">Let's help AI understand your group</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Complete these quick steps for better venue recommendations
        </p>
      </div>

      <div className="space-y-2">
        {/* Location */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            completedInSession.location
              ? "border-green-200 bg-green-50/50"
              : "hover:border-primary/50"
          }`}
          onClick={() => !completedInSession.location && setCurrentStep("location")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  completedInSession.location ? "bg-green-100" : "bg-muted"
                }`}
              >
                {completedInSession.location ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Location</p>
                <p className="text-xs text-muted-foreground">
                  {completedInSession.location
                    ? group?.location || location || "Set"
                    : "Where does your group meet?"}
                </p>
              </div>
            </div>
            {!completedInSession.location && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            completedInSession.categories
              ? "border-green-200 bg-green-50/50"
              : "hover:border-primary/50"
          }`}
          onClick={() => !completedInSession.categories && setCurrentStep("categories")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  completedInSession.categories ? "bg-green-100" : "bg-muted"
                }`}
              >
                {completedInSession.categories ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Activity Types</p>
                <p className="text-xs text-muted-foreground">
                  {completedInSession.categories
                    ? `${group?.activityTypes?.length || selectedCategories.length} selected`
                    : "What does your group like to do?"}
                </p>
              </div>
            </div>
            {!completedInSession.categories && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        {/* Preferences (Swipe) */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-sm ${
            completedInSession.preferences
              ? "border-green-200 bg-green-50/50"
              : "hover:border-primary/50"
          }`}
          onClick={() => !completedInSession.preferences && setCurrentStep("swipe")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  completedInSession.preferences ? "bg-green-100" : "bg-muted"
                }`}
              >
                {completedInSession.preferences ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Heart className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Venue Preferences</p>
                <p className="text-xs text-muted-foreground">
                  {completedInSession.preferences
                    ? `${aiReadiness.totalVenues}+ venues rated`
                    : "Quick swipe through 5-10 venues"}
                </p>
              </div>
            </div>
            {!completedInSession.preferences && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                <Sparkles className="h-3 w-3 mr-1" />
                ~1 min
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="pt-4 space-y-2">
        {allComplete ? (
          <Button onClick={handleContinueToAI} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Continue with AI
          </Button>
        ) : (
          <Button
            onClick={handleContinueToAI}
            variant="outline"
            className="w-full"
          >
            Skip for now - AI will do its best
          </Button>
        )}
        <Button
          onClick={onSkipToManual}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          Use Manual instead
        </Button>
      </div>
    </div>
  );

  // Location input view
  const renderLocationStep = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("checklist")}
        className="mb-2"
      >
        ← Back
      </Button>

      <div className="text-center pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
          <MapPin className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="font-medium">Where does your group meet?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Enter a neighborhood, city, or address
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g., Downtown Seattle, Brooklyn NY"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          autoFocus
        />
      </div>

      <Button
        onClick={handleLocationSubmit}
        disabled={!location.trim() || updateLocationMutation.isPending}
        className="w-full"
      >
        {updateLocationMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Save Location
      </Button>
    </div>
  );

  // Categories selection view
  const renderCategoriesStep = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("checklist")}
        className="mb-2"
      >
        ← Back
      </Button>

      <div className="text-center pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-3">
          <Utensils className="h-6 w-6 text-orange-600" />
        </div>
        <h3 className="font-medium">What does your group like to do?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select all that apply
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTIVITY_TYPES.map((type) => {
          const isSelected = selectedCategories.includes(type.id);
          const Icon = type.icon;
          return (
            <Card
              key={type.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => {
                setSelectedCategories((prev) =>
                  isSelected
                    ? prev.filter((c) => c !== type.id)
                    : [...prev, type.id]
                );
              }}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <Checkbox checked={isSelected} />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{type.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        onClick={handleCategoriesSubmit}
        disabled={selectedCategories.length === 0 || updateCategoriesMutation.isPending}
        className="w-full"
      >
        {updateCategoriesMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Save Preferences ({selectedCategories.length} selected)
      </Button>
    </div>
  );

  // Swipe step - renders MiniSwipeSession
  const renderSwipeStep = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("checklist")}
        className="mb-2"
      >
        ← Back
      </Button>

      <MiniSwipeSession
        groupId={groupId}
        maxVenues={8}
        onComplete={handleSwipeComplete}
        onSkip={() => setCurrentStep("checklist")}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentStep === "checklist" && "AI Setup"}
            {currentStep === "location" && "Set Location"}
            {currentStep === "categories" && "Activity Types"}
            {currentStep === "swipe" && "Quick Preferences"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "checklist" &&
              "Help AI learn what your group likes"}
            {currentStep === "location" && "Step 1 of 3"}
            {currentStep === "categories" && "Step 2 of 3"}
            {currentStep === "swipe" && "Step 3 of 3"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {currentStep === "checklist" && renderChecklist()}
          {currentStep === "location" && renderLocationStep()}
          {currentStep === "categories" && renderCategoriesStep()}
          {currentStep === "swipe" && renderSwipeStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
