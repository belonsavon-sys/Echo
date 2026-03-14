import { lazy, Suspense, useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Layers, Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import LandingPage from "@/pages/landing";
import AuthCallbackPage from "@/pages/auth-callback";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { DevTools } from "@/components/dev/dev-tools";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const BudgetPage = lazy(() => import("@/pages/budget"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AnnualOverviewPage = lazy(() => import("@/pages/annual-overview"));
const SavingsGoalsPage = lazy(() => import("@/pages/savings-goals"));
const WhatIfPage = lazy(() => import("@/pages/what-if"));
const HistoryPage = lazy(() => import("@/pages/history"));
const ManageTagsPage = lazy(() => import("@/pages/manage-tags"));
const FavoritesPage = lazy(() => import("@/pages/favorites"));
const NetWorthPage = lazy(() => import("@/pages/net-worth"));
const ComparePage = lazy(() => import("@/pages/compare"));
const CategoriesSection = lazy(() => import("@/pages/categories"));
const DevRoutesPage = lazy(() => import("@/pages/dev-routes"));

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function RouteLoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading view
      </div>
    </div>
  );
}

function DashboardView() {
  useDocumentTitle("Dashboard | Echo");
  return <DashboardPage />;
}

function BudgetView({ budgetId }: { budgetId: number }) {
  useDocumentTitle("Budget | Echo");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-h-0 min-w-0">
        <BudgetPage
          budgetId={budgetId}
          categoriesButton={
            <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="md:hidden" data-testid="button-open-categories-sheet">
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Categories
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] overflow-auto">
                <SheetHeader>
                  <SheetTitle>Categories</SheetTitle>
                </SheetHeader>
                <div className="pt-4">
                  <CategoriesSection budgetId={budgetId} />
                </div>
              </SheetContent>
            </Sheet>
          }
        />
      </div>
      <div className="hidden w-64 overflow-auto border-l p-3 md:block">
        <CategoriesSection budgetId={budgetId} />
      </div>
    </div>
  );
}

function ReportsView() {
  useDocumentTitle("Reports | Echo");
  return <ReportsPage />;
}

function AnnualView() {
  useDocumentTitle("Annual Overview | Echo");
  return <AnnualOverviewPage />;
}

function GoalsView() {
  useDocumentTitle("Savings Goals | Echo");
  return <SavingsGoalsPage />;
}

function WhatIfView() {
  useDocumentTitle("What If | Echo");
  return <WhatIfPage />;
}

function HistoryView() {
  useDocumentTitle("History | Echo");
  return <HistoryPage />;
}

function TagsView() {
  useDocumentTitle("Manage Tags | Echo");
  return <ManageTagsPage />;
}

function FavoritesView() {
  useDocumentTitle("Favorites | Echo");
  return <FavoritesPage />;
}

function NetWorthView() {
  useDocumentTitle("Net Worth | Echo");
  return <NetWorthPage />;
}

function CompareView() {
  useDocumentTitle("Compare | Echo");
  return <ComparePage />;
}

function getPageTitle(location: string): string {
  if (import.meta.env.DEV && location === "/dev/routes") return "Dev Routes";
  if (location === "/reports") return "Reports";
  if (location === "/annual") return "Annual Overview";
  if (location === "/goals") return "Savings Goals";
  if (location === "/networth") return "Net Worth";
  if (location === "/whatif") return "What If";
  if (location === "/history") return "History";
  if (location === "/tags") return "Manage Tags";
  if (location === "/favorites") return "Favorites";
  if (location === "/compare") return "Compare";
  if (location.startsWith("/budget/")) return "Budget";
  return "Dashboard";
}

function BudgetRouteHandler({ id, activeBudgetId, setActiveBudgetId }: { id: string; activeBudgetId: number | null; setActiveBudgetId: (id: number) => void }) {
  const budgetId = Number(id);
  useEffect(() => {
    if (budgetId && budgetId !== activeBudgetId) {
      setActiveBudgetId(budgetId);
    }
  }, [budgetId, activeBudgetId, setActiveBudgetId]);
  return <BudgetView budgetId={budgetId} />;
}

function AppContent() {
  const [activeBudgetId, setActiveBudgetId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const locationPath = location.split("?")[0];

  const activeView = (() => {
    if (import.meta.env.DEV && locationPath === "/dev/routes") return "devroutes";
    if (locationPath === "/reports") return "reports";
    if (locationPath === "/annual") return "annual";
    if (locationPath === "/goals") return "goals";
    if (locationPath === "/networth") return "networth";
    if (locationPath === "/whatif") return "whatif";
    if (locationPath === "/history") return "history";
    if (locationPath === "/tags") return "tags";
    if (locationPath === "/favorites") return "favorites";
    if (locationPath === "/compare") return "compare";
    if (locationPath.startsWith("/budget/")) return "budget";
    return "home";
  })();

  const pageTitle = getPageTitle(locationPath);

  function handleSelectBudget(id: number) {
    setActiveBudgetId(id);
    setLocation(`/budget/${id}`);
  }

  function handleSelectView(view: string) {
    if (view === "home") {
      setLocation("/");
    } else if (view === "budget" && activeBudgetId) {
      setLocation(`/budget/${activeBudgetId}`);
    } else if (view !== "budget") {
      setLocation(`/${view}`);
    }
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <AppSidebar
          activeBudgetId={activeBudgetId}
          activeView={activeView}
          onSelectBudget={handleSelectBudget}
          onSelectView={handleSelectView}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 px-3 py-2 border-b h-12 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground" data-testid="text-page-title">{pageTitle}</span>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<RouteLoadingState />}>
              <Switch location={locationPath}>
                <Route path="/" component={DashboardView} />
                <Route path="/budget/:id">
                  {(params) => <BudgetRouteHandler id={params.id} activeBudgetId={activeBudgetId} setActiveBudgetId={setActiveBudgetId} />}
                </Route>
                <Route path="/reports" component={ReportsView} />
                <Route path="/annual" component={AnnualView} />
                <Route path="/goals" component={GoalsView} />
                <Route path="/networth" component={NetWorthView} />
                <Route path="/whatif" component={WhatIfView} />
                <Route path="/history" component={HistoryView} />
                <Route path="/tags" component={TagsView} />
                <Route path="/favorites" component={FavoritesView} />
                <Route path="/compare" component={CompareView} />
                {import.meta.env.DEV ? <Route path="/dev/routes" component={DevRoutesPage} /> : null}
                <Route component={DashboardView} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const locationPath = location.split("?")[0];

  if (locationPath === "/auth/callback") {
    return <AuthCallbackPage />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AppContent />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppErrorBoundary>
            <Toaster />
            <AuthGate />
            <DevTools />
          </AppErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
