/**
 * AutomationSettings
 * Autopilot settings accordion for hands-free group event planning.
 * Toggles for discovering spots, drafting plans, and auto-scheduling events.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardContent, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Compass, FileText, Send, HelpCircle, Settings2 } from "lucide-react";

// ========== TYPES ==========

interface AutomationSettingsProps {
  autoActivitiesEnabled: boolean;
  autoItineraryEnabled: boolean;
  autoScheduleEnabled: boolean;
  nextEventDueDate?: Date | string | null;
  frequencyNumber: number;
  frequencyUnit: string;
  onToggle: (field: string, value: boolean) => void;
  onOpenAutoSchedulePreview: () => void;
  onNavigateToHome: () => void;
}

// ========== COMPONENT ==========

export function AutomationSettings({
  autoActivitiesEnabled,
  autoItineraryEnabled,
  autoScheduleEnabled,
  nextEventDueDate,
  frequencyNumber,
  frequencyUnit,
  onToggle,
  onOpenAutoSchedulePreview,
  onNavigateToHome,
}: AutomationSettingsProps) {
  const enabledFeatures = [
    autoActivitiesEnabled && "Finding spots",
    autoItineraryEnabled && "Drafting plans",
    autoScheduleEnabled && "Sending invites",
  ].filter(Boolean);

  const summaryText = enabledFeatures.length > 0
    ? enabledFeatures.join(" · ")
    : "All features off";

  return (
    <AccordionItem value="automation" className="border rounded-lg overflow-hidden">
      <Card className="border-0 bg-card">
        <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-secondary/30 rounded-lg">
              <Settings2 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">
                Autopilot
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{summaryText}</CardDescription>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-3 pt-2">
            {/* Discover new spots */}
            <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-colors">
              <Switch
                id="auto-activities"
                checked={autoActivitiesEnabled}
                onCheckedChange={(checked) => onToggle("autoActivitiesEnabled", checked)}
                data-testid="switch-auto-activities"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="auto-activities" className="cursor-pointer text-base font-medium">
                    Discover new spots
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm space-y-2">
                      <p className="text-muted-foreground">
                        Based on places your group has loved, we'll find similar spots each week and add them to your Explore tab.
                      </p>
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <strong>Example:</strong> Loved Marufuku Ramen? We might suggest Ippudo or Mensho Tokyo.
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-sm text-muted-foreground">
                  Find venues matching your group's taste each week
                </p>
              </div>
            </div>

            {/* Draft event plans */}
            <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-colors">
              <Switch
                id="auto-itinerary"
                checked={autoItineraryEnabled}
                onCheckedChange={(checked) => onToggle("autoItineraryEnabled", checked)}
                data-testid="switch-auto-itinerary"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="auto-itinerary" className="cursor-pointer text-base font-medium">
                    Draft event plans
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm space-y-2">
                      <p className="text-muted-foreground">
                        We'll create ready-to-send itineraries using your saved plans, then favorites, then discovered spots.
                      </p>
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <strong>Example:</strong> "Dinner at Ryoko's & Dessert at Bi-Rite" from your favorites.
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-sm text-muted-foreground">
                  Build ready-to-send itineraries from your favorites
                </p>
              </div>
            </div>

            {/* Send invites automatically */}
            <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-colors">
              <Switch
                id="auto-schedule"
                checked={autoScheduleEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onOpenAutoSchedulePreview();
                  } else {
                    onToggle("autoScheduleEnabled", false);
                  }
                }}
                data-testid="switch-auto-schedule"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="auto-schedule" className="cursor-pointer text-base font-medium">
                    Send invites automatically
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm space-y-2">
                      <p className="font-medium mb-1">How it works:</p>
                      <ul className="text-muted-foreground space-y-1.5 text-xs">
                        <li><strong>10 days before:</strong> A draft event is created</li>
                        <li><strong>48-hour window:</strong> Members can volunteer to host</li>
                        <li><strong>Then:</strong> The invite goes out automatically</li>
                      </ul>
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <strong>Hosting means:</strong> You send the event and coordinate who's coming.
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-sm text-muted-foreground">
                  Schedule and send events every {frequencyNumber} {frequencyUnit}
                  {frequencyNumber !== 1 ? "s" : ""}
                </p>
                {autoScheduleEnabled && (
                  <div className="text-sm mt-1.5 flex items-center gap-1">
                    {nextEventDueDate ? (
                      <span className="text-muted-foreground">
                        Next event:{" "}
                        <span className="font-medium text-foreground">
                          {new Date(nextEventDueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Active</span>
                    )}
                    <span className="text-muted-foreground">·</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-sm text-primary hover:text-primary/80 hover:bg-transparent"
                      onClick={onNavigateToHome}
                      data-testid="link-view-home-tab"
                    >
                      View events
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
