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
import { getErrorToast } from "@/components/ErrorDisplay";
import { ArrowLeft, ArrowRight, Plus, X, Users, Mic2, Music, Trophy, Mountain, PartyPopper, Gamepad2, Palette, Film, Laugh, GraduationCap, Loader2, Check } from "lucide-react";
import { Link } from "wouter";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { HelpTooltip } from "@/components/HelpTooltip";
import { GroupCreatedSuccess } from "@/components/GroupCreatedSuccess";
import { cn } from "@/lib/utils";

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

// Step indicator component
function StepIndicator({ currentStep, totalSteps, steps }: { currentStep: number; totalSteps: number; steps: { title: string }[] }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary bg-primary/10",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center hidden sm:block">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-foreground",
                      !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors",
                    index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile step label */}
      <div className="sm:hidden text-center mt-4">
        <p className="text-sm font-medium">{steps[currentStep].title}</p>
        <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {totalSteps}</p>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Basics" },
  { title: "Preferences" },
  { title: "Members" },
];

export default function CreateGroup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
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
      setShowSuccessScreen(true);
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  function handleSwipeComplete() {
    if (createdGroupId) {
      setShowSwipeSession(false);
      toast({
        title: "Preferences saved!",
        description: "Your group is ready to go",
      });
      navigate(`/group/${createdGroupId}`);
    }
  }

  function handleSuccessContinue() {
    setShowSuccessScreen(false);
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

  // Navigation
  const canGoNext = () => {
    if (currentStep === 0) {
      const name = form.getValues("name");
      const location = form.getValues("locationBase");
      return name.length > 0 && location.length > 0;
    }
    return true;
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <StepIndicator currentStep={currentStep} totalSteps={STEPS.length} steps={STEPS} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step 1: Basics */}
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Let's get started</CardTitle>
                  <CardDescription>Tell us about your group</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-4">
                    <FormField
                      control={form.control}
                      name="emoji"
                      render={({ field }) => (
                        <FormItem className="flex-shrink-0">
                          <FormLabel>Icon</FormLabel>
                          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={true}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-14 h-14 text-3xl"
                                data-testid="button-choose-emoji"
                              >
                                {field.value || "🎉"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                              <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                  field.onChange(emojiData.emoji);
                                  setEmojiPickerOpen(false);
                                }}
                                width={350}
                                height={400}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Group Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Friday Night Crew" className="h-14 text-lg" {...field} data-testid="input-group-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="locationBase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Where does your group usually meet?
                          <HelpTooltip
                            content="We'll search for venues near here."
                            examples={["San Francisco, CA", "Brooklyn, NY"]}
                          />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA" {...field} data-testid="input-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      How often do you want to meet?
                      <HelpTooltip content="This helps us suggest events at the right pace." />
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
                      <span className="text-sm text-muted-foreground">time(s) per</span>
                      <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                        <SelectTrigger className="flex-1" data-testid="select-frequency-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">week</SelectItem>
                          <SelectItem value="month">month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="flex items-center">
                      Budget per person
                      <HelpTooltip content="Typical price range per person for venues." />
                    </Label>
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
                      <span className="font-medium">${budgetRange[0]}</span>
                      <span className="font-medium">
                        {budgetRange[1] >= 250 ? "$250+" : `$${budgetRange[1]}`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Preferences */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>What do you like to do?</CardTitle>
                  <CardDescription>Help us find the right spots for your group</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-base">What types of activities?</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={categoryToggles.mealEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryToggles({ ...categoryToggles, mealEnabled: !categoryToggles.mealEnabled })}
                        className={categoryToggles.mealEnabled ? "gap-1.5 bg-activity-meals hover:bg-activity-meals/90 text-white" : "gap-1.5"}
                      >
                        🍽️ Meals
                      </Button>
                      <Button
                        type="button"
                        variant={categoryToggles.cafeEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryToggles({ ...categoryToggles, cafeEnabled: !categoryToggles.cafeEnabled })}
                        className={categoryToggles.cafeEnabled ? "gap-1.5 bg-activity-cafes hover:bg-activity-cafes/90 text-white" : "gap-1.5"}
                      >
                        ☕ Cafes
                      </Button>
                      <Button
                        type="button"
                        variant={categoryToggles.drinksEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryToggles({ ...categoryToggles, drinksEnabled: !categoryToggles.drinksEnabled })}
                        className={categoryToggles.drinksEnabled ? "gap-1.5 bg-activity-drinks hover:bg-activity-drinks/90 text-white" : "gap-1.5"}
                      >
                        🍺 Drinks
                      </Button>
                      <Button
                        type="button"
                        variant={categoryToggles.dessertEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryToggles({ ...categoryToggles, dessertEnabled: !categoryToggles.dessertEnabled })}
                        className={categoryToggles.dessertEnabled ? "gap-1.5 bg-activity-dessert hover:bg-activity-dessert/90 text-white" : "gap-1.5"}
                      >
                        🍰 Dessert
                      </Button>
                      <Button
                        type="button"
                        variant={categoryToggles.experiencesEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryToggles({ ...categoryToggles, experiencesEnabled: !categoryToggles.experiencesEnabled })}
                        className={categoryToggles.experiencesEnabled ? "gap-1.5 bg-activity-experiences hover:bg-activity-experiences/90 text-white" : "gap-1.5"}
                      >
                        🎭 Experiences
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base">How adventurous is your group?</Label>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[novelty]}
                      onValueChange={(value) => setNovelty(value[0])}
                      className="w-full"
                      data-testid="slider-novelty"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Stick to favorites</span>
                      <span>Try new things</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">When are you usually free?</Label>
                    <AvailabilityGrid
                      value={availability}
                      onChange={setAvailability}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="additionalInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anything else we should know? (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Need accessible venues, prefer outdoor seating..."
                            className="resize-none h-20"
                            {...field}
                            data-testid="textarea-additional-instructions"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 3: Members */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Invite your people</CardTitle>
                  <CardDescription>Add members now or share a link later — totally optional</CardDescription>
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
                    Add Another
                  </Button>

                  <p className="text-sm text-muted-foreground text-center pt-4">
                    You can always invite more people after creating the group
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6">
              <div>
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    data-testid="button-back-step"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext()}
                    data-testid="button-next-step"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createGroupMutation.isPending}
                    data-testid="button-create-submit"
                  >
                    {createGroupMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-5 w-5" />
                        Create Group
                      </>
                    )}
                  </Button>
                )}
              </div>
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
