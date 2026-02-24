import { useQuery, useQueries } from "@tanstack/react-query";
import type { Budget, Entry, Category } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval,
  subMonths, subYears, getDaysInMonth, differenceInDays,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Minus, DollarSign, Calendar, BarChart3, Target } from "lucide-react";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

function pctChange(current: number, previous: number): { value: number; label: string } {
  if (previous === 0 && current === 0) return { value: 0, label: "No change" };
  if (previous === 0) return { value: 100, label: "New spending" };
  const pct = ((current - previous) / previous) * 100;
  return { value: pct, label: `${Math.abs(pct).toFixed(0)}%` };
}

function ChangeIndicator({ current, previous, label }: { current: number; previous: number; label: string }) {
  const change = pctChange(current, previous);
  const isUp = change.value > 0;
  const isDown = change.value < 0;
  const isNeutral = change.value === 0;
  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      {isUp && <TrendingUp className="w-3.5 h-3.5 text-red-500" />}
      {isDown && <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
      {isNeutral && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={isUp ? "text-red-500 dark:text-red-400" : isDown ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"}>
        {label} {isUp ? "up" : isDown ? "down" : ""} {change.label} from {isNeutral ? "before" : "previous period"}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("all");
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });

  const selectedBudgetIds = useMemo(() => {
    if (selectedBudgetId === "all") return budgets.map(b => b.id);
    const id = parseInt(selectedBudgetId);
    return isNaN(id) ? [] : [id];
  }, [selectedBudgetId, budgets]);

  const entriesResults = useQueries({
    queries: selectedBudgetIds.map(id => ({
      queryKey: ["/api/budgets", id, "entries"],
      enabled: id > 0,
    })),
  });

  const categoriesResults = useQueries({
    queries: selectedBudgetIds.map(id => ({
      queryKey: ["/api/budgets", id, "categories"],
      enabled: id > 0,
    })),
  });

  const allEntries = useMemo(() => {
    return entriesResults.flatMap(q => (q.data as Entry[]) || []);
  }, [entriesResults]);

  const allCategories = useMemo(() => {
    return categoriesResults.flatMap(q => (q.data as Category[]) || []);
  }, [categoriesResults]);

  const currency = useMemo(() => {
    if (selectedBudgetId !== "all") {
      const b = budgets.find(b => b.id === parseInt(selectedBudgetId));
      return b?.currency || "USD";
    }
    return budgets[0]?.currency || "USD";
  }, [selectedBudgetId, budgets]);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const sameMonthLastYearStart = startOfMonth(subYears(now, 1));
  const sameMonthLastYearEnd = endOfMonth(subYears(now, 1));

  const filterByDateRange = (entries: Entry[], start: Date, end: Date) =>
    entries.filter(e => {
      const d = parseISO(e.date);
      return d >= start && d <= end;
    });

  const thisMonthEntries = useMemo(() => filterByDateRange(allEntries, thisMonthStart, thisMonthEnd), [allEntries]);
  const lastMonthEntries = useMemo(() => filterByDateRange(allEntries, lastMonthStart, lastMonthEnd), [allEntries]);
  const sameMonthLastYearEntries = useMemo(() => filterByDateRange(allEntries, sameMonthLastYearStart, sameMonthLastYearEnd), [allEntries]);

  const sumByType = (entries: Entry[], type: string) => entries.filter(e => e.type === type).reduce((s, e) => s + e.amount, 0);

  const thisMonthIncome = sumByType(thisMonthEntries, "income");
  const thisMonthExpenses = sumByType(thisMonthEntries, "expense");
  const lastMonthIncome = sumByType(lastMonthEntries, "income");
  const lastMonthExpenses = sumByType(lastMonthEntries, "expense");
  const lastYearIncome = sumByType(sameMonthLastYearEntries, "income");
  const lastYearExpenses = sumByType(sameMonthLastYearEntries, "expense");

  const comparisonMonthData = [
    { period: "Last Month", Income: lastMonthIncome, Expenses: lastMonthExpenses },
    { period: "This Month", Income: thisMonthIncome, Expenses: thisMonthExpenses },
  ];

  const comparisonYearData = [
    { period: format(sameMonthLastYearStart, "MMM yyyy"), Income: lastYearIncome, Expenses: lastYearExpenses },
    { period: format(thisMonthStart, "MMM yyyy"), Income: thisMonthIncome, Expenses: thisMonthExpenses },
  ];

  const hasLastYearData = sameMonthLastYearEntries.length > 0;

  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const daysSoFar = Math.max(1, differenceInDays(now, thisMonthStart) + 1);
  const dailyAvgExpense = thisMonthExpenses / daysSoFar;
  const dailyAvgIncome = thisMonthIncome / daysSoFar;
  const predictedExpenses = dailyAvgExpense * daysInMonth;
  const predictedIncome = dailyAvgIncome * daysInMonth;

  const categoryPredictions = useMemo(() => {
    const expenseEntries = thisMonthEntries.filter(e => e.type === "expense");
    return allCategories
      .filter(cat => cat.budgetLimit && cat.budgetLimit > 0)
      .map(cat => {
        const spent = expenseEntries.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0);
        const predicted = (spent / daysSoFar) * daysInMonth;
        const limit = cat.budgetLimit!;
        const status = predicted <= limit * 0.9 ? "under" : predicted <= limit * 1.1 ? "on-track" : "over";
        return { name: cat.name, spent, predicted, limit, status, color: cat.color };
      })
      .filter(c => c.spent > 0 || c.limit > 0);
  }, [thisMonthEntries, allCategories, daysSoFar, daysInMonth]);

  const expenseEntries = allEntries.filter(e => e.type === "expense");

  const categorySpending = useMemo(() => {
    const spending = allCategories.map(cat => {
      const total = expenseEntries
        .filter(e => e.categoryId === cat.id)
        .reduce((sum, e) => sum + e.amount, 0);
      return { name: cat.name, value: total, color: cat.color };
    }).filter(c => c.value > 0);
    const uncategorized = expenseEntries
      .filter(e => !e.categoryId)
      .reduce((sum, e) => sum + e.amount, 0);
    if (uncategorized > 0) {
      spending.push({ name: "Uncategorized", value: uncategorized, color: "#94a3b8" });
    }
    return spending;
  }, [expenseEntries, allCategories]);

  const topExpenses = useMemo(() => {
    return [...expenseEntries]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenseEntries]);

  const last6Months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  const monthlyTrend = useMemo(() => {
    return last6Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthEntries = filterByDateRange(allEntries, monthStart, monthEnd);
      const income = sumByType(monthEntries, "income");
      const expenses = sumByType(monthEntries, "expense");
      return { month: format(month, "MMM"), Income: income, Expenses: expenses };
    });
  }, [allEntries]);

  if (budgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Create a budget first to see reports.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-base sm:text-lg font-semibold" data-testid="text-reports-title">Spending Reports</h1>
        <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
          <SelectTrigger className="w-[160px] sm:w-[180px]" data-testid="select-report-budget">
            <SelectValue placeholder="Select budget" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Budgets</SelectItem>
            {budgets.map(b => (
              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">This Month Income</span>
          </div>
          <p className="text-lg font-semibold" data-testid="stat-this-month-income">{formatCurrency(thisMonthIncome, currency)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">This Month Expenses</span>
          </div>
          <p className="text-lg font-semibold" data-testid="stat-this-month-expenses">{formatCurrency(thisMonthExpenses, currency)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Daily Avg Spending</span>
          </div>
          <p className="text-lg font-semibold" data-testid="stat-daily-avg">{formatCurrency(dailyAvgExpense, currency)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Net This Month</span>
          </div>
          <p className={`text-lg font-semibold ${thisMonthIncome - thisMonthExpenses >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="stat-net">
            {formatCurrency(thisMonthIncome - thisMonthExpenses, currency)}
          </p>
        </Card>
      </div>

      <div data-testid="section-comparison" className="space-y-4">
        <h2 className="text-sm font-semibold">Budget Comparison</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2">This Month vs Last Month</h3>
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonMonthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              <ChangeIndicator current={thisMonthExpenses} previous={lastMonthExpenses} label="Expenses" />
              <ChangeIndicator current={thisMonthIncome} previous={lastMonthIncome} label="Income" />
            </div>
          </Card>

          <Card className="p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2">This Month vs Same Month Last Year</h3>
            {hasLastYearData ? (
              <>
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonYearData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                      <Legend />
                      <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  <ChangeIndicator current={thisMonthExpenses} previous={lastYearExpenses} label="Expenses" />
                  <ChangeIndicator current={thisMonthIncome} previous={lastYearIncome} label="Income" />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data available for comparison</p>
            )}
          </Card>
        </div>
      </div>

      <div data-testid="section-predictions" className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4" />
          Spending Predictions
        </h2>
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Predicted Month-End Expenses</p>
              <p className="text-lg font-semibold" data-testid="predicted-expenses">{formatCurrency(predictedExpenses, currency)}</p>
              <p className="text-xs text-muted-foreground">Based on {daysSoFar} of {daysInMonth} days</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Predicted Month-End Income</p>
              <p className="text-lg font-semibold" data-testid="predicted-income">{formatCurrency(predictedIncome, currency)}</p>
              <p className="text-xs text-muted-foreground">Linear extrapolation from current trend</p>
            </div>
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between gap-2 text-xs mb-1 flex-wrap">
              <span className="text-muted-foreground">Month progress</span>
              <span className="font-medium">{dayOfMonth} / {daysInMonth} days</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }}
              />
            </div>
          </div>

          {categoryPredictions.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Category Budget Projections</p>
              {categoryPredictions.map((cat, i) => {
                const predictedPct = cat.limit > 0 ? Math.min(150, (cat.predicted / cat.limit) * 100) : 0;
                const currentPct = cat.limit > 0 ? Math.min(100, (cat.spent / cat.limit) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1 flex-wrap">
                      <span className="font-medium">{cat.name}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">
                          {formatCurrency(cat.spent, currency)} spent / {formatCurrency(cat.limit, currency)} budget
                        </span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          cat.status === "under" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          cat.status === "on-track" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`} data-testid={`prediction-status-${i}`}>
                          {cat.status === "under" ? "Under budget" : cat.status === "on-track" ? "On track" : "Over budget"}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-indigo-400/50 transition-all absolute top-0 left-0"
                        style={{ width: `${Math.min(100, predictedPct)}%` }}
                      />
                      <div
                        className={`h-full rounded-full transition-all absolute top-0 left-0 ${
                          cat.status === "over" ? "bg-red-500" : cat.status === "on-track" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${currentPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Projected: {formatCurrency(cat.predicted, currency)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-3 sm:p-4" data-testid="section-category-breakdown">
          <h2 className="text-sm font-semibold mb-3 sm:mb-4">Category Breakdown</h2>
          {categorySpending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expense data yet</p>
          ) : (
            <div className="flex items-center justify-center overflow-x-auto">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categorySpending.map((entry, index) => (
                      <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-3 sm:p-4" data-testid="section-top-expenses">
          <h2 className="text-sm font-semibold mb-3 sm:mb-4">Top 5 Expenses</h2>
          {topExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses yet</p>
          ) : (
            <div className="space-y-2">
              {topExpenses.map((entry, i) => {
                const cat = allCategories.find(c => c.id === entry.categoryId);
                return (
                  <div key={entry.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 flex-wrap" data-testid={`top-expense-${i}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat?.name || "Uncategorized"} &middot; {format(parseISO(entry.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3 sm:mb-4">Income vs Expenses Trend (6 months)</h2>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
