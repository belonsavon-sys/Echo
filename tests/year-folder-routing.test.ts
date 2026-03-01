import assert from "node:assert/strict";
import test from "node:test";
import type { Budget } from "@shared/schema";
import { findRoutedMonthBudgetId, generateRecurringDates } from "../server/lib/budget-routing";
import { getRecurringChildLimit } from "../server/lib/budget-service";

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 1,
    name: "Default Budget",
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

test("year-folder routing resolves a month budget from an entry date", () => {
  const yearFolder = budget({
    id: 100,
    name: "2026",
    period: "yearly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    isFolder: true,
  });
  const january = budget({
    id: 101,
    name: "January",
    parentId: 100,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });
  const february = budget({
    id: 102,
    name: "February",
    parentId: 100,
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  });

  const budgets = [yearFolder, january, february];
  const routedId = findRoutedMonthBudgetId(january.id, "2026-02-18", budgets);

  assert.equal(routedId, february.id);
});

test("recurring generation expands dates across month boundaries", () => {
  const dates = generateRecurringDates("2026-01-01", "monthly", { endDate: "2026-04-01" });
  assert.deepEqual(dates, ["2026-02-01", "2026-03-01", "2026-04-01"]);
});

test("recurring generation supports amount-only cap", () => {
  const maxOccurrences = getRecurringChildLimit(50, 200);
  const dates = generateRecurringDates("2026-01-01", "monthly", {
    maxOccurrences,
  });
  assert.deepEqual(dates, ["2026-02-01", "2026-03-01", "2026-04-01"]);
});

test("recurring generation stops at whichever comes first (date vs amount)", () => {
  const maxOccurrences = getRecurringChildLimit(40, 400);
  const dates = generateRecurringDates("2026-01-01", "monthly", {
    endDate: "2026-03-01",
    maxOccurrences,
  });
  assert.deepEqual(dates, ["2026-02-01", "2026-03-01"]);
});
