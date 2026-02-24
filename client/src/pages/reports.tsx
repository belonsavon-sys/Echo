import { useQuery } from "@tanstack/react-query";
import type { Budget, Entry, Category } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

export default function ReportsPage() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });

  const budgetId = selectedBudgetId ? parseInt(selectedBudgetId) : budgets[0]?.id;

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["/api/budgets", budgetId, "entries"],
    enabled: !!budgetId,
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/budgets", budgetId, "categories"],
    enabled: !!budgetId,
  });

  const expenseEntries = entries.filter(e => e.type === "expense");

  const categorySpending = categoriesData.map(cat => {
    const total = expenseEntries
      .filter(e => e.categoryId === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.name, value: total, color: cat.color, limit: cat.budgetLimit };
  }).filter(c => c.value > 0);

  const uncategorized = expenseEntries
    .filter(e => !e.categoryId)
    .reduce((sum, e) => sum + e.amount, 0);
  if (uncategorized > 0) {
    categorySpending.push({ name: "Uncategorized", value: uncategorized, color: "#94a3b8", limit: null });
  }

  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  });

  const monthlyData = last6Months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthEntries = entries.filter(e => {
      const d = parseISO(e.date);
      return d >= monthStart && d <= monthEnd;
    });
    const income = monthEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expenses = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return {
      month: format(month, "MMM"),
      Income: income,
      Expenses: expenses,
    };
  });

  if (!budgetId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Create a budget first to see reports.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold" data-testid="text-reports-title">Spending Reports</h1>
        <Select value={selectedBudgetId || budgetId?.toString()} onValueChange={setSelectedBudgetId}>
          <SelectTrigger className="w-[180px]" data-testid="select-report-budget">
            <SelectValue placeholder="Select budget" />
          </SelectTrigger>
          <SelectContent>
            {budgets.map(b => (
              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-md border border-card-border p-4">
          <h2 className="text-sm font-semibold mb-4">Spending by Category</h2>
          {categorySpending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expense data yet</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categorySpending.map((entry, index) => (
                      <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card rounded-md border border-card-border p-4">
          <h2 className="text-sm font-semibold mb-4">Income vs Expenses (6 months)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {categorySpending.filter(c => c.limit).length > 0 && (
        <div className="bg-card rounded-md border border-card-border p-4">
          <h2 className="text-sm font-semibold mb-4">Category Budget Limits</h2>
          <div className="space-y-3">
            {categorySpending.filter(c => c.limit).map((cat, i) => {
              const percent = cat.limit ? Math.min(100, (cat.value / cat.limit) * 100) : 0;
              const isOver = cat.limit ? cat.value > cat.limit : false;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="font-medium">{cat.name}</span>
                    <span className={isOver ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}>
                      ${cat.value.toFixed(2)} / ${cat.limit?.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
