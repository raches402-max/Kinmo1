import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  MoreVertical,
  FolderOpen,
  Pencil,
  Trash2,
  LogOut,
  Clock,
  Sparkles
} from "lucide-react";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { Group, GroupCollection } from "@shared/schema";

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  openToHosting?: boolean;
  profileCompleted?: boolean;
  isOrganizer?: boolean;
};

interface GroupCardProps {
  group: Group & { members: SafeMember[] };
  showMenu?: boolean;
  collections?: GroupCollection[];
  currentUserMemberId?: string;
  onMoveToCollection?: (groupId: string, collectionId: string | null) => void;
  onDeleteGroup?: (groupId: string) => void;
  onLeaveGroup?: (groupId: string, memberId: string) => void;
  nextEventDate?: string | null;
}

function getInitial(name: string | null): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

function formatNameWithInitial(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(' ');
  if (parts.length < 2) return name;
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}

// Soften a hex color for backgrounds (returns hex with alpha)
function softenColor(hex: string, amount: number = 0.08): string {
  return `${hex}${Math.round(amount * 255).toString(16).padStart(2, '0')}`;
}

function formatMeetingFrequency(frequency: string): string {
  const parts = frequency.split("-");
  if (parts.length !== 2) return frequency;

  const [numStr, unit] = parts;
  const num = parseInt(numStr);

  if (isNaN(num)) return frequency;

  if (num === 1) {
    if (unit === "week") return "Weekly";
    if (unit === "month") return "Monthly";
    if (unit === "year") return "Yearly";
    if (unit === "day") return "Daily";
  }

  return `${num}x/${unit}`;
}

function formatEventDate(dateStr: string, timezone?: string | null): { label: string; tzAbbrev: string } {
  const date = new Date(dateStr);
  const tz = timezone || "America/Los_Angeles";

  // Get the date in the group's timezone
  const zonedDate = toZonedTime(date, tz);
  const nowInTz = toZonedTime(new Date(), tz);

  // Calculate difference in days based on calendar dates in the group's timezone
  const eventDay = new Date(zonedDate.getFullYear(), zonedDate.getMonth(), zonedDate.getDate());
  const today = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Get timezone abbreviation (e.g., PST, EST)
  const tzAbbrev = formatInTimeZone(date, tz, "zzz");

  let label: string;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays > 0 && diffDays < 7) label = formatInTimeZone(date, tz, "EEE");
  else label = formatInTimeZone(date, tz, "MMM d");

  return { label, tzAbbrev };
}

export function GroupCard({
  group,
  showMenu = true,
  collections = [],
  currentUserMemberId,
  onMoveToCollection,
  onDeleteGroup,
  onLeaveGroup,
  nextEventDate
}: GroupCardProps) {
  const currentMember = group.members.find(m => m.id === currentUserMemberId);
  const isOrganizer = currentMember?.isOrganizer || false;

  // Use accent color or default to a warm neutral
  const accentColor = group.accentColor || '#6B5B6E';

  return (
    <div
      className="relative card-warm rounded-2xl overflow-hidden active:scale-[0.98] transition-all duration-200 h-full"
      data-testid={`card-group-${group.id}`}
    >
      <Link href={`/group/${group.id}`} className="block">
        {/* Top accent bar with next event date */}
        {nextEventDate && (
          <div
            className="flex items-center gap-1.5 px-4 py-1.5 text-2xs font-semibold text-white"
            style={{
              backgroundColor: accentColor,
            }}
          >
            <Sparkles className="w-3 h-3" />
            <span>Next up: {(() => {
              const { label, tzAbbrev } = formatEventDate(nextEventDate, group.timezone);
              return `${label} (${tzAbbrev})`;
            })()}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-4 pr-12">
          <div className="flex items-center gap-3">
            {/* Emoji with warm background */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: softenColor(accentColor, 0.1),
                border: `1px solid ${softenColor(accentColor, 0.15)}`
              }}
              data-testid={`emoji-group-${group.id}`}
            >
              {group.emoji || "🎉"}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-card-foreground truncate leading-tight">
                {group.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span>{formatMeetingFrequency(group.meetingFrequency)}</span>
                <span className="opacity-40">·</span>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="truncate">{group.locationBase}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Member strip with subtle name pills - 2 rows, horizontal scroll for overflow */}
        {group.members && group.members.length > 0 && (
          <div
            className="px-4 py-3 border-t border-card-border overflow-x-auto scrollbar-hide"
            style={{
              background: `linear-gradient(180deg, ${softenColor(accentColor, 0.02)} 0%, ${softenColor(accentColor, 0.05)} 100%)`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            data-testid={`members-preview-${group.id}`}
          >
            <div
              className="grid grid-flow-col grid-rows-2 gap-1.5 w-max"
            >
              {group.members.map((member, idx) => (
                <span
                  key={member.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: softenColor(accentColor, 0.1),
                    color: 'var(--card-foreground)',
                  }}
                  data-testid={`member-pill-${idx}`}
                >
                  {formatNameWithInitial(member.name)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Link>

      {/* Dropdown Menu - Always visible */}
      {showMenu && (
        <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-card/80 hover:bg-card backdrop-blur-sm rounded-xl border border-card-border"
                data-testid={`button-group-menu-${group.id}`}
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
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
                    onClick={() => onMoveToCollection?.(group.id, null)}
                    data-testid={`menu-move-none-${group.id}`}
                  >
                    None (All Groups)
                  </DropdownMenuItem>
                  {collections.map(collection => (
                    <DropdownMenuItem
                      key={collection.id}
                      onClick={() => onMoveToCollection?.(group.id, collection.id)}
                      data-testid={`menu-move-${collection.id}-${group.id}`}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link href={`/group/${group.id}?tab=preferences`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Group
                </Link>
              </DropdownMenuItem>

              {currentUserMemberId && (
                <>
                  <DropdownMenuSeparator />
                  {isOrganizer ? (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${group.name}"? This action cannot be undone.`)) {
                          onDeleteGroup?.(group.id);
                        }
                      }}
                      className="text-destructive focus:text-destructive"
                      data-testid={`menu-delete-group-${group.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Group
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Leave "${group.name}"?`)) {
                          onLeaveGroup?.(group.id, currentUserMemberId);
                        }
                      }}
                      data-testid={`menu-leave-group-${group.id}`}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Leave Group
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
