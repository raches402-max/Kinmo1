/**
 * Unified Event Creation Modal
 * Combines group selection with event creation paths in one seamless flow
 * Works from both Dashboard and Group Detail pages
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MapPin,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  TrendingUp,
  Users,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type CreationPath = "quick" | "custom" | "favorites" | null;

interface UnifiedEventCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string; // If coming from group detail page (skips group selector)
  defaultPath?: CreationPath; // Pre-select a creation path (e.g., "quick" for Quick AI)
  onOpenScheduleModal?: (groupId: string) => void;
  onNavigateToManualTab?: (groupId: string) => void;
  onOpenDiscoverVenues?: (groupId: string) => void;
}

export function UnifiedEventCreationModal({
  open,
  onOpenChange,
  groupId,
  defaultPath,
  onOpenScheduleModal,
  onNavigateToManualTab,
  onOpenDiscoverVenues,
}: UnifiedEventCreationModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupId || "");
  const [selectedPath, setSelectedPath] = useState<CreationPath>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  // Pre-flight readiness check for Quick AI Plan
  const canUseQuickAI = selectedGroup?.autoScheduleEnabled &&
                        (favoritesCount > 0 || activitiesCount > 0);
  const quickAIReason = !selectedGroup?.autoScheduleEnabled
    ? "Auto-scheduling not enabled"
    : (favoritesCount === 0 && activitiesCount === 0)
    ? "No venues added yet"
    : null;

  const handlePathSelect = async (path: CreationPath) => {
    if (!selectedGroupId || isGenerating) {
      return; // Shouldn't happen, but defensive
    }

    setSelectedPath(path);

    // Execute the appropriate action
    switch (path) {
      case "quick":
        // Check if Quick AI can be used
        if (!canUseQuickAI) {
          toast({
            title: "Quick AI unavailable",
            description: quickAIReason || "Switching to manual creation",
          });
          // Fallback to manual creation
          onOpenChange(false);
          if (onNavigateToManualTab) {
            onNavigateToManualTab(selectedGroupId);
          } else {
            setLocation(`/group/${selectedGroupId}?tab=build`);
          }
          break;
        }

        // Show loading state while AI generates
        setIsGenerating(true);
        toast({
          title: "Creating event...",
          description: "AI is generating your event",
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

      case "custom":
        onOpenChange(false);
        if (onNavigateToManualTab) {
          onNavigateToManualTab(selectedGroupId);
        } else {
          setLocation(`/group/${selectedGroupId}?tab=build`);
        }
        break;

      case "favorites":
        if (favoritesCount === 0) {
          // If no favorites, open discover venues modal
          onOpenChange(false);
          if (onOpenDiscoverVenues) {
            onOpenDiscoverVenues(selectedGroupId);
          } else {
            setLocation(`/group/${selectedGroupId}`);
          }
        } else {
          // Navigate to manual tab with favorites pre-selected
          onOpenChange(false);
          if (onNavigateToManualTab) {
            onNavigateToManualTab(selectedGroupId);
          } else {
            setLocation(`/group/${selectedGroupId}?tab=build`);
          }
        }
        break;
    }

    // Reset selection after a delay
    setTimeout(() => setSelectedPath(null), 300);
  };

  // Show group selector if no groupId provided
  const showGroupSelector = !groupId;

  return (
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

              {/* Creation Paths */}
              <div className="space-y-3">
                {/* Quick AI Plan */}
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPath === "quick" ? "ring-2 ring-primary" : ""
                  } ${
                    defaultPath === "quick" ? "ring-2 ring-primary/50 shadow-md" : ""
                  } ${
                    !canUseQuickAI ? "opacity-75" : ""
                  } ${
                    isGenerating ? "pointer-events-none" : ""
                  }`}
                  onClick={() => handlePathSelect("quick")}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${canUseQuickAI ? "bg-purple-100" : "bg-gray-100"}`}>
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                          ) : (
                            <Bot className={`h-4 w-4 ${canUseQuickAI ? "text-purple-600" : "text-gray-400"}`} />
                          )}
                        </div>
                        <span>Quick AI Plan</span>
                      </div>
                      {canUseQuickAI ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Fastest
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Setup needed
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardDescription>
                      {isGenerating
                        ? "AI is generating your event..."
                        : "Let AI pick the best venue and time based on your group's preferences"}
                    </CardDescription>
                    {!canUseQuickAI && quickAIReason && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-900">
                          {quickAIReason}. Click to use manual creation instead.
                        </AlertDescription>
                      </Alert>
                    )}
                    {canUseQuickAI && (
                      <>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            30 seconds
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            AI venue selection
                          </span>
                        </div>
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground">
                            Uses your {activitiesCount + favoritesCount} saved venues
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Build Custom */}
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPath === "custom" ? "ring-2 ring-primary" : ""
                  } ${
                    defaultPath === "custom" ? "ring-2 ring-primary/50 shadow-md" : ""
                  }`}
                  onClick={() => handlePathSelect("custom")}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-md">
                          <Hammer className="h-4 w-4 text-blue-600" />
                        </div>
                        <span>Build Custom</span>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        Full Control
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardDescription>
                      Select venues manually and customize every detail of your event
                    </CardDescription>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        2-3 minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Choose 1-5 venues
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="text-xs text-center p-2 bg-muted rounded">
                        <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <span>Search</span>
                      </div>
                      <div className="text-xs text-center p-2 bg-muted rounded">
                        <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <span>Favorites</span>
                      </div>
                      <div className="text-xs text-center p-2 bg-muted rounded">
                        <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <span>History</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* From Favorites */}
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPath === "favorites" ? "ring-2 ring-primary" : ""
                  } ${
                    defaultPath === "favorites" ? "ring-2 ring-primary/50 shadow-md" : ""
                  }`}
                  onClick={() => handlePathSelect("favorites")}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-red-100 rounded-md">
                          <Heart className="h-4 w-4 text-red-600" />
                        </div>
                        <span>From Favorites</span>
                      </div>
                      {favoritesCount > 0 ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {favoritesCount} available
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Build library
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardDescription>
                      {favoritesCount > 0
                        ? `Quick-select from your ${favoritesCount} saved favorite venues`
                        : "Start by discovering and saving venues to your Favorites"}
                    </CardDescription>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {favoritesCount > 0 ? (
                        <>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            1 minute
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            Pre-approved venues
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          Opens venue discovery
                        </span>
                      )}
                    </div>
                    {favoritesCount === 0 && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertDescription className="text-xs text-amber-900">
                          Building your Favorites library enables auto-scheduling and faster event creation
                        </AlertDescription>
                      </Alert>
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
  );
}
