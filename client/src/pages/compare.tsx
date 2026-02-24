import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Budget, Entry, Category } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

const BUDGET_A_COLOR = "#6366f1";
const BUDGET_B_COLOR = "#10b981";

type SortField = "date" | "amount" | "name";
type SortDir = "asc" | "desc";

function diffPercent(a: number, b: number): string {
  if (a === 0 && b === 0) return "0%";
  if (a === 0) return "+100%";
  const pct = ((b - a) / Math.abs(a)) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function DiffIndicator({ a, b }: { a: number; b: number }) {
  const diff = b - a;
  const isUp = diff > 0;
  const isDown = diff < 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${isUp ? "text-emerald-500 dark:text-emerald-400" : isDown ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
      {isUp && <TrendingUp className="w-3 h-3" />}
      {isDown && <TrendingDown className="w-3 h-3" />}
      {!isUp && !isDown && <Minus className="w-3 h-3" />}
      {diffPercent(a, b)}
    </span>
  );
}

export default function ComparePage() {
  const [budgetAId, setBudgetAId] = useState<string>("");
  const [budgetBId, setBudgetBId] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const selectableBudgets = budgets.filter(b => !b.isFolder);

  const aId = budgetAId ? parseInt(budgetAId) : 0;
  const bId = budgetBId ? parseInt(budgetBId) : 0;

  const { data: entriesA = [], isLoading: loadingEntriesA } = useQuery<Entry[]>({
    queryKey: ["/api/budgets", aId, "entries"],
    enabled: aId > 0,
  });
  const { data: entriesB = [], isLoading: loadingEntriesB } = useQuery<Entry[]>({
    queryKey: ["/api/budgets", bId, "entries"],
    enabled: bId > 0,
  });
  const { data: categoriesA = [] } = useQuery<Category[]>({
    queryKey: ["/api/budgets", aId, "categories"],
    enabled: aId > 0,
  });
  const { data: categoriesB = [] } = useQuery<Category[]>({
    queryKey: ["/api/budgets", bId, "categories"],
    enabled: bId > 0,
  });

  const budgetA = selectableBudgets.find(b => b.id === aId);
  const budgetB = selectableBudgets.find(b => b.id === bId);
  const currency = budgetA?.currency || budgetB?.currency || "USD";

  const statsA = useMemo(() => {
    const income = entriesA.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = entriesA.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, count: entriesA.length };
  }, [entriesA]);

  const statsB = useMemo(() => {
    const income = entriesB.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = entriesB.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, count: entriesB.length };
  }, [entriesB]);

  const chartData = useMemo(() => {
    const catMapA = new Map<string, number>();
    const catNameMap = new Map<number, string>();
    categoriesA.forEach(c => catNameMap.set(c.id, c.name));
    categoriesB.forEach(c => catNameMap.set(c.id, c.name));

    entriesA.forEach(e => {
      if (e.categoryId) {
        const name = catNameMap.get(e.categoryId) || "Uncategorized";
        catMapA.set(name, (catMapA.get(name) || 0) + e.amount);
      }
    });

    const catMapB = new Map<string, number>();
    entriesB.forEach(e => {
      if (e.categoryId) {
        const name = catNameMap.get(e.categoryId) || "Uncategorized";
        catMapB.set(name, (catMapB.get(name) || 0) + e.amount);
      }
    });

    const allCats = new Set([...catMapA.keys(), ...catMapB.keys()]);
    return Array.from(allCats).map(cat => ({
      category: cat,
      budgetA: catMapA.get(cat) || 0,
      budgetB: catMapB.get(cat) || 0,
    })).sort((a, b) => (b.budgetA + b.budgetB) - (a.budgetA + a.budgetB));
  }, [entriesA, entriesB, categoriesA, categoriesB]);

  const mergedEntries = useMemo(() => {
    const tagged = [
      ...entriesA.map(e => ({ ...e, source: "A" as const })),
      ...entriesB.map(e => ({ ...e, source: "B" as const })),
    ];
    tagged.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return tagged;
  }, [entriesA, entriesB, sortField, sortDir]);

  const bothSelected = aId > 0 && bId > 0;
  const anySelected = aId > 0 || bId > 0;
  const isLoading = loadingEntriesA || loadingEntriesB;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const budgetALabel = budgetA?.name || "Budget A";
  const budgetBLabel = budgetB?.name || "Budget B";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Budget A</label>
          <Select value={budgetAId} onValueChange={setBudgetAId}>
            <SelectTrigger data-testid="select-budget-a">
              <SelectValue placeholder="Select budget A" />
            </SelectTrigger>
            <SelectContent>
              {selectableBudgets.map(b => (
                <SelectItem key={b.id} value={String(b.id)} disabled={b.id === bId}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Budget B</label>
          <Select value={budgetBId} onValueChange={setBudgetBId}>
            <SelectTrigger data-testid="select-budget-b">
              <SelectValue placeholder="Select budget B" />
            </SelectTrigger>
            <SelectContent>
              {selectableBudgets.map(b => (
                <SelectItem key={b.id} value={String(b.id)} disabled={b.id === aId}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!anySelected && (
        <Card className="p-8 flex flex-col items-center gap-3 text-center">
          <ArrowLeftRight className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
            Select two budgets above to compare them side by side
          </p>
        </Card>
      )}

      {anySelected && isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      )}

      {bothSelected && !isLoading && (
        <>
          <div data-testid="section-comparison-summary" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Total Income", a: statsA.income, b: statsB.income },
              { label: "Total Expenses", a: statsA.expense, b: statsB.expense },
              { label: "Net Balance", a: statsA.net, b: statsB.net },
              { label: "Entries", a: statsA.count, b: statsB.count, isCount: true },
            ].map(item => (
              <Card key={item.label} className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <div className="flex items-end justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{budgetALabel}</p>
                    <p className="text-lg font-semibold" style={{ color: BUDGET_A_COLOR }} data-testid={`text-${item.label.toLowerCase().replace(/\s/g, "-")}-a`}>
                      {item.isCount ? item.a : formatCurrency(item.a, currency)}
                    </p>
                  </div>
                  <DiffIndicator a={item.a} b={item.b} />
                  <div className="space-y-0.5 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{budgetBLabel}</p>
                    <p className="text-lg font-semibold" style={{ color: BUDGET_B_COLOR }} data-testid={`text-${item.label.toLowerCase().replace(/\s/g, "-")}-b`}>
                      {item.isCount ? item.b : formatCurrency(item.b, currency)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {chartData.length > 0 && (
            <Card className="p-4" data-testid="section-comparison-chart">
              <p className="text-xs font-medium text-muted-foreground mb-3">Category Comparison</p>
              <div className="w-full" style={{ height: Math.max(250, chartData.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v, currency)} className="text-xs" />
                    <YAxis type="category" dataKey="category" width={100} className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="budgetA" name={budgetALabel} fill={BUDGET_A_COLOR} radius={[0, 2, 2, 0]} />
                    <Bar dataKey="budgetB" name={budgetBLabel} fill={BUDGET_B_COLOR} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {mergedEntries.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">All Entries</p>
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                {(["date", "amount", "name"] as SortField[]).map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={sortField === f ? "default" : "outline"}
                    onClick={() => toggleSort(f)}
                    data-testid={`button-sort-${f}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {sortField === f && <ArrowUpDown className="w-3 h-3 ml-1" />}
                  </Button>
                ))}
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {mergedEntries.map((entry) => (
                  <div
                    key={`${entry.source}-${entry.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm"
                    style={{ borderLeft: `3px solid ${entry.source === "A" ? BUDGET_A_COLOR : BUDGET_B_COLOR}` }}
                    data-testid={`entry-row-${entry.source}-${entry.id}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.source === "A" ? BUDGET_A_COLOR : BUDGET_B_COLOR }}
                    />
                    <span className="text-xs text-muted-foreground shrink-0 w-20">
                      {format(parseISO(entry.date), "MMM d, yy")}
                    </span>
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className={`shrink-0 font-medium ${entry.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount, currency)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {entry.source === "A" ? budgetALabel : budgetBLabel}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {anySelected && !bothSelected && !isLoading && (
        <Card className="p-8 flex flex-col items-center gap-3 text-center">
          <ArrowLeftRight className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-select-second">
            Select a second budget to start comparing
          </p>
        </Card>
      )}
    </div>
  );
}
