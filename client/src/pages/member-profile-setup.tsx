import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MapPin, Heart, Calendar, CheckCircle } from "lucide-react";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

type AvailabilityGridType = Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>;

const ACTIVITY_CATEGORIES = [
  { id: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { id: "brunch", label: "Brunch", emoji: "🥞" },
  { id: "cafes", label: "Cafes & Coffee", emoji: "☕" },
  { id: "wine-bars", label: "Wine Bars", emoji: "🍷" },
  { id: "breweries", label: "Breweries", emoji: "🍺" },
  { id: "dessert", label: "Dessert", emoji: "🍰" },
  { id: "concerts", label: "Concerts", emoji: "🎵" },
  { id: "karaoke", label: "Karaoke", emoji: "🎤" },
  { id: "dancing", label: "Dancing", emoji: "💃" },
  { id: "comedy", label: "Comedy Shows", emoji: "😂" },
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "museums", label: "Museums & Art", emoji: "🎨" },
  { id: "sports", label: "Sports Events", emoji: "⚽" },
  { id: "outdoor", label: "Outdoor Activities", emoji: "🌲" },
  { id: "games", label: "Games & Arcades", emoji: "🎮" },
  { id: "trivia", label: "Trivia Nights", emoji: "🧠" },
];

export default function MemberProfileSetup() {
  const [, params] = useRoute("/member-profile-setup/:memberId");
  const memberId = params?.memberId;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(1);
  const hasAutoAdvanced = useRef(false);

  // Step 1: Home base location
  const [homeLocation, setHomeLocation] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodedData, setGeocodedData] = useState<{ lat: number; lng: number } | null>(null);

  // Step 2: Activity preferences
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Step 3: Personal availability
  const [availability, setAvailability] = useState<AvailabilityGridType>({
    Monday: { morning: false, afternoon: false, evening: false },
    Tuesday: { morning: false, afternoon: false, evening: false },
    Wednesday: { morning: false, afternoon: false, evening: false },
    Thursday: { morning: false, afternoon: false, evening: false },
    Friday: { morning: false, afternoon: false, evening: false },
    Saturday: { morning: false, afternoon: false, evening: false },
    Sunday: { morning: false, afternoon: false, evening: false },
  });

  // Fetch member data to verify ownership
  const { data: member, isLoading: memberLoading } = useQuery<{
    id: string;
    userId: string | null;
    name: string | null;
    homeBaseLocation: string | null;
    homeBaseLatitude: string | null;
    homeBaseLongitude: string | null;
    activityPreferences: string[] | null;
    personalAvailability: AvailabilityGridType | null;
    profileCompleted: boolean;
  }>({
    queryKey: ["/api/members", memberId],
    enabled: !!memberId && !!user,
  });
  
  // Preload existing profile data
  useEffect(() => {
    if (member) {
      if (member.homeBaseLocation) {
        setHomeLocation(member.homeBaseLocation);
      }
      if (member.homeBaseLatitude && member.homeBaseLongitude) {
        setGeocodedData({
          lat: parseFloat(member.homeBaseLatitude),
          lng: parseFloat(member.homeBaseLongitude)
        });
        // If coordinates exist and we haven't auto-advanced yet, start on step 2 (skip location entry)
        if (!hasAutoAdvanced.current) {
          setStep(2);
          hasAutoAdvanced.current = true;
        }
      }
      if (member.activityPreferences) {
        setSelectedCategories(member.activityPreferences);
      }
      if (member.personalAvailability) {
        setAvailability(member.personalAvailability);
      }
    }
  }, [member]);

  // Geocode location
  const handleGeocodeLocation = async () => {
    if (!homeLocation.trim()) {
      toast({
        title: "Location required",
        description: "Please enter your home base location",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(homeLocation)}`
      );
      const data = await response.json();

      if (data.latitude && data.longitude) {
        setGeocodedData({ lat: data.latitude, lng: data.longitude });
        toast({
          title: "Location found!",
          description: `${data.formattedAddress || homeLocation}`,
        });
        setStep(2);
      } else {
        toast({
          title: "Location not found",
          description: "Please try a different location",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to geocode location",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/members/${memberId}/profile`, {
        homeBaseLocation: homeLocation,
        homeBaseLatitude: geocodedData?.lat,
        homeBaseLongitude: geocodedData?.lng,
        activityPreferences: selectedCategories,
        personalAvailability: availability,
        profileCompleted: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Profile completed!",
        description: "Your preferences have been saved",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleComplete = () => {
    updateProfileMutation.mutate();
  };

  const handleSkip = () => {
    setLocation("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to complete your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!member || member.userId !== (user as any)?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Not Authorized</CardTitle>
            <CardDescription>You don't have permission to edit this profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s === step ? "bg-primary" : s < step ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Home Base Location */}
        {step === 1 && (
          <Card data-testid="card-step-1">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-6 w-6 text-primary" />
                <CardTitle>Where are you based?</CardTitle>
              </div>
              <CardDescription>
                This helps us suggest activities near you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Home Base Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA"
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleGeocodeLocation();
                    }
                  }}
                  data-testid="input-location"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGeocodeLocation}
                  disabled={isGeocoding || !homeLocation.trim()}
                  className="flex-1"
                  data-testid="button-next-step-1"
                >
                  {isGeocoding ? "Finding..." : "Next"}
                </Button>
                <Button variant="outline" onClick={handleSkip} data-testid="button-skip">
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Activity Preferences */}
        {step === 2 && (
          <Card data-testid="card-step-2">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-6 w-6 text-primary" />
                <CardTitle>What do you enjoy doing?</CardTitle>
              </div>
              <CardDescription>
                Select all activities you're interested in with this group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {ACTIVITY_CATEGORIES.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={category.id}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                      data-testid={`checkbox-category-${category.id}`}
                    />
                    <Label
                      htmlFor={category.id}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <span>{category.emoji}</span>
                      <span className="text-sm">{category.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step-2">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1"
                  data-testid="button-next-step-2"
                >
                  Next
                </Button>
                <Button variant="outline" onClick={handleSkip} data-testid="button-skip-step-2">
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Personal Availability */}
        {step === 3 && (
          <Card data-testid="card-step-3">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-6 w-6 text-primary" />
                <CardTitle>When are you typically free?</CardTitle>
              </div>
              <CardDescription>
                This helps the group plan events at times that work for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AvailabilityGrid value={availability} onChange={setAvailability} />
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step-3">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={updateProfileMutation.isPending}
                  className="flex-1 gap-2"
                  data-testid="button-complete"
                >
                  <CheckCircle className="h-4 w-4" />
                  {updateProfileMutation.isPending ? "Saving..." : "Complete Profile"}
                </Button>
                <Button variant="outline" onClick={handleSkip} data-testid="button-skip-step-3">
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
