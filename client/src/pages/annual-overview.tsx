import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Budget, Entry } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { parseISO, getMonth, getYear } from "date-fns";
import { formatCurrency, formatNumber } from "@/lib/currency";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnnualOverviewPage() {
  const currentYear = getYear(new Date());
  const [year, setYear] = useState(currentYear.toString());
  const [scope, setScope] = useState<string>("all");

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });
  const selectableBudgets = budgets.filter((b) => !b.isFolder);

  const entriesQueries = useQueries({
    queries: selectableBudgets.map((budget) => ({
      queryKey: ["/api/budgets", budget.id, "entries"],
      enabled: selectableBudgets.length > 0,
    })),
  });

  const entriesLoading = entriesQueries.some((q) => q.isLoading);

  const entriesByBudget = new Map<number, Entry[]>();
  selectableBudgets.forEach((budget, index) => {
    entriesByBudget.set(budget.id, (entriesQueries[index]?.data as Entry[]) || []);
  });

  const selectedBudgetId = scope === "all" ? null : Number(scope);
  const currency = selectedBudgetId
    ? selectableBudgets.find((budget) => budget.id === selectedBudgetId)?.currency || "USD"
    : selectableBudgets[0]?.currency || "USD";
  const scopedEntries = selectedBudgetId
    ? entriesByBudget.get(selectedBudgetId) || []
    : Array.from(entriesByBudget.values()).flat();

  const targetYear = parseInt(year, 10);
  const yearEntries = scopedEntries.filter((entry) => getYear(parseISO(entry.date)) === targetYear);

  const monthlyBreakdown = MONTH_NAMES.map((name, index) => {
    const monthEntries = yearEntries.filter((entry) => getMonth(parseISO(entry.date)) === index);
    const income = monthEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = monthEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
    return { month: name, Income: income, Expenses: expenses, Savings: income - expenses };
  });

  const totalIncome = yearEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = yearEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const avgMonthlyIncome = totalIncome / 12;
  const avgMonthlyExpenses = totalExpenses / 12;

  if (budgetsLoading || entriesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading annual overview...</p>
      </div>
    );
  }

  if (selectableBudgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Create a budget first to see annual overview.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-base sm:text-lg font-semibold" data-testid="text-annual-title">Annual Overview</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[90px] sm:w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-[160px] sm:w-[200px]" data-testid="select-annual-budget">
              <SelectValue placeholder="Budget scope" />
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
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Income</p>
          <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" data-testid="text-annual-income">{formatCurrency(totalIncome, currency)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-base sm:text-xl font-bold text-red-700 dark:text-red-400 tabular-nums" data-testid="text-annual-expenses">{formatCurrency(totalExpenses, currency)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Net Savings</p>
          <p className="text-base sm:text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums" data-testid="text-annual-savings">{formatCurrency(totalSavings, currency)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wider">Savings Rate</p>
          <p className="text-base sm:text-xl font-bold text-purple-700 dark:text-purple-400 tabular-nums" data-testid="text-savings-rate">
            {formatNumber(savingsRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
      </div>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3 sm:mb-4">Monthly Comparison</h2>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3 sm:mb-4">Savings Trend</h2>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={monthlyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
              <Line type="monotone" dataKey="Savings" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3 sm:mb-4">Monthly Averages</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Avg Monthly Income</p>
            <p className="text-base sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(avgMonthlyIncome, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Monthly Expenses</p>
            <p className="text-base sm:text-lg font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(avgMonthlyExpenses, currency)}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3">Month-by-Month Breakdown</h2>
        <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Month</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Income</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Expenses</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Savings</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map((row) => (
                <tr key={row.month} className="border-b border-border/50">
                  <td className="py-2 px-2 font-medium text-xs sm:text-sm">{row.month}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(row.Income, currency)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-xs sm:text-sm text-red-600 dark:text-red-400">{formatCurrency(row.Expenses, currency)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums text-xs sm:text-sm font-medium ${row.Savings >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                    {formatCurrency(row.Savings, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
