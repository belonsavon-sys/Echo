import type { Entry } from "@shared/schema";

export type EntryOrderMode = "auto_date" | "manual";

export function compareEntriesByDateThenStable(left: Entry, right: Entry): number {
  const byDate = left.date.localeCompare(right.date);
  if (byDate !== 0) return byDate;

  const bySort = left.sortOrder - right.sortOrder;
  if (bySort !== 0) return bySort;

  return left.id - right.id;
}

export function orderEntriesForTimeline(
  entries: Entry[],
  mode: EntryOrderMode,
): Entry[] {
  const next = [...entries];
  if (mode === "manual") return next;
  next.sort(compareEntriesByDateThenStable);
  return next;
}
