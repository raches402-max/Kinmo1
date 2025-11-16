import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, Users, MapPin, Calendar } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center bg-background">
        {/* Content */}
        <div className="max-w-5xl mx-auto px-8 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight" data-testid="text-hero-title">
            Using AI to take the friction out of seeing your kin, more
          </h1>
          <p className="text-lg md:text-xl mb-10 text-muted-foreground max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
            Get personalized activity suggestions for real venues and events based on your group's preferences, budget, and location
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/create-group">
              <Button
                size="lg"
                data-testid="button-create-group"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Create Your Group
              </Button>
            </Link>
            <Link href="/join-entry">
              <Button
                size="lg"
                variant="outline"
                data-testid="button-join-group"
              >
                Join a Group
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-20" data-testid="text-features-title">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Feature 1 */}
            <div className="text-center" data-testid="card-feature-1">
              <div className="w-16 h-16 bg-primary/25 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Group</h3>
              <p className="text-muted-foreground">
                Add member details, set budget range, and define preferences
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center" data-testid="card-feature-2">
              <div className="w-16 h-16 bg-primary/25 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Suggestions</h3>
              <p className="text-muted-foreground">
                Get 6 personalized activity recommendations from real places
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center" data-testid="card-feature-3">
              <div className="w-16 h-16 bg-primary/25 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real Venues</h3>
              <p className="text-muted-foreground">
                Discover actual locations with ratings, photos, and reviews
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center" data-testid="card-feature-4">
              <div className="w-16 h-16 bg-primary/25 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Send Invitations</h3>
              <p className="text-muted-foreground">
                Share via email and group link for members to join
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
