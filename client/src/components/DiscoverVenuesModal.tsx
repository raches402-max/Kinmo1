import { useState } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Compass, Sparkles, Grid3x3, MapPin, Loader2, ArrowRight, TrendingUp, ChevronDown, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SwipeSessionWithDeck } from "@/components/SwipeSessionWithDeck";
import { VenuePreviewModal } from "@/components/VenuePreviewModal";
import { LoadingState, TimeAwareLoading } from "@/components/LoadingState";
import { ErrorDisplay, getErrorToast } from "@/components/ErrorDisplay";

interface DiscoverVenuesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onStartSwipeSession?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const CATEGORY_OPTIONS = [
  { value: "meal", label: "Restaurants & Meals", icon: "🍽️" },
  { value: "cafes", label: "Cafes & Coffee", icon: "☕" },
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

  // Category tab state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [radius, setRadius] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);

  // Advanced options state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [venueCount, setVenueCount] = useState<number>(9);
  const [sortBy, setSortBy] = useState<string>("rating");
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>("");

  // Helper function to get price level labels
  const getBudgetPriceLevels = (budget: number | null) => {
    if (!budget) return "Using group default";
    if (budget <= 30) return "Allows: $";
    if (budget <= 60) return "Allows: $, $$";
    if (budget < 100) return "Allows: $, $$, $$$";
    return "Allows: All price levels";
  };

  // Swipe session state
  const [swipeSessionOpen, setSwipeSessionOpen] = useState(false);
  const [swipeDeck, setSwipeDeck] = useState<any[]>([]);
  const [swipeSessionId, setSwipeSessionId] = useState<string>("");

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [generatedVenues, setGeneratedVenues] = useState<any[]>([]);
  const [previewSearchLocation, setPreviewSearchLocation] = useState<string>("");

  // Error handling state
  const [error, setError] = useState<any>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);

  const handleGenerateCategory = async () => {
    if (!selectedCategory) {
      toast({
        title: "Missing Information",
        description: "Please select a category to generate venues",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLoadingStartTime(Date.now());

    try {
      const requestBody: any = {
        category: selectedCategory,
        radius,
        count: venueCount,
        sortBy,
      };

      // Add location if specified
      if (location.trim()) {
        requestBody.location = { address: location };
      }

      // Add budget override if specified
      if (budgetOverride !== null) {
        requestBody.budgetOverride = budgetOverride;
      }

      // Add custom instructions if specified
      if (customInstructions.trim()) {
        requestBody.tempInstructions = customInstructions;
      }

      const venues = await apiRequest(
        "POST",
        `/api/groups/${groupId}/generate-category`,
        requestBody,
        { retry: true, maxRetries: 2, timeout: 30000 }
      );

      // Store the venues and open preview modal
      setGeneratedVenues(venues);
      setPreviewSearchLocation(location.trim() || "Default location");
      onOpenChange(false);
      setPreviewModalOpen(true);

      toast({
        title: "Venues Generated!",
        description: `Found ${venues.length} great venues for you`,
      });
    } catch (error: any) {
      setError(error);
      toast(getErrorToast(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const retryGenerateCategory = () => {
    setError(null);
    handleGenerateCategory();
  };

  const handleStartSwipe = async () => {
    setIsGenerating(true);
    setError(null);
    setLoadingStartTime(Date.now());

    try {
      // Call the discover-venues endpoint (cache-first strategy)
      const response = await apiRequest(
        "POST",
        `/api/groups/${groupId}/discover-venues`,
        { count: 15 },
        { retry: true, maxRetries: 2, timeout: 30000 }
      );

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
      setError(error);
      toast(getErrorToast(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const retryStartSwipe = () => {
    setError(null);
    handleStartSwipe();
  };

  const handleGoToVenueLibrary = () => {
    onOpenChange(false);
    onNavigateToTab?.("venue-library");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Discover Venues
          </DialogTitle>
          <DialogDescription>
            Find new venues to add to your group's library
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
                  Generate Venues by Category
                </CardTitle>
                <CardDescription>
                  AI will find 5-10 top-rated venues in your selected category and add them to your Venue Library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show error if exists */}
                {error && !isGenerating && (
                  <ErrorDisplay error={error} onRetry={retryGenerateCategory} />
                )}

                {/* Show loading state */}
                {isGenerating && (
                  <LoadingState
                    type="ai-generation"
                    showProgress={true}
                    className="my-4"
                  />
                )}

                {!isGenerating && (
                  <>
                    {/* Category Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="category-select">Category *</Label>
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

                {/* Location Input */}
                <div className="space-y-2">
                  <Label htmlFor="location-input">Location (optional)</Label>
                  <Input
                    id="location-input"
                    placeholder="e.g., Mission District, Downtown Oakland, specific address..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use your group's default location
                  </p>
                </div>

                {/* Radius Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="radius-slider">Search Radius</Label>
                    <span className="text-sm text-muted-foreground">{radius} miles</span>
                  </div>
                  <Slider
                    id="radius-slider"
                    min={2}
                    max={50}
                    step={1}
                    value={[radius]}
                    onValueChange={(value) => setRadius(value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    How far from the location to search
                  </p>
                </div>

                {/* Advanced Options */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between p-2">
                      <span className="flex items-center gap-2 text-sm">
                        <Settings className="h-4 w-4" />
                        Advanced Options
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {/* Venue Count */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="count-slider">Number of Venues</Label>
                        <span className="text-sm text-muted-foreground">{venueCount}</span>
                      </div>
                      <Slider
                        id="count-slider"
                        min={3}
                        max={20}
                        step={1}
                        value={[venueCount]}
                        onValueChange={(value) => setVenueCount(value[0])}
                        className="w-full"
                      />
                    </div>

                    {/* Sort Preference */}
                    <div className="space-y-2">
                      <Label htmlFor="sort-select">Sort By</Label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger id="sort-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rating">Highest Rated</SelectItem>
                          <SelectItem value="distance">Closest Distance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Budget Override */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <Label htmlFor="budget-slider">Budget Override (optional)</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Override group budget for this search
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">
                            {budgetOverride ? `$${budgetOverride}` : "Default"}
                          </span>
                          {budgetOverride && (
                            <button
                              type="button"
                              onClick={() => setBudgetOverride(null)}
                              className="text-xs text-primary hover:underline block"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <Slider
                        id="budget-slider"
                        min={20}
                        max={150}
                        step={10}
                        value={[budgetOverride || 60]}
                        onValueChange={(value) => setBudgetOverride(value[0])}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        {getBudgetPriceLevels(budgetOverride)}
                      </p>
                    </div>

                    {/* Custom Instructions */}
                    <div className="space-y-2">
                      <Label htmlFor="instructions">Custom Instructions (optional)</Label>
                      <Textarea
                        id="instructions"
                        placeholder="e.g., 'Focus on outdoor seating', 'Must be family-friendly', 'Prefer upscale venues'..."
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleGenerateCategory}
                    disabled={isGenerating || !selectedCategory}
                  >
                    {isGenerating ? (
                      <TimeAwareLoading
                        startTime={loadingStartTime}
                        normalMessage="Generating venues..."
                        slowMessage="This is taking longer than usual..."
                        slowThreshold={15000}
                      />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Venues
                      </>
                    )}
                      </Button>
                    </div>
                  </>
                )}
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
                  Swipe right to save venues you like, left to skip. Build your library by discovering one venue at a time!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show error if exists */}
                {error && !isGenerating && (
                  <ErrorDisplay error={error} onRetry={retryStartSwipe} />
                )}

                {/* Show loading state */}
                {isGenerating && (
                  <LoadingState
                    type="venue-search"
                    showProgress={true}
                    className="my-4"
                  />
                )}

                {!isGenerating && (
                  <>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">How it works:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Swipe right (👍) to add venues to your library</li>
                    <li>Swipe left (👎) to skip</li>
                    <li>AI shows you a mix of popular and hidden gems</li>
                    <li>All saved venues appear in your Venue Library</li>
                  </ul>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleStartSwipe}
                    className="gap-2"
                    disabled={isGenerating}
                  >
                    <Sparkles className="h-4 w-4" />
                    Start Swipe Session
                  </Button>
                </div>
                </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Picks Tab */}
          <TabsContent value="nearby" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Browse Curated Venues
                </CardTitle>
                <CardDescription>
                  View all AI-generated suggestions and favorites in your Venue Library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">In the Venue Library you can:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Browse all your saved venues</li>
                    <li>Filter by category, rating, and price</li>
                    <li>View venues on a map</li>
                    <li>Add venues directly to events</li>
                    <li>Regenerate suggestions anytime</li>
                  </ul>
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={handleGoToVenueLibrary} className="gap-2">
                    Go to Venue Library
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
            description: "Check your Venue Library to see what you saved",
          });
          onNavigateToTab?.("venue-library");
        }}
      />

      {/* Venue Preview Modal */}
      <VenuePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        venues={generatedVenues}
        category={selectedCategory}
        searchLocation={previewSearchLocation}
        searchRadius={radius}
        groupId={groupId}
        onComplete={() => {
          onNavigateToTab?.("venue-library");
        }}
      />
    </Dialog>
  );
}
