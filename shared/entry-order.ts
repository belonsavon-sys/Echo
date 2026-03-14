export type EntryOrderMode = "auto_date" | "manual";

export type DateSortableEntry = {
  id: number;
  date: string;
  sortOrder: number;
};

export function compareEntriesByDateThenStable<T extends DateSortableEntry>(
  left: T,
  right: T,
): number {
  const byDate = left.date.localeCompare(right.date);
  if (byDate !== 0) return byDate;

  const bySort = left.sortOrder - right.sortOrder;
  if (bySort !== 0) return bySort;

  return left.id - right.id;
}

export function orderEntriesForTimeline<T extends DateSortableEntry>(
  entries: readonly T[],
  mode: EntryOrderMode,
): T[] {
  const next = [...entries];
  if (mode === "manual") return next;
  next.sort(compareEntriesByDateThenStable);
  return next;
}

export function getOrderedEntryIdsForAutoDate<T extends DateSortableEntry>(
  entries: readonly T[],
): number[] {
  return orderEntriesForTimeline(entries, "auto_date").map((entry) => entry.id);
}
