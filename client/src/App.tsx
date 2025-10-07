import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Home from "@/pages/home";
import CreateGroup from "@/pages/create-group";
import GroupDetail from "@/pages/group-detail";
import JoinEntry from "@/pages/join-entry";
import JoinGroup from "@/pages/join-group";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create-group" component={CreateGroup} />
      <Route path="/group/:id" component={GroupDetail} />
      <Route path="/join-entry" component={JoinEntry} />
      <Route path="/join/:shareableLink" component={JoinGroup} />
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
