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

interface ScheduleEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onNavigateToTab?: (tab: string) => void;
}

export function ScheduleEventModal({ open, onOpenChange, groupId, onNavigateToTab }: ScheduleEventModalProps) {
  const { toast } = useToast();
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
      await apiRequest("POST", `/api/groups/${groupId}/schedule-from-prompt`, {
        prompt: schedulePrompt.trim(),
      });

      toast({
        title: "Event created!",
        description: "Your event has been scheduled with AI-generated time options",
      });

      // Refresh itineraries
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "proposed-itineraries"] });

      onOpenChange(false);
      setSchedulePrompt("");
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
          <DialogDescription>
            Choose how you'd like to create your event
          </DialogDescription>
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
                  Use natural language to tell AI what you want to do
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-prompt">What do you want to do?</Label>
                  <Textarea
                    id="schedule-prompt"
                    value={schedulePrompt}
                    onChange={(e) => setSchedulePrompt(e.target.value)}
                    placeholder='e.g., "tacos next week with friends at night on weekday in mission"'
                    className="min-h-24"
                    data-testid="input-schedule-prompt"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include activity type, time preferences, location, and any other details
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
                <CardDescription>
                  Manually select venues and set the time yourself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>With manual building, you can:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Pick specific venues from your Favorites</li>
                    <li>Arrange them in your preferred order</li>
                    <li>Set exact times for the event</li>
                    <li>Add custom notes and details</li>
                  </ul>
                </div>
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
                  Let AI automatically create events for your group
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Auto-scheduling will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Automatically create event proposals based on your meeting frequency</li>
                    <li>Use your Favorites and past preferences</li>
                    <li>Generate 3 itinerary options for you to choose from</li>
                    <li>Send events 10 days before the target date</li>
                  </ul>
                  <p className="pt-2 font-medium">
                    Perfect for recurring groups that meet regularly!
                  </p>
                </div>
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
