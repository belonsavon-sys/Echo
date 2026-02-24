import { useQuery } from "@tanstack/react-query";
import type { Budget, Entry } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { parseISO, getMonth, getYear } from "date-fns";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnnualOverviewPage() {
  const currentYear = getYear(new Date());
  const [year, setYear] = useState(currentYear.toString());
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });

  const budgetId = selectedBudgetId ? parseInt(selectedBudgetId) : budgets[0]?.id;

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["/api/budgets", budgetId, "entries"],
    enabled: !!budgetId,
  });

  const yearEntries = entries.filter(e => getYear(parseISO(e.date)) === parseInt(year));

  const monthlyBreakdown = MONTH_NAMES.map((name, index) => {
    const monthEntries = yearEntries.filter(e => getMonth(parseISO(e.date)) === index);
    const income = monthEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expenses = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { month: name, Income: income, Expenses: expenses, Savings: income - expenses };
  });

  const totalIncome = yearEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = yearEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalSavings / totalIncome) * 100).toFixed(1) : "0.0";

  const avgMonthlyIncome = totalIncome / 12;
  const avgMonthlyExpenses = totalExpenses / 12;

  if (!budgetId) {
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
              {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBudgetId || budgetId?.toString()} onValueChange={setSelectedBudgetId}>
            <SelectTrigger className="w-[140px] sm:w-[160px]" data-testid="select-annual-budget">
              <SelectValue placeholder="Select budget" />
            </SelectTrigger>
            <SelectContent>
              {budgets.map(b => (
                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Income</p>
          <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" data-testid="text-annual-income">${totalIncome.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-base sm:text-xl font-bold text-red-700 dark:text-red-400 tabular-nums" data-testid="text-annual-expenses">${totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Net Savings</p>
          <p className="text-base sm:text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums" data-testid="text-annual-savings">${totalSavings.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 rounded-md p-3">
          <p className="text-[10px] font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wider">Savings Rate</p>
          <p className="text-base sm:text-xl font-bold text-purple-700 dark:text-purple-400 tabular-nums" data-testid="text-savings-rate">{savingsRate}%</p>
        </div>
      </div>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold mb-3 sm:mb-4">Monthly Comparison</h2>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
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
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
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
            <p className="text-base sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">${avgMonthlyIncome.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Monthly Expenses</p>
            <p className="text-base sm:text-lg font-semibold text-red-600 dark:text-red-400 tabular-nums">${avgMonthlyExpenses.toFixed(2)}</p>
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
                  <td className="py-2 px-2 text-right tabular-nums text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">${row.Income.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-xs sm:text-sm text-red-600 dark:text-red-400">${row.Expenses.toFixed(2)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums text-xs sm:text-sm font-medium ${row.Savings >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                    ${row.Savings.toFixed(2)}
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
