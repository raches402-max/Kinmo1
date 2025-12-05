import { Link } from "wouter";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Styling options for the Kinmo text
const kinmoOptions = [
  {
    id: "current",
    name: "Current",
    description: "font-medium, text-primary",
    className: "text-[#F2C94C] font-medium",
    style: {},
  },
  {
    id: "bold",
    name: "Bold Weight",
    description: "font-bold instead of font-medium",
    className: "text-[#F2C94C] font-bold",
    style: {},
  },
  {
    id: "extrabold",
    name: "Extra Bold",
    description: "font-extrabold for maximum weight",
    className: "text-[#F2C94C] font-extrabold",
    style: {},
  },
  {
    id: "richer-gold",
    name: "Richer Gold",
    description: "Deeper amber: #E5A91A (lower lightness)",
    className: "font-bold",
    style: { color: "#E5A91A" },
  },
  {
    id: "saturated-gold",
    name: "Saturated Gold",
    description: "High saturation: #FFB800",
    className: "font-bold",
    style: { color: "#FFB800" },
  },
  {
    id: "warm-orange",
    name: "Warm Orange-Gold",
    description: "Warmer tone: #F5A623",
    className: "font-bold",
    style: { color: "#F5A623" },
  },
  {
    id: "text-shadow",
    name: "Text Shadow",
    description: "Bold + subtle dark shadow for depth",
    className: "font-bold",
    style: {
      color: "#F2C94C",
      textShadow: "0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.15)"
    },
  },
  {
    id: "glow",
    name: "Glow Effect",
    description: "Bold + golden glow behind text",
    className: "font-bold",
    style: {
      color: "#E5A91A",
      textShadow: "0 0 20px rgba(229, 169, 26, 0.4), 0 0 40px rgba(229, 169, 26, 0.2)"
    },
  },
  {
    id: "glow-saturated",
    name: "Saturated + Glow",
    description: "Bright gold with matching glow",
    className: "font-bold",
    style: {
      color: "#FFB800",
      textShadow: "0 0 24px rgba(255, 184, 0, 0.4), 0 0 48px rgba(255, 184, 0, 0.2)"
    },
  },
  {
    id: "outline-dark",
    name: "Dark Outline",
    description: "Bold + subtle dark text stroke",
    className: "font-bold kinmo-outline-dark",
    style: { color: "#F2C94C" },
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
];

export default function PrototypeKinmoText() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Custom styles for special effects */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .kinmo-outline-dark {
          -webkit-text-stroke: 1px rgba(0, 0, 0, 0.25);
          paint-order: stroke fill;
        }

        .kinmo-gradient-gold {
          background: linear-gradient(135deg, #FFE066 0%, #F2C94C 40%, #D4A017 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .kinmo-gradient-sunset {
          background: linear-gradient(135deg, #FFD93D 0%, #F5A623 50%, #E88B00 100%);
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
          box-shadow: 0 0 0 2px #E5A91A, 0 8px 32px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-black/5">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Landing
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Sparkles className="w-4 h-4 text-[#E5A91A]" />
            <span>Kinmo Text Preview</span>
          </div>
        </div>
      </header>

      {/* Hero section showing selected option large */}
      <section className="py-16 px-4 border-b border-black/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-8">Preview at Full Size</p>
          <div className="min-h-[120px] flex items-center justify-center">
            {selected ? (
              <h1
                className={`text-6xl sm:text-7xl md:text-8xl font-['Plus_Jakarta_Sans'] ${kinmoOptions.find(o => o.id === selected)?.className}`}
                style={kinmoOptions.find(o => o.id === selected)?.style}
              >
                Kinmo
              </h1>
            ) : (
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-['Plus_Jakarta_Sans'] text-[#F2C94C] font-medium">
                Kinmo
                <span className="block text-lg text-gray-400 font-normal mt-4">Click an option below to preview</span>
              </h1>
            )}
          </div>
          {selected && (
            <p className="text-gray-500 mt-6">
              {kinmoOptions.find(o => o.id === selected)?.name}: {kinmoOptions.find(o => o.id === selected)?.description}
            </p>
          )}
        </div>
      </section>

      {/* Options Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-gray-400 text-sm uppercase tracking-widest mb-8 text-center">Select a Style Option</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kinmoOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`option-card relative p-6 rounded-xl bg-white border border-black/10 text-left group ${
                  selected === option.id ? 'selected' : ''
                }`}
              >
                {/* Selection indicator */}
                {selected === option.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E5A91A] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
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
                <div className="border-t border-black/5 pt-3">
                  <h3 className="text-gray-800 font-medium text-sm">{option.name}</h3>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* In-context preview */}
      <section className="py-12 px-4 border-t border-black/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-gray-400 text-sm uppercase tracking-widest mb-8 text-center">In Animation Context</h2>

          <div className="rounded-2xl bg-white p-8 md:p-12 border border-black/5 shadow-sm">
            <div className="text-center space-y-6">
              {/* Simulated "See your kin more" faded state */}
              <p className="text-3xl md:text-4xl font-['Plus_Jakarta_Sans'] text-gray-300">
                See your <span className="text-gray-400">kin</span> more.
              </p>

              {/* Arrow */}
              <div className="text-gray-300 text-2xl">↓</div>

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
                  <span className="text-4xl md:text-5xl font-['Plus_Jakarta_Sans'] text-[#F2C94C] font-medium">
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
        <section className="sticky bottom-0 py-4 px-4 bg-white/95 backdrop-blur-sm border-t border-black/5">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-gray-800 font-medium">{kinmoOptions.find(o => o.id === selected)?.name}</p>
              <p className="text-gray-500 text-sm">{kinmoOptions.find(o => o.id === selected)?.description}</p>
            </div>
            <Button
              onClick={() => setSelected(null)}
              variant="ghost"
              className="text-gray-500 hover:text-gray-800"
            >
              Clear
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
