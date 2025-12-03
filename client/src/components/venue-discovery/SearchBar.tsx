/**
 * SearchBar - Unified search input with location controls and category chips
 */

import { useState } from "react";
import { Search, MapPin, Settings2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG, CategoryId } from "./VenueCard";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  location: string;
  onLocationChange: (location: string) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  showCategoryChips?: boolean;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  location,
  onLocationChange,
  radius,
  onRadiusChange,
  selectedCategory,
  onCategoryChange,
  showCategoryChips = true,
  placeholder = "Search venues or describe what you're looking for...",
  className,
}: SearchBarProps) {
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [tempLocation, setTempLocation] = useState(location);
  const [tempRadius, setTempRadius] = useState(radius);

  const handleApplySettings = () => {
    onLocationChange(tempLocation);
    onRadiusChange(tempRadius);
    setShowLocationSettings(false);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 h-11 bg-card border-card-border"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Location bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span className="truncate flex-1">
          {location || "Set location"}
        </span>
        <span>•</span>
        <span>{radius} mi</span>
        <Popover open={showLocationSettings} onOpenChange={setShowLocationSettings}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 min-w-[32px]"
              aria-label="Location settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="City, neighborhood, or address"
                  value={tempLocation}
                  onChange={(e) => setTempLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Search Radius</Label>
                  <span className="text-sm text-muted-foreground">{tempRadius} miles</span>
                </div>
                <Slider
                  value={[tempRadius]}
                  onValueChange={([v]) => setTempRadius(v)}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
              <Button className="w-full" size="sm" onClick={handleApplySettings}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Category chips */}
      {showCategoryChips && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.entries(CATEGORY_CONFIG) as [CategoryId, typeof CATEGORY_CONFIG[CategoryId]][]).map(([id, config]) => (
            <Button
              key={id}
              variant={selectedCategory === id ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-shrink-0 gap-1.5 transition-all",
                selectedCategory === id && "shadow-sm"
              )}
              style={selectedCategory === id ? {
                backgroundColor: config.color,
                borderColor: config.color,
                color: 'white'
              } : undefined}
              onClick={() => onCategoryChange(selectedCategory === id ? null : id)}
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
