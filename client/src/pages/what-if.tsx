import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Budget, Entry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Plus, Trash2, ArrowRight } from "lucide-react";

interface Scenario {
  id: string;
  description: string;
  type: "add" | "remove" | "modify";
  entryType: "income" | "expense";
  name: string;
  amount: number;
  originalEntryId?: number;
}

export default function WhatIfPage() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"add" | "remove">("add");
  const [newEntryType, setNewEntryType] = useState<"income" | "expense">("expense");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const budgetId = selectedBudgetId ? parseInt(selectedBudgetId) : budgets[0]?.id;
  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["/api/budgets", budgetId, "entries"],
    enabled: !!budgetId,
  });

  const currentIncome = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const currentExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const currentBalance = currentIncome - currentExpenses;

  let projectedIncome = currentIncome;
  let projectedExpenses = currentExpenses;

  scenarios.forEach(sc => {
    if (sc.type === "add") {
      if (sc.entryType === "income") projectedIncome += sc.amount;
      else projectedExpenses += sc.amount;
    } else if (sc.type === "remove") {
      if (sc.entryType === "income") projectedIncome -= sc.amount;
      else projectedExpenses -= sc.amount;
    }
  });

  const projectedBalance = projectedIncome - projectedExpenses;
  const balanceDiff = projectedBalance - currentBalance;

  function addScenario() {
    if (!newName || !newAmount) return;
    setScenarios(prev => [...prev, {
      id: Date.now().toString(),
      description: newDesc || `${newType === "add" ? "Add" : "Remove"} ${newName}`,
      type: newType,
      entryType: newEntryType,
      name: newName,
      amount: parseFloat(newAmount),
    }]);
    setNewDesc("");
    setNewName("");
    setNewAmount("");
  }

  function removeScenario(id: string) {
    setScenarios(prev => prev.filter(s => s.id !== id));
  }

  if (!budgetId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Create a budget first to use the scenario planner.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold" data-testid="text-whatif-title">What If Scenario Planner</h1>
        </div>
        <Select value={selectedBudgetId || budgetId?.toString()} onValueChange={setSelectedBudgetId}>
          <SelectTrigger className="w-[160px]" data-testid="select-whatif-budget">
            <SelectValue placeholder="Select budget" />
          </SelectTrigger>
          <SelectContent>
            {budgets.map(b => (
              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Test budget changes without affecting your real data. Add or remove hypothetical income and expenses to see how your balance would change.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Current Budget</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
              <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase">Income</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">${currentIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
              <p className="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase">Expenses</p>
              <p className="text-base font-bold text-red-700 dark:text-red-400 tabular-nums">${currentExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3">
              <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase">Balance</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums">${currentBalance.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>

          <h2 className="text-sm font-semibold">Projected Budget</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3 border-2 border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase">Income</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">${projectedIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3 border-2 border-red-200 dark:border-red-800">
              <p className="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase">Expenses</p>
              <p className="text-base font-bold text-red-700 dark:text-red-400 tabular-nums">${projectedExpenses.toFixed(2)}</p>
            </div>
            <div className={`rounded-md p-3 border-2 ${projectedBalance >= 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"}`}>
              <p className={`text-[10px] font-medium uppercase ${projectedBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>Balance</p>
              <p className={`text-base font-bold tabular-nums ${projectedBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>${projectedBalance.toFixed(2)}</p>
            </div>
          </div>

          <div className={`text-center p-3 rounded-md ${balanceDiff > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : balanceDiff < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-muted"}`}>
            <p className="text-xs text-muted-foreground">Impact on Balance</p>
            <p className={`text-xl font-bold tabular-nums ${balanceDiff > 0 ? "text-emerald-600 dark:text-emerald-400" : balanceDiff < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} data-testid="text-balance-diff">
              {balanceDiff >= 0 ? "+" : ""}${balanceDiff.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Scenarios</h2>

          <div className="bg-card rounded-md border border-card-border p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={newType} onValueChange={(v: "add" | "remove") => setNewType(v)}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-scenario-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newEntryType} onValueChange={(v: "income" | "expense") => setNewEntryType(v)}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-scenario-entry-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" data-testid="input-scenario-name" />
              <Input placeholder="Amount" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-8 text-sm" data-testid="input-scenario-amount" />
            </div>
            <Button size="sm" onClick={addScenario} className="w-full" disabled={!newName || !newAmount} data-testid="button-add-scenario">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Scenario
            </Button>
          </div>

          {scenarios.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No scenarios added yet. Try adding or removing an expense to see its impact.</p>
          ) : (
            <div className="space-y-2">
              {scenarios.map(sc => (
                <div key={sc.id} className="flex items-center gap-2 bg-card rounded-md border border-card-border px-3 py-2" data-testid={`scenario-${sc.id}`}>
                  <Badge variant={sc.type === "add" ? "default" : "destructive"} className="text-[10px] shrink-0">
                    {sc.type === "add" ? "+" : "-"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sc.name}</p>
                    <p className="text-xs text-muted-foreground">{sc.entryType} - ${sc.amount.toFixed(2)}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeScenario(sc.id)} data-testid={`button-remove-scenario-${sc.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setScenarios([])} className="w-full" data-testid="button-clear-scenarios">
                Clear All Scenarios
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
