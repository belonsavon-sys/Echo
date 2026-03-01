import { useQuery } from "@tanstack/react-query";
import type { Budget, Entry, Category } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  subMonths,
  subYears,
  getDaysInMonth,
  differenceInDays,
  isSameMonth,
  isSameYear,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { TrendingUp, TrendingDown, Minus, DollarSign, Calendar, BarChart3, Target } from "lucide-react";
import { fetchBudgetAggregate, type BudgetAggregateResponse } from "@/lib/budget-aggregate";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function pctChange(current: number, previous: number): { value: number; label: string } {
  if (previous === 0 && current === 0) return { value: 0, label: "No change" };
  if (previous === 0) return { value: 100, label: "New spending" };
  const pct = ((current - previous) / previous) * 100;
  return { value: pct, label: `${formatNumber(Math.abs(pct), { maximumFractionDigits: 0 })}%` };
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
      <span
        className={
          isUp
            ? "text-red-500 dark:text-red-400"
            : isDown
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-muted-foreground"
        }
      >
        {label} {isUp ? "up" : isDown ? "down" : ""} {change.label} from {isNeutral ? "before" : "previous period"}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const selectableBudgets = budgets.filter((budget) => !budget.isFolder);

  const selectedBudgetIds = useMemo(() => {
    if (selectedBudgetId === "all") return selectableBudgets.map((budget) => budget.id);
    const parsed = Number(selectedBudgetId);
    if (!Number.isInteger(parsed)) return [];
    return selectableBudgets.some((budget) => budget.id === parsed) ? [parsed] : [];
  }, [selectedBudgetId, selectableBudgets]);

  const { data: aggregate = { entries: [], categories: [], history: [] } } = useQuery<BudgetAggregateResponse>({
    queryKey: ["/api/budgets/aggregate", "reports", selectedBudgetIds.join(",")],
    enabled: selectedBudgetIds.length > 0,
    queryFn: () =>
      fetchBudgetAggregate(selectedBudgetIds, {
        entries: true,
        categories: true,
      }),
  });

  const allEntries = useMemo(() => aggregate.entries, [aggregate.entries]);
  const allCategories = useMemo(() => aggregate.categories, [aggregate.categories]);

  const budgetNameById = useMemo(() => {
    const map = new Map<number, string>();
    selectableBudgets.forEach((budget) => map.set(budget.id, budget.name));
    return map;
  }, [selectableBudgets]);

  const currency = useMemo(() => {
    if (selectedBudgetId !== "all") {
      const selected = selectableBudgets.find((budget) => budget.id === Number(selectedBudgetId));
      return selected?.currency || "USD";
    }
    return selectableBudgets[0]?.currency || "USD";
  }, [selectedBudgetId, selectableBudgets]);

  const selectedPeriodDate = useMemo(
    () => new Date(Number(selectedYear), Number(selectedMonth) - 1, 1),
    [selectedMonth, selectedYear],
  );
  const selectedPeriodStart = startOfMonth(selectedPeriodDate);
  const selectedPeriodEnd = endOfMonth(selectedPeriodDate);
  const previousPeriodStart = startOfMonth(subMonths(selectedPeriodDate, 1));
  const previousPeriodEnd = endOfMonth(subMonths(selectedPeriodDate, 1));
  const samePeriodLastYearStart = startOfMonth(subYears(selectedPeriodDate, 1));
  const samePeriodLastYearEnd = endOfMonth(subYears(selectedPeriodDate, 1));
  const isCurrentPeriod = isSameYear(selectedPeriodDate, now) && isSameMonth(selectedPeriodDate, now);

  const filterByDateRange = (entries: Entry[], start: Date, end: Date) =>
    entries.filter((entry) => {
      const dateValue = parseISO(entry.date);
      return dateValue >= start && dateValue <= end;
    });

  const selectedPeriodEntries = useMemo(
    () => filterByDateRange(allEntries, selectedPeriodStart, selectedPeriodEnd),
    [allEntries, selectedPeriodStart, selectedPeriodEnd],
  );
  const previousPeriodEntries = useMemo(
    () => filterByDateRange(allEntries, previousPeriodStart, previousPeriodEnd),
    [allEntries, previousPeriodStart, previousPeriodEnd],
  );
  const samePeriodLastYearEntries = useMemo(
    () => filterByDateRange(allEntries, samePeriodLastYearStart, samePeriodLastYearEnd),
    [allEntries, samePeriodLastYearStart, samePeriodLastYearEnd],
  );

  const sumByType = (entries: Entry[], type: string) =>
    entries.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0);

  const selectedIncome = sumByType(selectedPeriodEntries, "income");
  const selectedExpenses = sumByType(selectedPeriodEntries, "expense");
  const previousIncome = sumByType(previousPeriodEntries, "income");
  const previousExpenses = sumByType(previousPeriodEntries, "expense");
  const lastYearIncome = sumByType(samePeriodLastYearEntries, "income");
  const lastYearExpenses = sumByType(samePeriodLastYearEntries, "expense");

  const comparisonPeriodData = [
    { period: format(previousPeriodStart, "MMM yyyy"), Income: previousIncome, Expenses: previousExpenses },
    { period: format(selectedPeriodStart, "MMM yyyy"), Income: selectedIncome, Expenses: selectedExpenses },
  ];

  const comparisonYearData = [
    { period: format(samePeriodLastYearStart, "MMM yyyy"), Income: lastYearIncome, Expenses: lastYearExpenses },
    { period: format(selectedPeriodStart, "MMM yyyy"), Income: selectedIncome, Expenses: selectedExpenses },
  ];

  const hasLastYearData = samePeriodLastYearEntries.length > 0;

  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(selectedPeriodDate);
  const daysSoFar = isCurrentPeriod ? Math.max(1, differenceInDays(now, selectedPeriodStart) + 1) : daysInMonth;
  const dailyAvgExpense = daysSoFar > 0 ? selectedExpenses / daysSoFar : 0;
  const dailyAvgIncome = daysSoFar > 0 ? selectedIncome / daysSoFar : 0;
  const predictedExpenses = dailyAvgExpense * daysInMonth;
  const predictedIncome = dailyAvgIncome * daysInMonth;

  const predictionBudgetIds = useMemo(() => {
    if (selectedBudgetId !== "all") {
      const id = Number(selectedBudgetId);
      return new Set<number>(Number.isInteger(id) ? [id] : []);
    }

    const activeInSelectedMonth = selectableBudgets.filter((budget) => {
      const start = parseISO(budget.startDate);
      const end = budget.endDate ? parseISO(budget.endDate) : null;
      return start <= selectedPeriodEnd && (!end || end >= selectedPeriodStart);
    });

    return new Set<number>(activeInSelectedMonth.map((budget) => budget.id));
  }, [selectedBudgetId, selectableBudgets, selectedPeriodEnd, selectedPeriodStart]);

  const categoryPredictions = useMemo(() => {
    const scopedExpenseEntries = selectedPeriodEntries.filter(
      (entry) => entry.type === "expense" && predictionBudgetIds.has(entry.budgetId),
    );

    return allCategories
      .filter(
        (category) => predictionBudgetIds.has(category.budgetId) && !!category.budgetLimit && category.budgetLimit > 0,
      )
      .map((category) => {
        const spent = scopedExpenseEntries
          .filter((entry) => entry.categoryId === category.id)
          .reduce((sum, entry) => sum + entry.amount, 0);
        if (spent <= 0) return null;

        const predicted = (spent / daysSoFar) * daysInMonth;
        const limit = category.budgetLimit!;
        const status = predicted <= limit * 0.9 ? "under" : predicted <= limit * 1.1 ? "on-track" : "over";
        const label =
          selectedBudgetId === "all"
            ? `${category.name} (${budgetNameById.get(category.budgetId) || "Budget"})`
            : category.name;

        return {
          name: label,
          spent,
          predicted,
          limit,
          status,
          color: category.color,
        };
      })
      .filter((category): category is NonNullable<typeof category> => category !== null)
      .sort((left, right) => right.predicted - left.predicted);
  }, [
    selectedPeriodEntries,
    allCategories,
    predictionBudgetIds,
    daysSoFar,
    daysInMonth,
    selectedBudgetId,
    budgetNameById,
  ]);

  const expenseEntries = selectedPeriodEntries.filter((entry) => entry.type === "expense");

  const categorySpending = useMemo(() => {
    const categoryById = new Map<number, Category>();
    allCategories.forEach((category) => {
      categoryById.set(category.id, category);
    });

    const aggregated = new Map<string, { name: string; value: number; color: string }>();
    for (const entry of expenseEntries) {
      if (!entry.categoryId) continue;
      const category = categoryById.get(entry.categoryId);
      if (!category) continue;

      const key = selectedBudgetId === "all" ? category.name.trim().toLowerCase() : String(category.id);
      const existing = aggregated.get(key);
      if (existing) {
        existing.value += entry.amount;
      } else {
        aggregated.set(key, {
          name: category.name,
          value: entry.amount,
          color: category.color || COLORS[aggregated.size % COLORS.length],
        });
      }
    }

    const spending = Array.from(aggregated.values())
      .filter((category) => category.value > 0)
      .sort((left, right) => right.value - left.value);

    const uncategorized = expenseEntries
      .filter((entry) => !entry.categoryId)
      .reduce((sum, entry) => sum + entry.amount, 0);

    if (uncategorized > 0) {
      spending.push({ name: "Uncategorized", value: uncategorized, color: "#94a3b8" });
    }

    return spending;
  }, [expenseEntries, allCategories, selectedBudgetId]);

  const topExpenseSpenders = useMemo(() => {
    const categoryById = new Map<number, string>();
    allCategories.forEach((category) => {
      categoryById.set(category.id, category.name);
    });

    const byName = new Map<
      string,
      {
        name: string;
        total: number;
        count: number;
        latestDate: string;
        byCategory: Map<string, number>;
      }
    >();

    for (const entry of expenseEntries) {
      const key = entry.name.trim().toLowerCase();
      if (!key) continue;

      const existing = byName.get(key);
      if (!existing) {
        const byCategory = new Map<string, number>();
        const categoryName = entry.categoryId ? categoryById.get(entry.categoryId) || "Uncategorized" : "Uncategorized";
        byCategory.set(categoryName, entry.amount);
        byName.set(key, {
          name: entry.name.trim(),
          total: entry.amount,
          count: 1,
          latestDate: entry.date,
          byCategory,
        });
      } else {
        existing.total += entry.amount;
        existing.count += 1;
        if (entry.date > existing.latestDate) {
          existing.latestDate = entry.date;
        }
        const categoryName = entry.categoryId ? categoryById.get(entry.categoryId) || "Uncategorized" : "Uncategorized";
        existing.byCategory.set(categoryName, (existing.byCategory.get(categoryName) || 0) + entry.amount);
      }
    }

    return Array.from(byName.values())
      .map((item) => {
        let primaryCategory = "Uncategorized";
        let primaryCategoryAmount = 0;
        for (const [categoryName, amount] of item.byCategory.entries()) {
          if (amount > primaryCategoryAmount) {
            primaryCategory = categoryName;
            primaryCategoryAmount = amount;
          }
        }

        return {
          name: item.name,
          total: item.total,
          count: item.count,
          latestDate: item.latestDate,
          primaryCategory,
        };
      })
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
  }, [expenseEntries, allCategories]);

  const last6Months = eachMonthOfInterval({
    start: subMonths(selectedPeriodDate, 5),
    end: selectedPeriodDate,
  });

  const monthlyTrend = useMemo(() => {
    return last6Months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthEntries = filterByDateRange(allEntries, monthStart, monthEnd);
      const income = sumByType(monthEntries, "income");
      const expenses = sumByType(monthEntries, "expense");
      return { month: format(month, "MMM"), Income: income, Expenses: expenses };
    });
  }, [allEntries, last6Months]);

  if (selectableBudgets.length === 0) {
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
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
            <SelectTrigger className="w-[160px] sm:w-[180px]" data-testid="select-report-budget">
              <SelectValue placeholder="Select budget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Budgets</SelectItem>
              {selectableBudgets.map((budget) => (
                <SelectItem key={budget.id} value={budget.id.toString()}>
                  {budget.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px]" data-testid="select-report-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[95px]" data-testid="select-report-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Selected Income</span>
          </div>
          <p className="text-lg font-semibold" data-testid="stat-selected-income">{formatCurrency(selectedIncome, currency)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Selected Expenses</span>
          </div>
          <p className="text-lg font-semibold" data-testid="stat-selected-expenses">{formatCurrency(selectedExpenses, currency)}</p>
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
            <span className="text-xs text-muted-foreground">Net Selected</span>
          </div>
          <p
            className={`text-lg font-semibold ${selectedIncome - selectedExpenses >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            data-testid="stat-net"
          >
            {formatCurrency(selectedIncome - selectedExpenses, currency)}
          </p>
        </Card>
      </div>

      <div data-testid="section-comparison" className="space-y-4">
        <h2 className="text-sm font-semibold">Budget Comparison</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2">Selected Period vs Previous Period</h3>
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonPeriodData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              <ChangeIndicator current={selectedExpenses} previous={previousExpenses} label="Expenses" />
              <ChangeIndicator current={selectedIncome} previous={previousIncome} label="Income" />
            </div>
          </Card>

          <Card className="p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2">Selected Period vs Same Period Last Year</h3>
            {hasLastYearData ? (
              <>
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonYearData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, currency)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                      <Legend />
                      <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  <ChangeIndicator current={selectedExpenses} previous={lastYearExpenses} label="Expenses" />
                  <ChangeIndicator current={selectedIncome} previous={lastYearIncome} label="Income" />
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

        {!isCurrentPeriod ? (
          <Card className="p-3 sm:p-4">
            <p className="text-sm text-muted-foreground" data-testid="text-predictions-disabled">
              Prediction disabled for historical/future period. Select the current month to view live predictions.
            </p>
          </Card>
        ) : (
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
                {categoryPredictions.map((category, index) => {
                  const predictedPct = category.limit > 0 ? Math.min(150, (category.predicted / category.limit) * 100) : 0;
                  const currentPct = category.limit > 0 ? Math.min(100, (category.spent / category.limit) * 100) : 0;

                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between gap-2 text-xs mb-1 flex-wrap">
                        <span className="font-medium">{category.name}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">
                            {formatCurrency(category.spent, currency)} spent / {formatCurrency(category.limit, currency)} budget
                          </span>
                          <span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              category.status === "under"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : category.status === "on-track"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                            data-testid={`prediction-status-${index}`}
                          >
                            {category.status === "under"
                              ? "Under budget"
                              : category.status === "on-track"
                                ? "On track"
                                : "Over budget"}
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
                            category.status === "over"
                              ? "bg-red-500"
                              : category.status === "on-track"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${currentPct}%` }}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">Projected: {formatCurrency(category.predicted, currency)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-3 sm:p-4" data-testid="section-category-breakdown">
          <h2 className="text-sm font-semibold mb-3 sm:mb-4">Category Breakdown ({format(selectedPeriodStart, "MMM yyyy")})</h2>
          {categorySpending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expense data for this period</p>
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
                    label={({ name, percent }) => `${name} ${formatNumber((percent || 0) * 100, { maximumFractionDigits: 0 })}%`}
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
          <h2 className="text-sm font-semibold mb-3 sm:mb-4">Top 5 Biggest Spenders ({format(selectedPeriodStart, "MMM yyyy")})</h2>
          {topExpenseSpenders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses in this period</p>
          ) : (
            <div className="space-y-2">
              {topExpenseSpenders.map((spender, index) => (
                <div
                  key={`${spender.name}-${index}`}
                  className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 flex-wrap"
                  data-testid={`top-expense-${index}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{spender.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {spender.primaryCategory} &middot; {spender.count} transaction{spender.count === 1 ? "" : "s"} &middot; last {format(parseISO(spender.latestDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">
                    {formatCurrency(spender.total, currency)}
                  </span>
                </div>
              ))}
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
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, currency)} />
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
