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
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden transition-all duration-300 ease-out",
        isExpanded
          ? "border-[hsl(44,70%,75%)] shadow-[0_4px_16px_rgba(242,201,76,0.12)]"
          : "border-card-border shadow-subtle"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-all duration-300 ease-out relative",
          isExpanded && "bg-[hsl(35,40%,95%)] border-b border-card-border"
        )}
      >
        {/* Subtle gradient overlay on expanded state */}
        {isExpanded && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, transparent 100%)"
            }}
          />
        )}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ease-out",
              isExpanded
                ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(242,201,76,0.3)] scale-105"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-[13px] font-bold uppercase tracking-wide transition-colors duration-300",
              isExpanded ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {title}
          </span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="relative z-10"
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
            <div className="px-4 pb-4 pt-4 min-w-0 overflow-hidden bg-white">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
