import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";

interface DiscoverableGroup {
  memberId: string;
  memberName: string | null;
  groupId: string;
  groupName: string;
  groupEmoji: string | null;
  createdAt: string;
}

interface ClaimMembershipsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DiscoverableGroup[];
}

export function ClaimMembershipsModal({
  open,
  onOpenChange,
  groups,
}: ClaimMembershipsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pre-select all groups when modal opens
  useEffect(() => {
    if (open && groups.length > 0) {
      setSelected(new Set(groups.map((g) => g.memberId)));
    }
  }, [open, groups]);

  const claimMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      return await apiRequest("POST", "/api/user/claim-memberships", { memberIds });
    },
    onSuccess: (data) => {
      toast({
        title: "Memberships claimed!",
        description: `You've joined ${data.claimed} group${data.claimed === 1 ? "" : "s"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/discoverable-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/events"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const toggleGroup = (memberId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleClaim = () => {
    const memberIds = Array.from(selected);
    if (memberIds.length > 0) {
      claimMutation.mutate(memberIds);
    }
  };

  const handleSkipAll = () => {
    // Just close - user can re-open later from banner
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Claim Your Memberships
          </DialogTitle>
          <DialogDescription>
            Select the groups you'd like to join. You can skip any that don't belong to you.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
          {groups.map((group) => (
            <label
              key={group.memberId}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selected.has(group.memberId)}
                onCheckedChange={() => toggleGroup(group.memberId)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {group.groupEmoji && (
                    <span className="text-lg">{group.groupEmoji}</span>
                  )}
                  <span className="font-medium truncate">{group.groupName}</span>
                </div>
                {group.memberName && (
                  <p className="text-xs text-muted-foreground">
                    Added as "{group.memberName}"
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkipAll}>
            Skip All
          </Button>
          <Button
            onClick={handleClaim}
            disabled={selected.size === 0 || claimMutation.isPending}
          >
            {claimMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              `Claim Selected (${selected.size})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
