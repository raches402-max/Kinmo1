/**
 * Venue Badges Component
 * Displays badges explaining why a venue was selected by the AI
 */

import { Badge } from "@/components/ui/badge";

interface VenueBadgesProps {
  badges: string[];
  className?: string;
}

export function VenueBadges({ badges, className = "" }: VenueBadgesProps) {
  if (!badges || badges.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges.map((badge, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {badge}
        </Badge>
      ))}
    </div>
  );
}
