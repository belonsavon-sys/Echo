import assert from "node:assert/strict";
import test from "node:test";
import { validateFullEntryOrder } from "../server/lib/entry-reorder";

test("entry reorder validation passes for exact ID set", () => {
  const result = validateFullEntryOrder([11, 12, 13], [13, 11, 12]);
  assert.deepEqual(result, { ok: true });
});

test("entry reorder validation rejects missing IDs", () => {
  const result = validateFullEntryOrder([11, 12, 13], [13, 11]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /include every entry exactly once/);
  }
});

test("entry reorder validation rejects duplicate IDs", () => {
  const result = validateFullEntryOrder([11, 12, 13], [11, 12, 12]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /must not contain duplicates/);
  }
});

test("entry reorder validation rejects cross-budget IDs", () => {
  const result = validateFullEntryOrder([11, 12, 13], [11, 12, 99]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /outside this budget/);
  }
});
