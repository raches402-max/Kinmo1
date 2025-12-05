import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
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
  verdict: "recommended" | "subtle" | "bold" | "experimental";
  notes: string;
}

const gradientOptions: GradientOption[] = [
  {
    id: "subtle-horizontal",
    name: "Subtle Horizontal",
    description: "Muted → Bright (left to right)",
    gradient: "linear-gradient(90deg, #F2C94C 0%, #FFB800 100%)",
    verdict: "recommended",
    notes: "Clean and modern. The eye naturally follows left-to-right, ending on the brighter, more energetic tone.",
  },
  {
    id: "subtle-horizontal-reverse",
    name: "Subtle Horizontal (Reverse)",
    description: "Bright → Muted (left to right)",
    gradient: "linear-gradient(90deg, #FFB800 0%, #F2C94C 100%)",
    verdict: "subtle",
    notes: "Starts bright near the text, fades to softer. Good if you want the button to feel grounded.",
  },
  {
    id: "diagonal-warm",
    name: "Diagonal Warm",
    description: "Top-left to bottom-right sweep",
    gradient: "linear-gradient(135deg, #F2C94C 0%, #FFB800 100%)",
    verdict: "recommended",
    notes: "Diagonal adds dynamism without being flashy. Feels like natural light catching the surface.",
  },
  {
    id: "diagonal-reverse",
    name: "Diagonal (Reverse)",
    description: "Bottom-left to top-right",
    gradient: "linear-gradient(45deg, #F2C94C 0%, #FFB800 100%)",
    verdict: "subtle",
    notes: "Upward diagonal can feel uplifting. Subtle energy lift.",
  },
  {
    id: "very-subtle",
    name: "Ultra Subtle",
    description: "Almost imperceptible shift",
    gradient: "linear-gradient(90deg, #F4C74C 0%, #F8BE30 100%)",
    verdict: "subtle",
    notes: "If you want the gradient to be felt more than seen. Extremely refined.",
  },
  {
    id: "center-glow",
    name: "Center Glow",
    description: "Bright center, muted edges",
    gradient: "linear-gradient(90deg, #F2C94C 0%, #FFB800 50%, #F2C94C 100%)",
    verdict: "bold",
    notes: "Creates a subtle 'glow' or highlight in the center. More noticeable but can feel premium.",
  },
  {
    id: "soft-shine",
    name: "Soft Shine",
    description: "Diagonal with soft highlight",
    gradient: "linear-gradient(135deg, #F2C94C 0%, #FFBE00 40%, #FFB800 100%)",
    verdict: "recommended",
    notes: "Three-stop gradient creates depth like light reflecting off metal. Sophisticated.",
  },
  {
    id: "warm-to-golden",
    name: "Warm to Golden",
    description: "Using the graduated warmth colors",
    gradient: "linear-gradient(90deg, #E5A800 0%, #F0B000 50%, #FFBA00 100%)",
    verdict: "experimental",
    notes: "Uses your graduated warmth palette in a single button. Rich and cohesive.",
  },
  {
    id: "vertical-subtle",
    name: "Vertical Subtle",
    description: "Top to bottom, muted → bright",
    gradient: "linear-gradient(180deg, #F2C94C 0%, #FFB800 100%)",
    verdict: "subtle",
    notes: "Vertical gradients can feel like the button has depth/dimension. Classic approach.",
  },
  {
    id: "vertical-highlight",
    name: "Vertical Highlight",
    description: "Bright top edge, muted body",
    gradient: "linear-gradient(180deg, #FFB800 0%, #F2C94C 30%, #F2C94C 100%)",
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

function MiniPreview({ gradient, heroColor = "#FFB800" }: { gradient: string; heroColor?: string }) {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      {/* Mini header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
        <KinmoIcon size={14} color={heroColor} />
        <span className="font-medium text-xs">Kinmo</span>
      </div>

      {/* Mini hero */}
      <div className="px-3 py-4 text-center">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="mx-auto mb-2">
          <circle cx="24" cy="24" r="14" fill={heroColor} />
          <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={heroColor} />
          <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={heroColor} />
          <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={heroColor} />
          <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={heroColor} />
          <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={heroColor} />
          <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={heroColor} />
        </svg>
        <p className="text-[10px] font-bold mb-2">
          See your <span style={{ color: heroColor }}>friends</span> more.
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

export default function PrototypeKinmoText() {
  const [selected, setSelected] = useState<string>("soft-shine");
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
              <MiniPreview gradient={selectedOption.gradient} heroColor="#FFB800" />

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
          <h2 className="text-xl font-bold mb-4">My Take</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-left">
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>No, it won't look corny</strong> — as long as you keep it subtle. My top picks:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="w-12 h-6 rounded" style={{ background: "linear-gradient(135deg, #F2C94C 0%, #FFBE00 40%, #FFB800 100%)" }} />
                <div>
                  <p className="font-medium text-sm">Soft Shine (Diagonal)</p>
                  <p className="text-xs text-gray-600">Three-stop gradient creates elegant depth. Feels like light reflecting off the surface.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-12 h-6 rounded" style={{ background: "linear-gradient(135deg, #F2C94C 0%, #FFB800 100%)" }} />
                <div>
                  <p className="font-medium text-sm">Diagonal Warm</p>
                  <p className="text-xs text-gray-600">Simple two-tone diagonal. Clean, modern, and ties both colors together naturally.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="w-12 h-6 rounded" style={{ background: "linear-gradient(90deg, #F4C74C 0%, #F8BE30 100%)" }} />
                <div>
                  <p className="font-medium text-sm">Ultra Subtle</p>
                  <p className="text-xs text-gray-600">If you want maximum refinement. The gradient is felt more than seen — very classy.</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              The gradient bridges your two golds elegantly. Combined with the bright #FFB800 sun and hero text,
              you get visual hierarchy without clash.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
