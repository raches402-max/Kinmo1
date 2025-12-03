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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from "emoji-picker-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
import { ArrowLeft, ArrowRight, Plus, X, Users, Loader2, Check, MapPin, Calendar, Sparkles, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { SwipeSession } from "@/components/SwipeSession";
import { HelpTooltip } from "@/components/HelpTooltip";
import { GroupCreatedSuccess } from "@/components/GroupCreatedSuccess";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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


const groupEmojis = [
  "🎉", "🍕", "🎸", "🎮", "⚽", "🎬", "🍻", "☕",
  "🌮", "🎯", "🎭", "🎨", "🍔", "🎵", "🏃", "🎲"
];

function getRandomEmoji() {
  return groupEmojis[Math.floor(Math.random() * groupEmojis.length)];
}

// Minimal progress bar for mobile
function MobileProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full">
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Desktop step indicator
function DesktopStepIndicator({ currentStep, steps }: { currentStep: number; steps: { title: string; icon: React.ReactNode }[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={index} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
                isCompleted && "bg-primary/10 text-primary",
                isCurrent && "bg-primary text-primary-foreground shadow-md",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm">{step.icon}</span>
              )}
              <span className="text-sm font-medium">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEPS = [
  { title: "Basics", icon: <Sparkles className="h-4 w-4" /> },
  { title: "Preferences", icon: <Calendar className="h-4 w-4" /> },
  { title: "Members", icon: <Users className="h-4 w-4" /> },
];

export default function CreateGroup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Mobile Header - Minimal with progress */}
      {isMobile ? (
        <header className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 safe-area-pt">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-3">
              <Link href="/">
                <button className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </Link>
              <span className="text-sm font-medium text-muted-foreground">
                {currentStep + 1} of {STEPS.length}
              </span>
              <div className="w-9" /> {/* Spacer for centering */}
            </div>
            <MobileProgressBar currentStep={currentStep} totalSteps={STEPS.length} />
          </div>
        </header>
      ) : (
        /* Desktop Header */
        <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Create Your Group</h1>
            <div className="w-20" />
          </div>
        </header>
      )}

      {/* Form Content */}
      <div className={cn(
        "mx-auto",
        isMobile ? "px-5 pt-6 pb-44" : "max-w-3xl px-6 py-12"
      )}>
        {/* Desktop Step Indicator */}
        {!isMobile && (
          <DesktopStepIndicator currentStep={currentStep} steps={STEPS} />
        )}

        {/* Mobile Step Title */}
        {isMobile && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {currentStep === 0 && "Let's create your group"}
              {currentStep === 1 && "What do you like?"}
              {currentStep === 2 && "Invite your people"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentStep === 0 && "Tell us the basics"}
              {currentStep === 1 && "Help us find the right spots"}
              {currentStep === 2 && "Add members now or share a link later"}
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step 1: Basics */}
            {currentStep === 0 && (
              <div className={cn(
                "space-y-6",
                !isMobile && "bg-card rounded-2xl border p-8 shadow-sm"
              )}>
                {!isMobile && (
                  <div className="mb-2">
                    <h2 className="text-xl font-semibold">Let's get started</h2>
                    <p className="text-muted-foreground text-sm">Tell us about your group</p>
                  </div>
                )}

                {/* Emoji + Name - Mobile: Stacked, Desktop: Side by side */}
                <div className={cn(
                  isMobile ? "space-y-4" : "flex gap-4"
                )}>
                  <FormField
                    control={form.control}
                    name="emoji"
                    render={({ field }) => (
                      <FormItem className={cn(isMobile && "flex flex-col items-center")}>
                        <FormLabel className={cn(isMobile && "sr-only")}>Icon</FormLabel>
                        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all",
                                isMobile ? "w-24 h-24 text-5xl" : "w-16 h-16 text-3xl"
                              )}
                              data-testid="button-choose-emoji"
                            >
                              {field.value || "🎉"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align={isMobile ? "center" : "start"}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                field.onChange(emojiData.emoji);
                                setEmojiPickerOpen(false);
                              }}
                              width={isMobile ? 320 : 350}
                              height={isMobile ? 350 : 400}
                            />
                          </PopoverContent>
                        </Popover>
                        {isMobile && (
                          <span className="text-xs text-muted-foreground mt-2">Tap to change</span>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className={cn(isMobile && "text-base font-medium")}>
                          Group Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Friday Night Crew"
                            className={cn(
                              "transition-all focus:ring-2 focus:ring-primary/20",
                              isMobile ? "h-14 text-lg rounded-xl" : "h-14 text-lg"
                            )}
                            {...field}
                            data-testid="input-group-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location */}
                <FormField
                  control={form.control}
                  name="locationBase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(
                        "flex items-center gap-2",
                        isMobile && "text-base font-medium"
                      )}>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Where do you usually meet?
                        <HelpTooltip
                          content="We'll search for venues near here."
                          examples={["San Francisco, CA", "Brooklyn, NY"]}
                        />
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="San Francisco, CA"
                          className={cn(
                            "transition-all focus:ring-2 focus:ring-primary/20",
                            isMobile && "h-12 rounded-xl"
                          )}
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Meeting Frequency */}
                <div className="space-y-3">
                  <Label className={cn(
                    "flex items-center gap-2",
                    isMobile && "text-base font-medium"
                  )}>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    How often do you want to meet?
                    <HelpTooltip content="This helps us suggest events at the right pace." />
                  </Label>

                  {isMobile ? (
                    // Mobile: Clean horizontal layout like Google Calendar
                    <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl">
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={frequencyNumber}
                          onChange={(e) => setFrequencyNumber(parseInt(e.target.value) || 1)}
                          className="w-16 h-12 text-center text-lg font-semibold rounded-xl"
                          data-testid="input-frequency-number"
                        />
                        <span className="text-muted-foreground font-medium">×</span>
                        <span className="text-muted-foreground">per</span>
                      </div>
                      <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                        <SelectTrigger
                          className="w-28 h-12 rounded-xl font-medium"
                          data-testid="select-frequency-unit"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">week</SelectItem>
                          <SelectItem value="month">month</SelectItem>
                          <SelectItem value="quarter">quarter</SelectItem>
                          <SelectItem value="year">year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    // Desktop: Compact inline input
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
                      <span className="text-sm text-muted-foreground whitespace-nowrap">time(s) per</span>
                      <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                        <SelectTrigger className="flex-1" data-testid="select-frequency-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">week</SelectItem>
                          <SelectItem value="month">month</SelectItem>
                          <SelectItem value="quarter">quarter</SelectItem>
                          <SelectItem value="year">year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Budget Slider */}
                <div className="space-y-4">
                  <Label className={cn(
                    "flex items-center gap-2",
                    isMobile && "text-base font-medium"
                  )}>
                    💰 Budget per person
                    <HelpTooltip content="Typical price range per person for venues." />
                  </Label>
                  <div className={cn(
                    "rounded-xl p-4",
                    isMobile ? "bg-muted/50" : "bg-muted/30"
                  )}>
                    <Slider
                      min={0}
                      max={250}
                      step={10}
                      value={budgetRange}
                      onValueChange={setBudgetRange}
                      className="w-full"
                      data-testid="slider-budget"
                    />
                    <div className="flex justify-between mt-3">
                      <span className={cn(
                        "font-semibold",
                        isMobile ? "text-lg" : "text-base"
                      )}>
                        ${budgetRange[0]}
                      </span>
                      <span className={cn(
                        "font-semibold",
                        isMobile ? "text-lg" : "text-base"
                      )}>
                        {budgetRange[1] >= 250 ? "$250+" : `$${budgetRange[1]}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Preferences */}
            {currentStep === 1 && (
              <div className={cn(
                "space-y-8",
                !isMobile && "bg-card rounded-2xl border p-8 shadow-sm"
              )}>
                {!isMobile && (
                  <div className="mb-2">
                    <h2 className="text-xl font-semibold">What do you like to do?</h2>
                    <p className="text-muted-foreground text-sm">Help us find the right spots for your group</p>
                  </div>
                )}

                {/* Activity Categories - Mobile: Grid of cards */}
                <div className="space-y-3">
                  <Label className={cn(
                    "flex items-center gap-2",
                    isMobile ? "text-base font-medium" : "text-base"
                  )}>
                    What types of activities?
                    <HelpTooltip
                      content="Selected categories appear more often in venue recommendations."
                    />
                  </Label>
                  <div className={cn(
                    isMobile ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-2"
                  )}>
                    {[
                      { key: 'mealEnabled', emoji: '🍽️', label: 'Meals', color: 'bg-activity-meals' },
                      { key: 'cafeEnabled', emoji: '☕', label: 'Cafes', color: 'bg-activity-cafes' },
                      { key: 'drinksEnabled', emoji: '🍺', label: 'Drinks', color: 'bg-activity-drinks' },
                      { key: 'dessertEnabled', emoji: '🍰', label: 'Dessert', color: 'bg-activity-dessert' },
                      { key: 'experiencesEnabled', emoji: '🎭', label: 'Experiences', color: 'bg-activity-experiences' },
                    ].map(({ key, emoji, label, color }) => {
                      const isEnabled = categoryToggles[key as keyof typeof categoryToggles];
                      return isMobile ? (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCategoryToggles({ ...categoryToggles, [key]: !isEnabled })}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                            isEnabled
                              ? `${color} border-transparent text-white shadow-md`
                              : "bg-background border-muted hover:border-muted-foreground/30"
                          )}
                        >
                          <span className="text-2xl">{emoji}</span>
                          <span className="font-medium">{label}</span>
                          {isEnabled && <Check className="h-4 w-4 ml-auto" />}
                        </button>
                      ) : (
                        <Button
                          key={key}
                          type="button"
                          variant={isEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCategoryToggles({ ...categoryToggles, [key]: !isEnabled })}
                          className={isEnabled ? `gap-1.5 ${color} hover:opacity-90 text-white` : "gap-1.5"}
                        >
                          {emoji} {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Novelty Slider */}
                <div className="space-y-4">
                  <Label className={cn(isMobile && "text-base font-medium")}>
                    How adventurous is your group?
                  </Label>
                  <div className={cn(
                    "rounded-xl p-4",
                    isMobile ? "bg-muted/50" : "bg-muted/30"
                  )}>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[novelty]}
                      onValueChange={(value) => setNovelty(value[0])}
                      className="w-full"
                      data-testid="slider-novelty"
                    />
                    <div className="flex justify-between mt-3 text-sm text-muted-foreground">
                      <span>🏠 Stick to favorites</span>
                      <span>🚀 Try new things</span>
                    </div>
                  </div>
                </div>

                {/* Availability Grid */}
                <div className="space-y-3">
                  <Label className={cn(isMobile && "text-base font-medium")}>
                    When are you usually free?
                  </Label>
                  <AvailabilityGrid
                    value={availability}
                    onChange={setAvailability}
                  />
                </div>

                {/* Additional Instructions */}
                <FormField
                  control={form.control}
                  name="additionalInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(isMobile && "text-base font-medium")}>
                        Anything else we should know? (optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Need accessible venues, prefer outdoor seating..."
                          className={cn(
                            "resize-none",
                            isMobile ? "h-24 rounded-xl" : "h-20"
                          )}
                          {...field}
                          data-testid="textarea-additional-instructions"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Members */}
            {currentStep === 2 && (
              <div className={cn(
                "space-y-6",
                !isMobile && "bg-card rounded-2xl border p-8 shadow-sm"
              )}>
                {!isMobile && (
                  <div className="mb-2">
                    <h2 className="text-xl font-semibold">Invite your people</h2>
                    <p className="text-muted-foreground text-sm">
                      Add members now or share a link later — totally optional.
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center ml-1 cursor-help text-muted-foreground/70 hover:text-muted-foreground">
                              Why emails?
                              <HelpCircle className="h-3 w-3 ml-0.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] p-3 text-sm">
                            <p className="font-medium mb-1">Why add emails?</p>
                            <p className="text-muted-foreground leading-relaxed">
                              Members with emails get notified when events are planned. Without email, they'll need to check the app or be reached out to directly. No spam — just updates from the group.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {members.map((member, index) => (
                    <div
                      key={index}
                      className={cn(
                        "relative",
                        isMobile && "bg-muted/30 rounded-xl p-4"
                      )}
                    >
                      {isMobile ? (
                        // Mobile: Stacked layout with better spacing
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Member {index + 1}
                            </span>
                            {members.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMember(index)}
                                className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                data-testid={`button-remove-member-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <Input
                            placeholder="Name"
                            value={member.name}
                            onChange={(e) => updateMember(index, "name", e.target.value)}
                            className="h-12 rounded-xl"
                            data-testid={`input-member-name-${index}`}
                          />
                          <Input
                            type="email"
                            placeholder="Email (optional)"
                            value={member.email}
                            onChange={(e) => updateMember(index, "email", e.target.value)}
                            className="h-12 rounded-xl"
                            data-testid={`input-member-email-${index}`}
                          />
                        </div>
                      ) : (
                        // Desktop: Side by side
                        <div className="flex gap-3 items-start">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <Input
                              placeholder="Name"
                              value={member.name}
                              onChange={(e) => updateMember(index, "name", e.target.value)}
                              data-testid={`input-member-name-${index}`}
                            />
                            <Input
                              type="email"
                              placeholder="Email (optional)"
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
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addMember}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl transition-colors",
                      isMobile
                        ? "py-4 text-base border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                        : "py-3 text-sm border-muted hover:border-muted-foreground/30"
                    )}
                    data-testid="button-add-member"
                  >
                    <Plus className="h-4 w-4" />
                    Add Another Member
                  </button>
                </div>

                <p className={cn(
                  "text-center text-muted-foreground",
                  isMobile ? "text-sm pt-2" : "text-sm pt-4"
                )}>
                  You can always invite more people after creating the group
                </p>
              </div>
            )}

            {/* Desktop Navigation Buttons */}
            {!isMobile && (
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
            )}
          </form>
        </Form>
      </div>

      {/* Mobile Fixed Bottom Navigation - positioned above BottomNav (h-16 = 64px) */}
      {isMobile && (
        <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur border-t z-40">
          <div className="px-5 py-3 flex items-center gap-3">
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                className="h-12 px-4 rounded-xl"
                data-testid="button-back-step"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-12" /> // Spacer when no back button
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={!canGoNext()}
                className="flex-1 h-12 rounded-xl text-base font-semibold"
                data-testid="button-next-step"
              >
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={createGroupMutation.isPending}
                className="flex-1 h-12 rounded-xl text-base font-semibold"
                data-testid="button-create-submit"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create Group
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

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
