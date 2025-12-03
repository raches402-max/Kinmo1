/**
 * DateFirstEventCreator - Calendar-centric event creation
 *
 * The new date-first flow:
 * 1. WHEN? - Click a date on the calendar
 * 2. WHAT? - Select venues (inline popup) or hold date as TBD
 * 3. DONE - Event created, option to send invites
 *
 * Features:
 * - Visual calendar with existing events marked
 * - Availability heatmap overlay (optional)
 * - Inline venue selector popup
 * - TBD venue support (like Google Calendar)
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  isPast,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Sparkles,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UnifiedEvent } from "@/lib/event-utils";
import { InlineVenueSelector } from "./InlineVenueSelector";

interface VenueOption {
  id: string;
  name: string;
  address?: string;
  category?: string;
  rating?: number;
  photoUrl?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
}

export interface DateFirstEventCreatorProps {
  groupId: string;
  groupLocation?: string;
  events: UnifiedEvent[];
  onEventCreated?: (eventId: string) => void;
  onSendInvites?: (eventId: string) => void;
  className?: string;
}

// Time slot options
const TIME_SLOTS = [
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
];

// Calendar day component
function CalendarDay({
  date,
  currentMonth,
  events,
  isSelected,
  onClick,
}: {
  date: Date;
  currentMonth: Date;
  events: UnifiedEvent[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const dayEvents = events.filter(
    (e) => e.eventDate && isSameDay(new Date(e.eventDate), date)
  );
  const hasEvent = dayEvents.length > 0;
  const isPastDay = isPast(date) && !isToday(date);
  const isCurrentMonth = isSameMonth(date, currentMonth);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPastDay}
      className={cn(
        "relative h-10 w-full rounded-md text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        !isCurrentMonth && "text-muted-foreground/50",
        isPastDay && "text-muted-foreground/30 cursor-not-allowed",
        isToday(date) && "font-bold",
        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
        hasEvent && !isSelected && "font-medium"
      )}
    >
      {format(date, "d")}
      {/* Event indicator dot */}
      {hasEvent && !isSelected && (
        <span
          className={cn(
            "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
            dayEvents[0].status === "confirmed"
              ? "bg-green-500"
              : dayEvents[0].status === "proposed"
              ? "bg-amber-500"
              : "bg-blue-500"
          )}
        />
      )}
    </button>
  );
}

export function DateFirstEventCreator({
  groupId,
  groupLocation = "",
  events,
  onEventCreated,
  onSendInvites,
  className,
}: DateFirstEventCreatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showVenueSelector, setShowVenueSelector] = useState(false);

  // Event form state
  const [eventName, setEventName] = useState("");
  const [eventTime, setEventTime] = useState("7:00 PM");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Add padding days for proper grid alignment
    const startPadding = getDay(start);
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);

    return [...paddedDays, ...days];
  }, [currentMonth]);

  // Handle date click
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setEventName(`Event on ${format(date, "MMM d")}`);
    setShowVenueSelector(true);
  }, []);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      eventDate: string;
      eventTime?: string;
      venues: VenueOption[];
    }) => {
      // Create itinerary with venues
      const response = await fetch(`/api/groups/${groupId}/itineraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          eventDate: data.eventDate,
          eventTime: data.eventTime,
          status: "draft",
          items: data.venues.map((v, index) => ({
            orderIndex: index,
            venueName: v.name,
            venueAddress: v.address,
            venueType: v.category,
            googlePlaceId: v.googlePlaceId,
            googleMapsUrl: v.googleMapsUrl,
            photoUrl: v.photoUrl,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCreatedEventId(data.id);
      setShowVenueSelector(false);
      setShowConfirmDialog(true);
      queryClient.invalidateQueries({
        queryKey: ["/api/groups", groupId, "itineraries"],
      });
      toast({
        title: "Event created!",
        description: "Your event has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create TBD event (venue to be decided)
  const createTbdEventMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      eventDate: string;
      eventTime?: string;
    }) => {
      const response = await fetch(`/api/groups/${groupId}/itineraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          eventDate: data.eventDate,
          eventTime: data.eventTime,
          status: "draft",
          items: [], // Empty venues - TBD
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCreatedEventId(data.id);
      setShowVenueSelector(false);
      setShowConfirmDialog(true);
      queryClient.invalidateQueries({
        queryKey: ["/api/groups", groupId, "itineraries"],
      });
      toast({
        title: "Date held!",
        description: "Event created with venue TBD. You can add venues later.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to hold date",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle venue selection
  const handleVenueSelect = useCallback(
    (venues: VenueOption[]) => {
      if (!selectedDate) return;

      createEventMutation.mutate({
        name: eventName,
        eventDate: format(selectedDate, "yyyy-MM-dd"),
        eventTime,
        venues,
      });
    },
    [selectedDate, eventName, eventTime, createEventMutation]
  );

  // Handle TBD (hold date)
  const handleHoldDate = useCallback(() => {
    if (!selectedDate) return;

    createTbdEventMutation.mutate({
      name: eventName || `Event on ${format(selectedDate, "MMM d")}`,
      eventDate: format(selectedDate, "yyyy-MM-dd"),
      eventTime,
    });
  }, [selectedDate, eventName, eventTime, createTbdEventMutation]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedDate(null);
    setShowVenueSelector(false);
    setEventName("");
  }, []);

  // Handle send invites after creation
  const handleSendInvites = useCallback(() => {
    if (createdEventId && onSendInvites) {
      onSendInvites(createdEventId);
    }
    setShowConfirmDialog(false);
    setCreatedEventId(null);
    setSelectedDate(null);
    setEventName("");
  }, [createdEventId, onSendInvites]);

  // Handle close confirm dialog
  const handleCloseConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setCreatedEventId(null);
    setSelectedDate(null);
    setEventName("");
    if (createdEventId && onEventCreated) {
      onEventCreated(createdEventId);
    }
  }, [createdEventId, onEventCreated]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarIcon className="h-5 w-5" />
          Create Event
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant={selectedDate ? "secondary" : "default"}
            className="text-xs"
          >
            1. Pick Date
          </Badge>
          <span>→</span>
          <Badge
            variant={showVenueSelector ? "default" : "outline"}
            className="text-xs"
          >
            2. Choose Venue
          </Badge>
          <span>→</span>
          <Badge variant="outline" className="text-xs">
            3. Done
          </Badge>
        </div>

        {/* Calendar navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          {/* Week day headers */}
          <div className="grid grid-cols-7 text-center">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) =>
              date ? (
                <CalendarDay
                  key={date.toISOString()}
                  date={date}
                  currentMonth={currentMonth}
                  events={events}
                  isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
                  onClick={() => handleDateClick(date)}
                />
              ) : (
                <div key={`empty-${index}`} className="h-10" />
              )
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Voting</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Draft</span>
          </div>
        </div>

        {/* Inline instructions */}
        {!selectedDate && (
          <p className="text-center text-sm text-muted-foreground">
            Click a date to create an event
          </p>
        )}
      </CardContent>

      {/* Venue Selector Popup */}
      {showVenueSelector && selectedDate && (
        <Dialog open={showVenueSelector} onOpenChange={setShowVenueSelector}>
          <DialogContent className="sm:max-w-lg p-0">
            {/* Event details form */}
            <div className="p-4 border-b space-y-3">
              <div className="space-y-2">
                <Label htmlFor="eventName" className="text-xs">
                  Event Name
                </Label>
                <Input
                  id="eventName"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Dinner with friends"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Date</Label>
                  <div className="text-sm font-medium">
                    {format(selectedDate, "EEEE, MMMM d")}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventTime" className="text-xs">
                    Time
                  </Label>
                  <Select value={eventTime} onValueChange={setEventTime}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Venue selector */}
            <InlineVenueSelector
              groupId={groupId}
              groupLocation={groupLocation}
              selectedDate={selectedDate}
              onSelect={handleVenueSelect}
              onHoldDate={handleHoldDate}
              onCancel={handleCancel}
              className="border-0 shadow-none"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Success Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              Event Created!
            </DialogTitle>
            <DialogDescription>
              Your event has been created. Would you like to send invites to your group now?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleCloseConfirm}>
              Not Now
            </Button>
            <Button onClick={handleSendInvites}>
              Send Invites
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default DateFirstEventCreator;
