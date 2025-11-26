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
        <span className="text-primary font-semibold">Kinmo</span>
      </span>
    );
  }

  if (phase === "kin") {
    return (
      <span className="whitespace-nowrap animate-kin-reveal">
        See your <span className="text-primary font-semibold">kin</span> more.
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap">
      See your{" "}
      <span
        className={`inline-block transition-all duration-300 text-primary ${
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
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-8">
            <svg
              width="80"
              height="80"
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

          <p className="text-sm text-muted-foreground mb-2">Using AI to help you</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <RotatingHeadline />
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            AI that handles the annoying parts of making plans — so you can skip to the part where you actually see each other.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = "/api/login"}
              className="px-8"
              data-testid="button-get-started"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section id="how-it-works" className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            Planning is easy. Doing it every time is exhausting.
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Someone has to be the one who texts "when are you free?" for the 47th time. Usually it's you.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center md:text-left">
              <h3 className="font-semibold text-lg mb-2">The group chat spiral</h3>
              <p className="text-muted-foreground text-sm">
                "We should do something!" *48 hours of scheduling tennis* "...maybe next month?"
              </p>
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-semibold text-lg mb-2">The default planner</h3>
              <p className="text-muted-foreground text-sm">
                You know who you are. You're tired. We get it.
              </p>
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-semibold text-lg mb-2">The slow fade</h3>
              <p className="text-muted-foreground text-sm">
                Nobody's mad, everyone's "busy." Months go by. You meant to reach out.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            From "we should hang out" to "see you Saturday"
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-4xl font-bold text-primary/20 mb-3">1</div>
              <h3 className="font-semibold text-lg mb-2">Add your people</h3>
              <p className="text-muted-foreground">
                Create a group. Invite your crew. Tell Kinmo what you're into.
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary/20 mb-3">2</div>
              <h3 className="font-semibold text-lg mb-2">Let it handle the annoying parts</h3>
              <p className="text-muted-foreground">
                Finding times, suggesting places, sending reminders. The stuff nobody wants to do.
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary/20 mb-3">3</div>
              <h3 className="font-semibold text-lg mb-2">Actually hang out</h3>
              <p className="text-muted-foreground">
                Revolutionary concept: seeing your friends in person.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            What it actually does
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Less "AI-powered synergy," more "actually useful."
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { title: "Finds times that work", desc: "Everyone marks their availability. Kinmo finds the overlap. No more 27-message threads." },
              { title: "Learns your group's taste", desc: "Swipe on venues, rate places you've been. It gets smarter about what to suggest." },
              { title: "Real places, real data", desc: "Powered by Google Places. Hours, ratings, prices, photos — not made up recommendations." },
              { title: "Keeps things moving", desc: "Gentle reminders, automatic scheduling. It doesn't give up after one 'maybe.'" },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-lg border border-border/60 bg-card/50">
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            You've said "we should hang out" enough times
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to use. No credit card. No commitment. Just fewer excuses.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            className="px-8"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <KinmoIcon size={20} color="currentColor" />
            <span className="text-sm">© {new Date().getFullYear()} Kinmo</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
