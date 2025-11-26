/**
 * Notifications Page
 * Full-page view of all user notifications with filtering and pagination
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Filter, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationItem } from "@/components/NotificationItem";
import { EmptyState } from "@/components/EmptyState";
import type { Notification } from "@shared/schema";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [, setLocation] = useLocation();

  // Fetch all notifications
  const { data: allNotifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { unreadOnly: filter === "unread" }],
    queryFn: async () => {
      const url =
        filter === "unread"
          ? "/api/notifications?unreadOnly=true"
          : "/api/notifications?limit=100";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate();
  };

  const unreadNotifications = allNotifications.filter((n) => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on your events and group activities
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-6">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">
                All
                {allNotifications.length > 0 && (
                  <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                    {allNotifications.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {hasUnread && (
                  <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                    {unreadNotifications.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <Bell className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Loading notifications...</p>
              </div>
            </CardContent>
          </Card>
        ) : allNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "All caught up!" : "No notifications yet"}
            description={
              filter === "unread"
                ? "You're all caught up! Check back later for updates on your events."
                : "When you get invited to events or receive updates, they'll appear here."
            }
            action={
              filter === "all"
                ? {
                    label: "View Events",
                    onClick: () => setLocation("/events"),
                    variant: "default",
                  }
                : undefined
            }
            secondaryAction={
              filter === "unread"
                ? {
                    label: "View All Notifications",
                    onClick: () => setFilter("all"),
                  }
                : {
                    label: "Go to Dashboard",
                    onClick: () => setLocation("/"),
                  }
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {allNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    showDelete={true}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Footer */}
        {allNotifications.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            Showing {allNotifications.length} notification{allNotifications.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
