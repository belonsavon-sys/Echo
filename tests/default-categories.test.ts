import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultBudgetCategories } from "../server/lib/budget-service";

test("default budget categories exclude Income for new budgets", () => {
  const names = getDefaultBudgetCategories().map((category) => category.name);
  assert.equal(names.includes("Income"), false);
  assert.deepEqual(names, [
    "Shopping",
    "Credit",
    "Subscriptions",
    "Debt",
    "Investing",
    "Food",
    "Bill",
    "Other",
  ]);
});
