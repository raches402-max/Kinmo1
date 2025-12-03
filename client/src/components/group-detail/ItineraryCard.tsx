import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Save, Plus, ChevronDown } from "lucide-react";
import { ItineraryDisplay } from "@/components/ItineraryDisplay";

interface ItineraryCardProps {
  itineraries: any[];
  groupId: string;
  showInlineScheduling: boolean;
  addMoreStopsOpen: boolean;
  onSaveItinerary: (itineraryId: string) => void;
  onToggleAddMoreStops: () => void;
}

export function ItineraryCard({
  itineraries,
  groupId,
  showInlineScheduling,
  addMoreStopsOpen,
  onSaveItinerary,
  onToggleAddMoreStops,
}: ItineraryCardProps) {
  if (itineraries.length === 0) {
    return null;
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Your Itinerary
            </CardTitle>
            <CardDescription className="text-xs">
              Drag to reorder venues
            </CardDescription>
          </div>
          {!showInlineScheduling && (
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  if (itineraries.length > 0) {
                    onSaveItinerary(itineraries[0].id);
                  }
                }}
                data-testid="button-save-itinerary"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onToggleAddMoreStops}
                data-testid="button-add-more-stops"
              >
                {addMoreStopsOpen ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                    Hide
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Stops
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {itineraries.map((itinerary: any) => (
          <ItineraryDisplay key={itinerary.id} itinerary={itinerary} groupId={groupId} />
        ))}
      </CardContent>
    </Card>
  );
}
