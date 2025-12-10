import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface GangsAllHereBadgeProps {
  className?: string;
}

export function GangsAllHereBadge({ className }: GangsAllHereBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        "bg-gradient-to-r from-green-50 to-emerald-50",
        "border border-green-200",
        "text-green-700",
        className
      )}
    >
      <Users className="h-3.5 w-3.5" />
      <span className="font-semibold text-xs">
        Gang's all here!
      </span>
    </div>
  );
}
