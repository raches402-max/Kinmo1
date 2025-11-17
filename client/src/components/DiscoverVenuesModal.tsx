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
        title: "Venues generated!",
        description: `AI has generated ${selectedCategory} suggestions. Check the Activities tab!`,
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

  const handleStartSwipe = () => {
    onOpenChange(false);
    onStartSwipeSession?.();
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
          <DialogDescription>
            Find great places for your group to visit
          </DialogDescription>
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
                  Generate AI Suggestions
                </CardTitle>
                <CardDescription>
                  Let AI find venues based on category, location, and your preferences
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
                  <p className="text-xs text-muted-foreground">
                    AI will generate 5-10 personalized suggestions based on your group's preferences
                  </p>
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
                  Swipe through AI-curated venues to build your Favorites
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>In a swipe session, you'll:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>See a mix of AI suggestions and existing favorites</li>
                    <li>Swipe right (👍) to add to Favorites</li>
                    <li>Swipe left (👎) to pass</li>
                    <li>Help AI learn your group's preferences</li>
                  </ul>
                  <p className="pt-2 font-medium">
                    Great for quickly building a collection of venues!
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleStartSwipe} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Start Swipe Session
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
                  Browse AI Suggestions
                </CardTitle>
                <CardDescription>
                  View all AI-generated venues in the Activities tab
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>In the Activities tab, you can:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Browse AI-suggested venues by category</li>
                    <li>See venues on a map</li>
                    <li>Add favorites with a single click</li>
                    <li>Regenerate suggestions if you want different options</li>
                  </ul>
                  <p className="pt-2 font-medium">
                    Perfect for exploring all your options at once!
                  </p>
                </div>
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
    </Dialog>
  );
}
