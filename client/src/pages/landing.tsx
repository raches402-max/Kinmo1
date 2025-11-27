// Kinmo Landing Page - Clean and human
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";
import { useState, useEffect } from "react";

// Niche words organized by specificity - will be sprinkled in
const nicheWords = {
  casual: ["crew", "squad", "besties", "roommates", "neighbors"],
  activity: ["book club", "gym buddies", "hiking crew", "trivia team", "brunch bunch", "wine club"],
  sports: ["Sunday football fam", "running buddies", "yoga friends", "volleyball crew", "fantasy league", "climbing partners"],
  lifeStage: ["parent friends", "mom friends", "dad group", "couple friends", "old college crew", "childhood friends", "new city friends"],
  ultraNiche: ["Costco run crew", "dog park friends", "coffee shop crew", "pickleball posse", "karaoke crew", "D&D party", "poker night"],
  insideJokes: ["frands", "b-school crew", "ravefrands", "girlfrands", "ladles", "faves", "usual boys"],
};

// Generate a mixed rotation: arc from generic → niche → back to generic
// Pattern: friends → family → niche → partner → niche → niche → niche → people → [kin]
function generateRotation(rotationIndex: number): string[] {
  const allNiche = [
    ...nicheWords.casual,
    ...nicheWords.activity,
    ...nicheWords.sports,
    ...nicheWords.lifeStage,
    ...nicheWords.ultraNiche,
    ...nicheWords.insideJokes,
  ];

  // Offset into niche words based on rotation to get variety
  const nicheOffset = (rotationIndex * 4) % allNiche.length;

  // Every 5th rotation, swap "friends" for "frands" as an easter egg
  const startsWithFrands = rotationIndex % 5 === 3;

  // Arc structure: generic start → climb into niche → anchor → niche peak → descend → people
  // Every rotation ends with "people" which leads to kin → Kinmo
  return [
    startsWithFrands ? "frands" : "friends",       // generic start (or easter egg)
    "family",                                       // generic
    allNiche[(nicheOffset + 0) % allNiche.length], // climb into niche
    "partner",                                      // anchor mid-way
    allNiche[(nicheOffset + 1) % allNiche.length], // niche peak
    allNiche[(nicheOffset + 2) % allNiche.length], // still niche
    allNiche[(nicheOffset + 3) % allNiche.length], // descending
    "people",                                       // land on generic → leads to kin
  ];
}

function RotatingHeadline() {
  const [rotationIndex, setRotationIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState<"rotating" | "resting" | "kin" | "kinmo">("rotating");

  const [currentWords, setCurrentWords] = useState(() => generateRotation(0));

  // Base rotation speed
  const baseInterval = 1800;
  const restDuration = 2000; // Pause between rotations

  // Slow down as we approach the end (arc deceleration)
  const getIntervalForIndex = (index: number) => {
    const totalWords = currentWords.length;
    const remaining = totalWords - index - 1;
    if (remaining <= 0) return baseInterval + 600; // "people" - slowest
    if (remaining === 1) return baseInterval + 400; // second to last
    if (remaining === 2) return baseInterval + 200; // third to last
    return baseInterval;
  };

  useEffect(() => {
    if (phase !== "rotating") return;

    const currentInterval = getIntervalForIndex(currentIndex);

    const timeout = setTimeout(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          if (prev === currentWords.length - 1) {
            // End of this rotation - go straight to kin (don't show "people" again)
            setPhase("resting");
            return prev;
          }
          setIsAnimating(false);
          return prev + 1;
        });
      }, 300);
    }, currentInterval);

    return () => clearTimeout(timeout);
  }, [phase, currentIndex, currentWords.length]);

  // After words end, go to kin phase
  useEffect(() => {
    if (phase !== "resting") return;

    const timeout = setTimeout(() => {
      setPhase("kin");
    }, 500); // brief pause before kin

    return () => clearTimeout(timeout);
  }, [phase]);

  // kin → kinmo
  useEffect(() => {
    if (phase !== "kin") return;
    const timeout = setTimeout(() => setPhase("kinmo"), 2500);
    return () => clearTimeout(timeout);
  }, [phase]);

  // kinmo → start new rotation
  useEffect(() => {
    if (phase !== "kinmo") return;

    const timeout = setTimeout(() => {
      const nextRotation = rotationIndex + 1;
      setRotationIndex(nextRotation);
      setCurrentWords(generateRotation(nextRotation));
      setCurrentIndex(0);
      setPhase("rotating");
    }, restDuration);

    return () => clearTimeout(timeout);
  }, [phase, rotationIndex]);

  if (phase === "kinmo") {
    return (
      <span className="animate-hero-finale-glow">
        <span className="text-primary font-medium">Kinmo</span>
      </span>
    );
  }

  if (phase === "kin") {
    return (
      <span className="whitespace-nowrap animate-kin-reveal">
        See your <span className="text-primary font-medium">kin</span> more.
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap">
      See your{" "}
      <span
        className={`inline-block transition-all duration-300 text-primary font-medium ${
          isAnimating ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
        }`}
      >
        {currentWords[currentIndex]}
      </span>{" "}
      more.
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KinmoIcon size={26} color="hsl(var(--primary))" />
            <span className="font-semibold text-lg">Kinmo</span>
          </div>
          <Button
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
            variant="ghost"
            size="sm"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-6">
            <svg
              width="72"
              height="72"
              viewBox="0 0 48 48"
              fill="none"
              className="mx-auto animate-slow-spin"
              aria-hidden="true"
            >
              <circle cx="24" cy="24" r="14" className="fill-primary" />
              <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" className="fill-primary" />
              <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" className="fill-primary" />
              <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" className="fill-primary" />
              <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" className="fill-primary" />
              <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" className="fill-primary" />
              <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" className="fill-primary" />
            </svg>
          </div>

          <p className="text-sm tracking-wide uppercase text-muted-foreground mb-3">Using AI to help you</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-12 leading-[1.1]">
            <RotatingHeadline />
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = "/api/login"}
              className="px-10 h-12 text-base font-semibold"
              data-testid="button-get-started"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 text-base"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section id="how-it-works" className="py-24 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-5">
            The little things that let relationships drift apart
          </h2>
          <p className="text-center text-muted-foreground mb-14 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Small frictions pile up until reaching out feels like a whole thing. A little lost momentum can be crippling — even for the closest of relationships.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-3">The slow fade</h3>
              <p className="text-muted-foreground leading-relaxed">
                Messages get buried. Everyone means to follow up, but few actually do.
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-3">The planning load</h3>
              <p className="text-muted-foreground leading-relaxed">
                It can keep falling on the same shoulders who might get tired.
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-3">The unspoken stuff</h3>
              <p className="text-muted-foreground leading-relaxed">
                Too pricey. Too often. Not often enough. The things that sometimes aren't said.
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-3">The reschedule spiral</h3>
              <p className="text-muted-foreground leading-relaxed">
                Three weeks can become four. Then six. Then "we should really catch up soon."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Kinmo's AI Works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-5">
            How it works
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Kinmo learns the rhythm of your friendships.
          </p>

          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            <div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-lg font-semibold mb-4">1</div>
              <h3 className="font-semibold text-lg mb-3">Learns what you love</h3>
              <p className="text-muted-foreground leading-relaxed">
                Swipe on places, share what you liked. Our tool learns your group's preferences.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-lg font-semibold mb-4">2</div>
              <h3 className="font-semibold text-lg mb-3">Finds when you're free</h3>
              <p className="text-muted-foreground leading-relaxed">
                Everyone shares when they're free. It finds times that work.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-lg font-semibold mb-4">3</div>
              <h3 className="font-semibold text-lg mb-3">Picks up on the vibes</h3>
              <p className="text-muted-foreground leading-relaxed">
                Too pricey? Too far? Too often? It picks up on the subtle stuff people might not say out loud.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Kinmo */}
      <section className="py-24 sm:py-32 px-6 bg-muted/30 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-20">
            Why Kinmo?
          </h2>

          <div className="relative">
            {/* Staggered benefits - editorial style */}
            <div className="space-y-8 sm:space-y-10">
              <div className="flex justify-start sm:pl-4">
                <p className="text-muted-foreground text-base sm:text-lg tracking-wide">
                  Reduce the weight of planning
                </p>
              </div>

              <div className="flex justify-start sm:pl-16">
                <p className="text-muted-foreground text-base sm:text-lg tracking-wide">
                  Increase the number of planners
                </p>
              </div>

              <div className="flex justify-center">
                <p className="text-muted-foreground/90 text-base sm:text-lg tracking-wide">
                  Share feedback that loops into future events
                </p>
              </div>

              <div className="flex justify-end sm:pr-16">
                <p className="text-foreground/70 text-base sm:text-lg tracking-wide">
                  Improve the quality of your events
                </p>
              </div>
            </div>

            {/* The payoff - isolated, prominent */}
            <div className="mt-16 sm:mt-20 text-center">
              <p className="text-foreground text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                See your people more
              </p>
              <div className="mt-4 mx-auto w-12 h-1 bg-primary/60 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-5 leading-snug">
            Is there anyone you want to see more?
          </h2>
          <p className="text-muted-foreground mb-10 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            Free to start. See how it feels. No commitment.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            className="px-10 h-12 text-base font-semibold"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <KinmoIcon size={18} color="currentColor" />
            <span className="text-sm">© {new Date().getFullYear()} Kinmo</span>
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
