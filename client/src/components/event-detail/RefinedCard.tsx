/**
 * Refined Card Components - Subtle Refined Style
 *
 * Reusable components with warm, elegant styling:
 * - Golden accent borders and glows
 * - Warm beige backgrounds (hsl 35, 40%, 95%)
 * - Smooth cubic-bezier transitions
 * - Subtle gradient overlays
 */

import { cn } from "@/lib/utils";

/**
 * RefinedCard - Card wrapper with warm hover effects
 */
export function RefinedCard({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white overflow-hidden",
        "border-[hsl(32,20%,88%)]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        hover && "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        hover && "hover:border-[hsl(44,70%,75%)] hover:shadow-[0_4px_16px_rgba(242,201,76,0.12)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * RefinedSectionHeader - Section header with icon circle + title
 */
export function RefinedSectionHeader({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative px-5 py-4",
        "bg-[hsl(35,40%,95%)]",
        "border-b border-[hsl(32,20%,88%)]"
      )}
      style={{
        background: "linear-gradient(135deg, hsla(44, 87%, 63%, 0.06) 0%, hsla(44, 87%, 63%, 0.02) 50%, hsl(35, 40%, 95%) 100%)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              "bg-[hsl(44,87%,63%)] text-[hsl(25,30%,14%)]",
              "shadow-[0_2px_8px_rgba(242,201,76,0.3)]",
              "transform scale-105"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(25,30%,14%)]">
            {title}
          </span>
          {children}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * RefinedActionButton - Warm-styled action button with icon
 */
export function RefinedActionButton({
  icon: Icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
        "border border-[hsl(32,20%,88%)] bg-white",
        "text-[hsl(25,30%,14%)] text-sm font-medium",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:border-[hsl(44,70%,75%)] hover:bg-[hsl(35,40%,97%)]",
        "hover:shadow-[0_2px_8px_rgba(242,201,76,0.1)]",
        "active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[hsl(32,20%,88%)] disabled:hover:bg-white disabled:hover:shadow-none"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(35,25%,93%)] text-[hsl(25,15%,45%)]">
        <Icon className="h-4 w-4" />
      </div>
      {children}
    </button>
  );
}

/**
 * RefinedVenueCard - Styled venue card with drag handle
 */
export function RefinedVenueCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4",
        "border-[hsl(32,20%,88%)] bg-[hsl(38,50%,98%)]",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:border-[hsl(44,70%,75%)] hover:shadow-[0_4px_12px_rgba(242,201,76,0.1)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * RefinedAttendeeCard - Styled attendee card with status colors
 */
export function RefinedAttendeeCard({
  children,
  status,
  isCurrentUser,
  className,
}: {
  children: React.ReactNode;
  status: "yes" | "maybe" | "pending" | "no";
  isCurrentUser?: boolean;
  className?: string;
}) {
  const statusStyles = {
    yes: {
      bg: "bg-[hsl(145,40%,96%)]",
      border: "border-[hsl(145,35%,80%)]",
    },
    maybe: {
      bg: "bg-[hsl(38,50%,96%)]",
      border: "border-[hsl(38,45%,80%)]",
    },
    pending: {
      bg: "bg-[hsl(220,15%,96%)]",
      border: "border-[hsl(220,10%,85%)]",
    },
    no: {
      bg: "bg-[hsl(350,50%,97%)]",
      border: "border-[hsl(350,40%,85%)]",
    },
  };

  const styles = statusStyles[status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        styles.bg,
        styles.border,
        isCurrentUser && "ring-2 ring-[hsl(44,87%,63%)]/25 ring-offset-1",
        className
      )}
    >
      {children}
    </div>
  );
}
