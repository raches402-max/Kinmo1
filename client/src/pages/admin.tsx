import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Users, Calendar, TrendingUp, MapPin, Repeat, ArrowLeft, DollarSign, Database, Download, RefreshCw, FileText, BarChart3, Upload, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ApiCallLog } from "@shared/schema";

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
    textSearch: { estimated: number; cached?: number; cost: number; pricePerThousand: number; note?: string };
    placeDetails: { estimated: number; cached?: number; cost: number; pricePerThousand: number; tier: string; note?: string };
    geocoding: { estimated: number; cached?: number; cost: number; pricePerThousand: number; note?: string };
    cachedPhotos: { estimated: number; cost: number; pricePerThousand: number; note: string };
    uncachedPhotos: { estimated: number; cost: number; pricePerThousand: number; note: string; count: number };
  };
  totals: {
    estimatedCalls: number;
    estimatedCost: number;
    actualCallsAvailable?: boolean;
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

interface VenueAnalytics {
  summary: {
    totalVenues: number;
    totalRegions: number;
    totalCategories: number;
    avgRating: number;
    avgReviewCount: number;
  };
  breakdown: Record<string, Record<string, number>>;
  regions: string[];
  categories: string[];
}

interface FilteredVenue {
  id: string;
  name: string;
  address: string;
  rating: string | null;
  reviewCount: number | null;
  priceLevel: number | null;
  photoUrl: string | null;
  googlePlaceId: string | null;
  source: string;
}

interface ScrapedComparison {
  totalScraped: number;
  alreadyInDb: number;
  newVenues: number;
  matchedVenues: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }>;
  newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>;
}

function ScrapedComparisonTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: comparison, isLoading, refetch } = useQuery<ScrapedComparison>({
    queryKey: ["/api/admin/scraped-venues/comparison"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (venues: any[]) => {
      return apiRequest("/api/admin/scraped-venues/upload", "POST", { venues });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload successful",
        description: `Uploaded ${data.count} venues for comparison`,
      });
      setUploadedCount(data.count);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scraped-venues/comparison"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/scraped-venues/clear", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Cleared",
        description: "All scraped venues cleared",
      });
      setUploadedCount(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scraped-venues/comparison"] });
    },
    onError: (error: any) => {
      toast({
        title: "Clear failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const venues = JSON.parse(text);
      
      if (!Array.isArray(venues)) {
        throw new Error("File must contain a JSON array of venues");
      }

      uploadMutation.mutate(venues);
    } catch (error: any) {
      toast({
        title: "File read error",
        description: error.message,
        variant: "destructive",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const matchPercent = comparison 
    ? ((comparison.alreadyInDb / comparison.totalScraped) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="max-w-md"
          data-testid="input-upload-json"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          data-testid="button-upload"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadMutation.isPending ? "Uploading..." : "Upload JSON"}
        </Button>
        {uploadedCount !== null && (
          <Button
            variant="destructive"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            data-testid="button-clear"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading comparison...</p>}

      {comparison && comparison.totalScraped > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Scraped</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{comparison.totalScraped}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Already in DB</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{comparison.alreadyInDb}</div>
                <p className="text-xs text-muted-foreground">{matchPercent}% match rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">New Venues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{comparison.newVenues}</div>
              </CardContent>
            </Card>
          </div>

          {comparison.matchedVenues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Matched Venues ({comparison.matchedVenues.length})</CardTitle>
                <CardDescription>Venues already in database</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scraped Name</TableHead>
                      <TableHead>DB Name</TableHead>
                      <TableHead>Google Place ID</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.matchedVenues.slice(0, 50).map((match, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{match.scrapedName}</TableCell>
                        <TableCell>{match.dbName}</TableCell>
                        <TableCell className="font-mono text-xs">{match.googlePlaceId}</TableCell>
                        <TableCell>
                          <Badge variant={match.source === 'api_auto' ? 'default' : 'secondary'}>
                            {match.source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {comparison.matchedVenues.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing first 50 of {comparison.matchedVenues.length} matches
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {comparison.newVenuesList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>New Venues ({comparison.newVenuesList.length})</CardTitle>
                <CardDescription>Venues not found in database</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Google Place ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.newVenuesList.slice(0, 50).map((venue, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell className="text-sm">{venue.address}</TableCell>
                        <TableCell>{venue.category || 'N/A'}</TableCell>
                        <TableCell>{venue.rating?.toFixed(1) || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{venue.googlePlaceId || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {comparison.newVenuesList.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing first 50 of {comparison.newVenuesList.length} new venues
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("total");
  const [apiLogsService, setApiLogsService] = useState<string>("");
  const [apiLogsMethod, setApiLogsMethod] = useState<string>("");
  const [apiLogsCacheStatus, setApiLogsCacheStatus] = useState<string>("");
  const [apiLogsStatus, setApiLogsStatus] = useState<string>("");
  const [includeTestData, setIncludeTestData] = useState<boolean>(false);
  const [drillDownModal, setDrillDownModal] = useState<{ region: string; category: string } | null>(null);
  const { toast } = useToast();

  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", includeTestData],
    queryFn: async () => {
      const response = await fetch(`/api/admin/stats?includeTestData=${includeTestData}`);
      if (!response.ok) throw new Error('Failed to fetch admin stats');
      return response.json();
    },
  });

  const { data: apiCosts, isLoading: costsLoading } = useQuery<ApiCosts>({
    queryKey: ["/api/admin/api-costs", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/admin/api-costs?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch API costs');
      return response.json();
    },
  });

  const { data: apiLogsData, isLoading: apiLogsLoading } = useQuery<{
    logs: ApiCallLog[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["/api/admin/api-logs", apiLogsService, apiLogsMethod, apiLogsCacheStatus, apiLogsStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (apiLogsService) params.append('service', apiLogsService);
      if (apiLogsMethod) params.append('method', apiLogsMethod);
      if (apiLogsCacheStatus) params.append('cacheStatus', apiLogsCacheStatus);
      if (apiLogsStatus) params.append('status', apiLogsStatus);
      params.append('limit', '100');
      
      const response = await fetch(`/api/admin/api-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch API logs');
      return response.json();
    },
  });

  const { data: deletedVenuesData, isLoading: deletedVenuesLoading } = useQuery<{
    success: boolean;
    deletedVenues: Array<{
      id: string;
      venueData: any;
      deletionReason: string;
      deletedAt: string;
      deletedBy: string | null;
    }>;
  }>({
    queryKey: ["/api/admin/deleted-venues"],
    queryFn: async () => {
      const response = await fetch('/api/admin/deleted-venues');
      if (!response.ok) throw new Error('Failed to fetch deleted venues');
      return response.json();
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<VenueAnalytics>({
    queryKey: ["/api/admin/venue-analytics"],
    queryFn: async () => {
      const response = await fetch('/api/admin/venue-analytics');
      if (!response.ok) throw new Error('Failed to fetch venue analytics');
      return response.json();
    },
  });

  const { data: filteredVenues, isLoading: filteredVenuesLoading } = useQuery<{
    success: boolean;
    region: string;
    category: string;
    count: number;
    venues: FilteredVenue[];
  }>({
    queryKey: ["/api/admin/venues-by-filter", drillDownModal],
    queryFn: async () => {
      if (!drillDownModal) return null;
      const response = await fetch(`/api/admin/venues-by-filter?region=${drillDownModal.region}&category=${drillDownModal.category}`);
      if (!response.ok) throw new Error('Failed to fetch filtered venues');
      return response.json();
    },
    enabled: !!drillDownModal,
  });

  const cachePhotosMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/cache-photos");
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

  const cleanupVenuesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/cleanup-curated-venues");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deleted-venues"] });
      toast({
        title: "Cleanup complete!",
        description: `Removed ${data.stats.removed.total} invalid venues (${data.stats.removed.nonVenues} non-social venues, ${data.stats.removed.missingPhotos} missing photos, ${data.stats.removed.lowQuality} low quality, ${data.stats.removed.duplicates} duplicates). ${data.stats.remaining} venues remaining.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cleanup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const backfillCoordinatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/backfill-favorites-coordinates");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Backfill complete!",
        description: data.message || `Updated ${data.updated} favorites with coordinates`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Backfill failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: backups, isLoading: backupsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/backups"],
    queryFn: async () => {
      const response = await fetch('/api/admin/backups');
      if (!response.ok) throw new Error('Failed to fetch backups');
      return response.json();
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest("POST", "/api/admin/create-backup", { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      toast({
        title: "Backup created!",
        description: "Database backup created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Backup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      return apiRequest("POST", `/api/admin/restore/${backupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      toast({
        title: "Database restored!",
        description: "Database has been restored from backup",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Restore failed",
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-test-data"
              checked={includeTestData}
              onCheckedChange={setIncludeTestData}
              data-testid="switch-include-test-data"
            />
            <Label htmlFor="include-test-data" className="cursor-pointer">
              Include test data
            </Label>
          </div>
          <Button variant="outline" asChild data-testid="button-back-to-dashboard">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="api-logs" data-testid="tab-api-logs">
            <FileText className="h-4 w-4 mr-2" />
            API Logs
          </TabsTrigger>
          <TabsTrigger value="scraped-comparison" data-testid="tab-scraped-comparison">
            <Database className="h-4 w-4 mr-2" />
            Scraped Comparison
          </TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">
            <RefreshCw className="h-4 w-4 mr-2" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="deleted-venues" data-testid="tab-deleted-venues">
            <Database className="h-4 w-4 mr-2" />
            Deleted Venues
          </TabsTrigger>
          <TabsTrigger value="backups" data-testid="tab-backups">
            <Database className="h-4 w-4 mr-2" />
            Backups
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
      {!costsLoading && apiCosts && apiCosts.apiCalls && (
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
              <CardTitle className="flex items-center gap-2">
                API Cost Breakdown
                {apiCosts.totals.actualCallsAvailable && (
                  <Badge variant="default" className="text-xs">Live Data</Badge>
                )}
                {!apiCosts.totals.actualCallsAvailable && (
                  <Badge variant="secondary" className="text-xs">Estimated</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {apiCosts.totals.actualCallsAvailable 
                  ? 'Actual API call costs from logs' 
                  : 'Estimated costs (enable API logging for accurate tracking)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-4 pb-2 border-b font-medium text-sm">
                  <div>API Type</div>
                  <div className="text-right">API Calls</div>
                  <div className="text-right">Cached</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Cost</div>
                </div>

                <div className="grid grid-cols-5 gap-4 items-center">
                  <div>
                    <div className="font-medium">Text Search</div>
                    {apiCosts.apiCalls.textSearch.note && (
                      <div className="text-xs text-muted-foreground">{apiCosts.apiCalls.textSearch.note}</div>
                    )}
                  </div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.textSearch.estimated.toLocaleString()}</div>
                  <div className="text-right text-green-600">{apiCosts.apiCalls.textSearch.cached?.toLocaleString() || 0}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.textSearch.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.textSearch.cost.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-5 gap-4 items-center">
                  <div>
                    <div className="font-medium">
                      Place Details
                      <span className="ml-2 text-xs text-green-600">({apiCosts.apiCalls.placeDetails.tier})</span>
                    </div>
                    {apiCosts.apiCalls.placeDetails.note && (
                      <div className="text-xs text-muted-foreground">{apiCosts.apiCalls.placeDetails.note}</div>
                    )}
                  </div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.placeDetails.estimated.toLocaleString()}</div>
                  <div className="text-right text-green-600">{apiCosts.apiCalls.placeDetails.cached?.toLocaleString() || 0}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.placeDetails.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.placeDetails.cost.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-5 gap-4 items-center">
                  <div>
                    <div className="font-medium">Geocoding</div>
                    {apiCosts.apiCalls.geocoding.note && (
                      <div className="text-xs text-muted-foreground">{apiCosts.apiCalls.geocoding.note}</div>
                    )}
                  </div>
                  <div className="text-right text-muted-foreground">{apiCosts.apiCalls.geocoding.estimated.toLocaleString()}</div>
                  <div className="text-right text-green-600">{apiCosts.apiCalls.geocoding.cached?.toLocaleString() || 0}</div>
                  <div className="text-right text-muted-foreground">${apiCosts.apiCalls.geocoding.pricePerThousand}/1K</div>
                  <div className="text-right font-semibold">${apiCosts.apiCalls.geocoding.cost.toFixed(2)}</div>
                </div>

                {apiCosts.apiCalls.cachedPhotos && (
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <div className="font-medium">Cached Photos</div>
                      <div className="text-xs text-muted-foreground">{apiCosts.apiCalls.cachedPhotos.note}</div>
                    </div>
                    <div className="text-right text-muted-foreground">{apiCosts.apiCalls.cachedPhotos.estimated.toLocaleString()}</div>
                    <div className="text-right">-</div>
                    <div className="text-right text-muted-foreground">${apiCosts.apiCalls.cachedPhotos.pricePerThousand}/1K</div>
                    <div className="text-right font-semibold">${apiCosts.apiCalls.cachedPhotos.cost.toFixed(2)}</div>
                  </div>
                )}

                {apiCosts.apiCalls.uncachedPhotos && (
                  <div className="grid grid-cols-5 gap-4 items-center bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                    <div>
                      <div className="font-medium text-yellow-800 dark:text-yellow-300">Uncached Photos</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400">{apiCosts.apiCalls.uncachedPhotos.note}</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                        {apiCosts.apiCalls.uncachedPhotos.count.toLocaleString()} activities with direct Google URLs
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground">{apiCosts.apiCalls.uncachedPhotos.estimated.toLocaleString()}</div>
                    <div className="text-right">-</div>
                    <div className="text-right text-muted-foreground">${apiCosts.apiCalls.uncachedPhotos.pricePerThousand}/1K</div>
                    <div className="text-right font-semibold text-yellow-800 dark:text-yellow-300">${apiCosts.apiCalls.uncachedPhotos.cost.toFixed(2)}</div>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-4 pt-2 border-t font-bold">
                  <div>Total</div>
                  <div className="text-right">{apiCosts.totals.estimatedCalls.toLocaleString()}</div>
                  <div></div>
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

      {/* Database Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Maintenance
          </CardTitle>
          <CardDescription>One-time data backfill tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-3">
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-200">Backfill Favorites Coordinates</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Add missing latitude/longitude coordinates to existing favorites. This enables the map view on the Favorites tab.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                Uses cached place details when available to minimize API costs
              </p>
            </div>
            <Button
              onClick={() => backfillCoordinatesMutation.mutate()}
              disabled={backfillCoordinatesMutation.isPending}
              className="w-full"
              data-testid="button-backfill-coordinates"
            >
              {backfillCoordinatesMutation.isPending ? (
                <>
                  <MapPin className="mr-2 h-4 w-4 animate-pulse" />
                  Backfilling...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Backfill Coordinates Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-muted-foreground">Loading venue analytics...</div>
            </div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Venues</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalVenues.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Across {analytics.summary.totalRegions} regions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.avgRating}★</div>
                    <p className="text-xs text-muted-foreground">
                      Overall quality
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Reviews</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.avgReviewCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Per venue
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Categories</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalCategories}</div>
                    <p className="text-xs text-muted-foreground">
                      Activity types
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Pivot Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Region × Category Breakdown</CardTitle>
                  <CardDescription>
                    Click any cell to see detailed venue list. Red cells indicate sparse coverage (&lt;10 venues).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-bold">Region</TableHead>
                          {analytics.categories.map((category) => (
                            <TableHead key={category} className="text-center font-bold capitalize">
                              {category}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.regions.map((region) => {
                          const regionData = analytics.breakdown[region] || {};
                          const regionTotal = Object.values(regionData).reduce((sum, count) => sum + count, 0);
                          
                          return (
                            <TableRow key={region}>
                              <TableCell className="font-medium capitalize">{region.replace(/_/g, ' ')}</TableCell>
                              {analytics.categories.map((category) => {
                                const count = regionData[category] || 0;
                                const isSparse = count > 0 && count < 10;
                                
                                return (
                                  <TableCell key={category} className="text-center">
                                    {count > 0 ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`w-full ${isSparse ? 'text-destructive hover:text-destructive' : ''}`}
                                        onClick={() => setDrillDownModal({ region, category })}
                                        data-testid={`cell-${region}-${category}`}
                                      >
                                        {count}
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold">
                                {regionTotal}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="font-bold">
                          <TableCell>Total</TableCell>
                          {analytics.categories.map((category) => {
                            const categoryTotal = analytics.regions.reduce(
                              (sum, region) => sum + (analytics.breakdown[region]?.[category] || 0),
                              0
                            );
                            return (
                              <TableCell key={category} className="text-center">
                                {categoryTotal}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            {analytics.summary.totalVenues}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Drill-down Modal */}
              {drillDownModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDrillDownModal(null)}>
                  <div className="bg-background rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold capitalize">
                          {drillDownModal.region.replace(/_/g, ' ')} - {drillDownModal.category}
                        </h2>
                        <p className="text-muted-foreground">
                          {filteredVenues?.count || 0} venues
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setDrillDownModal(null)}>
                        ×
                      </Button>
                    </div>

                    {filteredVenuesLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="text-muted-foreground">Loading venues...</div>
                      </div>
                    ) : filteredVenues && filteredVenues.venues.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead className="text-center">Rating</TableHead>
                            <TableHead className="text-center">Reviews</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredVenues.venues.map((venue) => (
                            <TableRow key={venue.id}>
                              <TableCell className="font-medium">{venue.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{venue.address}</TableCell>
                              <TableCell className="text-center">
                                {venue.rating ? `${venue.rating}★` : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {venue.reviewCount || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={venue.source === 'manual' ? 'default' : 'secondary'}>
                                  {venue.source}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No venues found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-muted-foreground">No analytics data available</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="api-logs" className="space-y-6">
          <Card data-testid="card-api-logs">
            <CardHeader>
              <CardTitle>API Call Logs</CardTitle>
              <CardDescription>Monitor external API calls with filtering</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Service</label>
                  <Select value={apiLogsService || "all"} onValueChange={(value) => setApiLogsService(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-logs-service">
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="google_places">Google Places</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="google_maps">Google Maps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Method</label>
                  <Input
                    placeholder="e.g. textSearch"
                    value={apiLogsMethod}
                    onChange={(e) => setApiLogsMethod(e.target.value)}
                    data-testid="input-logs-method"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Cache Status</label>
                  <Select value={apiLogsCacheStatus || "all"} onValueChange={(value) => setApiLogsCacheStatus(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-logs-cache-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="hit">Hit</SelectItem>
                      <SelectItem value="miss">Miss</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={apiLogsStatus || "all"} onValueChange={(value) => setApiLogsStatus(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-logs-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(apiLogsService || apiLogsMethod || apiLogsCacheStatus || apiLogsStatus) && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setApiLogsService("");
                      setApiLogsMethod("");
                      setApiLogsCacheStatus("");
                      setApiLogsStatus("");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}

              {/* Logs Table */}
              {apiLogsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiLogsData && apiLogsData.logs.length > 0 ? (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Cache</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Response Time</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiLogsData.logs.map((log) => (
                          <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                            <TableCell className="text-xs">
                              {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.service}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.method}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  log.cacheStatus === 'hit'
                                    ? 'default'
                                    : log.cacheStatus === 'miss'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {log.cacheStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.costEstimate ? `$${parseFloat(log.costEstimate).toFixed(4)}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {log.errorMessage || (log.parameters ? JSON.stringify(log.parameters).slice(0, 50) + '...' : '-')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    Showing {apiLogsData.logs.length} of {apiLogsData.total} logs
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No API logs found {(apiLogsService || apiLogsMethod || apiLogsCacheStatus || apiLogsStatus) && 'matching your filters'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <Card data-testid="card-maintenance">
            <CardHeader>
              <CardTitle>Database Maintenance</CardTitle>
              <CardDescription>
                Tools to clean up and optimize the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cleanup Curated Venues */}
              <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200">Clean Curated Venues Cache</h4>
                  <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                    Remove invalid venues from the curated venues database. This will delete:
                  </p>
                  <ul className="text-sm text-orange-800 dark:text-orange-300 mt-2 ml-4 space-y-1 list-disc">
                    <li>Non-venue businesses (realtors, parking lots, charging stations, etc.)</li>
                    <li>Venues without photos</li>
                    <li>Low-quality venues (less than 3.0★ or fewer than 5 reviews)</li>
                    <li>Duplicate entries</li>
                  </ul>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-3">
                    This improves AI suggestion quality by ensuring only high-quality venues are cached.
                  </p>
                </div>
                <Button
                  onClick={() => cleanupVenuesMutation.mutate()}
                  disabled={cleanupVenuesMutation.isPending}
                  className="w-full"
                  data-testid="button-cleanup-venues"
                  variant="outline"
                >
                  {cleanupVenuesMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Clean Up Curated Venues
                    </>
                  )}
                </Button>
              </div>

              {/* Backfill Coordinates */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200">Backfill Favorites Coordinates</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                    Add missing latitude/longitude coordinates to existing favorites. This enables the map view on the Favorites tab.
                  </p>
                </div>
                <Button
                  onClick={() => backfillCoordinatesMutation.mutate()}
                  disabled={backfillCoordinatesMutation.isPending}
                  className="w-full"
                  data-testid="button-backfill-coordinates"
                  variant="outline"
                >
                  {backfillCoordinatesMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Backfilling...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Backfill Coordinates
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted-venues" className="space-y-6">
          <Card data-testid="card-deleted-venues">
            <CardHeader>
              <CardTitle>Deleted Venues Archive</CardTitle>
              <CardDescription>
                Review venues removed during cleanup operations. These were flagged by AI as not suitable for social gatherings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deletedVenuesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : deletedVenuesData && deletedVenuesData.deletedVenues.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venue Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Deletion Reason</TableHead>
                        <TableHead>Deleted At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedVenuesData.deletedVenues.map((deleted) => (
                        <TableRow key={deleted.id} data-testid={`deleted-venue-row-${deleted.id}`}>
                          <TableCell className="font-medium">
                            {deleted.venueData.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {deleted.venueData.address}
                          </TableCell>
                          <TableCell className="text-sm">
                            {deleted.venueData.rating ? (
                              <Badge variant="secondary">
                                {deleted.venueData.rating}★ ({deleted.venueData.reviewCount || 0})
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-md">
                            <div className="space-y-1">
                              {deleted.deletionReason.split('; ').map((reason, idx) => (
                                <Badge key={idx} variant="outline" className="mr-1">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(deleted.deletedAt), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No deleted venues yet. Run cleanup to start archiving removed venues.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scraped-comparison" className="space-y-6">
          <Card data-testid="card-scraped-comparison">
            <CardHeader>
              <CardTitle>Scraped Venues Comparison</CardTitle>
              <CardDescription>
                Upload scraped venue data to compare with existing database venues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrapedComparisonTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-6">
          <Card data-testid="card-backups">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Database Backups</CardTitle>
                  <CardDescription>
                    Create and restore complete database snapshots to protect against data loss
                  </CardDescription>
                </div>
                <Button
                  onClick={() => createBackupMutation.mutate("")}
                  disabled={createBackupMutation.isPending}
                  data-testid="button-create-backup"
                >
                  {createBackupMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Create Backup
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {backupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : backups && backups.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Groups</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Activities</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.map((backup) => (
                        <TableRow key={backup.id} data-testid={`backup-row-${backup.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(backup.createdAt), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={backup.backupType === 'manual' ? 'default' : 'secondary'}>
                              {backup.backupType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{backup.counts?.groups || 0}</TableCell>
                          <TableCell className="text-sm">{backup.counts?.members || 0}</TableCell>
                          <TableCell className="text-sm">{backup.counts?.activities || 0}</TableCell>
                          <TableCell className="text-sm">{backup.counts?.itineraries || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {backup.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to restore this backup? This will replace all current data.')) {
                                  restoreBackupMutation.mutate(backup.id);
                                }
                              }}
                              disabled={restoreBackupMutation.isPending}
                              data-testid={`button-restore-${backup.id}`}
                            >
                              {restoreBackupMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Restore
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No backups available yet</p>
                  <p className="text-sm mt-2">Create your first backup to protect your data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

