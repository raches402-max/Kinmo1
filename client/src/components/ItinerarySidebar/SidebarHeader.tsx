/**
 * Sidebar Header Component
 * Header with title, venue count, and collapse button
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelRightClose } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

interface SidebarHeaderProps {
  venueCount: number;
  maxVenues?: number;
}

export function SidebarHeader({ venueCount, maxVenues = 5 }: SidebarHeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Your Itinerary</h3>
        {venueCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {venueCount} of {maxVenues}
          </Badge>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
        title="Collapse sidebar (Cmd+B)"
      >
        <PanelRightClose className="h-4 w-4" />
      </Button>
    </div>
  );
}
