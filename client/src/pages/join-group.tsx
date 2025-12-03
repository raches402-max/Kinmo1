import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";
import { Users, Sparkles, Mail, CheckCircle2, UserPlus, Compass, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { Group } from "@shared/schema";

const EMAIL_TOOLTIP_CONTENT = "With email, you'll get notified when events are planned so you can see what's coming up. Without it, you'll need to check the app or wait for someone to reach out directly. No spam — just updates from your group.";

// Simplified schema: just name (required) and email (optional)
const formSchema = z.object({
  name: z.string().min(1, "Please enter your name"),
  email: z.union([
    z.string().email("Please enter a valid email"),
    z.literal(""),
  ]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function JoinGroup() {
  const [, params] = useRoute("/join/:shareableLink");
  const [, navigate] = useLocation();
  const shareableLink = params?.shareableLink;
  const { toast } = useToast();
  const { user } = useAuth();
  const [joinedSuccessfully, setJoinedSuccessfully] = useState(false);
  const [memberName, setMemberName] = useState("");
  const isLoggedIn = !!user;

  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ["/api/groups/by-link", shareableLink],
    enabled: !!shareableLink,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", `/api/groups/${group?.id}/join`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group?.id] });
      setMemberName(variables.name);
      setJoinedSuccessfully(true);
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  const onSubmit = (data: FormValues) => {
    joinMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>This group invitation link is not valid</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success screen after joining
  if (joinedSuccessfully) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 sm:p-6">
        {/* Decorative background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200/30 dark:bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-sm relative overflow-hidden border-0 shadow-xl shadow-emerald-900/5 dark:shadow-black/20">
          {/* Card accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />

          <CardContent className="p-6 pt-8 text-center">
            {/* Success icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 mb-4 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              You're in, {memberName}!
            </h1>

            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-2xl">{group?.emoji || "🎉"}</span>
              <span className="text-lg font-medium text-zinc-700 dark:text-zinc-300">{group?.name}</span>
            </div>

            {isLoggedIn ? (
              <>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                  You've successfully joined the group! You can now create events, invite others, and help plan outings together.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-left">
                    <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">What's next?</p>
                      <p className="text-zinc-600 dark:text-zinc-400">Discover new places, create events, and start planning your next outing!</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => navigate(`/group/${group?.id}`)}
                  className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <Compass className="h-4 w-4 mr-2" />
                  Go to Group
                </Button>
              </>
            ) : (
              <>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                  You've joined the group! You'll be notified when events are planned.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-left">
                    <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">Want to do more?</p>
                      <p className="text-zinc-600 dark:text-zinc-400">Create an account to discover places, swipe on venues, and plan events for the group!</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => navigate("/")}
                  className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create an Account
                </Button>

                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
                  Or close this page and wait for event invites
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 sm:p-6">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-200/30 dark:bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-sm relative overflow-hidden border-0 shadow-xl shadow-orange-900/5 dark:shadow-black/20">
        {/* Card accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-rose-400 to-pink-400" />

        <CardContent className="p-6 pt-8">
          {/* Group identity section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-900/30 dark:to-rose-900/30 text-4xl mb-4 shadow-lg shadow-orange-200/50 dark:shadow-orange-900/20 ring-4 ring-white dark:ring-zinc-800">
              {group.emoji || <Users className="h-10 w-10 text-orange-600 dark:text-orange-400" />}
            </div>
            <h1
              className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1"
              data-testid="text-group-name"
            >
              {group.name}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              You've been invited to join
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium">
                      Your name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="How should we call you?"
                        className="h-12 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus:border-orange-400 focus:ring-orange-400/20 transition-all"
                        {...field}
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      Email
                      <span className="text-zinc-400 dark:text-zinc-500 font-normal text-xs">(optional)</span>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] p-3 text-sm">
                            <p className="font-medium mb-1">Why add your email?</p>
                            <p className="text-muted-foreground leading-relaxed">
                              {EMAIL_TOOLTIP_CONTENT}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="h-12 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus:border-orange-400 focus:ring-orange-400/20 transition-all"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 mt-2"
                disabled={joinMutation.isPending}
                data-testid="button-join"
              >
                {joinMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  "Join Group"
                )}
              </Button>
            </form>
          </Form>

          {/* Footer note */}
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-6">
            You can add preferences and availability later
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
