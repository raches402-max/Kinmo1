import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, Heart, Star, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SwipeVenue {
  id: string;
  title: string;
  description?: string;
  venueAddress?: string;
  venueType?: string;
  googlePlaceId?: string;
  rating?: string;
  reviewCount?: number;
  priceLevel?: string;
  photoUrl?: string;
  sourceType: 'voting_event' | 'ai_suggestion';
  isNew?: boolean;
  likedBy?: string[];
  likedByCount?: number;
}

interface SwipeCardProps {
  venue: SwipeVenue;
  onSwipe: (direction: 'like' | 'pass') => void;
  onSkip: () => void;
}

export function SwipeCard({ venue, onSwipe, onSkip }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  function handleDragEnd(_: any, info: PanInfo) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Strong swipe or drag beyond threshold
    if (Math.abs(offset) > 100 || Math.abs(velocity) > 500) {
      if (offset > 0) {
        onSwipe('like');
      } else {
        onSwipe('pass');
      }
    }
  }

  const formatLikedBy = () => {
    if (!venue.likedBy || venue.likedBy.length === 0) return '';
    
    if (venue.likedBy.length === 1) {
      return `Liked by ${venue.likedBy[0]}`;
    } else if (venue.likedBy.length === 2) {
      return `Liked by ${venue.likedBy[0]} and ${venue.likedBy[1]}`;
    } else {
      return `Liked by ${venue.likedBy[0]}, ${venue.likedBy[1]} and ${venue.likedByCount! - 2} other${venue.likedByCount! - 2 === 1 ? '' : 's'}`;
    }
  };

  return (
    <motion.div
      style={{
        x,
        rotate,
        opacity,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        cursor: 'grab',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
      data-testid="swipe-card"
    >
      <Card className="overflow-hidden border-2 bg-card">
        {/* Venue Photo */}
        {venue.photoUrl ? (
          <div className="w-full h-64 overflow-hidden bg-muted">
            <img
              src={venue.photoUrl}
              alt={venue.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-64 bg-muted flex items-center justify-center">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Venue Info */}
        <div className="p-6 space-y-3">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {venue.isNew && (
              <Badge variant="default" className="gap-1" data-testid="badge-new">
                NEW
              </Badge>
            )}
            {venue.likedBy && venue.likedBy.length > 0 && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-liked-by">
                <Heart className="h-3 w-3 fill-current" />
                {formatLikedBy()}
              </Badge>
            )}
            {venue.rating && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3 fill-current" />
                {venue.rating}
                {venue.reviewCount && ` (${venue.reviewCount})`}
              </Badge>
            )}
          </div>

          {/* Venue Name */}
          <h3 className="text-2xl font-semibold" data-testid="text-venue-name">
            {venue.title}
          </h3>

          {/* Venue Type & Address */}
          <div className="space-y-1">
            {venue.venueType && (
              <p className="text-sm text-muted-foreground capitalize">
                {venue.venueType.replace(/-/g, ' ')}
              </p>
            )}
            {venue.venueAddress && (
              <p className="text-sm text-muted-foreground flex items-start gap-1">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{venue.venueAddress}</span>
              </p>
            )}
          </div>

          {/* Description */}
          {venue.description && (
            <p className="text-sm text-muted-foreground">
              {venue.description}
            </p>
          )}

          {/* Swipe Instructions */}
          <p className="text-sm text-muted-foreground text-center pt-2">
            Swipe right to vote • Swipe left to skip
          </p>
        </div>
      </Card>

      {/* Button fallbacks for non-swipe interaction */}
      <div className="flex justify-center gap-4 mt-6">
        <Button
          size="lg"
          variant="outline"
          onClick={() => onSwipe('pass')}
          className="min-w-[120px]"
          data-testid="button-pass"
        >
          <X className="w-5 h-5 mr-2" />
          Pass
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onSkip}
          className="min-w-[120px]"
          data-testid="button-skip"
        >
          Skip
        </Button>
        <Button
          size="lg"
          variant="default"
          onClick={() => onSwipe('like')}
          className="min-w-[120px]"
          data-testid="button-like"
        >
          <Heart className="w-5 h-5 mr-2" />
          Vote
        </Button>
      </div>
    </motion.div>
  );
}
