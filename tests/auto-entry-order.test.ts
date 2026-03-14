import assert from "node:assert/strict";
import test from "node:test";
import type { Budget, Entry } from "@shared/schema";
import { syncAutoDateEntryOrder } from "../server/lib/auto-entry-order";

function createBudget(overrides: Partial<Budget>): Budget {
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
    entryOrderMode: "auto_date",
    parentId: null,
    isFolder: false,
    currency: "USD",
    userId: "user-1",
    ...overrides,
  };
}

function createEntry(overrides: Partial<Entry>): Entry {
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

test("syncAutoDateEntryOrder reorders auto_date budgets into timeline order", async () => {
  const budget = createBudget({ entryOrderMode: "auto_date" });
  const entries = [
    createEntry({ id: 10, date: "2026-03-20", sortOrder: 0 }),
    createEntry({ id: 11, date: "2026-03-12", sortOrder: 1 }),
    createEntry({ id: 12, date: "2026-03-15", sortOrder: 2 }),
  ];
  const reorderCalls: number[][] = [];

  await syncAutoDateEntryOrder(
    {
      getBudget: async () => budget,
      getEntries: async () => entries,
      reorderEntriesInBudget: async (_budgetId, orderedEntryIds) => {
        reorderCalls.push(orderedEntryIds);
      },
    },
    budget.id,
    budget.userId,
  );

  assert.deepEqual(reorderCalls, [[11, 12, 10]]);
});

test("syncAutoDateEntryOrder skips manual budgets", async () => {
  const budget = createBudget({ entryOrderMode: "manual" });
  let reordered = false;

  await syncAutoDateEntryOrder(
    {
      getBudget: async () => budget,
      getEntries: async () => [
        createEntry({ id: 20, date: "2026-03-20", sortOrder: 0 }),
        createEntry({ id: 21, date: "2026-03-12", sortOrder: 1 }),
      ],
      reorderEntriesInBudget: async () => {
        reordered = true;
      },
    },
    budget.id,
    budget.userId,
  );

  assert.equal(reordered, false);
});
