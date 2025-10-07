import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, Users, MapPin, Calendar } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-indigo-600" />
        
        {/* Dark wash overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center text-white">
          <h1 className="text-5xl md:text-6xl font-bold mb-6" data-testid="text-hero-title">
            Plan Perfect Group Activities with AI
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto" data-testid="text-hero-subtitle">
            Get personalized suggestions for real venues and events based on your group's preferences, budget, and location
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/create-group">
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 backdrop-blur-md border border-white/20"
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
                className="backdrop-blur-md bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-join-group"
              >
                Join a Group
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16" data-testid="text-features-title">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="text-center" data-testid="card-feature-1">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Group</h3>
              <p className="text-muted-foreground">
                Add member details, set budget range, and define preferences
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center" data-testid="card-feature-2">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Suggestions</h3>
              <p className="text-muted-foreground">
                Get 6 personalized activity recommendations from real places
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center" data-testid="card-feature-3">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real Venues</h3>
              <p className="text-muted-foreground">
                Discover actual locations with ratings, photos, and reviews
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center" data-testid="card-feature-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
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
