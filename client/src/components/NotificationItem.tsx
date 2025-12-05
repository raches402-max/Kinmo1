/**
 * Notification Item Component
 * Displays a single notification with icon, title, message, and actions
 */

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Mail,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  MapPin,
  XCircle,
  X,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";
import { useUndo } from "@/hooks/useUndo";

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
  showDelete?: boolean;
}

const notificationIcons: Record<string, React.ComponentType<any>> = {
  event_invite: Mail,
  rsvp_reminder: Clock,
  event_update: AlertCircle,
  time_selected: CheckCircle,
  feedback_request: MessageSquare,
  venue_change: MapPin,
  event_cancelled: XCircle,
};

export function NotificationItem({
  notification,
  onClose,
  showDelete = false,
}: NotificationItemProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { executeWithUndo } = useUndo();
  const { toast } = useToast();
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  const Icon = notificationIcons[notification.type] || Mail;

  // Quick RSVP mutation for event invites
  const quickRsvpMutation = useMutation({
    mutationFn: async (response: 'yes' | 'no' | 'maybe') => {
      const metadata = notification.metadata ?
        (typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : notification.metadata)
        : {};
      const itineraryId = metadata.itineraryId;

      if (!itineraryId) throw new Error("No itinerary ID found");

      const res = await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itineraryId,
          response,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit RSVP');
      return res.json();
    },
    onSuccess: (_, response) => {
      setRsvpSubmitted(true);
      toast({
        title: "RSVP recorded",
        description: `You responded "${response}" to this event`,
      });
      // Mark notification as read
      markAsReadMutation.mutate();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark as read mutation with optimistic update
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notifications/${notification.id}/mark-read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onMutate: async () => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ["/api/notifications"] });

      // Optimistically update notification to read
      const previousNotifications = queryClient.getQueryData(["/api/notifications"]);

      queryClient.setQueryData(["/api/notifications"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((n: Notification) =>
          n.id === notification.id ? { ...n, read: true } : n
        );
      });

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(["/api/notifications"], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onMutate: async () => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ["/api/notifications"] });

      // Optimistically remove notification
      const previousNotifications = queryClient.getQueryData(["/api/notifications"]);

      queryClient.setQueryData(["/api/notifications"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((n: Notification) => n.id !== notification.id);
      });

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(["/api/notifications"], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleClick = () => {
    if (!notification.read) {
      markAsReadMutation.mutate();
    }
    if (notification.actionUrl) {
      onClose?.();
      setLocation(notification.actionUrl);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Use undo functionality for deletion
    await executeWithUndo(
      // Action: Actually delete the notification
      async () => {
        deleteMutation.mutate();
      },
      // Rollback: Restore the notification in the cache
      async () => {
        // Get current notifications
        const currentNotifications = queryClient.getQueryData(["/api/notifications"]) as Notification[] | undefined;

        // Add the notification back if it was removed
        if (currentNotifications && !currentNotifications.find(n => n.id === notification.id)) {
          queryClient.setQueryData(["/api/notifications"], [...currentNotifications, notification]);
        }

        // Invalidate to sync with server
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      },
      // Options
      {
        message: "Notification deleted",
        description: "You have 5 seconds to undo",
        delay: 5000,
      }
    );
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer relative group",
        !notification.read && "bg-blue-50/50 hover:bg-blue-50"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "p-2 rounded-full shrink-0",
          notification.type === "event_invite" && "bg-purple-100",
          notification.type === "rsvp_reminder" && "bg-amber-100",
          notification.type === "event_update" && "bg-blue-100",
          notification.type === "time_selected" && "bg-green-100",
          notification.type === "feedback_request" && "bg-indigo-100",
          notification.type === "venue_change" && "bg-cyan-100",
          notification.type === "event_cancelled" && "bg-red-100"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            notification.type === "event_invite" && "text-purple-600",
            notification.type === "rsvp_reminder" && "text-amber-600",
            notification.type === "event_update" && "text-blue-600",
            notification.type === "time_selected" && "text-green-600",
            notification.type === "feedback_request" && "text-indigo-600",
            notification.type === "venue_change" && "text-cyan-600",
            notification.type === "event_cancelled" && "text-red-600"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={cn("text-sm font-medium", !notification.read && "font-semibold")}>
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>

            {/* Quick RSVP buttons for event invites */}
            {notification.type === 'event_invite' && !rsvpSubmitted && (
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => quickRsvpMutation.mutate('yes')}
                  disabled={quickRsvpMutation.isPending}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => quickRsvpMutation.mutate('maybe')}
                  disabled={quickRsvpMutation.isPending}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Maybe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => quickRsvpMutation.mutate('no')}
                  disabled={quickRsvpMutation.isPending}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  No
                </Button>
              </div>
            )}

            {/* Show success message after RSVP */}
            {rsvpSubmitted && notification.type === 'event_invite' && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>RSVP submitted</span>
              </div>
            )}

            {notification.actionLabel && notification.actionUrl && !rsvpSubmitted && (
              <p className="text-xs text-primary mt-2 font-medium">
                {notification.actionLabel} →
              </p>
            )}
          </div>

          {/* Delete button (shown on hover or always if showDelete) */}
          {showDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={handleDelete}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </div>
    </div>
  );
}
