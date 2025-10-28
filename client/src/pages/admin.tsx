import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, Calendar, TrendingUp, MapPin, Repeat, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  registeredUsers: number;
  invitedMembers: number;
  totalGroups: number;
  totalEvents: number;
  eventsHeld: number;
  activeGroups: number;
  repeatAttendanceRate: number;
  topCities: Array<{ city: string; eventCount: number }>;
  eventsPerWeek: Array<{ week: string; count: number }>;
  newVsReturning: { newAttendees: number; returningAttendees: number };
}

export default function Admin() {
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading admin statistics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="text-2xl font-bold">Access Denied</div>
          <div className="text-muted-foreground">You don't have permission to view this page.</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">No data available</div>
        </div>
      </div>
    );
  }

  // Format weekly events data for chart
  const weeklyChartData = stats.eventsPerWeek.map(item => ({
    week: format(new Date(item.week), 'MMM d'),
    count: item.count
  }));

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6" data-testid="page-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform health and usage metrics</p>
        </div>
        <Button variant="outline" asChild data-testid="button-back-to-dashboard">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-registered-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-registered-users">{stats.registeredUsers}</div>
            <p className="text-xs text-muted-foreground">Users who logged in</p>
          </CardContent>
        </Card>

        <Card data-testid="card-invited-members">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invited Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-invited-members">{stats.invitedMembers}</div>
            <p className="text-xs text-muted-foreground">People invited to groups</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-groups">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-groups">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">Groups created</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-events">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-events">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Events planned</p>
          </CardContent>
        </Card>

        <Card data-testid="card-events-held">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Held</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-events-held">{stats.eventsHeld}</div>
            <p className="text-xs text-muted-foreground">Events that happened</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-active-groups">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-groups">{stats.activeGroups}</div>
            <p className="text-xs text-muted-foreground">Groups with events in last 60 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-repeat-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Attendance Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-repeat-rate">{stats.repeatAttendanceRate}%</div>
            <p className="text-xs text-muted-foreground">Users who attended 2+ events</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Events Trend */}
        <Card data-testid="card-events-trend">
          <CardHeader>
            <CardTitle>Events per Week</CardTitle>
            <CardDescription>Last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* New vs Returning */}
        <Card data-testid="card-new-vs-returning">
          <CardHeader>
            <CardTitle>New vs Returning Attendees</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'New', count: stats.newVsReturning.newAttendees },
                { name: 'Returning', count: stats.newVsReturning.returningAttendees }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Cities */}
      <Card data-testid="card-top-cities">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Top Cities by Event Count
          </CardTitle>
          <CardDescription>Where your users are most active</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topCities.length > 0 ? (
            <div className="space-y-2">
              {stats.topCities.map((city, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  data-testid={`city-row-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                    <span className="font-medium">{city.city}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{city.eventCount} events</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No city data available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
