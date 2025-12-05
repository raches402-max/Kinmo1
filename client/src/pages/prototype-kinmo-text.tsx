import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles, ThumbsUp, ThumbsDown, Play, Pause } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

/*
 * Gradient Button Exploration
 *
 * Goal: Bridge the muted gold (#F2C94C) and bright gold (#FFB800)
 * with subtle gradients that feel sophisticated, not corny.
 *
 * Key principle: Subtlety. The gradient should feel like natural
 * light hitting the button, not a "Web 2.0" effect.
 */

interface GradientOption {
  id: string;
  name: string;
  description: string;
  gradient: string;
  startColor: string;
  endColor: string;
  verdict: "recommended" | "subtle" | "bold" | "experimental";
  notes: string;
}

const gradientOptions: GradientOption[] = [
  {
    id: "very-subtle",
    name: "Ultra Subtle",
    description: "Almost imperceptible shift",
    gradient: "linear-gradient(135deg, #F4C74C 0%, #F8BE30 100%)",
    startColor: "#F4C74C",
    endColor: "#F8BE30",
    verdict: "recommended",
    notes: "If you want the gradient to be felt more than seen. Extremely refined. The warmth comes through without being obvious.",
  },
  {
    id: "subtle-horizontal",
    name: "Subtle Horizontal",
    description: "Muted → Bright (left to right)",
    gradient: "linear-gradient(90deg, #F2C94C 0%, #FFB800 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "subtle",
    notes: "Clean and modern. The eye naturally follows left-to-right, ending on the brighter, more energetic tone.",
  },
  {
    id: "subtle-horizontal-reverse",
    name: "Subtle Horizontal (Reverse)",
    description: "Bright → Muted (left to right)",
    gradient: "linear-gradient(90deg, #FFB800 0%, #F2C94C 100%)",
    startColor: "#FFB800",
    endColor: "#F2C94C",
    verdict: "subtle",
    notes: "Starts bright near the text, fades to softer. Good if you want the button to feel grounded.",
  },
  {
    id: "diagonal-warm",
    name: "Diagonal Warm",
    description: "Top-left to bottom-right sweep",
    gradient: "linear-gradient(135deg, #F2C94C 0%, #FFB800 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "subtle",
    notes: "Diagonal adds dynamism without being flashy. Feels like natural light catching the surface.",
  },
  {
    id: "diagonal-reverse",
    name: "Diagonal (Reverse)",
    description: "Bottom-left to top-right",
    gradient: "linear-gradient(45deg, #F2C94C 0%, #FFB800 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "subtle",
    notes: "Upward diagonal can feel uplifting. Subtle energy lift.",
  },
  {
    id: "center-glow",
    name: "Center Glow",
    description: "Bright center, muted edges",
    gradient: "linear-gradient(90deg, #F2C94C 0%, #FFB800 50%, #F2C94C 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "bold",
    notes: "Creates a subtle 'glow' or highlight in the center. More noticeable but can feel premium.",
  },
  {
    id: "soft-shine",
    name: "Soft Shine",
    description: "Diagonal with soft highlight",
    gradient: "linear-gradient(135deg, #F2C94C 0%, #FFBE00 40%, #FFB800 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "subtle",
    notes: "Three-stop gradient creates depth like light reflecting off metal. Sophisticated.",
  },
  {
    id: "warm-to-golden",
    name: "Warm to Golden",
    description: "Using the graduated warmth colors",
    gradient: "linear-gradient(90deg, #E5A800 0%, #F0B000 50%, #FFBA00 100%)",
    startColor: "#E5A800",
    endColor: "#FFBA00",
    verdict: "experimental",
    notes: "Uses your graduated warmth palette in a single button. Rich and cohesive.",
  },
  {
    id: "vertical-subtle",
    name: "Vertical Subtle",
    description: "Top to bottom, muted → bright",
    gradient: "linear-gradient(180deg, #F2C94C 0%, #FFB800 100%)",
    startColor: "#F2C94C",
    endColor: "#FFB800",
    verdict: "subtle",
    notes: "Vertical gradients can feel like the button has depth/dimension. Classic approach.",
  },
  {
    id: "vertical-highlight",
    name: "Vertical Highlight",
    description: "Bright top edge, muted body",
    gradient: "linear-gradient(180deg, #FFB800 0%, #F2C94C 30%, #F2C94C 100%)",
    startColor: "#FFB800",
    endColor: "#F2C94C",
    verdict: "bold",
    notes: "Simulates top lighting. Can look like a real 3D button if done right.",
  },
];

function GradientButton({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <button
      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-black shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ background: gradient }}
    >
      {children}
    </button>
  );
}

function MiniPreview({ gradient, startColor, endColor }: { gradient: string; startColor: string; endColor: string }) {
  const gradientId = `sun-gradient-${startColor.replace('#', '')}`;

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      {/* Mini header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
          <defs>
            <linearGradient id={`header-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="20" fill={`url(#header-${gradientId})`} />
        </svg>
        <span className="font-medium text-xs">Kinmo</span>
      </div>

      {/* Mini hero */}
      <div className="px-3 py-4 text-center">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="mx-auto mb-2">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="14" fill={`url(#${gradientId})`} />
          <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={`url(#${gradientId})`} />
          <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={`url(#${gradientId})`} />
          <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={`url(#${gradientId})`} />
          <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={`url(#${gradientId})`} />
          <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={`url(#${gradientId})`} />
          <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={`url(#${gradientId})`} />
        </svg>
        <p className="text-[10px] font-bold mb-2">
          See your <span className="bg-clip-text text-transparent" style={{ backgroundImage: gradient }}>friends</span> more.
        </p>
        <button
          className="px-3 py-1 rounded text-[10px] font-semibold text-black"
          style={{ background: gradient }}
        >
          Get Started →
        </button>
      </div>
    </div>
  );
}

// Live animated preview with full rotation animation
type AnimationPhase = "rotating" | "fadeToKinmo" | "kinmo" | "fadeOut" | "fadeIn";
type TextColorApproach = "hero-pop" | "unified-bright" | "gradient-text";

// Compact animated preview for side-by-side comparison
function CompactAnimatedPreview({
  gradient,
  startColor,
  endColor,
  textApproach,
  label,
  description
}: {
  gradient: string;
  startColor: string;
  endColor: string;
  textApproach: TextColorApproach;
  label: string;
  description: string;
}) {
  const gradientId = `compact-sun-${textApproach}-${startColor.replace('#', '')}`;
  const words = ["friends", "family", "loved ones", "crew"];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState<AnimationPhase>("rotating");
  const [cycleCount, setCycleCount] = useState(0);

  // Get text style based on approach
  const getTextStyle = () => {
    switch (textApproach) {
      case "hero-pop":
        return { color: '#FFB800' };
      case "unified-bright":
        return { color: '#F8BE30' };
      case "gradient-text":
        return {
          backgroundImage: gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        } as React.CSSProperties;
    }
  };

  // Animation timing
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "rotating") {
      timer = setInterval(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentIndex((prev) => {
            const nextIndex = (prev + 1) % words.length;
            if (nextIndex === 0) {
              setCycleCount(c => c + 1);
            }
            return nextIndex;
          });
          setIsAnimating(false);
        }, 300);
      }, 1800); // Slightly faster for compact view
    }

    return () => clearInterval(timer);
  }, [phase, words.length]);

  // After one cycle, fade to "kin" then "Kinmo"
  useEffect(() => {
    if (cycleCount > 0 && phase === "rotating") {
      setPhase("fadeToKinmo");

      const kinTimer = setTimeout(() => setPhase("kinmo"), 500);
      const holdTimer = setTimeout(() => setPhase("fadeOut"), 2500);
      const restartTimer = setTimeout(() => {
        setPhase("fadeIn");
        setCurrentIndex(0);
      }, 2900);
      const finalTimer = setTimeout(() => {
        setPhase("rotating");
        setCycleCount(0);
      }, 3200);

      return () => {
        clearTimeout(kinTimer);
        clearTimeout(holdTimer);
        clearTimeout(restartTimer);
        clearTimeout(finalTimer);
      };
    }
  }, [cycleCount, phase]);

  return (
    <div className="bg-background rounded-xl border-2 border-border overflow-hidden">
      {/* Label header */}
      <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
        <p className="font-semibold text-sm text-center">{label}</p>
        <p className="text-[10px] text-muted-foreground text-center">{description}</p>
      </div>

      {/* Animated preview */}
      <div className="px-4 py-6 text-center">
        {/* Gradient sun */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 animate-slow-spin">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="14" fill={`url(#${gradientId})`} />
          <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={`url(#${gradientId})`} />
          <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={`url(#${gradientId})`} />
          <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={`url(#${gradientId})`} />
          <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={`url(#${gradientId})`} />
          <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={`url(#${gradientId})`} />
          <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={`url(#${gradientId})`} />
        </svg>

        {/* Animated headline */}
        <div className="relative h-10 flex items-center justify-center">
          <p className="text-base font-bold text-foreground">
            See your{" "}
            <span className="relative inline-block w-[90px] h-[1.2em] align-bottom">
              {phase === "fadeToKinmo" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap animate-pulse"
                  style={getTextStyle()}
                >
                  kin
                </span>
              )}

              {phase === "kinmo" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap"
                  style={getTextStyle()}
                >
                  Kinmo
                </span>
              )}

              {phase === "fadeOut" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap opacity-0 transition-opacity duration-300"
                  style={getTextStyle()}
                >
                  Kinmo
                </span>
              )}

              {phase === "fadeIn" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap opacity-0 transition-opacity duration-300"
                  style={getTextStyle()}
                >
                  {words[0]}
                </span>
              )}

              {phase === "rotating" && (
                <span
                  className={`absolute top-[38%] left-1/2 -translate-x-1/2 transition-opacity duration-300 font-bold whitespace-nowrap ${
                    isAnimating ? "opacity-0" : "opacity-100"
                  }`}
                  style={getTextStyle()}
                >
                  {words[currentIndex]}
                </span>
              )}
            </span>{" "}
            more.
          </p>
        </div>

        {/* CTA button */}
        <button
          className="mt-4 px-4 py-1.5 rounded-lg text-xs font-semibold text-black"
          style={{ background: gradient }}
        >
          Get Started →
        </button>
      </div>

      {/* Color indicator */}
      <div className="px-3 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center justify-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-black/10"
            style={{ background: textApproach === "gradient-text" ? gradient : (textApproach === "hero-pop" ? "#FFB800" : "#F8BE30") }}
          />
          <code className="text-[10px] text-muted-foreground">
            {textApproach === "hero-pop" ? "#FFB800" : textApproach === "unified-bright" ? "#F8BE30" : "gradient"}
          </code>
        </div>
      </div>
    </div>
  );
}

function LiveAnimatedPreview({ gradient, startColor, endColor }: { gradient: string; startColor: string; endColor: string }) {
  const gradientId = `live-sun-${startColor.replace('#', '')}`;
  const words = ["friends", "family", "loved ones", "people", "crew"];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState<AnimationPhase>("rotating");
  const [cycleCount, setCycleCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Animation timing
  useEffect(() => {
    if (isPaused) return;

    let timer: NodeJS.Timeout;

    if (phase === "rotating") {
      // Rotate through words
      timer = setInterval(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentIndex((prev) => {
            const nextIndex = (prev + 1) % words.length;
            // After completing one full cycle, transition to kinmo
            if (nextIndex === 0) {
              setCycleCount(c => c + 1);
            }
            return nextIndex;
          });
          setIsAnimating(false);
        }, 300);
      }, 2000);
    }

    return () => clearInterval(timer);
  }, [phase, isPaused, words.length]);

  // After one cycle, fade to "kin" then "Kinmo"
  useEffect(() => {
    if (cycleCount > 0 && phase === "rotating") {
      setPhase("fadeToKinmo");

      // Fade "kin" for 600ms, then show full "Kinmo"
      const kinTimer = setTimeout(() => {
        setPhase("kinmo");
      }, 600);

      // Hold "Kinmo" for 2.5s, then fade out
      const holdTimer = setTimeout(() => {
        setPhase("fadeOut");
      }, 3100);

      // Fade out, then restart rotation
      const restartTimer = setTimeout(() => {
        setPhase("fadeIn");
        setCurrentIndex(0);
      }, 3500);

      const finalTimer = setTimeout(() => {
        setPhase("rotating");
        setCycleCount(0);
      }, 3900);

      return () => {
        clearTimeout(kinTimer);
        clearTimeout(holdTimer);
        clearTimeout(restartTimer);
        clearTimeout(finalTimer);
      };
    }
  }, [cycleCount, phase]);

  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden shadow-lg">
      {/* Header with play/pause */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id={`header-live-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={startColor} />
                <stop offset="100%" stopColor={endColor} />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill={`url(#header-live-${gradientId})`} />
          </svg>
          <span className="font-semibold text-sm">Kinmo</span>
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {isPaused ? "Play" : "Pause"}
        </button>
      </div>

      {/* Animated hero section */}
      <div className="px-6 py-12 text-center bg-background">
        {/* Large gradient sun - with slow rotation like landing page */}
        <svg width="80" height="80" viewBox="0 0 48 48" fill="none" className="mx-auto mb-6 animate-slow-spin">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="14" fill={`url(#${gradientId})`} />
          <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={`url(#${gradientId})`} />
          <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={`url(#${gradientId})`} />
          <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={`url(#${gradientId})`} />
          <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={`url(#${gradientId})`} />
          <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={`url(#${gradientId})`} />
          <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={`url(#${gradientId})`} />
        </svg>

        {/* Animated headline */}
        <div className="relative h-16 flex items-center justify-center">
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            See your{" "}
            <span className="relative inline-block w-[140px] h-[1.2em] align-bottom">
              {/* fadeToKinmo phase: show "kin" fading in */}
              {phase === "fadeToKinmo" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap animate-pulse"
                  style={{
                    backgroundImage: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  kin
                </span>
              )}

              {/* kinmo phase: show full "Kinmo" */}
              {phase === "kinmo" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap"
                  style={{
                    backgroundImage: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Kinmo
                </span>
              )}

              {/* fadeOut phase: "Kinmo" fading out */}
              {phase === "fadeOut" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap opacity-0 transition-opacity duration-400"
                  style={{
                    backgroundImage: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Kinmo
                </span>
              )}

              {/* fadeIn phase: first word fading in */}
              {phase === "fadeIn" && (
                <span
                  className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap opacity-0 transition-opacity duration-400"
                  style={{
                    backgroundImage: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {words[0]}
                </span>
              )}

              {/* rotating phase: cycle through words */}
              {phase === "rotating" && (
                <span
                  className={`absolute top-[38%] left-1/2 -translate-x-1/2 transition-opacity duration-300 font-bold whitespace-nowrap ${
                    isAnimating ? "opacity-0" : "opacity-100"
                  }`}
                  style={{
                    backgroundImage: gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {words[currentIndex]}
                </span>
              )}
            </span>{" "}
            more.
          </p>
        </div>

        {/* CTA button with gradient */}
        <button
          className="mt-6 px-6 py-2.5 rounded-lg text-sm font-semibold text-black shadow-sm hover:shadow-md transition-all"
          style={{ background: gradient }}
        >
          Get Started <ArrowRight className="w-4 h-4 inline ml-1" />
        </button>
      </div>

      {/* Phase indicator */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Phase:</span>
          <span className={`px-2 py-0.5 rounded font-medium ${
            phase === "rotating" ? "bg-blue-100 text-blue-700" :
            phase === "fadeToKinmo" ? "bg-amber-100 text-amber-700" :
            phase === "kinmo" ? "bg-green-100 text-green-700" :
            "bg-gray-100 text-gray-700"
          }`}>
            {phase === "rotating" ? `Rotating: "${words[currentIndex]}"` :
             phase === "fadeToKinmo" ? '"kin" appearing' :
             phase === "kinmo" ? '"Kinmo" displayed' :
             phase === "fadeOut" ? "Fading out" :
             "Fading in"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PrototypeKinmoText() {
  const [selected, setSelected] = useState<string>("very-subtle");
  const [showCornyGuide, setShowCornyGuide] = useState(false);

  const selectedOption = gradientOptions.find(o => o.id === selected)!;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
              ← Back to Landing
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Gradient Explorer</span>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="py-8 px-4 border-b border-black/5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-3">Gradient Button Options</h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Subtle gradients can elegantly bridge your muted gold and bright gold.
            The key is <strong>restraint</strong> — the gradient should feel like natural light, not a 2008 web effect.
          </p>
          <button
            onClick={() => setShowCornyGuide(!showCornyGuide)}
            className="text-sm text-amber-600 hover:text-amber-700 underline"
          >
            {showCornyGuide ? "Hide" : "Show"}: What makes a gradient corny vs. sophisticated?
          </button>

          {showCornyGuide && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5 text-left max-w-xl mx-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>Corny vs. Sophisticated Gradients</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-red-600 flex items-center gap-1 mb-2">
                    <ThumbsDown className="w-3 h-3" /> Corny
                  </p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Dramatic color jumps</li>
                    <li>• Shiny/glossy "Web 2.0"</li>
                    <li>• Multiple unrelated colors</li>
                    <li>• Heavy drop shadows</li>
                    <li>• Beveled edges</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-green-600 flex items-center gap-1 mb-2">
                    <ThumbsUp className="w-3 h-3" /> Sophisticated
                  </p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Subtle color shifts</li>
                    <li>• Same color family</li>
                    <li>• Mimics natural light</li>
                    <li>• Flat or minimal shadow</li>
                    <li>• Clean edges</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* TEXT COLOR COMPARISON - Three approaches side by side */}
      <section className="py-8 px-4 bg-gradient-to-b from-white to-gray-50 border-b border-black/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-2 text-center">
            Text Color Approaches
          </h2>
          <p className="text-center text-gray-500 text-sm mb-6">
            Compare three ways to style the rotating text with the Ultra Subtle gradient sun
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CompactAnimatedPreview
              gradient={selectedOption.gradient}
              startColor={selectedOption.startColor}
              endColor={selectedOption.endColor}
              textApproach="hero-pop"
              label="Hero Pop"
              description="Brightest gold for max impact"
            />
            <CompactAnimatedPreview
              gradient={selectedOption.gradient}
              startColor={selectedOption.startColor}
              endColor={selectedOption.endColor}
              textApproach="unified-bright"
              label="Unified Bright"
              description="Matches gradient's bright end"
            />
            <CompactAnimatedPreview
              gradient={selectedOption.gradient}
              startColor={selectedOption.startColor}
              endColor={selectedOption.endColor}
              textApproach="gradient-text"
              label="Gradient Text"
              description="Full gradient on text"
            />
          </div>

          {/* Quick recommendation */}
          <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200 max-w-2xl mx-auto">
            <p className="text-sm text-green-800">
              <strong>Recommendation:</strong> Hero Pop (#FFB800) gives the text the prominence it needs while letting the subtle gradient sun support without competing.
            </p>
          </div>
        </div>
      </section>

      {/* Gradient Options Grid */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-6 text-center">
            Select a Gradient Style
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gradientOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selected === option.id
                    ? "border-amber-400 bg-amber-50/50 shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {/* Gradient preview bar */}
                <div
                  className="h-8 rounded-md mb-3 border border-black/5"
                  style={{ background: option.gradient }}
                />

                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{option.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    option.verdict === "recommended" ? "bg-green-100 text-green-700" :
                    option.verdict === "subtle" ? "bg-blue-100 text-blue-700" :
                    option.verdict === "bold" ? "bg-orange-100 text-orange-700" :
                    "bg-purple-100 text-purple-700"
                  }`}>
                    {option.verdict}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{option.description}</p>

                {selected === option.id && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mt-2">
                    <Check className="w-3 h-3" />
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Selected Detail */}
      <section className="py-8 px-4 bg-white border-y border-black/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Large button preview */}
            <div>
              <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Button Preview</h3>
              <div className="bg-gray-50 rounded-xl p-8 border border-gray-100 flex flex-col items-center gap-6">
                {/* Large button */}
                <GradientButton gradient={selectedOption.gradient}>
                  Get Started <ArrowRight className="w-4 h-4 inline ml-1" />
                </GradientButton>

                {/* Smaller button */}
                <button
                  className="px-4 py-1.5 rounded-md text-xs font-semibold text-black"
                  style={{ background: selectedOption.gradient }}
                >
                  Learn More
                </button>

                {/* CSS code */}
                <div className="w-full">
                  <p className="text-xs text-gray-400 mb-1">CSS:</p>
                  <code className="text-xs bg-gray-800 text-green-400 px-3 py-2 rounded block overflow-x-auto">
                    background: {selectedOption.gradient};
                  </code>
                </div>
              </div>
            </div>

            {/* In-context preview */}
            <div>
              <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">In Context</h3>
              <MiniPreview
                gradient={selectedOption.gradient}
                startColor={selectedOption.startColor}
                endColor={selectedOption.endColor}
              />

              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h4 className="font-semibold text-sm mb-2">{selectedOption.name}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{selectedOption.notes}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-side comparison */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-6 text-center">
            Compare: Flat vs. Selected Gradient
          </h2>

          <div className="grid grid-cols-3 gap-6">
            {/* Flat muted */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-3">Flat Muted (#F2C94C)</p>
              <button
                className="px-5 py-2 rounded-lg text-sm font-semibold text-black"
                style={{ background: "#F2C94C" }}
              >
                Get Started →
              </button>
            </div>

            {/* Selected gradient */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-3">Selected Gradient</p>
              <button
                className="px-5 py-2 rounded-lg text-sm font-semibold text-black"
                style={{ background: selectedOption.gradient }}
              >
                Get Started →
              </button>
            </div>

            {/* Flat bright */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-3">Flat Bright (#FFB800)</p>
              <button
                className="px-5 py-2 rounded-lg text-sm font-semibold text-black"
                style={{ background: "#FFB800" }}
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation */}
      <section className="py-10 px-4 border-t border-black/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-4">My Take: Ultra Subtle is Perfect</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-left">
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>Ultra Subtle is a great choice.</strong> Here's why it works so well:
            </p>

            {/* Top pick highlight */}
            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border-2 border-green-200 mb-4">
              <div className="flex-shrink-0">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <defs>
                    <linearGradient id="rec-sun-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F4C74C" />
                      <stop offset="100%" stopColor="#F8BE30" />
                    </linearGradient>
                  </defs>
                  <circle cx="24" cy="24" r="14" fill="url(#rec-sun-gradient)" />
                  <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill="url(#rec-sun-gradient)" />
                  <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill="url(#rec-sun-gradient)" />
                  <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill="url(#rec-sun-gradient)" />
                  <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill="url(#rec-sun-gradient)" />
                  <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill="url(#rec-sun-gradient)" />
                  <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill="url(#rec-sun-gradient)" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800 mb-1">Ultra Subtle — Top Pick</p>
                <p className="text-sm text-green-700 leading-relaxed">
                  The gradient is so refined it's almost invisible — felt more than seen. This gives you the warmth and cohesion
                  you want without any risk of looking dated. Applied to the sun, it creates a beautiful, natural glow.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-6 w-20 rounded" style={{ background: "linear-gradient(135deg, #F4C74C 0%, #F8BE30 100%)" }} />
                  <code className="text-xs text-green-600">#F4C74C → #F8BE30</code>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>Why Ultra Subtle works:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Keeps your calm, friendly app vibe intact</li>
                <li>The sun gets a natural warmth without being "gradient-y"</li>
                <li>Buttons feel premium but not flashy</li>
                <li>Both colors are close enough that there's no clash</li>
              </ul>
            </div>

            <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
              You could even keep the hero rotating text at the brighter #FFB800 for extra pop,
              while the sun and buttons use this ultra-subtle gradient. Best of both worlds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
