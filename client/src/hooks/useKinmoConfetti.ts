/**
 * Hook for triggering Kinmo-branded confetti celebrations
 *
 * Usage:
 * const { fireConfetti, fireSubtleConfetti, fireCelebration } = useKinmoConfetti();
 *
 * // On RSVP success
 * fireConfetti();
 *
 * // On minor success
 * fireSubtleConfetti();
 *
 * // On major celebration (gang's all here)
 * fireCelebration();
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  fireKinmoConfetti,
  fireKinmoConfettiSubtle,
  fireKinmoConfettiCelebration,
} from '@/lib/kinmo-confetti';

interface UseKinmoConfettiOptions {
  /** Fire confetti automatically when the hook mounts */
  autoFire?: boolean;
  /** Which type of confetti to auto-fire */
  autoFireType?: 'default' | 'subtle' | 'celebration';
  /** Delay in ms before auto-firing (default: 100) */
  autoFireDelay?: number;
}

export function useKinmoConfetti(options?: UseKinmoConfettiOptions) {
  const {
    autoFire = false,
    autoFireType = 'default',
    autoFireDelay = 100,
  } = options || {};

  const hasFiredRef = useRef(false);

  // Memoized fire functions
  const fireConfetti = useCallback(() => {
    fireKinmoConfetti();
  }, []);

  const fireSubtleConfetti = useCallback(() => {
    fireKinmoConfettiSubtle();
  }, []);

  const fireCelebration = useCallback(() => {
    fireKinmoConfettiCelebration();
  }, []);

  // Auto-fire on mount if configured
  useEffect(() => {
    if (autoFire && !hasFiredRef.current) {
      hasFiredRef.current = true;

      const timer = setTimeout(() => {
        switch (autoFireType) {
          case 'subtle':
            fireSubtleConfetti();
            break;
          case 'celebration':
            fireCelebration();
            break;
          default:
            fireConfetti();
        }
      }, autoFireDelay);

      return () => clearTimeout(timer);
    }
  }, [autoFire, autoFireType, autoFireDelay, fireConfetti, fireSubtleConfetti, fireCelebration]);

  return {
    /** Fire standard Kinmo confetti burst */
    fireConfetti,
    /** Fire subtle/small confetti burst */
    fireSubtleConfetti,
    /** Fire extra celebratory confetti (multiple waves) */
    fireCelebration,
  };
}
