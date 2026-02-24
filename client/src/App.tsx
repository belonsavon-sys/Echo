import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import BudgetPage from "@/pages/budget";
import ReportsPage from "@/pages/reports";
import AnnualOverviewPage from "@/pages/annual-overview";
import SavingsGoalsPage from "@/pages/savings-goals";
import WhatIfPage from "@/pages/what-if";
import HistoryPage from "@/pages/history";
import ManageTagsPage from "@/pages/manage-tags";
import CategoriesSection from "@/pages/categories";
import { Wallet } from "lucide-react";

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function WelcomePage() {
  useDocumentTitle("Fudget - Simple Budget Tracking");
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Welcome to Fudget</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Simple, clean budget tracking. Create a budget from the sidebar to get started, or explore the tools available.
      </p>
    </div>
  );
}

function BudgetView({ budgetId }: { budgetId: number }) {
  useDocumentTitle("Budget | Fudget");
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <BudgetPage budgetId={budgetId} />
      </div>
      <div className="w-64 border-l overflow-auto p-3 hidden lg:block">
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

function AppContent() {
  const [activeBudgetId, setActiveBudgetId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [location] = useLocation();

  const activeView = (() => {
    if (location === "/reports") return "reports";
    if (location === "/annual") return "annual";
    if (location === "/goals") return "goals";
    if (location === "/whatif") return "whatif";
    if (location === "/history") return "history";
    if (location === "/tags") return "tags";
    if (location.startsWith("/budget/")) return "budget";
    return "home";
  })();

  function handleSelectBudget(id: number) {
    setActiveBudgetId(id);
    setLocation(`/budget/${id}`);
  }

  function handleSelectView(view: string) {
    if (view === "budget" && activeBudgetId) {
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
            <span className="text-sm font-medium text-muted-foreground">Fudget Budget</span>
          </header>
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={WelcomePage} />
              <Route path="/budget/:id">
                {(params) => {
                  const id = Number(params.id);
                  if (id && id !== activeBudgetId) setActiveBudgetId(id);
                  return <BudgetView budgetId={id} />;
                }}
              </Route>
              <Route path="/reports" component={ReportsView} />
              <Route path="/annual" component={AnnualView} />
              <Route path="/goals" component={GoalsView} />
              <Route path="/whatif" component={WhatIfView} />
              <Route path="/history" component={HistoryView} />
              <Route path="/tags" component={TagsView} />
              <Route component={WelcomePage} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
