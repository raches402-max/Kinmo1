/**
 * Empty State Component for Itinerary Sidebar
 * Displays helpful message when no venues are selected
 */

import { Calendar, MapPin, Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <MapPin className="h-8 w-8 text-primary" />
      </div>

      <h3 className="text-lg font-semibold mb-2">Start Building Your Plan</h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Browse activities and add venues to create your perfect itinerary
      </p>

      <div className="space-y-3 w-full max-w-xs">
        <div className="flex items-start gap-3 text-left">
          <div className="rounded-full bg-muted p-1.5 mt-0.5">
            <Sparkles className="h-3 w-3" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">Browse AI Suggestions</p>
            <p className="text-xs text-muted-foreground">Discover venues your group will love</p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <div className="rounded-full bg-muted p-1.5 mt-0.5">
            <MapPin className="h-3 w-3" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">Add 1-5 Venues</p>
            <p className="text-xs text-muted-foreground">Click the heart icon to add to your plan</p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <div className="rounded-full bg-muted p-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">Schedule & Send</p>
            <p className="text-xs text-muted-foreground">Pick a time and invite your group</p>
          </div>
        </div>
      </div>
    </div>
  );
}
