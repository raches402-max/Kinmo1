/**
 * AutomationSettings
 * AI-powered automation settings accordion section for group management.
 * Includes toggles for auto-activities, auto-itineraries, and auto-scheduling.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bot, Sparkles, Info } from "lucide-react";

// ========== TYPES ==========

interface AutomationSettingsProps {
  /**
   * Whether auto-activities is enabled
   */
  autoActivitiesEnabled: boolean;
  /**
   * Whether auto-itinerary is enabled
   */
  autoItineraryEnabled: boolean;
  /**
   * Whether auto-schedule is enabled
   */
  autoScheduleEnabled: boolean;
  /**
   * Next event due date for auto-scheduling
   */
  nextEventDueDate?: Date | string | null;
  /**
   * Meeting frequency number (e.g., 2 for "2x per week")
   */
  frequencyNumber: number;
  /**
   * Meeting frequency unit (day, week, month, year)
   */
  frequencyUnit: string;
  /**
   * Callback to toggle an automation setting
   */
  onToggle: (field: string, value: boolean) => void;
  /**
   * Callback to open auto-schedule preview dialog
   */
  onOpenAutoSchedulePreview: () => void;
  /**
   * Callback to navigate to home tab
   */
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
  const summaryText = [
    autoActivitiesEnabled && "Auto-activities",
    autoItineraryEnabled && "Auto-itineraries",
    autoScheduleEnabled && "Auto-schedule",
  ].filter(Boolean).join(" • ") || "Let AI handle planning";

  return (
    <AccordionItem value="automation" className="border rounded-lg">
      <Card className="border-0 bg-primary/5">
        <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-primary/25 rounded-md">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>Automation & Smart Features</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  ✨ AI-Powered
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">{summaryText}</CardDescription>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-4 pt-2">
            {/* Auto-generate Activities */}
            <div className="flex items-start gap-3 p-3 bg-background rounded-md">
              <Switch
                id="auto-activities"
                checked={autoActivitiesEnabled}
                onCheckedChange={(checked) => onToggle("autoActivitiesEnabled", checked)}
                data-testid="switch-auto-activities"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label htmlFor="auto-activities" className="cursor-pointer font-medium">
                    Auto-generate Activities
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm space-y-2">
                      <div className="font-semibold">How it works:</div>
                      <p className="text-muted-foreground">
                        AI discovers new venues weekly matching your group's taste. It analyzes your feedback →
                        finds similar places → adds them to your Activities tab.
                      </p>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        <strong>Example:</strong> Based on your ❤️ for Marufuku Ramen, AI might suggest Ippudo
                        and Mensho Tokyo
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Auto-create Itinerary Drafts */}
            <div className="flex items-start gap-3 p-3 bg-background rounded-md">
              <Switch
                id="auto-itinerary"
                checked={autoItineraryEnabled}
                onCheckedChange={(checked) => onToggle("autoItineraryEnabled", checked)}
                data-testid="switch-auto-itinerary"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label htmlFor="auto-itinerary" className="cursor-pointer font-medium">
                    Auto-create Itinerary Drafts
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm space-y-2">
                      <div className="font-semibold">How it works:</div>
                      <p className="text-muted-foreground">
                        AI builds 2-3 venue itineraries you can review and schedule. Priority:{" "}
                        <strong>Saved plans</strong> → <strong>favorited venues</strong> →{" "}
                        <strong>AI suggestions</strong>
                      </p>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        <strong>Example:</strong> Creates "Dinner at Ryoko's & Dessert at Bi-Rite" from your
                        favorited venues
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Auto-schedule Events */}
            <div className="flex items-start gap-3 p-3 bg-background rounded-md">
              <Switch
                id="auto-schedule"
                checked={autoScheduleEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Show preview dialog before enabling
                    onOpenAutoSchedulePreview();
                  } else {
                    // Disable immediately without preview
                    onToggle("autoScheduleEnabled", false);
                  }
                }}
                data-testid="switch-auto-schedule"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label htmlFor="auto-schedule" className="cursor-pointer font-medium">
                    Auto-schedule Events
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm space-y-2">
                      <div className="font-semibold">How it works:</div>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
                        <li>
                          <strong>10 days before target:</strong> AI creates a draft event
                        </li>
                        <li>
                          <strong>48-hour window:</strong> Members marked "open to hosting" can volunteer
                        </li>
                        <li>
                          <strong>Auto-sends:</strong> If no one volunteers, AI sends the event automatically
                        </li>
                      </ul>
                      <p className="text-muted-foreground text-xs">
                        <strong>Content:</strong> Saved plans → favorites → viable activities
                      </p>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        <strong>What does hosting mean?</strong> The host sends event details to the group and
                        coordinates attendance.
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates and sends an event every {frequencyNumber} {frequencyUnit}
                  {frequencyNumber !== 1 ? "s" : ""} automatically
                </p>
                {autoScheduleEnabled && (
                  <div className="text-xs mt-1.5">
                    {nextEventDueDate ? (
                      <span className="text-muted-foreground">
                        → Next auto-event:{" "}
                        {new Date(nextEventDueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">→ Auto-scheduling active</span>
                    )}{" "}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary hover:underline"
                      onClick={onNavigateToHome}
                      data-testid="link-view-home-tab"
                    >
                      (view on Home tab)
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
