import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from "emoji-picker-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, X, Users, Mic2, Music, Trophy, Mountain, PartyPopper, Gamepad2, Palette, Film, Laugh, GraduationCap, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { HelpTooltip } from "@/components/HelpTooltip";
import { GroupCreatedSuccess } from "@/components/GroupCreatedSuccess";

const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  emoji: z.string().default("🎉"),
  locationBase: z.string().min(1, "Location is required"),
  budgetMin: z.number().min(0),
  budgetMax: z.number().min(0),
  meetingFrequency: z.string().min(1, "Meeting frequency is required"),
  closenessLevel: z.number().min(1).max(5),
  noveltyPreference: z.number().min(1).max(5),
  pastPreferences: z.string().optional(),
  additionalInstructions: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type MemberInput = {
  name: string;
  email: string;
};

const closenessLabels = ["Acquaintances", "Friends", "Good Friends", "Close Friends", "Best Friends"];
const noveltyLabels = ["We like our usual spots", "Leaning familiar", "Open sometimes", "Pretty adventurous", "Always up for new things!"];

const activityCategories = [
  { id: "concerts", label: "Concerts", icon: Music },
  { id: "karaoke", label: "Karaoke", icon: Mic2 },
  { id: "dancing", label: "Dancing / Clubs", icon: PartyPopper },
  { id: "comedy", label: "Comedy Shows", icon: Laugh },
  { id: "movies", label: "Movie Theaters", icon: Film },
  { id: "museums", label: "Museums / Art Galleries", icon: Palette },
  { id: "sports", label: "Sports Games", icon: Trophy },
  { id: "outdoors", label: "Hikes / Outdoors", icon: Mountain },
  { id: "game-nights", label: "Game Nights", icon: Gamepad2 },
  { id: "trivia", label: "Trivia Nights", icon: GraduationCap },
  { id: "family", label: "Family Activities", icon: Users },
];

const groupEmojis = [
  "🎉", "🍕", "🎸", "🎮", "⚽", "🎬", "🍻", "☕", 
  "🌮", "🎯", "🎭", "🎨", "🍔", "🎵", "🏃", "🎲"
];

function getRandomEmoji() {
  return groupEmojis[Math.floor(Math.random() * groupEmojis.length)];
}

export default function CreateGroup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberInput[]>([{ name: "", email: "" }]);
  const [budgetRange, setBudgetRange] = useState<number[]>([0, 60]);
  const [closeness, setCloseness] = useState(3);
  const [novelty, setNovelty] = useState(3);
  const [availability, setAvailability] = useState(createEmptyAvailability());
  const [frequencyNumber, setFrequencyNumber] = useState(1);
  const [frequencyUnit, setFrequencyUnit] = useState("week");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showSwipeSession, setShowSwipeSession] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdGroupData, setCreatedGroupData] = useState<any>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [categoryToggles, setCategoryToggles] = useState({
    mealEnabled: true,
    cafeEnabled: true,
    drinksEnabled: true,
    dessertEnabled: true,
    experiencesEnabled: true,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      emoji: getRandomEmoji(),
      locationBase: "",
      budgetMin: 0,
      budgetMax: 60,
      meetingFrequency: "1-week",
      closenessLevel: 3,
      noveltyPreference: 3,
      pastPreferences: "",
      additionalInstructions: "",
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: FormValues & { 
      availability: any;
      members: MemberInput[];
      activityCategories?: string[];
    }) => {
      return await apiRequest("POST", "/api/groups", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreatedGroupId(data.id);
      setCreatedGroupData(data);
      // Show success screen
      setShowSuccessScreen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleSwipeComplete() {
    if (createdGroupId) {
      setShowSwipeSession(false);
      toast({
        title: "Preferences saved!",
        description: "Generating AI-powered activity suggestions...",
      });
      navigate(`/group/${createdGroupId}`);
    }
  }

  function handleSuccessContinue() {
    setShowSuccessScreen(false);
    // Show swipe session
    setShowSwipeSession(true);
  }

  const onSubmit = (data: FormValues) => {
    const validMembers = members.filter(m => m.name || m.email);
    createGroupMutation.mutate({
      ...data,
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      meetingFrequency: `${frequencyNumber}-${frequencyUnit}`,
      closenessLevel: closeness,
      noveltyPreference: novelty,
      activityCategories: selectedCategories.length > 0 ? selectedCategories : undefined,
      availability,
      members: validMembers,
      ...categoryToggles,
    });
  };

  const addMember = () => {
    setMembers([...members, { name: "", email: "" }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: "name" | "email", value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Create Your Group</h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
            {/* Group Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Friday Night Crew" {...field} data-testid="input-group-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Icon</FormLabel>
                      <div className="flex items-center gap-3">
                        <div className="text-4xl" data-testid="text-selected-emoji">{field.value || "🎉"}</div>
                        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm"
                              data-testid="button-choose-emoji"
                            >
                              Choose emoji 🙂
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="overflow-hidden rounded-lg">
                              <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                  field.onChange(emojiData.emoji);
                                  setEmojiPickerOpen(false);
                                }}
                                width={350}
                                height={400}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationBase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        Location Base
                        <HelpTooltip
                          content="The city or area where your group meets. We'll search for venues near here."
                          examples={["San Francisco, CA", "Brooklyn, NY", "Austin, TX"]}
                        />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="San Francisco, CA" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Label className="flex items-center">
                    Budget Range (per person)
                    <HelpTooltip
                      content="The typical price range per person for venues. This helps us suggest places that fit your group's budget."
                      examples={["$0-$20 for casual cafes", "$20-$60 for restaurants", "$60+ for fine dining"]}
                    />
                  </Label>
                  <div className="space-y-4">
                    <Slider
                      min={0}
                      max={250}
                      step={10}
                      value={budgetRange}
                      onValueChange={setBudgetRange}
                      className="w-full"
                      data-testid="slider-budget"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="font-medium" data-testid="text-budget-min">${budgetRange[0]}</span>
                      <span className="font-medium" data-testid="text-budget-max">
                        {budgetRange[1] >= 250 ? "$250+" : `$${budgetRange[1]}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center">
                    How Often to Meet
                    <HelpTooltip
                      content="How frequently your group typically gets together. This helps the AI suggest new events at the right pace."
                      examples={["1x each week (weekly)", "2x each month (biweekly)", "1x each month (monthly)"]}
                    />
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={frequencyNumber}
                        onChange={(e) => setFrequencyNumber(parseInt(e.target.value) || 1)}
                        data-testid="input-frequency-number"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">x each</span>
                    <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                      <SelectTrigger className="flex-1" data-testid="select-frequency-unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">day</SelectItem>
                        <SelectItem value="week">week</SelectItem>
                        <SelectItem value="month">month</SelectItem>
                        <SelectItem value="year">year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center">
                    Group Availability
                    <HelpTooltip
                      content="Click on the grid to mark when your group is typically free to meet. The AI will suggest events during these times."
                    />
                  </Label>
                  <AvailabilityGrid
                    value={availability}
                    onChange={setAvailability}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-10">
                <div className="space-y-4">
                  <Label className="text-base flex items-center">
                    How willing is your group to try new things?
                    <HelpTooltip
                      content="This helps us balance familiar favorites with new discoveries. 'Usual spots' means mostly places you know, while 'Always up for new things' means we'll suggest lots of new venues."
                    />
                  </Label>
                  <div className="space-y-3">
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[novelty]}
                      onValueChange={(value) => setNovelty(value[0])}
                      className="w-full"
                      data-testid="slider-novelty"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>We like our usual spots</span>
                      <span>Open sometimes</span>
                      <span>Always up for new things!</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base flex items-center">
                    What types of activities interest your group?
                    <HelpTooltip
                      content="Choose which types of venues and experiences the AI should suggest. Disabled categories won't show up in suggestions."
                      examples={["Disable 'Drinks' if your group doesn't drink alcohol", "Enable 'Experiences' for concerts, museums, etc."]}
                    />
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={categoryToggles.mealEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryToggles({ ...categoryToggles, mealEnabled: !categoryToggles.mealEnabled })}
                      className={categoryToggles.mealEnabled ? "gap-1.5 bg-activity-meals hover:bg-activity-meals/90 text-white" : "gap-1.5"}
                      data-testid="button-toggle-meal"
                    >
                      <span>🍽️</span>
                      <span>Meals</span>
                    </Button>
                    <Button
                      type="button"
                      variant={categoryToggles.cafeEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryToggles({ ...categoryToggles, cafeEnabled: !categoryToggles.cafeEnabled })}
                      className={categoryToggles.cafeEnabled ? "gap-1.5 bg-activity-cafes hover:bg-activity-cafes/90 text-white" : "gap-1.5"}
                      data-testid="button-toggle-cafe"
                    >
                      <span>☕</span>
                      <span>Cafes</span>
                    </Button>
                    <Button
                      type="button"
                      variant={categoryToggles.drinksEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryToggles({ ...categoryToggles, drinksEnabled: !categoryToggles.drinksEnabled })}
                      className={categoryToggles.drinksEnabled ? "gap-1.5 bg-activity-drinks hover:bg-activity-drinks/90 text-white" : "gap-1.5"}
                      data-testid="button-toggle-drinks"
                    >
                      <span>🍺</span>
                      <span>Drinks</span>
                    </Button>
                    <Button
                      type="button"
                      variant={categoryToggles.dessertEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryToggles({ ...categoryToggles, dessertEnabled: !categoryToggles.dessertEnabled })}
                      className={categoryToggles.dessertEnabled ? "gap-1.5 bg-activity-dessert hover:bg-activity-dessert/90 text-white" : "gap-1.5"}
                      data-testid="button-toggle-dessert"
                    >
                      <span>🍰</span>
                      <span>Dessert</span>
                    </Button>
                    <Button
                      type="button"
                      variant={categoryToggles.experiencesEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryToggles({ ...categoryToggles, experiencesEnabled: !categoryToggles.experiencesEnabled })}
                      className={categoryToggles.experiencesEnabled ? "gap-1.5 bg-activity-experiences hover:bg-activity-experiences/90 text-white" : "gap-1.5"}
                      data-testid="button-toggle-experiences"
                    >
                      <span>🎭</span>
                      <span>Experiences</span>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground pt-2">Then select specific experience types to further refine suggestions (optional)</p>
                  <div className="flex flex-wrap gap-3">
                    {activityCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <Button
                          key={category.id}
                          type="button"
                          variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleCategory(category.id)}
                          className="gap-1.5"
                          data-testid={`button-category-${category.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{category.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="pastPreferences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What Has Your Group Enjoyed in the Past?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                          className="resize-none h-24"
                          {...field}
                          data-testid="textarea-past-preferences"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Instructions for AI (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating, avoid crowded places..."
                          className="resize-none h-24"
                          {...field}
                          data-testid="textarea-additional-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Members Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Members (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {members.map((member, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateMember(index, "name", e.target.value)}
                        data-testid={`input-member-name-${index}`}
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => updateMember(index, "email", e.target.value)}
                        data-testid={`input-member-email-${index}`}
                      />
                    </div>
                    {members.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(index)}
                        data-testid={`button-remove-member-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMember}
                  className="w-full"
                  data-testid="button-add-member"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Member
                </Button>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={createGroupMutation.isPending}
                data-testid="button-create-submit"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Group...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-5 w-5" />
                    Create Group & Get Suggestions
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Success Screen after group creation */}
      {createdGroupId && createdGroupData && (
        <GroupCreatedSuccess
          open={showSuccessScreen}
          groupId={createdGroupId}
          groupName={createdGroupData.name}
          shareableLink={createdGroupData.shareableLink}
          onContinue={handleSuccessContinue}
        />
      )}

      {/* Optional Swipe Session after success screen */}
      {createdGroupId && (
        <SwipeSession
          groupId={createdGroupId}
          open={showSwipeSession}
          onOpenChange={(open) => {
            setShowSwipeSession(open);
            if (!open) {
              navigate(`/group/${createdGroupId}`);
            }
          }}
          onComplete={handleSwipeComplete}
        />
      )}
    </div>
  );
}
