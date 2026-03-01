import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import type { Budget, Entry, EntryHistory, SavingsGoal } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  DollarSign,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { fetchBudgetAggregate, type BudgetAggregateResponse } from "@/lib/budget-aggregate";

type DashboardCardId =
  | "income"
  | "expenses"
  | "balance"
  | "activeBudgets"
  | "starred"
  | "goals"
  | "activity";

const DEFAULT_CARD_ORDER: DashboardCardId[] = [
  "income",
  "expenses",
  "balance",
  "activeBudgets",
  "starred",
  "goals",
  "activity",
];

const CARD_TITLES: Record<DashboardCardId, string> = {
  income: "Total Income",
  expenses: "Total Expenses",
  balance: "Net Balance",
  activeBudgets: "Active Budgets",
  starred: "Starred Unpaid Expenses",
  goals: "Savings Goals",
  activity: "Recent Activity",
};

export default function DashboardPage() {
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });
  const selectableBudgets = budgets.filter((b) => !b.isFolder);
  const selectableBudgetIds = selectableBudgets.map((budget) => budget.id);

  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const { data: aggregate = { entries: [], categories: [], history: [] }, isLoading: aggregateLoading } = useQuery<BudgetAggregateResponse>({
    queryKey: ["/api/budgets/aggregate", "dashboard", selectableBudgetIds.join(",")],
    enabled: selectableBudgetIds.length > 0,
    queryFn: () =>
      fetchBudgetAggregate(selectableBudgetIds, {
        entries: true,
        history: true,
      }),
  });

  const isLoading = budgetsLoading || aggregateLoading;
  const historyLoading = aggregateLoading;

  const allEntries: Entry[] = aggregate.entries;
  const allHistory: (EntryHistory & { budgetName: string })[] = aggregate.history
    .map((history) => ({
      ...history,
      budgetName: selectableBudgets.find((budget) => budget.id === history.budgetId)?.name || "Budget",
    }))
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

  function getEntryNameFromHistory(history: EntryHistory): string {
    try {
      const data = history.newData ? JSON.parse(history.newData) : history.previousData ? JSON.parse(history.previousData) : null;
      return data?.name || "Entry";
    } catch {
      return "Entry";
    }
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
                        style={{ "--progress-foreground": goal.color } as CSSProperties}
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

    return null;
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-4 space-y-4">
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
    <div className="h-full overflow-auto">
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
    </div>
  );
}
