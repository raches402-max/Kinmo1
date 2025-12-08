import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Check, X, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Redesigned Post-Event Feedback Survey
 *
 * Now using Kinmo's design system:
 * - Plus Jakarta Sans typography
 * - Warm gold/sage/dusty rose palette
 * - Existing UI components (Card, Button)
 * - Tailwind utilities for consistency
 */

interface FeedbackSurveyMockupProps {
  eventName?: string;
  groupName?: string;
  eventDate?: Date;
  venueName?: string;
  onSubmit?: (data: FeedbackData) => void;
  onCancel?: () => void;
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
        "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200",
        "hover:bg-muted hover:scale-105",
        selected && "bg-muted scale-110"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
        "bg-card border-2 transition-all duration-200",
        selected
          ? "border-primary shadow-md"
          : "border-transparent"
      )}>
        {emoji}
      </div>
      <span className={cn(
        "text-[11px] uppercase tracking-wide text-muted-foreground transition-opacity",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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

export function FeedbackSurveyMockup({
  eventName = "Wine Tasting at Corkscrew",
  groupName = "The Usual Suspects",
  eventDate = new Date(),
  venueName = "Corkscrew Wine Bar",
  onSubmit,
  onCancel
}: FeedbackSurveyMockupProps) {
  const [attended, setAttended] = useState<boolean | null>(null);
  const [didNotAttendReason, setDidNotAttendReason] = useState<string>("");
  const [overallRating, setOverallRating] = useState<number>(0);
  const [venueRating, setVenueRating] = useState<number>(0);
  const [budgetRating, setBudgetRating] = useState<number>(0);
  const [activityFit, setActivityFit] = useState<number>(0);
  const [timingRating, setTimingRating] = useState<number>(0);
  const [frequencyPreference, setFrequencyPreference] = useState<number>(3);
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onSubmit?.({
      attended,
      didNotAttendReason: attended === false ? didNotAttendReason : undefined,
      overallRating,
      venueRating,
      budgetRating,
      activityFit,
      timingRating,
      frequencyPreference,
      notes: notes || undefined
    });
  };

  // Only require the attendance question - everything else is optional
  const isValid = attended !== null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <Card className="max-w-md mx-auto overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">How was it?</CardTitle>
          <CardDescription>Quick feedback helps plan better events</CardDescription>

          {/* Event pill */}
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 mt-3 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{eventName}</span>
            <span className="text-muted-foreground">•</span>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{format(eventDate, 'MMM d')}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Question 1: Did you attend? */}
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                  <p className="text-sm text-muted-foreground">Would you go back to {venueName}?</p>
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
        </CardContent>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0 border-t border-border mt-4">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="flex-[2]"
            disabled={!isValid}
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default FeedbackSurveyMockup;
