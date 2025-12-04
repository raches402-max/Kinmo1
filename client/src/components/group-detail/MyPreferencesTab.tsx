/**
 * MyPreferencesTab
 * Personal preferences tab that allows members to override group settings.
 * Includes budget, categories, availability, and meeting frequency overrides.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TabsContent } from "@/components/ui/tabs";
import { UserCheck, Info } from "lucide-react";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { GroupAvailabilityHeatmap } from "@/components/GroupAvailabilityHeatmap";
import { GroupBudgetInfluence } from "@/components/GroupBudgetInfluence";

// ========== TYPES ==========

// Availability grid type matching the component expectations
type AvailabilityGridType = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

interface BudgetRange {
  min: number;
  max: number;
}

interface MeetingFrequency {
  number: number;
  unit: string;
}

interface MemberAvailabilityData {
  memberId: string;
  memberName: string;
  userId: string | null;
  availability: AvailabilityGridType | null;
}

interface MembersAvailabilityData {
  currentUserMemberId: string | null;
  membersAvailability: MemberAvailabilityData[];
  totalMembers: number;
}

interface MemberBudgetData {
  memberId: string;
  memberName: string;
  userId: string | null;
  budgetMin: number;
  budgetMax: number;
}

interface MembersBudgetsData {
  currentUserMemberId: string | null;
  groupBudgetMin: number;
  groupBudgetMax: number;
  membersBudgets: MemberBudgetData[];
  totalMembers: number;
}

interface GroupData {
  budgetMin?: number;
  budgetMax?: number;
}

interface MyPreferencesTabProps {
  /**
   * Group data with budget defaults
   */
  group: GroupData | null;
  /**
   * Group ID for query invalidation
   */
  groupId: string;
  /**
   * Members budget data for influence visualization
   */
  membersBudgetsData: MembersBudgetsData | null | undefined;
  /**
   * Members availability data for heatmap
   */
  membersAvailabilityData: MembersAvailabilityData | null | undefined;
  /**
   * Current budget override state
   */
  myPreferencesBudget: BudgetRange | null;
  /**
   * Callback to update budget state
   */
  setMyPreferencesBudget: (budget: BudgetRange | null) => void;
  /**
   * Current category preferences override
   */
  myPreferencesCategories: string[] | null;
  /**
   * Callback to update categories state
   */
  setMyPreferencesCategories: (categories: string[] | null) => void;
  /**
   * Current availability override
   */
  myPreferencesAvailability: AvailabilityGridType | null;
  /**
   * Callback to update availability state
   */
  setMyPreferencesAvailability: (availability: AvailabilityGridType | null) => void;
  /**
   * Current meeting frequency override
   */
  myPreferencesMeetingFrequency: MeetingFrequency | null;
  /**
   * Callback to update meeting frequency state
   */
  setMyPreferencesMeetingFrequency: (frequency: MeetingFrequency | null) => void;
  /**
   * Original meeting frequency string (for preserving legacy values)
   */
  myPreferencesMeetingFrequencyOriginal: string | null;
  /**
   * Callback to update original frequency string
   */
  setMyPreferencesMeetingFrequencyOriginal: (value: string | null) => void;
  /**
   * Mutation to save preferences
   */
  onSavePreferences: (data: {
    budgetOverrideMin?: number | null;
    budgetOverrideMax?: number | null;
    categoryPreferencesOverride?: string[] | null;
    availabilityOverride?: AvailabilityGridType | null;
    meetingFrequencyOverride?: string | null;
  }) => void;
  /**
   * Whether save mutation is pending
   */
  isSaving: boolean;
  /**
   * Query client for invalidation
   */
  queryClient: {
    invalidateQueries: (options: { queryKey: unknown[] }) => void;
  };
}

// ========== COMPONENT ==========

export function MyPreferencesTab({
  group,
  groupId,
  membersBudgetsData,
  membersAvailabilityData,
  myPreferencesBudget,
  setMyPreferencesBudget,
  myPreferencesCategories,
  setMyPreferencesCategories,
  myPreferencesAvailability,
  setMyPreferencesAvailability,
  myPreferencesMeetingFrequency,
  setMyPreferencesMeetingFrequency,
  myPreferencesMeetingFrequencyOriginal,
  setMyPreferencesMeetingFrequencyOriginal,
  onSavePreferences,
  isSaving,
  queryClient,
}: MyPreferencesTabProps) {
  const handleSave = () => {
    // Use original value if it exists (hasn't been edited), otherwise serialize current state
    let frequencyValue = null;
    if (myPreferencesMeetingFrequency) {
      if (myPreferencesMeetingFrequencyOriginal) {
        // User hasn't edited, preserve original format (including legacy values like "flexible")
        frequencyValue = myPreferencesMeetingFrequencyOriginal;
      } else {
        // User has edited, use new serialized format
        frequencyValue = `${myPreferencesMeetingFrequency.number}x ${myPreferencesMeetingFrequency.unit.replace(/s$/, "")}`;
      }
    }

    onSavePreferences({
      budgetOverrideMin: myPreferencesBudget?.min,
      budgetOverrideMax: myPreferencesBudget?.max,
      categoryPreferencesOverride: myPreferencesCategories,
      availabilityOverride: myPreferencesAvailability,
      meetingFrequencyOverride: frequencyValue,
    });
  };

  return (
    <TabsContent value="my-preferences" className="space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-purple-500/20">
          <CardHeader className="bg-purple-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-md">
                <UserCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  My Personal Preferences
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                  >
                    Just For Me
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Override group settings with your own preferences. Leave unchecked to use group defaults.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Note */}
            <div className="bg-muted/30 p-3 rounded-md text-sm">
              <div className="flex items-start gap-2">
                <p className="text-muted-foreground flex-1">
                  <strong>Note:</strong> These preferences override the group settings for you. Leave unchecked to use
                  group defaults.
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs" side="left">
                    <p className="text-sm">
                      Your personal preferences only affect AI suggestions <strong>you</strong> generate. For example, if
                      you set your budget to $10-$30 in a group with a $0-$60 default, you'll only see venues in your
                      range—other members will still see the full $0-$60 range.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Budget Section */}
            <div className="space-y-3">
              {membersBudgetsData && membersBudgetsData.currentUserMemberId ? (
                <GroupBudgetInfluence
                  membersBudgets={membersBudgetsData.membersBudgets}
                  currentMemberId={membersBudgetsData.currentUserMemberId}
                  groupBudgetMin={membersBudgetsData.groupBudgetMin}
                  groupBudgetMax={membersBudgetsData.groupBudgetMax}
                  myBudget={myPreferencesBudget}
                  onMyBudgetChange={(budget) => {
                    setMyPreferencesBudget(budget);
                    // Auto-save when budget changes
                    onSavePreferences({
                      budgetOverrideMin: budget?.min ?? null,
                      budgetOverrideMax: budget?.max ?? null,
                    });
                    // Invalidate the members-budgets query to refresh
                    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members-budgets"] });
                  }}
                />
              ) : (
                <>
                  <Label className="text-base font-medium">My Budget (per person)</Label>
                  <div className="flex items-center gap-3 mb-2">
                    <Checkbox
                      checked={myPreferencesBudget !== null}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMyPreferencesBudget({ min: group?.budgetMin || 0, max: group?.budgetMax || 60 });
                        } else {
                          setMyPreferencesBudget(null);
                        }
                      }}
                      data-testid="checkbox-budget-override"
                    />
                    <span className="text-sm">
                      Set a personal budget
                      <span className="text-muted-foreground ml-1">
                        (Group: ${group?.budgetMin}-${group?.budgetMax})
                      </span>
                    </span>
                  </div>
                  {myPreferencesBudget !== null && (
                    <div className="space-y-3">
                      <div className="relative pt-1">
                        <Slider
                          min={0}
                          max={250}
                          step={10}
                          value={[myPreferencesBudget.min, myPreferencesBudget.max]}
                          onValueChange={(vals) => setMyPreferencesBudget({ min: vals[0], max: vals[1] })}
                          className="w-full"
                          data-testid="slider-my-budget"
                        />
                      </div>
                      <div className="text-sm font-medium" data-testid="text-my-budget">
                        ${myPreferencesBudget.min}-
                        {myPreferencesBudget.max >= 200 ? "$200+" : `$${myPreferencesBudget.max}`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Category Preferences Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">My Category Preferences</Label>
              <div className="flex items-center gap-3 mb-2">
                <Checkbox
                  checked={myPreferencesCategories !== null}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setMyPreferencesCategories(["meal", "cafes", "drinks"]);
                    } else {
                      setMyPreferencesCategories(null);
                    }
                  }}
                  data-testid="checkbox-categories-override"
                />
                <span className="text-sm">
                  Customize which categories I prefer
                  <span className="text-muted-foreground ml-1">(Using group categories by default)</span>
                </span>
              </div>
              {myPreferencesCategories !== null && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "meal", label: "Meals", emoji: "🍽️" },
                    { id: "cafes", label: "Cafes", emoji: "☕" },
                    { id: "drinks", label: "Drinks", emoji: "🍺" },
                    { id: "dessert", label: "Dessert", emoji: "🍰" },
                    { id: "experiences", label: "Experiences", emoji: "🎭" },
                  ].map((category) => (
                    <Button
                      key={category.id}
                      type="button"
                      variant={myPreferencesCategories.includes(category.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (myPreferencesCategories.includes(category.id)) {
                          setMyPreferencesCategories(myPreferencesCategories.filter((c) => c !== category.id));
                        } else {
                          setMyPreferencesCategories([...myPreferencesCategories, category.id]);
                        }
                      }}
                      className="gap-1.5"
                      data-testid={`button-my-category-${category.id}`}
                    >
                      <span>{category.emoji}</span>
                      <span>{category.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Availability Section */}
            <div className="space-y-3">
              {membersAvailabilityData && membersAvailabilityData.currentUserMemberId ? (
                <GroupAvailabilityHeatmap
                  membersAvailability={membersAvailabilityData.membersAvailability.map((m) => ({
                    memberId: m.memberId,
                    memberName: m.memberName,
                    availability: m.availability || createEmptyAvailability(),
                  }))}
                  currentMemberId={membersAvailabilityData.currentUserMemberId}
                  myAvailability={myPreferencesAvailability || createEmptyAvailability()}
                  onMyAvailabilityChange={(newAvailability) => {
                    setMyPreferencesAvailability(newAvailability);
                    // Auto-save when availability changes
                    onSavePreferences({
                      availabilityOverride: newAvailability,
                    });
                    // Invalidate the members-availability query to refresh the heatmap
                    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members-availability"] });
                  }}
                  showMemberDetails={true}
                  mobileMode="compact-week"
                />
              ) : (
                <div className="space-y-3">
                  <Label className="text-base font-medium">My Availability</Label>
                  <AvailabilityGrid
                    value={myPreferencesAvailability || createEmptyAvailability()}
                    onChange={setMyPreferencesAvailability}
                  />
                </div>
              )}
            </div>

            {/* Meeting Frequency Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">My Meeting Frequency</Label>
              <div className="flex items-center gap-3 mb-2">
                <Checkbox
                  checked={myPreferencesMeetingFrequency !== null}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setMyPreferencesMeetingFrequency({ number: 1, unit: "weeks" });
                      setMyPreferencesMeetingFrequencyOriginal(null);
                    } else {
                      setMyPreferencesMeetingFrequency(null);
                      setMyPreferencesMeetingFrequencyOriginal(null);
                    }
                  }}
                  data-testid="checkbox-frequency-override"
                />
                <span className="text-sm">
                  Set my preferred meeting frequency
                  <span className="text-muted-foreground ml-1">(Using group frequency by default)</span>
                </span>
              </div>
              {myPreferencesMeetingFrequency !== null && (
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min="1"
                    value={myPreferencesMeetingFrequency.number}
                    onChange={(e) => {
                      setMyPreferencesMeetingFrequency({
                        ...myPreferencesMeetingFrequency,
                        number: parseInt(e.target.value) || 1,
                      });
                      setMyPreferencesMeetingFrequencyOriginal(null);
                    }}
                    className="w-20"
                    data-testid="input-my-frequency-number"
                  />
                  <Select
                    value={myPreferencesMeetingFrequency.unit}
                    onValueChange={(value) => {
                      setMyPreferencesMeetingFrequency({
                        ...myPreferencesMeetingFrequency,
                        unit: value,
                      });
                      setMyPreferencesMeetingFrequencyOriginal(null);
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-my-frequency-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                      <SelectItem value="months">months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-my-preferences">
                {isSaving ? "Saving..." : "Save My Preferences"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
