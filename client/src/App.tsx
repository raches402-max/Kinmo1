// Reference: javascript_log_in_with_replit blueprint
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CreateGroup from "@/pages/create-group";
import GroupDetail from "@/pages/group-detail";
import JoinEntry from "@/pages/join-entry";
import JoinGroup from "@/pages/join-group";
import YasThis from "@/pages/yas-this";
import InvitePage from "@/pages/invite";
import RsvpItineraryPage from "@/pages/rsvp-itinerary";
import GuestRsvpPage from "@/pages/guest-rsvp";
import ClaimMemberPage from "@/pages/claim-member";
import MemberEventsPage from "@/pages/member-events";
import Profile from "@/pages/profile";
import MemberProfileSetup from "@/pages/member-profile-setup";
import EventDetailsPage from "@/pages/event-details";
import Admin from "@/pages/admin";
import LearningInsights from "@/pages/learning-insights";
import Preferences from "@/pages/preferences";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, error } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if auth check failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-destructive mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Failed to verify authentication. Please try refreshing the page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/join-entry" component={JoinEntry} />
          <Route path="/join/:shareableLink" component={JoinGroup} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
          <Route path="/guest-rsvp/:guestToken" component={GuestRsvpPage} />
          <Route path="/claim/:claimToken" component={ClaimMemberPage} />
          <Route path="/events" component={MemberEventsPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/preferences" component={Preferences} />
          <Route path="/create-group" component={CreateGroup} />
          <Route path="/group/:id" component={GroupDetail} />
          <Route path="/groups/:id/learning" component={LearningInsights} />
          <Route path="/yas-this" component={YasThis} />
          <Route path="/join-entry" component={JoinEntry} />
          <Route path="/join/:shareableLink" component={JoinGroup} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
          <Route path="/guest-rsvp/:guestToken" component={GuestRsvpPage} />
          <Route path="/claim/:claimToken" component={ClaimMemberPage} />
          <Route path="/events" component={MemberEventsPage} />
          <Route path="/profile" component={Profile} />
          <Route path="/member-profile-setup/:memberId" component={MemberProfileSetup} />
          <Route path="/event/:id" component={EventDetailsPage} />
          <Route path="/admin" component={Admin} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
