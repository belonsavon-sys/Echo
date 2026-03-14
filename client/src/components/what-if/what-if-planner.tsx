import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarRange,
  Clock3,
  Edit2,
  FlaskConical,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type { Budget, Entry } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { fetchBudgetAggregate, type BudgetAggregateResponse } from "@/lib/budget-aggregate";

type ScenarioAction = "add" | "remove";
type ScenarioCadence = "once" | "monthly";
type ScenarioEntryType = "income" | "expense";

type ScenarioAdjustment = {
  id: string;
  action: ScenarioAction;
  cadence: ScenarioCadence;
  entryType: ScenarioEntryType;
  name: string;
  amount: number;
};

type SavedScenario = {
  id: string;
  budgetId: number;
  name: string;
  adjustments: ScenarioAdjustment[];
  createdAt: string;
  updatedAt: string;
};

type EntrySummary = {
  income: number;
  expenses: number;
  balance: number;
};

const STORAGE_KEY = "echo:what-if-scenarios:v1";

function summarizeEntries(entries: Entry[]): EntrySummary {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
  };
}

function summarizeAdjustments(
  adjustments: ScenarioAdjustment[],
  monthCount: number,
): EntrySummary {
  let income = 0;
  let expenses = 0;

  for (const adjustment of adjustments) {
    const multiplier = adjustment.cadence === "monthly" ? monthCount : 1;
    const delta = adjustment.amount * multiplier;

    if (adjustment.entryType === "income") {
      income += adjustment.action === "add" ? delta : -delta;
    } else {
      expenses += adjustment.action === "add" ? delta : -delta;
    }
  }

  return {
    income,
    expenses,
    balance: income - expenses,
  };
}

function mergeSummaries(base: EntrySummary, delta: EntrySummary): EntrySummary {
  return {
    income: base.income + delta.income,
    expenses: base.expenses + delta.expenses,
    balance: base.balance + delta.balance,
  };
}

function readSavedScenarios(): SavedScenario[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedScenario =>
        typeof item?.id === "string" &&
        typeof item?.budgetId === "number" &&
        typeof item?.name === "string" &&
        Array.isArray(item?.adjustments),
    );
  } catch {
    return [];
  }
}

function writeSavedScenarios(scenarios: SavedScenario[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

function getPlanningBudgets(selectedBudget: Budget | undefined, budgets: Budget[]): Budget[] {
  if (!selectedBudget) return [];
  if (selectedBudget.parentId == null) return [selectedBudget];

  const siblings = budgets
    .filter(
      (budget) =>
        budget.parentId === selectedBudget.parentId &&
        !budget.isFolder &&
        budget.startDate >= selectedBudget.startDate,
    )
    .sort((left, right) =>
      left.startDate === right.startDate
        ? left.sortOrder - right.sortOrder
        : left.startDate.localeCompare(right.startDate),
    );

  return siblings.length > 0 ? siblings : [selectedBudget];
}

function PlannerSummaryCard({
  label,
  headline,
  detail,
  tone = "neutral",
}: {
  label: string;
  headline: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneClassName =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClassName}`}>{headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function PlannerSnapshot({
  title,
  summary,
  currency,
}: {
  title: string;
  summary: EntrySummary;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <p className={`text-sm font-semibold tabular-nums ${summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
          {formatCurrency(summary.balance, currency)}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded-xl bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
          Income <span className="ml-1 font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.income, currency)}</span>
        </div>
        <div className="rounded-xl bg-rose-50/70 px-3 py-2 text-right dark:bg-rose-950/20">
          Expenses <span className="ml-1 font-medium tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(summary.expenses, currency)}</span>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-56 rounded-[28px]" />
        <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <Skeleton className="h-[540px] rounded-[28px]" />
          <Skeleton className="h-[540px] rounded-[28px]" />
        </div>
      </div>
    </div>
  );
}

export function WhatIfPlanner() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [adjustments, setAdjustments] = useState<ScenarioAdjustment[]>([]);

  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<ScenarioAction>("add");
  const [draftCadence, setDraftCadence] = useState<ScenarioCadence>("once");
  const [draftEntryType, setDraftEntryType] = useState<ScenarioEntryType>("expense");
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const selectableBudgets = budgets.filter((budget) => !budget.isFolder);

  useEffect(() => {
    setSavedScenarios(readSavedScenarios());
  }, []);

  useEffect(() => {
    if (selectedBudgetId) return;
    if (selectableBudgets.length === 0) return;
    setSelectedBudgetId(String(selectableBudgets[0].id));
  }, [selectableBudgets, selectedBudgetId]);

  const selectedBudget = useMemo(
    () => selectableBudgets.find((budget) => String(budget.id) === selectedBudgetId) || selectableBudgets[0],
    [selectableBudgets, selectedBudgetId],
  );

  const planningBudgets = useMemo(
    () => getPlanningBudgets(selectedBudget, selectableBudgets),
    [selectedBudget, selectableBudgets],
  );
  const planningBudgetIds = planningBudgets.map((budget) => budget.id);

  const {
    data: aggregate = { entries: [], categories: [], history: [] },
    isLoading: aggregateLoading,
  } = useQuery<BudgetAggregateResponse>({
    queryKey: ["/api/budgets/aggregate", "what-if", planningBudgetIds.join(",")],
    enabled: planningBudgetIds.length > 0,
    queryFn: () =>
      fetchBudgetAggregate(planningBudgetIds, {
        entries: true,
      }),
  });

  useEffect(() => {
    if (!selectedBudget) return;
    if (activeScenarioId == null) return;
    const activeScenario = savedScenarios.find((scenario) => scenario.id === activeScenarioId);
    if (!activeScenario || activeScenario.budgetId !== selectedBudget.id) {
      setActiveScenarioId(null);
      setScenarioName("");
      setAdjustments([]);
    }
  }, [activeScenarioId, savedScenarios, selectedBudget]);

  const budgetCurrency = selectedBudget?.currency || "USD";
  const budgetSavedScenarios = savedScenarios
    .filter((scenario) => scenario.budgetId === selectedBudget?.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const selectedBudgetEntries = aggregate.entries.filter((entry) => entry.budgetId === selectedBudget?.id);
  const recurringEntries = aggregate.entries.filter(
    (entry) => entry.isRecurring || entry.recurringParentId != null,
  );

  const currentMonthSummary = summarizeEntries(selectedBudgetEntries);
  const planningWindowSummary = summarizeEntries(aggregate.entries);
  const currentDelta = summarizeAdjustments(adjustments, 1);
  const planningDelta = summarizeAdjustments(adjustments, planningBudgets.length || 1);
  const projectedCurrentMonth = mergeSummaries(currentMonthSummary, currentDelta);
  const projectedPlanningWindow = mergeSummaries(planningWindowSummary, planningDelta);
  const recurringSummary = summarizeEntries(recurringEntries);

  const currentImpact = projectedCurrentMonth.balance - currentMonthSummary.balance;
  const planningImpact = projectedPlanningWindow.balance - planningWindowSummary.balance;

  function resetDraft() {
    setActiveScenarioId(null);
    setScenarioName("");
    setAdjustments([]);
    setEditingAdjustmentId(null);
    setDraftAction("add");
    setDraftCadence("once");
    setDraftEntryType("expense");
    setDraftName("");
    setDraftAmount("");
  }

  function resetAdjustmentDraft() {
    setEditingAdjustmentId(null);
    setDraftAction("add");
    setDraftCadence("once");
    setDraftEntryType("expense");
    setDraftName("");
    setDraftAmount("");
  }

  function saveAllScenarios(nextScenarios: SavedScenario[]) {
    setSavedScenarios(nextScenarios);
    writeSavedScenarios(nextScenarios);
  }

  function handleSaveScenario() {
    if (!selectedBudget || !scenarioName.trim() || adjustments.length === 0) return;

    const now = new Date().toISOString();
    const nextScenario: SavedScenario = {
      id: activeScenarioId || `${Date.now()}`,
      budgetId: selectedBudget.id,
      name: scenarioName.trim(),
      adjustments,
      createdAt:
        savedScenarios.find((scenario) => scenario.id === activeScenarioId)?.createdAt || now,
      updatedAt: now,
    };

    const withoutCurrent = savedScenarios.filter((scenario) => scenario.id !== nextScenario.id);
    const nextScenarios = [nextScenario, ...withoutCurrent];
    saveAllScenarios(nextScenarios);
    setActiveScenarioId(nextScenario.id);
  }

  function handleLoadScenario(scenario: SavedScenario) {
    setActiveScenarioId(scenario.id);
    setScenarioName(scenario.name);
    setAdjustments(scenario.adjustments);
    resetAdjustmentDraft();
  }

  function handleDeleteScenario(id: string) {
    const nextScenarios = savedScenarios.filter((scenario) => scenario.id !== id);
    saveAllScenarios(nextScenarios);
    if (activeScenarioId === id) {
      resetDraft();
    }
  }

  function handleSaveAdjustment() {
    const parsedAmount = Number(draftAmount);
    if (!draftName.trim()) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    const nextAdjustment: ScenarioAdjustment = {
      id: editingAdjustmentId || `${Date.now()}`,
      action: draftAction,
      cadence: draftCadence,
      entryType: draftEntryType,
      name: draftName.trim(),
      amount: parsedAmount,
    };

    const nextAdjustments = editingAdjustmentId
      ? adjustments.map((adjustment) =>
          adjustment.id === editingAdjustmentId ? nextAdjustment : adjustment,
        )
      : [...adjustments, nextAdjustment];

    setAdjustments(nextAdjustments);
    resetAdjustmentDraft();
  }

  function handleEditAdjustment(adjustment: ScenarioAdjustment) {
    setEditingAdjustmentId(adjustment.id);
    setDraftAction(adjustment.action);
    setDraftCadence(adjustment.cadence);
    setDraftEntryType(adjustment.entryType);
    setDraftName(adjustment.name);
    setDraftAmount(String(adjustment.amount));
  }

  function handleDeleteAdjustment(id: string) {
    setAdjustments((current) => current.filter((adjustment) => adjustment.id !== id));
    if (editingAdjustmentId === id) {
      resetAdjustmentDraft();
    }
  }

  if (budgetsLoading || (planningBudgetIds.length > 0 && aggregateLoading)) {
    return <LoadingState />;
  }

  if (!selectedBudget) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-lg rounded-[28px] border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FlaskConical className="h-5 w-5 text-primary" />
              Scenario planner
            </CardTitle>
            <CardDescription>
              Create a budget first to model changes and save scenarios.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] shadow-md dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92))]">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  What if planner
                </Badge>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="text-whatif-title">
                  Scenario planning that actually reads like a feature.
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                  Work from a real planning window, include future recurring entries already routed into later month folders, and save named scenarios you can revisit.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                    Window: {planningBudgets[0]?.name}
                    {planningBudgets.length > 1 ? ` to ${planningBudgets[planningBudgets.length - 1]?.name}` : ""}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                    {planningBudgets.length} month{planningBudgets.length === 1 ? "" : "s"} in scope
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {recurringEntries.length} recurring item{recurringEntries.length === 1 ? "" : "s"} already scheduled
                  </Badge>
                </div>
              </div>

              <div className="w-full max-w-xs">
                <Select value={String(selectedBudget.id)} onValueChange={setSelectedBudgetId}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/85 px-4" data-testid="select-whatif-budget">
                    <SelectValue placeholder="Select budget" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableBudgets.map((budget) => (
                      <SelectItem key={budget.id} value={String(budget.id)}>
                        {budget.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <PlannerSummaryCard
                label="Current month impact"
                headline={`${currentImpact >= 0 ? "+" : ""}${formatCurrency(currentImpact, budgetCurrency)}`}
                detail={`${adjustments.length} draft adjustment${adjustments.length === 1 ? "" : "s"} applied to ${selectedBudget.name}`}
                tone={currentImpact >= 0 ? "positive" : currentImpact < 0 ? "warning" : "neutral"}
              />
              <PlannerSummaryCard
                label="Planning window impact"
                headline={`${planningImpact >= 0 ? "+" : ""}${formatCurrency(planningImpact, budgetCurrency)}`}
                detail={draftCadence === "monthly" || adjustments.some((item) => item.cadence === "monthly") ? "Monthly scenarios repeat across the remaining window" : "Only one-time changes are in the draft"}
                tone={planningImpact >= 0 ? "positive" : planningImpact < 0 ? "warning" : "neutral"}
              />
              <PlannerSummaryCard
                label="Recurring baseline"
                headline={formatCurrency(recurringSummary.balance, budgetCurrency)}
                detail="Existing recurring entries already scheduled in the window"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-4">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Projection summary
                </CardTitle>
                <CardDescription>
                  Compare the current budget and the full planning window before and after the draft.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <PlannerSnapshot title={`Current: ${selectedBudget.name}`} summary={currentMonthSummary} currency={budgetCurrency} />
                  <PlannerSnapshot title="Projected current month" summary={projectedCurrentMonth} currency={budgetCurrency} />
                </div>
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <PlannerSnapshot title="Current planning window" summary={planningWindowSummary} currency={budgetCurrency} />
                  <PlannerSnapshot title="Projected planning window" summary={projectedPlanningWindow} currency={budgetCurrency} />
                </div>
                <div className={`rounded-2xl px-4 py-4 text-center ${planningImpact > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : planningImpact < 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" : "bg-muted text-muted-foreground"}`}>
                  <p className="text-xs uppercase tracking-[0.18em]">Net effect on planning window</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums" data-testid="text-balance-diff">
                    {planningImpact >= 0 ? "+" : ""}
                    {formatCurrency(planningImpact, budgetCurrency)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Draft adjustments</CardTitle>
                <CardDescription>
                  Use one-time changes for isolated events and monthly changes for repeated effects across the remaining window.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {adjustments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                    No adjustments in the draft yet.
                  </div>
                ) : (
                  adjustments.map((adjustment) => (
                    <div key={adjustment.id} className="rounded-2xl border border-border/70 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Badge
                          variant={adjustment.action === "add" ? "default" : "secondary"}
                          className="mt-0.5 rounded-full px-2.5 py-0 text-[10px] uppercase"
                        >
                          {adjustment.action}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{adjustment.name}</p>
                            <Badge variant="outline" className="px-2 py-0 text-[10px] capitalize">
                              {adjustment.entryType}
                            </Badge>
                            <Badge variant="outline" className="px-2 py-0 text-[10px] capitalize">
                              {adjustment.cadence}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {adjustment.cadence === "monthly"
                              ? `Repeats for ${planningBudgets.length} month${planningBudgets.length === 1 ? "" : "s"}`
                              : "Applies once"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(adjustment.amount, budgetCurrency)}
                          </p>
                          <Button size="icon" variant="ghost" onClick={() => handleEditAdjustment(adjustment)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteAdjustment(adjustment.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Plus className="h-5 w-5 text-primary" />
                  Scenario builder
                </CardTitle>
                <CardDescription>
                  Name the scenario, add adjustments, then save it for later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Scenario name"
                  value={scenarioName}
                  onChange={(event) => setScenarioName(event.target.value)}
                />

                <div className="grid grid-cols-3 gap-2">
                  <Select value={draftAction} onValueChange={(value: ScenarioAction) => setDraftAction(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add</SelectItem>
                      <SelectItem value="remove">Remove</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draftEntryType} onValueChange={(value: ScenarioEntryType) => setDraftEntryType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draftCadence} onValueChange={(value: ScenarioCadence) => setDraftCadence(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Adjustment name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                  <Input
                    placeholder="Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftAmount}
                    onChange={(event) => setDraftAmount(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveAdjustment}
                    disabled={!draftName.trim() || !draftAmount}
                    className="flex-1"
                    data-testid="button-add-scenario"
                  >
                    {editingAdjustmentId ? "Update adjustment" : "Add adjustment"}
                  </Button>
                  <Button variant="outline" onClick={resetAdjustmentDraft}>
                    Clear form
                  </Button>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveScenario}
                    disabled={!scenarioName.trim() || adjustments.length === 0}
                    className="flex-1"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {activeScenarioId ? "Update scenario" : "Save scenario"}
                  </Button>
                  <Button variant="outline" onClick={resetDraft}>
                    New draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Saved scenarios</CardTitle>
                <CardDescription>
                  Local to this browser for now. Load, update, or remove them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {budgetSavedScenarios.length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                    No saved scenarios for {selectedBudget.name} yet.
                  </div>
                ) : (
                  budgetSavedScenarios.map((scenario) => {
                    const scenarioDelta = summarizeAdjustments(
                      scenario.adjustments,
                      planningBudgets.length || 1,
                    );

                    return (
                      <div key={scenario.id} className="rounded-2xl border border-border/70 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{scenario.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {scenario.adjustments.length} adjustment{scenario.adjustments.length === 1 ? "" : "s"} • updated {new Date(scenario.updatedAt).toLocaleDateString()}
                            </p>
                            <p className={`mt-2 text-sm font-semibold tabular-nums ${scenarioDelta.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                              {scenarioDelta.balance >= 0 ? "+" : ""}
                              {formatCurrency(scenarioDelta.balance, budgetCurrency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleLoadScenario(scenario)}>
                              Load
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteScenario(scenario.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
