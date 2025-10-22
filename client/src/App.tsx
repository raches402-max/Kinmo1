// Reference: javascript_log_in_with_replit blueprint
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CreateGroup from "@/pages/create-group";
import GroupDetail from "@/pages/group-detail";
import JoinEntry from "@/pages/join-entry";
import JoinGroup from "@/pages/join-group";
import YasThis from "@/pages/yas-this";
import InvitePage from "@/pages/invite";
import RsvpItineraryPage from "@/pages/rsvp-itinerary";
import ClaimMemberPage from "@/pages/claim-member";
import MemberEventsPage from "@/pages/member-events";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/join-entry" component={JoinEntry} />
          <Route path="/join/:shareableLink" component={JoinGroup} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
          <Route path="/claim/:claimToken" component={ClaimMemberPage} />
          <Route path="/events" component={MemberEventsPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/create-group" component={CreateGroup} />
          <Route path="/group/:id" component={GroupDetail} />
          <Route path="/yas-this" component={YasThis} />
          <Route path="/join-entry" component={JoinEntry} />
          <Route path="/join/:shareableLink" component={JoinGroup} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
          <Route path="/claim/:claimToken" component={ClaimMemberPage} />
          <Route path="/events" component={MemberEventsPage} />
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
