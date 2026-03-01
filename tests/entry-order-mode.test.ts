import assert from "node:assert/strict";
import test from "node:test";
import type { Entry } from "@shared/schema";
import { orderEntriesForTimeline } from "../client/src/lib/entry-order";

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

test("entry ordering: auto_date sorts by date with stable tie-breakers", () => {
  const unordered = [
    entry({ id: 10, date: "2026-03-05", sortOrder: 2 }),
    entry({ id: 11, date: "2026-01-01", sortOrder: 1 }),
    entry({ id: 12, date: "2026-03-05", sortOrder: 0 }),
    entry({ id: 13, date: "2026-03-05", sortOrder: 0 }),
  ];

  const ordered = orderEntriesForTimeline(unordered, "auto_date");
  assert.deepEqual(ordered.map((item) => item.id), [11, 12, 13, 10]);
});

test("entry ordering: manual preserves input order", () => {
  const manual = [
    entry({ id: 20, date: "2026-02-01" }),
    entry({ id: 21, date: "2026-01-01" }),
    entry({ id: 22, date: "2026-03-01" }),
  ];

  const ordered = orderEntriesForTimeline(manual, "manual");
  assert.deepEqual(ordered.map((item) => item.id), [20, 21, 22]);
});
