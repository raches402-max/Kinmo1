import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Check, X, MapPin, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { apiRequest } from "@/lib/queryClient";

// Celebration component with floating particles
function CelebrationOverlay({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate random particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    size: 6 + Math.random() * 8,
    type: ['sparkle', 'heart', 'dot'][Math.floor(Math.random() * 3)] as 'sparkle' | 'heart' | 'dot',
  }));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-50 overflow-hidden">
      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-float-up pointer-events-none"
          style={{
            left: `${particle.left}%`,
            bottom: '-20px',
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        >
          {particle.type === 'sparkle' && (
            <Sparkles
              className="text-primary"
              style={{ width: particle.size, height: particle.size }}
            />
          )}
          {particle.type === 'heart' && (
            <Heart
              className="text-accent fill-accent/50"
              style={{ width: particle.size, height: particle.size }}
            />
          )}
          {particle.type === 'dot' && (
            <div
              className="rounded-full bg-secondary"
              style={{ width: particle.size * 0.6, height: particle.size * 0.6 }}
            />
          )}
        </div>
      ))}

      {/* Center content */}
      <div className="relative z-10 text-center animate-in zoom-in-50 fade-in duration-500">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">Thanks for sharing!</h3>
        <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
          Your feedback helps us plan even better events for your group
        </p>
      </div>

      {/* Styles for float animation */}
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-400px) rotate(360deg) scale(0.5);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up ease-out forwards;
        }
      `}</style>
    </div>
  );
}

interface PostEventFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    itineraryId: string;
    itineraryName: string;
    groupName?: string;
    eventDate?: string;
    venueName?: string;
  } | null;
}

interface FeedbackData {
  attended: boolean | null;
  didNotAttendReason?: string;
  overallRating: number;
  venueRating: number;
  budgetRating: number;
  activityFit: number;
  timingRating: number;
  frequencyPreference: number;
  notes?: string;
}

// Emoji rating option component
function EmojiOption({
  emoji,
  label,
  selected,
  onClick
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all duration-200",
        "hover:bg-muted/50",
        selected && "bg-muted"
      )}
    >
      <div className={cn(
        "w-11 h-11 rounded-full flex items-center justify-center text-xl",
        "bg-card border-2 transition-all duration-200",
        selected
          ? "border-primary shadow-md scale-110"
          : "border-border/40 hover:border-border"
      )}>
        {emoji}
      </div>
      <span className={cn(
        "text-[10px] leading-tight text-center max-w-[52px] transition-colors",
        selected
          ? "text-foreground font-medium"
          : "text-muted-foreground/70"
      )}>
        {label}
      </span>
    </button>
  );
}

// Slider scale component
function SliderScale({
  value,
  onChange,
  leftLabel,
  centerLabel,
  rightLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  centerLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="relative pt-4 pb-2">
        {/* Track with gradient */}
        <div className="h-1.5 rounded-full bg-gradient-to-r from-accent/60 via-muted to-secondary/60" />

        {/* Dots */}
        <div className="absolute top-2 left-0 right-0 flex justify-between px-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all duration-200",
                "flex items-center justify-center",
                "hover:border-primary hover:scale-110",
                value === v
                  ? "bg-primary border-primary scale-115 shadow-md"
                  : "bg-background border-border"
              )}
            >
              {value === v && (
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{centerLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function PostEventFeedbackDialog({
  open,
  onOpenChange,
  event
}: PostEventFeedbackDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [attended, setAttended] = useState<boolean | null>(null);
  const [didNotAttendReason, setDidNotAttendReason] = useState<string>("");
  const [overallRating, setOverallRating] = useState<number>(0);
  const [venueRating, setVenueRating] = useState<number>(0);
  const [budgetRating, setBudgetRating] = useState<number>(0);
  const [activityFit, setActivityFit] = useState<number>(0);
  const [timingRating, setTimingRating] = useState<number>(0);
  const [frequencyPreference, setFrequencyPreference] = useState<number>(3);
  const [notes, setNotes] = useState("");

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);

  const resetForm = () => {
    setAttended(null);
    setDidNotAttendReason("");
    setOverallRating(0);
    setVenueRating(0);
    setBudgetRating(0);
    setActivityFit(0);
    setTimingRating(0);
    setFrequencyPreference(3);
    setNotes("");
    setShowCelebration(false);
  };

  // Mutation
  const feedbackMutation = useMutation({
    mutationFn: async (data: {
      itineraryId: string;
      actuallyAttended: boolean;
      didNotAttendReason?: string;
      overallRating?: number;
      venueRating?: number;
      budgetRating?: number;
      activityFit?: number;
      timingRating?: number;
      frequencyPreference?: number;
      notes?: string;
    }) => {
      const requestBody: any = {
        actuallyAttended: data.actuallyAttended,
      };

      // Only include fields with values
      if (data.didNotAttendReason) requestBody.didNotAttendReason = data.didNotAttendReason;
      if (data.overallRating) requestBody.overallRating = data.overallRating;
      if (data.venueRating) requestBody.venueRating = data.venueRating;
      if (data.budgetRating) requestBody.budgetRating = data.budgetRating;
      if (data.activityFit) requestBody.activityFit = data.activityFit;
      if (data.timingRating) requestBody.timingRating = data.timingRating;
      if (data.frequencyPreference && data.frequencyPreference !== 3) {
        requestBody.frequencyPreference = data.frequencyPreference;
      }
      if (data.notes) requestBody.notes = data.notes;

      return await apiRequest("POST", `/api/itineraries/${data.itineraryId}/post-event-feedback`, requestBody);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      // Show celebration instead of immediately closing
      setShowCelebration(true);
    },
    onError: (error: any) => {
      toast(getErrorToast(error));
    },
  });

  const handleCelebrationComplete = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = () => {
    if (!event || attended === null) return;

    feedbackMutation.mutate({
      itineraryId: event.itineraryId,
      actuallyAttended: attended,
      didNotAttendReason: !attended ? didNotAttendReason : undefined,
      overallRating: attended && overallRating > 0 ? overallRating : undefined,
      venueRating: attended && venueRating > 0 ? venueRating : undefined,
      budgetRating: attended && budgetRating > 0 ? budgetRating : undefined,
      activityFit: attended && activityFit > 0 ? activityFit : undefined,
      timingRating: attended && timingRating > 0 ? timingRating : undefined,
      frequencyPreference: attended ? frequencyPreference : undefined,
      notes: attended && notes ? notes : undefined,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Only require the attendance question
  const isValid = attended !== null;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="max-w-md relative overflow-hidden">
        {/* Celebration overlay */}
        {showCelebration && (
          <CelebrationOverlay onComplete={handleCelebrationComplete} />
        )}

        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-2xl font-bold">How was it?</ResponsiveDialogTitle>
          <p className="text-sm text-muted-foreground">Quick feedback helps plan better events</p>

          {/* Event pill */}
          {event && (
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 mt-3 text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">{event.itineraryName}</span>
              {event.eventDate && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{format(new Date(event.eventDate), 'MMM d')}</span>
                </>
              )}
            </div>
          )}
        </ResponsiveDialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto py-2">
          {/* Question 1: Did you attend? */}
          <div className="space-y-3">
            <label className="text-base font-semibold">Did you make it?</label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={attended === true ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2",
                  attended === true && "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                )}
                onClick={() => setAttended(true)}
              >
                <Check className="h-4 w-4" /> Yes
              </Button>
              <Button
                type="button"
                variant={attended === false ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-2",
                  attended === false && "bg-accent text-accent-foreground hover:bg-accent/90"
                )}
                onClick={() => setAttended(false)}
              >
                <X className="h-4 w-4" /> No
              </Button>
            </div>
          </div>

          {/* If didn't attend - quick reason */}
          {attended === false && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="text-base font-semibold">What happened?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'cancelled', label: 'Event cancelled' },
                  { value: 'conflict', label: 'Schedule conflict' },
                  { value: 'forgot', label: 'Forgot' },
                  { value: 'other', label: 'Other' }
                ].map(reason => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => setDidNotAttendReason(reason.value)}
                    className={cn(
                      "px-3.5 py-2 rounded-full text-sm border-2 transition-all duration-200",
                      didNotAttendReason === reason.value
                        ? "bg-accent border-accent text-accent-foreground"
                        : "bg-background border-border hover:border-accent/50"
                    )}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Questions for attendees */}
          {attended === true && (
            <>
              {/* Overall experience - emoji scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '100ms' }}>
                <label className="text-base font-semibold">Overall experience</label>
                <div className="flex justify-between items-start">
                  {[
                    { value: 1, emoji: '😔', label: 'Poor' },
                    { value: 2, emoji: '😕', label: 'Meh' },
                    { value: 3, emoji: '🙂', label: 'Okay' },
                    { value: 4, emoji: '😊', label: 'Good' },
                    { value: 5, emoji: '🤩', label: 'Great!' }
                  ].map(option => (
                    <EmojiOption
                      key={option.value}
                      emoji={option.emoji}
                      label={option.label}
                      selected={overallRating === option.value}
                      onClick={() => setOverallRating(option.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Venue rating - emoji scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '200ms' }}>
                <div>
                  <label className="text-base font-semibold">The venue</label>
                  <p className="text-sm text-muted-foreground">Would you go back?</p>
                </div>
                <div className="flex justify-between items-start">
                  {[
                    { value: 1, emoji: '👎', label: 'Nope' },
                    { value: 2, emoji: '😬', label: 'Probably not' },
                    { value: 3, emoji: '🤷', label: 'Maybe' },
                    { value: 4, emoji: '👍', label: 'Yes' },
                    { value: 5, emoji: '❤️', label: 'Love it!' }
                  ].map(option => (
                    <EmojiOption
                      key={option.value}
                      emoji={option.emoji}
                      label={option.label}
                      selected={venueRating === option.value}
                      onClick={() => setVenueRating(option.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Budget - emoji scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <div>
                  <label className="text-base font-semibold">The budget</label>
                  <p className="text-sm text-muted-foreground">How did the cost feel?</p>
                </div>
                <div className="flex justify-between items-start">
                  {[
                    { value: 1, emoji: '😰', label: 'Too pricey' },
                    { value: 2, emoji: '😕', label: 'A bit much' },
                    { value: 3, emoji: '👌', label: 'Just right' },
                    { value: 4, emoji: '🙌', label: 'Good deal' },
                    { value: 5, emoji: '🤑', label: 'Great value' }
                  ].map(option => (
                    <EmojiOption
                      key={option.value}
                      emoji={option.emoji}
                      label={option.label}
                      selected={budgetRating === option.value}
                      onClick={() => setBudgetRating(option.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Activity fit - slider scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '400ms' }}>
                <div>
                  <label className="text-base font-semibold">This type of activity?</label>
                  <p className="text-sm text-muted-foreground">For you...</p>
                </div>
                <SliderScale
                  value={activityFit}
                  onChange={setActivityFit}
                  leftLabel="Not my thing"
                  centerLabel="Works for me"
                  rightLabel="More of this"
                />
              </div>

              {/* Timing - slider scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '500ms' }}>
                <label className="text-base font-semibold">The timing</label>
                <SliderScale
                  value={timingRating}
                  onChange={setTimingRating}
                  leftLabel="Too early"
                  centerLabel="Just right"
                  rightLabel="Too late"
                />
              </div>

              {/* Frequency - slider scale */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '600ms' }}>
                <label className="text-base font-semibold">How often would you want to meet?</label>
                <SliderScale
                  value={frequencyPreference}
                  onChange={setFrequencyPreference}
                  leftLabel="Less often"
                  centerLabel="About right"
                  rightLabel="More often"
                />
              </div>

              {/* Optional notes */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '600ms' }}>
                <label className="text-base font-semibold">Anything else?</label>
                <Textarea
                  placeholder="Optional - suggestions for next time..."
                  className="min-h-[80px] resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <ResponsiveDialogFooter className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="flex-[2]"
            disabled={!isValid || feedbackMutation.isPending}
            onClick={handleSubmit}
          >
            {feedbackMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default PostEventFeedbackDialog;
