/**
 * WaitlistAdmin — three sub-views on the admin page:
 *   1. Waitlist signups (pending) — approve / reject
 *   2. Invite codes — see usage, create new, toggle active
 *   3. Allowlist — see everyone who can sign in, remove if needed
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/components/ErrorDisplay";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface WaitlistSignup {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface InviteCode {
  code: string;
  label: string;
  maxUses: number;
  usesCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface AllowedEmail {
  email: string;
  source: "founder" | "invite_code" | "manual";
  inviteCode: string | null;
  claimedAt: string | null;
  createdAt: string;
}

export default function WaitlistAdmin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite-only beta</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="signups" className="space-y-4">
          <TabsList>
            <TabsTrigger value="signups">Waitlist</TabsTrigger>
            <TabsTrigger value="codes">Invite codes</TabsTrigger>
            <TabsTrigger value="allowlist">Allowlist</TabsTrigger>
          </TabsList>

          <TabsContent value="signups">
            <SignupsPanel />
          </TabsContent>

          <TabsContent value="codes">
            <CodesPanel />
          </TabsContent>

          <TabsContent value="allowlist">
            <AllowlistPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ─── Waitlist signups ──────────────────────────────────────────────────── */

function SignupsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ signups: WaitlistSignup[] }>({
    queryKey: ["/api/admin/waitlist"],
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/waitlist/${id}/approve`);
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Added to allowlist." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-emails"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  const rejectMut = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/waitlist/${id}/reject`);
    },
    onSuccess: () => {
      toast({ title: "Rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const signups = data?.signups ?? [];
  const pending = signups.filter((s) => s.status === "pending");
  const reviewed = signups.filter((s) => s.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
          Pending ({pending.length})
        </h4>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No one waiting.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3 gap-2">
                <div>
                  <div className="font-medium">{s.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {format(new Date(s.createdAt), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveMut.mutate(s.id)}
                    disabled={approveMut.isPending}
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Let them in
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => rejectMut.mutate(s.id)}
                    disabled={rejectMut.isPending}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Reviewed ({reviewed.length})
          </h4>
          <ul className="divide-y border rounded-md text-sm">
            {reviewed.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <span>{s.email}</span>
                <Badge variant={s.status === "approved" ? "default" : "secondary"}>
                  {s.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Invite codes ──────────────────────────────────────────────────────── */

function CodesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ codes: InviteCode[] }>({
    queryKey: ["/api/admin/invite-codes"],
  });

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(25);

  const createMut = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/invite-codes", {
        code: newCode,
        label: newLabel,
        maxUses: newMaxUses,
      });
    },
    onSuccess: () => {
      toast({ title: "Code created" });
      setNewCode("");
      setNewLabel("");
      setNewMaxUses(25);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ code, isActive }: { code: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/invite-codes/${code}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-6">
      <div className="border rounded-md p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-3">Create a new code</h4>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-2 items-end">
          <div>
            <Label htmlFor="newCode" className="text-xs">Code</Label>
            <Input
              id="newCode"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toLowerCase())}
              placeholder="frands"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="newLabel" className="text-xs">Label</Label>
            <Input
              id="newLabel"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Frands"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="newMax" className="text-xs">Max uses</Label>
            <Input
              id="newMax"
              type="number"
              min={1}
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 25)}
              className="mt-1"
            />
          </div>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!newCode.trim() || !newLabel.trim() || createMut.isPending}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      <ul className="divide-y border rounded-md">
        {(data?.codes ?? []).map((c) => (
          <li key={c.code} className="flex items-center justify-between p-3 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                  {c.code}
                </code>
                <span className="text-sm">{c.label}</span>
                {!c.isActive && <Badge variant="secondary">inactive</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.usesCount} / {c.maxUses} used · created {format(new Date(c.createdAt), "MMM d, yyyy")}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toggleMut.mutate({ code: c.code, isActive: !c.isActive })}
              disabled={toggleMut.isPending}
            >
              {c.isActive ? (
                <>
                  <ToggleRight className="h-4 w-4 mr-1.5 text-green-600" />
                  Active
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4 mr-1.5" />
                  Off
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Allowlist ─────────────────────────────────────────────────────────── */

function AllowlistPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ emails: AllowedEmail[] }>({
    queryKey: ["/api/admin/allowed-emails"],
  });

  const [newEmail, setNewEmail] = useState("");

  const addMut = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/allowed-emails", { email: newEmail });
    },
    onSuccess: () => {
      toast({ title: "Added to allowlist" });
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-emails"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  const removeMut = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("DELETE", `/api/admin/allowed-emails/${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      toast({ title: "Removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-emails"] });
    },
    onError: (err: Error) => toast(getErrorToast(err)),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const emails = data?.emails ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor="addEmail" className="text-xs">Add email manually</Label>
          <Input
            id="addEmail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="friend@example.com"
            className="mt-1"
          />
        </div>
        <Button
          onClick={() => addMut.mutate()}
          disabled={!newEmail.trim() || addMut.isPending}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {emails.length} allowlisted · {emails.filter((e) => e.claimedAt).length} have signed in
      </div>

      <ul className="divide-y border rounded-md">
        {emails.map((e) => (
          <li key={e.email} className="flex items-center justify-between p-3 gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{e.email}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] py-0">
                  {e.source}
                </Badge>
                {e.inviteCode && <span>via {e.inviteCode}</span>}
                {e.claimedAt ? (
                  <span>· signed in {format(new Date(e.claimedAt), "MMM d")}</span>
                ) : (
                  <span>· not signed in yet</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Remove ${e.email} from allowlist? They won't be able to sign in.`)) {
                  removeMut.mutate(e.email);
                }
              }}
              disabled={removeMut.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
