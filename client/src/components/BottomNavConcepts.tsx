/**
 * Bottom Navigation Concepts for Kinmo
 *
 * This file contains visual explorations for mobile bottom nav.
 * Run the app and visit /prototype-nav to see these concepts.
 */

import { useState } from "react";
import {
  Home, Users, Bell, User, Calendar, CalendarDays,
  Compass, Search, PlusCircle, Plus, Sparkles,
  PartyPopper, MapPin, Heart, Star, Zap,
  LayoutGrid, Menu, CalendarCheck, UserCircle,
  CalendarPlus, UsersRound, MessageCircle, Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// CONCEPT 1: Events-First (Your Suggestion)
// Focus: What's happening → Who's involved → You
// ============================================================
function ConceptEventsFirst() {
  const [active, setActive] = useState("events");

  const items = [
    { id: "events", label: "Events", icon: CalendarDays, description: "Your upcoming & past events" },
    { id: "groups", label: "Groups", icon: Users, description: "Your friend groups" },
    { id: "profile", label: "Profile", icon: User, description: "Settings & preferences" },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 1: Events-First (3 tabs)
      </div>
      <p className="text-xs text-muted-foreground">
        Removes Alerts (already in header). Simple, focused. "Events" is more specific than "Home".
      </p>
      <nav className="bg-zinc-950 rounded-2xl p-1 flex items-center justify-around h-16 border border-zinc-800">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all rounded-xl",
                isActive
                  ? "text-white bg-zinc-800"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 2: Quick Action Center
// A prominent "+" button for creating events
// ============================================================
function ConceptQuickAction() {
  const [active, setActive] = useState("events");

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 2: Quick Action Center
      </div>
      <p className="text-xs text-muted-foreground">
        Prominent center action button for creating events. Instagram/TikTok pattern.
      </p>
      <nav className="bg-zinc-950 rounded-2xl p-1 flex items-center justify-around h-16 border border-zinc-800 relative">
        {/* Left side */}
        <button
          onClick={() => setActive("events")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "events" ? "text-white" : "text-zinc-500"
          )}
        >
          <CalendarDays className={cn("h-5 w-5", active === "events" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Events</span>
        </button>

        <button
          onClick={() => setActive("groups")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "groups" ? "text-white" : "text-zinc-500"
          )}
        >
          <Users className={cn("h-5 w-5", active === "groups" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Groups</span>
        </button>

        {/* Center action button */}
        <div className="flex-1 flex justify-center">
          <button className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/30 -mt-4 border-4 border-zinc-950">
            <Plus className="h-6 w-6 text-white stroke-[2.5]" />
          </button>
        </div>

        <button
          onClick={() => setActive("discover")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "discover" ? "text-white" : "text-zinc-500"
          )}
        >
          <Compass className={cn("h-5 w-5", active === "discover" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Discover</span>
        </button>

        <button
          onClick={() => setActive("profile")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "profile" ? "text-white" : "text-zinc-500"
          )}
        >
          <User className={cn("h-5 w-5", active === "profile" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 3: Activity Feed Focus
// Centered around what's happening in your groups
// ============================================================
function ConceptActivityFeed() {
  const [active, setActive] = useState("feed");

  const items = [
    { id: "feed", label: "Activity", icon: Zap, description: "What's happening" },
    { id: "upcoming", label: "Upcoming", icon: CalendarCheck, description: "Your schedule" },
    { id: "groups", label: "Groups", icon: UsersRound, description: "Your crews" },
    { id: "you", label: "You", icon: UserCircle, description: "Profile & settings" },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 3: Activity Feed Focus
      </div>
      <p className="text-xs text-muted-foreground">
        "Activity" as home - see RSVPs, new plans, group updates. More social/dynamic feel.
      </p>
      <nav className="bg-white rounded-2xl p-1 flex items-center justify-around h-16 border border-zinc-200 shadow-sm">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
                isActive
                  ? "text-orange-600"
                  : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 4: Minimal 3-Tab (Google Maps Style)
// Ultra-simple, icon-forward
// ============================================================
function ConceptMinimal() {
  const [active, setActive] = useState("plans");

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 4: Minimal 3-Tab
      </div>
      <p className="text-xs text-muted-foreground">
        Just the essentials. Large touch targets. Very clean.
      </p>
      <nav className="bg-zinc-100 rounded-full p-2 flex items-center justify-around h-14 max-w-xs mx-auto">
        <button
          onClick={() => setActive("plans")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
            active === "plans"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600"
          )}
        >
          <CalendarDays className="h-5 w-5" />
          {active === "plans" && <span className="text-sm font-medium">Plans</span>}
        </button>

        <button
          onClick={() => setActive("groups")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
            active === "groups"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600"
          )}
        >
          <Users className="h-5 w-5" />
          {active === "groups" && <span className="text-sm font-medium">Groups</span>}
        </button>

        <button
          onClick={() => setActive("me")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
            active === "me"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600"
          )}
        >
          <User className="h-5 w-5" />
          {active === "me" && <span className="text-sm font-medium">Me</span>}
        </button>
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 5: Discovery-Forward
// For apps wanting to push venue/activity discovery
// ============================================================
function ConceptDiscovery() {
  const [active, setActive] = useState("home");

  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "explore", label: "Explore", icon: Compass },
    { id: "plans", label: "Plans", icon: CalendarCheck },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 5: Discovery-Forward
      </div>
      <p className="text-xs text-muted-foreground">
        "Explore" tab for discovering new venues/activities. Good if venue discovery is key.
      </p>
      <nav className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl flex items-center justify-around h-16 border border-zinc-700">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all relative",
                isActive
                  ? "text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-400 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 6: Inbox-Style
// Messaging/email app pattern
// ============================================================
function ConceptInbox() {
  const [active, setActive] = useState("inbox");

  const items = [
    { id: "inbox", label: "Inbox", icon: Inbox, badge: 3 },
    { id: "upcoming", label: "Upcoming", icon: Calendar, badge: 0 },
    { id: "groups", label: "Groups", icon: Users, badge: 0 },
    { id: "me", label: "Me", icon: User, badge: 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 6: Inbox-Style
      </div>
      <p className="text-xs text-muted-foreground">
        "Inbox" combines notifications + action items. All pending RSVPs, invites, etc.
      </p>
      <nav className="bg-white rounded-t-3xl flex items-center justify-around h-16 border border-zinc-200 shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all relative",
                isActive
                  ? "text-blue-600"
                  : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============================================================
// CONCEPT 7: Social-First
// Emphasizes the social/group aspect
// ============================================================
function ConceptSocial() {
  const [active, setActive] = useState("hangouts");

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Concept 7: Social-First (Fun Labels)
      </div>
      <p className="text-xs text-muted-foreground">
        Playful labels: "Hangouts", "Crews", "Me". More casual/social vibe.
      </p>
      <nav className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-around h-16">
        <button
          onClick={() => setActive("hangouts")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "hangouts" ? "text-white" : "text-white/60"
          )}
        >
          <PartyPopper className={cn("h-5 w-5", active === "hangouts" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Hangouts</span>
        </button>

        <button
          onClick={() => setActive("crews")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "crews" ? "text-white" : "text-white/60"
          )}
        >
          <UsersRound className={cn("h-5 w-5", active === "crews" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Crews</span>
        </button>

        <button
          onClick={() => setActive("me")}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
            active === "me" ? "text-white" : "text-white/60"
          )}
        >
          <User className={cn("h-5 w-5", active === "me" && "stroke-[2.5]")} />
          <span className="text-[10px] font-medium">Me</span>
        </button>
      </nav>
    </div>
  );
}

// ============================================================
// MAIN PROTOTYPE PAGE
// ============================================================
export function BottomNavConcepts() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6 pb-32">
      <div className="max-w-md mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">Bottom Nav Concepts</h1>
          <p className="text-sm text-zinc-600">
            Exploring different approaches for mobile navigation. Tap to interact.
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm">
          <h2 className="font-semibold text-zinc-900 mb-3">Current Setup</h2>
          <div className="text-sm text-zinc-600 space-y-1">
            <p>• <strong>Home</strong> - Dashboard with events (default tab)</p>
            <p>• <strong>Groups</strong> - Same dashboard, groups tab selected</p>
            <p>• <strong>Alerts</strong> - Notifications (redundant with header bell)</p>
            <p>• <strong>Profile</strong> - User settings</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-900 mb-2">Key Observations</h2>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• "Alerts" is duplicate of header notification bell</li>
            <li>• "Home" is vague - could mean anything</li>
            <li>• Groups and Events are actually tabs on the same page</li>
            <li>• Consider: what actions do users do MOST on mobile?</li>
          </ul>
        </div>

        <div className="space-y-6">
          <ConceptEventsFirst />
          <ConceptQuickAction />
          <ConceptActivityFeed />
          <ConceptMinimal />
          <ConceptDiscovery />
          <ConceptInbox />
          <ConceptSocial />
        </div>

        <div className="bg-zinc-900 text-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Recommendations</h2>
          <div className="text-sm space-y-3">
            <div>
              <strong className="text-orange-400">For Simplicity:</strong>
              <p className="text-zinc-300">Concept 1 or 4 - Drop Alerts, keep it minimal</p>
            </div>
            <div>
              <strong className="text-orange-400">For Engagement:</strong>
              <p className="text-zinc-300">Concept 2 - Floating action button drives event creation</p>
            </div>
            <div>
              <strong className="text-orange-400">For Social Feel:</strong>
              <p className="text-zinc-300">Concept 3 or 7 - Activity feed creates FOMO, fun labels</p>
            </div>
            <div>
              <strong className="text-orange-400">For Discovery:</strong>
              <p className="text-zinc-300">Concept 5 - If venue exploration is key to your app</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BottomNavConcepts;
