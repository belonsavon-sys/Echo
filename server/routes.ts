import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBudgetSchema, insertCategorySchema, insertTagSchema, insertEntrySchema, insertSavingsGoalSchema } from "@shared/schema";
import { addDays, addWeeks, addMonths, addYears, endOfYear, isBefore, parseISO, format } from "date-fns";

function generateRecurringDates(startDate: string, frequency: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  current = getNextDate(current, frequency);

  while (isBefore(current, end) || format(current, "yyyy-MM-dd") === endDate) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = getNextDate(current, frequency);
  }

  return dates;
}

function getNextDate(date: Date, frequency: string): Date {
  switch (frequency) {
    case "daily": return addDays(date, 1);
    case "weekly": return addWeeks(date, 1);
    case "biweekly": return addWeeks(date, 2);
    case "monthly": return addMonths(date, 1);
    case "yearly": return addYears(date, 1);
    default: return addMonths(date, 1);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/budgets", async (_req, res) => {
    const data = await storage.getBudgets();
    res.json(data);
  });

  app.get("/api/budgets/:id", async (req, res) => {
    const budget = await storage.getBudget(Number(req.params.id));
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.post("/api/budgets", async (req, res) => {
    const parsed = insertBudgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const budget = await storage.createBudget(parsed.data);
    res.status(201).json(budget);
  });

  app.patch("/api/budgets/:id", async (req, res) => {
    const parsed = insertBudgetSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const budget = await storage.updateBudget(Number(req.params.id), parsed.data);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    await storage.deleteBudget(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/budgets/:id/rollover", async (req, res) => {
    const budget = await storage.getBudget(Number(req.params.id));
    if (!budget) return res.status(404).json({ message: "Budget not found" });

    const entries = await storage.getEntries(budget.id);
    const totalIncome = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const totalExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const surplus = totalIncome - totalExpenses;

    const { targetBudgetId } = req.body;
    if (!targetBudgetId) return res.status(400).json({ message: "targetBudgetId required" });

    const targetBudget = await storage.getBudget(targetBudgetId);
    if (!targetBudget) return res.status(404).json({ message: "Target budget not found" });

    await storage.updateBudget(targetBudgetId, {
      rolloverAmount: (targetBudget.rolloverAmount || 0) + surplus,
      rolloverEnabled: true,
    });

    if (surplus !== 0) {
      await storage.createEntry({
        budgetId: targetBudgetId,
        type: surplus > 0 ? "income" : "expense",
        name: `Rollover from ${budget.name}`,
        amount: Math.abs(surplus),
        note: `Carried over balance from "${budget.name}"`,
        date: format(new Date(), "yyyy-MM-dd"),
        isPaidOrReceived: true,
        isStarred: false,
        sortOrder: 0,
        isRecurring: false,
        recurringFrequency: null,
        recurringEndDate: null,
        recurringParentId: null,
        categoryId: null,
        tagIds: null,
      });
    }

    res.json({ message: "Rollover complete", amount: surplus });
  });

  app.get("/api/budgets/:budgetId/categories", async (req, res) => {
    const data = await storage.getCategories(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/categories", async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const category = await storage.createCategory(parsed.data);
    res.status(201).json(category);
  });

  app.patch("/api/categories/:id", async (req, res) => {
    const parsed = insertCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const category = await storage.updateCategory(Number(req.params.id), parsed.data);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.delete("/api/categories/:id", async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tags", async (_req, res) => {
    const data = await storage.getTags();
    res.json(data);
  });

  app.post("/api/tags", async (req, res) => {
    const parsed = insertTagSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.createTag(parsed.data);
    res.status(201).json(tag);
  });

  app.patch("/api/tags/:id", async (req, res) => {
    const parsed = insertTagSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.updateTag(Number(req.params.id), parsed.data);
    if (!tag) return res.status(404).json({ message: "Tag not found" });
    res.json(tag);
  });

  app.delete("/api/tags/:id", async (req, res) => {
    await storage.deleteTag(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/budgets/:budgetId/entries", async (req, res) => {
    const data = await storage.getEntries(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/entries", async (req, res) => {
    const parsed = insertEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const entry = await storage.createEntry(parsed.data);

    await storage.createHistory({
      entryId: entry.id,
      budgetId: entry.budgetId,
      action: "created",
      previousData: null,
      newData: JSON.stringify(entry),
    });

    if (entry.isRecurring && entry.recurringFrequency) {
      const endDate = entry.recurringEndDate || format(endOfYear(new Date()), "yyyy-MM-dd");
      const dates = generateRecurringDates(entry.date, entry.recurringFrequency, endDate);

      for (const d of dates) {
        await storage.createEntry({
          ...parsed.data,
          date: d,
          isRecurring: false,
          recurringParentId: entry.id,
          recurringFrequency: null,
          recurringEndDate: null,
        });
      }
    }

    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", async (req, res) => {
    const existing = await storage.getEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Entry not found" });

    const parsed = insertEntrySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const updated = await storage.updateEntry(Number(req.params.id), parsed.data);

    await storage.createHistory({
      entryId: existing.id,
      budgetId: existing.budgetId,
      action: "updated",
      previousData: JSON.stringify(existing),
      newData: JSON.stringify(updated),
    });

    res.json(updated);
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const existing = await storage.getEntry(Number(req.params.id));
    if (existing) {
      await storage.createHistory({
        entryId: existing.id,
        budgetId: existing.budgetId,
        action: "deleted",
        previousData: JSON.stringify(existing),
        newData: null,
      });
    }
    await storage.deleteEntry(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/history/:id/undo", async (req, res) => {
    const historyId = Number(req.params.id);
    const allBudgets = await storage.getBudgets();
    let targetRecord = null;

    for (const budget of allBudgets) {
      const records = await storage.getHistory(budget.id);
      const found = records.find(r => r.id === historyId);
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

  app.get("/api/budgets/:budgetId/history", async (req, res) => {
    const data = await storage.getHistory(Number(req.params.budgetId));
    res.json(data);
  });

  app.get("/api/savings-goals", async (req, res) => {
    const budgetId = req.query.budgetId ? Number(req.query.budgetId) : undefined;
    const data = await storage.getSavingsGoals(budgetId);
    res.json(data);
  });

  app.post("/api/savings-goals", async (req, res) => {
    const parsed = insertSavingsGoalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.createSavingsGoal(parsed.data);
    res.status(201).json(goal);
  });

  app.patch("/api/savings-goals/:id", async (req, res) => {
    const parsed = insertSavingsGoalSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.updateSavingsGoal(Number(req.params.id), parsed.data);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  });

  app.delete("/api/savings-goals/:id", async (req, res) => {
    await storage.deleteSavingsGoal(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
