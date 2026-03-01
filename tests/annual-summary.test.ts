import assert from "node:assert/strict";
import test from "node:test";
import type { Entry } from "@shared/schema";
import { computeAnnualSummary } from "../shared/annual-summary";

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

test("annual summary totals only include the selected year", () => {
  const entries: Entry[] = [
    entry({ id: 1, type: "income", amount: 1000, date: "2026-01-05" }),
    entry({ id: 2, type: "expense", amount: 400, date: "2026-01-20" }),
    entry({ id: 3, type: "expense", amount: 200, date: "2026-02-11" }),
    entry({ id: 4, type: "income", amount: 500, date: "2026-12-02" }),
    entry({ id: 5, type: "expense", amount: 999, date: "2025-12-31" }),
  ];

  const summary = computeAnnualSummary(entries, 2026);

  assert.equal(summary.totalIncome, 1500);
  assert.equal(summary.totalExpenses, 600);
  assert.equal(summary.totalSavings, 900);
  assert.equal(summary.savingsRate, 60);
  assert.equal(summary.monthlyBreakdown[0].Income, 1000);
  assert.equal(summary.monthlyBreakdown[0].Expenses, 400);
  assert.equal(summary.monthlyBreakdown[1].Expenses, 200);
  assert.equal(summary.monthlyBreakdown[11].Income, 500);
  assert.equal(summary.yearEntries.length, 4);
});
