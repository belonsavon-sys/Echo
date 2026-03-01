import type { Category, Entry, EntryHistory } from "@shared/schema";
import { apiRequest } from "./queryClient";

export type BudgetAggregateResponse = {
  entries: Entry[];
  categories: Category[];
  history: EntryHistory[];
};

type BudgetAggregateInclude = {
  entries?: boolean;
  categories?: boolean;
  history?: boolean;
};

function normalizeBudgetIds(budgetIds: number[]): number[] {
  const unique = new Set<number>();
  for (const id of budgetIds) {
    if (!Number.isInteger(id) || id <= 0) continue;
    unique.add(id);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

export async function fetchBudgetAggregate(
  budgetIds: number[],
  include: BudgetAggregateInclude,
): Promise<BudgetAggregateResponse> {
  const normalizedBudgetIds = normalizeBudgetIds(budgetIds);
  if (normalizedBudgetIds.length === 0) {
    return { entries: [], categories: [], history: [] };
  }

  const response = await apiRequest("POST", "/api/budgets/aggregate", {
    budgetIds: normalizedBudgetIds,
    include,
  });
  return response.json();
}
