import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import type {
  Budget,
  Category,
  DashboardWatchlist,
  Entry,
  EntryHistory,
  SavingsGoal,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock,
  DollarSign,
  Plus,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";

type DashboardCardId =
  | "income"
  | "expenses"
  | "balance"
  | "activeBudgets"
  | "starred"
  | "goals"
  | "activity"
  | "watchlists";

type WatchlistSummary = DashboardWatchlist & {
  monthKey: string;
  actualAmount: number;
  remainingAmount: number;
  progressPercent: number | null;
  budgetName: string | null;
  categoryName: string | null;
};

const DEFAULT_CARD_ORDER: DashboardCardId[] = [
  "income",
  "expenses",
  "balance",
  "activeBudgets",
  "starred",
  "goals",
  "activity",
  "watchlists",
];

const CARD_TITLES: Record<DashboardCardId, string> = {
  income: "Total Income",
  expenses: "Total Expenses",
  balance: "Net Balance",
  activeBudgets: "Active Budgets",
  starred: "Starred Unpaid Expenses",
  goals: "Savings Goals",
  activity: "Recent Activity",
  watchlists: "Watchlists",
};

export default function DashboardPage() {
  const [monthKey, setMonthKey] = useState(format(new Date(), "yyyy-MM"));
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newWatchlistTargetAmount, setNewWatchlistTargetAmount] = useState("");
  const [newWatchlistBudgetId, setNewWatchlistBudgetId] = useState("all");
  const [newWatchlistCategoryId, setNewWatchlistCategoryId] = useState("all");
  const [newWatchlistScope, setNewWatchlistScope] = useState<"current" | "fixed">("current");
  const [newWatchlistFixedMonth, setNewWatchlistFixedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });
  const selectableBudgets = budgets.filter((b) => !b.isFolder);

  const { data: watchlists = [], isLoading: watchlistsLoading } = useQuery<WatchlistSummary[]>({
    queryKey: ["/api/dashboard/watchlists", monthKey],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/dashboard/watchlists?monthKey=${monthKey}`);
      return response.json();
    },
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const entriesQueries = useQueries({
    queries: selectableBudgets.map((budget) => ({
      queryKey: ["/api/budgets", budget.id, "entries"],
      enabled: selectableBudgets.length > 0,
    })),
  });

  const historyQueries = useQueries({
    queries: selectableBudgets.map((budget) => ({
      queryKey: ["/api/budgets", budget.id, "history"],
      enabled: selectableBudgets.length > 0,
    })),
  });

  const categoriesQueries = useQueries({
    queries: selectableBudgets.map((budget) => ({
      queryKey: ["/api/budgets", budget.id, "categories"],
      enabled: selectableBudgets.length > 0,
    })),
  });

  const createWatchlist = useMutation({
    mutationFn: async (payload: {
      name: string;
      targetAmount: number;
      budgetId: number | null;
      categoryId: number | null;
      monthKeyScope: "current" | "fixed";
      fixedMonthKey: string | null;
    }) => {
      const response = await apiRequest("POST", "/api/dashboard/watchlists", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/watchlists"] });
      setNewWatchlistName("");
      setNewWatchlistTargetAmount("");
      setNewWatchlistBudgetId("all");
      setNewWatchlistCategoryId("all");
      setNewWatchlistScope("current");
      setNewWatchlistFixedMonth(format(new Date(), "yyyy-MM"));
    },
  });

  const updateWatchlist = useMutation({
    mutationFn: async (payload: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/dashboard/watchlists/${payload.id}`, {
        isActive: payload.isActive,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/watchlists"] });
    },
  });

  const deleteWatchlist = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/dashboard/watchlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/watchlists"] });
    },
  });

  const categoriesByBudget = useMemo(() => {
    const map = new Map<number, Category[]>();
    selectableBudgets.forEach((budget, index) => {
      map.set(budget.id, (categoriesQueries[index]?.data as Category[]) || []);
    });
    return map;
  }, [categoriesQueries, selectableBudgets]);

  const categoriesForSelectedBudget = newWatchlistBudgetId !== "all"
    ? categoriesByBudget.get(Number(newWatchlistBudgetId)) || []
    : [];

  const entriesLoading = entriesQueries.some((query) => query.isLoading);
  const historyLoading = historyQueries.some((query) => query.isLoading);
  const isLoading = budgetsLoading || entriesLoading;

  const allEntries: Entry[] = entriesQueries.flatMap((query) => (query.data as Entry[]) || []);
  const allHistory: (EntryHistory & { budgetName: string })[] = historyQueries
    .flatMap((query, index) =>
      ((query.data as EntryHistory[]) || []).map((history) => ({
        ...history,
        budgetName: selectableBudgets[index]?.name || "Budget",
      })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  const budgetCurrencyMap = new Map(selectableBudgets.map((budget) => [budget.id, budget.currency || "USD"]));
  const currencyTotals = new Map<string, { income: number; expenses: number }>();
  for (const entry of allEntries) {
    const currency = budgetCurrencyMap.get(entry.budgetId) || "USD";
    const current = currencyTotals.get(currency) || { income: 0, expenses: 0 };
    if (entry.type === "income") current.income += entry.amount;
    else current.expenses += entry.amount;
    currencyTotals.set(currency, current);
  }
  const currencyKeys = Array.from(currencyTotals.keys()).sort();
  const primaryCurrency = currencyKeys[0] || "USD";
  const primaryTotals = currencyTotals.get(primaryCurrency) || { income: 0, expenses: 0 };

  const totalIncome = primaryTotals.income;
  const totalExpenses = primaryTotals.expenses;
  const netBalance = totalIncome - totalExpenses;
  const activeBudgets = selectableBudgets.filter((budget) => budget.isActive).length;
  const budgetNameMap = new Map(selectableBudgets.map((budget) => [budget.id, budget.name]));

  const starredUnpaid = allEntries
    .filter((entry) => entry.isStarred && !entry.isPaidOrReceived && entry.type === "expense")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const parsedNewWatchlistTargetAmount = Number(newWatchlistTargetAmount);
  const canCreateWatchlist =
    !!newWatchlistName.trim() &&
    Number.isFinite(parsedNewWatchlistTargetAmount) &&
    parsedNewWatchlistTargetAmount >= 0;

  function getEntryNameFromHistory(history: EntryHistory): string {
    try {
      const data = history.newData ? JSON.parse(history.newData) : history.previousData ? JSON.parse(history.previousData) : null;
      return data?.name || "Entry";
    } catch {
      return "Entry";
    }
  }

  function handleCreateWatchlist() {
    const name = newWatchlistName.trim();
    const targetAmount = Number(newWatchlistTargetAmount);
    if (!name || !Number.isFinite(targetAmount) || targetAmount < 0) return;

    createWatchlist.mutate({
      name,
      targetAmount,
      budgetId: newWatchlistBudgetId === "all" ? null : Number(newWatchlistBudgetId),
      categoryId: newWatchlistCategoryId === "all" ? null : Number(newWatchlistCategoryId),
      monthKeyScope: newWatchlistScope,
      fixedMonthKey: newWatchlistScope === "fixed" ? newWatchlistFixedMonth : null,
    });
  }

  function renderCard(cardId: DashboardCardId) {
    if (cardId === "income") {
      return (
        <Card data-testid="card-income">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{CARD_TITLES.income}</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(totalIncome, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currencyKeys.length > 1 ? `${primaryCurrency} budgets` : "Across all budgets"}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (cardId === "expenses") {
      return (
        <Card data-testid="card-expenses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{CARD_TITLES.expenses}</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {formatCurrency(totalExpenses, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currencyKeys.length > 1 ? `${primaryCurrency} budgets` : "Across all budgets"}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (cardId === "balance") {
      return (
        <Card data-testid="card-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{CARD_TITLES.balance}</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${netBalance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
              {formatCurrency(netBalance, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Income minus expenses</p>
          </CardContent>
        </Card>
      );
    }

    if (cardId === "activeBudgets") {
      return (
        <Card data-testid="card-active-budgets">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{CARD_TITLES.activeBudgets}</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeBudgets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectableBudgets.length} total budget{selectableBudgets.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (cardId === "starred") {
      return (
        <Card data-testid="card-starred">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              {CARD_TITLES.starred}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {starredUnpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No starred unpaid expenses</p>
            ) : (
              <div className="space-y-1">
                {starredUnpaid.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-yellow-50/50 dark:bg-yellow-950/10">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{entry.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {budgetNameMap.get(entry.budgetId) || "Budget"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(entry.date), "MMM d, yyyy")}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                      -{formatCurrency(entry.amount, budgetCurrencyMap.get(entry.budgetId) || "USD")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (cardId === "goals") {
      return (
        <Card data-testid="card-goals">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              {CARD_TITLES.goals}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((index) => (
                  <Skeleton key={index} className="h-12 rounded-md" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No savings goals yet</p>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => {
                  const progressPercent = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{goal.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {formatCurrency(goal.currentAmount, "USD")} / {formatCurrency(goal.targetAmount, "USD")}
                        </span>
                      </div>
                      <Progress
                        value={progressPercent}
                        className="h-2"
                        style={{ "--progress-foreground": goal.color } as any}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (cardId === "activity") {
      return (
        <Card data-testid="card-activity">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {CARD_TITLES.activity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-10 rounded-md" />
                ))}
              </div>
            ) : allHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-1">
                {allHistory.map((history) => (
                  <div key={history.id} className="flex items-center gap-3 px-3 py-2 rounded-md">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                      {history.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{getEntryNameFromHistory(history)}</span>
                      <span className="text-[10px] text-muted-foreground">{history.budgetName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(history.timestamp), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card data-testid="card-watchlists">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">{CARD_TITLES.watchlists}</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={monthKey}
              onChange={(event) => setMonthKey(event.target.value || format(new Date(), "yyyy-MM"))}
              className="h-8 w-[130px]"
              data-testid="input-watchlist-month"
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-open-watchlist-create">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Watchlist</DialogTitle>
                  <DialogDescription>Track a spending target by budget/category each month.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={newWatchlistName}
                      onChange={(event) => setNewWatchlistName(event.target.value)}
                      placeholder="Dining Out"
                      data-testid="input-watchlist-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Target Amount</Label>
                    <Input
                      type="number"
                      value={newWatchlistTargetAmount}
                      onChange={(event) => setNewWatchlistTargetAmount(event.target.value)}
                      placeholder="400"
                      data-testid="input-watchlist-target"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Budget</Label>
                    <Select
                      value={newWatchlistBudgetId}
                      onValueChange={(value) => {
                        setNewWatchlistBudgetId(value);
                        setNewWatchlistCategoryId("all");
                      }}
                    >
                      <SelectTrigger data-testid="select-watchlist-budget">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All budgets</SelectItem>
                        {selectableBudgets.map((budget) => (
                          <SelectItem key={budget.id} value={String(budget.id)}>
                            {budget.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select
                      value={newWatchlistCategoryId}
                      onValueChange={setNewWatchlistCategoryId}
                      disabled={newWatchlistBudgetId === "all"}
                    >
                      <SelectTrigger data-testid="select-watchlist-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categoriesForSelectedBudget.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Scope</Label>
                    <Select value={newWatchlistScope} onValueChange={(value) => setNewWatchlistScope(value as "current" | "fixed")}>
                      <SelectTrigger data-testid="select-watchlist-scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Use dashboard month</SelectItem>
                        <SelectItem value="fixed">Fixed month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newWatchlistScope === "fixed" && (
                    <div className="space-y-1">
                      <Label>Fixed Month</Label>
                      <Input
                        type="month"
                        value={newWatchlistFixedMonth}
                        onChange={(event) => setNewWatchlistFixedMonth(event.target.value || format(new Date(), "yyyy-MM"))}
                        data-testid="input-watchlist-fixed-month"
                      />
                    </div>
                  )}
                  <Button
                    onClick={handleCreateWatchlist}
                    className="w-full"
                    disabled={!canCreateWatchlist || createWatchlist.isPending}
                    data-testid="button-create-watchlist"
                  >
                    {createWatchlist.isPending ? "Creating..." : "Create Watchlist"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {watchlistsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : watchlists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No watchlists yet</p>
          ) : (
            <div className="space-y-3">
              {watchlists.map((watchlist) => (
                <div key={watchlist.id} className="rounded-md border p-3" data-testid={`watchlist-${watchlist.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{watchlist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {watchlist.budgetName || "All budgets"}{watchlist.categoryName ? ` · ${watchlist.categoryName}` : ""}
                        {` · ${watchlist.monthKey}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateWatchlist.mutate({ id: watchlist.id, isActive: !watchlist.isActive })}
                        disabled={updateWatchlist.isPending}
                        data-testid={`button-toggle-watchlist-${watchlist.id}`}
                      >
                        {watchlist.isActive ? "Active" : "Hidden"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteWatchlist.mutate(watchlist.id)}
                        disabled={deleteWatchlist.isPending}
                        data-testid={`button-delete-watchlist-${watchlist.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="tabular-nums">
                        {formatCurrency(watchlist.actualAmount, primaryCurrency)} / {formatCurrency(watchlist.targetAmount, primaryCurrency)}
                      </span>
                    </div>
                    <Progress value={Math.min(100, watchlist.progressPercent ?? 0)} className="h-2 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview across all budgets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {DEFAULT_CARD_ORDER.map((cardId) => (
          <div
            key={cardId}
            className={cardId === "income" || cardId === "expenses" || cardId === "balance" || cardId === "activeBudgets"
              ? "xl:col-span-1"
              : "xl:col-span-2"}
          >
            {renderCard(cardId)}
          </div>
        ))}
      </div>
    </div>
  );
}
