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
import { handlePhotoError } from "@/hooks/usePhotoRefresh";

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
  likedBy?: string[];
  likedByCount?: number;
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
  onClick?: () => void;
  showSource?: boolean;
  selectionMode?: 'checkbox' | 'heart' | 'none';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function VenueCardComponent({
  venue,
  isSelected = false,
  onToggle,
  onClick,
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

  // Parse review count
  const reviewCountNum = venue.reviewCount
    ? (typeof venue.reviewCount === 'string' ? parseInt(venue.reviewCount) : venue.reviewCount)
    : null;

  // Extract neighborhood/city from address for compact display
  // Addresses typically look like: "123 Main St, Mission District, San Francisco, CA 94110"
  // We want to show: "Mission District, San Francisco" or "San Francisco, CA"
  const getCompactAddress = (address: string): string => {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // Skip street address, take neighborhood/area and city
      // Filter out zip codes (5 digits or 5+4 format)
      const relevantParts = parts.slice(1).filter(p => !/^\d{5}(-\d{4})?$/.test(p) && !/^[A-Z]{2}\s*\d{5}/.test(p));
      // Take up to 2 parts (neighborhood + city or city + state)
      return relevantParts.slice(0, 2).join(', ');
    } else if (parts.length === 2) {
      return parts.join(', ');
    }
    return address;
  };

  const compactAddress = getCompactAddress(venue.address);

  // Get category emoji for placeholder
  const categoryEmoji = venue.category && CATEGORY_CONFIG[venue.category as CategoryId]
    ? CATEGORY_CONFIG[venue.category as CategoryId].emoji
    : "📍";

  // Size variants
  const sizeConfig = {
    sm: {
      card: "w-28 sm:w-36",
      image: "aspect-[4/3]",
      padding: "p-2",
      title: "text-sm font-medium",
      subtitle: "text-xs",
      icon: "h-3 w-3",
    },
    md: {
      card: "w-32 sm:w-44",
      image: "aspect-[4/3]",
      padding: "p-3",
      title: "text-sm font-semibold",
      subtitle: "text-xs",
      icon: "h-3.5 w-3.5",
    },
    lg: {
      card: "w-full",
      image: "aspect-[4/3]",
      padding: "p-4",
      title: "text-base font-semibold leading-tight",
      subtitle: "text-sm",
      icon: "h-4 w-4",
    },
  };

  const config = sizeConfig[size];

  // Handle card click - prefer onClick, fall back to onToggle
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else if (onToggle) {
      onToggle();
    }
  };

  // Handle selection button click
  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 group cursor-pointer",
        "hover:shadow-warm-lg hover:-translate-y-1",
        "border-border/50 hover:border-border",
        isSelected && "ring-2 ring-primary shadow-warm-lg",
        size === 'lg' && "rounded-xl",
        config.card,
        className
      )}
      onClick={handleCardClick}
    >
      {/* Selection indicator */}
      {selectionMode !== 'none' && onToggle && (
        <button
          type="button"
          onClick={handleSelectionClick}
          aria-label={isSelected ? "Remove from selection" : "Add to selection"}
          className={cn(
            // Improved touch target: min 44x44px with visual indicator at 32px
            "absolute top-1 right-1 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-background/80 backdrop-blur-sm border sm:opacity-0 sm:group-hover:opacity-100"
          )}
        >
          {selectionMode === 'heart' ? (
            <Heart className={cn("h-4 w-4", isSelected && "fill-current")} />
          ) : isSelected ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Image */}
      <div className={cn(config.image, "relative bg-muted overflow-hidden")}>
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => handlePhotoError(venue.googlePlaceId, e.currentTarget)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/20 via-muted to-accent/10">
            <span className={cn(
              "transition-transform duration-300 group-hover:scale-110",
              size === 'lg' ? "text-5xl" : size === 'md' ? "text-3xl" : "text-2xl"
            )}>
              {categoryEmoji}
            </span>
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
        <h4 className={cn(config.title, "truncate")}>{venue.name}</h4>

        {/* Address as clickable Google Maps link */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(googleMapsUrl, "_blank");
          }}
          className={cn(
            config.subtitle,
            "text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-left w-full"
          )}
          title={`${venue.address} — Open in Google Maps`}
        >
          <MapPin className={cn(config.icon, "flex-shrink-0")} />
          <span className="truncate">{compactAddress}</span>
          <ExternalLink className={cn(config.icon, "flex-shrink-0 opacity-50")} />
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {ratingNum && (
            <span className="flex items-center text-xs gap-0.5">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="font-medium">{ratingNum.toFixed(1)}</span>
              {reviewCountNum && reviewCountNum > 0 && (
                <span className="text-muted-foreground">
                  ({reviewCountNum.toLocaleString()})
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

        {/* Liked by */}
        {venue.likedBy && venue.likedBy.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Heart className="h-3 w-3 fill-rose-500 text-rose-500 flex-shrink-0" />
            <span className="truncate">
              {venue.likedBy.length === 1
                ? venue.likedBy[0]
                : venue.likedBy.length === 2
                  ? `${venue.likedBy[0]} & ${venue.likedBy[1]}`
                  : `${venue.likedBy[0]}, ${venue.likedBy[1]} +${venue.likedBy.length - 2}`
              }
            </span>
          </div>
        )}

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
