import { getOrderedEntryIdsForAutoDate } from "@shared/entry-order";
import type { Entry } from "@shared/schema";
import type { IStorage } from "../storage";

type EntryOrderSyncStorage = Pick<IStorage, "getBudget" | "getEntries" | "reorderEntriesInBudget">;

function needsReorder(entries: Entry[], orderedIds: number[]): boolean {
  if (entries.length !== orderedIds.length) return false;
  return entries.some((entry, index) => entry.id !== orderedIds[index] || entry.sortOrder !== index);
}

export async function syncAutoDateEntryOrder(
  storage: EntryOrderSyncStorage,
  budgetId: number,
  userId: string,
): Promise<void> {
  const budget = await storage.getBudget(budgetId, userId);
  if (!budget || budget.isFolder || budget.entryOrderMode !== "auto_date") {
    return;
  }

  const entries = await storage.getEntries(budgetId);
  if (entries.length <= 1) return;

  const orderedIds = getOrderedEntryIdsForAutoDate(entries);
  if (!needsReorder(entries, orderedIds)) return;

  await storage.reorderEntriesInBudget(budgetId, orderedIds);
}

export async function syncAutoDateEntryOrderForBudgets(
  storage: EntryOrderSyncStorage,
  budgetIds: readonly number[],
  userId: string,
): Promise<void> {
  const uniqueBudgetIds = Array.from(
    new Set(
      budgetIds.filter((budgetId) => Number.isInteger(budgetId) && budgetId > 0),
    ),
  );

  for (const budgetId of uniqueBudgetIds) {
    await syncAutoDateEntryOrder(storage, budgetId, userId);
  }
}
