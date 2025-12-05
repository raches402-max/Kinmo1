import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent } from "@/components/ui/responsive-dialog";
import { Check, Users, Link as LinkIcon, Sparkles, Calendar, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface GroupCreatedSuccessProps {
  open: boolean;
  groupId: string;
  groupName: string;
  shareableLink?: string;
  onContinue: () => void;
}

export function GroupCreatedSuccess({
  open,
  groupId,
  groupName,
  shareableLink,
  onContinue,
}: GroupCreatedSuccessProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Unified invite link - works for existing members to claim their name AND new people to join
  const inviteLink = shareableLink
    ? `${window.location.origin}/invite/${shareableLink}`
    : null;

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Invite link copied!",
        description: "Share this so people can join or claim their spot",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-6">
          {/* Success Header */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">🎉 Group Created!</h2>
            <p className="text-muted-foreground">
              "{groupName}" is ready to go. Here's what happens next:
            </p>
          </div>

          {/* Next Steps Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Next Steps</CardTitle>
              <CardDescription>Complete these to get the most out of your group</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1: Share Invite Link */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Share the Invite Link
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Members can claim their name, and new people can add themselves
                  </p>
                  {inviteLink && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono break-all">
                        {inviteLink}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyInviteLink}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Refine Preferences */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Swipe on Venue Suggestions (Optional)
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Help the AI learn your taste by swiping on a few venue suggestions
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⏱️ Takes ~2 minutes • Improves suggestion quality by 40%
                  </p>
                </div>
              </div>

              {/* Step 3: Schedule First Event */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Create Your First Event
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use "Auto Schedule" or build a custom itinerary from your group page
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Tip: Auto-schedule learns from feedback and gets better over time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link href={`/group/${groupId}`} className="flex-1">
              <Button
                className="w-full"
                variant="outline"
                onClick={onContinue}
              >
                Skip for Now
              </Button>
            </Link>
            <Button
              className="flex-1"
              onClick={onContinue}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Swipe on Venues
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
