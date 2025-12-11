// Reference: javascript_log_in_with_replit blueprint
import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Lightweight pages - keep as static imports
import Landing from "@/pages/landing";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import NotFound from "@/pages/not-found";

// Heavy pages - lazy load for better initial bundle size
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CreateGroup = lazy(() => import("@/pages/create-group"));
const GroupDetail = lazy(() => import("@/pages/group-detail"));
const JoinEntry = lazy(() => import("@/pages/join-entry"));
const JoinGroup = lazy(() => import("@/pages/join-group"));
const InvitePage = lazy(() => import("@/pages/invite"));
const RsvpItineraryPage = lazy(() => import("@/pages/rsvp-itinerary"));
const EventInvitePage = lazy(() => import("@/pages/event-invite"));
const GuestEventInvitePage = lazy(() => import("@/pages/guest-event-invite"));
const GuestRsvpPage = lazy(() => import("@/pages/guest-rsvp"));
const AvailabilityPulsePage = lazy(() => import("@/pages/availability-pulse"));
const ClaimMemberPage = lazy(() => import("@/pages/claim-member"));
const LinkMemberAccountPage = lazy(() => import("@/pages/link-member-account"));
const MemberEventsPage = lazy(() => import("@/pages/member-events"));
const Profile = lazy(() => import("@/pages/profile"));
const MemberProfileSetup = lazy(() => import("@/pages/member-profile-setup"));
const EventDetailsPage = lazy(() => import("@/pages/event-details"));
const Admin = lazy(() => import("@/pages/admin"));
const LearningInsights = lazy(() => import("@/pages/learning-insights"));
const Preferences = lazy(() => import("@/pages/preferences"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const PrototypeGroupTiles = lazy(() => import("@/pages/prototype-group-tiles"));
const PrototypeGroupCards = lazy(() => import("@/pages/prototype-group-cards"));
const PrototypeGroupCardsMobile = lazy(() => import("@/pages/prototype-group-cards-mobile"));
const PrototypeEventCards = lazy(() => import("@/pages/prototype-event-cards"));
const PrototypeEventDetailsMobile = lazy(() => import("@/pages/prototype-event-details-mobile"));
const PrototypeEventDetailsDesktop = lazy(() => import("@/pages/prototype-event-details-desktop"));
const PrototypeGroupDetailsDesktop = lazy(() => import("@/pages/prototype-group-details-desktop"));
const PrototypePlaces = lazy(() => import("@/pages/prototype-places"));
const PrototypeAvailabilityGrid = lazy(() => import("@/pages/prototype-availability-grid"));
const PrototypeTimelineInfo = lazy(() => import("@/pages/prototype-timeline-info"));
const PrototypeKinmoText = lazy(() => import("@/pages/prototype-kinmo-text"));
const PrototypeHeadlineLayouts = lazy(() => import("@/pages/prototype-headline-layouts"));
const BottomNavConcepts = lazy(() => import("@/components/BottomNavConcepts"));
const Places = lazy(() => import("@/pages/places"));
const FeedbackMockup = lazy(() => import("@/pages/feedback-mockup"));

function Router() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [location] = useLocation();

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
    <>
      {/* Add bottom padding on mobile to prevent content from being hidden by bottom nav */}
      <div className="pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            {!isAuthenticated ? (
              <>
                <Route path="/" component={Landing} />
                <Route path="/join-entry" component={JoinEntry} />
                <Route path="/join/:shareableLink" component={JoinGroup} />
                <Route path="/invite/:token" component={InvitePage} />
                <Route path="/event/:eventId/invite" component={EventInvitePage} />
                <Route path="/event/:eventId/guest" component={GuestEventInvitePage} />
                <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
                <Route path="/guest-rsvp/:guestToken" component={GuestRsvpPage} />
                <Route path="/availability/:pulseId/:responseToken" component={AvailabilityPulsePage} />
                <Route path="/claim/:claimToken" component={ClaimMemberPage} />
                <Route path="/events" component={MemberEventsPage} />
                <Route path="/prototype/kinmo-text" component={PrototypeKinmoText} />
                <Route path="/prototype/headline-layouts" component={PrototypeHeadlineLayouts} />
                <Route path="/prototype/group-details-desktop" component={PrototypeGroupDetailsDesktop} />
                <Route path="/prototype/feedback-mockup" component={FeedbackMockup} />
                <Route path="/privacy" component={Privacy} />
                <Route path="/terms" component={Terms} />
              </>
            ) : (
              <>
                <Route path="/" component={Dashboard} />
                <Route path="/preferences" component={Preferences} />
                <Route path="/notifications" component={NotificationsPage} />
                <Route path="/create-group" component={CreateGroup} />
                <Route path="/group/:id" component={GroupDetail} />
                <Route path="/groups/:id/learning" component={LearningInsights} />
                <Route path="/join-entry" component={JoinEntry} />
                <Route path="/join/:shareableLink" component={JoinGroup} />
                <Route path="/invite/:token" component={InvitePage} />
                <Route path="/event/:eventId/invite" component={EventInvitePage} />
                <Route path="/event/:eventId/guest" component={GuestEventInvitePage} />
                <Route path="/rsvp/:itineraryId/:inviteToken" component={RsvpItineraryPage} />
                <Route path="/guest-rsvp/:guestToken" component={GuestRsvpPage} />
                <Route path="/availability/:pulseId/:responseToken" component={AvailabilityPulsePage} />
                <Route path="/claim/:claimToken" component={ClaimMemberPage} />
                <Route path="/link-member-account" component={LinkMemberAccountPage} />
                <Route path="/events" component={MemberEventsPage} />
                <Route path="/profile" component={Profile} />
                <Route path="/member-profile-setup/:memberId" component={MemberProfileSetup} />
                <Route path="/event/:id" component={EventDetailsPage} />
                <Route path="/admin" component={Admin} />
                <Route path="/places" component={Places} />
                <Route path="/prototype/group-tiles" component={PrototypeGroupTiles} />
                <Route path="/prototype/group-cards" component={PrototypeGroupCards} />
                <Route path="/prototype/group-cards-mobile" component={PrototypeGroupCardsMobile} />
                <Route path="/prototype/event-cards" component={PrototypeEventCards} />
                <Route path="/prototype/event-details-mobile" component={PrototypeEventDetailsMobile} />
                <Route path="/prototype/event-details-desktop" component={PrototypeEventDetailsDesktop} />
                <Route path="/prototype/group-details-desktop" component={PrototypeGroupDetailsDesktop} />
                <Route path="/prototype/places" component={PrototypePlaces} />
                <Route path="/prototype/availability-grid" component={PrototypeAvailabilityGrid} />
                <Route path="/prototype/timeline-info" component={PrototypeTimelineInfo} />
                <Route path="/prototype/kinmo-text" component={PrototypeKinmoText} />
                <Route path="/prototype/headline-layouts" component={PrototypeHeadlineLayouts} />
                <Route path="/prototype/nav" component={BottomNavConcepts} />
                <Route path="/prototype/feedback-mockup" component={FeedbackMockup} />
                <Route path="/privacy" component={Privacy} />
                <Route path="/terms" component={Terms} />
              </>
            )}
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>

      {/* Show bottom nav only for authenticated users, hide on prototype pages */}
      {isAuthenticated && !location.startsWith("/prototype") && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
