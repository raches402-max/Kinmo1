import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Check,
  HelpCircle,
  X,
  Clock,
  Crown,
  ChevronDown,
  Edit2,
  Mail,
  Trash2,
  UserPlus,
  CheckCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventAccordionSection } from "./EventAccordionSection";
import type { EventAttendee, RsvpStatus, RsvpCounts } from "./types";

interface AttendeeRowProps {
  attendee: EventAttendee;
  isOrganizer: boolean;
  onEditRsvp?: () => void;
  onMakeHost?: () => void;
  onRemove?: () => void;
  onSendReminder?: () => void;
}

function AttendeeRow({
  attendee,
  isOrganizer,
  onEditRsvp,
  onMakeHost,
  onRemove,
  onSendReminder,
}: AttendeeRowProps) {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    yes: { icon: Check, bg: "bg-success", text: "text-success-foreground" },
    maybe: { icon: HelpCircle, bg: "bg-warning", text: "text-warning-foreground" },
    pending: { icon: Clock, bg: "bg-muted", text: "text-muted-foreground" },
    no: { icon: X, bg: "bg-destructive", text: "text-destructive-foreground" },
  };

  const config = statusConfig[attendee.response];
  const StatusIcon = config.icon;

  return (
    <div className="relative">
      {isOrganizer ? (
        <button
          onClick={() => setShowActions(!showActions)}
          className={cn(
            "w-full flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors",
            showActions ? "bg-muted/50" : "hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                config.bg,
                config.text
              )}
            >
              <StatusIcon className="h-3 w-3" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{attendee.name}</span>
                {attendee.isHost && (
                  <span className="text-2xs text-muted-foreground flex items-center gap-1">
                    <Crown className="h-2.5 w-2.5" />
                    Host
                  </span>
                )}
              </div>
              {attendee.email && (
                <div className="text-2xs text-muted-foreground">{attendee.email}</div>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showActions && "rotate-180"
            )}
          />
        </button>
      ) : (
        // Member view - read-only
        <div className="flex items-center gap-3 py-3 px-2 -mx-2">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              config.bg,
              config.text
            )}
          >
            <StatusIcon className="h-3 w-3" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{attendee.name}</span>
              {attendee.isHost && (
                <span className="text-2xs text-muted-foreground flex items-center gap-1">
                  <Crown className="h-2.5 w-2.5" />
                  Host
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons - organizer only */}
      <AnimatePresence>
        {showActions && isOrganizer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pb-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={onEditRsvp}
              >
                <Edit2 className="h-3 w-3" />
                Change RSVP
              </Button>
              {!attendee.isHost && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={onMakeHost}
                >
                  <Crown className="h-3 w-3" />
                  Make Host
                </Button>
              )}
              {attendee.response === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={onSendReminder}
                >
                  <Mail className="h-3 w-3" />
                  Send Reminder
                </Button>
              )}
              {!attendee.isOrganizer && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                  onClick={onRemove}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface WhoSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  attendees: EventAttendee[];
  rsvpCounts: RsvpCounts;
  quorumThreshold?: number;
  isOrganizer: boolean;
  currentUserRsvp?: RsvpStatus;
  onChangeMyRsvp?: (response: RsvpStatus) => void;
  onInviteGuest?: () => void;
  onRemindAll?: () => void;
  onEditAttendeeRsvp?: (attendee: EventAttendee) => void;
  onMakeHost?: (attendee: EventAttendee) => void;
  onRemoveAttendee?: (attendee: EventAttendee) => void;
  onSendReminder?: (attendee: EventAttendee) => void;
  onUpdateQuorum?: (threshold: number) => void;
}

export function WhoSection({
  isExpanded,
  onToggle,
  attendees,
  rsvpCounts,
  quorumThreshold = 50,
  isOrganizer,
  currentUserRsvp,
  onChangeMyRsvp,
  onInviteGuest,
  onRemindAll,
  onEditAttendeeRsvp,
  onMakeHost,
  onRemoveAttendee,
  onSendReminder,
  onUpdateQuorum,
}: WhoSectionProps) {
  const [isEditingQuorum, setIsEditingQuorum] = useState(false);
  const [localQuorum, setLocalQuorum] = useState(quorumThreshold);

  const totalInvited = attendees.length;
  const quorumNeeded = Math.ceil(totalInvited * (localQuorum / 100));
  const quorumProgress = Math.min(100, (rsvpCounts.yes / Math.max(quorumNeeded, 1)) * 100);
  const hasQuorum = rsvpCounts.yes >= quorumNeeded;
  const hasAttendees = attendees.length > 0;

  return (
    <EventAccordionSection
      icon={Users}
      title="Who"
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={
        hasAttendees ? (
          <span className="text-2xs text-muted-foreground ml-2">
            {attendees.length} invited
          </span>
        ) : null
      }
    >
      {!hasAttendees ? (
        // Empty state
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">No one invited yet</p>
          {isOrganizer && (
            <Button size="sm" className="gap-2" onClick={onInviteGuest}>
              <UserPlus className="h-4 w-4" />
              Invite members
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* RSVP Summary */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="font-medium">{rsvpCounts.yes} yes</span>
            </div>
            {rsvpCounts.maybe > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="font-medium">{rsvpCounts.maybe} maybe</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span className="font-medium">{rsvpCounts.pending} pending</span>
            </div>
            {rsvpCounts.no > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="font-medium">{rsvpCounts.no} no</span>
              </div>
            )}
          </div>

          {/* Quorum indicator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  hasQuorum ? "bg-success" : "bg-primary/60"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${quorumProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => isOrganizer && setIsEditingQuorum(!isEditingQuorum)}
                className={cn(
                  "text-2xs text-muted-foreground flex items-center gap-1",
                  isOrganizer && "hover:text-foreground cursor-pointer"
                )}
              >
                {hasQuorum && <CheckCircle className="h-3 w-3 text-success" />}
                <span>
                  {rsvpCounts.yes}/{quorumNeeded} for quorum
                </span>
              </button>
              <div className="relative group">
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-popover border border-border rounded-lg shadow-lg text-2xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Quorum is the minimum number of confirmed attendees needed for
                  this event to happen.
                </div>
              </div>
            </div>
          </div>

          {/* Quorum threshold editor */}
          <AnimatePresence>
            {isEditingQuorum && isOrganizer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xs text-muted-foreground">Threshold:</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={localQuorum}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setLocalQuorum(value);
                        onUpdateQuorum?.(value);
                      }}
                      className="flex-1 accent-primary h-1"
                    />
                    <span className="text-2xs font-medium w-8 text-right">
                      {localQuorum}%
                    </span>
                  </div>
                  {!hasQuorum && (
                    <button
                      onClick={() => {
                        // Override quorum - confirm event anyway
                        setIsEditingQuorum(false);
                      }}
                      className="w-full text-2xs text-primary hover:text-primary/80 hover:underline text-left"
                    >
                      Override: Confirm event without quorum →
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attendee List - Members */}
          {(() => {
            const members = attendees.filter(a => !a.isGuest);
            const guests = attendees.filter(a => a.isGuest);

            return (
              <>
                <div className="divide-y divide-border">
                  {members.map((attendee) => (
                    <AttendeeRow
                      key={attendee.id}
                      attendee={attendee}
                      isOrganizer={isOrganizer}
                      onEditRsvp={() => onEditAttendeeRsvp?.(attendee)}
                      onMakeHost={() => onMakeHost?.(attendee)}
                      onRemove={() => onRemoveAttendee?.(attendee)}
                      onSendReminder={() => onSendReminder?.(attendee)}
                    />
                  ))}
                </div>

                {/* Guests Section */}
                {guests.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-2xs text-muted-foreground px-2">Guests</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="divide-y divide-border">
                      {guests.map((attendee) => (
                        <AttendeeRow
                          key={attendee.id}
                          attendee={attendee}
                          isOrganizer={isOrganizer}
                          onEditRsvp={() => onEditAttendeeRsvp?.(attendee)}
                          onMakeHost={() => onMakeHost?.(attendee)}
                          onRemove={() => onRemoveAttendee?.(attendee)}
                          onSendReminder={() => onSendReminder?.(attendee)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* Add buttons - organizer only */}
          {isOrganizer && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10 text-xs gap-2"
                onClick={onInviteGuest}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite Guest
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10 text-xs gap-2"
                onClick={onRemindAll}
              >
                <Mail className="h-3.5 w-3.5" />
                Remind All
              </Button>
            </div>
          )}
        </div>
      )}
    </EventAccordionSection>
  );
}
