/**
 * ActivityPreferencesAccordion
 * Collapsible accordion section for configuring group activity preferences.
 * Includes novelty slider, category toggles, and preference textareas.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Target } from "lucide-react";

// ========== TYPES ==========

interface CategoryState {
  mealEnabled?: boolean;
  cafeEnabled?: boolean;
  drinksEnabled?: boolean;
  dessertEnabled?: boolean;
  experiencesEnabled?: boolean;
  pastPreferences: string;
  additionalInstructions: string;
}

interface ActivityPreferencesAccordionProps {
  /**
   * Current novelty value (1-5)
   */
  novelty: number;
  /**
   * Callback when novelty changes
   */
  onNoveltyChange: (value: number) => void;
  /**
   * Current category and preference data
   */
  categoryState: CategoryState;
  /**
   * Callback to update category state
   */
  onCategoryStateChange: (updates: Partial<CategoryState>) => void;
  /**
   * Callback to toggle a category on the server
   */
  onToggleCategory: (field: string, value: boolean) => void;
}

// ========== CONSTANTS ==========

const noveltyLabels = [
  "We like our usual spots",
  "Leaning familiar",
  "Open sometimes",
  "Pretty adventurous",
  "Always up for new things!",
];

// ========== COMPONENT ==========

export function ActivityPreferencesAccordion({
  novelty,
  onNoveltyChange,
  categoryState,
  onCategoryStateChange,
  onToggleCategory,
}: ActivityPreferencesAccordionProps) {
  // Build summary text for collapsed state
  const enabledCategories = [
    categoryState.mealEnabled !== false && "Meals",
    categoryState.cafeEnabled !== false && "Cafes",
    categoryState.drinksEnabled !== false && "Drinks",
    categoryState.dessertEnabled !== false && "Dessert",
    categoryState.experiencesEnabled !== false && "Experiences",
  ].filter(Boolean).join(", ");

  return (
    <AccordionItem value="preferences" className="border rounded-lg">
      <Card className="border-0">
        <AccordionTrigger className="px-6 pt-6 pb-2 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-muted rounded-md">
              <Target className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Activity Preferences</CardTitle>
              <CardDescription className="text-xs">
                {noveltyLabels[novelty - 1]} • {enabledCategories}
              </CardDescription>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="space-y-6 pt-2">
            {/* Novelty Slider */}
            <div className="space-y-4">
              <Label className="text-base">How willing is your group to try new things?</Label>
              <div className="space-y-3">
                <div className="text-center text-sm text-muted-foreground">
                  Group Openness to New Experiences
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[novelty]}
                  onValueChange={(value) => onNoveltyChange(value[0])}
                  className="w-full"
                  data-testid="slider-edit-novelty"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>We like our usual spots</span>
                  <span>Open sometimes</span>
                  <span>Always up for new things!</span>
                </div>
              </div>
            </div>

            {/* Category Toggles */}
            <div className="space-y-3">
              <Label className="text-base">What types of activities interest your group?</Label>
              <p className="text-sm text-muted-foreground">
                First, choose which broad categories to enable - AI will only generate suggestions from enabled categories
              </p>

              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                <Label className="text-sm font-semibold">Enable/Disable Activity Categories</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle to control which types of suggestions AI generates
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    type="button"
                    variant={categoryState.mealEnabled !== false ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newValue = categoryState.mealEnabled === false ? true : false;
                      onCategoryStateChange({ mealEnabled: newValue });
                      onToggleCategory("meal_enabled", newValue);
                    }}
                    className="gap-1.5"
                    data-testid="button-toggle-meal"
                  >
                    <span>🍽️</span>
                    <span>Meals</span>
                  </Button>
                  <Button
                    type="button"
                    variant={categoryState.cafeEnabled !== false ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newValue = categoryState.cafeEnabled === false ? true : false;
                      onCategoryStateChange({ cafeEnabled: newValue });
                      onToggleCategory("cafe_enabled", newValue);
                    }}
                    className="gap-1.5"
                    data-testid="button-toggle-cafe"
                  >
                    <span>☕</span>
                    <span>Cafes</span>
                  </Button>
                  <Button
                    type="button"
                    variant={categoryState.drinksEnabled !== false ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newValue = categoryState.drinksEnabled === false ? true : false;
                      onCategoryStateChange({ drinksEnabled: newValue });
                      onToggleCategory("drinks_enabled", newValue);
                    }}
                    className="gap-1.5"
                    data-testid="button-toggle-drinks"
                  >
                    <span>🍺</span>
                    <span>Drinks</span>
                  </Button>
                  <Button
                    type="button"
                    variant={categoryState.dessertEnabled !== false ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newValue = categoryState.dessertEnabled === false ? true : false;
                      onCategoryStateChange({ dessertEnabled: newValue });
                      onToggleCategory("dessert_enabled", newValue);
                    }}
                    className="gap-1.5"
                    data-testid="button-toggle-dessert"
                  >
                    <span>🍰</span>
                    <span>Dessert</span>
                  </Button>
                  <Button
                    type="button"
                    variant={categoryState.experiencesEnabled !== false ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newValue = categoryState.experiencesEnabled === false ? true : false;
                      onCategoryStateChange({ experiencesEnabled: newValue });
                      onToggleCategory("experiences_enabled", newValue);
                    }}
                    className="gap-1.5"
                    data-testid="button-toggle-experiences"
                  >
                    <span>🎭</span>
                    <span>Experiences</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Past Preferences */}
            <div className="space-y-2">
              <Label htmlFor="edit-past-preferences">What Has Your Group Enjoyed in the Past?</Label>
              <Textarea
                id="edit-past-preferences"
                value={categoryState.pastPreferences}
                onChange={(e) => onCategoryStateChange({ pastPreferences: e.target.value })}
                placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                className="resize-none h-24"
                data-testid="textarea-edit-past-preferences"
              />
            </div>

            {/* Additional Instructions */}
            <div className="space-y-2">
              <Label htmlFor="edit-additional-instructions">Anything else we should know? (Optional)</Label>
              <Textarea
                id="edit-additional-instructions"
                value={categoryState.additionalInstructions}
                onChange={(e) => onCategoryStateChange({ additionalInstructions: e.target.value })}
                placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating, avoid crowded places..."
                className="resize-none h-24"
                data-testid="textarea-edit-additional-instructions"
              />
            </div>
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
