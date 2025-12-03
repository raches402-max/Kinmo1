/**
 * PlacesSwipeFlow - Swipe through unreviewed venues from your groups
 *
 * Flow:
 * 1. Group intro card (gate) - swipe right to start, left to skip group
 * 2. Up to 5 venue cards for that group
 * 3. Next group intro card (gate) - swipe right to continue, left to finish
 * 4. Repeat until done or user exits
 * 5. "All caught up" completion screen
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  X,
  Star,
  MapPin,
  ExternalLink,
  Users,
  ChevronRight,
  Sparkles,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types
interface SwipeVenue {
  id: string;
  title: string;
  venueAddress?: string;
  venueType?: string;
  googlePlaceId?: string;
  rating?: string;
  reviewCount?: number;
  priceLevel?: string;
  photoUrl?: string;
  addedBy?: string;
  likedBy?: string[];
  likedByCount?: number;
}

interface GroupQueue {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  memberNames: string[];
  memberCount: number;
  venues: SwipeVenue[];
  totalUnreviewed: number;
}

interface PlacesSwipeQueueResponse {
  groups: GroupQueue[];
  totalUnreviewed: number;
  totalGroups: number;
}

interface PlacesSwipeFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Constants
const VENUES_PER_GROUP = 10; // Cap at 10 per group, remaining show up next session

// Helper to format price level
const formatPriceLevel = (level?: string | number | null) => {
  if (!level) return null;
  const num = typeof level === "string" ? parseInt(level) : level;
  return "$".repeat(num);
};

// Swipeable Card Component
function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
}: {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  // Visual indicators for swipe direction
  const leftIndicatorOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

  function handleDragEnd(_: any, info: PanInfo) {
    if (disabled) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Strong swipe or drag beyond threshold
    if (Math.abs(offset) > 100 || Math.abs(velocity) > 500) {
      if (offset > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      {/* Swipe indicators */}
      <motion.div
        style={{ opacity: leftIndicatorOpacity }}
        className="absolute top-4 left-4 z-10 bg-red-500 text-white rounded-full p-3"
      >
        <X className="h-6 w-6" />
      </motion.div>
      <motion.div
        style={{ opacity: rightIndicatorOpacity }}
        className="absolute top-4 right-4 z-10 bg-green-500 text-white rounded-full p-3"
      >
        <Heart className="h-6 w-6" />
      </motion.div>

      {children}
    </motion.div>
  );
}

// Group Intro Card (Gate)
function GroupIntroCard({
  group,
  isFirst,
  onSwipeLeft,
  onSwipeRight,
}: {
  group: GroupQueue;
  isFirst: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  return (
    <SwipeableCard onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
      <Card className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
        {/* Group emoji */}
        <div className="text-6xl mb-4">{group.groupEmoji}</div>

        {/* Group name */}
        <h2 className="text-2xl font-bold text-center mb-2">{group.groupName}</h2>

        {/* Member names */}
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            {group.memberNames.length > 0
              ? group.memberNames.slice(0, 3).join(", ") +
                (group.memberNames.length > 3
                  ? ` +${group.memberNames.length - 3} more`
                  : "")
              : `${group.memberCount} members`}
          </span>
        </div>

        {/* Venue count */}
        <Badge variant="secondary" className="text-base px-4 py-1 mb-6">
          {group.totalUnreviewed} venue{group.totalUnreviewed !== 1 ? "s" : ""} to review
        </Badge>

        {/* Instructions */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 text-green-600">
              <ChevronRight className="h-4 w-4" />
              Swipe right
            </span>
            to start swiping
          </p>
          <p className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 text-red-500">
              <X className="h-4 w-4" />
              Swipe left
            </span>
            {isFirst ? "to skip this group" : "to finish"}
          </p>
        </div>

        {/* Action buttons for accessibility */}
        <div className="flex gap-4 mt-6">
          <Button
            variant="outline"
            size="lg"
            onClick={onSwipeLeft}
            className="gap-2"
          >
            <X className="h-5 w-5" />
            {isFirst ? "Skip" : "Done"}
          </Button>
          <Button size="lg" onClick={onSwipeRight} className="gap-2">
            <Heart className="h-5 w-5" />
            Start
          </Button>
        </div>
      </Card>
    </SwipeableCard>
  );
}

// Venue Card for swiping
function VenueSwipeCard({
  venue,
  groupName,
  onSwipeLeft,
  onSwipeRight,
}: {
  venue: SwipeVenue;
  groupName: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  // Generate Google Maps URL
  const getGoogleMapsUrl = () => {
    if (venue.googlePlaceId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        venue.title || "Location"
      )}&query_place_id=${venue.googlePlaceId}`;
    } else if (venue.venueAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        venue.venueAddress
      )}`;
    }
    return null;
  };

  const mapsUrl = getGoogleMapsUrl();

  const formatLikedBy = () => {
    if (!venue.likedBy || venue.likedBy.length === 0) return null;

    if (venue.likedBy.length === 1) {
      return `${venue.likedBy[0]} likes this`;
    } else if (venue.likedBy.length === 2) {
      return `${venue.likedBy[0]} and ${venue.likedBy[1]} like this`;
    } else {
      return `${venue.likedBy[0]}, ${venue.likedBy[1]} +${
        venue.likedByCount! - 2
      } like this`;
    }
  };

  return (
    <SwipeableCard onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
      <Card className="h-full flex flex-col overflow-hidden">
        {/* Image */}
        <div className="relative h-[45%] bg-muted">
          {venue.photoUrl ? (
            <img
              src={venue.photoUrl}
              alt={venue.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <MapPin className="h-16 w-16 text-muted-foreground/50" />
            </div>
          )}

          {/* Group badge */}
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm"
          >
            {groupName}
          </Badge>

          {/* Added by badge */}
          {venue.addedBy && (
            <Badge
              variant="outline"
              className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm"
            >
              Added by {venue.addedBy}
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="text-xl font-bold mb-1">{venue.title}</h3>

          {venue.venueType && (
            <p className="text-sm text-muted-foreground mb-2 capitalize">
              {venue.venueType.replace(/-/g, " ")}
            </p>
          )}

          {/* Rating & Price */}
          <div className="flex items-center gap-3 mb-3">
            {venue.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{venue.rating}</span>
                {venue.reviewCount && (
                  <span className="text-muted-foreground text-sm">
                    ({venue.reviewCount.toLocaleString()})
                  </span>
                )}
              </span>
            )}
            {venue.priceLevel && (
              <span className="text-muted-foreground">
                {formatPriceLevel(venue.priceLevel)}
              </span>
            )}
          </div>

          {/* Address */}
          {venue.venueAddress && mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
            >
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{venue.venueAddress}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          )}

          {/* Liked by */}
          {formatLikedBy() && (
            <div className="flex items-center gap-2 text-sm text-rose-600 mt-auto">
              <Heart className="h-4 w-4 fill-current" />
              <span>{formatLikedBy()}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 gap-2"
              onClick={onSwipeLeft}
            >
              <X className="h-5 w-5" />
              Pass
            </Button>
            <Button size="lg" className="flex-1 gap-2" onClick={onSwipeRight}>
              <Heart className="h-5 w-5" />
              Like
            </Button>
          </div>
        </div>
      </Card>
    </SwipeableCard>
  );
}

// Completion Screen
function CompletionScreen({
  stats,
  onDone,
}: {
  stats: { venuesReviewed: number; groupsCompleted: number; liked: number };
  onDone: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
        <Check className="h-10 w-10 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold mb-2">All caught up!</h2>

      <p className="text-muted-foreground mb-6">
        You reviewed {stats.venuesReviewed} venue{stats.venuesReviewed !== 1 ? "s" : ""}{" "}
        {stats.groupsCompleted > 0 && (
          <>across {stats.groupsCompleted} group{stats.groupsCompleted !== 1 ? "s" : ""}</>
        )}
      </p>

      {stats.liked > 0 && (
        <Badge variant="secondary" className="mb-6 text-base px-4 py-1">
          <Heart className="h-4 w-4 mr-2 fill-current text-rose-500" />
          {stats.liked} liked
        </Badge>
      )}

      <Button size="lg" onClick={onDone} className="gap-2">
        <Sparkles className="h-5 w-5" />
        Browse Places
      </Button>
    </div>
  );
}

// Main Component
export function PlacesSwipeFlow({ onComplete, onSkip }: PlacesSwipeFlowProps) {
  const { toast } = useToast();

  // Fetch the swipe queue
  const { data, isLoading } = useQuery<PlacesSwipeQueueResponse>({
    queryKey: ["/api/user/places-swipe-queue"],
    queryFn: () => apiRequest("GET", "/api/user/places-swipe-queue"),
  });

  // State for tracking progress
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentVenueIndex, setCurrentVenueIndex] = useState(0);
  const [showGroupIntro, setShowGroupIntro] = useState(true);
  const [stats, setStats] = useState({ venuesReviewed: 0, groupsCompleted: 0, liked: 0 });
  const [isComplete, setIsComplete] = useState(false);

  // Upvote mutation
  const upvoteMutation = useMutation({
    mutationFn: async (venueId: string) => {
      return apiRequest("POST", `/api/voting-events/${venueId}/vote`, {
        voteType: "upvote",
      });
    },
    onSuccess: () => {
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["/api/user/places-swipe-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/all-places"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your vote",
        variant: "destructive",
      });
    },
  });

  // Downvote/pass mutation (to track that user has seen it)
  const passMutation = useMutation({
    mutationFn: async (venueId: string) => {
      return apiRequest("POST", `/api/voting-events/${venueId}/vote`, {
        voteType: "downvote",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/places-swipe-queue"] });
    },
  });

  const groups = data?.groups || [];
  const currentGroup = groups[currentGroupIndex];
  const currentVenue = currentGroup?.venues[currentVenueIndex];

  // Handle group intro swipe
  const handleGroupIntroSwipeRight = useCallback(() => {
    // Start swiping venues in this group
    setShowGroupIntro(false);
  }, []);

  const handleGroupIntroSwipeLeft = useCallback(() => {
    // Skip to next group or finish
    if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentVenueIndex(0);
      setShowGroupIntro(true);
    } else {
      // All done
      setIsComplete(true);
    }
  }, [currentGroupIndex, groups.length]);

  // Handle venue swipe
  const handleVenueSwipeRight = useCallback(() => {
    if (!currentVenue || !currentGroup) return;

    // Like the venue
    upvoteMutation.mutate(currentVenue.id);
    setStats((prev) => ({
      ...prev,
      venuesReviewed: prev.venuesReviewed + 1,
      liked: prev.liked + 1,
    }));

    moveToNextVenue();
  }, [currentVenue, currentGroup]);

  const handleVenueSwipeLeft = useCallback(() => {
    if (!currentVenue || !currentGroup) return;

    // Pass on the venue (record as seen via downvote)
    passMutation.mutate(currentVenue.id);
    setStats((prev) => ({
      ...prev,
      venuesReviewed: prev.venuesReviewed + 1,
    }));

    moveToNextVenue();
  }, [currentVenue, currentGroup]);

  const moveToNextVenue = useCallback(() => {
    if (!currentGroup) return;

    const nextVenueIndex = currentVenueIndex + 1;
    // Cap at VENUES_PER_GROUP (10) - venues per group are already capped in the data
    const maxVenuesForGroup = Math.min(currentGroup.venues.length, VENUES_PER_GROUP);

    // Check if we've finished this group's batch
    if (nextVenueIndex >= maxVenuesForGroup) {
      // Move to next group
      setStats((prev) => ({
        ...prev,
        groupsCompleted: prev.groupsCompleted + 1,
      }));

      if (currentGroupIndex < groups.length - 1) {
        setCurrentGroupIndex((prev) => prev + 1);
        setCurrentVenueIndex(0);
        setShowGroupIntro(true);
      } else {
        // All done!
        setIsComplete(true);
      }
    } else {
      // Continue with next venue in this group
      setCurrentVenueIndex(nextVenueIndex);
    }
  }, [currentGroup, currentVenueIndex, currentGroupIndex, groups.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // No venues to review
  if (!data || data.totalUnreviewed === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">You're all caught up!</h2>
        <p className="text-muted-foreground mb-6">
          No new venues to review from your groups
        </p>
        <Button onClick={onSkip}>Browse Places</Button>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    return <CompletionScreen stats={stats} onDone={onComplete} />;
  }

  // Progress indicator - cap display at VENUES_PER_GROUP
  const maxVenuesForGroup = currentGroup
    ? Math.min(currentGroup.venues.length, VENUES_PER_GROUP)
    : 0;

  const progress = currentGroup
    ? {
        groupProgress: `${currentGroupIndex + 1}/${groups.length}`,
        venueProgress: `${currentVenueIndex + 1}/${maxVenuesForGroup}`,
      }
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header with progress */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
        {progress && !showGroupIntro && (
          <div className="text-sm text-muted-foreground">
            {progress.venueProgress} in {currentGroup?.groupName}
          </div>
        )}
        <div className="w-16" /> {/* Spacer for centering */}
      </div>

      {/* Card area */}
      <div className="flex-1 relative p-4">
        <AnimatePresence mode="wait">
          {showGroupIntro && currentGroup ? (
            <GroupIntroCard
              key={`group-${currentGroup.groupId}`}
              group={{
                ...currentGroup,
                // Show up to 10 venues
                totalUnreviewed: Math.min(currentGroup.venues.length, VENUES_PER_GROUP),
              }}
              isFirst={currentGroupIndex === 0}
              onSwipeLeft={handleGroupIntroSwipeLeft}
              onSwipeRight={handleGroupIntroSwipeRight}
            />
          ) : currentVenue && currentGroup ? (
            <VenueSwipeCard
              key={`venue-${currentVenue.id}`}
              venue={currentVenue}
              groupName={currentGroup.groupName}
              onSwipeLeft={handleVenueSwipeLeft}
              onSwipeRight={handleVenueSwipeRight}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default PlacesSwipeFlow;
