/**
 * Unified Event Creation Modal
 * Simplified to two clear paths: Manual (default) and AI
 * Works from both Dashboard and Group Detail pages
 */

import React, { useState, useEffect } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Hammer,
  Heart,
  Clock,
  Sparkles,
  Search,
  Info,
  Users,
  Loader2,
  History,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { checkAIReadiness } from "@/lib/aiReadinessCheck";
import { AISetupWizard } from "./AISetupWizard";
import { MobileEventBuilder } from "./MobileEventBuilder";

type CreationPath = "manual" | "ai" | null;

interface UnifiedEventCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string; // If coming from group detail page (skips group selector)
  defaultPath?: CreationPath; // Pre-select a creation path (e.g., "manual" or "ai")
  onOpenScheduleModal?: (groupId: string) => void;
  onNavigateToManualTab?: (groupId: string) => void;
  onOpenDiscoverVenues?: (groupId: string) => void;
  onStartAISetup?: (groupId: string) => void; // For Phase 2: guided AI setup
}

export function UnifiedEventCreationModal({
  open,
  onOpenChange,
  groupId,
  defaultPath,
  onOpenScheduleModal,
  onNavigateToManualTab,
  onOpenDiscoverVenues,
  onStartAISetup,
}: UnifiedEventCreationModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupId || "");
  const [selectedPath, setSelectedPath] = useState<CreationPath>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAISetupWizard, setShowAISetupWizard] = useState(false);
  const [showMobileBuilder, setShowMobileBuilder] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Update selectedGroupId when groupId prop changes or modal opens
  useEffect(() => {
    if (open && groupId) {
      setSelectedGroupId(groupId);
    }
  }, [open, groupId]);

  // Fetch user's groups (only needed when no groupId is provided)
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/user/groups"],
    enabled: open && !groupId,
  });

  // Auto-select if user has only one group
  useEffect(() => {
    if (open && !groupId && groups.length === 1 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [open, groupId, groups, selectedGroupId]);

  // Fetch selected group data
  const { data: selectedGroup } = useQuery({
    queryKey: ["groups", selectedGroupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!selectedGroupId && open,
  });

  // Fetch Favorites count for selected group
  const { data: favoritesData } = useQuery({
    queryKey: ["groups", selectedGroupId, "voting-events"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroupId}/voting-events`);
      if (!res.ok) throw new Error("Failed to fetch voting events");
      return res.json();
    },
    enabled: !!selectedGroupId && open,
  });

  // Fetch activities count for readiness check
  const { data: activitiesData } = useQuery({
    queryKey: ["groups", selectedGroupId, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${selectedGroupId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!selectedGroupId && open,
  });

  const favoritesCount = favoritesData?.votingEvents?.length || 0;
  const activitiesCount = activitiesData?.length || 0;
  const hasAutoSchedule = selectedGroup?.cadence && selectedGroup?.autoActivitiesEnabled;

  // AI readiness check using utility
  const aiReadiness = checkAIReadiness(selectedGroup, favoritesCount, activitiesCount);

  const handlePathSelect = async (path: CreationPath) => {
    if (!selectedGroupId || isGenerating) {
      return; // Shouldn't happen, but defensive
    }

    setSelectedPath(path);

    // Execute the appropriate action
    switch (path) {
      case "manual":
        // On mobile, show the full-screen MobileEventBuilder
        if (isMobile) {
          onOpenChange(false);
          setShowMobileBuilder(true);
        } else {
          // On desktop, navigate to the build tab
          onOpenChange(false);
          if (onNavigateToManualTab) {
            onNavigateToManualTab(selectedGroupId);
          } else {
            setLocation(`/group/${selectedGroupId}?tab=build`);
          }
        }
        break;

      case "ai":
        // Check if AI has enough signal
        if (!aiReadiness.ready) {
          // Show guided setup wizard
          onOpenChange(false);
          setShowAISetupWizard(true);
          break;
        }

        // AI is ready - show loading state while AI generates
        setIsGenerating(true);
        toast({
          title: "Creating event...",
          description: "AI is picking the perfect venue and time",
        });

        // Close modal and trigger generation
        onOpenChange(false);
        if (onOpenScheduleModal) {
          onOpenScheduleModal(selectedGroupId);
        } else {
          setLocation(`/group/${selectedGroupId}?action=schedule`);
        }
        setIsGenerating(false);
        break;
    }

    // Reset selection after a delay
    setTimeout(() => setSelectedPath(null), 300);
  };

  // Show group selector if no groupId provided
  const showGroupSelector = !groupId;

  // Handler for when AI setup wizard completes
  const handleAISetupComplete = () => {
    setShowAISetupWizard(false);
    // Trigger AI event creation
    toast({
      title: "Creating event...",
      description: "AI is picking the perfect venue and time",
    });
    if (onOpenScheduleModal) {
      onOpenScheduleModal(selectedGroupId);
    } else {
      setLocation(`/group/${selectedGroupId}?action=schedule`);
    }
  };

  // Handler for when user skips AI setup to use manual
  const handleSkipToManual = () => {
    setShowAISetupWizard(false);
    // On mobile, show builder; on desktop, navigate to build tab
    if (isMobile) {
      setShowMobileBuilder(true);
    } else if (onNavigateToManualTab) {
      onNavigateToManualTab(selectedGroupId);
    } else {
      setLocation(`/group/${selectedGroupId}?tab=build`);
    }
  };

  // Create itinerary mutation for MobileEventBuilder
  const createItineraryMutation = useMutation({
    mutationFn: async (data: {
      groupId: string;
      eventDate: Date;
      eventTime: string;
      venues: Array<{
        id: string;
        name: string;
        address?: string;
        rating?: number;
        priceLevel?: number;
        photoUrl?: string;
        category?: string;
        googlePlaceId?: string;
      }>;
      name?: string;
    }) => {
      // Combine date and time into a single Date object
      const [time, period] = data.eventTime.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let hour24 = hours;
      if (period === "PM" && hours !== 12) hour24 += 12;
      if (period === "AM" && hours === 12) hour24 = 0;

      const eventDateTime = new Date(data.eventDate);
      eventDateTime.setHours(hour24, minutes, 0, 0);

      // Step 1: Create the itinerary
      const itineraryRes = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupId: data.groupId,
          name: data.name || `Event on ${data.eventDate.toLocaleDateString()}`,
          status: "draft",
          eventDate: eventDateTime.toISOString(),
          proposedOrder: [],
        }),
      });

      if (!itineraryRes.ok) {
        const text = await itineraryRes.text();
        throw new Error(`Failed to create event: ${text}`);
      }

      const itinerary = await itineraryRes.json();

      // Step 2: Add venues as itinerary items
      if (data.venues.length > 0) {
        // Separate venues into voting events (favorites) and ad-hoc
        const votingEventVenues = data.venues.filter(v => v.googlePlaceId);
        const adHocVenues = data.venues.filter(v => !v.googlePlaceId);

        // Add voting event venues using batch endpoint
        if (votingEventVenues.length > 0) {
          const items = votingEventVenues.map((venue) => ({
            sourceType: "voting_event" as const,
            sourceId: venue.id,
          }));

          const itemsRes = await fetch(`/api/itineraries/${itinerary.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ items }),
          });

          if (!itemsRes.ok) {
            console.error("Failed to add voting event items:", await itemsRes.text());
          }
        }

        // Add ad-hoc venues one by one using the ad-hoc endpoint
        for (const venue of adHocVenues) {
          const adHocRes = await fetch(`/api/itineraries/${itinerary.id}/items/ad-hoc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: venue.name,
              address: venue.address || "",
              venueType: venue.category || "restaurant",
            }),
          });

          if (!adHocRes.ok) {
            console.error("Failed to add ad-hoc venue:", venue.name, await adHocRes.text());
          }
        }
      }

      return itinerary;
    },
    onSuccess: (itinerary) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/groups", selectedGroupId, "itineraries"] });

      toast({
        title: "Event created!",
        description: "Your event has been created. You can now send invites.",
      });

      // Close the builder and navigate to the event
      setShowMobileBuilder(false);
      setLocation(`/event/${itinerary.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for MobileEventBuilder create
  const handleMobileCreate = (data: {
    groupId: string;
    eventDate: Date;
    eventTime: string;
    venues: Array<{
      id: string;
      name: string;
      address?: string;
      rating?: number;
      priceLevel?: number;
      photoUrl?: string;
      category?: string;
    }>;
    name?: string;
  }) => {
    createItineraryMutation.mutate(data);
  };

  // Transform favorites (voting events) into MobileEventBuilder venue format
  const favoritesForBuilder = (favoritesData?.votingEvents || []).map((ve: any) => ({
    id: ve.id,
    name: ve.title,
    address: ve.venueAddress,
    rating: ve.rating ? parseFloat(ve.rating) : undefined,
    priceLevel: ve.priceLevel ? parseInt(ve.priceLevel) : undefined,
    photoUrl: ve.photoUrl,
    category: ve.venueType,
    isFavorite: true,
    googlePlaceId: ve.googlePlaceId,
  }));

  // Transform groups for MobileEventBuilder
  // When groupId is provided (coming from group page), use selectedGroup data
  // Otherwise, use the fetched groups list
  const groupsForBuilder = groupId && selectedGroup
    ? [{
        id: selectedGroup.id,
        name: selectedGroup.name,
        emoji: selectedGroup.emoji || "👥",
        memberCount: selectedGroup.members?.length || 0,
      }]
    : groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji || "👥",
        memberCount: g.memberCount || 0,
      }));

  return (
    <>
      {/* AI Setup Wizard - shown when AI is selected but not ready */}
      <AISetupWizard
        open={showAISetupWizard}
        onOpenChange={setShowAISetupWizard}
        groupId={selectedGroupId}
        aiReadiness={aiReadiness}
        onComplete={handleAISetupComplete}
        onSkipToManual={handleSkipToManual}
      />

      {/* Mobile Event Builder - full-screen mobile experience */}
      {showMobileBuilder && (
        <MobileEventBuilder
          groups={groupsForBuilder}
          preselectedGroupId={selectedGroupId}
          favorites={favoritesForBuilder}
          recentVenues={[]} // TODO: Add recent venues from past events
          groupLocation={selectedGroup?.locationBase}
          onClose={() => setShowMobileBuilder(false)}
          onCreateEvent={handleMobileCreate}
          isCreating={createItineraryMutation.isPending}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Event</DialogTitle>
          <DialogDescription>
            {showGroupSelector
              ? "Select a group and choose how you'd like to create your event"
              : "Choose how you'd like to create your event"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Group Selector (if coming from dashboard) */}
          {showGroupSelector && (
            <div className="space-y-2 pb-4 border-b">
              <Label htmlFor="group-select" className="text-sm font-medium">
                Select Group
              </Label>
              {groups.length > 0 ? (
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger id="group-select" className="w-full">
                    <SelectValue placeholder="Choose a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group: any) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{group.name}</span>
                          {group.cadence && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {group.cadence}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <AlertDescription>
                    You don't have any groups yet. Create a group first to schedule events.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Creation Options (shown when group is selected) */}
          {selectedGroupId && (
            <>
              {/* Context Alert */}
              {hasAutoSchedule && (
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    <span className="font-medium">Auto-scheduling is active.</span>{" "}
                    This event will be created outside your regular cadence.
                  </AlertDescription>
                </Alert>
              )}

              {/* Creation Paths - 2 clear options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Manual - Default option (left) */}
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPath === "manual" ? "ring-2 ring-primary" : ""
                  } ${
                    defaultPath === "manual" || !defaultPath ? "ring-2 ring-primary/50 shadow-md" : ""
                  }`}
                  onClick={() => handlePathSelect("manual")}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-md">
                          <Hammer className="h-4 w-4 text-blue-600" />
                        </div>
                        <span>Manual</span>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        Full Control
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription>
                      You pick the venue, date, and time
                    </CardDescription>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        2-3 minutes
                      </span>
                    </div>
                    {/* Tabs preview */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="text-xs text-center p-2 bg-muted rounded flex flex-col items-center gap-1">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Search</span>
                      </div>
                      <div className="text-xs text-center p-2 bg-muted rounded flex flex-col items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Favorites</span>
                        {favoritesCount > 0 && (
                          <span className="text-[10px] text-green-600">{favoritesCount}</span>
                        )}
                      </div>
                      <div className="text-xs text-center p-2 bg-muted rounded flex flex-col items-center gap-1">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">History</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI option (right) */}
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPath === "ai" ? "ring-2 ring-primary" : ""
                  } ${
                    defaultPath === "ai" ? "ring-2 ring-primary/50 shadow-md" : ""
                  } ${
                    isGenerating ? "pointer-events-none" : ""
                  }`}
                  onClick={() => handlePathSelect("ai")}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 rounded-md">
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                          ) : (
                            <Bot className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                        <span>AI</span>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {aiReadiness.ready ? "Ready" : "30 sec"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription>
                      {isGenerating
                        ? "AI is generating your event..."
                        : "AI picks venue and time based on your group"}
                    </CardDescription>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        30 seconds
                      </span>
                    </div>
                    {/* AI readiness indicator */}
                    {aiReadiness.ready ? (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-xs text-green-700">
                          Using {aiReadiness.totalVenues} venues from your library
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-md">
                        <p className="text-xs text-purple-700">
                          {!aiReadiness.hasPreferences
                            ? "Tip: Add more venues to improve AI suggestions"
                            : "AI will help set up your preferences"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tips */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Tip:</span> Regular events are best handled by auto-scheduling.
                  Use manual creation for special occasions or one-off events.
                </p>
              </div>
            </>
          )}

          {/* Empty state when no group selected */}
          {showGroupSelector && !selectedGroupId && groups.length > 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a group above to see event creation options</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
