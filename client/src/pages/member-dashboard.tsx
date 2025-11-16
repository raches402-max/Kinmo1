import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

export default function MemberDashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/user/dashboard"],
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
          {/* Stats grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-16 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* My Groups skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-12 w-12 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-3 py-2 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-5 rounded" />
                          <Skeleton className="h-5 w-48" />
                        </div>
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "Failed to load dashboard data"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleRetry} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Link href="/">
              <Button className="w-full" variant="outline">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, groups, upcomingEvents, pastEvents, stats } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-black">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.firstName || user.email}
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-activity-meals/30 bg-activity-meals/15 border-l-4 border-l-activity-meals">
            <CardHeader className="pb-3">
              <CardDescription>Total Groups</CardDescription>
              <CardTitle className="text-3xl font-black text-activity-meals">{stats.totalGroups}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-muted-foreground">
                <Users className="h-4 w-4 mr-1" />
                Active memberships
              </div>
            </CardContent>
          </Card>

          <Card className="border-activity-cafes/30 bg-activity-cafes/15 border-l-4 border-l-activity-cafes">
            <CardHeader className="pb-3">
              <CardDescription>Events Attended</CardDescription>
              <CardTitle className="text-3xl font-black text-activity-cafes">{stats.totalEventsAttended}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Out of {stats.totalEventsInvited} total
              </div>
            </CardContent>
          </Card>

          <Card className="border-activity-drinks/30 bg-activity-drinks/15 border-l-4 border-l-activity-drinks">
            <CardHeader className="pb-3">
              <CardDescription>Attendance Rate</CardDescription>
              <CardTitle className="text-3xl font-black text-activity-drinks">{stats.attendanceRate}%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 mr-1" />
                {stats.attendanceRate >= 75 ? "Great attendance!" : "Keep it up!"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-activity-experiences/30 bg-activity-experiences/15 border-l-4 border-l-activity-experiences">
            <CardHeader className="pb-3">
              <CardDescription>RSVP Response Rate</CardDescription>
              <CardTitle className="text-3xl font-black text-activity-experiences">{stats.rsvpResponseRate}%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-4 w-4 mr-1" />
                {stats.rsvpResponseRate >= 80 ? "Very responsive" : "Be more responsive"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Groups */}
        <Card>
          <CardHeader>
            <CardTitle>My Groups</CardTitle>
            <CardDescription>
              Groups you're a member of
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  You're not a member of any groups yet
                </p>
                <Link href="/create-group">
                  <Button>Create Your First Group</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group: any) => (
                  <Link key={group.id} href={`/group/${group.id}`}>
                    <Card className="hover:border-primary transition-colors cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="text-3xl">{group.emoji}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{group.name}</h3>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {group.locationBase}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {group.memberCount}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {group.upcomingEvents}
                                </div>
                              </div>
                            </div>
                            {group.isOwner && (
                              <span className="inline-block mt-2 text-xs bg-primary/25 text-primary px-2 py-0.5 rounded">
                                Organizer
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>
              Events you've been invited to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2" />
                <p>No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base">{event.groupEmoji}</span>
                        <h4 className="font-medium text-sm">{event.groupName}</h4>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {event.eventDate
                            ? format(new Date(event.eventDate), "EEE, MMM d, yyyy 'at' h:mm a")
                            : "Date TBD"}
                        </div>
                        {event.venues && event.venues.length > 0 && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venues.map((v: any) => v.name).join(" → ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.rsvpStatus ? (
                        <div className="flex items-center gap-1 text-xs">
                          {event.rsvpStatus === "going" && (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-green-600 font-medium">Going</span>
                            </>
                          )}
                          {event.rsvpStatus === "maybe" && (
                            <>
                              <Clock className="h-3.5 w-3.5 text-yellow-600" />
                              <span className="text-yellow-600 font-medium">Maybe</span>
                            </>
                          )}
                          {event.rsvpStatus === "not_going" && (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                              <span className="text-red-600 font-medium">Can't go</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No RSVP</span>
                      )}
                      <Link href={`/event/${event.id}`}>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Past Events</CardTitle>
              <CardDescription>
                Your event history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pastEvents.slice(0, 5).map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between px-3 py-2 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{event.groupEmoji}</span>
                        <h4 className="text-sm font-medium">{event.name || event.groupName}</h4>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.eventDate
                          ? format(new Date(event.eventDate), "MMM d, yyyy")
                          : "No date"}
                      </div>
                    </div>
                    <div className="text-sm">
                      {event.attended ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Attended
                        </span>
                      ) : event.rsvpStatus === "going" ? (
                        <span className="text-muted-foreground">RSVP'd Yes</span>
                      ) : (
                        <span className="text-muted-foreground">Didn't attend</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
