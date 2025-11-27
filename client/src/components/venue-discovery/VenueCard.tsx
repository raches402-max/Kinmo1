/**
 * VenueCard - Unified venue card component for discovery module
 *
 * Consolidates venue card rendering from VenuePreviewModal, VenueLibraryContent,
 * and Activities tab into a single, consistent component.
 */

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, ExternalLink, Check, Plus, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// Unified venue interface that works across all contexts
export interface VenueData {
  id: string;
  name: string;
  address: string;
  photoUrl?: string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  priceLevel?: number | string | null;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
  category?: string;
  venueType?: string;
  badges?: string[];
  source?: 'favorite' | 'suggestion' | 'search';
}

// Category configuration with colors matching the warm palette
export const CATEGORY_CONFIG = {
  meal: { label: "Meals", emoji: "🍽️", color: "hsl(16, 70%, 50%)" },
  cafes: { label: "Cafes", emoji: "☕", color: "hsl(30, 65%, 48%)" },
  drinks: { label: "Drinks", emoji: "🍺", color: "hsl(350, 45%, 60%)" },
  dessert: { label: "Dessert", emoji: "🍰", color: "hsl(340, 55%, 65%)" },
  experiences: { label: "Fun", emoji: "🎭", color: "hsl(145, 30%, 50%)" },
} as const;

export type CategoryId = keyof typeof CATEGORY_CONFIG;

interface VenueCardProps {
  venue: VenueData;
  isSelected?: boolean;
  onToggle?: () => void;
  showSource?: boolean;
  selectionMode?: 'checkbox' | 'heart' | 'none';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function VenueCardComponent({
  venue,
  isSelected = false,
  onToggle,
  showSource = false,
  selectionMode = 'checkbox',
  size = 'md',
  className,
}: VenueCardProps) {
  // Construct Google Maps URL with fallbacks
  const googleMapsUrl = venue.googleMapsUrl ||
    (venue.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.address}`)}`
    );

  // Parse rating to number for display
  const ratingNum = venue.rating
    ? (typeof venue.rating === 'string' ? parseFloat(venue.rating) : venue.rating)
    : null;

  // Parse price level
  const priceLevel = venue.priceLevel
    ? (typeof venue.priceLevel === 'string' ? parseInt(venue.priceLevel) : venue.priceLevel)
    : null;

  // Get category emoji for placeholder
  const categoryEmoji = venue.category && CATEGORY_CONFIG[venue.category as CategoryId]
    ? CATEGORY_CONFIG[venue.category as CategoryId].emoji
    : "📍";

  // Size variants
  const sizeConfig = {
    sm: {
      card: "w-36",
      image: "aspect-[4/3]",
      padding: "p-2",
      title: "text-sm font-medium",
      subtitle: "text-xs",
      icon: "h-3 w-3",
    },
    md: {
      card: "w-44",
      image: "aspect-[4/3]",
      padding: "p-3",
      title: "text-sm font-semibold",
      subtitle: "text-xs",
      icon: "h-3.5 w-3.5",
    },
    lg: {
      card: "",
      image: "aspect-video",
      padding: "p-4",
      title: "text-base font-semibold",
      subtitle: "text-sm",
      icon: "h-4 w-4",
    },
  };

  const config = sizeConfig[size];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 group cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected && "ring-2 ring-primary shadow-md",
        config.card,
        className
      )}
      onClick={onToggle}
    >
      {/* Selection indicator */}
      {selectionMode !== 'none' && onToggle && (
        <div
          className={cn(
            "absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-background/80 backdrop-blur-sm border opacity-0 group-hover:opacity-100"
          )}
        >
          {selectionMode === 'heart' ? (
            <Heart className={cn("h-3.5 w-3.5", isSelected && "fill-current")} />
          ) : isSelected ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </div>
      )}

      {/* Image */}
      <div className={cn(config.image, "relative bg-muted overflow-hidden")}>
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-muted to-muted/50">
            {categoryEmoji}
          </div>
        )}

        {/* Source badge */}
        {showSource && venue.source === 'favorite' && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm text-xs"
          >
            <Heart className="h-3 w-3 mr-1 fill-current text-rose-500" />
            Favorite
          </Badge>
        )}
      </div>

      {/* Content */}
      <CardContent className={cn(config.padding, "space-y-1")}>
        <div className="flex items-start gap-1.5">
          <h4 className={cn(config.title, "truncate flex-1")}>{venue.name}</h4>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(googleMapsUrl, "_blank");
            }}
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
            title="View on Google Maps"
          >
            <ExternalLink className={config.icon} />
          </button>
        </div>

        <p className={cn(config.subtitle, "text-muted-foreground truncate flex items-center gap-1")}>
          <MapPin className={cn(config.icon, "flex-shrink-0")} />
          <span className="truncate">{venue.address}</span>
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {ratingNum && (
            <span className="flex items-center text-xs gap-0.5">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="font-medium">{ratingNum.toFixed(1)}</span>
              {venue.reviewCount && (
                <span className="text-muted-foreground">
                  ({typeof venue.reviewCount === 'string'
                    ? parseInt(venue.reviewCount).toLocaleString()
                    : venue.reviewCount.toLocaleString()})
                </span>
              )}
            </span>
          )}
          {priceLevel && priceLevel > 0 && (
            <span className="text-xs text-muted-foreground">
              {'$'.repeat(priceLevel)}
            </span>
          )}
        </div>

        {/* Learning badges */}
        {venue.badges && venue.badges.length > 0 && size === 'lg' && (
          <div className="flex flex-wrap gap-1 mt-1">
            {venue.badges.slice(0, 3).map((badge, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const VenueCard = memo(VenueCardComponent);
export default VenueCard;
