import assert from "node:assert/strict";
import test from "node:test";
import { storage } from "../server/storage";

test("storage rejects empty user id for budget and tag queries", async () => {
  await assert.rejects(() => storage.getBudgets(""), /Missing authenticated user id/);
  await assert.rejects(() => storage.getBudget(1, "   "), /Missing authenticated user id/);
  await assert.rejects(() => storage.getTags(""), /Missing authenticated user id/);
});

test("storage rejects empty user id for user-owned feature routes", async () => {
  await assert.rejects(() => storage.getSavingsGoals("", 1), /Missing authenticated user id/);
  await assert.rejects(() => storage.getFavorites(""), /Missing authenticated user id/);
  await assert.rejects(() => storage.getNetWorthAccounts(""), /Missing authenticated user id/);
});

test("storage clone fails closed when user id is missing", async () => {
  await assert.rejects(
    () => storage.cloneBudget(1, "Clone", undefined, ""),
    /Missing authenticated user id/,
  );
});
