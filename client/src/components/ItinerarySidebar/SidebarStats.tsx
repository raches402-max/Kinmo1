/**
 * Sidebar Stats Component
 * Displays collapsible trip statistics (distance, time)
 */

import { Clock, MapPin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface SidebarStatsProps {
  totalDistance: number; // in miles
  estimatedTime: number; // in minutes
  venueCount: number;
}

export function SidebarStats({ totalDistance, estimatedTime, venueCount }: SidebarStatsProps) {
  const [isOpen, setIsOpen] = useState(true);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  // Color code based on feasibility
  const getDistanceColor = () => {
    if (totalDistance < 3) return "text-green-600";
    if (totalDistance < 5) return "text-yellow-600";
    return "text-red-600";
  };

  const getTimeColor = () => {
    if (estimatedTime < 180) return "text-green-600"; // < 3 hours
    if (estimatedTime < 240) return "text-yellow-600"; // < 4 hours
    return "text-red-600";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>Trip Stats</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Distance</span>
            <span className={`font-medium ${getDistanceColor()}`}>
              {totalDistance.toFixed(1)} mi
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. Duration</span>
            <span className={`font-medium ${getTimeColor()}`}>
              {formatTime(estimatedTime)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Venues</span>
            <span className="font-medium">{venueCount} stops</span>
          </div>
        </div>

        {/* Feasibility indicator */}
        {totalDistance > 5 && (
          <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-200 rounded text-xs text-yellow-800">
            Venues are spread out. Consider nearby alternatives.
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
