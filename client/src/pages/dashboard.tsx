import { useQuery, useQueries } from "@tanstack/react-query";
import type { Budget, Entry, SavingsGoal, EntryHistory } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Star,
  Target,
  Clock,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export default function DashboardPage() {
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const entriesQueries = useQueries({
    queries: budgets.map((b) => ({
      queryKey: ["/api/budgets", b.id, "entries"],
      enabled: budgets.length > 0,
    })),
  });

  const historyQueries = useQueries({
    queries: budgets.map((b) => ({
      queryKey: ["/api/budgets", b.id, "history"],
      enabled: budgets.length > 0,
    })),
  });

  const entriesLoading = entriesQueries.some((q) => q.isLoading);
  const historyLoading = historyQueries.some((q) => q.isLoading);

  const allEntries: Entry[] = entriesQueries.flatMap(
    (q) => (q.data as Entry[]) || []
  );

  const budgetCurrencyMap = new Map(budgets.map((b) => [b.id, b.currency || "USD"]));

  const currencyTotals = new Map<string, { income: number; expenses: number }>();
  allEntries.forEach((e) => {
    const currency = budgetCurrencyMap.get(e.budgetId) || "USD";
    const existing = currencyTotals.get(currency) || { income: 0, expenses: 0 };
    if (e.type === "income") {
      existing.income += e.amount;
    } else {
      existing.expenses += e.amount;
    }
    currencyTotals.set(currency, existing);
  });

  const currencyKeys = Array.from(currencyTotals.keys()).sort();
  const primaryCurrency = currencyKeys[0] || "USD";
  const primaryTotals = currencyTotals.get(primaryCurrency) || { income: 0, expenses: 0 };

  const totalIncome = primaryTotals.income;
  const totalExpenses = primaryTotals.expenses;
  const netBalance = totalIncome - totalExpenses;
  const activeBudgets = budgets.filter((b) => b.isActive).length;

  const starredUnpaid = allEntries
    .filter(
      (e) => e.isStarred && !e.isPaidOrReceived && e.type === "expense"
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const budgetNameMap = new Map(budgets.map((b) => [b.id, b.name]));

  const allHistory: (EntryHistory & { budgetName: string })[] = historyQueries
    .flatMap((q, i) =>
      ((q.data as EntryHistory[]) || []).map((h) => ({
        ...h,
        budgetName: budgets[i]?.name || "Budget",
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 10);

  const isLoading = budgetsLoading || entriesLoading;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    );
  }

  function getEntryNameFromHistory(h: EntryHistory): string {
    try {
      const data = h.newData ? JSON.parse(h.newData) : h.previousData ? JSON.parse(h.previousData) : null;
      return data?.name || "Entry";
    } catch {
      return "Entry";
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
              data-testid="text-total-income-all"
            >
              {formatCurrency(totalIncome, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currencyKeys.length > 1 ? `${primaryCurrency} budgets` : "Across all budgets"}
            </p>
            {currencyKeys.filter(c => c !== primaryCurrency).map(c => {
              const t = currencyTotals.get(c)!;
              return (
                <p key={c} className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  +{formatCurrency(t.income, c)}
                </p>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums"
              data-testid="text-total-expenses-all"
            >
              {formatCurrency(totalExpenses, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currencyKeys.length > 1 ? `${primaryCurrency} budgets` : "Across all budgets"}
            </p>
            {currencyKeys.filter(c => c !== primaryCurrency).map(c => {
              const t = currencyTotals.get(c)!;
              return (
                <p key={c} className="text-xs text-red-600 dark:text-red-400 mt-0.5 tabular-nums">
                  +{formatCurrency(t.expenses, c)}
                </p>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${netBalance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}
              data-testid="text-net-balance-all"
            >
              {formatCurrency(netBalance, primaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currencyKeys.length > 1 ? `${primaryCurrency} budgets` : "Income minus expenses"}
            </p>
            {currencyKeys.filter(c => c !== primaryCurrency).map(c => {
              const t = currencyTotals.get(c)!;
              const bal = t.income - t.expenses;
              return (
                <p key={c} className={`text-xs mt-0.5 tabular-nums ${bal >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {formatCurrency(bal, c)}
                </p>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Budgets
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {activeBudgets}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {budgets.length} total budget{budgets.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="section-starred-unpaid">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            Starred Unpaid Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {starredUnpaid.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No starred unpaid expenses
            </p>
          ) : (
            <div className="space-y-1">
              {starredUnpaid.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-yellow-50/50 dark:bg-yellow-950/10"
                  data-testid={`starred-entry-${entry.id}`}
                >
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {entry.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {budgetNameMap.get(entry.budgetId) || "Budget"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(entry.date), "MMM d, yyyy")}
                    </p>
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

      <Card data-testid="section-goals-progress">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            Savings Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No savings goals yet
            </p>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const pct =
                  goal.targetAmount > 0
                    ? Math.min(
                        100,
                        (goal.currentAmount / goal.targetAmount) * 100
                      )
                    : 0;
                return (
                  <div key={goal.id} data-testid={`goal-progress-${goal.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {goal.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatCurrency(goal.currentAmount, "USD")} / {formatCurrency(goal.targetAmount, "USD")}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2"
                      style={
                        {
                          "--progress-foreground": goal.color,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-recent-activity">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : allHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-1">
              {allHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md"
                  data-testid={`activity-${h.id}`}
                >
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                  >
                    {h.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">
                      {getEntryNameFromHistory(h)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {h.budgetName}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(h.timestamp), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
