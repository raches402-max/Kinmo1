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
// POLISHED: Hero with design improvements
// ============================================
function PolishedHeroDesktop() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="relative w-full">
      {/* Subtle warm radial gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(245, 192, 48, 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="text-center py-12 px-8">
        {/* Spinning icon with glow */}
        <div className="mb-6">
          <div
            className="mx-auto animate-slow-spin"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(245, 192, 48, 0.3))'
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="24" cy="24" r="14" fill="#F5C030" />
              <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill="#F5C030" />
              <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill="#F5C030" />
              <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill="#F5C030" />
              <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill="#F5C030" />
              <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill="#F5C030" />
              <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill="#F5C030" />
            </svg>
          </div>
        </div>

        {/* Subheading */}
        <p className="text-sm tracking-wide uppercase text-muted-foreground mb-6">
          Using AI to help you
        </p>

        {/* Main headline with Fraunces serif */}
        <div className="inline-block relative pb-6">
          <p
            className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight flex items-baseline justify-center"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            <span>See your</span>
            {/* Subscript caret container */}
            <span className="relative mx-3">
              {/* The word floating above the text */}
              <span
                className={`absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                  isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                }`}
              >
                <span
                  className="text-3xl lg:text-4xl xl:text-5xl font-bold whitespace-nowrap"
                  style={{ color: '#F5C030', fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  {currentWord}
                </span>
              </span>
              {/* Placeholder for spacing */}
              <span className="invisible text-4xl lg:text-5xl xl:text-6xl">^</span>
              {/* Caret positioned as subscript with subtle glow */}
              <svg
                viewBox="0 0 24 14"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-8 h-5 lg:w-10 lg:h-6"
                style={{
                  color: '#F5C030',
                  filter: 'drop-shadow(0 0 4px rgba(245, 192, 48, 0.4))'
                }}
                fill="currentColor"
              >
                <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
              </svg>
            </span>
            <span>more.</span>
          </p>
        </div>

        {/* CTAs with polished button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            className="px-8 py-3 rounded-lg font-semibold text-base transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: '#F5C030',
              color: '#000',
              boxShadow: '0 4px 14px -4px rgba(245, 192, 48, 0.5)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(245, 192, 48, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 14px -4px rgba(245, 192, 48, 0.5)';
            }}
          >
            Get Started →
          </button>
          <button
            className="px-8 py-3 rounded-lg font-medium text-base border border-border bg-transparent transition-all duration-200 hover:bg-muted/50"
          >
            See How It Works
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPARISON: Subscript Caret for Desktop
// ============================================
function SubscriptCaretDesktop() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative pb-6">
        {/* Main text line */}
        <p className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Subscript caret container */}
          <span className="relative mx-3">
            {/* The word floating above the text */}
            <span
              className={`absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              <span
                className="text-3xl lg:text-4xl xl:text-5xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Placeholder for spacing */}
            <span className="invisible text-4xl lg:text-5xl xl:text-6xl">^</span>
            {/* Caret positioned as subscript */}
            <svg
              viewBox="0 0 24 14"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-8 h-5 lg:w-10 lg:h-6"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPARISON: Subscript Caret for Mobile
// ============================================
function SubscriptCaretMobile() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="inline-block relative pb-4">
        {/* Main text line - mobile sized */}
        <p className="text-2xl font-bold text-foreground leading-tight flex items-baseline justify-center">
          <span>See your</span>
          {/* Subscript caret container */}
          <span className="relative mx-1.5">
            {/* The word floating above the text */}
            <span
              className={`absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              <span
                className="text-xl font-bold whitespace-nowrap"
                style={{ color: '#F5C030' }}
              >
                {currentWord}
              </span>
            </span>
            {/* Placeholder for spacing */}
            <span className="invisible text-2xl">^</span>
            {/* Caret positioned as subscript */}
            <svg
              viewBox="0 0 24 14"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 w-4 h-2.5"
              style={{ color: '#F5C030' }}
              fill="currentColor"
            >
              <path d="M12 0 L24 14 L18 14 L12 6 L6 14 L0 14 Z" />
            </svg>
          </span>
          <span>more.</span>
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPARISON: Diagonal Layout for Desktop (Current)
// ============================================
function DiagonalDesktop() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="relative inline-block w-[420px] lg:w-[500px] xl:w-[580px] h-[170px] lg:h-[200px] xl:h-[230px]">
        <span className="absolute top-0 left-0 text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground">
          See your
        </span>
        <span
          className={`absolute top-[38%] left-1/2 -translate-x-1/2 text-4xl lg:text-5xl xl:text-6xl transition-opacity duration-300 font-bold whitespace-nowrap ${
            isAnimating ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: '#F5C030' }}
        >
          {currentWord}
        </span>
        <span className="absolute bottom-0 right-0 text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground">
          more.
        </span>
      </div>
    </div>
  );
}

// ============================================
// COMPARISON: Diagonal Layout for Mobile (Current)
// ============================================
function DiagonalMobile() {
  const { currentWord, isAnimating } = useRotatingWords(2200);

  return (
    <div className="text-center">
      <div className="relative inline-block w-[260px] h-[100px]">
        <span className="absolute top-0 left-0 text-2xl font-bold text-foreground">
          See your
        </span>
        <span
          className={`absolute top-[38%] left-1/2 -translate-x-1/2 text-2xl transition-opacity duration-300 font-bold whitespace-nowrap ${
            isAnimating ? "opacity-0" : "opacity-100"
          }`}
          style={{ color: '#F5C030' }}
        >
          {currentWord}
        </span>
        <span className="absolute bottom-0 right-0 text-2xl font-bold text-foreground">
          more.
        </span>
      </div>
    </div>
  );
}

// ============================================
// Main Page Component - Focused Comparison
// ============================================
export default function PrototypeHeadlineLayouts() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Keep for backwards compatibility but we won't display these
  const options: { id: string; name: string; component: React.ComponentType; recommended: boolean }[] = [];

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
            <span className="font-semibold">Headline Comparison</span>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="py-8 px-6 border-b bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Hero Polish Mockup
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Comparing a <strong>polished version</strong> with design improvements against the current implementation.
          </p>
        </div>
      </section>

      {/* POLISHED HERO SECTION */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center flex items-center justify-center gap-2">
            <span className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">✨ Polished Hero</span>
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto text-sm">
            This version includes: <strong>Fraunces serif font</strong> for warmth, <strong>subtle radial gradient</strong> background,
            <strong> glowing sun icon</strong>, and <strong>polished CTA button</strong> with gold shadow + hover scale.
          </p>

          {/* Full-width polished hero mockup */}
          <div className="rounded-2xl border-2 border-primary overflow-hidden bg-background">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-3 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">POLISHED</span>
                <h3 className="font-semibold">Hero with Design Improvements</h3>
              </div>
            </div>
            <PolishedHeroDesktop />
          </div>
        </div>
      </section>

      {/* CURRENT HERO FOR COMPARISON */}
      <section className="py-12 px-6 border-b bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center flex items-center justify-center gap-2">
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">Current Hero</span>
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto text-sm">
            For comparison: the current implementation without the polish improvements.
          </p>

          {/* Current hero representation */}
          <div className="rounded-2xl border-2 border-border overflow-hidden bg-background">
            <div className="bg-muted/30 px-6 py-3 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full font-medium">CURRENT</span>
                <h3 className="font-semibold">Subscript Caret (No Polish)</h3>
              </div>
            </div>
            <div className="py-12 px-8">
              <div className="text-center">
                {/* Icon without glow */}
                <div className="mb-6">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 48 48"
                    fill="none"
                    className="mx-auto animate-slow-spin"
                    aria-hidden="true"
                  >
                    <circle cx="24" cy="24" r="14" fill="#F5C030" />
                    <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill="#F5C030" />
                    <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill="#F5C030" />
                    <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill="#F5C030" />
                    <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill="#F5C030" />
                    <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill="#F5C030" />
                    <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill="#F5C030" />
                  </svg>
                </div>
                <p className="text-sm tracking-wide uppercase text-muted-foreground mb-6">
                  Using AI to help you
                </p>
                <SubscriptCaretDesktop />
                {/* Standard buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <button
                    className="px-8 py-3 rounded-lg font-semibold text-base"
                    style={{ backgroundColor: '#F5C030', color: '#000' }}
                  >
                    Get Started →
                  </button>
                  <button className="px-8 py-3 rounded-lg font-medium text-base border border-border bg-transparent">
                    See How It Works
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IMPROVEMENTS BREAKDOWN */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-8 text-center">What Changed</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border p-5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🎨</span>
                <h3 className="font-semibold">Background Gradient</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Subtle warm radial gradient radiating from center. Creates depth and atmosphere without being distracting.
              </p>
            </div>

            <div className="rounded-xl border p-5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">✒️</span>
                <h3 className="font-semibold">Fraunces Serif Font</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Switched headline from Plus Jakarta Sans to Fraunces. Adds warmth and personality while maintaining readability.
              </p>
            </div>

            <div className="rounded-xl border p-5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">☀️</span>
                <h3 className="font-semibold">Icon Glow</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Added soft gold drop-shadow to the spinning sun. Creates a halo effect that draws attention.
              </p>
            </div>

            <div className="rounded-xl border p-5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🔘</span>
                <h3 className="font-semibold">Button Polish</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Gold shadow glow on primary button, subtle scale on hover (1.02×), press feedback on click (0.98×).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DESKTOP COMPARISON */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-8 text-center flex items-center justify-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">Desktop</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Option A: Subscript Caret */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 overflow-hidden">
              <div className="bg-primary/10 px-6 py-3 border-b border-primary/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">NEW</span>
                  <h3 className="font-semibold">Subscript Caret</h3>
                </div>
              </div>
              <div className="p-8 min-h-[280px] flex items-center justify-center bg-background">
                <SubscriptCaretDesktop />
              </div>
            </div>

            {/* Option B: Diagonal (Current) */}
            <div className="rounded-2xl border-2 border-border overflow-hidden">
              <div className="bg-muted/50 px-6 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full font-medium">CURRENT</span>
                  <h3 className="font-semibold">Diagonal Layout</h3>
                </div>
              </div>
              <div className="p-8 min-h-[280px] flex items-center justify-center bg-background">
                <DiagonalDesktop />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MOBILE COMPARISON */}
      <section className="py-12 px-6 border-b bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-8 text-center flex items-center justify-center gap-2">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">Mobile</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-8 justify-center">
            {/* Mobile: Subscript Caret */}
            <div className="flex flex-col items-center">
              <div className="w-[320px] rounded-[2rem] border-[8px] border-gray-800 bg-background overflow-hidden shadow-xl">
                {/* Phone notch */}
                <div className="bg-gray-800 h-6 flex justify-center items-end pb-1">
                  <div className="w-20 h-4 bg-black rounded-b-xl"></div>
                </div>
                {/* Screen content */}
                <div className="p-6 min-h-[200px] flex items-center justify-center">
                  <SubscriptCaretMobile />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-primary">Subscript Caret</p>
            </div>

            {/* Mobile: Diagonal */}
            <div className="flex flex-col items-center">
              <div className="w-[320px] rounded-[2rem] border-[8px] border-gray-800 bg-background overflow-hidden shadow-xl">
                {/* Phone notch */}
                <div className="bg-gray-800 h-6 flex justify-center items-end pb-1">
                  <div className="w-20 h-4 bg-black rounded-b-xl"></div>
                </div>
                {/* Screen content */}
                <div className="p-6 min-h-[200px] flex items-center justify-center">
                  <DiagonalMobile />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">Diagonal (Current)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ANALYSIS */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-8 text-center">Analysis: What to Consider</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Subscript Caret Analysis */}
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span style={{ color: '#F5C030' }}>▲</span> Subscript Caret
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">Strengths</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• <strong>Compact:</strong> Takes less vertical space than diagonal</li>
                    <li>• <strong>Readable:</strong> "See your ^ more." reads naturally as a sentence</li>
                    <li>• <strong>Clever:</strong> The caret metaphor (insert missing word) is charming and human</li>
                    <li>• <strong>Stable:</strong> Black text never moves regardless of word length</li>
                    <li>• <strong>Unique:</strong> Distinctive, not a common pattern</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-amber-600 mb-2">Considerations</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• <strong>Visual hierarchy:</strong> The rotating word competes with the caret for attention</li>
                    <li>• <strong>Caret meaning:</strong> Not everyone may immediately "get" the insertion metaphor</li>
                    <li>• <strong>Mobile:</strong> Tighter spacing means less breathing room for long words</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Diagonal Analysis */}
            <div className="rounded-2xl border-2 border-border bg-muted/30 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="text-muted-foreground">↘</span> Diagonal Layout
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">Strengths</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• <strong>Dramatic:</strong> The diagonal creates visual energy and movement</li>
                    <li>• <strong>Breathing room:</strong> Plenty of space for even the longest words</li>
                    <li>• <strong>Hero presence:</strong> Takes up more space, feels more "hero section"</li>
                    <li>• <strong>Proven:</strong> Already tested and working in production</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-amber-600 mb-2">Considerations</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• <strong>Space:</strong> Takes more vertical real estate</li>
                    <li>• <strong>Reading flow:</strong> Eye has to jump around (not linear left-to-right)</li>
                    <li>• <strong>Mobile:</strong> The diagonal can feel cramped on small screens</li>
                    <li>• <strong>Less unique:</strong> Staggered text is a more common pattern</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <h3 className="font-bold text-lg mb-3">My Take</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The <strong>Subscript Caret</strong> is more distinctive and creates a tighter, more readable layout.
              The "handwritten insertion" metaphor fits Kinmo's warm, human brand — it's like you're
              filling in the blank for who you want to see more.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>For mobile:</strong> You could use the Subscript Caret on both, or keep Diagonal on mobile
              where the extra vertical space isn't as costly. The caret works at mobile size, but it's tighter.
            </p>
          </div>
        </div>
      </section>

      {/* Quick decision helper */}
      <section className="py-10 px-6 bg-muted/30 border-t">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="font-bold mb-4">Quick Decision Guide</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-background rounded-xl p-4 border">
              <p className="font-medium mb-2">Choose Subscript Caret if...</p>
              <p className="text-muted-foreground">You want compact, unique, and a clever "fill in the blank" feel</p>
            </div>
            <div className="bg-background rounded-xl p-4 border">
              <p className="font-medium mb-2">Keep Diagonal if...</p>
              <p className="text-muted-foreground">You want dramatic presence and maximum breathing room for text</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t">
        <div className="max-w-3xl mx-auto text-center text-sm text-muted-foreground">
          <p>Let me know which direction you'd like to go, or if you want to see any adjustments!</p>
        </div>
      </footer>
    </div>
  );
}
