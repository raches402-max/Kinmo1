/**
 * Prototype: Timeline Info Tooltip
 *
 * Demonstrates the discreet timeline info feature for the event detail page.
 * Shows a small info icon next to "Send to Group" that reveals RSVP deadline
 * and invite timing on hover.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Send, Share2, Clock, CalendarDays, Mail, Check } from "lucide-react";
import { format, addDays, subDays } from "date-fns";

// Mock data for different scenarios
const scenarios = [
  {
    id: "not-sent",
    name: "Invites Not Yet Sent",
    description: "Event is 10 days away, invites scheduled to auto-send in 3 days",
    eventDate: addDays(new Date(), 10),
    inviteSentAt: null,
    rsvpDeadline: addDays(new Date(), 8),
    autoScheduleConfig: {
      inviteAdvanceDays: 7,
      rsvpWindowDays: 5,
      timelineType: "standard",
    },
  },
  {
    id: "sent",
    name: "Invites Already Sent",
    description: "Event is 5 days away, invites were sent 2 days ago",
    eventDate: addDays(new Date(), 5),
    inviteSentAt: subDays(new Date(), 2),
    rsvpDeadline: addDays(new Date(), 3),
    autoScheduleConfig: {
      inviteAdvanceDays: 7,
      rsvpWindowDays: 4,
      timelineType: "standard",
    },
  },
  {
    id: "urgent",
    name: "Urgent Timeline",
    description: "Event is 3 days away, compressed timeline",
    eventDate: addDays(new Date(), 3),
    inviteSentAt: new Date(),
    rsvpDeadline: addDays(new Date(), 2),
    autoScheduleConfig: {
      inviteAdvanceDays: 3,
      rsvpWindowDays: 2,
      timelineType: "urgent",
    },
  },
  {
    id: "past-deadline",
    name: "Past RSVP Deadline",
    description: "RSVPs are closed, event is tomorrow",
    eventDate: addDays(new Date(), 1),
    inviteSentAt: subDays(new Date(), 5),
    rsvpDeadline: subDays(new Date(), 1),
    autoScheduleConfig: {
      inviteAdvanceDays: 7,
      rsvpWindowDays: 5,
      timelineType: "standard",
    },
  },
];

function TimelineInfoTooltip({
  eventDate,
  inviteSentAt,
  rsvpDeadline,
  autoScheduleConfig,
}: {
  eventDate: Date;
  inviteSentAt: Date | null;
  rsvpDeadline: Date;
  autoScheduleConfig: {
    inviteAdvanceDays: number;
    rsvpWindowDays: number;
    timelineType: string;
  };
}) {
  const now = new Date();
  const isPastDeadline = rsvpDeadline < now;
  const inviteSendDate = inviteSentAt || subDays(eventDate, autoScheduleConfig.inviteAdvanceDays);
  const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilRsvp = Math.ceil((rsvpDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center rounded-full p-1 hover:bg-muted/50 transition-colors cursor-help">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[220px] p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>
                <span className="text-muted-foreground">Event:</span>{" "}
                <span className="font-medium">{format(eventDate, "MMM d")}</span>
                <span className="text-muted-foreground/70 ml-1">
                  ({daysUntilEvent} day{daysUntilEvent !== 1 ? "s" : ""})
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span>
                <span className="text-muted-foreground">
                  {inviteSentAt ? "Invites sent:" : "Auto-sends:"}
                </span>{" "}
                <span className="font-medium">{format(inviteSendDate, "MMM d")}</span>
                {!inviteSentAt && (
                  <span className="text-muted-foreground/70 ml-1">
                    ({autoScheduleConfig.inviteAdvanceDays}d before)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${isPastDeadline ? "text-muted-foreground" : "text-amber-500"}`} />
              <span>
                <span className="text-muted-foreground">RSVPs due:</span>{" "}
                <span className={`font-medium ${isPastDeadline ? "line-through text-muted-foreground" : ""}`}>
                  {format(rsvpDeadline, "MMM d")}
                </span>
                {isPastDeadline ? (
                  <span className="text-muted-foreground/70 ml-1">(closed)</span>
                ) : (
                  <span className="text-muted-foreground/70 ml-1">
                    ({daysUntilRsvp} day{daysUntilRsvp !== 1 ? "s" : ""})
                  </span>
                )}
              </span>
            </div>

            {autoScheduleConfig.timelineType !== "standard" && (
              <div className="pt-1 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                  {autoScheduleConfig.timelineType} timeline
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Mockup of the FloatingActionBar with timeline info
function MockFloatingActionBar({
  scenario,
  variant,
}: {
  scenario: (typeof scenarios)[0];
  variant: "icon" | "inline";
}) {
  const [sent, setSent] = useState(false);

  if (variant === "inline") {
    // Option B: Inline text below buttons
    return (
      <div className="bg-background border-t border-border p-4 space-y-2">
        <div className="flex gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={() => setSent(true)}
            disabled={sent}
          >
            {sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sent ? "Sent!" : "Send to Group"}
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {scenario.inviteSentAt
            ? `Invites sent ${format(scenario.inviteSentAt, "MMM d")} · RSVPs due ${format(scenario.rsvpDeadline, "MMM d")}`
            : `Invites will send ${format(subDays(scenario.eventDate, scenario.autoScheduleConfig.inviteAdvanceDays), "MMM d")} · RSVPs due ${format(scenario.rsvpDeadline, "MMM d")}`
          }
        </p>
      </div>
    );
  }

  // Option A: Icon with tooltip (recommended)
  return (
    <div className="bg-background border-t border-border p-4">
      <div className="flex gap-2 items-center">
        <Button
          className="flex-1 gap-2"
          onClick={() => setSent(true)}
          disabled={sent}
        >
          {sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {sent ? "Sent!" : "Send to Group"}
        </Button>
        <TimelineInfoTooltip
          eventDate={scenario.eventDate}
          inviteSentAt={scenario.inviteSentAt}
          rsvpDeadline={scenario.rsvpDeadline}
          autoScheduleConfig={scenario.autoScheduleConfig}
        />
        <Button variant="outline" size="icon">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function PrototypeTimelineInfo() {
  const [selectedVariant, setSelectedVariant] = useState<"icon" | "inline">("icon");

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Timeline Info Prototype</h1>
          <p className="text-muted-foreground">
            Hover over the info icon to see RSVP deadline and invite timing
          </p>
        </div>

        {/* Variant Toggle */}
        <div className="flex justify-center gap-2">
          <Button
            variant={selectedVariant === "icon" ? "default" : "outline"}
            onClick={() => setSelectedVariant("icon")}
            size="sm"
          >
            Option A: Icon + Tooltip
          </Button>
          <Button
            variant={selectedVariant === "inline" ? "default" : "outline"}
            onClick={() => setSelectedVariant("inline")}
            size="sm"
          >
            Option B: Inline Text
          </Button>
        </div>

        {/* Scenarios */}
        {scenarios.map((scenario) => (
          <Card key={scenario.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{scenario.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{scenario.description}</p>
            </CardHeader>
            <CardContent className="p-0">
              <MockFloatingActionBar scenario={scenario} variant={selectedVariant} />
            </CardContent>
          </Card>
        ))}

        {/* Implementation Notes */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800">Implementation Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p>
              <strong>Recommended:</strong> Option A (Icon + Tooltip) is more discreet and
              doesn't add visual clutter. It's there when you need it, hidden when you don't.
            </p>
            <p>
              The tooltip shows contextual info like "7d before" for invite timing and
              countdown days for RSVP deadline. For urgent/compressed timelines, it shows
              the timeline type.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
