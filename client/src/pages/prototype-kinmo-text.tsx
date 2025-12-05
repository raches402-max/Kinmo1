import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sun, Sparkles } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

/*
 * Color Strategy Exploration
 *
 * Problem: User likes brighter #FFB800 for sun/hero text, but:
 * - Full #FFB800 on buttons feels too intense
 * - Current #F2C94C and #FFB800 don't harmonize well
 *
 * Goal: Brighter feel without changing the calm, friendly app vibe
 */

interface ColorStrategy {
  id: string;
  name: string;
  description: string;
  philosophy: string;
  hero: string;      // Sun, rotating text, "Kinmo" reveal
  buttons: string;   // Primary button background
  buttonText: string;
  accents: string;   // Badges, decorative elements
  buttonStyle: "filled" | "outline" | "soft";
}

const strategies: ColorStrategy[] = [
  {
    id: "current-mix",
    name: "Current (Mixed)",
    description: "Bright hero #FFB800 + original buttons #F2C94C",
    philosophy: "Shows the clash you're feeling - two yellows fighting",
    hero: "#FFB800",
    buttons: "#F2C94C",
    buttonText: "#000",
    accents: "#F2C94C",
    buttonStyle: "filled",
  },
  {
    id: "unified-warm",
    name: "Unified Warm Gold",
    description: "Single harmonious gold #F5B000 everywhere",
    philosophy: "One color, no clash. Warmer than original, calmer than bright.",
    hero: "#F5B000",
    buttons: "#F5B000",
    buttonText: "#000",
    accents: "#F5B000",
    buttonStyle: "filled",
  },
  {
    id: "hero-pop",
    name: "Hero Pop Strategy",
    description: "Bright #FFB800 for hero only, soft #F2C94C for UI",
    philosophy: "Intentional hierarchy: hero elements demand attention, buttons stay calm and inviting.",
    hero: "#FFB800",
    buttons: "#F2C94C",
    buttonText: "#000",
    accents: "#F2C94C",
    buttonStyle: "soft",
  },
  {
    id: "outline-bright",
    name: "Bright but Light Touch",
    description: "Use #FFB800 everywhere but with outline buttons",
    philosophy: "The bright gold appears but doesn't overwhelm. Buttons feel lighter, less 'loud'.",
    hero: "#FFB800",
    buttons: "#FFB800",
    buttonText: "#FFB800",
    accents: "#FFB800",
    buttonStyle: "outline",
  },
  {
    id: "amber-system",
    name: "Amber Harmony",
    description: "Deeper amber #E9A800 unifies everything",
    philosophy: "Rich, warm, sophisticated. Less 'sunny', more 'golden hour'.",
    hero: "#E9A800",
    buttons: "#E9A800",
    buttonText: "#000",
    accents: "#E9A800",
    buttonStyle: "filled",
  },
  {
    id: "graduated",
    name: "Graduated Warmth",
    description: "Hero #FFBA00, buttons #F0B000, accents #E5A800",
    philosophy: "Subtle gradation creates depth. Same family, different intensities.",
    hero: "#FFBA00",
    buttons: "#F0B000",
    buttonText: "#000",
    accents: "#E5A800",
    buttonStyle: "filled",
  },
];

function MiniLandingPreview({ strategy }: { strategy: ColorStrategy }) {
  const buttonClasses = strategy.buttonStyle === "outline"
    ? "border-2 bg-transparent hover:bg-opacity-10"
    : strategy.buttonStyle === "soft"
    ? "bg-opacity-90 hover:bg-opacity-100"
    : "";

  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden">
      {/* Mini header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KinmoIcon size={18} color={strategy.hero} />
          <span className="font-medium text-sm">Kinmo</span>
        </div>
        <span className="text-xs text-muted-foreground">Sign In</span>
      </div>

      {/* Mini hero */}
      <div className="px-4 py-6 text-center">
        {/* Sun */}
        <div className="mb-3">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" className="mx-auto">
            <circle cx="24" cy="24" r="14" fill={strategy.hero} />
            <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={strategy.hero} />
            <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={strategy.hero} />
            <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={strategy.hero} />
            <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={strategy.hero} />
            <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={strategy.hero} />
            <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={strategy.hero} />
          </svg>
        </div>

        {/* Headline */}
        <p className="text-[10px] uppercase text-muted-foreground mb-1">Using AI to help you</p>
        <p className="text-sm font-bold mb-1">
          See your <span style={{ color: strategy.hero }}>friends</span> more.
        </p>

        {/* Buttons */}
        <div className="flex gap-2 justify-center mt-3">
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${buttonClasses}`}
            style={{
              backgroundColor: strategy.buttonStyle === "outline" ? "transparent" : strategy.buttons,
              color: strategy.buttonText,
              borderColor: strategy.buttonStyle === "outline" ? strategy.buttons : "transparent",
            }}
          >
            Get Started
          </button>
          <button className="px-3 py-1.5 rounded-md text-xs border border-border text-muted-foreground">
            Learn More
          </button>
        </div>
      </div>

      {/* Mini "How it works" section */}
      <div className="px-4 py-4 bg-muted/30 border-t border-border/50">
        <div className="flex justify-center gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                backgroundColor: `${strategy.accents}15`,
                color: strategy.accents,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PrototypeKinmoText() {
  const [selected, setSelected] = useState<string>("hero-pop");

  const selectedStrategy = strategies.find(s => s.id === selected)!;

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
            <span>Color Strategy Explorer</span>
          </div>
        </div>
      </header>

      {/* Problem Statement */}
      <section className="py-8 px-4 border-b border-black/5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-center mb-3">Finding the Right Gold</h1>
          <p className="text-center text-gray-600 max-w-2xl mx-auto">
            You want the sun and hero text to <span className="font-medium">pop with energy</span>,
            but the buttons shouldn't <span className="font-medium">overwhelm the calm, friendly vibe</span>.
            Here are strategies to achieve both.
          </p>
        </div>
      </section>

      {/* Strategy Grid */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-6 text-center">
            Select a Strategy
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategies.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelected(strategy.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selected === strategy.id
                    ? "border-amber-400 bg-amber-50/50 shadow-lg shadow-amber-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {/* Color swatches */}
                <div className="flex gap-1.5 mb-3">
                  <div
                    className="w-8 h-8 rounded-full border border-black/10"
                    style={{ backgroundColor: strategy.hero }}
                    title="Hero color"
                  />
                  <div
                    className="w-8 h-8 rounded-full border border-black/10"
                    style={{ backgroundColor: strategy.buttons }}
                    title="Button color"
                  />
                  {strategy.buttonStyle === "outline" && (
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[8px]"
                      style={{ borderColor: strategy.buttons, color: strategy.buttons }}
                    >
                      outline
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{strategy.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{strategy.description}</p>

                {selected === strategy.id && (
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

      {/* Selected Strategy Detail */}
      <section className="py-8 px-4 bg-white border-y border-black/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Preview */}
            <div>
              <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Preview</h3>
              <MiniLandingPreview strategy={selectedStrategy} />
            </div>

            {/* Philosophy */}
            <div>
              <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Design Philosophy</h3>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <h4 className="font-semibold text-lg mb-2">{selectedStrategy.name}</h4>
                <p className="text-gray-600 leading-relaxed mb-4">{selectedStrategy.philosophy}</p>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Sun className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Hero elements:</span>
                    <div
                      className="w-5 h-5 rounded border border-black/10"
                      style={{ backgroundColor: selectedStrategy.hero }}
                    />
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{selectedStrategy.hero}</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Buttons:</span>
                    <div
                      className={`w-5 h-5 rounded border ${selectedStrategy.buttonStyle === "outline" ? "border-2 bg-transparent" : "border-black/10"}`}
                      style={{
                        backgroundColor: selectedStrategy.buttonStyle === "outline" ? "transparent" : selectedStrategy.buttons,
                        borderColor: selectedStrategy.buttonStyle === "outline" ? selectedStrategy.buttons : undefined
                      }}
                    />
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {selectedStrategy.buttons} {selectedStrategy.buttonStyle !== "filled" && `(${selectedStrategy.buttonStyle})`}
                    </code>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              {selectedStrategy.id === "hero-pop" && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>Recommended:</strong> This approach lets the sun and headline text shine bright
                    while keeping buttons approachable. The intentional contrast creates hierarchy without clash.
                  </p>
                </div>
              )}

              {selectedStrategy.id === "graduated" && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">
                    <strong>Sophisticated choice:</strong> Using related but distinct golds creates
                    visual depth. Hero pops, buttons invite, accents ground. Same family, clear roles.
                  </p>
                </div>
              )}

              {selectedStrategy.id === "outline-bright" && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-800">
                    <strong>Light touch:</strong> Outline buttons let you use the bright gold everywhere
                    without it feeling heavy. The color appears but doesn't fill the space.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* My Recommendation */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-4">My Recommendation</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-gray-600 leading-relaxed mb-4">
              Based on your feedback, I'd suggest the <strong>"Hero Pop Strategy"</strong> or <strong>"Graduated Warmth"</strong>:
            </p>
            <ul className="text-left text-gray-600 space-y-2 max-w-lg mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><strong>Sun & rotating text:</strong> Keep the bright #FFB800 — it grabs attention</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><strong>Buttons:</strong> Use the calmer #F2C94C or a middle-ground #F0B000</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><strong>Result:</strong> Hero elements pop, UI stays warm and inviting</span>
              </li>
            </ul>
            <p className="text-sm text-gray-500 mt-4">
              This maintains the "friendly planning app" vibe while giving the landing page more visual punch.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
