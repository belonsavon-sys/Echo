import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowUpRight,
  Clock3,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Budget, Entry, EntryHistory, SavingsGoal } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { fetchBudgetAggregate, type BudgetAggregateResponse } from "@/lib/budget-aggregate";

type CurrencyRollup = {
  currency: string;
  income: number;
  expenses: number;
  net: number;
};

type BudgetRollup = {
  id: number;
  name: string;
  currency: string;
  income: number;
  expenses: number;
  net: number;
  unpaidStarredCount: number;
};

type DashboardMetricTileProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
};

function DashboardMetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: DashboardMetricTileProps) {
  const toneClassName =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClassName}`}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-56 rounded-[28px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <Skeleton className="h-72 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-lg rounded-[28px] border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-5 w-5 text-primary" />
            Dashboard briefing
          </CardTitle>
          <CardDescription>
            Create a budget to see cash position, priorities, and recent activity in one place.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function getEntryNameFromHistory(history: EntryHistory): string {
  try {
    const data = history.newData
      ? JSON.parse(history.newData)
      : history.previousData
        ? JSON.parse(history.previousData)
        : null;
    return data?.name || "Entry";
  } catch {
    return "Entry";
  }
}

export function DashboardOverview() {
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });
  const selectableBudgets = budgets.filter((budget) => !budget.isFolder);
  const selectableBudgetIds = selectableBudgets.map((budget) => budget.id);

  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const {
    data: aggregate = { entries: [], categories: [], history: [] },
    isLoading: aggregateLoading,
  } = useQuery<BudgetAggregateResponse>({
    queryKey: ["/api/budgets/aggregate", "dashboard", selectableBudgetIds.join(",")],
    enabled: selectableBudgetIds.length > 0,
    queryFn: () =>
      fetchBudgetAggregate(selectableBudgetIds, {
        entries: true,
        history: true,
      }),
  });

  const isLoading = budgetsLoading || (selectableBudgetIds.length > 0 && aggregateLoading);
  if (isLoading) return <LoadingState />;
  if (selectableBudgets.length === 0) return <EmptyState />;

  const budgetNameById = new Map(selectableBudgets.map((budget) => [budget.id, budget.name]));
  const budgetCurrencyById = new Map(
    selectableBudgets.map((budget) => [budget.id, budget.currency || "USD"]),
  );

  const currencyTotals = new Map<string, CurrencyRollup>();
  const budgetTotals = new Map<number, BudgetRollup>();

  for (const budget of selectableBudgets) {
    budgetTotals.set(budget.id, {
      id: budget.id,
      name: budget.name,
      currency: budget.currency || "USD",
      income: 0,
      expenses: 0,
      net: 0,
      unpaidStarredCount: 0,
    });
  }

  for (const entry of aggregate.entries) {
    const currency = budgetCurrencyById.get(entry.budgetId) || "USD";
    const currencySummary = currencyTotals.get(currency) || {
      currency,
      income: 0,
      expenses: 0,
      net: 0,
    };
    const budgetSummary = budgetTotals.get(entry.budgetId);

    if (entry.type === "income") {
      currencySummary.income += entry.amount;
      if (budgetSummary) budgetSummary.income += entry.amount;
    } else {
      currencySummary.expenses += entry.amount;
      if (budgetSummary) budgetSummary.expenses += entry.amount;
      if (budgetSummary && entry.isStarred && !entry.isPaidOrReceived) {
        budgetSummary.unpaidStarredCount += 1;
      }
    }

    currencySummary.net = currencySummary.income - currencySummary.expenses;
    currencyTotals.set(currency, currencySummary);
  }

  const currencySummaries = Array.from(currencyTotals.values()).sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
  const primaryCurrencySummary = currencySummaries[0] || {
    currency: "USD",
    income: 0,
    expenses: 0,
    net: 0,
  };

  const activeBudgets = selectableBudgets.filter((budget) => budget.isActive).length;
  const starredUnpaidEntries = aggregate.entries
    .filter((entry) => entry.type === "expense" && entry.isStarred && !entry.isPaidOrReceived)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const starredUnpaidTotal = starredUnpaidEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const topBudgetRollups = Array.from(budgetTotals.values())
    .map((budget) => ({
      ...budget,
      net: budget.income - budget.expenses,
    }))
    .sort((left, right) => {
      if (right.unpaidStarredCount !== left.unpaidStarredCount) {
        return right.unpaidStarredCount - left.unpaidStarredCount;
      }
      return Math.abs(right.expenses) - Math.abs(left.expenses);
    })
    .slice(0, 5);

  const recentActivity = aggregate.history
    .map((history) => ({
      ...history,
      budgetName: budgetNameById.get(history.budgetId) || "Budget",
    }))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8);

  const totalGoalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalGoalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const goalFundingPercent =
    totalGoalTarget > 0 ? Math.min(100, (totalGoalCurrent / totalGoalTarget) * 100) : 0;
  const closestGoals = [...goals]
    .sort((left, right) => {
      const leftRemaining = left.targetAmount - left.currentAmount;
      const rightRemaining = right.targetAmount - right.currentAmount;
      return leftRemaining - rightRemaining;
    })
    .slice(0, 4);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] shadow-md dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92))]">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  Dashboard briefing
                </Badge>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="text-dashboard-title">
                  Cash position without the clutter.
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                  This view prioritizes where money stands, what needs attention, and what changed recently.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {currencySummaries.map((summary) => (
                    <Badge key={summary.currency} variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {summary.currency} net {formatCurrency(summary.net, summary.currency)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-background/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                  Primary currency snapshot
                </div>
                <div className={`mt-3 text-4xl font-semibold tabular-nums ${primaryCurrencySummary.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {formatCurrency(primaryCurrencySummary.net, primaryCurrencySummary.currency)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    {formatCurrency(primaryCurrencySummary.income, primaryCurrencySummary.currency)} in
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                    {formatCurrency(primaryCurrencySummary.expenses, primaryCurrencySummary.currency)} out
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <DashboardMetricTile
                label="Active budgets"
                value={String(activeBudgets)}
                detail={`${selectableBudgets.length} total budgets in scope`}
              />
              <DashboardMetricTile
                label="Outstanding starred"
                value={formatCurrency(starredUnpaidTotal, primaryCurrencySummary.currency)}
                detail={starredUnpaidEntries.length === 0 ? "No starred unpaid expenses" : `${starredUnpaidEntries.length} expense${starredUnpaidEntries.length === 1 ? "" : "s"} still open`}
                tone={starredUnpaidEntries.length === 0 ? "positive" : "warning"}
              />
              <DashboardMetricTile
                label="Goals funded"
                value={`${Math.round(goalFundingPercent)}%`}
                detail={goals.length === 0 ? "No savings goals yet" : `${goals.length} savings goal${goals.length === 1 ? "" : "s"} tracked`}
                tone={goalFundingPercent >= 60 ? "positive" : "neutral"}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-[28px] border-border/70">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Star className="h-5 w-5 text-amber-500" />
                Needs attention
              </CardTitle>
              <CardDescription>
                The most obvious follow-ups across your budgets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {starredUnpaidEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No starred unpaid expenses right now.
                </div>
              ) : (
                starredUnpaidEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20"
                  >
                    <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{entry.name}</p>
                        <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                          {budgetNameById.get(entry.budgetId) || "Budget"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(parseISO(entry.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      -{formatCurrency(entry.amount, budgetCurrencyById.get(entry.budgetId) || "USD")}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Budget pulse
              </CardTitle>
              <CardDescription>
                The budgets with the most money movement or unresolved items.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topBudgetRollups.map((budget) => (
                <div key={budget.id} className="rounded-2xl border border-border/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{budget.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {budget.unpaidStarredCount > 0
                          ? `${budget.unpaidStarredCount} starred unpaid item${budget.unpaidStarredCount === 1 ? "" : "s"}`
                          : "No starred unpaid items"}
                      </p>
                    </div>
                    <div className={`text-right text-sm font-semibold tabular-nums ${budget.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                      {formatCurrency(budget.net, budget.currency)}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
                      Income <span className="ml-1 font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(budget.income, budget.currency)}</span>
                    </div>
                    <div className="rounded-xl bg-rose-50/70 px-3 py-2 text-right dark:bg-rose-950/20">
                      Expenses <span className="ml-1 font-medium tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(budget.expenses, budget.currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <Card className="rounded-[28px] border-border/70">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Target className="h-5 w-5 text-primary" />
                Savings goals
              </CardTitle>
              <CardDescription>
                Progress toward the goals closest to completion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-16 rounded-2xl" />
                  ))}
                </div>
              ) : closestGoals.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No savings goals yet.
                </div>
              ) : (
                closestGoals.map((goal) => {
                  const progressPercent =
                    goal.targetAmount > 0
                      ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                      : 0;

                  return (
                    <div key={goal.id} className="rounded-2xl border border-border/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{goal.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(goal.currentAmount, "USD")} of {formatCurrency(goal.targetAmount, "USD")}
                          </p>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                          {Math.round(progressPercent)}%
                        </div>
                      </div>
                      <Progress
                        value={progressPercent}
                        className="mt-3 h-2"
                        style={{ "--progress-foreground": goal.color } as CSSProperties}
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/70">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="h-5 w-5 text-primary" />
                Recent activity
              </CardTitle>
              <CardDescription>
                Latest changes across budgets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No recent activity yet.
                </div>
              ) : (
                recentActivity.map((history) => (
                  <div key={history.id} className="flex items-start gap-3 rounded-2xl border border-border/70 px-4 py-3">
                    <Badge variant="secondary" className="mt-0.5 shrink-0 px-2 py-0 text-[10px] capitalize">
                      {history.action}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{getEntryNameFromHistory(history)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {history.budgetName}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] text-muted-foreground">
                      {format(new Date(history.timestamp), "MMM d, h:mm a")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
