import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Users, Calendar, TrendingUp, MapPin, Repeat, ArrowLeft, DollarSign, Database, Download, Activity } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface ApiCosts {
  period: string;
  periodLabel: string;
  apiCalls: {
    textSearch: { estimated: number; cost: number; pricePerThousand: number };
    placeDetails: { estimated: number; cost: number; pricePerThousand: number; tier: string };
    geocoding: { estimated: number; cost: number; pricePerThousand: number };
    cachedPhotos: { estimated: number; cost: number; pricePerThousand: number; note: string };
    uncachedPhotos: { estimated: number; cost: number; pricePerThousand: number; note: string; count: number };
  };
  totals: {
    estimatedCalls: number;
    estimatedCost: number;
  };
  caching: {
    textSearchHits: number;
    placeDetailsHits: number;
    geocodingHits: number;
    totalHits: number;
    hitRate: string;
    savedCost: number;
  };
  apiKeys: {
    key1Calls: number;
    key2Calls: number;
    totalCalls: number;
    key2Configured: boolean;
  };
  database: {
    activities: number;
    uniquePlaces: number;
    groups: number;
    geocodingCacheSize: number;
    photosCacheSize: number;
  };
}

interface ApiLog {
  id: number;
  timestamp: string;
  service: string;
  method: string;
  cacheStatus: string;
  status: string;
  responseTimeMs: number | null;
  costEstimate: string;
  errorMessage: string | null;
  parameters: any;
  metadata: any;
}

interface ApiStats {
  overall: {
    totalCalls: number;
    totalCost: number;
    avgResponseTime: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
  };
  byService: Array<{
    service: string;
    count: number;
    totalCost: number;
    avgResponseTime: number;
  }>;
  byCacheStatus: Array<{
    cacheStatus: string;
    count: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

export default function Admin() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("total");
  const [logFilter, setLogFilter] = useState<{ service?: string; status?: string }>({});
  const { toast } = useToast();

  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: apiCosts, isLoading: costsLoading } = useQuery<ApiCosts>({
    queryKey: ["/api/admin/api-costs", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/admin/api-costs?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch API costs');
      return response.json();
    },
  });

  const { data: apiLogs, isLoading: logsLoading } = useQuery<ApiLog[]>({
    queryKey: ["/api/admin/api-logs", logFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (logFilter.service) params.set('service', logFilter.service);
      if (logFilter.status) params.set('status', logFilter.status);
      
      const response = await fetch(`/api/admin/api-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch API logs');
      return response.json();
    },
  });

  const { data: apiStatsData } = useQuery<ApiStats>({
    queryKey: ["/api/admin/api-stats"],
  });

  const cachePhotosMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/cache-photos", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-costs"] });
      toast({
        title: "Photo caching complete!",
        description: `Successfully cached ${data.cached} of ${data.total} photos. ${data.errors > 0 ? `${data.errors} errors occurred.` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Photo caching failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="api-logs" data-testid="tab-api-logs">
            <Activity className="mr-2 h-4 w-4" />
            API Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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

      {/* API Costs Section */}
      {!costsLoading && apiCosts && (
        <>
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Google Places API Cost Breakdown</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Time Period:</span>
                <Select 
                  value={selectedPeriod} 
                  onValueChange={setSelectedPeriod}
                  data-testid="select-period"
                >
                  <SelectTrigger className="w-[140px]" data-testid="select-period-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily" data-testid="option-daily">Daily</SelectItem>
                    <SelectItem value="monthly" data-testid="option-monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly" data-testid="option-quarterly">Quarterly</SelectItem>
                    <SelectItem value="total" data-testid="option-total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-total-api-cost">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Estimated Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary" data-testid="text-total-cost">
                  ${apiCosts.totals.estimatedCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">{apiCosts.totals.estimatedCalls.toLocaleString()} total API calls</p>
              </CardContent>
            </Card>

            <Card data-testid="card-cache-savings">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Savings</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-cache-savings">
                  ${apiCosts.caching.savedCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">{apiCosts.caching.hitRate} hit rate (since restart)</p>
              </CardContent>
            </Card>

            <Card data-testid="card-api-keys">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Key Usage</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-api-key-calls">
                  {apiCosts.apiKeys.totalCalls.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {apiCosts.apiKeys.key2Configured 
                    ? `Key 1: ${apiCosts.apiKeys.key1Calls} | Key 2: ${apiCosts.apiKeys.key2Calls} (session)` 
                    : 'Single key configured (session)'}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-cache-size">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-cache-size">
                  {(apiCosts.database.geocodingCacheSize + apiCosts.database.photosCacheSize).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {apiCosts.database.geocodingCacheSize} geocoding, {apiCosts.database.photosCacheSize} photos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* API Breakdown Table */}
          <Card data-testid="card-api-breakdown">
            <CardHeader>
              <CardTitle>API Cost Breakdown</CardTitle>
              <CardDescription>Estimated costs by API type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 pb-2 border-b font-medium text-sm">
                  <div>API Type</div>
                  <div className="text-right">Calls</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Cost</div>
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="font-medium">Text Search</div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.textSearch.estimated.toLocaleString()}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.textSearch.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.textSearch.cost.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="font-medium">
                    Place Details
                    <span className="ml-2 text-xs text-green-600">({apiCosts.apiCalls.placeDetails.tier})</span>
                  </div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.placeDetails.estimated.toLocaleString()}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.placeDetails.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.placeDetails.cost.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="font-medium">Geocoding</div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.geocoding.estimated.toLocaleString()}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.geocoding.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.geocoding.cost.toFixed(2)}</div>
                </div>

                {apiCosts.apiCalls.cachedPhotos && (
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div>
                      <div className="font-medium">Cached Photos</div>
                      <div className="text-xs text-muted-foreground">{apiCosts.apiCalls.cachedPhotos.note}</div>
                    </div>
                    <div className="text-right text-muted-foreground">{apiCosts.apiCalls.cachedPhotos.estimated.toLocaleString()}</div>
                    <div className="text-right text-muted-foreground">${apiCosts.apiCalls.cachedPhotos.pricePerThousand}/1K</div>
                    <div className="text-right font-semibold">${apiCosts.apiCalls.cachedPhotos.cost.toFixed(2)}</div>
                  </div>
                )}

                {apiCosts.apiCalls.uncachedPhotos && (
                  <div className="grid grid-cols-4 gap-4 items-center bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                    <div>
                      <div className="font-medium text-yellow-800 dark:text-yellow-300">Uncached Photos</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400">{apiCosts.apiCalls.uncachedPhotos.note}</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                        {apiCosts.apiCalls.uncachedPhotos.count.toLocaleString()} activities with direct Google URLs
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground">{apiCosts.apiCalls.uncachedPhotos.estimated.toLocaleString()}</div>
                    <div className="text-right text-muted-foreground">${apiCosts.apiCalls.uncachedPhotos.pricePerThousand}/1K</div>
                    <div className="text-right font-semibold text-yellow-800 dark:text-yellow-300">${apiCosts.apiCalls.uncachedPhotos.cost.toFixed(2)}</div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 pt-2 border-t font-bold">
                  <div>Total</div>
                  <div className="text-right">{apiCosts.totals.estimatedCalls.toLocaleString()}</div>
                  <div></div>
                  <div className="text-right text-primary">${apiCosts.totals.estimatedCost.toFixed(2)}</div>
                </div>

                {/* Migration Button */}
                {apiCosts.apiCalls.uncachedPhotos && apiCosts.apiCalls.uncachedPhotos.count > 0 && (
                  <div className="pt-4 border-t">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-3">
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-200">Fix Ongoing Photo Costs</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                          Download and cache all {apiCosts.apiCalls.uncachedPhotos.count.toLocaleString()} photos using your second API key. 
                          This will eliminate ongoing photo viewing costs (~$184/day).
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                          One-time cost: ~${((apiCosts.apiCalls.uncachedPhotos.count / 1000) * 7).toFixed(2)} using KEY_2
                        </p>
                      </div>
                      <Button
                        onClick={() => cachePhotosMutation.mutate()}
                        disabled={cachePhotosMutation.isPending}
                        className="w-full"
                        data-testid="button-cache-photos"
                      >
                        {cachePhotosMutation.isPending ? (
                          <>
                            <Download className="mr-2 h-4 w-4 animate-pulse" />
                            Caching photos...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Cache All Photos Now (Using KEY_2)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
        </TabsContent>

        <TabsContent value="api-logs" className="space-y-6">
          {/* API Logs Summary Stats */}
          {apiStatsData && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-api-total-calls">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-api-total-calls">
                    {apiStatsData.overall.totalCalls.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${apiStatsData.overall.totalCost.toFixed(4)} total cost
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-api-cache-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-api-cache-rate">
                    {apiStatsData.overall.cacheHitRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {apiStatsData.overall.cacheHits.toLocaleString()} hits / {apiStatsData.overall.cacheMisses.toLocaleString()} misses
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-api-avg-response">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-api-avg-response">
                    {apiStatsData.overall.avgResponseTime}ms
                  </div>
                  <p className="text-xs text-muted-foreground">Across all API calls</p>
                </CardContent>
              </Card>

              <Card data-testid="card-api-by-service">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Services</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {apiStatsData.byService.map((svc) => (
                      <div key={svc.service} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{svc.service}:</span>
                        <span className="font-medium">{svc.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <Select 
              value={logFilter.service || 'all'} 
              onValueChange={(value) => setLogFilter({ ...logFilter, service: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-service-filter">
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="google_places">Google Places</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={logFilter.status || 'all'} 
              onValueChange={(value) => setLogFilter({ ...logFilter, status: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* API Logs Table */}
          <Card data-testid="card-api-logs-table">
            <CardHeader>
              <CardTitle>Recent API Calls</CardTitle>
              <CardDescription>Last 100 API calls with cache status and response times</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-muted-foreground">Loading logs...</div>
                </div>
              ) : apiLogs && apiLogs.length > 0 ? (
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Cache</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Response Time</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-service-${log.id}`}>
                              {log.service}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.method}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.cacheStatus === 'miss' ? 'destructive' : 'default'}
                              data-testid={`badge-cache-${log.id}`}
                            >
                              {log.cacheStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.status === 'success' ? 'default' : 'destructive'}
                              data-testid={`badge-status-${log.id}`}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            ${parseFloat(log.costEstimate || '0').toFixed(6)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <div className="text-muted-foreground">No API logs found</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
