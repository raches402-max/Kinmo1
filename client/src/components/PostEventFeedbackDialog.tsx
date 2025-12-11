import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { apiRequest } from "@/lib/queryClient";

// ============================================
// CELEBRATION OVERLAY
// ============================================
function CelebrationOverlay({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center z-50 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(145 30% 96%) 0%, hsl(44 60% 97%) 50%, hsl(350 40% 97%) 100%)",
      }}
    >
      {/* Floating shapes */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 8 + Math.random() * 16,
            height: 8 + Math.random() * 16,
            left: `${10 + Math.random() * 80}%`,
            background: [
              "hsl(44 91% 57%)",
              "hsl(145 25% 72%)",
              "hsl(350 45% 72%)",
            ][i % 3],
          }}
          initial={{ y: 400, opacity: 0, scale: 0 }}
          animate={{
            y: -100,
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Center content */}
      <motion.div
        className="relative z-10 text-center px-6"
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(44 91% 57%) 0%, hsl(44 91% 67%) 100%)" }}
          initial={{ rotate: -10 }}
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Sparkles className="w-10 h-10 text-black/80" />
        </motion.div>
        <h3 className="text-2xl font-bold text-[hsl(25,30%,14%)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Thanks for sharing!
        </h3>
        <p className="text-[hsl(25,15%,45%)] text-sm max-w-[240px] mx-auto leading-relaxed">
          Your feedback helps us plan better events for your group
        </p>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// EMOJI RATING BUTTON
// ============================================
function EmojiButton({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl",
          "transition-all duration-200 border-2",
          selected
            ? "bg-[hsl(44,91%,57%)] border-[hsl(44,91%,47%)] shadow-lg shadow-[hsl(44,91%,57%)]/25"
            : "bg-white border-[hsl(32,20%,88%)] hover:border-[hsl(32,20%,78%)] hover:bg-[hsl(38,45%,98%)]"
        )}
        animate={selected ? { scale: [1, 1.1, 1.05] } : {}}
        transition={{ duration: 0.2 }}
      >
        {emoji}
      </motion.div>
      <span
        className={cn(
          "text-xs text-center leading-tight transition-colors max-w-[60px]",
          selected ? "text-[hsl(25,30%,14%)] font-medium" : "text-[hsl(25,15%,50%)]"
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}

// ============================================
// STEP INDICATOR
// ============================================
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {[...Array(total)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current
              ? "w-6 bg-[hsl(44,91%,57%)]"
              : i < current
              ? "w-1.5 bg-[hsl(145,25%,72%)]"
              : "w-1.5 bg-[hsl(32,20%,88%)]"
          )}
          initial={false}
          animate={{ scale: i === current ? 1 : 0.9 }}
        />
      ))}
    </div>
  );
}

// ============================================
// PILL CHOICE BUTTON
// ============================================
function PillChoice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border-2",
        selected
          ? "bg-[hsl(350,45%,72%)] border-[hsl(350,45%,62%)] text-white"
          : "bg-white border-[hsl(32,20%,88%)] text-[hsl(25,30%,14%)] hover:border-[hsl(350,45%,72%)] hover:bg-[hsl(350,50%,97%)]"
      )}
      whileTap={{ scale: 0.97 }}
    >
      {label}
    </motion.button>
  );
}

// ============================================
// SLIDER SCALE
// ============================================
function SliderScale({
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <motion.button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 h-12 rounded-xl border-2 transition-all duration-200 font-medium",
              value === v
                ? "bg-[hsl(44,91%,57%)] border-[hsl(44,91%,47%)] text-black shadow-md"
                : "bg-white border-[hsl(32,20%,88%)] text-[hsl(25,15%,50%)] hover:border-[hsl(44,91%,57%)] hover:bg-[hsl(44,80%,97%)]"
            )}
            whileTap={{ scale: 0.95 }}
          >
            {v}
          </motion.button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[hsl(25,15%,50%)] px-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
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

export function PostEventFeedbackDialog({
  open,
  onOpenChange,
  event,
}: PostEventFeedbackDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step management
  const [step, setStep] = useState(0);

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
    setStep(0);
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

  // Determine total steps based on attendance
  const totalSteps = attended === true ? 5 : attended === false ? 2 : 1;

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

  const canProceed = () => {
    if (step === 0) return attended !== null;
    if (attended === false && step === 1) return true; // Reason is optional
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  const [direction, setDirection] = useState(0);

  useEffect(() => {
    setDirection(1);
  }, [step]);

  const goNext = () => {
    setDirection(1);
    handleNext();
  };

  const goBack = () => {
    setDirection(-1);
    handleBack();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="max-w-md p-0 overflow-hidden bg-[hsl(38,35%,97%)] border-[hsl(32,25%,85%)]">
        {/* Celebration overlay */}
        <AnimatePresence>
          {showCelebration && (
            <CelebrationOverlay onComplete={handleCelebrationComplete} />
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          {/* Event pill */}
          {event && (
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "linear-gradient(135deg, hsl(44 91% 57%) 0%, hsl(44 91% 67%) 100%)" }}
              >
                {event.eventDate ? format(new Date(event.eventDate), "d") : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[hsl(25,30%,14%)] truncate">{event.itineraryName}</p>
                <p className="text-xs text-[hsl(25,15%,50%)]">
                  {event.eventDate ? format(new Date(event.eventDate), "EEEE, MMM d") : "Past event"}
                </p>
              </div>
            </div>
          )}

          <StepIndicator current={step} total={totalSteps} />
        </div>

        {/* Content area with fixed height */}
        <div className="px-6 min-h-[320px] relative">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 0: Attendance */}
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2
                    className="text-2xl font-bold text-[hsl(25,30%,14%)] mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Did you make it?
                  </h2>
                  <p className="text-[hsl(25,15%,50%)] text-sm">
                    Quick check-in about the event
                  </p>
                </div>

                <div className="flex gap-4 justify-center pt-4">
                  <motion.button
                    type="button"
                    onClick={() => setAttended(true)}
                    className={cn(
                      "w-28 h-28 rounded-3xl border-3 flex flex-col items-center justify-center gap-2 transition-all duration-200",
                      attended === true
                        ? "bg-[hsl(145,25%,72%)] border-[hsl(145,25%,62%)] shadow-lg shadow-[hsl(145,25%,72%)]/30"
                        : "bg-white border-[hsl(32,20%,88%)] hover:border-[hsl(145,25%,72%)] hover:bg-[hsl(145,30%,97%)]"
                    )}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Check
                      className={cn(
                        "w-10 h-10 transition-colors",
                        attended === true ? "text-white" : "text-[hsl(145,25%,60%)]"
                      )}
                      strokeWidth={2.5}
                    />
                    <span
                      className={cn(
                        "font-semibold transition-colors",
                        attended === true ? "text-white" : "text-[hsl(25,30%,14%)]"
                      )}
                    >
                      Yes!
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => setAttended(false)}
                    className={cn(
                      "w-28 h-28 rounded-3xl border-3 flex flex-col items-center justify-center gap-2 transition-all duration-200",
                      attended === false
                        ? "bg-[hsl(350,45%,72%)] border-[hsl(350,45%,62%)] shadow-lg shadow-[hsl(350,45%,72%)]/30"
                        : "bg-white border-[hsl(32,20%,88%)] hover:border-[hsl(350,45%,72%)] hover:bg-[hsl(350,50%,97%)]"
                    )}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X
                      className={cn(
                        "w-10 h-10 transition-colors",
                        attended === false ? "text-white" : "text-[hsl(350,45%,65%)]"
                      )}
                      strokeWidth={2.5}
                    />
                    <span
                      className={cn(
                        "font-semibold transition-colors",
                        attended === false ? "text-white" : "text-[hsl(25,30%,14%)]"
                      )}
                    >
                      No
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 1 (non-attendee): Reason */}
            {step === 1 && attended === false && (
              <motion.div
                key="step-1-no"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2
                    className="text-2xl font-bold text-[hsl(25,30%,14%)] mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    What happened?
                  </h2>
                  <p className="text-[hsl(25,15%,50%)] text-sm">
                    No worries - just helps us understand
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 justify-center pt-4">
                  {[
                    { value: "conflict", label: "Schedule conflict" },
                    { value: "cancelled", label: "Event cancelled" },
                    { value: "sick", label: "Wasn't feeling well" },
                    { value: "forgot", label: "Forgot" },
                    { value: "other", label: "Other" },
                  ].map((reason) => (
                    <PillChoice
                      key={reason.value}
                      label={reason.label}
                      selected={didNotAttendReason === reason.value}
                      onClick={() => setDidNotAttendReason(reason.value)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 1 (attendee): Overall + Venue */}
            {step === 1 && attended === true && (
              <motion.div
                key="step-1-yes"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-4">
                    How was the overall experience?
                  </h3>
                  <div className="flex justify-between">
                    {[
                      { value: 1, emoji: "😔", label: "Not great" },
                      { value: 2, emoji: "😕", label: "Meh" },
                      { value: 3, emoji: "🙂", label: "Okay" },
                      { value: 4, emoji: "😊", label: "Good!" },
                      { value: 5, emoji: "🤩", label: "Amazing!" },
                    ].map((option) => (
                      <EmojiButton
                        key={option.value}
                        emoji={option.emoji}
                        label={option.label}
                        selected={overallRating === option.value}
                        onClick={() => setOverallRating(option.value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-4">
                    Would you go back to this venue?
                  </h3>
                  <div className="flex justify-between">
                    {[
                      { value: 1, emoji: "👎", label: "Nope" },
                      { value: 2, emoji: "😬", label: "Probably not" },
                      { value: 3, emoji: "🤷", label: "Maybe" },
                      { value: 4, emoji: "👍", label: "Yes" },
                      { value: 5, emoji: "❤️", label: "Love it!" },
                    ].map((option) => (
                      <EmojiButton
                        key={option.value}
                        emoji={option.emoji}
                        label={option.label}
                        selected={venueRating === option.value}
                        onClick={() => setVenueRating(option.value)}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2 (attendee): Budget + Activity */}
            {step === 2 && attended === true && (
              <motion.div
                key="step-2-yes"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-4">
                    How did the cost feel?
                  </h3>
                  <div className="flex justify-between">
                    {[
                      { value: 1, emoji: "😰", label: "Too pricey" },
                      { value: 2, emoji: "😕", label: "A bit much" },
                      { value: 3, emoji: "👌", label: "Just right" },
                      { value: 4, emoji: "🙌", label: "Good deal" },
                      { value: 5, emoji: "🤑", label: "Great value" },
                    ].map((option) => (
                      <EmojiButton
                        key={option.value}
                        emoji={option.emoji}
                        label={option.label}
                        selected={budgetRating === option.value}
                        onClick={() => setBudgetRating(option.value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-3">
                    This type of activity for you?
                  </h3>
                  <SliderScale
                    value={activityFit}
                    onChange={setActivityFit}
                    leftLabel="Not my thing"
                    rightLabel="More of this!"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3 (attendee): Timing + Frequency */}
            {step === 3 && attended === true && (
              <motion.div
                key="step-3-yes"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-3">
                    How was the timing?
                  </h3>
                  <SliderScale
                    value={timingRating}
                    onChange={setTimingRating}
                    leftLabel="Too early"
                    rightLabel="Too late"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[hsl(25,30%,14%)] mb-3">
                    How often would you want to meet?
                  </h3>
                  <SliderScale
                    value={frequencyPreference}
                    onChange={setFrequencyPreference}
                    leftLabel="Less often"
                    rightLabel="More often"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4 (attendee): Notes */}
            {step === 4 && attended === true && (
              <motion.div
                key="step-4-yes"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2
                    className="text-2xl font-bold text-[hsl(25,30%,14%)] mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Anything else?
                  </h2>
                  <p className="text-[hsl(25,15%,50%)] text-sm">
                    Optional - suggestions or thoughts for next time
                  </p>
                </div>

                <Textarea
                  placeholder="The dessert was incredible, we should go back just for that..."
                  className="min-h-[120px] resize-none bg-white border-[hsl(32,20%,88%)] rounded-xl text-[hsl(25,30%,14%)] placeholder:text-[hsl(25,15%,60%)] focus:border-[hsl(44,91%,57%)] focus:ring-[hsl(44,91%,57%)]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-white border-t border-[hsl(32,20%,90%)]">
          <div className="flex gap-3">
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-[hsl(25,15%,50%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(38,35%,95%)]"
                onClick={goBack}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-[hsl(25,15%,50%)] hover:text-[hsl(25,30%,14%)] hover:bg-[hsl(38,35%,95%)]"
                onClick={() => handleOpenChange(false)}
              >
                Skip
              </Button>
            )}

            <Button
              type="button"
              className={cn(
                "flex-[2] font-semibold transition-all",
                canProceed()
                  ? "bg-[hsl(44,91%,57%)] hover:bg-[hsl(44,91%,52%)] text-black shadow-md hover:shadow-lg"
                  : "bg-[hsl(32,20%,88%)] text-[hsl(25,15%,60%)] cursor-not-allowed"
              )}
              disabled={!canProceed() || feedbackMutation.isPending}
              onClick={goNext}
            >
              {feedbackMutation.isPending ? (
                "Submitting..."
              ) : step === totalSteps - 1 ? (
                "Submit"
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default PostEventFeedbackDialog;
