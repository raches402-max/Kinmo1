/**
 * Main Itinerary Sidebar Component
 * Persistent collapsible sidebar for itinerary building
 */

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarHeader as CustomSidebarHeader } from "./SidebarHeader";
import { SidebarVenueCard } from "./SidebarVenueCard";
import { SidebarStats } from "./SidebarStats";
import { SidebarFooter as CustomSidebarFooter } from "./SidebarFooter";
import { EmptyState } from "./EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Venue {
  sourceType: 'activity' | 'voting_event' | 'ad_hoc';
  sourceId: string;
  venueName?: string;
  venueType?: string;
  rating?: number;
  priceLevel?: number;
  distance?: number;
  adHocData?: any;
}

interface ItinerarySidebarProps {
  venues: Venue[];
  onReorder: (venues: Venue[]) => void;
  onRemove: (venue: Venue) => void;
  onQuickSchedule: () => void;
  onBuildEdit: () => void;
  onClearAll: () => void;
  isLoading?: boolean;
  // Distance calculation function (optional, will use simple distance if not provided)
  calculateDistance?: (venue1: Venue, venue2: Venue) => Promise<number>;
}

export function ItinerarySidebar({
  venues,
  onReorder,
  onRemove,
  onQuickSchedule,
  onBuildEdit,
  onClearAll,
  isLoading = false,
  calculateDistance,
}: ItinerarySidebarProps) {
  const [distances, setDistances] = useState<Record<number, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = venues.findIndex(
        (v) => `${v.sourceType}-${v.sourceId}` === active.id
      );
      const newIndex = venues.findIndex(
        (v) => `${v.sourceType}-${v.sourceId}` === over.id
      );

      const newVenues = arrayMove(venues, oldIndex, newIndex);
      onReorder(newVenues);
    }
  };

  // Calculate total distance and time
  const calculateTotals = () => {
    let totalDistance = 0;
    let totalTime = 30; // Base time for first venue

    venues.forEach((venue, index) => {
      if (index < venues.length - 1) {
        // Use calculated distance or fallback to venue's distance property
        const dist = distances[index] || venue.distance || 1.0;
        totalDistance += dist;

        // Add travel time (assume 30 mph average + 15 min per stop)
        const travelTime = (dist / 30) * 60; // Convert to minutes
        totalTime += travelTime + 45; // 45 min per stop (15 min travel buffer + 30 min at venue)
      }
    });

    return { totalDistance, totalTime: Math.round(totalTime) };
  };

  const { totalDistance, totalTime } = calculateTotals();

  // Generate unique IDs for sortable
  const venueIds = venues.map((v) => `${v.sourceType}-${v.sourceId}`);

  return (
    <Sidebar side="right" collapsible="icon" className="border-l">
      <SidebarHeader>
        <CustomSidebarHeader venueCount={venues.length} />
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          {venues.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {/* Stats Section */}
              {venues.length > 1 && (
                <SidebarStats
                  totalDistance={totalDistance}
                  estimatedTime={totalTime}
                  venueCount={venues.length}
                />
              )}

              {/* Venues List */}
              <div className="px-4 space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={venueIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {venues.map((venue, index) => {
                      const id = `${venue.sourceType}-${venue.sourceId}`;
                      const distanceToNext =
                        index < venues.length - 1
                          ? distances[index] || venue.distance
                          : undefined;

                      return (
                        <SidebarVenueCard
                          key={id}
                          id={id}
                          venueName={
                            venue.venueName ||
                            venue.adHocData?.venueName ||
                            "Unnamed Venue"
                          }
                          venueType={venue.venueType || venue.adHocData?.venueType}
                          rating={venue.adHocData?.rating}
                          priceLevel={venue.adHocData?.priceLevel}
                          distanceToNext={distanceToNext}
                          isLast={index === venues.length - 1}
                          onRemove={() => onRemove(venue)}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Tips/Warnings */}
              {totalDistance > 5 && (
                <div className="px-4">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-200 rounded-lg">
                    <p className="text-xs font-medium text-yellow-900">
                      Long distances detected
                    </p>
                    <p className="text-xs text-yellow-800 mt-1">
                      Consider grouping venues by area to reduce travel time
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <CustomSidebarFooter
          venueCount={venues.length}
          onQuickSchedule={onQuickSchedule}
          onBuildEdit={onBuildEdit}
          onClearAll={onClearAll}
          isLoading={isLoading}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
