/**
 * Mini Swipe Session
 * A compact swipe experience for quick preference gathering
 * Used in AI Setup Wizard to help AI learn user preferences quickly
 */

import { useState, useEffect } from "react";
import { SwipeCard } from "./SwipeCard";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  sourceType: "voting_event" | "ai_suggestion";
  isNew?: boolean;
  likedBy?: string[];
  likedByCount?: number;
  groupId?: string;
}

interface MiniSwipeSessionProps {
  groupId: string;
  maxVenues?: number; // Limit number of venues to swipe (default 8)
  onComplete: () => void; // Called when user finishes swiping
  onSkip: () => void; // Called if user wants to skip
}

export function MiniSwipeSession({
  groupId,
  maxVenues = 8,
  onComplete,
  onSkip,
}: MiniSwipeSessionProps) {
  const [deck, setDeck] = useState<SwipeVenue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [likedCount, setLikedCount] = useState(0);
  const { toast } = useToast();

  const upvoteMutation = useMutation({
    mutationFn: async (venue: SwipeVenue) => {
      // If it's a voting event, upvote it
      if (venue.sourceType === "voting_event") {
        return apiRequest("POST", `/api/voting-events/${venue.id}/vote`, {
          voteType: "upvote",
        });
      }

      // If it's an AI suggestion, create a voting event first, then upvote
      if (venue.sourceType === "ai_suggestion") {
        const result = await apiRequest("POST", `/api/voting-events`, {
          groupId: groupId,
          title: venue.title,
          description: venue.description || "",
          venueAddress: venue.venueAddress || "",
          venueType: venue.venueType || "",
          googlePlaceId: venue.googlePlaceId || "",
          rating: venue.rating || "",
          priceLevel: venue.priceLevel || "",
          photoUrl: venue.photoUrl || "",
          skipEnrichmentCheck: true,
        });

        return apiRequest("POST", `/api/voting-events/${result.event.id}/vote`, {
          voteType: "upvote",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/groups", groupId, "voting-events"],
      });
    },
  });

  useEffect(() => {
    loadDeck();
  }, []);

  async function loadDeck() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/swipe-deck`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load swipe deck");
      }

      const data = await response.json();
      // Limit to maxVenues
      const limitedDeck = (data.deck || []).slice(0, maxVenues);
      setDeck(limitedDeck);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error loading swipe deck:", error);
      toast({
        title: "Error",
        description: "Failed to load venues. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSwipe(direction: "like" | "pass") {
    const venue = deck[currentIndex];
    if (!venue) return;

    if (direction === "like") {
      upvoteMutation.mutate(venue);
      setLikedCount((prev) => prev + 1);
    }

    // Move to next card or complete
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  }

  function handleSkip() {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  }

  function handleComplete() {
    toast({
      title: "Preferences saved!",
      description: `AI learned from ${likedCount} venue${likedCount !== 1 ? "s" : ""} you liked`,
    });
    onComplete();
  }

  const currentVenue = deck[currentIndex];
  const progress = deck.length > 0 ? ((currentIndex + 1) / deck.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Finding venues for you...</p>
      </div>
    );
  }

  if (deck.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-12 w-12 mx-auto text-purple-400 mb-4" />
        <h3 className="font-medium mb-2">No venues to show</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We couldn't find venues to show. Try setting your location first.
        </p>
        <Button onClick={onSkip} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  if (!currentVenue) {
    // All done
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="font-medium mb-2">All done!</h3>
        <p className="text-sm text-muted-foreground mb-4">
          You liked {likedCount} venue{likedCount !== 1 ? "s" : ""}. AI is ready to help!
        </p>
        <Button onClick={onComplete}>
          <Sparkles className="h-4 w-4 mr-2" />
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {currentIndex + 1} of {deck.length}
          </span>
          <span>{likedCount} liked</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Swipe card - compact version */}
      <div className="relative h-[350px]">
        <SwipeCard
          venue={currentVenue}
          onSwipe={handleSwipe}
          onSkip={handleSkip}
        />
      </div>

      {/* Helper text */}
      <p className="text-xs text-center text-muted-foreground">
        Swipe right to like • Swipe left to skip
      </p>

      {/* Skip button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSkip}
        className="w-full text-muted-foreground"
      >
        Skip for now
      </Button>
    </div>
  );
}
