import type { Express, RequestHandler } from "express";
import { insertBudgetSchema, insertCategorySchema, insertTagSchema } from "@shared/schema";
import type { IStorage } from "../storage";
import { getAuthenticatedUserId } from "../auth/request";
import {
  ensureDefaultCategoriesForBudget,
  ensureYearFolderMonths,
  isYearFolder,
  migrateYearEntriesIntoMonths,
  verifyBudgetOwnership,
  getYearFromFolderName,
} from "../lib/budget-service";
import { computeBudgetBalanceContext } from "../lib/budget-balance";
import { format } from "date-fns";

type BudgetRouteDeps = {
  isAuthenticated: RequestHandler;
  storage: IStorage;
};

export function registerBudgetRoutes(app: Express, deps: BudgetRouteDeps): void {
  const { isAuthenticated, storage } = deps;

  function isValidEntryOrderMode(value: unknown): value is "auto_date" | "manual" {
    return value === "auto_date" || value === "manual";
  }

  app.get("/api/budgets", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const data = await storage.getBudgets(userId);
    res.json(data);
  });

  app.get("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const budget = await storage.getBudget(Number(req.params.id), userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.get("/api/budgets/:id/balance-context", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const context = await computeBudgetBalanceContext(storage, Number(req.params.id), userId);
    if (!context) return res.status(404).json({ message: "Budget not found" });
    res.json(context);
  });

  app.post("/api/budgets", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertBudgetSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (
      parsed.data.entryOrderMode !== undefined &&
      !isValidEntryOrderMode(parsed.data.entryOrderMode)
    ) {
      return res.status(400).json({ message: "entryOrderMode must be 'auto_date' or 'manual'" });
    }

    const {
      openingBalanceMode: _ignoredOpeningBalanceMode,
      entryOrderMode,
      ...createData
    } = parsed.data;

    let budget = await storage.createBudget({
      ...createData,
      openingBalanceMode: "manual",
      entryOrderMode: entryOrderMode ?? "auto_date",
    });
    if (isYearFolder(budget)) {
      const year = getYearFromFolderName(budget.name)!;
      const normalized = await storage.updateBudget(
        budget.id,
        {
          period: "yearly",
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        },
        userId,
      );
      if (normalized) budget = normalized;
      await ensureYearFolderMonths(storage, budget, userId);
    } else {
      await ensureDefaultCategoriesForBudget(storage, budget);
    }
    res.status(201).json(budget);
  });

  app.patch("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertBudgetSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (
      parsed.data.entryOrderMode !== undefined &&
      !isValidEntryOrderMode(parsed.data.entryOrderMode)
    ) {
      return res.status(400).json({ message: "entryOrderMode must be 'auto_date' or 'manual'" });
    }

    const { openingBalanceMode: _ignoredOpeningBalanceMode, ...patchData } = parsed.data;
    const budget = await storage.updateBudget(Number(req.params.id), patchData, userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  });

  app.delete("/api/budgets/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    await storage.deleteBudget(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.post("/api/budgets/:id/convert-to-year-folder", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const source = await storage.getBudget(Number(req.params.id), userId);
    if (!source) return res.status(404).json({ message: "Budget not found" });

    const year = getYearFromFolderName(source.name);
    if (year === null) {
      return res.status(400).json({ message: "Budget name must be a 4-digit year" });
    }

    let yearFolder = source;
    const converted = await storage.updateBudget(
      source.id,
      {
        isFolder: true,
        period: "yearly",
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      },
      userId,
    );
    if (converted) yearFolder = converted;

    await ensureYearFolderMonths(storage, yearFolder, userId);
    const movedEntries = await migrateYearEntriesIntoMonths(storage, yearFolder, userId);

    res.json({
      yearFolder,
      movedEntries,
    });
  });

  app.post("/api/budgets/:id/rollover", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const budget = await storage.getBudget(Number(req.params.id), userId);
    if (!budget) return res.status(404).json({ message: "Budget not found" });

    const entries = await storage.getEntries(budget.id);
    const totalIncome = entries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = entries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const surplus = totalIncome - totalExpenses;

    const { targetBudgetId } = req.body;
    if (!targetBudgetId) return res.status(400).json({ message: "targetBudgetId required" });

    const targetBudget = await storage.getBudget(targetBudgetId, userId);
    if (!targetBudget) return res.status(404).json({ message: "Target budget not found" });

    await storage.updateBudget(
      targetBudgetId,
      {
        rolloverAmount: (targetBudget.rolloverAmount || 0) + surplus,
        rolloverEnabled: true,
      },
      userId,
    );

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
        recurringEndAmount: null,
        recurringParentId: null,
        categoryId: null,
        tagIds: null,
      });
    }

    res.json({ message: "Rollover complete", amount: surplus });
  });

  app.get("/api/budgets/:budgetId/categories", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const budgetId = Number(req.params.budgetId);
    const budget = await storage.getBudget(budgetId, userId);
    if (!budget) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await ensureDefaultCategoriesForBudget(storage, budget);
    const data = await storage.getCategories(budgetId);
    res.json(data);
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!(await verifyBudgetOwnership(storage, parsed.data.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const category = await storage.createCategory(parsed.data);
    res.status(201).json(category);
  });

  app.patch("/api/categories/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const existing = await storage.getCategory(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Category not found" });
    if (!(await verifyBudgetOwnership(storage, existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { budgetId: _ignoredBudgetId, ...safeBody } = req.body;
    const parsed = insertCategorySchema.partial().safeParse(safeBody);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const category = await storage.updateCategory(Number(req.params.id), parsed.data);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const existing = await storage.getCategory(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Category not found" });
    if (!(await verifyBudgetOwnership(storage, existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/tags", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const data = await storage.getTags(userId);
    res.json(data);
  });

  app.post("/api/tags", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertTagSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.createTag(parsed.data);
    res.status(201).json(tag);
  });

  app.patch("/api/tags/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertTagSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const tag = await storage.updateTag(Number(req.params.id), parsed.data, userId);
    if (!tag) return res.status(404).json({ message: "Tag not found" });
    res.json(tag);
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    await storage.deleteTag(Number(req.params.id), userId);
    res.status(204).send();
  });
}
