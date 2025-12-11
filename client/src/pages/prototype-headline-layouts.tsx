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
// Main Page Component
// ============================================
export default function PrototypeHeadlineLayouts() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const options = [
    { id: "caret", name: "Caret/Cursor", component: Option1Caret, recommended: false },
    { id: "fixed-left", name: "Fixed Width (Left)", component: Option2FixedLeft, recommended: false },
    { id: "fixed-center", name: "Fixed Width (Center)", component: Option3FixedCenter, recommended: true },
    { id: "pill", name: "Yellow Pill", component: Option4Pill, recommended: true },
    { id: "underline", name: "Underline Accent", component: Option4Underline, recommended: false },
    { id: "brackets", name: "Decorative Brackets", component: Option4Brackets, recommended: false },
    { id: "vertical", name: "Vertical Carousel", component: Option5Vertical, recommended: true },
    { id: "typewriter", name: "Typewriter Effect", component: Option6Typewriter, recommended: false },
    { id: "diagonal", name: "Diagonal (Current)", component: Option7Diagonal, recommended: false },
    { id: "two-line", name: "Two-Line", component: Option8TwoLine, recommended: false },
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
