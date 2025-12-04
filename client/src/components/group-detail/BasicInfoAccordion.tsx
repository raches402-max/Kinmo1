/**
 * BasicInfoAccordion
 * Collapsible accordion for editing basic group information.
 * Includes name, location, emoji, color, budget, meeting frequency, availability, and quorum.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Settings } from "lucide-react";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { GroupAvailabilityHeatmap } from "@/components/GroupAvailabilityHeatmap";
import { ColorPaletteSelector } from "./ColorPaletteSelector";
import EmojiPicker from "emoji-picker-react";

// ========== TYPES ==========

type AvailabilityGridType = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

interface MemberAvailabilityData {
  memberId: string;
  memberName: string;
  availability: AvailabilityGridType | null;
}

interface MembersAvailabilityData {
  currentUserMemberId: string | null;
  membersAvailability: MemberAvailabilityData[];
}

interface MemberBudgetStats {
  budgets: number[];
  average: number;
}

interface EditGroupData {
  name: string;
  locationBase: string;
  emoji: string;
  accentColor: string;
  pastPreferences: string;
  additionalInstructions: string;
  mealEnabled: boolean;
  cafeEnabled: boolean;
  drinksEnabled: boolean;
  dessertEnabled: boolean;
  experiencesEnabled: boolean;
  defaultQuorumThreshold: number;
}

interface GroupData {
  accentColor?: string | null;
  memberBudgetStats?: MemberBudgetStats;
}

interface BasicInfoAccordionProps {
  /**
   * Current group data for defaults
   */
  group: GroupData | null;
  /**
   * Editing state for group data
   */
  editGroupData: EditGroupData;
  /**
   * Callback to update group data
   */
  setEditGroupData: (data: EditGroupData) => void;
  /**
   * Budget range [min, max]
   */
  editBudgetRange: number[];
  /**
   * Callback to update budget range
   */
  setEditBudgetRange: (range: number[]) => void;
  /**
   * Meeting frequency number
   */
  editFrequencyNumber: number;
  /**
   * Callback to update frequency number
   */
  setEditFrequencyNumber: (num: number) => void;
  /**
   * Meeting frequency unit (day, week, month, year)
   */
  editFrequencyUnit: string;
  /**
   * Callback to update frequency unit
   */
  setEditFrequencyUnit: (unit: string) => void;
  /**
   * Availability grid
   */
  editAvailability: AvailabilityGridType;
  /**
   * Callback to update availability
   */
  setEditAvailability: (availability: AvailabilityGridType) => void;
  /**
   * Members availability data for heatmap
   */
  membersAvailabilityData: MembersAvailabilityData | null | undefined;
  /**
   * Emoji picker open state
   */
  emojiPickerOpen: boolean;
  /**
   * Callback to set emoji picker open state
   */
  setEmojiPickerOpen: (open: boolean) => void;
  /**
   * Function to format meeting frequency string
   */
  formatMeetingFrequency: (freq: string) => string;
}

// ========== COMPONENT ==========

export function BasicInfoAccordion({
  group,
  editGroupData,
  setEditGroupData,
  editBudgetRange,
  setEditBudgetRange,
  editFrequencyNumber,
  setEditFrequencyNumber,
  editFrequencyUnit,
  setEditFrequencyUnit,
  editAvailability,
  setEditAvailability,
  membersAvailabilityData,
  emojiPickerOpen,
  setEmojiPickerOpen,
  formatMeetingFrequency,
}: BasicInfoAccordionProps) {
  return (
    <AccordionItem value="basic-info" className="border rounded-lg">
      <Card className="border-0">
        <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-primary/25 rounded-md">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                Basic Info
                <Badge variant="outline" className="text-xs font-normal">
                  For Everyone
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {editGroupData.name} • ${editBudgetRange[0]}-${editBudgetRange[1]} •{" "}
                {formatMeetingFrequency(`${editFrequencyNumber}x ${editFrequencyUnit}`)}
              </CardDescription>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-4 pt-2">
            {/* Name and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">Group Name</Label>
                <Input
                  id="edit-group-name"
                  value={editGroupData.name}
                  onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                  data-testid="input-edit-group-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location Base</Label>
                <Input
                  id="edit-location"
                  value={editGroupData.locationBase}
                  onChange={(e) => setEditGroupData({ ...editGroupData, locationBase: e.target.value })}
                  data-testid="input-edit-location"
                />
              </div>
            </div>

            {/* Emoji Picker */}
            <div className="space-y-2">
              <Label htmlFor="inline-group-emoji">Group Icon</Label>
              <div className="flex items-center gap-3">
                <div className="text-5xl" data-testid="text-selected-emoji">
                  {editGroupData.emoji || "🎉"}
                </div>
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" data-testid="button-choose-emoji">
                      Choose emoji 🙂
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="overflow-hidden rounded-lg">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => {
                          setEditGroupData({ ...editGroupData, emoji: emojiData.emoji });
                          setEmojiPickerOpen(false);
                        }}
                        width={350}
                        height={400}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Group Color Palette */}
            <ColorPaletteSelector
              value={editGroupData.accentColor || group?.accentColor || "#6B5B6E"}
              onChange={(color) => setEditGroupData({ ...editGroupData, accentColor: color })}
            />

            {/* Budget + Meeting Frequency - side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Budget Range (per person)</Label>
                <div className="space-y-3">
                  <div className="relative">
                    <Slider
                      min={0}
                      max={250}
                      step={10}
                      value={editBudgetRange}
                      onValueChange={setEditBudgetRange}
                      className="w-full"
                      data-testid="slider-edit-budget"
                    />
                    {/* Member budget dots overlay */}
                    {group && group.memberBudgetStats && (
                      <div className="absolute inset-0 pointer-events-none">
                        {(() => {
                          const stats = group.memberBudgetStats;
                          // Group budgets by value to show count on hover
                          const budgetCounts = stats.budgets.reduce((acc: Record<number, number>, budget: number) => {
                            acc[budget] = (acc[budget] || 0) + 1;
                            return acc;
                          }, {});
                          const uniqueBudgets: number[] = Object.keys(budgetCounts).map(Number);
                          const averagePosition = (stats.average / 250) * 100;

                          return (
                            <>
                              {/* Show all member budget dots as small grey dots */}
                              {uniqueBudgets.map((budget) => {
                                const position = (budget / 250) * 100;
                                const count = budgetCounts[budget];

                                return (
                                  <Tooltip key={`member-${budget}`}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto cursor-help"
                                        style={{ left: `${position}%` }}
                                        data-testid={`budget-dot-${budget}`}
                                      >
                                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        ${budget} ({count} {count === 1 ? "member" : "members"})
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}

                              {/* Show average as a larger, distinct dot */}
                              <Tooltip key="average">
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto cursor-help"
                                    style={{ left: `${averagePosition}%` }}
                                    data-testid="budget-dot-average"
                                  >
                                    <div className="w-3 h-3 rounded-full bg-primary/60 ring-2 ring-primary/30" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-medium">Group Avg: ${stats.average}</p>
                                </TooltipContent>
                              </Tooltip>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium" data-testid="text-edit-budget-min">
                      {editBudgetRange[0] >= 200 ? "$200+" : `$${editBudgetRange[0]}`}
                    </span>
                    <span className="font-medium" data-testid="text-edit-budget-max">
                      {editBudgetRange[1] >= 200 ? "$200+" : `$${editBudgetRange[1]}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>How Often to Meet</Label>
                <div className="flex items-center gap-2">
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={editFrequencyNumber}
                      onChange={(e) => setEditFrequencyNumber(parseInt(e.target.value) || 1)}
                      data-testid="input-edit-frequency-number"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">x each</span>
                  <Select value={editFrequencyUnit} onValueChange={setEditFrequencyUnit}>
                    <SelectTrigger className="flex-1" data-testid="select-edit-frequency-unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">day</SelectItem>
                      <SelectItem value="week">week</SelectItem>
                      <SelectItem value="month">month</SelectItem>
                      <SelectItem value="year">year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Group Availability */}
            <div className="space-y-3">
              <Label>Group Availability</Label>
              {membersAvailabilityData && membersAvailabilityData.currentUserMemberId ? (
                <GroupAvailabilityHeatmap
                  membersAvailability={membersAvailabilityData.membersAvailability.map((m) => ({
                    memberId: m.memberId,
                    memberName: m.memberName,
                    availability: m.availability || createEmptyAvailability(),
                  }))}
                  currentMemberId={membersAvailabilityData.currentUserMemberId}
                  myAvailability={editAvailability}
                  onMyAvailabilityChange={(newAvailability) => {
                    setEditAvailability(newAvailability);
                  }}
                  showMemberDetails={true}
                  compact={true}
                  mobileMode="compact-week"
                />
              ) : (
                <AvailabilityGrid value={editAvailability} onChange={setEditAvailability} />
              )}
            </div>

            {/* Default Quorum Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Default Quorum for Events</Label>
                <span className="text-sm font-semibold text-primary">{editGroupData.defaultQuorumThreshold}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum percentage of members needed to confirm an event. New events will use this as the default.
              </p>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={editGroupData.defaultQuorumThreshold}
                onChange={(e) =>
                  setEditGroupData({ ...editGroupData, defaultQuorumThreshold: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-2xs text-muted-foreground">
                <span>10%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
