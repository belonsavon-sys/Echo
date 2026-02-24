import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBudgetSchema, insertCategorySchema, insertTagSchema, insertEntrySchema, insertSavingsGoalSchema, insertFavoriteSchema, insertNetWorthAccountSchema } from "@shared/schema";
import { addDays, addWeeks, addMonths, addYears, endOfYear, isBefore, parseISO, format } from "date-fns";
import { isAuthenticated } from "./replit_integrations/auth";

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

  app.get("/api/budgets", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const data = await storage.getBudgets(userId);
    res.json(data);
  });

  app.get("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const budget = await storage.getBudget(Number(req.params.id), userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.post("/api/budgets", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertBudgetSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const budget = await storage.createBudget(parsed.data);
    res.status(201).json(budget);
  });

  app.patch("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertBudgetSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const budget = await storage.updateBudget(Number(req.params.id), parsed.data, userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.delete("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteBudget(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.post("/api/budgets/:id/rollover", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const budget = await storage.getBudget(Number(req.params.id), userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });

    const entries = await storage.getEntries(budget.id);
    const totalIncome = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const totalExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const surplus = totalIncome - totalExpenses;

    const { targetBudgetId } = req.body;
    if (!targetBudgetId) return res.status(400).json({ message: "targetBudgetId required" });

    const targetBudget = await storage.getBudget(targetBudgetId, userId);
    if (!targetBudget) return res.status(404).json({ message: "Target budget not found" });

    await storage.updateBudget(targetBudgetId, {
      rolloverAmount: (targetBudget.rolloverAmount || 0) + surplus,
      rolloverEnabled: true,
    }, userId);

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

  app.get("/api/budgets/:budgetId/categories", isAuthenticated, async (req, res) => {
    const data = await storage.getCategories(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const category = await storage.createCategory(parsed.data);
    res.status(201).json(category);
  });

  app.patch("/api/categories/:id", isAuthenticated, async (req, res) => {
    const parsed = insertCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const category = await storage.updateCategory(Number(req.params.id), parsed.data);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tags", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const data = await storage.getTags(userId);
    res.json(data);
  });

  app.post("/api/tags", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertTagSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.createTag(parsed.data);
    res.status(201).json(tag);
  });

  app.patch("/api/tags/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertTagSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.updateTag(Number(req.params.id), parsed.data, userId);
    if (!tag) return res.status(404).json({ message: "Tag not found" });
    res.json(tag);
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteTag(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/budgets/:budgetId/entries", isAuthenticated, async (req, res) => {
    const data = await storage.getEntries(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/entries", isAuthenticated, async (req, res) => {
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

  app.patch("/api/entries/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/entries/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/history/:id/undo", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const historyId = Number(req.params.id);
    const allBudgets = await storage.getBudgets(userId);
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

  app.get("/api/budgets/:budgetId/history", isAuthenticated, async (req, res) => {
    const data = await storage.getHistory(Number(req.params.budgetId));
    res.json(data);
  });

  app.get("/api/savings-goals", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const budgetId = req.query.budgetId ? Number(req.query.budgetId) : undefined;
    const data = await storage.getSavingsGoals(budgetId, userId);
    res.json(data);
  });

  app.post("/api/savings-goals", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertSavingsGoalSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.createSavingsGoal(parsed.data);
    res.status(201).json(goal);
  });

  app.patch("/api/savings-goals/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertSavingsGoalSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.updateSavingsGoal(Number(req.params.id), parsed.data, userId);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  });

  app.delete("/api/savings-goals/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteSavingsGoal(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/favorites", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const data = await storage.getFavorites(userId);
    res.json(data);
  });

  app.post("/api/favorites", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertFavoriteSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const favorite = await storage.createFavorite(parsed.data);
    res.status(201).json(favorite);
  });

  app.patch("/api/favorites/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertFavoriteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const favorite = await storage.updateFavorite(Number(req.params.id), parsed.data, userId);
    if (!favorite) return res.status(404).json({ message: "Favorite not found" });
    res.json(favorite);
  });

  app.delete("/api/favorites/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteFavorite(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/net-worth-accounts", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const data = await storage.getNetWorthAccounts(userId);
    res.json(data);
  });

  app.post("/api/net-worth-accounts", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertNetWorthAccountSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.createNetWorthAccount(parsed.data);
    res.status(201).json(account);
  });

  app.patch("/api/net-worth-accounts/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertNetWorthAccountSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.updateNetWorthAccount(Number(req.params.id), parsed.data, userId);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(account);
  });

  app.delete("/api/net-worth-accounts/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteNetWorthAccount(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.post("/api/budgets/:id/clone", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const { name, parentId } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }
    try {
      const cloned = await storage.cloneBudget(Number(req.params.id), name, parentId, userId);
      res.status(201).json(cloned);
    } catch (err: any) {
      res.status(404).json({ message: err.message });
    }
  });

  return httpServer;
}
