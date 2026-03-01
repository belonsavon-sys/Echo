import type { Budget } from "@shared/schema";
import type { IStorage } from "../storage";
import { isYearFolder } from "./budget-routing";

type BalanceMode = "manual" | "carryover";

type BudgetBalanceContext = {
  effectiveOpeningBalance: number;
  computedClosingBalance: number;
  carryoverSourceBudgetId: number | null;
  mode: BalanceMode;
};

type ResolvedCarryoverContext = {
  yearFolder: Budget;
  monthBudgets: Budget[];
};

function byMonthOrder(left: Budget, right: Budget): number {
  const bySort = left.sortOrder - right.sortOrder;
  if (bySort !== 0) return bySort;
  return left.startDate.localeCompare(right.startDate);
}

function sumBudgetNet(entries: Array<{ type: string; amount: number }>): number {
  return entries.reduce((sum, entry) => {
    if (entry.type === "income") return sum + entry.amount;
    if (entry.type === "expense") return sum - entry.amount;
    return sum;
  }, 0);
}

function resolveCarryoverContext(
  budget: Budget,
  budgetsById: Map<number, Budget>,
): ResolvedCarryoverContext | null {
  if (budget.isFolder || budget.parentId == null) return null;
  const parent = budgetsById.get(budget.parentId);
  if (!parent || !isYearFolder(parent)) return null;

  const monthBudgets = Array.from(budgetsById.values())
    .filter((candidate) => candidate.parentId === parent.id && !candidate.isFolder)
    .sort(byMonthOrder);
  if (monthBudgets.length === 0) return null;

  return { yearFolder: parent, monthBudgets };
}

export async function computeBudgetBalanceContext(
  storage: IStorage,
  budgetId: number,
  userId: string,
): Promise<BudgetBalanceContext | null> {
  const budget = await storage.getBudget(budgetId, userId);
  if (!budget) return null;

  const allBudgets = await storage.getBudgets(userId);
  const budgetsById = new Map<number, Budget>(allBudgets.map((item) => [item.id, item]));
  const carryoverContext = resolveCarryoverContext(budget, budgetsById);

  const relevantBudgetIds = carryoverContext
    ? carryoverContext.monthBudgets.map((item) => item.id)
    : [budget.id];
  const entries = await storage.getEntriesForBudgets(relevantBudgetIds);
  const entriesByBudgetId = new Map<number, typeof entries>();
  for (const entry of entries) {
    const existing = entriesByBudgetId.get(entry.budgetId);
    if (existing) {
      existing.push(entry);
    } else {
      entriesByBudgetId.set(entry.budgetId, [entry]);
    }
  }

  const closingCache = new Map<number, number>();
  const openingCache = new Map<number, { opening: number; sourceBudgetId: number | null }>();

  const computeForBudget = (target: Budget): { opening: number; closing: number; sourceBudgetId: number | null } => {
    const cachedClosing = closingCache.get(target.id);
    const cachedOpening = openingCache.get(target.id);
    if (cachedClosing !== undefined && cachedOpening) {
      return {
        opening: cachedOpening.opening,
        closing: cachedClosing,
        sourceBudgetId: cachedOpening.sourceBudgetId,
      };
    }

    const targetContext = resolveCarryoverContext(target, budgetsById);
    const mode: BalanceMode = targetContext ? "carryover" : "manual";
    let opening = target.openingBalance ?? 0;
    let sourceBudgetId: number | null = null;

    if (mode === "carryover" && targetContext) {
      const monthIndex = targetContext.monthBudgets.findIndex((item) => item.id === target.id);
      if (monthIndex > 0) {
        const previousBudget = targetContext.monthBudgets[monthIndex - 1];
        const previous = computeForBudget(previousBudget);
        opening = previous.closing + (target.openingBalance ?? 0);
        sourceBudgetId = previousBudget.id;
      } else {
        opening = (targetContext.yearFolder.openingBalance ?? 0) + (target.openingBalance ?? 0);
      }
    }

    const net = sumBudgetNet(entriesByBudgetId.get(target.id) ?? []);
    const closing = opening + net;

    openingCache.set(target.id, { opening, sourceBudgetId });
    closingCache.set(target.id, closing);

    return { opening, closing, sourceBudgetId };
  };

  const computed = computeForBudget(budget);
  const isCarryoverBudget = !!carryoverContext;
  return {
    effectiveOpeningBalance: computed.opening,
    computedClosingBalance: computed.closing,
    carryoverSourceBudgetId: computed.sourceBudgetId,
    mode: isCarryoverBudget ? "carryover" : "manual",
  };
}
