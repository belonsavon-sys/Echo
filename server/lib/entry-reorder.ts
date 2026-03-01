export function validateFullEntryOrder(
  existingEntryIds: number[],
  orderedEntryIds: number[],
): { ok: true } | { ok: false; message: string } {
  if (existingEntryIds.length !== orderedEntryIds.length) {
    return { ok: false, message: "orderedEntryIds must include every entry exactly once" };
  }

  const uniqueOrderedIds = new Set(orderedEntryIds);
  if (uniqueOrderedIds.size !== orderedEntryIds.length) {
    return { ok: false, message: "orderedEntryIds must not contain duplicates" };
  }

  const expected = new Set(existingEntryIds);
  for (const orderedId of orderedEntryIds) {
    if (!expected.has(orderedId)) {
      return { ok: false, message: "orderedEntryIds contains entries outside this budget" };
    }
  }

  return { ok: true };
}
