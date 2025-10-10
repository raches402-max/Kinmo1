// Reference: javascript_log_in_with_replit blueprint
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Sparkles, Users, MapPin, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Group, User } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth() as { user: User | undefined };
  
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/user/groups"],
    enabled: !!user,
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Kinmo.ai</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/create-group">
              <Button data-testid="button-create-group">
                <Plus className="mr-2 h-4 w-4" />
                New Group
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => window.location.href = "/api/logout"}
              data-testid="button-logout"
            >
              Sign Out
            </Button>
            {user && (
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={user.profileImageUrl || undefined} 
                  alt={user.firstName || "User"}
                  className="object-cover"
                />
                <AvatarFallback>{getInitials(user.firstName)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {user?.firstName ? `Welcome back, ${user.firstName}!` : "Welcome back!"}
          </h2>
          <p className="text-muted-foreground">
            Manage your group activities and get AI-powered suggestions
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-full" />
                </CardHeader>
                <CardContent className="pb-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <Users className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first group to get AI-powered activity suggestions
                </p>
                <Link href="/create-group">
                  <Button data-testid="button-create-first-group">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Group
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {groups.map((group) => (
              <Link key={group.id} href={`/group/${group.id}`}>
                <Card className="hover-elevate active-elevate-2 transition-all cursor-pointer h-full" data-testid={`card-group-${group.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-2 text-base">
                      <span>{group.name}</span>
                      {group.activityGenerationStatus === "completed" && (
                        <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3 w-3" />
                      {group.locationBase} • {group.meetingFrequency.charAt(0).toUpperCase() + group.meetingFrequency.slice(1)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-3">
                    <div className="text-sm text-muted-foreground">
                      Budget: ${group.budgetMin}-${group.budgetMax}
                    </div>
                    {group.activityGenerationStatus === "generating" && (
                      <div className="text-sm text-primary">
                        Generating suggestions...
                      </div>
                    )}
                    {group.activityGenerationStatus === "failed" && (
                      <div className="text-sm text-destructive">
                        Generation failed
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
