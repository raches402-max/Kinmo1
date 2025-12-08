import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Calendar, Check, X, MapPin } from "lucide-react";

/**
 * Redesigned Post-Event Feedback Survey
 *
 * Design Philosophy: "Soft Editorial"
 * - Clean, magazine-inspired layout with generous whitespace
 * - Warm, inviting color palette (cream/terracotta/sage)
 * - Intuitive visual inputs that don't require reading each option
 * - Progressive disclosure - show only relevant questions
 * - Emoji-scale ratings for instant comprehension
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

  return (
    <div className="feedback-survey-mockup">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,400&family=Source+Sans+3:wght@400;500;600&display=swap');

        .feedback-survey-mockup {
          --cream: #FAF7F2;
          --warm-white: #FFFFFF;
          --terracotta: #C4704F;
          --terracotta-light: #E8A88A;
          --sage: #8FA68A;
          --sage-light: #B8CCB4;
          --charcoal: #2D2D2D;
          --muted: #7A7A7A;
          --border: #E8E4DE;

          font-family: 'Source Sans 3', system-ui, sans-serif;
          background: var(--cream);
          min-height: 100vh;
          padding: 24px;
        }

        .feedback-card {
          background: var(--warm-white);
          border-radius: 24px;
          max-width: 440px;
          margin: 0 auto;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(0,0,0,0.04),
            0 4px 16px rgba(0,0,0,0.06);
        }

        .feedback-header {
          padding: 32px 28px 24px;
          border-bottom: 1px solid var(--border);
        }

        .feedback-title {
          font-family: 'Fraunces', serif;
          font-size: 26px;
          font-weight: 500;
          color: var(--charcoal);
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }

        .feedback-subtitle {
          font-size: 14px;
          color: var(--muted);
        }

        .event-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--cream);
          padding: 10px 14px;
          border-radius: 12px;
          margin-top: 16px;
          font-size: 13px;
          color: var(--charcoal);
        }

        .event-pill svg {
          width: 14px;
          height: 14px;
          color: var(--muted);
        }

        .feedback-body {
          padding: 28px;
        }

        .question-section {
          margin-bottom: 32px;
        }

        .question-section:last-of-type {
          margin-bottom: 24px;
        }

        .question-label {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          font-weight: 500;
          color: var(--charcoal);
          margin-bottom: 14px;
          display: block;
        }

        .question-hint {
          font-size: 13px;
          color: var(--muted);
          margin-top: -8px;
          margin-bottom: 14px;
        }

        /* Binary Yes/No Toggle */
        .binary-toggle {
          display: flex;
          gap: 12px;
        }

        .binary-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border: 2px solid var(--border);
          border-radius: 14px;
          background: var(--warm-white);
          font-size: 15px;
          font-weight: 500;
          color: var(--charcoal);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .binary-btn:hover {
          border-color: var(--sage-light);
          background: var(--cream);
        }

        .binary-btn.selected-yes {
          border-color: var(--sage);
          background: linear-gradient(135deg, var(--sage-light) 0%, var(--sage) 100%);
          color: white;
        }

        .binary-btn.selected-no {
          border-color: var(--terracotta);
          background: linear-gradient(135deg, var(--terracotta-light) 0%, var(--terracotta) 100%);
          color: white;
        }

        .binary-btn svg {
          width: 18px;
          height: 18px;
        }

        /* Quick Reason Pills */
        .reason-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .reason-pill {
          padding: 8px 14px;
          border: 1.5px solid var(--border);
          border-radius: 20px;
          background: var(--warm-white);
          font-size: 13px;
          color: var(--charcoal);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reason-pill:hover {
          border-color: var(--terracotta-light);
        }

        .reason-pill.selected {
          border-color: var(--terracotta);
          background: var(--terracotta);
          color: white;
        }

        /* Emoji Rating Scale */
        .emoji-scale {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 4px;
        }

        .emoji-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 8px;
          border-radius: 12px;
        }

        .emoji-option:hover {
          background: var(--cream);
          transform: scale(1.05);
        }

        .emoji-option.selected {
          background: var(--cream);
          transform: scale(1.1);
        }

        .emoji-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          background: var(--cream);
          border: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .emoji-option.selected .emoji-circle {
          border-color: var(--sage);
          background: white;
          box-shadow: 0 2px 8px rgba(143, 166, 138, 0.3);
        }

        .emoji-label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .emoji-option:hover .emoji-label,
        .emoji-option.selected .emoji-label {
          opacity: 1;
        }

        /* Slider Scale */
        .slider-scale {
          position: relative;
          padding: 16px 0 8px;
        }

        .slider-track {
          height: 6px;
          background: linear-gradient(90deg, var(--terracotta-light) 0%, var(--cream) 50%, var(--sage-light) 100%);
          border-radius: 3px;
          position: relative;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
        }

        .slider-label {
          font-size: 12px;
          color: var(--muted);
        }

        .slider-dots {
          display: flex;
          justify-content: space-between;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          transform: translateY(-50%);
          padding: 0 4px;
        }

        .slider-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          border: 2px solid var(--border);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .slider-dot:hover {
          border-color: var(--sage);
          transform: scale(1.1);
        }

        .slider-dot.selected {
          border-color: var(--sage);
          background: var(--sage);
          transform: scale(1.15);
        }

        .slider-dot.selected::after {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
        }

        /* Notes Textarea */
        .notes-textarea {
          width: 100%;
          padding: 14px 16px;
          border: 1.5px solid var(--border);
          border-radius: 14px;
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 14px;
          resize: none;
          transition: all 0.2s ease;
          background: var(--warm-white);
        }

        .notes-textarea:focus {
          outline: none;
          border-color: var(--sage);
          box-shadow: 0 0 0 3px rgba(143, 166, 138, 0.15);
        }

        .notes-textarea::placeholder {
          color: var(--muted);
        }

        /* Footer Actions */
        .feedback-footer {
          display: flex;
          gap: 12px;
          padding: 20px 28px 28px;
          border-top: 1px solid var(--border);
        }

        .btn-secondary {
          flex: 1;
          padding: 14px 20px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          background: var(--warm-white);
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: var(--cream);
          color: var(--charcoal);
        }

        .btn-primary {
          flex: 2;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--sage) 0%, #7A9375 100%);
          font-family: 'Source Sans 3', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(143, 166, 138, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(143, 166, 138, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* Animations */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: slideIn 0.3s ease forwards;
        }

        .delay-1 { animation-delay: 0.1s; opacity: 0; }
        .delay-2 { animation-delay: 0.2s; opacity: 0; }
        .delay-3 { animation-delay: 0.3s; opacity: 0; }
        .delay-4 { animation-delay: 0.4s; opacity: 0; }
        .delay-5 { animation-delay: 0.5s; opacity: 0; }
        .delay-6 { animation-delay: 0.6s; opacity: 0; }
      `}</style>

      <div className="feedback-card">
        <div className="feedback-header">
          <h2 className="feedback-title">How was it?</h2>
          <p className="feedback-subtitle">Quick feedback helps us plan better events</p>

          <div className="event-pill">
            <MapPin />
            <span>{eventName}</span>
            <span style={{ color: 'var(--muted)' }}>•</span>
            <Calendar />
            <span>{format(eventDate, 'MMM d')}</span>
          </div>
        </div>

        <div className="feedback-body">
          {/* Question 1: Did you attend? */}
          <div className="question-section animate-in">
            <label className="question-label">Did you make it?</label>
            <div className="binary-toggle">
              <button
                className={`binary-btn ${attended === true ? 'selected-yes' : ''}`}
                onClick={() => setAttended(true)}
              >
                <Check /> Yes
              </button>
              <button
                className={`binary-btn ${attended === false ? 'selected-no' : ''}`}
                onClick={() => setAttended(false)}
              >
                <X /> No
              </button>
            </div>
          </div>

          {/* If didn't attend - quick reason */}
          {attended === false && (
            <div className="question-section animate-in">
              <label className="question-label">What happened?</label>
              <div className="reason-pills">
                {[
                  { value: 'cancelled', label: 'Event cancelled' },
                  { value: 'conflict', label: 'Schedule conflict' },
                  { value: 'forgot', label: 'Forgot' },
                  { value: 'other', label: 'Other' }
                ].map(reason => (
                  <button
                    key={reason.value}
                    className={`reason-pill ${didNotAttendReason === reason.value ? 'selected' : ''}`}
                    onClick={() => setDidNotAttendReason(reason.value)}
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
              <div className="question-section animate-in delay-1">
                <label className="question-label">Overall experience</label>
                <div className="emoji-scale">
                  {[
                    { value: 1, emoji: '😔', label: 'Poor' },
                    { value: 2, emoji: '😕', label: 'Meh' },
                    { value: 3, emoji: '🙂', label: 'Okay' },
                    { value: 4, emoji: '😊', label: 'Good' },
                    { value: 5, emoji: '🤩', label: 'Great!' }
                  ].map(option => (
                    <div
                      key={option.value}
                      className={`emoji-option ${overallRating === option.value ? 'selected' : ''}`}
                      onClick={() => setOverallRating(option.value)}
                    >
                      <div className="emoji-circle">{option.emoji}</div>
                      <span className="emoji-label">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Venue rating - emoji scale */}
              <div className="question-section animate-in delay-2">
                <label className="question-label">The venue</label>
                <p className="question-hint">Would you go back to {venueName}?</p>
                <div className="emoji-scale">
                  {[
                    { value: 1, emoji: '👎', label: 'Nope' },
                    { value: 2, emoji: '😬', label: 'Probably not' },
                    { value: 3, emoji: '🤷', label: 'Maybe' },
                    { value: 4, emoji: '👍', label: 'Yes' },
                    { value: 5, emoji: '❤️', label: 'Love it!' }
                  ].map(option => (
                    <div
                      key={option.value}
                      className={`emoji-option ${venueRating === option.value ? 'selected' : ''}`}
                      onClick={() => setVenueRating(option.value)}
                    >
                      <div className="emoji-circle">{option.emoji}</div>
                      <span className="emoji-label">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget - emoji scale */}
              <div className="question-section animate-in delay-3">
                <label className="question-label">The budget</label>
                <p className="question-hint">How did the cost feel?</p>
                <div className="emoji-scale">
                  {[
                    { value: 1, emoji: '😰', label: 'Too pricey' },
                    { value: 2, emoji: '😕', label: 'A bit much' },
                    { value: 3, emoji: '👌', label: 'Just right' },
                    { value: 4, emoji: '🙌', label: 'Good deal' },
                    { value: 5, emoji: '🤑', label: 'Great value' }
                  ].map(option => (
                    <div
                      key={option.value}
                      className={`emoji-option ${budgetRating === option.value ? 'selected' : ''}`}
                      onClick={() => setBudgetRating(option.value)}
                    >
                      <div className="emoji-circle">{option.emoji}</div>
                      <span className="emoji-label">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity fit - slider scale */}
              <div className="question-section animate-in delay-4">
                <label className="question-label">This type of activity?</label>
                <p className="question-hint">For your group...</p>
                <div className="slider-scale">
                  <div className="slider-track">
                    <div className="slider-dots">
                      {[1, 2, 3, 4, 5].map(value => (
                        <div
                          key={value}
                          className={`slider-dot ${activityFit === value ? 'selected' : ''}`}
                          onClick={() => setActivityFit(value)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="slider-labels">
                    <span className="slider-label">Try something else</span>
                    <span className="slider-label">Good fit</span>
                    <span className="slider-label">Perfect for us</span>
                  </div>
                </div>
              </div>

              {/* Timing - simple scale */}
              <div className="question-section animate-in delay-5">
                <label className="question-label">The timing</label>
                <div className="slider-scale">
                  <div className="slider-track">
                    <div className="slider-dots">
                      {[1, 2, 3, 4, 5].map(value => (
                        <div
                          key={value}
                          className={`slider-dot ${timingRating === value ? 'selected' : ''}`}
                          onClick={() => setTimingRating(value)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="slider-labels">
                    <span className="slider-label">Too early</span>
                    <span className="slider-label">Perfect</span>
                    <span className="slider-label">Too late</span>
                  </div>
                </div>
              </div>

              {/* Frequency - simple scale */}
              <div className="question-section animate-in delay-6">
                <label className="question-label">How often should we meet?</label>
                <p className="question-hint">Want to hang out with this group...</p>
                <div className="slider-scale">
                  <div className="slider-track">
                    <div className="slider-dots">
                      {[1, 2, 3, 4, 5].map(value => (
                        <div
                          key={value}
                          className={`slider-dot ${frequencyPreference === value ? 'selected' : ''}`}
                          onClick={() => setFrequencyPreference(value)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="slider-labels">
                    <span className="slider-label">Less often</span>
                    <span className="slider-label">This is perfect</span>
                    <span className="slider-label">More often!</span>
                  </div>
                </div>
              </div>

              {/* Optional notes */}
              <div className="question-section animate-in delay-6">
                <label className="question-label">Anything else?</label>
                <textarea
                  className="notes-textarea"
                  placeholder="Optional - suggestions for next time..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="feedback-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Skip
          </button>
          <button
            className="btn-primary"
            disabled={attended === null || (attended === true && (overallRating === 0 || venueRating === 0 || budgetRating === 0 || activityFit === 0 || timingRating === 0))}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackSurveyMockup;
