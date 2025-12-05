import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star } from "lucide-react";

/*
 * Kinmo Landing Page Color Exploration
 *
 * Taking a step back to explore fundamentally different color directions
 * for the landing page. Each direction maintains the warm, human-connection
 * feel but approaches it differently.
 */

interface ColorDirection {
  id: string;
  name: string;
  tagline: string;
  description: string;
  // Colors
  accent: string;        // Primary accent (sun, rotating text)
  accentHover: string;   // Hover state
  buttonBg: string;      // CTA button background
  buttonText: string;    // CTA button text
  pageBg: string;        // Page background
  cardBg: string;        // Card/section background
  textPrimary: string;   // Main text
  textMuted: string;     // Secondary text
  border: string;        // Borders
  // Gradient option for sun (optional)
  sunGradient?: { start: string; end: string };
  // Mood/reasoning
  mood: string;
  pros: string[];
  cons: string[];
}

const colorDirections: ColorDirection[] = [
  {
    id: "current",
    name: "Current Muted Gold",
    tagline: "Soft and approachable",
    description: "Your existing palette. Calm, friendly, but may lack punch.",
    accent: "#F2C94C",
    accentHover: "#E5B93D",
    buttonBg: "#F2C94C",
    buttonText: "#1a1a1a",
    pageBg: "#FFFFFF",
    cardBg: "#FAFAFA",
    textPrimary: "#1a1a1a",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    mood: "Gentle, unassuming, easy on the eyes",
    pros: ["Calming", "Not aggressive", "Works with white"],
    cons: ["Can feel faint", "Low contrast", "May not grab attention"],
  },
  {
    id: "balanced-gold",
    name: "Balanced Gold",
    tagline: "The sweet spot",
    description: "Halfway between muted and bright. Readable but not overwhelming.",
    accent: "#F5C030",
    accentHover: "#E8B328",
    buttonBg: "#F5C030",
    buttonText: "#1a1a1a",
    pageBg: "#FFFFFF",
    cardBg: "#FFFCF5",
    textPrimary: "#1a1a1a",
    textMuted: "#6b7280",
    border: "#f0e8d8",
    mood: "Warm, confident, approachable",
    pros: ["Good contrast", "Not too bright", "Still warm"],
    cons: ["Compromise (neither extreme)"],
  },
  {
    id: "bright-gold",
    name: "Bright Gold",
    tagline: "Bold and energetic",
    description: "The #FFB800 you explored. More vibrant and attention-grabbing.",
    accent: "#FFB800",
    accentHover: "#E6A600",
    buttonBg: "#FFB800",
    buttonText: "#1a1a1a",
    pageBg: "#FFFFFF",
    cardBg: "#FFFBF0",
    textPrimary: "#1a1a1a",
    textMuted: "#6b7280",
    border: "#f0e6d3",
    mood: "Confident, warm, sunshine",
    pros: ["High visibility", "Energetic", "Memorable"],
    cons: ["Can be overwhelming", "Bright on buttons"],
  },
  {
    id: "amber-rich",
    name: "Rich Amber",
    tagline: "Sophisticated warmth",
    description: "Deeper, more refined gold with hints of orange. Feels premium.",
    accent: "#E5A000",
    accentHover: "#CC8F00",
    buttonBg: "#E5A000",
    buttonText: "#FFFFFF",
    pageBg: "#FEFCF8",
    cardBg: "#FFF9F0",
    textPrimary: "#2d2418",
    textMuted: "#7a6f5c",
    border: "#e8dfd0",
    sunGradient: { start: "#F0B800", end: "#D49000" },
    mood: "Warm honey, autumnal, established",
    pros: ["Sophisticated", "Easier to read", "Feels premium"],
    cons: ["Less playful", "Slightly heavier"],
  },
  {
    id: "sunset-coral",
    name: "Sunset Coral",
    tagline: "Warm and human",
    description: "A coral/peach direction. Still warm but distinctly different.",
    accent: "#F28B66",
    accentHover: "#E07850",
    buttonBg: "#F28B66",
    buttonText: "#FFFFFF",
    pageBg: "#FFFBF9",
    cardBg: "#FFF5F2",
    textPrimary: "#3d2c24",
    textMuted: "#8a7068",
    border: "#f0ddd6",
    sunGradient: { start: "#F5A070", end: "#E86F4C" },
    mood: "Approachable, organic, human skin tone",
    pros: ["Very human/warm", "Unique", "Soft but visible"],
    cons: ["Departure from gold", "Different brand feel"],
  },
  {
    id: "earthy-sage",
    name: "Earthy Sage",
    tagline: "Grounded and calm",
    description: "A sage green direction. Connotes growth, nature, groundedness.",
    accent: "#7BA05B",
    accentHover: "#6A8F4A",
    buttonBg: "#7BA05B",
    buttonText: "#FFFFFF",
    pageBg: "#FAFCF8",
    cardBg: "#F4F7F0",
    textPrimary: "#2a3324",
    textMuted: "#5c6b52",
    border: "#d4e0c8",
    mood: "Rooted, trustworthy, organic growth",
    pros: ["Calming", "Nature connection", "Trustworthy"],
    cons: ["Less warmth", "Very different direction"],
  },
  {
    id: "warm-terracotta",
    name: "Warm Terracotta",
    tagline: "Earthy and inviting",
    description: "Terra cotta/rust. Grounded, warm, like gathering around a fire.",
    accent: "#C67B5C",
    accentHover: "#B56A4B",
    buttonBg: "#C67B5C",
    buttonText: "#FFFFFF",
    pageBg: "#FEFAF8",
    cardBg: "#FFF7F3",
    textPrimary: "#3a2820",
    textMuted: "#8a7265",
    border: "#e8d5cb",
    sunGradient: { start: "#D4896A", end: "#B86548" },
    mood: "Hearth, home, comfortable gathering",
    pros: ["Very grounded", "Cozy feel", "Mature"],
    cons: ["Less bright/energetic", "Earthy over sunny"],
  },
  {
    id: "soft-peach",
    name: "Soft Peach",
    tagline: "Gentle and friendly",
    description: "A softer, peachy direction. Friendly without being intense.",
    accent: "#FFAB8C",
    accentHover: "#F59A78",
    buttonBg: "#FF9E7A",
    buttonText: "#3d2420",
    pageBg: "#FFFCFA",
    cardBg: "#FFF8F4",
    textPrimary: "#3d2c28",
    textMuted: "#8a756e",
    border: "#f5e0d8",
    sunGradient: { start: "#FFB898", end: "#FF9470" },
    mood: "Soft, approachable, gentle energy",
    pros: ["Very friendly", "Soft but present", "Modern"],
    cons: ["May feel too soft", "Less authority"],
  },
  {
    id: "deep-marigold",
    name: "Deep Marigold",
    tagline: "Vibrant yet grounded",
    description: "A deeper marigold/saffron. The warmth of gold with more depth.",
    accent: "#E8A020",
    accentHover: "#D49018",
    buttonBg: "#E8A020",
    buttonText: "#FFFFFF",
    pageBg: "#FEFBF5",
    cardBg: "#FFF8ED",
    textPrimary: "#2e2512",
    textMuted: "#7a6c4a",
    border: "#e8dcc4",
    sunGradient: { start: "#F4B030", end: "#DC9010" },
    mood: "Festival, celebration, gathered together",
    pros: ["Warm and rich", "Good contrast", "Festive"],
    cons: ["Bolder than current", "Stronger personality"],
  },
];

// Animation phases
type AnimationPhase = "rotating" | "fadeToKinmo" | "kinmo" | "fadeOut" | "fadeIn";

// Compact landing preview with full animation
function LandingPreview({ direction, isSelected }: { direction: ColorDirection; isSelected: boolean }) {
  const words = ["friends", "family", "crew", "people"];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState<AnimationPhase>("rotating");
  const [cycleCount, setCycleCount] = useState(0);

  // Create unique gradient ID
  const gradientId = `sun-${direction.id}`;

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
        }, 250);
      }, 1600);
    }

    return () => clearInterval(timer);
  }, [phase, words.length]);

  // Kinmo transition
  useEffect(() => {
    if (cycleCount > 0 && phase === "rotating") {
      setPhase("fadeToKinmo");
      const t1 = setTimeout(() => setPhase("kinmo"), 400);
      const t2 = setTimeout(() => setPhase("fadeOut"), 2200);
      const t3 = setTimeout(() => {
        setPhase("fadeIn");
        setCurrentIndex(0);
      }, 2600);
      const t4 = setTimeout(() => {
        setPhase("rotating");
        setCycleCount(0);
      }, 3000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [cycleCount, phase]);

  const getSunFill = () => {
    if (direction.sunGradient) {
      return `url(#${gradientId})`;
    }
    return direction.accent;
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-300 ${
        isSelected ? "ring-4 ring-blue-500 ring-offset-2 scale-[1.02]" : "hover:scale-[1.01]"
      }`}
      style={{ backgroundColor: direction.pageBg }}
    >
      {/* Mini header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${direction.border}` }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
            {direction.sunGradient && (
              <defs>
                <linearGradient id={`header-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={direction.sunGradient.start} />
                  <stop offset="100%" stopColor={direction.sunGradient.end} />
                </linearGradient>
              </defs>
            )}
            <circle cx="24" cy="24" r="20" fill={direction.sunGradient ? `url(#header-${gradientId})` : direction.accent} />
          </svg>
          <span className="font-semibold text-sm" style={{ color: direction.textPrimary }}>Kinmo</span>
        </div>
        <span className="text-xs px-2 py-1 rounded" style={{ color: direction.textMuted }}>Sign In</span>
      </div>

      {/* Hero section */}
      <div className="px-6 py-8 text-center">
        {/* Sun */}
        <svg width="56" height="56" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 animate-slow-spin">
          {direction.sunGradient && (
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={direction.sunGradient.start} />
                <stop offset="100%" stopColor={direction.sunGradient.end} />
              </linearGradient>
            </defs>
          )}
          <circle cx="24" cy="24" r="14" fill={getSunFill()} />
          <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={getSunFill()} />
          <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={getSunFill()} />
          <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={getSunFill()} />
          <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={getSunFill()} />
          <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={getSunFill()} />
          <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={getSunFill()} />
        </svg>

        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: direction.textMuted }}>
          Using AI to help you
        </p>

        {/* Animated headline */}
        <div className="h-12 flex items-center justify-center mb-4">
          <p className="text-lg font-bold" style={{ color: direction.textPrimary }}>
            {phase === "kinmo" ? (
              <span style={{ color: direction.accent }}>Kinmo</span>
            ) : phase === "fadeToKinmo" || phase === "fadeOut" ? (
              <span className="opacity-50" style={{ color: direction.accent }}>
                {phase === "fadeToKinmo" ? "kin" : "Kinmo"}
              </span>
            ) : (
              <>
                See your{" "}
                <span
                  className={`inline-block transition-opacity duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}
                  style={{ color: direction.accent }}
                >
                  {words[currentIndex]}
                </span>{" "}
                more.
              </>
            )}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-center">
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: direction.buttonBg,
              color: direction.buttonText
            }}
          >
            Get Started →
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{
              border: `1px solid ${direction.border}`,
              color: direction.textMuted,
              backgroundColor: 'transparent'
            }}
          >
            Learn More
          </button>
        </div>
      </div>

      {/* Sample content section */}
      <div
        className="px-6 py-4"
        style={{ backgroundColor: direction.cardBg }}
      >
        <p className="text-xs font-medium mb-2" style={{ color: direction.textPrimary }}>
          Life gets busy. We get it.
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: direction.textMuted }}>
          Between work, family, and everything else — staying connected takes effort.
        </p>
      </div>
    </div>
  );
}

export default function PrototypeKinmoText() {
  const [selectedId, setSelectedId] = useState<string>("current");

  const selectedDirection = colorDirections.find(d => d.id === selectedId)!;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
              ← Back to Landing
            </Button>
          </Link>
          <div className="text-slate-500 text-sm font-medium">
            Landing Page Color Explorer
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="py-10 px-4 border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Color Direction Exploration</h1>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Let's step back and look at fundamentally different directions for Kinmo's landing page.
            Each option maintains the warm, human-connection feel but approaches it differently.
            <strong className="text-slate-800"> Click any preview to select it and see details below.</strong>
          </p>
        </div>
      </section>

      {/* Color Options Grid */}
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {colorDirections.map((direction) => (
              <button
                key={direction.id}
                onClick={() => setSelectedId(direction.id)}
                className="text-left focus:outline-none"
              >
                {/* Label */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{direction.name}</span>
                  {selectedId === direction.id && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                  {direction.id === "current" && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Current</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">{direction.tagline}</p>

                {/* Preview */}
                <LandingPreview direction={direction} isSelected={selectedId === direction.id} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Selected Direction Details */}
      <section className="py-10 px-4 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-xl shadow-inner"
                  style={{ backgroundColor: selectedDirection.accent }}
                />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedDirection.name}</h2>
                  <p className="text-sm text-slate-500">{selectedDirection.tagline}</p>
                </div>
              </div>

              <p className="text-slate-600 mb-6 leading-relaxed">
                {selectedDirection.description}
              </p>

              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-700 mb-2">Mood</p>
                <p className="text-slate-600 italic">"{selectedDirection.mood}"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-green-700 mb-2">Pros</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {selectedDirection.pros.map((pro, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-2">Considerations</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {selectedDirection.cons.map((con, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Color Palette</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10"
                    style={{ backgroundColor: selectedDirection.accent }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Accent</p>
                    <code className="text-xs text-slate-500">{selectedDirection.accent}</code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10"
                    style={{ backgroundColor: selectedDirection.buttonBg }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Button</p>
                    <code className="text-xs text-slate-500">{selectedDirection.buttonBg}</code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10"
                    style={{ backgroundColor: selectedDirection.pageBg }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Page Background</p>
                    <code className="text-xs text-slate-500">{selectedDirection.pageBg}</code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10"
                    style={{ backgroundColor: selectedDirection.cardBg }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Card Background</p>
                    <code className="text-xs text-slate-500">{selectedDirection.cardBg}</code>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10 flex items-center justify-center"
                    style={{ backgroundColor: selectedDirection.pageBg }}
                  >
                    <span className="font-bold" style={{ color: selectedDirection.textPrimary }}>Aa</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Text Primary</p>
                    <code className="text-xs text-slate-500">{selectedDirection.textPrimary}</code>
                  </div>
                </div>

                {selectedDirection.sunGradient && (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border border-black/10"
                      style={{ background: `linear-gradient(135deg, ${selectedDirection.sunGradient.start} 0%, ${selectedDirection.sunGradient.end} 100%)` }}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Sun Gradient</p>
                      <code className="text-xs text-slate-500">
                        {selectedDirection.sunGradient.start} → {selectedDirection.sunGradient.end}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Comparison - Just the accents */}
      <section className="py-10 px-4 border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-6 text-center">
            Quick Accent Comparison
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {colorDirections.map((direction) => (
              <button
                key={direction.id}
                onClick={() => setSelectedId(direction.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                  selectedId === direction.id
                    ? "bg-slate-100 ring-2 ring-blue-500"
                    : "hover:bg-slate-50"
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full shadow-md"
                  style={{ backgroundColor: direction.accent }}
                />
                <span className="text-xs font-medium text-slate-600">{direction.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Thinking Prompts */}
      <section className="py-10 px-4 bg-slate-800 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-4">Questions to Consider</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Brand Feel:</strong> Does Kinmo feel like sunshine and energy (#FFB800),
                or calm and approachable (#F2C94C), or something else entirely?
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Readability:</strong> Which accent color is easiest to read
                against the white background in the rotating text?
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Button Presence:</strong> Does the CTA button feel inviting
                without being overwhelming? Too bright? Too muted?
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Gut Check:</strong> Which palette makes you feel like
                you want to gather with friends/family?
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
