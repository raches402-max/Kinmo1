/**
 * Empty State Component
 * Reusable component for showing helpful empty states throughout the app
 * Includes icon, title, description, and optional call-to-action
 */

import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /**
   * Icon to display (Lucide icon component)
   */
  icon: LucideIcon;
  /**
   * Main heading
   */
  title: string;
  /**
   * Descriptive text explaining the empty state
   */
  description: string;
  /**
   * Optional call-to-action button
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  /**
   * Optional secondary action
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Additional className for customization
   */
  className?: string;
  /**
   * Show as card (default) or inline
   */
  variant?: "card" | "inline";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "card",
}: EmptyStateProps) {
  const content = (
    <div className={cn("py-12 text-center", className)}>
      {/* Icon */}
      <div className="mb-4 flex justify-center">
        <div className="rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      {/* Description */}
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              size="lg"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="lg"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <Card>
        <CardContent className="p-0">{content}</CardContent>
      </Card>
    );
  }

  return content;
}
