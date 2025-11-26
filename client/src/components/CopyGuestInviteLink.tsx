/**
 * Copy Guest Invite Link Component - Phase 3: Guest vs Member Distinction
 *
 * Allows organizers to copy guest invite links for one-time attendees
 * Guests are NOT added to the recurring member list
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CopyGuestInviteLinkProps {
  eventId: string;
  compact?: boolean; // Show compact version (just button)
}

export function CopyGuestInviteLink({
  eventId,
  compact = false,
}: CopyGuestInviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopyLink = () => {
    const guestInviteUrl = `${window.location.origin}/event/${eventId}/guest`;

    navigator.clipboard.writeText(guestInviteUrl).then(() => {
      setCopied(true);
      toast({
        title: "Guest Link Copied!",
        description: "Share this link with one-time guests who aren't regular group members.",
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
            <UserPlus className="h-4 w-4" />
            Copy Guest Link
          </>
        )}
      </Button>
    );
  }

  // Full version: card with explanation
  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <UserPlus className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-purple-900 mb-1">
                Invite One-Time Guests
              </h4>
              <p className="text-sm text-purple-800">
                Share this link with people who aren't regular group members.
                They can RSVP without joining the group.
              </p>
            </div>
          </div>

          <Button
            variant="default"
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
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
                Copy Guest Invite Link
              </>
            )}
          </Button>

          {copied && (
            <p className="text-xs text-purple-600 text-center">
              Guests won't be added to your recurring member list
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
