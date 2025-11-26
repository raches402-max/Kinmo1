/**
 * Copy Event Invite Link Component
 * Phase 1: Event-by-Event Invite System
 *
 * Displays invite status and allows organizers to copy invite links
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check, Mail, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  name: string;
  email: string | null;
}

interface CopyEventInviteLinkProps {
  eventId: string;
  groupId: string;
  compact?: boolean; // Show compact version (just button)
}

export function CopyEventInviteLink({
  eventId,
  groupId,
  compact = false,
}: CopyEventInviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Fetch group members to show invite status
  const { data: members } = useQuery<Member[]>({
    queryKey: [`/api/groups/${groupId}/members`],
    enabled: !!groupId && !compact,
  });

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const membersWithEmail = members?.filter(m => m.email) || [];
  const membersWithoutEmail = members?.filter(m => !m.email) || [];

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/event/${eventId}/invite`;

    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "Event invite link copied to clipboard. Share it in your group thread!",
      });
    }).catch((error) => {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Please try again or copy the link manually.",
        variant: "destructive",
      });
    });
  };

  // Compact version: just a button
  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Invite Link
          </>
        )}
      </Button>
    );
  }

  // Full version: show invite status
  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="space-y-3">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Invite Status
        </h4>

        {members && members.length > 0 ? (
          <div className="space-y-2 text-sm">
            {membersWithEmail.length > 0 && (
              <div className="flex items-center gap-2 text-green-700">
                <Mail className="h-4 w-4" />
                <span>
                  ✓ {membersWithEmail.length} member{membersWithEmail.length > 1 ? 's' : ''} will receive automatic emails
                </span>
              </div>
            )}

            {membersWithoutEmail.length > 0 && (
              <div className="flex items-start gap-2 text-blue-700">
                <Copy className="h-4 w-4 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">
                    {membersWithoutEmail.length} member{membersWithoutEmail.length > 1 ? 's' : ''} need manual invite (share link below)
                  </p>
                  <p className="text-xs mt-1 text-blue-600">
                    Members: {membersWithoutEmail.map(m => m.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">Loading member information...</p>
        )}

        <Button
          variant="default"
          className="w-full gap-2"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Link Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Invite Link for Thread
            </>
          )}
        </Button>

        {copied && (
          <p className="text-xs text-blue-600 text-center">
            Paste this link in your group chat for members to RSVP
          </p>
        )}
      </div>
    </Card>
  );
}
