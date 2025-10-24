// Reference: javascript_log_in_with_replit blueprint
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Sparkles, Users, MapPin, Calendar, CheckCircle, XCircle, HelpCircle, ExternalLink, Settings, LogOut, MoreVertical, ChevronDown, ChevronRight, Pencil, Trash2, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Group, User, UserProfile, GroupCollection } from "@shared/schema";
import { useState } from "react";

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
};
import { TimeSlotVoting } from "@/components/TimeSlotVoting";

type UserEvent = {
  inviteId: string;
  inviteToken: string;
  itineraryId: string;
  itineraryName: string;
  eventDate: string | null;
  status: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  isOrganizer: boolean;
  rsvp: {
    response: string;
    rsvpFeedback: any;
  } | null;
  items: Array<{
    id: string;
    venueName: string;
    venueType: string;
    venueAddress: string;
    photoUrl: string | null;
  }>;
};

export default function Dashboard() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();
  
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameCollectionName, setRenameCollectionName] = useState("");
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());
  
  const { data: groups = [], isLoading } = useQuery<Array<Group & { members: SafeMember[] }>>({
    queryKey: ["/api/user/groups"],
    enabled: !!user,
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<GroupCollection[]>({
    queryKey: ["/api/user/collections"],
    enabled: !!user,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<UserEvent[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
  });

  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  // Collection mutations
  const createCollectionMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const orderIndex = collections.length;
      return await apiRequest("POST", "/api/user/collections", { name, orderIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      setCreateCollectionOpen(false);
      setNewCollectionName("");
      toast({
        title: "Collection created",
        description: "Your new collection has been created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create collection",
        variant: "destructive",
      });
    },
  });

  const updateCollectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/user/collections/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      setRenamingCollectionId(null);
      setRenameCollectionName("");
      toast({
        title: "Collection renamed",
        description: "Collection name has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rename collection",
        variant: "destructive",
      });
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/user/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Collection deleted",
        description: "Groups moved to All Groups",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete collection",
        variant: "destructive",
      });
    },
  });

  const moveGroupToCollectionMutation = useMutation({
    mutationFn: async ({ groupId, collectionId }: { groupId: string; collectionId: string | null }) => {
      const targetGroups = collectionId 
        ? groups.filter(g => g.collectionId === collectionId)
        : groups.filter(g => !g.collectionId);
      const orderIndex = targetGroups.length;
      return await apiRequest("PATCH", `/api/groups/${groupId}/collection`, { collectionId, orderIndex });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      toast({
        title: "Group moved",
        description: "Group has been moved to the collection",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move group",
        variant: "destructive",
      });
    },
  });

  // RSVP mutation for members
  const rsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, inviteToken, response }: { itineraryId: string; inviteToken: string; response: string }) => {
      return await apiRequest("POST", `/api/rsvps`, { itineraryId, inviteToken, response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "RSVP submitted!",
        description: "Your response has been recorded",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit RSVP",
        variant: "destructive",
      });
    },
  });

  // RSVP mutation for organizers
  const organizerRsvpMutation = useMutation({
    mutationFn: async ({ itineraryId, response }: { itineraryId: string; response: string }) => {
      return await apiRequest("POST", `/api/itineraries/${itineraryId}/organizer-rsvp`, { response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      toast({
        title: "RSVP submitted!",
        description: "Your response has been recorded",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit RSVP",
        variant: "destructive",
      });
    },
  });

  // Categorize events
  const now = new Date();
  // Pending: Non-organizer events with no RSVP
  const pendingInvites = events.filter(e => !e.isOrganizer && !e.rsvp && (!e.eventDate || new Date(e.eventDate) > now));
  // Upcoming: Organizers OR events with RSVP (excluding 'no') that haven't happened yet
  const upcomingEvents = events.filter(e => {
    const isFutureOrTBD = !e.eventDate || new Date(e.eventDate) > now;
    if (e.isOrganizer) return isFutureOrTBD;
    return e.rsvp && e.rsvp.response !== 'no' && isFutureOrTBD;
  });
  const pastEvents = events.filter(e => e.eventDate && new Date(e.eventDate) <= now);

  // Organize groups by collection
  const uncategorizedGroups = groups.filter(g => !g.collectionId);
  const collectionGroups = collections.map(collection => ({
    collection,
    groups: groups.filter(g => g.collectionId === collection.id),
  }));

  const toggleCollection = (collectionId: string) => {
    setOpenCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const getFirstInitial = (name?: string | null) => {
    if (!name) return "U";
    const firstWord = name.trim().split(" ")[0];
    return firstWord[0]?.toUpperCase() || "U";
  };

  const displayName = profile?.displayName || user?.firstName || "User";

  const GroupCard = ({ group, showMenu = true }: { group: Group & { members: SafeMember[] }; showMenu?: boolean }) => (
    <Card className="hover-elevate active-elevate-2 transition-all h-full relative group" data-testid={`card-group-${group.id}`}>
      <Link href={`/group/${group.id}`} className="block">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-start justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              <span className="text-2xl" data-testid={`emoji-group-${group.id}`}>{group.emoji || "🎉"}</span>
              <span>{group.name}</span>
            </div>
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
          {group.members && group.members.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="flex -space-x-2" data-testid={`members-preview-${group.id}`}>
                {group.members.slice(0, 3).map((member, idx) => (
                  <Avatar key={member.id} className="h-6 w-6 border-2 border-background" data-testid={`avatar-member-${idx}`}>
                    <AvatarFallback className="text-xs bg-muted">
                      {getFirstInitial(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {group.members.length > 3 && (
                  <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center" data-testid="members-overflow">
                    <span className="text-xs text-muted-foreground">+{group.members.length - 3}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}
        </CardContent>
      </Link>
      {showMenu && (
        <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-group-menu-${group.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Group Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid={`menu-move-to-collection-${group.id}`}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Move to Collection
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem 
                    onClick={() => moveGroupToCollectionMutation.mutate({ groupId: group.id, collectionId: null })}
                    data-testid={`menu-move-none-${group.id}`}
                  >
                    None (All Groups)
                  </DropdownMenuItem>
                  {collections.map(collection => (
                    <DropdownMenuItem
                      key={collection.id}
                      onClick={() => moveGroupToCollectionMutation.mutate({ groupId: group.id, collectionId: collection.id })}
                      data-testid={`menu-move-${collection.id}-${group.id}`}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link href={`/group/${group.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Group
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );

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
            <Link href="/events">
              <Button variant="outline" className="relative" data-testid="button-my-events">
                <Calendar className="mr-2 h-4 w-4" />
                My Events
                {pendingInvites.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 px-1.5 min-w-5 h-5 flex items-center justify-center"
                    data-testid="badge-pending-count"
                  >
                    {pendingInvites.length}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/create-group">
              <Button data-testid="button-create-group">
                <Plus className="mr-2 h-4 w-4" />
                New Group
              </Button>
            </Link>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0" data-testid="button-user-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={user.profileImageUrl || undefined} 
                        alt={displayName}
                        className="object-cover"
                      />
                      <AvatarFallback>{getFirstInitial(displayName)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href="/profile">
                    <DropdownMenuItem data-testid="menu-profile">
                      <Settings className="mr-2 h-4 w-4" />
                      Profile Settings
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => window.location.href = "/api/logout"}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {displayName.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground">
            Manage your group activities and get AI-powered suggestions
          </p>
        </div>

        <Tabs defaultValue="my-events" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="my-events" data-testid="tab-my-events">My Events</TabsTrigger>
            <TabsTrigger value="my-groups" data-testid="tab-my-groups">My Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="my-events" data-testid="content-my-events">
            <div className="space-y-8">
              {/* Loading State */}
              {eventsLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}

              {/* Pending Invites Section */}
              {!eventsLoading && pendingInvites.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Pending Invites ({pendingInvites.length})</h3>
                  <div className="space-y-3">
                    {pendingInvites.map((event) => (
                      <Card key={event.inviteId} className="hover-elevate" data-testid={`event-card-${event.itineraryId}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <span className="text-xl">{event.groupEmoji}</span>
                                {event.itineraryName}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {event.groupName} • {event.eventDate ? format(new Date(event.eventDate), 'MMM d, yyyy • h:mm a') : 'Date TBD'}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                              RSVP Needed
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex gap-2 flex-wrap">
                            {event.items.slice(0, 3).map((venue, idx) => (
                              <Badge key={venue.id} variant="secondary">
                                {idx + 1}. {venue.venueName}
                              </Badge>
                            ))}
                            {event.items.length > 3 && (
                              <Badge variant="secondary">+{event.items.length - 3} more</Badge>
                            )}
                          </div>

                          <TimeSlotVoting 
                            itineraryId={event.itineraryId}
                            userId={user?.id}
                            isOrganizer={false}
                          />

                          <div className="flex gap-2 flex-wrap">
                            <Button 
                              variant="default"
                              size="sm"
                              onClick={() => rsvpMutation.mutate({ itineraryId: event.itineraryId, inviteToken: event.inviteToken, response: 'yes' })}
                              disabled={rsvpMutation.isPending}
                              className="gap-1"
                              data-testid={`button-yes-${event.itineraryId}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Yes, I'm In
                            </Button>
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => rsvpMutation.mutate({ itineraryId: event.itineraryId, inviteToken: event.inviteToken, response: 'maybe' })}
                              disabled={rsvpMutation.isPending}
                              className="gap-1"
                              data-testid={`button-maybe-${event.itineraryId}`}
                            >
                              <HelpCircle className="h-4 w-4" />
                              Yes, if...
                            </Button>
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => rsvpMutation.mutate({ itineraryId: event.itineraryId, inviteToken: event.inviteToken, response: 'no' })}
                              disabled={rsvpMutation.isPending}
                              className="gap-1"
                              data-testid={`button-no-${event.itineraryId}`}
                            >
                              <XCircle className="h-4 w-4" />
                              Can't Make It
                            </Button>
                            <Link href={`/rsvp/${event.itineraryId}/${event.inviteToken}`}>
                              <Button variant="ghost" size="sm" className="gap-1">
                                <ExternalLink className="h-4 w-4" />
                                Details
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events Section */}
              {!eventsLoading && upcomingEvents.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Upcoming Events ({upcomingEvents.length})</h3>
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => {
                      // Organizer events get RSVP status badge and buttons
                      if (event.isOrganizer) {
                        const rsvpResponse = event.rsvp?.response;
                        const badgeConfig = {
                          yes: { variant: "default" as const, icon: CheckCircle, text: "Going", className: "" },
                          maybe: { variant: "secondary" as const, icon: HelpCircle, text: "Maybe", className: "" },
                          no: { variant: "outline" as const, icon: XCircle, text: "Declined", className: "" },
                        };
                        const organizerBadge = { variant: "default" as const, icon: Sparkles, text: "Organizer", className: "" };
                        const badge = rsvpResponse ? badgeConfig[rsvpResponse as 'yes' | 'maybe' | 'no'] : organizerBadge;

                        return (
                          <Card key={event.inviteId} className={`hover-elevate ${rsvpResponse === 'yes' ? 'border-primary/50' : ''}`} data-testid={`upcoming-event-${event.itineraryId}`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex-1">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <span className="text-xl">{event.groupEmoji}</span>
                                    {event.itineraryName}
                                  </CardTitle>
                                  <CardDescription className="mt-1">
                                    {event.groupName} • {event.eventDate ? format(new Date(event.eventDate), 'MMM d, yyyy • h:mm a') : 'Date TBD'}
                                  </CardDescription>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="outline" className="gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Organizer
                                  </Badge>
                                  {rsvpResponse && (
                                    <Badge variant={badge.variant} className={`gap-1 ${badge.className}`}>
                                      <badge.icon className="h-3 w-3" />
                                      {badge.text}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex gap-2 flex-wrap">
                                {event.items.slice(0, 3).map((venue, idx) => (
                                  <Badge key={venue.id} variant="secondary">
                                    {idx + 1}. {venue.venueName}
                                  </Badge>
                                ))}
                                {event.items.length > 3 && (
                                  <Badge variant="secondary">+{event.items.length - 3} more</Badge>
                                )}
                              </div>

                              <TimeSlotVoting 
                                itineraryId={event.itineraryId}
                                userId={user?.id}
                                isOrganizer={true}
                              />
                              
                              {/* RSVP Buttons */}
                              <div className="flex gap-2 flex-wrap">
                                <Button 
                                  variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => organizerRsvpMutation.mutate({ itineraryId: event.itineraryId, response: 'yes' })}
                                  disabled={organizerRsvpMutation.isPending}
                                  className="gap-1"
                                  data-testid={`button-yes-${event.itineraryId}`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Going
                                </Button>
                                <Button 
                                  variant={rsvpResponse === 'maybe' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => organizerRsvpMutation.mutate({ itineraryId: event.itineraryId, response: 'maybe' })}
                                  disabled={organizerRsvpMutation.isPending}
                                  className="gap-1"
                                  data-testid={`button-maybe-${event.itineraryId}`}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                  Maybe
                                </Button>
                                <Button 
                                  variant={rsvpResponse === 'no' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => organizerRsvpMutation.mutate({ itineraryId: event.itineraryId, response: 'no' })}
                                  disabled={organizerRsvpMutation.isPending}
                                  className="gap-1"
                                  data-testid={`button-no-${event.itineraryId}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                  Can't Make It
                                </Button>
                                <Link href={`/group/${event.groupId}?edit=${event.itineraryId}`}>
                                  <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-manage-${event.itineraryId}`}>
                                    <Users className="h-4 w-4" />
                                    Manage
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      // Member events with RSVP
                      const rsvpResponse = event.rsvp?.response;
                      const badgeConfig = {
                        yes: { variant: "default" as const, icon: CheckCircle, text: "Going", className: "" },
                        maybe: { variant: "secondary" as const, icon: HelpCircle, text: "Maybe", className: "" },
                        no: { variant: "outline" as const, icon: XCircle, text: "Declined", className: "" },
                      };
                      const badge = badgeConfig[rsvpResponse as 'yes' | 'maybe' | 'no'] || badgeConfig.yes;

                      return (
                        <Card key={event.inviteId} className={`hover-elevate ${rsvpResponse === 'yes' ? 'border-primary/50' : ''}`} data-testid={`upcoming-event-${event.itineraryId}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <span className="text-xl">{event.groupEmoji}</span>
                                  {event.itineraryName}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {event.groupName} • {event.eventDate ? format(new Date(event.eventDate), 'MMM d, yyyy • h:mm a') : 'Date TBD'}
                                </CardDescription>
                              </div>
                              <Badge variant={badge.variant} className={`gap-1 ${badge.className}`}>
                                <badge.icon className="h-3 w-3" />
                                {badge.text}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex gap-2 flex-wrap">
                              {event.items.slice(0, 3).map((venue, idx) => (
                                <Badge key={venue.id} variant="secondary">
                                  {idx + 1}. {venue.venueName}
                                </Badge>
                              ))}
                              {event.items.length > 3 && (
                                <Badge variant="secondary">+{event.items.length - 3} more</Badge>
                              )}
                            </div>

                            <TimeSlotVoting 
                              itineraryId={event.itineraryId}
                              userId={user?.id}
                              isOrganizer={false}
                            />

                            <Link href={`/rsvp/${event.itineraryId}/${event.inviteToken}`}>
                              <Button variant="outline" className="gap-2" data-testid={`button-view-${event.itineraryId}`}>
                                <ExternalLink className="h-4 w-4" />
                                View Details
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past Events Section */}
              {!eventsLoading && pastEvents.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Past Events ({pastEvents.length})</h3>
                  <div className="space-y-3">
                    {pastEvents.map((event) => (
                      <Card key={event.inviteId} className="opacity-75" data-testid={`past-event-${event.itineraryId}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <span className="text-xl">{event.groupEmoji}</span>
                                {event.itineraryName}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {event.groupName} • {event.eventDate ? format(new Date(event.eventDate), 'MMM d, yyyy • h:mm a') : 'Date TBD'}
                              </CardDescription>
                            </div>
                            {event.isOrganizer ? (
                              <Badge variant="default" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                Organizer
                              </Badge>
                            ) : event.rsvp && (
                              <Badge variant={event.rsvp.response === 'yes' ? 'default' : 'outline'}>
                                {event.rsvp.response === 'yes' ? 'Attended' : event.rsvp.response === 'maybe' ? 'Maybe' : 'Declined'}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 flex-wrap">
                            {event.items.slice(0, 3).map((venue, idx) => (
                              <Badge key={venue.id} variant="secondary">
                                {idx + 1}. {venue.venueName}
                              </Badge>
                            ))}
                            {event.items.length > 3 && (
                              <Badge variant="secondary">+{event.items.length - 3} more</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!eventsLoading && events.length === 0 && (
                <Card className="text-center py-12">
                  <CardContent>
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                    <p className="text-muted-foreground">
                      When you're invited to events or create plans for your groups, they'll appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-groups" data-testid="content-my-groups">
            <div className="space-y-6">
              {/* New Collection Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={() => setCreateCollectionOpen(true)}
                  data-testid="button-new-collection"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Collection
                </Button>
              </div>

              {isLoading || collectionsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
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
                <div className="space-y-4">
                  {/* Collection Sections */}
                  {collectionGroups.map(({ collection, groups: collectionGroupsList }) => (
                    <Collapsible
                      key={collection.id}
                      open={!openCollections.has(collection.id)}
                      onOpenChange={() => toggleCollection(collection.id)}
                      data-testid={`collapsible-collection-${collection.id}`}
                    >
                      <div className="border rounded-md p-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -ml-2 flex-1" data-testid={`trigger-collection-${collection.id}`}>
                            {openCollections.has(collection.id) ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <h3 className="text-lg font-semibold">
                              {renamingCollectionId === collection.id ? (
                                <Input
                                  value={renameCollectionName}
                                  onChange={(e) => setRenameCollectionName(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      updateCollectionMutation.mutate({ id: collection.id, name: renameCollectionName });
                                    } else if (e.key === 'Escape') {
                                      setRenamingCollectionId(null);
                                      setRenameCollectionName("");
                                    }
                                  }}
                                  onBlur={() => {
                                    if (renameCollectionName && renameCollectionName !== collection.name) {
                                      updateCollectionMutation.mutate({ id: collection.id, name: renameCollectionName });
                                    } else {
                                      setRenamingCollectionId(null);
                                      setRenameCollectionName("");
                                    }
                                  }}
                                  autoFocus
                                  className="h-7"
                                  data-testid={`input-rename-collection-${collection.id}`}
                                />
                              ) : (
                                collection.name
                              )}
                            </h3>
                            <Badge variant="secondary" className="ml-2">
                              {collectionGroupsList.length}
                            </Badge>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingCollectionId(collection.id);
                                setRenameCollectionName(collection.name);
                              }}
                              data-testid={`button-rename-collection-${collection.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${collection.name}" collection? Groups will be moved to All Groups.`)) {
                                  deleteCollectionMutation.mutate(collection.id);
                                }
                              }}
                              data-testid={`button-delete-collection-${collection.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          {collectionGroupsList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              No groups in this collection yet
                            </p>
                          ) : (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                              {collectionGroupsList.map((group) => (
                                <GroupCard key={group.id} group={group} />
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}

                  {/* All Groups (Uncategorized) Section */}
                  {uncategorizedGroups.length > 0 && (
                    <Collapsible
                      open={!openCollections.has('uncategorized')}
                      onOpenChange={() => toggleCollection('uncategorized')}
                      data-testid="collapsible-all-groups"
                    >
                      <div className="border rounded-md p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -ml-2 flex-1" data-testid="trigger-all-groups">
                            {openCollections.has('uncategorized') ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <h3 className="text-lg font-semibold">All Groups</h3>
                            <Badge variant="secondary" className="ml-2">
                              {uncategorizedGroups.length}
                            </Badge>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                            {uncategorizedGroups.map((group) => (
                              <GroupCard key={group.id} group={group} />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Collection Dialog */}
      <Dialog open={createCollectionOpen} onOpenChange={setCreateCollectionOpen}>
        <DialogContent data-testid="dialog-create-collection">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Organize your groups into collections for better management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., Family Groups, Work Friends, Book Clubs"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCollectionName.trim()) {
                    createCollectionMutation.mutate({ name: newCollectionName.trim() });
                  }
                }}
                data-testid="input-collection-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCollectionOpen(false);
                setNewCollectionName("");
              }}
              data-testid="button-cancel-collection"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newCollectionName.trim()) {
                  createCollectionMutation.mutate({ name: newCollectionName.trim() });
                }
              }}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
              data-testid="button-create-collection"
            >
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
