import assert from "node:assert/strict";
import test from "node:test";
import type { Budget, Entry } from "@shared/schema";
import { computeBudgetBalanceContext } from "../server/lib/budget-balance";
import type { IStorage } from "../server/storage";

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 1,
    name: "Budget",
    description: null,
    period: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    isActive: true,
    sortOrder: 0,
    rolloverEnabled: false,
    rolloverAmount: 0,
    openingBalance: 0,
    openingBalanceMode: "manual",
    parentId: null,
    isFolder: false,
    currency: "USD",
    userId: "user-1",
    ...overrides,
  };
}

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 1,
    budgetId: 1,
    categoryId: null,
    type: "expense",
    name: "Entry",
    amount: 0,
    note: null,
    date: "2026-01-01",
    isPaidOrReceived: false,
    isStarred: false,
    sortOrder: 0,
    isRecurring: false,
    recurringFrequency: null,
    recurringEndDate: null,
    recurringEndAmount: null,
    recurringParentId: null,
    tagIds: null,
    ...overrides,
  };
}

function storageFor(budgets: Budget[], entries: Entry[]): IStorage {
  return {
    getBudget: async (id: number) => budgets.find((item) => item.id === id),
    getBudgets: async () => budgets,
    getEntriesForBudgets: async (budgetIds: number[]) =>
      entries.filter((item) => budgetIds.includes(item.budgetId)),
  } as unknown as IStorage;
}

test("carryover: January uses year-folder opening balance", async () => {
  const year = budget({
    id: 100,
    name: "2026",
    period: "yearly",
    isFolder: true,
    openingBalance: 1200,
  });
  const january = budget({
    id: 101,
    name: "January",
    parentId: 100,
    sortOrder: 0,
    openingBalanceMode: "carryover",
    openingBalance: 0,
  });

  const context = await computeBudgetBalanceContext(
    storageFor([year, january], [entry({ budgetId: 101, type: "expense", amount: 300 })]),
    january.id,
    "user-1",
  );

  assert.ok(context);
  assert.equal(context.mode, "carryover");
  assert.equal(context.effectiveOpeningBalance, 1200);
  assert.equal(context.computedClosingBalance, 900);
  assert.equal(context.carryoverSourceBudgetId, null);
});

test("carryover: later months use prior month closing balance", async () => {
  const year = budget({
    id: 200,
    name: "2026",
    period: "yearly",
    isFolder: true,
    openingBalance: 1000,
  });
  const january = budget({
    id: 201,
    name: "January",
    parentId: 200,
    sortOrder: 0,
    openingBalanceMode: "carryover",
  });
  const february = budget({
    id: 202,
    name: "February",
    parentId: 200,
    sortOrder: 1,
    openingBalanceMode: "carryover",
  });

  const context = await computeBudgetBalanceContext(
    storageFor(
      [year, january, february],
      [
        entry({ id: 1, budgetId: 201, type: "income", amount: 300 }),
        entry({ id: 2, budgetId: 201, type: "expense", amount: 100 }),
        entry({ id: 3, budgetId: 202, type: "expense", amount: 50 }),
      ],
    ),
    february.id,
    "user-1",
  );

  assert.ok(context);
  assert.equal(context.effectiveOpeningBalance, 1200);
  assert.equal(context.computedClosingBalance, 1150);
  assert.equal(context.carryoverSourceBudgetId, january.id);
});

test("manual mode ignores prior month carryover chain", async () => {
  const year = budget({
    id: 300,
    name: "2026",
    period: "yearly",
    isFolder: true,
    openingBalance: 1000,
  });
  const january = budget({
    id: 301,
    name: "January",
    parentId: 300,
    sortOrder: 0,
    openingBalanceMode: "carryover",
  });
  const february = budget({
    id: 302,
    name: "February",
    parentId: 300,
    sortOrder: 1,
    openingBalanceMode: "manual",
    openingBalance: 500,
  });

  const context = await computeBudgetBalanceContext(
    storageFor(
      [year, january, february],
      [
        entry({ id: 1, budgetId: 301, type: "income", amount: 400 }),
        entry({ id: 2, budgetId: 302, type: "expense", amount: 200 }),
      ],
    ),
    february.id,
    "user-1",
  );

  assert.ok(context);
  assert.equal(context.mode, "manual");
  assert.equal(context.effectiveOpeningBalance, 500);
  assert.equal(context.computedClosingBalance, 300);
  assert.equal(context.carryoverSourceBudgetId, null);
});
