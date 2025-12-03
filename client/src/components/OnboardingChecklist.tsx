import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, Circle, Users, User, MapPin, Calendar, ChevronRight, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group, UserProfile } from "@shared/schema";

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  userId?: string | null;
  isOrganizer?: boolean;
  openToHosting?: boolean;
  profileCompleted?: boolean;
};

interface OnboardingChecklistProps {
  groups: Array<Group & { members: SafeMember[] }>;
  profile: UserProfile | null | undefined;
  userId: string | undefined;
  hasEvents?: boolean;
  onDismiss?: () => void;
  onOpenDiscoverVenues?: (groupId: string) => void;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  priority: number;
}

export function OnboardingChecklist({ groups, profile, userId, hasEvents = false, onDismiss, onOpenDiscoverVenues }: OnboardingChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate checklist items based on user state
  const hasGroups = groups.length > 0;
  const hasMultipleMembers = groups.some(g => g.members.length > 1);
  const hasProfileCompleted = groups.some(g =>
    g.members.some(m => m.userId === userId && m.profileCompleted === true)
  );
  // For venues, check if any group has autoSchedulingEnabled (indicates they've set up venues)
  const hasVenues = groups.some(g => (g as any).autoSchedulingEnabled === true);

  // Find the first group and the user's member profile that needs completion
  const firstGroup = groups[0];
  const memberNeedingProfile = groups
    .flatMap(g => g.members)
    .find(m => m.userId === userId && m.profileCompleted === false);

  const checklistItems: ChecklistItem[] = [
    {
      id: "create-group",
      title: "Create your first group",
      description: "Set up a group for friends, family, or coworkers",
      completed: hasGroups,
      href: "/create-group",
      icon: <Users className="h-4 w-4" />,
      priority: 1,
    },
    {
      id: "invite-members",
      title: "Invite people to your group",
      description: "Add members so they can RSVP to events",
      completed: hasMultipleMembers,
      href: firstGroup ? `/group/${firstGroup.id}` : "/create-group",
      icon: <User className="h-4 w-4" />,
      priority: 2,
    },
    {
      id: "complete-profile",
      title: "Complete your preferences",
      description: "Help us find activities you'll love",
      completed: hasProfileCompleted,
      href: memberNeedingProfile ? `/member-profile-setup/${memberNeedingProfile.id}` : (firstGroup ? `/group/${firstGroup.id}` : undefined),
      icon: <User className="h-4 w-4" />,
      priority: 3,
    },
    {
      id: "add-venues",
      title: "Discover venues",
      description: "Find places your group might enjoy",
      completed: hasVenues,
      onClick: firstGroup && onOpenDiscoverVenues ? () => onOpenDiscoverVenues(firstGroup.id) : undefined,
      icon: <MapPin className="h-4 w-4" />,
      priority: 4,
    },
    {
      id: "create-event",
      title: "Plan your first event",
      description: "Schedule a time to get together",
      completed: hasEvents,
      href: firstGroup ? `/group/${firstGroup.id}` : undefined,
      icon: <Calendar className="h-4 w-4" />,
      priority: 5,
    },
  ];

  // Sort by priority and filter to show incomplete items first
  const sortedItems = [...checklistItems].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.priority - b.priority;
  });

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Don't show if all items are complete
  if (completedCount === totalCount) {
    return null;
  }

  // Find the next action to take
  const nextAction = sortedItems.find(item => !item.completed);

  // Render action button for an item (handles both href and onClick)
  const renderActionButton = (item: ChecklistItem, variant: "ghost" | "default" = "ghost", fullWidth = false) => {
    const buttonContent = variant === "default" ? (
      <>
        {item.icon}
        <span className="ml-2">{item.title}</span>
      </>
    ) : (
      <ChevronRight className="h-4 w-4" />
    );

    const buttonProps = {
      variant,
      size: (variant === "default" ? "default" : "sm") as "default" | "sm",
      className: cn(variant === "ghost" && "h-8 px-2", fullWidth && "w-full"),
      "data-testid": variant === "default" ? "next-onboarding-action" : undefined,
    };

    if (item.onClick) {
      return (
        <Button {...buttonProps} onClick={item.onClick}>
          {buttonContent}
        </Button>
      );
    }

    if (item.href) {
      return (
        <Link href={item.href}>
          <Button {...buttonProps}>
            {buttonContent}
          </Button>
        </Link>
      );
    }

    return null;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-border/50 bg-muted/30" data-testid="onboarding-checklist">
        <CardHeader className="py-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Collapsible trigger area */}
            <CollapsibleTrigger className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity" data-testid="toggle-onboarding">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                  !isExpanded && "-rotate-90"
                )} />
                <span className="text-sm font-medium truncate">Getting Started</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {completedCount}/{totalCount}
                </span>
                <Progress value={progressPercent} className="h-1.5 w-12 sm:w-16 ml-1 flex-shrink-0" />
              </div>
            </CollapsibleTrigger>

            {/* Next action button (always visible) - hide text on small mobile */}
            {nextAction && (nextAction.href || nextAction.onClick) && (
              <div className="flex-shrink-0">
                {nextAction.onClick ? (
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2 sm:px-3" onClick={nextAction.onClick} data-testid="quick-next-action">
                    <span className="hidden sm:inline">{nextAction.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 sm:hidden" />
                  </Button>
                ) : nextAction.href ? (
                  <Link href={nextAction.href}>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 sm:px-3" data-testid="quick-next-action">
                      <span className="hidden sm:inline">{nextAction.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 sm:hidden" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            )}

            {/* Dismiss button */}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={onDismiss}
                data-testid="dismiss-onboarding"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3 sm:px-4">
            <div className="space-y-1.5">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-colors",
                    item.completed
                      ? "opacity-50"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                    item.completed
                      ? "bg-primary/80 text-primary-foreground"
                      : "border border-muted-foreground/30"
                  )}>
                    {item.completed ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="text-2xs text-muted-foreground">{item.priority}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                    </p>
                  </div>
                  {!item.completed && (item.href || item.onClick) && renderActionButton(item, "ghost")}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
