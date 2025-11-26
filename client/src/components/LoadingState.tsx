/**
 * Enhanced loading state components with progress indicators and time estimates
 */

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Search, Brain, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

export type LoadingType =
  | 'default'          // Generic loading
  | 'ai-generation'    // AI generating venues/events (10-20s)
  | 'venue-search'     // Searching for venues (3-8s)
  | 'saving'           // Saving data (1-2s)
  | 'processing';      // Processing request (2-5s)

interface LoadingStateProps {
  type?: LoadingType;
  message?: string;
  showProgress?: boolean;
  className?: string;
}

const LOADING_CONFIG = {
  'default': {
    icon: Loader2,
    message: 'Loading...',
    estimatedTime: 3000,
    steps: ['Loading...'],
  },
  'ai-generation': {
    icon: Brain,
    message: 'AI is generating suggestions',
    estimatedTime: 15000, // 15 seconds
    steps: [
      'Analyzing your group preferences...',
      'Finding the best venues...',
      'Checking availability and ratings...',
      'Almost done...',
    ],
  },
  'venue-search': {
    icon: Search,
    message: 'Searching for venues',
    estimatedTime: 5000, // 5 seconds
    steps: [
      'Searching nearby venues...',
      'Filtering results...',
      'Done!',
    ],
  },
  'saving': {
    icon: Loader2,
    message: 'Saving',
    estimatedTime: 2000, // 2 seconds
    steps: ['Saving...'],
  },
  'processing': {
    icon: Loader2,
    message: 'Processing',
    estimatedTime: 3000, // 3 seconds
    steps: [
      'Processing request...',
      'Almost done...',
    ],
  },
};

/**
 * Enhanced loading state with progress and time estimate
 */
export function LoadingState({ type = 'default', message, showProgress = false, className }: LoadingStateProps) {
  const config = LOADING_CONFIG[type];
  const Icon = config.icon;
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!showProgress) return;

    const stepDuration = config.estimatedTime / config.steps.length;
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (100 / (config.estimatedTime / 100));
        return next >= 100 ? 99 : next; // Cap at 99% until actually done
      });
    }, 100);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        return next >= config.steps.length ? prev : next;
      });
    }, stepDuration);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [type, showProgress, config.estimatedTime, config.steps.length]);

  const displayMessage = message || config.steps[currentStep] || config.message;

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Icon className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-center mb-2">{displayMessage}</p>
      {showProgress && (
        <>
          <Progress value={progress} className="w-64 mb-2" />
          <p className="text-xs text-muted-foreground">
            Estimated time: {Math.ceil(config.estimatedTime / 1000)}s
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Inline loading spinner (for buttons)
 */
interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function InlineLoading({ message = 'Loading...', size = 'sm' }: InlineLoadingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span className="flex items-center gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      {message}
    </span>
  );
}

/**
 * Skeleton loading cards (for lists)
 */
export function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
          <div className="h-3 bg-muted rounded w-full"></div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading overlay (full screen or container)
 */
interface LoadingOverlayProps {
  type?: LoadingType;
  message?: string;
  showProgress?: boolean;
  fullScreen?: boolean;
}

export function LoadingOverlay({ type = 'default', message, showProgress = false, fullScreen = false }: LoadingOverlayProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm'
    : 'absolute inset-0 bg-background/80 backdrop-blur-sm';

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-center h-full">
        <LoadingState type={type} message={message} showProgress={showProgress} />
      </div>
    </div>
  );
}

/**
 * Time-aware loading message (shows different messages based on elapsed time)
 */
interface TimeAwareLoadingProps {
  startTime: number;
  normalMessage: string;
  slowMessage: string;
  slowThreshold?: number; // milliseconds
}

export function TimeAwareLoading({
  startTime,
  normalMessage,
  slowMessage,
  slowThreshold = 10000, // 10 seconds
}: TimeAwareLoadingProps) {
  const [message, setMessage] = useState(normalMessage);

  useEffect(() => {
    const checkTime = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > slowThreshold) {
        setMessage(slowMessage);
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [startTime, slowThreshold, slowMessage]);

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}
