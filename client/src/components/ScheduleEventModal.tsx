import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Calendar, Zap, Loader2, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface ScheduleEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onNavigateToTab?: (tab: string) => void;
}

export function ScheduleEventModal({ open, onOpenChange, groupId, onNavigateToTab }: ScheduleEventModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [schedulePrompt, setSchedulePrompt] = useState("");
  const [schedulePromptLoading, setSchedulePromptLoading] = useState(false);

  const handleAIPromptSubmit = async () => {
    if (!schedulePrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please describe what you want to do",
        variant: "destructive",
      });
      return;
    }

    setSchedulePromptLoading(true);
    try {
      const response = await apiRequest("POST", `/api/groups/${groupId}/schedule-from-prompt`, {
        prompt: schedulePrompt.trim(),
      });

      // Show which AI model was used
      const modelInfo = response.aiMetadata?.model ?
        ` (using ${response.aiMetadata.model}${response.aiMetadata.cached ? ', cached' : ''})` :
        '';

      toast({
        title: "Event proposal created",
        description: `Review and choose your preferred time${modelInfo}`,
      });

      // Refresh itineraries
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });

      onOpenChange(false);
      setSchedulePrompt("");

      // Navigate to event details page to review proposal
      if (response.itinerary?.id) {
        setLocation(`/event/${response.itinerary.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Error scheduling event",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSchedulePromptLoading(false);
    }
  };

  const handleManualBuild = () => {
    onOpenChange(false);
    onNavigateToTab?.("build");
  };

  const handleAutoSchedule = () => {
    onOpenChange(false);
    onNavigateToTab?.("automation");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Event
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai-prompt" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-prompt" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Prompt
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Calendar className="h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="auto-schedule" className="gap-2">
              <Zap className="h-4 w-4" />
              Auto-schedule
            </TabsTrigger>
          </TabsList>

          {/* AI Prompt Tab */}
          <TabsContent value="ai-prompt" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Describe Your Event
                </CardTitle>
                <CardDescription>
                  Describe what you want to do
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-prompt">What do you want to do?</Label>
                  <Textarea
                    id="schedule-prompt"
                    value={schedulePrompt}
                    onChange={(e) => setSchedulePrompt(e.target.value)}
                    placeholder='Examples:
• "bottomless brunch this Saturday in Mission"
• "date night somewhere romantic this weekend"
• "family lunch with outdoor seating"
• "happy hour next Friday after work"'
                    className="min-h-32"
                    data-testid="input-schedule-prompt"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI understands: activity types, times, neighborhoods, contexts (romantic, family, etc.), and venue features (outdoor, vegetarian, etc.)
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      setSchedulePrompt("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAIPromptSubmit}
                    disabled={schedulePromptLoading || !schedulePrompt.trim()}
                    data-testid="button-submit-schedule-prompt"
                  >
                    {schedulePromptLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Event
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Build Your Own Event
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={handleManualBuild} className="gap-2">
                    Go to Build Tab
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-schedule Tab */}
          <TabsContent value="auto-schedule" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Enable Auto-scheduling
                </CardTitle>
                <CardDescription>
                  Automatic event creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={handleAutoSchedule} className="gap-2">
                    Configure Auto-schedule
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
