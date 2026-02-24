import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import DashboardPage from "@/pages/dashboard";
import BudgetPage from "@/pages/budget";
import ReportsPage from "@/pages/reports";
import AnnualOverviewPage from "@/pages/annual-overview";
import SavingsGoalsPage from "@/pages/savings-goals";
import WhatIfPage from "@/pages/what-if";
import HistoryPage from "@/pages/history";
import ManageTagsPage from "@/pages/manage-tags";
import FavoritesPage from "@/pages/favorites";
import NetWorthPage from "@/pages/net-worth";
import ComparePage from "@/pages/compare";
import CategoriesSection from "@/pages/categories";
import { Wallet, Layers } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function DashboardView() {
  useDocumentTitle("Dashboard | Fudget");
  return <DashboardPage />;
}

function BudgetView({ budgetId }: { budgetId: number }) {
  useDocumentTitle("Budget | Fudget");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <BudgetPage budgetId={budgetId} categoriesButton={
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
        } />
      </div>
      <div className="w-64 border-l overflow-auto p-3 hidden md:block">
        <CategoriesSection budgetId={budgetId} />
      </div>
    </div>
  );
}

function ReportsView() {
  useDocumentTitle("Reports | Fudget");
  return <ReportsPage />;
}

function AnnualView() {
  useDocumentTitle("Annual Overview | Fudget");
  return <AnnualOverviewPage />;
}

function GoalsView() {
  useDocumentTitle("Savings Goals | Fudget");
  return <SavingsGoalsPage />;
}

function WhatIfView() {
  useDocumentTitle("What If | Fudget");
  return <WhatIfPage />;
}

function HistoryView() {
  useDocumentTitle("History | Fudget");
  return <HistoryPage />;
}

function TagsView() {
  useDocumentTitle("Manage Tags | Fudget");
  return <ManageTagsPage />;
}

function FavoritesView() {
  useDocumentTitle("Favorites | Fudget");
  return <FavoritesPage />;
}

function NetWorthView() {
  useDocumentTitle("Net Worth | Fudget");
  return <NetWorthPage />;
}

function CompareView() {
  useDocumentTitle("Compare | Fudget");
  return <ComparePage />;
}

function getPageTitle(location: string): string {
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

  const activeView = (() => {
    if (location === "/reports") return "reports";
    if (location === "/annual") return "annual";
    if (location === "/goals") return "goals";
    if (location === "/networth") return "networth";
    if (location === "/whatif") return "whatif";
    if (location === "/history") return "history";
    if (location === "/tags") return "tags";
    if (location === "/favorites") return "favorites";
    if (location === "/compare") return "compare";
    if (location.startsWith("/budget/")) return "budget";
    return "home";
  })();

  const pageTitle = getPageTitle(location);

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
      <div className="flex h-screen w-full">
        <AppSidebar
          activeBudgetId={activeBudgetId}
          activeView={activeView}
          onSelectBudget={handleSelectBudget}
          onSelectView={handleSelectView}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 px-3 py-2 border-b h-12 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground" data-testid="text-page-title">{pageTitle}</span>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
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
              <Route component={DashboardView} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
