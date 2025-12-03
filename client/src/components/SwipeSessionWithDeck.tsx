import { useState, useEffect } from 'react';
import { SwipeCard } from './SwipeCard';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  groupId?: string;
}

interface SwipeSessionWithDeckProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  initialDeck: SwipeVenue[];
  sessionId?: string;
}

export function SwipeSessionWithDeck({
  groupId,
  open,
  onOpenChange,
  onComplete,
  initialDeck,
  sessionId,
}: SwipeSessionWithDeckProps) {
  const [deck, setDeck] = useState<SwipeVenue[]>(initialDeck);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const { toast } = useToast();

  // Update deck when initialDeck changes
  useEffect(() => {
    if (initialDeck && initialDeck.length > 0) {
      setDeck(initialDeck);
      setCurrentIndex(0);
      setAddedCount(0);
    }
  }, [initialDeck]);

  const upvoteMutation = useMutation({
    mutationFn: async (venue: SwipeVenue) => {
      // If it's a voting event, upvote it
      if (venue.sourceType === 'voting_event') {
        return apiRequest('POST', `/api/voting-events/${venue.id}/vote`, { voteType: 'upvote' });
      }

      // If it's an AI suggestion, create a voting event first, then upvote
      if (venue.sourceType === 'ai_suggestion') {
        const result = await apiRequest('POST', `/api/voting-events`, {
          groupId: groupId,
          title: venue.title,
          description: venue.description || '',
          venueAddress: venue.venueAddress || '',
          venueType: venue.venueType || '',
          googlePlaceId: venue.googlePlaceId || '',
          rating: venue.rating || '',
          priceLevel: venue.priceLevel || '',
          photoUrl: venue.photoUrl || '',
          skipEnrichmentCheck: true, // Skip Google Places check since we already have the data
        });

        // Now upvote the newly created event
        return apiRequest('POST', `/api/voting-events/${result.event.id}/vote`, { voteType: 'upvote' });
      }
    },
    onSuccess: () => {
      // Invalidate voting events cache to refresh Favorites tab
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "voting-events"] });
      setAddedCount((prev) => prev + 1);
    },
  });

  const handleSwipe = async (direction: 'like' | 'pass') => {
    const currentVenue = deck[currentIndex];

    if (direction === 'like') {
      // Add to favorites
      await upvoteMutation.mutateAsync(currentVenue);
    }
    // For pass, we just skip (don't need to record anything)

    // Move to next card
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finished swiping
      handleComplete();
    }
  };

  const handleComplete = () => {
    toast({
      title: 'Session complete!',
      description: `You added ${addedCount} venue${addedCount !== 1 ? 's' : ''} to Favorites`,
    });

    if (onComplete) {
      onComplete();
    }

    onOpenChange(false);
  };

  const currentVenue = deck[currentIndex];
  const progress = deck.length > 0 ? Math.round(((currentIndex + 1) / deck.length) * 100) : 0;

  if (!open) return null;

  if (!deck || deck.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discover Venues</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-muted-foreground mb-4">No venues to swipe on right now.</p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Discover Venues</span>
            <span className="text-sm font-normal text-muted-foreground">
              {currentIndex + 1} of {deck.length} • {addedCount} added
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-[500px]">
          {currentVenue && (
            <SwipeCard
              key={currentVenue.id}
              venue={currentVenue}
              onSwipe={handleSwipe}
              onSkip={() => handleSwipe('pass')}
            />
          )}

          {upvoteMutation.isPending && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => handleSwipe('pass')}>
            Skip
          </Button>
          <div className="text-sm text-muted-foreground">
            Swipe right to add • Swipe left to skip
          </div>
          <Button onClick={() => handleSwipe('like')}>
            Add to Favorites
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
