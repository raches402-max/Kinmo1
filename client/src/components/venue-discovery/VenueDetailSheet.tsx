/**
 * VenueDetailSheet - Full venue details with vote toggle
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MapPin,
  Star,
  ExternalLink,
  Navigation,
  Clock,
  Phone,
  Globe,
  Loader2,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VenueData, CATEGORY_CONFIG, CategoryId } from "./VenueCard";
import { cn } from "@/lib/utils";

interface VenueDetailSheetProps {
  venue: VenueData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  currentUserId?: string;
}

interface VoteResponse {
  id: number;
  eventId: number;
  odooMemberId: number;
  voteType: "upvote" | "downvote";
}

export function VenueDetailSheet({
  venue,
  open,
  onOpenChange,
  groupId,
  currentUserId,
}: VenueDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if current user has voted on this venue
  const { data: userVote, isLoading: voteLoading } = useQuery<VoteResponse | null>({
    queryKey: [`/api/voting-events/${venue?.id}/my-vote`],
    queryFn: async () => {
      try {
        return await apiRequest("GET", `/api/voting-events/${venue?.id}/my-vote`);
      } catch {
        return null;
      }
    },
    enabled: open && !!venue?.id,
  });

  const hasVoted = !!userVote;

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/voting-events/${venue?.id}/vote`, {
        voteType: "upvote",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/voting-events/${venue?.id}/my-vote`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
      toast({
        title: "Voted!",
        description: `You liked ${venue?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cast vote",
        variant: "destructive",
      });
    },
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/voting-events/${venue?.id}/vote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/voting-events/${venue?.id}/my-vote`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
      toast({
        title: "Vote removed",
        description: `You unliked ${venue?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove vote",
        variant: "destructive",
      });
    },
  });

  // Delete venue from favorites mutation
  const deleteVenueMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/voting-events/${venue?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
      toast({
        title: "Venue removed",
        description: `${venue?.name} has been removed from your library`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove venue. You may not have permission to delete this venue.",
        variant: "destructive",
      });
    },
  });

  const handleVoteToggle = () => {
    if (hasVoted) {
      removeVoteMutation.mutate();
    } else {
      voteMutation.mutate();
    }
  };

  const isVoting = voteMutation.isPending || removeVoteMutation.isPending;

  if (!venue) return null;

  // Parse rating/price
  const ratingNum = venue.rating
    ? typeof venue.rating === "string"
      ? parseFloat(venue.rating)
      : venue.rating
    : null;

  const priceLevel = venue.priceLevel
    ? typeof venue.priceLevel === "string"
      ? parseInt(venue.priceLevel)
      : venue.priceLevel
    : null;

  // Construct URLs
  const googleMapsUrl =
    venue.googleMapsUrl ||
    (venue.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${venue.name} ${venue.address}`
        )}`);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue.address || venue.name
  )}${venue.googlePlaceId ? `&destination_place_id=${venue.googlePlaceId}` : ""}`;

  // Category info
  const categoryConfig = venue.category
    ? CATEGORY_CONFIG[venue.category as CategoryId]
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 overflow-hidden">
        {/* Hero Image */}
        <div className="relative h-48 bg-muted">
          {venue.photoUrl ? (
            <img
              src={venue.photoUrl}
              alt={venue.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-muted to-muted/50">
              {categoryConfig?.emoji || "📍"}
            </div>
          )}

          {/* Category badge */}
          {categoryConfig && (
            <Badge
              variant="secondary"
              className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm"
            >
              {categoryConfig.emoji} {categoryConfig.label}
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-12rem)]">
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-xl">{venue.name}</SheetTitle>
            {venue.venueType && (
              <SheetDescription className="capitalize">
                {venue.venueType.replace(/-/g, " ")}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Rating & Price */}
          <div className="flex items-center gap-4">
            {ratingNum && (
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <span className="font-semibold">{ratingNum.toFixed(1)}</span>
                {venue.reviewCount && (
                  <span className="text-muted-foreground text-sm">
                    (
                    {typeof venue.reviewCount === "string"
                      ? parseInt(venue.reviewCount).toLocaleString()
                      : venue.reviewCount.toLocaleString()}{" "}
                    reviews)
                  </span>
                )}
              </div>
            )}
            {priceLevel && priceLevel > 0 && (
              <Badge variant="outline" className="text-sm">
                {"$".repeat(priceLevel)}
              </Badge>
            )}
          </div>

          {/* Liked by */}
          {venue.likedBy && venue.likedBy.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-500 flex-shrink-0" />
              <span className="text-sm">
                Liked by{" "}
                <span className="font-medium">
                  {venue.likedBy.length === 1
                    ? venue.likedBy[0]
                    : venue.likedBy.length === 2
                    ? `${venue.likedBy[0]} and ${venue.likedBy[1]}`
                    : `${venue.likedBy.slice(0, 2).join(", ")} and ${
                        venue.likedBy.length - 2
                      } others`}
                </span>
              </span>
            </div>
          )}

          {/* Address & Actions */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">{venue.address}</p>
              </div>
            </div>

            {/* Map Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => window.open(googleMapsUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                View on Maps
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => window.open(directionsUrl, "_blank")}
              >
                <Navigation className="h-4 w-4" />
                Directions
              </Button>
            </div>
          </div>

          {/* Vote Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleVoteToggle}
              disabled={isVoting || voteLoading}
              variant={hasVoted ? "secondary" : "default"}
              className={cn(
                "w-full gap-2 h-12 text-base",
                hasVoted && "bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300"
              )}
            >
              {isVoting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Heart className={cn("h-5 w-5", hasVoted && "fill-current")} />
              )}
              {hasVoted ? "Unlike this venue" : "Like this venue"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {hasVoted
                ? "Remove your vote to stop showing interest"
                : "Show your group you're interested in this spot"}
            </p>
          </div>

          {/* Delete Button - subtle at bottom */}
          <div className="pt-4 border-t">
            <Button
              onClick={() => deleteVenueMutation.mutate()}
              disabled={deleteVenueMutation.isPending}
              variant="ghost"
              className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              {deleteVenueMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove from library
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default VenueDetailSheet;
