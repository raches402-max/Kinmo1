/**
 * ColorPaletteSelector
 * A collapsible color picker with a curated palette of colors.
 * Shows the current color and name, expandable to show full palette.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ========== TYPES ==========

interface ColorOption {
  hex: string;
  name: string;
}

interface ColorPaletteSelectorProps {
  /**
   * Currently selected color (hex)
   */
  value: string;
  /**
   * Callback when color is selected
   */
  onChange: (color: string) => void;
  /**
   * Label for the field
   */
  label?: string;
}

// ========== CONSTANTS ==========

/**
 * Curated palette with good variety - no duplicates
 */
const COLOR_PALETTE: ColorOption[] = [
  // Row 1: Warm spectrum
  { hex: '#E07A5F', name: 'Terracotta' },
  { hex: '#E63946', name: 'Coral' },
  { hex: '#F72585', name: 'Magenta' },
  { hex: '#C9ADA7', name: 'Dusty Rose' },
  { hex: '#E6B89C', name: 'Peach' },
  { hex: '#F4A261', name: 'Marigold' },
  { hex: '#EAB308', name: 'Sunflower' },
  { hex: '#FACC15', name: 'Lemon' },
  // Row 2: Earth & greens
  { hex: '#BC6C25', name: 'Caramel' },
  { hex: '#9C6644', name: 'Copper' },
  { hex: '#78716C', name: 'Stone' },
  { hex: '#606C38', name: 'Olive' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Emerald' },
  { hex: '#2A9D8F', name: 'Teal' },
  { hex: '#14B8A6', name: 'Mint' },
  // Row 3: Blues & purples
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#0EA5E9', name: 'Sky' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#1D3557', name: 'Navy' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#7209B7', name: 'Grape' },
  // Row 4: Neutrals & darks
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#6B5B6E', name: 'Plum' },
  { hex: '#64748B', name: 'Slate' },
  { hex: '#475569', name: 'Charcoal' },
  { hex: '#1F2937', name: 'Graphite' },
  { hex: '#0F172A', name: 'Midnight' },
  { hex: '#44403C', name: 'Espresso' },
  { hex: '#292524', name: 'Coal' },
];

// ========== COMPONENT ==========

export function ColorPaletteSelector({
  value,
  onChange,
  label = "Group Color",
}: ColorPaletteSelectorProps) {
  const currentColor = value || "#6B5B6E";
  const currentColorName = COLOR_PALETTE.find(
    (c) => c.hex.toUpperCase() === currentColor.toUpperCase()
  )?.name || 'Custom';

  return (
    <div className="space-y-2">
      <Collapsible>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border-2 border-background shadow-sm"
                style={{ backgroundColor: currentColor }}
              />
              <span className="text-sm text-muted-foreground">{currentColorName}</span>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Change
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-8 gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() => onChange(color.hex)}
                className={`w-8 h-8 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                  currentColor.toUpperCase() === color.hex.toUpperCase()
                    ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                    : ''
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                data-testid={`color-swatch-${color.hex.slice(1)}`}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export { COLOR_PALETTE };
