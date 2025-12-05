import { Link } from "wouter";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Styling options for the Kinmo text (baseline: #FFB800 font-bold)
const kinmoOptions = [
  {
    id: "current",
    name: "Current",
    description: "Saturated Gold #FFB800, font-bold",
    className: "font-bold",
    style: { color: "#FFB800" },
  },
  {
    id: "extrabold",
    name: "Extra Bold",
    description: "font-extrabold for maximum weight",
    className: "font-extrabold",
    style: { color: "#FFB800" },
  },
  {
    id: "text-shadow",
    name: "Text Shadow",
    description: "Current + subtle dark shadow for depth",
    className: "font-bold",
    style: {
      color: "#FFB800",
      textShadow: "0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.15)"
    },
  },
  {
    id: "glow",
    name: "Glow Effect",
    description: "Current + golden glow behind text",
    className: "font-bold",
    style: {
      color: "#FFB800",
      textShadow: "0 0 20px rgba(255, 184, 0, 0.4), 0 0 40px rgba(255, 184, 0, 0.2)"
    },
  },
  {
    id: "glow-strong",
    name: "Strong Glow",
    description: "Current + more intense glow effect",
    className: "font-bold",
    style: {
      color: "#FFB800",
      textShadow: "0 0 30px rgba(255, 184, 0, 0.6), 0 0 60px rgba(255, 184, 0, 0.3)"
    },
  },
  {
    id: "outline-dark",
    name: "Dark Outline",
    description: "Current + subtle dark text stroke",
    className: "font-bold kinmo-outline-dark",
    style: { color: "#FFB800" },
  },
  {
    id: "gradient-gold",
    name: "Gold Gradient",
    description: "Linear gradient from light to deep gold",
    className: "font-bold kinmo-gradient-gold",
    style: {},
  },
  {
    id: "gradient-sunset",
    name: "Sunset Gradient",
    description: "Gold to warm orange gradient",
    className: "font-bold kinmo-gradient-sunset",
    style: {},
  },
  {
    id: "warmer",
    name: "Warmer Tone",
    description: "Slightly warmer: #FFA500 (orange-gold)",
    className: "font-bold",
    style: { color: "#FFA500" },
  },
  {
    id: "deeper",
    name: "Deeper Gold",
    description: "Richer amber: #E5A500",
    className: "font-bold",
    style: { color: "#E5A500" },
  },
  {
    id: "old-primary",
    name: "Old Primary",
    description: "Previous pale gold #F2C94C (for comparison)",
    className: "font-bold",
    style: { color: "#F2C94C" },
  },
  {
    id: "old-medium",
    name: "Old Style",
    description: "Previous: #F2C94C + font-medium",
    className: "font-medium",
    style: { color: "#F2C94C" },
  },
];

export default function PrototypeKinmoText() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Custom styles for special effects */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .kinmo-outline-dark {
          -webkit-text-stroke: 1px rgba(0, 0, 0, 0.25);
          paint-order: stroke fill;
        }

        .kinmo-gradient-gold {
          background: linear-gradient(135deg, #FFD54F 0%, #FFB800 40%, #E5A000 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .kinmo-gradient-sunset {
          background: linear-gradient(135deg, #FFCA28 0%, #FFB800 35%, #FF9800 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .option-card {
          transition: all 0.2s ease;
        }

        .option-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }

        .option-card.selected {
          box-shadow: 0 0 0 2px hsl(var(--primary)), 0 8px 32px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Landing
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Kinmo Text Preview</span>
          </div>
        </div>
      </header>

      {/* Hero section showing selected option large */}
      <section className="py-16 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground text-sm uppercase tracking-widest mb-8">Preview at Full Size</p>
          <div className="min-h-[120px] flex items-center justify-center">
            {selected ? (
              <h1
                className={`text-6xl sm:text-7xl md:text-8xl font-['Plus_Jakarta_Sans'] ${kinmoOptions.find(o => o.id === selected)?.className}`}
                style={kinmoOptions.find(o => o.id === selected)?.style}
              >
                Kinmo
              </h1>
            ) : (
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-['Plus_Jakarta_Sans'] font-bold" style={{ color: '#FFB800' }}>
                Kinmo
                <span className="block text-lg text-muted-foreground font-normal mt-4">Click an option below to preview</span>
              </h1>
            )}
          </div>
          {selected && (
            <p className="text-muted-foreground mt-6">
              {kinmoOptions.find(o => o.id === selected)?.name}: {kinmoOptions.find(o => o.id === selected)?.description}
            </p>
          )}
        </div>
      </section>

      {/* Options Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-muted-foreground text-sm uppercase tracking-widest mb-8 text-center">Select a Style Option</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kinmoOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`option-card relative p-6 rounded-xl bg-card border border-border text-left group ${
                  selected === option.id ? 'selected' : ''
                }`}
              >
                {/* Selection indicator */}
                {selected === option.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                {/* Preview text */}
                <div className="h-16 flex items-center justify-center mb-4">
                  <span
                    className={`text-3xl font-['Plus_Jakarta_Sans'] ${option.className}`}
                    style={option.style}
                  >
                    Kinmo
                  </span>
                </div>

                {/* Label */}
                <div className="border-t border-border pt-3">
                  <h3 className="text-foreground font-medium text-sm">{option.name}</h3>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* In-context preview */}
      <section className="py-12 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-muted-foreground text-sm uppercase tracking-widest mb-8 text-center">In Animation Context</h2>

          <div className="rounded-2xl bg-card p-8 md:p-12 border border-border shadow-sm">
            <div className="text-center space-y-6">
              {/* Simulated "See your kin more" faded state */}
              <p className="text-3xl md:text-4xl font-['Plus_Jakarta_Sans'] text-muted-foreground/50">
                See your <span className="text-muted-foreground/70">kin</span> more.
              </p>

              {/* Arrow */}
              <div className="text-muted-foreground/50 text-2xl">↓</div>

              {/* Kinmo appears */}
              <div className="py-4">
                {selected ? (
                  <span
                    className={`text-4xl md:text-5xl font-['Plus_Jakarta_Sans'] ${kinmoOptions.find(o => o.id === selected)?.className}`}
                    style={kinmoOptions.find(o => o.id === selected)?.style}
                  >
                    Kinmo
                  </span>
                ) : (
                  <span className="text-4xl md:text-5xl font-['Plus_Jakarta_Sans'] font-bold" style={{ color: '#FFB800' }}>
                    Kinmo
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with selection summary */}
      {selected && (
        <section className="sticky bottom-0 py-4 px-4 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-foreground font-medium">{kinmoOptions.find(o => o.id === selected)?.name}</p>
              <p className="text-muted-foreground text-sm">{kinmoOptions.find(o => o.id === selected)?.description}</p>
            </div>
            <Button
              onClick={() => setSelected(null)}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
