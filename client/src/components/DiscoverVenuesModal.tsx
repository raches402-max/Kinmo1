import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Compass, Sparkles, Grid3x3, MapPin, Loader2, ArrowRight, TrendingUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SwipeSessionWithDeck } from "@/components/SwipeSessionWithDeck";

interface DiscoverVenuesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onStartSwipeSession?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const CATEGORY_OPTIONS = [
  { value: "meal", label: "Restaurants & Meals", icon: "🍽️" },
  { value: "cafe", label: "Cafes & Coffee", icon: "☕" },
  { value: "drinks", label: "Bars & Drinks", icon: "🍷" },
  { value: "dessert", label: "Desserts & Sweets", icon: "🍰" },
  { value: "experiences", label: "Activities & Experiences", icon: "🎉" },
];

export function DiscoverVenuesModal({
  open,
  onOpenChange,
  groupId,
  onStartSwipeSession,
  onNavigateToTab
}: DiscoverVenuesModalProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [swipeSessionOpen, setSwipeSessionOpen] = useState(false);
  const [swipeDeck, setSwipeDeck] = useState<any[]>([]);
  const [swipeSessionId, setSwipeSessionId] = useState<string>("");

  const handleGenerateCategory = async () => {
    if (!selectedCategory) {
      toast({
        title: "Category required",
        description: "Please select a category to generate venues",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await apiRequest("POST", `/api/groups/${groupId}/generate-category`, {
        category: selectedCategory,
      });

      toast({
        title: "Venues generated",
      });

      // Refresh activities
      await queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/activities`] });

      onOpenChange(false);
      onNavigateToTab?.("activities");
    } catch (error: any) {
      toast({
        title: "Error generating venues",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartSwipe = async () => {
    setIsGenerating(true);
    try {
      // Call the discover-venues endpoint (cache-first strategy)
      const response = await apiRequest("POST", `/api/groups/${groupId}/discover-venues`, {
        count: 15,  // Reduced count - cache-first strategy fills efficiently
      });

      // Set the deck and session ID
      setSwipeDeck(response.deck || []);
      setSwipeSessionId(response.sessionId);

      // Close discovery modal and open swipe session
      onOpenChange(false);
      setSwipeSessionOpen(true);

      toast({
        title: "Ready to swipe!",
        description: `Found ${response.totalVenues} venues for you to discover`,
      });
    } catch (error: any) {
      toast({
        title: "Error starting swipe session",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGoToActivities = () => {
    onOpenChange(false);
    onNavigateToTab?.("activities");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Discover Venues
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="category" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="category" className="gap-2">
              <Grid3x3 className="h-4 w-4" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="swipe" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Swipe to Find
            </TabsTrigger>
            <TabsTrigger value="nearby" className="gap-2">
              <MapPin className="h-4 w-4" />
              Smart Picks
            </TabsTrigger>
          </TabsList>

          {/* By Category Tab */}
          <TabsContent value="category" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generate Suggestions
                </CardTitle>
                <CardDescription>
                  Find venues by category
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category-select">Select Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category-select">
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <span className="flex items-center gap-2">
                            <span>{category.icon}</span>
                            <span>{category.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerateCategory}
                    disabled={isGenerating || !selectedCategory}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Venues
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Swipe Tab */}
          <TabsContent value="swipe" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Swipe-Based Discovery
                </CardTitle>
                <CardDescription>
                  Swipe through venues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    onClick={handleStartSwipe}
                    className="gap-2"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading Venues...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Start Swipe Session
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Picks Tab */}
          <TabsContent value="nearby" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Browse Suggestions
                </CardTitle>
                <CardDescription>
                  View all suggestions in the Activities tab
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={handleGoToActivities} className="gap-2">
                    Go to Activities Tab
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Swipe Session Modal */}
      <SwipeSessionWithDeck
        groupId={groupId}
        open={swipeSessionOpen}
        onOpenChange={setSwipeSessionOpen}
        initialDeck={swipeDeck}
        sessionId={swipeSessionId}
        onComplete={() => {
          setSwipeSessionOpen(false);
          queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
          toast({
            title: "Discovery complete!",
            description: "Check your Favorites tab to see what you added",
          });
          onNavigateToTab?.("favorites");
        }}
      />
    </Dialog>
  );
}
