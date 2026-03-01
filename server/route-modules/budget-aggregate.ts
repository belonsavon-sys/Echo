import type { Express, RequestHandler } from "express";
import type { Category, Entry, EntryHistory } from "@shared/schema";
import type { IStorage } from "../storage";
import { getAuthenticatedUserId } from "../auth/request";

type BudgetAggregateResponse = {
  entries: Entry[];
  categories: Category[];
  history: EntryHistory[];
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toUniquePositiveIntegerList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of value) {
    const numeric = typeof item === "number"
      ? item
      : typeof item === "string"
        ? Number(item)
        : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0 || seen.has(numeric)) continue;
    seen.add(numeric);
    out.push(numeric);
  }
  return out;
}

type BudgetAggregateRouteDeps = {
  isAuthenticated: RequestHandler;
  storage: IStorage;
};

export function registerBudgetAggregateRoutes(
  app: Express,
  deps: BudgetAggregateRouteDeps,
): void {
  const { isAuthenticated, storage } = deps;

  app.post("/api/budgets/aggregate", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const body = asObject(req.body);
    if (!body) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const budgetIds = toUniquePositiveIntegerList(body.budgetIds);
    const include = asObject(body.include) ?? {};
    const includeEntries = include.entries === true;
    const includeCategories = include.categories === true;
    const includeHistory = include.history === true;

    if (!includeEntries && !includeCategories && !includeHistory) {
      return res.status(400).json({ message: "At least one include flag is required" });
    }

    const empty: BudgetAggregateResponse = { entries: [], categories: [], history: [] };
    if (budgetIds.length === 0) {
      return res.json(empty);
    }

    const ownedBudgets = await storage.getBudgets(userId);
    const ownedBudgetIds = new Set(ownedBudgets.map((budget) => budget.id));
    const unauthorizedId = budgetIds.find((id) => !ownedBudgetIds.has(id));
    if (unauthorizedId !== undefined) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [entries, categories, history] = await Promise.all([
      includeEntries ? storage.getEntriesForBudgets(budgetIds) : Promise.resolve([]),
      includeCategories ? storage.getCategoriesForBudgets(budgetIds) : Promise.resolve([]),
      includeHistory ? storage.getHistoryForBudgets(budgetIds) : Promise.resolve([]),
    ]);

    const response: BudgetAggregateResponse = {
      entries,
      categories,
      history,
    };
    return res.json(response);
  });
}
