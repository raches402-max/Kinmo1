import { useState, useEffect } from 'react';
import { SwipeCard } from './SwipeCard';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface SwipeSessionProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function SwipeSession({ groupId, open, onOpenChange, onComplete }: SwipeSessionProps) {
  const [deck, setDeck] = useState<SwipeVenue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/voting-events`] });
    }
  });

  useEffect(() => {
    if (open) {
      loadDeck();
    }
  }, [open]);

  async function loadDeck() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/swipe-deck`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load swipe deck');
      }

      const data = await response.json();
      setDeck(data.deck || []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading swipe deck:', error);
      toast({
        title: 'Error',
        description: 'Failed to load venues. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSwipe(direction: 'like' | 'pass') {
    const venue = deck[currentIndex];
    if (!venue) return;

    // If swiped right (like), auto-upvote
    if (direction === 'like') {
      upvoteMutation.mutate(venue);
      toast({
        title: 'Added to favorites!',
        description: `${venue.title} has been upvoted`,
      });
    }

    // Move to next card
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Session complete
      handleComplete();
    }
  }

  function handleSkip() {
    // Skip without saving feedback
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  }

  function handleComplete() {
    onComplete?.();
    // Don't call onOpenChange here - let the onComplete handler control navigation
  }

  function handleClose() {
    if (currentIndex > 0) {
      toast({
        title: 'Progress saved',
        description: `You've reviewed ${currentIndex} ideas.`,
      });
    }
    onOpenChange(false);
  }

  const currentVenue = deck[currentIndex];
  const remaining = deck.length - currentIndex;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-swipe-session">
        <DialogHeader>
          <DialogTitle>Help us decide!</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Swipe right to vote for venues • Swipe left to skip
          </p>
        </DialogHeader>

        <div className="py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentVenue ? (
            <div className="relative h-[500px]">
              <SwipeCard
                venue={currentVenue}
                onSwipe={handleSwipe}
                onSkip={handleSkip}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No more venues to show</p>
              <Button onClick={handleComplete} className="mt-4" data-testid="button-complete">
                Complete
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-4">
          <Button variant="ghost" onClick={handleClose} data-testid="button-exit">
            Exit
          </Button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{remaining} {remaining === 1 ? 'venue' : 'venues'} left</span>
            <span>•</span>
            <span>{currentIndex + 1}/{deck.length}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
