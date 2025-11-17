import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowRight, Calendar, Compass, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AIAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScheduleModal: () => void;
  onOpenDiscoverModal: () => void;
}

// Simple intent detection patterns
const INTENT_PATTERNS = {
  schedule: [
    /schedule.*event/i,
    /create.*event/i,
    /plan.*event/i,
    /book/i,
    /when.*meet/i,
    /set.*time/i,
  ],
  discover: [
    /discover.*venue/i,
    /find.*place/i,
    /suggest.*restaurant/i,
    /recommend/i,
    /new.*spot/i,
    /explore/i,
    /swipe/i,
  ],
};

function detectIntent(prompt: string): 'schedule' | 'discover' | 'unknown' {
  const lowerPrompt = prompt.toLowerCase();

  // Check schedule patterns
  if (INTENT_PATTERNS.schedule.some(pattern => pattern.test(lowerPrompt))) {
    return 'schedule';
  }

  // Check discover patterns
  if (INTENT_PATTERNS.discover.some(pattern => pattern.test(lowerPrompt))) {
    return 'discover';
  }

  return 'unknown';
}

export function AIAssistantModal({
  open,
  onOpenChange,
  onOpenScheduleModal,
  onOpenDiscoverModal,
}: AIAssistantModalProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;

    const intent = detectIntent(prompt);

    // Close this modal and open the appropriate one
    onOpenChange(false);
    setPrompt("");

    switch (intent) {
      case 'schedule':
        onOpenScheduleModal();
        break;
      case 'discover':
        onOpenDiscoverModal();
        break;
      case 'unknown':
        // For now, just open discover modal as default
        // In the future, this could show a "I'm not sure what you mean" message
        onOpenDiscoverModal();
        break;
    }
  };

  const handleQuickAction = (action: 'schedule' | 'discover') => {
    onOpenChange(false);
    if (action === 'schedule') {
      onOpenScheduleModal();
    } else {
      onOpenDiscoverModal();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            Tell me what you'd like to do with your group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g., "Find new ramen places" or "Schedule dinner for next week"'
              className="min-h-24 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Press ⌘+Enter to submit
              </p>
              <Button onClick={handleSubmit} disabled={!prompt.trim()}>
                <Sparkles className="h-4 w-4 mr-2" />
                Let's Go
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">
              Or choose a quick action:
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleQuickAction('schedule')}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h5 className="font-medium text-sm mb-1">Schedule Event</h5>
                    <p className="text-xs text-muted-foreground">
                      Create a new event with AI help
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleQuickAction('discover')}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <Compass className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h5 className="font-medium text-sm mb-1">Discover Venues</h5>
                    <p className="text-xs text-muted-foreground">
                      Find new places for your group
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Example Prompts */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">
                Example prompts:
              </h4>
            </div>
            <div className="space-y-1">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
                onClick={() => setPrompt("Find new sushi restaurants nearby")}
              >
                • "Find new sushi restaurants nearby"
              </button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
                onClick={() => setPrompt("Schedule dinner next Tuesday evening")}
              >
                • "Schedule dinner next Tuesday evening"
              </button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
                onClick={() => setPrompt("Discover coffee shops for weekend")}
              >
                • "Discover coffee shops for weekend"
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
