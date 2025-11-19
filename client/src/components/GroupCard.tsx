import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
  Crown,
  Trash2,
  LogOut
} from "lucide-react";
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
}

function getFirstInitial(name: string | null): string {
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
}

function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatMeetingFrequency(frequency: string): string {
  // Parse format like "1-week", "2-month", etc.
  const parts = frequency.split("-");
  if (parts.length !== 2) return frequency;

  const [numStr, unit] = parts;
  const num = parseInt(numStr);

  if (isNaN(num)) return frequency;

  // Common frequencies get simple labels
  if (num === 1) {
    if (unit === "week") return "Weekly";
    if (unit === "month") return "Monthly";
    if (unit === "year") return "Yearly";
    if (unit === "day") return "Daily";
  }

  // Everything else: "2x/month", "3x/week", etc.
  return `${num}x/${unit}`;
}

export function GroupCard({
  group,
  showMenu = true,
  collections = [],
  currentUserMemberId,
  onMoveToCollection,
  onDeleteGroup,
  onLeaveGroup
}: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine if current user is an organizer
  const currentMember = group.members.find(m => m.id === currentUserMemberId);
  const isOrganizer = currentMember?.isOrganizer || false;

  return (
    <Card
      className="hover-elevate active-elevate-2 transition-all h-full relative group overflow-hidden"
      style={{
        borderLeft: group.accentColor ? `4px solid ${group.accentColor}` : undefined,
      }}
      data-testid={`card-group-${group.id}`}
    >
      <Link href={`/group/${group.id}`} className="block">
        <CardHeader className="pb-2">
          <CardTitle
            className="flex items-start justify-between gap-2 text-base px-3 py-2 rounded-md -mx-3 mb-2"
            style={{
              backgroundColor: group.accentColor ? hexToRgba(group.accentColor, 0.15) : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl" data-testid={`emoji-group-${group.id}`}>
                {group.emoji || "🎉"}
              </span>
              <span>{group.name}</span>
            </div>
            <span className="text-xs font-normal text-muted-foreground flex-shrink-0">
              {formatMeetingFrequency(group.meetingFrequency)}
            </span>
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-sm">
            <MapPin className="h-3 w-3" />
            {group.locationBase}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2 pb-3">
          {/* Budget Row */}
          <div className="text-sm text-muted-foreground">
            ${group.budgetMin}-${group.budgetMax}
          </div>

          {/* Member Section */}
          {group.members && group.members.length > 0 && (
            <div className="pt-1">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
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
                  {group.members.length} {group.members.length === 1 ? 'friend' : 'friends'}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 ml-auto text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
                )}
              </div>

              {/* Expanded Member List */}
              {isExpanded && (
                <div
                  className="mt-2 grid grid-cols-2 gap-2 p-2 bg-muted/30 rounded border border-border"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {group.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-1.5 text-xs">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-background">
                          {getFirstInitial(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{member.name || "Unknown"}</span>
                      {member.isOrganizer && (
                        <Crown className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Link>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-2 right-6" onClick={(e) => e.stopPropagation()}>
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
                <Link href={`/group/${group.id}`}>
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
    </Card>
  );
}
