/**
 * Prototype: Event Details Desktop - Clean Design
 *
 * Removed:
 * - "Organizer" badge (everywhere)
 * - "AI-hosted" badge
 * - "Hosted by X" header badges
 *
 * Added:
 * - Discrete "Host" badge in attendee list only
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  Star,
  Plus,
  Edit2,
  Trash2,
  Check,
  Send,
  Share2,
  UserPlus,
  ExternalLink,
  Navigation,
  Copy,
  X,
  ChevronDown,
  GripVertical,
  Sparkles,
} from "lucide-react";

// Event status type
type EventStatus = "draft" | "sent" | "finalized";
type RsvpStatus = "yes" | "maybe" | "pending" | "no";

// Mock data for the prototype
const mockEvent = {
  name: "Ladles Wicked To",
  groupName: "sweatshorts",
  groupEmoji: "🩳",
  status: "sent" as EventStatus,
  date: "2024-12-15",
  dateDisplay: "Saturday, December 14",
  startTime: "7:00 PM",
  endTime: "10:00 PM",
  timezone: "America/Los_Angeles",
  timezoneDisplay: "PST",
  isOrganizer: true,
  hostMemberId: "1", // Rachel is the host
  venues: [
    {
      id: "1",
      name: "Ladles",
      type: "Restaurant",
      rating: 4.6,
      address: "1192 Folsom St, San Francisco, CA",
      mapsUrl: "https://maps.google.com/?q=Ladles+San+Francisco",
      photoUrl: null,
    },
  ],
  attendees: [
    { id: "1", name: "Rachel", email: "rachel@email.com", status: "yes" as RsvpStatus, isHost: true, isGuest: false, initials: "R" },
    { id: "2", name: "Eric", email: "eric@email.com", status: "yes" as RsvpStatus, isHost: false, isGuest: false, initials: "E" },
    { id: "3", name: "John", email: "john@email.com", status: "maybe" as RsvpStatus, isHost: false, isGuest: false, initials: "J" },
    { id: "4", name: "Sarah", email: "sarah@email.com", status: "pending" as RsvpStatus, isHost: false, isGuest: false, initials: "S" },
  ],
};

// RSVP color mapping
const rsvpColors: Record<RsvpStatus, { bg: string; text: string; border: string }> = {
  yes: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  maybe: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  pending: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
  no: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const rsvpLabels: Record<RsvpStatus, string> = {
  yes: "Going",
  maybe: "Maybe",
  pending: "Pending",
  no: "Can't Go",
};

// Venue Card Component
function VenueCard({ venue }: { venue: typeof mockEvent.venues[0] }) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="mt-1 cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Venue Photo Placeholder */}
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {venue.photoUrl ? (
            <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover" />
          ) : (
            <MapPin className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        {/* Venue Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-lg text-foreground">{venue.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{venue.type}</span>
                {venue.rating && (
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-muted-foreground">{venue.rating}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Edit/Delete Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address */}
          <a
            href={venue.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Navigation className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venue.address}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}

// Attendee Card Component - with discrete Host badge
function AttendeeCard({ attendee, isCurrentUser }: {
  attendee: typeof mockEvent.attendees[0];
  isCurrentUser: boolean;
}) {
  const colors = rsvpColors[attendee.status];

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      colors.border,
      colors.bg,
      isCurrentUser && "ring-2 ring-primary/20"
    )}>
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn(
          "text-sm font-medium",
          attendee.status === "yes" ? "bg-emerald-100 text-emerald-700" :
          attendee.status === "maybe" ? "bg-amber-100 text-amber-700" :
          attendee.status === "no" ? "bg-red-100 text-red-700" :
          "bg-slate-100 text-slate-600"
        )}>
          {attendee.initials}
        </AvatarFallback>
      </Avatar>

      {/* Name + Host badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{attendee.name}</span>
          {attendee.isHost && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-medium bg-primary/5 border-primary/20 text-primary"
            >
              Host
            </Badge>
          )}
          {attendee.isGuest && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              Guest
            </Badge>
          )}
        </div>
        <span className={cn("text-xs", colors.text)}>{rsvpLabels[attendee.status]}</span>
      </div>

      {/* RSVP Status Icon */}
      <div className={cn(
        "flex items-center justify-center w-6 h-6 rounded-full",
        attendee.status === "yes" && "bg-emerald-500 text-white",
        attendee.status === "maybe" && "bg-amber-500 text-white",
        attendee.status === "pending" && "bg-slate-300 text-slate-600",
        attendee.status === "no" && "bg-red-500 text-white"
      )}>
        {attendee.status === "yes" && <Check className="h-3.5 w-3.5" />}
        {attendee.status === "maybe" && <span className="text-xs font-bold">?</span>}
        {attendee.status === "pending" && <Clock className="h-3.5 w-3.5" />}
        {attendee.status === "no" && <X className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}

export default function PrototypeEventDetailsDesktop() {
  const [event] = useState(mockEvent);
  const [userRsvp, setUserRsvp] = useState<RsvpStatus>("yes");

  // Calculate RSVP summary
  const rsvpSummary = {
    yes: event.attendees.filter(a => a.status === "yes").length,
    maybe: event.attendees.filter(a => a.status === "maybe").length,
    pending: event.attendees.filter(a => a.status === "pending").length,
    no: event.attendees.filter(a => a.status === "no").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to {event.groupName}
          </Button>

          {/* Clean header actions - NO organizer/host badges here */}
          <div className="flex items-center gap-2">
            {event.status === "draft" && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                Draft
              </Badge>
            )}
            {event.status === "draft" && (
              <Button size="sm" className="gap-2">
                <Send className="h-4 w-4" />
                Send to Group
              </Button>
            )}
            {event.isOrganizer && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column - Event Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Event Header Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span className="text-lg">{event.groupEmoji}</span>
                      <span>{event.groupName}</span>
                    </div>
                    <CardTitle className="text-2xl font-bold">{event.name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date & Time */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{event.dateDisplay}</div>
                    <div className="text-sm text-muted-foreground">
                      {event.startTime} - {event.endTime} {event.timezoneDisplay}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Venues Section */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  Venues
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.venues.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Attendees & Actions */}
          <div className="space-y-6">

            {/* Your RSVP */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Your Response</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {(["yes", "maybe", "no"] as RsvpStatus[]).map((status) => (
                    <Button
                      key={status}
                      variant={userRsvp === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUserRsvp(status)}
                      className={cn(
                        "h-10",
                        userRsvp === status && status === "yes" && "bg-emerald-600 hover:bg-emerald-700",
                        userRsvp === status && status === "maybe" && "bg-amber-500 hover:bg-amber-600",
                        userRsvp === status && status === "no" && "bg-red-500 hover:bg-red-600"
                      )}
                    >
                      {status === "yes" && <Check className="h-4 w-4 mr-1" />}
                      {rsvpLabels[status]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Attendees */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Attendees
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="text-emerald-600 font-medium">{rsvpSummary.yes}</span>
                    <span>/</span>
                    <span>{event.attendees.length}</span>
                  </div>
                </div>
                {/* RSVP Summary Pills */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {rsvpSummary.yes} going
                  </Badge>
                  {rsvpSummary.maybe > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {rsvpSummary.maybe} maybe
                    </Badge>
                  )}
                  {rsvpSummary.pending > 0 && (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                      {rsvpSummary.pending} pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {event.attendees.map((attendee) => (
                  <AttendeeCard
                    key={attendee.id}
                    attendee={attendee}
                    isCurrentUser={attendee.id === "1"}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Share & Manage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Invite Link
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Guest
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Share2 className="h-4 w-4" />
                  Hand Off Host
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Design Notes - For Review */}
        <div className="mt-12 p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
          <h3 className="font-bold text-lg mb-3 text-primary">🎨 Design Changes Made</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 text-foreground">✅ Removed</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Organizer" badge from header</li>
                <li>• "Organizer" badge from attendee list</li>
                <li>• "AI-hosted" badge</li>
                <li>• "Hosted by X" / "You're hosting" header badges</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-foreground">✅ Added/Kept</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Small discrete "Host" badge next to Rachel's name</li>
                <li>• Draft badge (when applicable)</li>
                <li>• Send to Group button (when draft)</li>
                <li>• Delete button (for organizers)</li>
              </ul>
            </div>
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            <strong>Look at the attendee list</strong> - Rachel has a small "Host" badge. That's the only place hosting info appears now. Clean and simple!
          </p>
        </div>
      </main>
    </div>
  );
}
