import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, Plus, Trash2, Pencil, Check, X, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface VotingEvent {
  id: string;
  title: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  netVotes: number;
}

interface Vote {
  id: string;
  eventId: string;
  userId: string;
  voteType: 'upvote' | 'downvote';
  createdAt: Date;
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export default function YasThis() {
  const { user: authUser, isAuthenticated } = useAuth();
  const user = authUser as User | undefined;
  const { toast } = useToast();
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: events = [], isLoading } = useQuery<VotingEvent[]>({
    queryKey: ["/api/voting-events"],
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/voting-events", {
        title: newEventTitle,
        description: newEventDescription || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events"] });
      setNewEventTitle("");
      setNewEventDescription("");
      setIsDialogOpen(false);
      toast({
        title: "Event added!",
        description: "Your event has been added to the YAS THIS list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string }) => {
      return await apiRequest("PATCH", `/api/voting-events/${id}`, {
        title,
        description: description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events"] });
      setEditingEventId(null);
      toast({
        title: "Event updated!",
        description: "Your event has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events"] });
      toast({
        title: "Event deleted",
        description: "The event has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ eventId, voteType }: { eventId: string; voteType: 'upvote' | 'downvote' }) => {
      return await apiRequest("POST", `/api/voting-events/${eventId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events", "my-votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events", "all-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error voting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeVoteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("DELETE", `/api/voting-events/${eventId}/vote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events", "my-votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voting-events", "all-votes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: votes = {} } = useQuery<Record<string, Vote[]>>({
    queryKey: ["/api/voting-events", "all-votes"],
    queryFn: async () => {
      const result: Record<string, Vote[]> = {};
      for (const event of events) {
        const eventVotes = await fetch(`/api/voting-events/${event.id}/votes`).then(r => r.json());
        result[event.id] = eventVotes;
      }
      return result;
    },
    enabled: events.length > 0,
  });

  const { data: myVotes = {} } = useQuery<Record<string, Vote | null>>({
    queryKey: ["/api/voting-events", "my-votes"],
    queryFn: async () => {
      const result: Record<string, Vote | null> = {};
      for (const event of events) {
        const myVote = await fetch(`/api/voting-events/${event.id}/my-vote`, {
          credentials: 'include'
        }).then(r => r.json());
        result[event.id] = myVote;
      }
      return result;
    },
    enabled: events.length > 0 && isAuthenticated,
  });

  const handleVote = (eventId: string, voteType: 'upvote' | 'downvote') => {
    const currentVote = myVotes[eventId];
    
    if (currentVote?.voteType === voteType) {
      removeVoteMutation.mutate(eventId);
    } else {
      voteMutation.mutate({ eventId, voteType });
    }
  };

  const startEdit = (event: VotingEvent) => {
    setEditingEventId(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = () => {
    if (editingEventId) {
      updateEventMutation.mutate({
        id: editingEventId,
        title: editTitle,
        description: editDescription,
      });
    }
  };

  const getVotersList = (eventId: string, voteType: 'upvote' | 'downvote') => {
    const eventVotes = votes[eventId] || [];
    return eventVotes.filter(v => v.voteType === voteType);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">YAS THIS</h1>
          <p className="text-muted-foreground mt-2">Vote for your favorite events - Top 10 ranking</p>
        </div>
        
        {isAuthenticated && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-event">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Event</DialogTitle>
                <DialogDescription>
                  Add an event for members to vote on
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Event title"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    data-testid="input-event-title"
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Description (optional)"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    data-testid="input-event-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createEventMutation.mutate()}
                  disabled={!newEventTitle.trim() || createEventMutation.isPending}
                  data-testid="button-submit-event"
                >
                  {createEventMutation.isPending ? "Adding..." : "Add Event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Events</CardTitle>
          <CardDescription>Vote with upvotes and downvotes</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events yet. {isAuthenticated && "Be the first to add one!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-center w-32">Upvotes</TableHead>
                  <TableHead className="text-center w-32">Downvotes</TableHead>
                  <TableHead className="text-center w-32">Net</TableHead>
                  {isAuthenticated && <TableHead className="text-center w-48">Vote</TableHead>}
                  {isAuthenticated && <TableHead className="text-center w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event, index) => (
                  <TableRow key={event.id} data-testid={`event-row-${event.id}`}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      {editingEventId === event.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            data-testid={`input-edit-title-${event.id}`}
                          />
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            data-testid={`input-edit-description-${event.id}`}
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium" data-testid={`text-event-title-${event.id}`}>
                            {event.title}
                          </div>
                          {event.description && (
                            <div className="text-sm text-muted-foreground mt-1" data-testid={`text-event-description-${event.id}`}>
                              {event.description}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="secondary" data-testid={`badge-upvotes-${event.id}`}>
                          {event.upvotes}
                        </Badge>
                        {getVotersList(event.id, 'upvote').length > 0 && (
                          <div className="flex -space-x-2">
                            {getVotersList(event.id, 'upvote').slice(0, 3).map((vote, i) => (
                              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs">U</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="secondary" data-testid={`badge-downvotes-${event.id}`}>
                          {event.downvotes}
                        </Badge>
                        {getVotersList(event.id, 'downvote').length > 0 && (
                          <div className="flex -space-x-2">
                            {getVotersList(event.id, 'downvote').slice(0, 3).map((vote, i) => (
                              <Avatar key={i} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs">D</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={event.netVotes > 0 ? "default" : "secondary"}
                        data-testid={`badge-net-votes-${event.id}`}
                      >
                        {event.netVotes > 0 ? '+' : ''}{event.netVotes}
                      </Badge>
                    </TableCell>
                    {isAuthenticated && (
                      <TableCell className="text-center">
                        {editingEventId === event.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={saveEdit}
                              disabled={updateEventMutation.isPending}
                              data-testid={`button-save-edit-${event.id}`}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              data-testid={`button-cancel-edit-${event.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant={myVotes[event.id]?.voteType === 'upvote' ? "default" : "outline"}
                              onClick={() => handleVote(event.id, 'upvote')}
                              data-testid={`button-upvote-${event.id}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={myVotes[event.id]?.voteType === 'downvote' ? "destructive" : "outline"}
                              onClick={() => handleVote(event.id, 'downvote')}
                              data-testid={`button-downvote-${event.id}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                    {isAuthenticated && (
                      <TableCell className="text-center">
                        {user && user.id === event.createdBy && editingEventId !== event.id && (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(event)}
                              data-testid={`button-edit-${event.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              data-testid={`button-delete-${event.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
