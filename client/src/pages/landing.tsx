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

  // Arc structure: generic start → climb into niche → anchor → niche peak → descend → kin
  // Every rotation ends with "kin" which then fades to Kinmo
  return [
    startsWithFrands ? "frands" : "friends",       // generic start (or easter egg)
    "family",                                       // generic
    allNiche[(nicheOffset + 0) % allNiche.length], // climb into niche
    "partner",                                      // anchor mid-way
    allNiche[(nicheOffset + 1) % allNiche.length], // niche peak
    allNiche[(nicheOffset + 2) % allNiche.length], // still niche
    "people",                                       // descending
    "kin",                                          // final word → leads to Kinmo
  ];
}

function RotatingHeadline() {
  const [rotationIndex, setRotationIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState<"rotating" | "fadeToKinmo" | "kinmo" | "fadeOut" | "fadeIn">("rotating");

  const [currentWords, setCurrentWords] = useState(() => generateRotation(0));

  // Base rotation speed
  const baseInterval = 1800;

  // Slow down as we approach the end (arc deceleration)
  const getIntervalForIndex = (index: number) => {
    const totalWords = currentWords.length;
    const remaining = totalWords - index - 1;
    if (remaining <= 0) return baseInterval + 800; // "kin" - slowest, longer pause
    if (remaining === 1) return baseInterval + 400; // second to last
    if (remaining === 2) return baseInterval + 200; // third to last
    return baseInterval;
  };

  // Rotating phase - cycle through words
  useEffect(() => {
    if (phase !== "rotating") return;

    const currentInterval = getIntervalForIndex(currentIndex);
    const isLastWord = currentIndex === currentWords.length - 1;

    // If on last word ("kin"), just pause then go to fadeToKinmo (no animation cycle)
    if (isLastWord) {
      const timeout = setTimeout(() => {
        setPhase("fadeToKinmo");
      }, currentInterval + 1500); // Extra pause on "kin" before fading
      return () => clearTimeout(timeout);
    }

    // Normal word rotation with fade animation
    const timeout = setTimeout(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIsAnimating(false);
        setCurrentIndex((prev) => prev + 1);
      }, 300);
    }, currentInterval);

    return () => clearTimeout(timeout);
  }, [phase, currentIndex, currentWords.length]);

  // fadeToKinmo → kinmo (after fade animation completes)
  useEffect(() => {
    if (phase !== "fadeToKinmo") return;
    const timeout = setTimeout(() => setPhase("kinmo"), 600);
    return () => clearTimeout(timeout);
  }, [phase]);

  // kinmo → fadeOut
  useEffect(() => {
    if (phase !== "kinmo") return;
    const timeout = setTimeout(() => setPhase("fadeOut"), 2000);
    return () => clearTimeout(timeout);
  }, [phase]);

  // fadeOut → fadeIn (after fade animation completes)
  useEffect(() => {
    if (phase !== "fadeOut") return;
    const timeout = setTimeout(() => setPhase("fadeIn"), 600);
    return () => clearTimeout(timeout);
  }, [phase]);

  // fadeIn → rotating (restart cycle)
  useEffect(() => {
    if (phase !== "fadeIn") return;

    const timeout = setTimeout(() => {
      const nextRotation = rotationIndex + 1;
      setRotationIndex(nextRotation);
      setCurrentWords(generateRotation(nextRotation));
      setCurrentIndex(0);
      setPhase("rotating");
    }, 600);

    return () => clearTimeout(timeout);
  }, [phase, rotationIndex]);

  // fadeToKinmo phase - fade out entire phrase
  if (phase === "fadeToKinmo") {
    return (
      <span className="relative block w-[280px] sm:w-[340px] md:w-[420px] lg:w-[500px] h-[110px] sm:h-[140px] md:h-[170px] lg:h-[200px] animate-fade-out-phrase">
        <span className="absolute top-0 -left-8 sm:-left-12 md:-left-16 lg:-left-20 text-foreground">See your</span>
        <span className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary font-medium whitespace-nowrap">
          kin
        </span>
        <span className="absolute bottom-0 -right-6 sm:-right-8 md:-right-10 lg:-right-12 text-foreground">more.</span>
      </span>
    );
  }

  // Kinmo phase - centered, no surrounding text
  if (phase === "kinmo") {
    return (
      <span className="text-primary font-medium animate-kinmo-appear">
        Kinmo
      </span>
    );
  }

  // fadeOut phase - fade out Kinmo
  if (phase === "fadeOut") {
    return (
      <span className="text-primary font-medium animate-fade-out-phrase">
        Kinmo
      </span>
    );
  }

  // fadeIn phase - fade in the full phrase to restart
  if (phase === "fadeIn") {
    return (
      <span className="relative block w-[280px] sm:w-[340px] md:w-[420px] lg:w-[500px] h-[110px] sm:h-[140px] md:h-[170px] lg:h-[200px] animate-fade-in-phrase">
        <span className="absolute top-0 -left-8 sm:-left-12 md:-left-16 lg:-left-20 text-foreground">See your</span>
        <span className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary font-medium whitespace-nowrap">
          {currentWords[0]}
        </span>
        <span className="absolute bottom-0 -right-6 sm:-right-8 md:-right-10 lg:-right-12 text-foreground">more.</span>
      </span>
    );
  }

  // Rotating phase - fixed diagonal layout with absolute positioning
  // "See your" top-left, rotating word centered, "more." bottom-right
  return (
    <span className="relative block w-[280px] sm:w-[340px] md:w-[420px] lg:w-[500px] h-[110px] sm:h-[140px] md:h-[170px] lg:h-[200px]">
      <span className="absolute top-0 -left-8 sm:-left-12 md:-left-16 lg:-left-20 text-foreground">See your</span>
      <span
        className={`absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 text-primary font-medium whitespace-nowrap ${
          isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        {currentWords[currentIndex]}
      </span>
      <span className="absolute bottom-0 -right-6 sm:-right-8 md:-right-10 lg:-right-12 text-foreground">more.</span>
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
      <section className="pt-20 sm:pt-28 md:pt-36 pb-14 sm:pb-24 px-6">
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
          {/* Fixed height container to prevent layout shift when "Kinmo" displays */}
          <div className="min-h-[110px] sm:min-h-[140px] md:min-h-[170px] lg:min-h-[200px] flex items-center justify-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
              <RotatingHeadline />
            </h1>
          </div>

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
      <section id="how-it-works" className="py-14 sm:py-24 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-5">
            Life gets busy. We get it.
          </h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-14 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed">
            Between work, family, and everything else — staying connected takes real effort. Kinmo handles the logistics so you can focus on the fun part.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 md:gap-10">
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-2">"We should hang!"</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                Turning good intentions into actual plans
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-2">"Who's planning this?"</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                When everyone assumes someone else will do it
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-2">"Works for me!"</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                Finding times that actually work for everyone
              </p>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-2">"Same place again?"</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                Discovering spots you'll all love
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Kinmo's AI Works */}
      <section className="py-14 sm:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-5">
            How it works
          </h2>
          <p className="text-center text-muted-foreground mb-10 sm:mb-16 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed">
            Kinmo learns the rhythm of your friendships.
          </p>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 md:gap-10 lg:gap-12">
            <div>
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">1</div>
              <h3 className="font-semibold text-lg mb-3">Learns what you love</h3>
              <p className="text-muted-foreground leading-relaxed">
                Swipe on places, share what you liked. Our tool learns your group's preferences.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">2</div>
              <h3 className="font-semibold text-lg mb-3">Finds when you're free</h3>
              <p className="text-muted-foreground leading-relaxed">
                Everyone shares when they're free. It finds times that work.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">3</div>
              <h3 className="font-semibold text-lg mb-3">Picks up on the vibes</h3>
              <p className="text-muted-foreground leading-relaxed">
                Too pricey? Too far? Too often? It picks up on the subtle stuff people might not say out loud.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Kinmo */}
      <section className="py-14 sm:py-24 md:py-32 px-6 bg-muted/30 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-12 sm:mb-20">
            Why Kinmo?
          </h2>

          <div className="relative">
            {/* Staggered benefits - editorial style */}
            <div className="space-y-4 sm:space-y-8 md:space-y-10">
              <div className="flex justify-center sm:justify-start sm:pl-4">
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg tracking-wide text-center sm:text-left">
                  Reduce the weight of planning
                </p>
              </div>

              <div className="flex justify-center sm:justify-start sm:pl-16">
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg tracking-wide text-center sm:text-left">
                  Increase the number of planners
                </p>
              </div>

              <div className="flex justify-center">
                <p className="text-muted-foreground/90 text-sm sm:text-base md:text-lg tracking-wide text-center">
                  Share feedback that loops into future events
                </p>
              </div>

              <div className="flex justify-center sm:justify-end sm:pr-16">
                <p className="text-foreground/70 text-sm sm:text-base md:text-lg tracking-wide text-center sm:text-right">
                  Improve the quality of your events
                </p>
              </div>
            </div>

            {/* The payoff - isolated, prominent */}
            <div className="mt-10 sm:mt-16 md:mt-20 text-center">
              <p className="text-foreground text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                See your people more
              </p>
              <div className="mt-4 mx-auto w-12 h-1 bg-primary/60 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20 md:py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 sm:mb-5 leading-snug">
            Is there anyone you want to see more?
          </h2>
          <p className="text-muted-foreground mb-8 sm:mb-10 text-sm sm:text-base md:text-lg leading-relaxed max-w-lg mx-auto">
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
