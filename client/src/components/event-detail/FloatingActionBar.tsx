import { Send, Share2, UserPlus, Bell, RefreshCw, CheckCircle, Check, Info, CalendarDays, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, subDays } from "date-fns";
import type { EventStatus } from "./types";

interface AutoScheduleConfig {
  inviteAdvanceDays: number;
  rsvpWindowDays: number;
  timelineType: string;
}

interface TimelineInfo {
  eventDate: Date;
  inviteSentAt: Date | null;
  rsvpDeadline: Date | null;
  autoScheduleConfig: AutoScheduleConfig | null;
}

interface FloatingActionBarProps {
  status: EventStatus;
  hasUnsavedChanges: boolean;
  hasMinorChanges?: boolean;
  isOrganizer: boolean;
  isSending?: boolean;
  timelineInfo?: TimelineInfo;
  onSendToGroup?: () => void;
  onSendUpdate?: () => void;
  onShare?: () => void;
  onInviteGuest?: () => void;
  onDiscard?: () => void;
}

function TimelineInfoTooltip({ info }: { info: TimelineInfo }) {
  const { eventDate, inviteSentAt, rsvpDeadline, autoScheduleConfig } = info;
  const now = new Date();
  const isPastDeadline = rsvpDeadline ? rsvpDeadline < now : false;
  const inviteSendDate = inviteSentAt ||
    (autoScheduleConfig ? subDays(eventDate, autoScheduleConfig.inviteAdvanceDays) : null);
  const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilRsvp = rsvpDeadline
    ? Math.ceil((rsvpDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-full p-1.5 hover:bg-muted/50 transition-colors cursor-help">
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

          {inviteSendDate && (
            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span>
                <span className="text-muted-foreground">
                  {inviteSentAt ? "Invites sent:" : "Auto-sends:"}
                </span>{" "}
                <span className="font-medium">{format(inviteSendDate, "MMM d")}</span>
                {!inviteSentAt && autoScheduleConfig && (
                  <span className="text-muted-foreground/70 ml-1">
                    ({autoScheduleConfig.inviteAdvanceDays}d before)
                  </span>
                )}
              </span>
            </div>
          )}

          {rsvpDeadline && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${isPastDeadline ? "text-muted-foreground" : "text-amber-500"}`} />
              <span>
                <span className="text-muted-foreground">RSVPs due:</span>{" "}
                <span className={`font-medium ${isPastDeadline ? "line-through text-muted-foreground" : ""}`}>
                  {format(rsvpDeadline, "MMM d")}
                </span>
                {isPastDeadline ? (
                  <span className="text-muted-foreground/70 ml-1">(closed)</span>
                ) : daysUntilRsvp !== null ? (
                  <span className="text-muted-foreground/70 ml-1">
                    ({daysUntilRsvp} day{daysUntilRsvp !== 1 ? "s" : ""})
                  </span>
                ) : null}
              </span>
            </div>
          )}

          {autoScheduleConfig?.timelineType && autoScheduleConfig.timelineType !== "standard" && (
            <div className="pt-1 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                {autoScheduleConfig.timelineType} timeline
              </span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function FloatingActionBar({
  status,
  hasUnsavedChanges,
  hasMinorChanges,
  isOrganizer,
  isSending,
  timelineInfo,
  onSendToGroup,
  onSendUpdate,
  onShare,
  onInviteGuest,
  onDiscard,
}: FloatingActionBarProps) {
  // Member view - just show share option
  if (!isOrganizer) {
    return (
      <div className="flex gap-3 p-4">
        <Button
          variant="outline"
          className="flex-1 h-12 gap-2 text-sm font-semibold"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
          Share Event
        </Button>
      </div>
    );
  }

  if (status === "draft") {
    return (
      <div className="flex gap-3 p-4">
        <Button
          className="flex-1 h-12 gap-2 text-sm font-semibold"
          onClick={onSendToGroup}
          disabled={isSending}
        >
          {isSending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send to Group
            </>
          )}
        </Button>
        <Button variant="outline" className="h-12 w-12 p-0" onClick={onShare}>
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  if (status === "sent") {
    // Major changes (date, time, venues) - need to send update to group
    if (hasUnsavedChanges) {
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg">
            <RefreshCw className="h-4 w-4 text-warning" />
            <span className="text-xs text-warning font-medium">
              Changes to date/time/venue require notifying the group
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 gap-2 text-sm font-semibold"
              onClick={onSendUpdate}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Send Update
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-12 px-4 text-sm"
              onClick={onDiscard}
            >
              Discard
            </Button>
          </div>
        </div>
      );
    }

    // Minor changes (quorum, notes) - auto-saved
    if (hasMinorChanges) {
      return (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-success" />
            <span>Settings saved</span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2 text-sm font-semibold"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              Share Invite Link
            </Button>
            <Button
              variant="outline"
              className="h-12 w-12 p-0"
              onClick={onInviteGuest}
            >
              <UserPlus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-3 p-4 items-center">
        <Button
          variant="outline"
          className="flex-1 h-12 gap-2 text-sm font-semibold"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
          Share Invite Link
        </Button>
        {timelineInfo && <TimelineInfoTooltip info={timelineInfo} />}
        <Button
          variant="outline"
          className="h-12 w-12 p-0"
          onClick={onInviteGuest}
        >
          <UserPlus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Finalized state
  return (
    <div className="flex gap-3 p-4">
      <Button
        variant="outline"
        className="flex-1 h-12 gap-2 text-sm font-semibold"
        onClick={onShare}
      >
        <Share2 className="h-4 w-4" />
        Share Details
      </Button>
      <Button variant="outline" className="h-12 px-4 gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-success" />
        Confirmed
      </Button>
    </div>
  );
}
