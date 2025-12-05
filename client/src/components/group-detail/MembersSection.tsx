/**
 * MembersSection
 * Displays and manages group members including RSVP status, constraints,
 * hosting preferences, and member invitations.
 */

import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Check,
  X,
  Plus,
  Pencil,
  Trash2,
  Mail,
  MapPin,
  Clock,
  DollarSign,
  Home,
  CheckCircle2,
  Circle,
  XCircle,
  Link as LinkIcon,
  UserPlus,
  Copy,
} from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";

// ========== TYPES ==========

/**
 * Member constraints from profile setup
 */
export type MemberConstraints = {
  scheduleConflicts?: string[];
  budgetConcern?: boolean;
  distanceConcern?: boolean;
  notes?: string;
};

/**
 * Member data shape - accepts the full Member type from schema
 */
export interface MemberData {
  id: string;
  name: string | null;
  email: string | null;
  userId: string | null;
  rsvpStatus?: string | null;
  openToHosting?: boolean;
  isOrganizer?: boolean;
  invitationSent?: boolean;
  memberLocation?: string | null;
  memberConstraints?: unknown;
}

/**
 * New member being added (not yet saved)
 */
export interface NewMember {
  name: string;
  email: string;
}

/**
 * Current user info
 */
interface CurrentUser {
  id: string;
}

interface MembersSectionProps {
  /**
   * All members in the group
   */
  members: MemberData[];
  /**
   * Members sorted for display
   */
  sortedMembers: MemberData[];
  /**
   * Current logged-in user
   */
  user: CurrentUser | null;
  /**
   * Whether current user is the group owner
   */
  isOwner: boolean;
  /**
   * ID of member currently being edited
   */
  editingMemberId: string | null;
  /**
   * Set the member being edited
   */
  setEditingMemberId: (id: string | null) => void;
  /**
   * Current edit form data
   */
  editMemberData: { name: string; email: string };
  /**
   * Set edit form data
   */
  setEditMemberData: (data: { name: string; email: string }) => void;
  /**
   * New members being added
   */
  newMembers: NewMember[];
  /**
   * Add a new empty member slot
   */
  addNewMember: () => void;
  /**
   * Update a new member field
   */
  updateNewMember: (index: number, field: "name" | "email", value: string) => void;
  /**
   * Remove a new member slot
   */
  removeNewMember: (index: number) => void;
  /**
   * Update an existing member
   */
  onUpdateMember: (memberId: string, data: { name?: string; email?: string }) => void;
  /**
   * Whether update is in progress
   */
  isUpdatingMember: boolean;
  /**
   * Toggle hosting preference for a member
   */
  onToggleHosting: (memberId: string, openToHosting: boolean) => void;
  /**
   * Delete a member from the group
   */
  onDeleteMember: (memberId: string) => void;
  /**
   * Send invitations to members with emails
   */
  onSendInvitations: () => void;
  /**
   * Whether invitations are being sent
   */
  isSendingInvitations: boolean;
  /**
   * Copy the group join link (for new people to add themselves)
   */
  onCopyGroupJoinLink?: () => void;
  /**
   * Whether the group join link was just copied
   */
  groupJoinLinkCopied?: boolean;
}

// ========== COMPONENT ==========

export function MembersSection({
  members,
  sortedMembers,
  user,
  isOwner,
  editingMemberId,
  setEditingMemberId,
  editMemberData,
  setEditMemberData,
  newMembers,
  addNewMember,
  updateNewMember,
  removeNewMember,
  onUpdateMember,
  isUpdatingMember,
  onToggleHosting,
  onDeleteMember,
  onSendInvitations,
  isSendingInvitations,
  onCopyGroupJoinLink,
  groupJoinLinkCopied,
}: MembersSectionProps) {
  // Find current user's member record for the "Edit My Profile" button
  const userMember = members.find((m) => m.userId === user?.id);

  // Calculate constraint insights
  const scheduleConflicts = new Set<string>();
  const budgetConcernCount = members.filter(
    (m) => (m.memberConstraints as MemberConstraints)?.budgetConcern
  ).length;
  const distanceConcernCount = members.filter(
    (m) => (m.memberConstraints as MemberConstraints)?.distanceConcern
  ).length;

  members.forEach((m) => {
    const constraints = m.memberConstraints as MemberConstraints;
    if (constraints?.scheduleConflicts) {
      constraints.scheduleConflicts.forEach((conflict) => scheduleConflicts.add(conflict));
    }
  });

  const hasInsights = scheduleConflicts.size > 0 || budgetConcernCount > 0 || distanceConcernCount > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Members</CardTitle>
          <CardDescription>Manage group members and invitations</CardDescription>
        </div>
        {/* Button to edit user's own profile */}
        {userMember && (
          <Link href={`/member-profile-setup/${userMember.id}`}>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-edit-my-profile">
              <Settings className="w-4 h-4" />
              Edit My Profile
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RSVP Summary */}
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {members.filter((m) => m.rsvpStatus === "going").length} Going
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Circle className="w-3 h-3" />
              {members.filter((m) => m.rsvpStatus === "maybe").length} Maybe
            </Badge>
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              {members.filter((m) => m.rsvpStatus === "not_going").length} Can't make it
            </Badge>
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              {members.filter((m) => !m.rsvpStatus).length} No response
            </Badge>
          </div>
        )}

        {/* Group Constraint Insights */}
        {hasInsights && (
          <div className="space-y-2 pb-2 border-b">
            <Label className="text-xs font-semibold">Group Insights</Label>
            <div className="flex flex-wrap gap-2">
              {scheduleConflicts.size > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  Schedule conflicts: {Array.from(scheduleConflicts).join(", ")}
                </Badge>
              )}
              {budgetConcernCount > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <DollarSign className="w-3 h-3" />
                  {budgetConcernCount} {budgetConcernCount === 1 ? "member" : "members"} mentioned budget
                </Badge>
              )}
              {distanceConcernCount > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <MapPin className="w-3 h-3" />
                  {distanceConcernCount} {distanceConcernCount === 1 ? "member" : "members"} mentioned distance
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Existing Members */}
        {members.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Current Members</Label>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Home className="w-3 h-3" />
                Volunteer to host events
                <HelpTooltip
                  content="As a host, you'll send the event details to the group. If you check this, you may be asked to host when no one else volunteers (48 hours before an event)."
                  examples={["You pick the final venue and send the invite", "You can always decline if asked"]}
                />
              </Label>
            </div>
            <div className="space-y-2">
              {sortedMembers.map((member) => (
                <div key={member.id}>
                  {editingMemberId === member.id ? (
                    // Edit mode
                    <div className="flex gap-2 items-start p-2 bg-muted/50 rounded-md">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          placeholder="Name (optional)"
                          value={editMemberData.name}
                          onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })}
                          data-testid={`input-edit-member-name-${member.id}`}
                        />
                        <Input
                          type="email"
                          placeholder="Email (optional)"
                          value={editMemberData.email}
                          onChange={(e) => setEditMemberData({ ...editMemberData, email: e.target.value })}
                          data-testid={`input-edit-member-email-${member.id}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          onUpdateMember(member.id, {
                            name: editMemberData.name.trim() || undefined,
                            email: editMemberData.email.trim() || undefined,
                          });
                        }}
                        data-testid={`button-save-member-${member.id}`}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setEditingMemberId(null)}
                        data-testid={`button-cancel-edit-member-${member.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/25 text-primary text-xs">
                          {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {member.name || "Member"}
                            {member.userId === user?.id && (
                              <span className="text-muted-foreground font-normal"> (you)</span>
                            )}
                          </p>
                          {member.rsvpStatus && (
                            <Badge
                              variant={member.rsvpStatus === "going" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {member.rsvpStatus === "going" && "✓ Going"}
                              {member.rsvpStatus === "maybe" && "? Maybe"}
                              {member.rsvpStatus === "not_going" && "✗ Can't make it"}
                            </Badge>
                          )}
                        </div>
                        {member.email && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                        {member.memberLocation && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {member.memberLocation}
                          </p>
                        )}
                        {member.memberConstraints ? (
                          <MemberConstraintsDisplay constraints={member.memberConstraints as MemberConstraints} />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`hosting-${member.id}`}
                          checked={member.openToHosting}
                          onCheckedChange={(checked) => {
                            onToggleHosting(member.id, checked === true);
                          }}
                          data-testid={`checkbox-hosting-volunteer-${member.id}`}
                        />

                        {/* Show badges and controls */}
                        <div className="flex items-center gap-1">
                          {member.isOrganizer && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs whitespace-nowrap cursor-help">
                                  Organizer
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">
                                  The organizer created this group and can manage settings, invite members, and
                                  configure automation features.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Show edit button if: 1) user is organizer, OR 2) it's their own member record */}
                          {(isOwner || member.userId === user?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingMemberId(member.id);
                                setEditMemberData({
                                  name: member.name || "",
                                  email: member.email || "",
                                });
                              }}
                              data-testid={`button-edit-member-${member.id}`}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}

                          {/* Only organizer can delete members (but not themselves) */}
                          {isOwner && !member.isOrganizer && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.name || member.email || "this member"}{" "}
                                    from the group?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteMember(member.id)}>
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Members */}
        {newMembers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">New Members to Add</Label>
            {newMembers.map((member, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="Name (optional)"
                    value={member.name}
                    onChange={(e) => updateNewMember(index, "name", e.target.value)}
                    data-testid={`input-new-member-name-${index}`}
                  />
                  <Input
                    type="email"
                    placeholder="Email (optional)"
                    value={member.email}
                    onChange={(e) => updateNewMember(index, "email", e.target.value)}
                    data-testid={`input-new-member-email-${index}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeNewMember(index)}
                  data-testid={`button-remove-new-member-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addNewMember}
          className="w-full"
          data-testid="button-add-new-member"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>

        {members.some((m) => m.email && !m.invitationSent) && (
          <div className="pt-2 border-t">
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={onSendInvitations}
              disabled={isSendingInvitations}
              data-testid="button-send-invitations"
            >
              <Mail className="mr-2 h-3 w-3" />
              {isSendingInvitations ? "Sending..." : "Send Invitations"}
            </Button>
          </div>
        )}

        {/* Group Join Link - for new people to add themselves to the group */}
        {onCopyGroupJoinLink && (
          <div className="pt-4 border-t">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <UserPlus className="w-3 h-3" />
                Let new people join the group
                <HelpTooltip
                  content="Share this link with people who aren't in the group yet. They can add themselves as new members."
                  examples={["Post in a group chat", "Share with a friend who wants to join"]}
                />
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onCopyGroupJoinLink}
                data-testid="button-copy-group-join-link"
              >
                {groupJoinLinkCopied ? (
                  <>
                    <Check className="mr-2 h-3 w-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-3 w-3" />
                    Copy Group Join Link
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== SUB-COMPONENTS ==========

function MemberConstraintsDisplay({ constraints }: { constraints: MemberConstraints }) {
  if (!constraints) return null;

  const hasContent =
    (constraints.scheduleConflicts && constraints.scheduleConflicts.length > 0) ||
    constraints.budgetConcern ||
    constraints.distanceConcern ||
    constraints.notes;

  if (!hasContent) return null;

  return (
    <div className="text-xs text-muted-foreground space-y-1 mt-1">
      {constraints.scheduleConflicts && constraints.scheduleConflicts.length > 0 && (
        <p className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {constraints.scheduleConflicts.join(", ")}
        </p>
      )}
      {constraints.budgetConcern && (
        <p className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Budget concern
        </p>
      )}
      {constraints.distanceConcern && (
        <p className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Distance concern
        </p>
      )}
      {constraints.notes && <p className="italic">"{constraints.notes}"</p>}
    </div>
  );
}
