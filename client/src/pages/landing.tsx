// Reference: javascript_log_in_with_replit blueprint
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Users, Calendar, MapPin } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Kinmo.ai</h1>
          </div>
          <Button
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-8 py-24">
        <div className="text-center space-y-8 mb-20">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Using AI to take the friction out of seeing your kin, more
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Never struggle to plan group activities again. Get personalized AI suggestions
            based on your group's preferences, budget, and availability.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            className="mt-6"
            data-testid="button-get-started"
          >
            Get Started Free
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-24">
          <Card>
            <CardHeader>
              <Sparkles className="h-8 w-8 text-primary mb-2" />
              <CardTitle>AI-Powered Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get smart activity recommendations tailored to your group's unique preferences and budget.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Group Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Define your group's closeness level, novelty preferences, and past experiences for better matches.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Calendar className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Availability Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track when everyone is available and get suggestions that work for the whole group.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MapPin className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Location-Based</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Discover venues and activities near your location with real-time Google Places data.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
