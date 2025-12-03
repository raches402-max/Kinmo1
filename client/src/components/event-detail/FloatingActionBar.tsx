import { Send, Share2, UserPlus, Bell, RefreshCw, CheckCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventStatus } from "./types";

interface FloatingActionBarProps {
  status: EventStatus;
  hasUnsavedChanges: boolean;
  hasMinorChanges?: boolean;
  isOrganizer: boolean;
  isSending?: boolean;
  onSendToGroup?: () => void;
  onSendUpdate?: () => void;
  onShare?: () => void;
  onInviteGuest?: () => void;
  onDiscard?: () => void;
}

export function FloatingActionBar({
  status,
  hasUnsavedChanges,
  hasMinorChanges,
  isOrganizer,
  isSending,
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
      <div className="flex gap-3 p-4">
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
