import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventAccordionSectionProps {
  icon: React.ElementType;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export function EventAccordionSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  children,
  badge,
}: EventAccordionSectionProps) {
  return (
    <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-subtle">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          isExpanded && "bg-primary/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
              isExpanded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider transition-colors",
              isExpanded ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {title}
          </span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="px-4 pb-4 pt-2 min-w-0 overflow-hidden">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
