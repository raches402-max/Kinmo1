import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { KinmoIcon } from "@/components/KinmoLogo";

// Full landing page mockup with new Saturated Gold (#FFB800) applied to all yellow elements
export default function PrototypeKinmoText() {
  return (
    <div className="min-h-screen bg-background">
      {/* Override primary color to #FFB800 for this page */}
      <style>{`
        :root {
          --primary-preview: 45 100% 50%;
        }
        .preview-primary {
          color: #FFB800 !important;
        }
        .preview-primary-bg {
          background-color: #FFB800 !important;
        }
        .preview-primary-fill {
          fill: #FFB800 !important;
        }
        .preview-primary-bg-10 {
          background-color: rgba(255, 184, 0, 0.1) !important;
        }
        .preview-primary-bg-60 {
          background-color: rgba(255, 184, 0, 0.6) !important;
        }
        .preview-btn-primary {
          background-color: #FFB800 !important;
          color: #000 !important;
        }
        .preview-btn-primary:hover {
          background-color: #E5A500 !important;
        }
        @keyframes slow-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-slow-spin {
          animation: slow-spin 20s linear infinite;
        }
      `}</style>

      {/* Floating "Preview Mode" banner */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#FFB800] text-black py-2 px-4 text-center text-sm font-medium">
        Preview Mode: Saturated Gold (#FFB800) applied to all yellow elements
        <Link href="/" className="ml-4 underline hover:no-underline">
          ← Back to actual landing page
        </Link>
      </div>

      {/* Header */}
      <header className="fixed top-10 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KinmoIcon size={26} color="#FFB800" />
            <span className="font-semibold text-lg">Kinmo</span>
          </div>
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 sm:pt-40 md:pt-48 pb-14 sm:pb-24 px-6">
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
              <circle cx="24" cy="24" r="14" className="preview-primary-fill" />
              <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" className="preview-primary-fill" />
              <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" className="preview-primary-fill" />
              <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" className="preview-primary-fill" />
              <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" className="preview-primary-fill" />
              <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" className="preview-primary-fill" />
              <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" className="preview-primary-fill" />
            </svg>
          </div>

          <p className="text-sm tracking-wide uppercase text-muted-foreground mb-3">Using AI to help you</p>

          {/* Static headline for mockup */}
          <div className="min-h-[110px] sm:min-h-[140px] md:min-h-[170px] lg:min-h-[200px] flex items-center justify-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
              <span className="relative block w-[280px] sm:w-[340px] md:w-[420px] lg:w-[500px] h-[110px] sm:h-[140px] md:h-[170px] lg:h-[200px]">
                <span className="absolute top-0 -left-8 sm:-left-12 md:-left-16 lg:-left-20 text-foreground">See your</span>
                <span className="absolute top-[38%] left-1/2 -translate-x-1/2 font-bold whitespace-nowrap" style={{ color: '#FFB800' }}>
                  friends
                </span>
                <span className="absolute bottom-0 -right-6 sm:-right-8 md:-right-10 lg:-right-12 text-foreground">more.</span>
              </span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="preview-btn-primary px-10 h-12 text-base font-semibold"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 text-base"
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-14 sm:py-24 px-6 bg-muted/30">
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
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full preview-primary-bg-10 preview-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">1</div>
              <h3 className="font-semibold text-lg mb-3">Learns what you love</h3>
              <p className="text-muted-foreground leading-relaxed">
                Swipe on places, share what you liked. Our tool learns your group's preferences.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full preview-primary-bg-10 preview-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">2</div>
              <h3 className="font-semibold text-lg mb-3">Finds when you're free</h3>
              <p className="text-muted-foreground leading-relaxed">
                Everyone shares when they're free. It finds times that work.
              </p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full preview-primary-bg-10 preview-primary text-base sm:text-lg font-semibold mb-3 sm:mb-4">3</div>
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

            <div className="mt-10 sm:mt-16 md:mt-20 text-center">
              <p className="text-foreground text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                See your people more
              </p>
              <div className="mt-4 mx-auto w-12 h-1 preview-primary-bg-60 rounded-full" />
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
            className="preview-btn-primary px-10 h-12 text-base font-semibold"
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
            <span className="text-sm text-muted-foreground">Privacy</span>
            <span className="text-sm text-muted-foreground">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
