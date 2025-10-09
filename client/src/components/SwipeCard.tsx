import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SwipeCardProps {
  conceptDescription: string;
  onSwipe: (direction: 'like' | 'pass') => void;
  onSkip: () => void;
}

export function SwipeCard({ conceptDescription, onSwipe, onSkip }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
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
      whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
      data-testid="swipe-card"
    >
      <Card className="p-8 h-[400px] flex items-center justify-center bg-card border-2">
        <div className="text-center space-y-6">
          <h3 className="text-2xl font-semibold" data-testid="text-concept-description">
            {conceptDescription}
          </h3>
          <p className="text-sm text-muted-foreground">
            Swipe right to like • Swipe left to pass
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
          Like
        </Button>
      </div>
    </motion.div>
  );
}
