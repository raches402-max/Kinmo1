import { useState, useEffect } from 'react';
import { SwipeCard } from './SwipeCard';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SwipeConcept {
  conceptType: string;
  conceptDescription: string;
}

interface SwipeSessionProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function SwipeSession({ groupId, open, onOpenChange, onComplete }: SwipeSessionProps) {
  const [concepts, setConcepts] = useState<SwipeConcept[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const feedbackMutation = useMutation({
    mutationFn: async ({ conceptType, conceptDescription, feedback }: { conceptType: string; conceptDescription: string; feedback: 'like' | 'pass' }) => {
      return apiRequest('POST', `/api/groups/${groupId}/swipe-feedback`, { conceptType, conceptDescription, feedback });
    },
  });

  useEffect(() => {
    if (open) {
      loadConcepts();
    }
  }, [open]);

  async function loadConcepts() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/swipe-concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load concepts');
      }

      const data = await response.json();
      setConcepts(data.concepts || []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading concepts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load activity ideas. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSwipe(direction: 'like' | 'pass') {
    const concept = concepts[currentIndex];
    if (!concept) return;

    feedbackMutation.mutate({
      conceptType: concept.conceptType,
      conceptDescription: concept.conceptDescription,
      feedback: direction,
    });

    // Move to next card
    if (currentIndex < concepts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Session complete
      handleComplete();
    }
  }

  function handleSkip() {
    // Skip without saving feedback
    if (currentIndex < concepts.length - 1) {
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

  const currentConcept = concepts[currentIndex];
  const remaining = concepts.length - currentIndex;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-swipe-session">
        <DialogHeader>
          <DialogTitle>Help us learn your taste</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Swipe through activity ideas to refine your group's preferences
          </p>
        </DialogHeader>

        <div className="py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentConcept ? (
            <>
              <div className="relative h-[500px]">
                <SwipeCard
                  conceptDescription={currentConcept.conceptDescription}
                  onSwipe={handleSwipe}
                  onSkip={handleSkip}
                />
              </div>
              <div className="text-center mt-4 text-sm text-muted-foreground">
                {remaining} {remaining === 1 ? 'idea' : 'ideas'} remaining
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No more ideas to show</p>
              <Button onClick={handleComplete} className="mt-4" data-testid="button-complete">
                Complete
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={handleClose} data-testid="button-exit">
            Exit
          </Button>
          <div className="text-sm text-muted-foreground">
            {currentIndex}/{concepts.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
