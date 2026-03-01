import type { Express, RequestHandler } from "express";
import { type InsertEntry, insertEntrySchema } from "@shared/schema";
import type { IStorage } from "../storage";
import { getAuthenticatedUserId } from "../auth/request";
import {
  generateRecurringDates,
  getRecurringChildLimit,
  getDefaultRecurringEndDate,
  remapCategoryToBudget,
  resolveRoutedBudgetId,
  routeEntryForCreate,
  verifyBudgetOwnership,
} from "../lib/budget-service";
import { validateFullEntryOrder } from "../lib/entry-reorder";

type EntryHistoryRouteDeps = {
  isAuthenticated: RequestHandler;
  storage: IStorage;
};

export function registerEntryHistoryRoutes(app: Express, deps: EntryHistoryRouteDeps): void {
  const { isAuthenticated, storage } = deps;

  function sanitizeRecurringFields(entry: InsertEntry): InsertEntry {
    const recurringEndAmount =
      entry.recurringEndAmount == null ? null : Number(entry.recurringEndAmount);

    if (recurringEndAmount != null && recurringEndAmount <= 0) {
      throw new Error("Recurring end amount must be greater than 0");
    }
    if (
      recurringEndAmount != null &&
      Number.isFinite(entry.amount) &&
      entry.amount > 0 &&
      recurringEndAmount < entry.amount
    ) {
      throw new Error("Recurring end amount must be at least one entry amount");
    }

    if (!entry.isRecurring) {
      return {
        ...entry,
        recurringFrequency: null,
        recurringEndDate: null,
        recurringEndAmount: null,
      };
    }

    return {
      ...entry,
      recurringEndAmount,
    };
  }

  app.get("/api/budgets/:budgetId/entries", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!(await verifyBudgetOwnership(storage, Number(req.params.budgetId), userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data = await storage.getEntries(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/entries", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    let validatedEntry: InsertEntry;
    try {
      validatedEntry = sanitizeRecurringFields(parsed.data);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }

    if (!(await verifyBudgetOwnership(storage, validatedEntry.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const routedData = await routeEntryForCreate(storage, validatedEntry, userId);
    const entry = await storage.createEntry(routedData);

    await storage.createHistory({
      entryId: entry.id,
      budgetId: entry.budgetId,
      action: "created",
      previousData: null,
      newData: JSON.stringify(entry),
    });

    if (entry.isRecurring && entry.recurringFrequency) {
      const resolvedEndDate =
        entry.recurringEndDate ||
        (!entry.recurringEndAmount
          ? await getDefaultRecurringEndDate(storage, entry.budgetId, entry.date, userId)
          : undefined);
      const maxOccurrences = getRecurringChildLimit(entry.amount, entry.recurringEndAmount);
      const dates = generateRecurringDates(entry.date, entry.recurringFrequency, {
        endDate: resolvedEndDate,
        maxOccurrences,
      });

      for (const date of dates) {
        const recurringOccurrence = await routeEntryForCreate(
          storage,
          {
            budgetId: entry.budgetId,
            type: entry.type,
            name: entry.name,
            amount: entry.amount,
            note: entry.note,
            date,
            isPaidOrReceived: entry.isPaidOrReceived,
            isStarred: entry.isStarred,
            sortOrder: 0,
            isRecurring: false,
            recurringFrequency: null,
            recurringEndDate: null,
            recurringEndAmount: null,
            recurringParentId: entry.id,
            categoryId: entry.categoryId,
            tagIds: entry.tagIds,
          },
          userId,
        );
        await storage.createEntry(recurringOccurrence);
      }
    }

    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const existing = await storage.getEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Entry not found" });
    if (!(await verifyBudgetOwnership(storage, existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { budgetId: _ignoredBudgetId, ...safeEntryBody } = req.body;
    const parsed = insertEntrySchema.partial().safeParse(safeEntryBody);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const recurringEndAmount =
      parsed.data.recurringEndAmount === undefined
        ? undefined
        : parsed.data.recurringEndAmount == null
          ? null
          : Number(parsed.data.recurringEndAmount);
    if (recurringEndAmount !== undefined && recurringEndAmount !== null && recurringEndAmount <= 0) {
      return res.status(400).json({ message: "Recurring end amount must be greater than 0" });
    }

    const effectiveDate = parsed.data.date ?? existing.date;
    const routedBudgetId = await resolveRoutedBudgetId(
      storage,
      existing.budgetId,
      effectiveDate,
      userId,
    );
    const updateData: Partial<InsertEntry> = { ...parsed.data };
    if (recurringEndAmount !== undefined) {
      updateData.recurringEndAmount = recurringEndAmount;
    }

    if (routedBudgetId !== existing.budgetId) {
      const targetEntries = await storage.getEntries(routedBudgetId);
      updateData.budgetId = routedBudgetId;
      updateData.sortOrder = targetEntries.length;
    }

    const sourceCategoryId =
      parsed.data.categoryId !== undefined
        ? parsed.data.categoryId
        : routedBudgetId !== existing.budgetId
          ? existing.categoryId
          : undefined;

    if (sourceCategoryId !== undefined) {
      updateData.categoryId = await remapCategoryToBudget(
        storage,
        sourceCategoryId,
        routedBudgetId,
      );
    }

    const nextAmount = parsed.data.amount ?? existing.amount;
    const nextRecurringEndAmount =
      updateData.recurringEndAmount !== undefined
        ? updateData.recurringEndAmount
        : existing.recurringEndAmount;
    if (
      nextRecurringEndAmount != null &&
      Number.isFinite(nextAmount) &&
      nextAmount > 0 &&
      nextRecurringEndAmount < nextAmount
    ) {
      return res.status(400).json({
        message: "Recurring end amount must be at least one entry amount",
      });
    }

    const nextIsRecurring = parsed.data.isRecurring ?? existing.isRecurring;
    if (!nextIsRecurring) {
      updateData.recurringFrequency = null;
      updateData.recurringEndDate = null;
      updateData.recurringEndAmount = null;
    }

    const updated = await storage.updateEntry(Number(req.params.id), updateData);

    await storage.createHistory({
      entryId: existing.id,
      budgetId: updated?.budgetId ?? existing.budgetId,
      action: "updated",
      previousData: JSON.stringify(existing),
      newData: JSON.stringify(updated),
    });

    res.json(updated);
  });

  app.delete("/api/entries/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const existing = await storage.getEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Entry not found" });
    if (!(await verifyBudgetOwnership(storage, existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.createHistory({
      entryId: existing.id,
      budgetId: existing.budgetId,
      action: "deleted",
      previousData: JSON.stringify(existing),
      newData: null,
    });
    await storage.deleteEntry(Number(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/budgets/:budgetId/entries/reorder", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const budgetId = Number(req.params.budgetId);
    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      return res.status(400).json({ message: "Invalid budget id" });
    }

    if (!(await verifyBudgetOwnership(storage, budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const orderedEntryIdsRaw = Array.isArray(req.body?.orderedEntryIds)
      ? (req.body.orderedEntryIds as unknown[])
      : null;
    if (!orderedEntryIdsRaw) {
      return res.status(400).json({ message: "orderedEntryIds is required" });
    }

    const orderedEntryIds = orderedEntryIdsRaw
      .map((id: unknown) => (typeof id === "number" ? id : Number(id)))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (orderedEntryIds.length !== orderedEntryIdsRaw.length) {
      return res.status(400).json({ message: "orderedEntryIds must contain positive integers" });
    }
    const existingEntries = await storage.getEntries(budgetId);
    const existingIds = existingEntries.map((entry) => entry.id);
    const validation = validateFullEntryOrder(existingIds, orderedEntryIds);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const budget = await storage.getBudget(budgetId, userId);
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    if (budget.entryOrderMode !== "manual") {
      await storage.updateBudget(budgetId, { entryOrderMode: "manual" }, userId);
    }

    await storage.reorderEntriesInBudget(budgetId, orderedEntryIds);
    const reordered = await storage.getEntries(budgetId);
    res.json(reordered);
  });

  app.post("/api/history/:id/undo", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const historyId = Number(req.params.id);
    const allBudgets = await storage.getBudgets(userId);
    let targetRecord = null;

    for (const budget of allBudgets) {
      const records = await storage.getHistory(budget.id);
      const found = records.find((record) => record.id === historyId);
      if (found) {
        targetRecord = found;
        break;
      }
    }

    if (!targetRecord) return res.status(404).json({ message: "History record not found" });

    if (targetRecord.action === "deleted" && targetRecord.previousData) {
      const prevData = JSON.parse(targetRecord.previousData);
      const { id, ...rest } = prevData;
      const restored = await storage.createEntry(rest);
      await storage.createHistory({
        entryId: restored.id,
        budgetId: restored.budgetId,
        action: "restored",
        previousData: null,
        newData: JSON.stringify(restored),
      });
      return res.json(restored);
    }

    if (targetRecord.action === "updated" && targetRecord.previousData) {
      const prevData = JSON.parse(targetRecord.previousData);
      const { id, ...rest } = prevData;
      const restored = await storage.updateEntry(targetRecord.entryId, rest);
      if (restored) {
        await storage.createHistory({
          entryId: restored.id,
          budgetId: restored.budgetId,
          action: "reverted",
          previousData: targetRecord.newData,
          newData: JSON.stringify(restored),
        });
      }
      return res.json(restored);
    }

    res.status(400).json({ message: "Cannot undo this action" });
  });

  app.get("/api/budgets/:budgetId/history", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!(await verifyBudgetOwnership(storage, Number(req.params.budgetId), userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data = await storage.getHistory(Number(req.params.budgetId));
    res.json(data);
  });
}
