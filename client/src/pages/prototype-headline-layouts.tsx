import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { KinmoIcon } from "@/components/KinmoLogo";

/**
 * Headline Layout Exploration
 *
 * Testing different approaches to keep "See your ___ more."
 * on a single line with rotating text that doesn't shift the static words.
 */

// Sample words with varying lengths to stress-test layouts
const rotatingWords = [
  "friends",
  "family",
  "crew",
  "kin",
  "Sunday football fam",
  "besties",
  "people",
  "book club",
  "parents",
];

// Shared hook for word rotation
function useRotatingWords(intervalMs: number = 2000) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsAnimating(false);
      }, 300);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return { currentWord: rotatingWords[currentIndex], isAnimating, currentIndex };
}

// ============================================
// OPTION 1: Caret/Cursor Approach
// ============================================
function Option1Caret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
        See your{" "}
        <span className="relative inline-flex items-baseline">
          {/* Blinking caret */}
          <span
            className="absolute -left-1 top-0 bottom-0 w-[3px] bg-[#F5C030] animate-pulse"
            style={{ animationDuration: '1s' }}
          />
          <span
            className={`transition-all duration-300 font-bold ${
              isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </span>{" "}
        more.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ⚠️ Notice: "more." shifts position as word width changes
      </p>
    </div>
  );
}

// ============================================
// OPTION 2: Fixed-Width Container (Left-Aligned)
// ============================================
function Option2FixedLeft() {
  const { currentWord, isAnimating } = useRotatingWords(2200);
  // Width sized for longest word "Sunday football fam" + padding
  const fixedWidth = "280px";

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-block text-left mx-2"
          style={{ width: fixedWidth }}
        >
          <span
            className={`transition-all duration-300 font-bold whitespace-nowrap ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ "more." stays fixed — gap appears after short words
      </p>
    </div>
  );
}

// ============================================
// OPTION 3: Fixed-Width Container (Center-Aligned)
// ============================================
function Option3FixedCenter() {
  const { currentWord, isAnimating } = useRotatingWords(2200);
  const fixedWidth = "280px";

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-block text-center mx-2"
          style={{ width: fixedWidth }}
        >
          <span
            className={`transition-all duration-300 font-bold whitespace-nowrap ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ "more." stays fixed — word floats centered in reserved space
      </p>
    </div>
  );
}

// ============================================
// OPTION 4A: Yellow Pill/Highlight Background
// ============================================
function Option4Pill() {
  const { currentWord, isAnimating } = useRotatingWords(2200);
  const fixedWidth = "300px";

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center gap-2">
        <span>See your</span>
        <span
          className="inline-flex items-center justify-center rounded-full px-4 py-1"
          style={{
            width: fixedWidth,
            backgroundColor: 'rgba(245, 192, 48, 0.15)',
          }}
        >
          <span
            className={`transition-all duration-300 font-bold whitespace-nowrap ${
              isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Pill container signals "this changes" — fixed width keeps layout stable
      </p>
    </div>
  );
}

// ============================================
// OPTION 4B: Underline Accent
// ============================================
function Option4Underline() {
  const { currentWord, isAnimating } = useRotatingWords(2200);
  const fixedWidth = "280px";

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-block text-center mx-2 relative"
          style={{ width: fixedWidth }}
        >
          <span
            className={`transition-all duration-300 font-bold whitespace-nowrap ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
          {/* Fixed-width underline */}
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[4px] rounded-full"
            style={{
              width: '90%',
              backgroundColor: 'rgba(245, 192, 48, 0.4)',
            }}
          />
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Underline spans full width — anchors the rotating word visually
      </p>
    </div>
  );
}

// ============================================
// OPTION 4C: Brackets
// ============================================
function Option4Brackets() {
  const { currentWord, isAnimating } = useRotatingWords(2200);
  const fixedWidth = "280px";

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-flex items-baseline mx-1"
          style={{ width: fixedWidth }}
        >
          <span className="text-[#F5C030]/50 mr-1">「</span>
          <span className="flex-1 text-center">
            <span
              className={`transition-all duration-300 font-bold whitespace-nowrap ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
              style={{ color: '#F5C030' }}
            >
              {currentWord}
            </span>
          </span>
          <span className="text-[#F5C030]/50 ml-1">」</span>
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Decorative brackets frame the changing word
      </p>
    </div>
  );
}

// ============================================
// OPTION 5: Vertical Carousel (words slide up)
// ============================================
function Option5Vertical() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const fixedWidth = "280px";

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsAnimating(false);
      }, 400);
    }, 2200);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-block text-center mx-2 overflow-hidden relative"
          style={{ width: fixedWidth, height: '1.2em' }}
        >
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-400 font-bold whitespace-nowrap ${
              isAnimating
                ? "opacity-0 -translate-y-full"
                : "opacity-100 translate-y-0"
            }`}
            style={{ color: '#F5C030' }}
          >
            {rotatingWords[currentIndex]}
          </span>
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Words slide up and out — masked container keeps width fixed
      </p>
    </div>
  );
}

// ============================================
// OPTION 6: Typewriter with Caret (words type in)
// ============================================
function Option6Typewriter() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const fixedWidth = "280px";

  useEffect(() => {
    const word = rotatingWords[currentIndex];

    if (isTyping) {
      if (displayedText.length < word.length) {
        const timer = setTimeout(() => {
          setDisplayedText(word.slice(0, displayedText.length + 1));
        }, 80);
        return () => clearTimeout(timer);
      } else {
        // Word fully typed, wait then start deleting
        const timer = setTimeout(() => setIsTyping(false), 1500);
        return () => clearTimeout(timer);
      }
    } else {
      if (displayedText.length > 0) {
        const timer = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, 50);
        return () => clearTimeout(timer);
      } else {
        // Word fully deleted, move to next
        setCurrentIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsTyping(true);
      }
    }
  }, [currentIndex, displayedText, isTyping]);

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight inline-flex items-baseline flex-wrap justify-center">
        <span>See your</span>
        <span
          className="inline-block text-left mx-2 relative"
          style={{ width: fixedWidth }}
        >
          <span className="font-bold whitespace-nowrap" style={{ color: '#F5C030' }}>
            {displayedText}
          </span>
          {/* Blinking caret */}
          <span
            className="inline-block w-[3px] h-[0.9em] ml-0.5 align-middle animate-pulse"
            style={{ backgroundColor: '#F5C030' }}
          />
        </span>
        <span>more.</span>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Typewriter effect with caret — playful and engaging
      </p>
    </div>
  );
}

// ============================================
// OPTION 7: Your Original Diagonal (for reference)
// ============================================
function Option7Diagonal() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="relative inline-block w-[320px] md:w-[420px] lg:w-[500px] h-[140px] md:h-[170px] lg:h-[200px]">
        <span className="absolute top-0 left-0 text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
          See your
        </span>
        <span
          className={`absolute top-[38%] left-1/2 -translate-x-1/2 text-3xl md:text-4xl lg:text-5xl transition-opacity duration-300 font-bold whitespace-nowrap ${
            isAnimating ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: '#F5C030' }}
        >
          {currentWord}
        </span>
        <span className="absolute bottom-0 right-0 text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
          more.
        </span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Your current approach — diagonal layout gives breathing room
      </p>
    </div>
  );
}

// ============================================
// OPTION 8: Inline with "more." on new line (compromise)
// ============================================
function Option8TwoLine() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
        See your{" "}
        <span
          className={`transition-all duration-300 font-bold whitespace-nowrap ${
            isAnimating ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: '#F5C030' }}
        >
          {currentWord}
        </span>
      </p>
      <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mt-1">
        more.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        ✓ Two-line approach — "more." anchored below, rotating text has room
      </p>
    </div>
  );
}

// ============================================
// OPTION 9: Handwritten Insertion Caret (^)
// Like when you forgot a word and draw ^ to insert it above
// ============================================
function Option9InsertionCaret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      {/* Container for the two-level layout */}
      <div className="inline-flex flex-col items-center">
        {/* Rotating word floats above */}
        <div className="h-[1.4em] flex items-end justify-center mb-1">
          <span
            className={`text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap transition-all duration-300 ${
              isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </div>

        {/* Main line with caret pointing up */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline">
          <span>See your</span>
          {/* The insertion caret ^ */}
          <span className="mx-2 flex flex-col items-center" style={{ color: '#F5C030' }}>
            <svg
              viewBox="0 0 24 12"
              className="w-6 h-3 md:w-8 md:h-4"
              fill="currentColor"
            >
              <path d="M12 0 L24 12 L20 12 L12 4 L4 12 L0 12 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Handwritten "insertion" feel — like squeezing in a forgotten word
      </p>
    </div>
  );
}

// ============================================
// OPTION 10: Handwritten Insertion Caret (Variation B - inline caret)
// Caret sits in the text line, word hovers above it
// ============================================
function Option10InsertionCaretB() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Caret container with floating word */}
          <span className="relative mx-1">
            {/* The word floating above */}
            <span
              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap transition-all duration-300 ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
              style={{ color: '#F5C030' }}
            >
              {currentWord}
            </span>
            {/* The ^ caret character */}
            <span
              className="text-3xl md:text-4xl lg:text-5xl font-bold"
              style={{ color: '#F5C030' }}
            >
              ^
            </span>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Simple ^ character as caret — word appears where it "belongs"
      </p>
    </div>
  );
}

// ============================================
// OPTION 11: Handwritten Insertion with Line
// Like editor's insertion mark with a line connecting to the word
// ============================================
function Option11InsertionWithLine() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Caret container with floating word and connecting line */}
          <span className="relative mx-2">
            {/* The word floating above with connecting line */}
            <span
              className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
              {/* Connecting line from word to caret */}
              <span
                className="w-[2px] h-2 mt-1"
                style={{ backgroundColor: '#F5C030' }}
              />
            </span>
            {/* The ^ caret */}
            <svg
              viewBox="0 0 24 14"
              className="w-5 h-3 md:w-7 md:h-4"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Editor's insertion mark — line connects the caret to the word
      </p>
    </div>
  );
}

// ============================================
// OPTION 12: Caret Below Baseline (no line)
// Caret drops below the text line, word floats above
// ============================================
function Option12CaretBelowBaseline() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-end justify-center">
          <span>See your</span>
          {/* Caret container - caret sits below baseline */}
          <span className="relative mx-2 flex flex-col items-center">
            {/* The word floating above the text line */}
            <span
              className={`absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* The ^ caret - positioned below baseline */}
            <svg
              viewBox="0 0 24 14"
              className="w-6 h-4 md:w-8 md:h-5 translate-y-2"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        ✓ Caret drops below the baseline — more visual separation
      </p>
    </div>
  );
}

// ============================================
// OPTION 13: Caret Below with Gap (dramatic)
// Caret well below text, creates clear visual hierarchy
// ============================================
function Option13CaretWellBelow() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-flex flex-col items-center">
        {/* Rotating word at top */}
        <div className="mb-2">
          <span
            className={`text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap transition-all duration-300 ${
              isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
            style={{ color: '#F5C030' }}
          >
            {currentWord}
          </span>
        </div>

        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-center justify-center">
          <span>See your</span>
          <span className="mx-2" style={{ color: '#F5C030' }}>
            <svg
              viewBox="0 0 24 14"
              className="w-6 h-4 md:w-8 md:h-5"
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Three-tier stack — word, then caret inline with text
      </p>
    </div>
  );
}

// ============================================
// OPTION 14: Inline Caret No Line (clean)
// Simple ^ inline, word above, no connecting line
// ============================================
function Option14InlineNoLine() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Caret with word floating above - no line */}
          <span className="relative mx-2">
            {/* The word floating above */}
            <span
              className={`absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Clean ^ caret */}
            <svg
              viewBox="0 0 24 14"
              className="w-5 h-3 md:w-7 md:h-4"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Clean caret inline — no connecting line, word floats freely
      </p>
    </div>
  );
}

// ============================================
// OPTION 15: Thin/Subtle Caret
// Delicate caret that doesn't dominate
// ============================================
function Option15ThinCaret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Thin caret with word above */}
          <span className="relative mx-3">
            {/* The word floating above */}
            <span
              className={`absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Thin ^ caret - just lines */}
            <svg
              viewBox="0 0 24 12"
              className="w-4 h-2 md:w-6 md:h-3"
              style={{ color: '#F5C030' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 10 L12 2 L22 10" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Delicate line caret — subtle, doesn't compete with the word
      </p>
    </div>
  );
}

// ============================================
// OPTION 16: Wide/Flat Caret
// Broader, flatter caret shape
// ============================================
function Option16WideCaret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Wide flat caret */}
          <span className="relative mx-2">
            {/* The word floating above */}
            <span
              className={`absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Wide ^ caret */}
            <svg
              viewBox="0 0 32 10"
              className="w-8 h-3 md:w-10 md:h-4"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M16 0 L32 10 L26 10 L16 4 L6 10 L0 10 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Wide flat caret — more horizontal presence
      </p>
    </div>
  );
}

// ============================================
// OPTION 17: Caret with Soft Glow
// Caret has a subtle glow/shadow effect
// ============================================
function Option17CaretWithGlow() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Caret with glow */}
          <span className="relative mx-2">
            {/* The word floating above */}
            <span
              className={`absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Caret with glow effect */}
            <svg
              viewBox="0 0 24 14"
              className="w-6 h-4 md:w-8 md:h-5"
              style={{
                color: '#F5C030',
                filter: 'drop-shadow(0 0 4px rgba(245, 192, 48, 0.5))'
              }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Soft glow on caret — warm, inviting feel
      </p>
    </div>
  );
}

// ============================================
// OPTION 18: Subscript Caret (truly below)
// Caret sits as a subscript, well below the baseline
// ============================================
function Option18SubscriptCaret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative pb-4">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Subscript caret container */}
          <span className="relative mx-2">
            {/* The word floating above the text */}
            <span
              className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Placeholder for spacing */}
            <span className="invisible">^</span>
            {/* Caret positioned as subscript */}
            <svg
              viewBox="0 0 24 14"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-5 h-3 md:w-7 md:h-4"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Subscript caret — sits below the text baseline
      </p>
    </div>
  );
}

// ============================================
// OPTION 19: Animated Bounce Caret
// Caret has a subtle bounce animation
// ============================================
function Option19BounceCaret() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <style>{`
        @keyframes subtle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .bounce-caret {
          animation: subtle-bounce 2s ease-in-out infinite;
        }
      `}</style>
      <div className="inline-block relative">
        {/* Main text line */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Bouncing caret */}
          <span className="relative mx-2">
            {/* The word floating above */}
            <span
              className={`absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <span
                className="text-2xl md:text-3xl lg:text-4xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Bouncing ^ caret */}
            <svg
              viewBox="0 0 24 14"
              className="w-5 h-3 md:w-7 md:h-4 bounce-caret"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        ✓ Gentle bounce animation — draws attention to the insertion point
      </p>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================
export default function PrototypeHeadlineLayouts() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const options = [
    // Insertion caret variations (what you're exploring)
    { id: "inline-no-line", name: "Inline Caret (No Line)", component: Option14InlineNoLine, recommended: true },
    { id: "caret-below", name: "Caret Below Baseline", component: Option12CaretBelowBaseline, recommended: true },
    { id: "subscript-caret", name: "Subscript Caret (Lower)", component: Option18SubscriptCaret, recommended: true },
    { id: "thin-caret", name: "Thin/Subtle Caret", component: Option15ThinCaret, recommended: false },
    { id: "wide-caret", name: "Wide Flat Caret", component: Option16WideCaret, recommended: false },
    { id: "glow-caret", name: "Caret with Glow", component: Option17CaretWithGlow, recommended: false },
    { id: "bounce-caret", name: "Bouncing Caret", component: Option19BounceCaret, recommended: false },
    { id: "insertion-line", name: "With Connecting Line", component: Option11InsertionWithLine, recommended: false },
    { id: "three-tier", name: "Three-Tier Stack", component: Option13CaretWellBelow, recommended: false },
    // Original insertion caret options
    { id: "insertion-caret", name: "Original Insertion (^)", component: Option9InsertionCaret, recommended: false },
    { id: "insertion-caret-b", name: "Inline ^ Character", component: Option10InsertionCaretB, recommended: false },
    // Other layout options (for comparison)
    { id: "diagonal", name: "Diagonal (Current)", component: Option7Diagonal, recommended: false },
    { id: "fixed-center", name: "Fixed Width (Center)", component: Option3FixedCenter, recommended: false },
    { id: "vertical", name: "Vertical Carousel", component: Option5Vertical, recommended: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              ← Back to Landing
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <KinmoIcon size={22} color="hsl(var(--primary))" />
            <span className="font-semibold">Headline Layout Explorer</span>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="py-10 px-6 border-b bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Single-Line Headline Options
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Each option below shows a different approach to keeping{" "}
            <strong>"See your"</strong> and <strong>"more."</strong> fixed while the
            yellow text rotates through words of varying widths.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Words rotate through: {rotatingWords.slice(0, 4).join(", ")}... including "{rotatingWords[4]}"
          </p>
        </div>
      </section>

      {/* Options Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          {options.map((option, index) => {
            const Component = option.component;
            return (
              <div
                key={option.id}
                className={`relative p-8 rounded-2xl border-2 transition-all ${
                  selectedOption === option.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedOption(option.id)}
              >
                {/* Option header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="text-lg font-semibold">{option.name}</h2>
                    {option.recommended && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  <button
                    className={`text-sm px-3 py-1 rounded-full transition-colors ${
                      selectedOption === option.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOption(selectedOption === option.id ? null : option.id);
                    }}
                  >
                    {selectedOption === option.id ? "Selected" : "Select"}
                  </button>
                </div>

                {/* Component preview */}
                <div className="py-8">
                  <Component />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <section className="py-12 px-6 bg-muted/30 border-t">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center">Quick Comparison</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-background rounded-xl p-5 border">
              <h3 className="font-semibold text-green-600 mb-2">✓ Best for stability</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Fixed Width (Center)</strong>, <strong>Vertical Carousel</strong>, and <strong>Yellow Pill</strong>
                keep the layout rock-solid regardless of word length.
              </p>
            </div>
            <div className="bg-background rounded-xl p-5 border">
              <h3 className="font-semibold text-blue-600 mb-2">✓ Best for engagement</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Typewriter</strong> and <strong>Vertical Carousel</strong> are
                most eye-catching and feel interactive.
              </p>
            </div>
            <div className="bg-background rounded-xl p-5 border">
              <h3 className="font-semibold text-amber-600 mb-2">✓ Best for warmth</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Yellow Pill</strong> adds a soft highlight that feels
                friendly and inviting, matching Kinmo's brand.
              </p>
            </div>
            <div className="bg-background rounded-xl p-5 border">
              <h3 className="font-semibold text-purple-600 mb-2">✓ Simplest CSS</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Fixed Width (Center/Left)</strong> requires minimal code —
                just a fixed-width inline-block container.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t">
        <div className="max-w-3xl mx-auto text-center text-sm text-muted-foreground">
          <p>Click any option to select it. Let me know which direction you'd like to explore further!</p>
        </div>
      </footer>
    </div>
  );
}
