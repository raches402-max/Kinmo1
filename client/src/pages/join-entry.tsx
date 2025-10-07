import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, ArrowRight } from "lucide-react";

export default function JoinEntry() {
  const [, navigate] = useLocation();
  const [inviteLink, setInviteLink] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract shareable link from various formats
    let shareableLink = inviteLink.trim();
    
    // If it's a full URL, extract the last part
    if (shareableLink.includes("/join/")) {
      const parts = shareableLink.split("/join/");
      shareableLink = parts[parts.length - 1];
    } else if (shareableLink.includes("/")) {
      // If it contains slashes, get the last part
      const parts = shareableLink.split("/");
      shareableLink = parts[parts.length - 1];
    }
    
    if (shareableLink) {
      navigate(`/join/${shareableLink}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Join a Group</CardTitle>
              <CardDescription>Enter your invite link to get started</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-link">Invite Link or Code</Label>
              <Input
                id="invite-link"
                type="text"
                placeholder="Paste your invite link or code here"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                data-testid="input-invite-link"
              />
              <p className="text-xs text-muted-foreground">
                You should have received this link from your group organizer
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!inviteLink.trim()}
              data-testid="button-continue"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
