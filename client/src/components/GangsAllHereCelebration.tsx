import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Users } from "lucide-react";
import confetti from "canvas-confetti";

interface GangsAllHereCelebrationProps {
  show: boolean;
  onComplete?: () => void;
}

export function GangsAllHereCelebration({ show, onComplete }: GangsAllHereCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);

      // Trigger confetti burst from center
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#16a34a", "#fbbf24", "#f59e0b", "#3b82f6"],
      });

      // Second burst from sides for extra celebration
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#22c55e", "#16a34a", "#fbbf24"],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#22c55e", "#16a34a", "#fbbf24"],
        });
      }, 250);

      // Auto-hide after animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="fixed inset-x-0 top-24 z-50 flex justify-center px-4"
        >
          <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <PartyPopper className="h-8 w-8 animate-bounce" />
            <div>
              <p className="font-bold text-lg">Gang's all here!</p>
              <p className="text-sm opacity-90">Everyone's confirmed for this event</p>
            </div>
            <Users className="h-6 w-6" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
