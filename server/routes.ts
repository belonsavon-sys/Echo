import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  type Budget,
  type Category,
  type DashboardWatchlist,
  type Entry,
  type InsertBudget,
  type InsertEntry,
  type DashboardPreferences,
  type NavigationPreferences,
  insertBudgetSchema,
  insertCategorySchema,
  insertEntrySchema,
  insertFavoriteSchema,
  insertNetWorthAccountSchema,
  insertSavingsGoalSchema,
  insertTagSchema,
} from "@shared/schema";
import { addDays, addMonths, addWeeks, addYears, endOfMonth, endOfYear, format, getMonth, getYear, isBefore, isValid, parseISO, startOfMonth } from "date-fns";
import { isAuthenticated } from "./replit_integrations/auth";

const YEAR_FOLDER_PATTERN = /^\d{4}$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DEFAULT_BUDGET_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: "Shopping", color: "#f97316" },
  { name: "Credit", color: "#ef4444" },
  { name: "Income", color: "#10b981" },
  { name: "Subscriptions", color: "#6366f1" },
  { name: "Debt", color: "#b91c1c" },
  { name: "Investing", color: "#059669" },
  { name: "Food", color: "#f59e0b" },
  { name: "Bill", color: "#2563eb" },
  { name: "Other", color: "#6b7280" },
];

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

async function verifyBudgetOwnership(budgetId: number, userId: string): Promise<boolean> {
  const budget = await storage.getBudget(budgetId, userId);
  return !!budget;
}

function getYearFromFolderName(name: string): number | null {
  if (!YEAR_FOLDER_PATTERN.test(name)) return null;
  const year = Number(name);
  return Number.isInteger(year) ? year : null;
}

function isYearFolder(budget: Budget | null | undefined): boolean {
  if (!budget || !budget.isFolder) return false;
  return getYearFromFolderName(budget.name) !== null;
}

function getMonthBoundaries(year: number, monthIndex: number): { startDate: string; endDate: string } {
  const monthDate = new Date(year, monthIndex, 1);
  return {
    startDate: format(startOfMonth(monthDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(monthDate), "yyyy-MM-dd"),
  };
}

async function ensureDefaultCategoriesForBudget(budget: Budget): Promise<void> {
  if (budget.isFolder) return;

  const existing = await storage.getCategories(budget.id);
  const existingByName = new Set(
    existing.map((category) => category.name.trim().toLowerCase()),
  );
  let nextSortOrder = existing.reduce(
    (maxSortOrder, category) => Math.max(maxSortOrder, category.sortOrder),
    -1,
  ) + 1;

  for (const template of DEFAULT_BUDGET_CATEGORIES) {
    const normalized = template.name.trim().toLowerCase();
    if (existingByName.has(normalized)) continue;
    await storage.createCategory({
      budgetId: budget.id,
      name: template.name,
      color: template.color,
      icon: null,
      budgetLimit: null,
      sortOrder: nextSortOrder,
    });
    existingByName.add(normalized);
    nextSortOrder += 1;
  }
}

async function ensureYearFolderMonths(yearFolder: Budget, userId: string): Promise<Budget[]> {
  const year = getYearFromFolderName(yearFolder.name);
  if (year === null) return [];

  const allBudgets = await storage.getBudgets(userId);
  const childBudgets = allBudgets.filter((b) => b.parentId === yearFolder.id && !b.isFolder);
  const months: Budget[] = [];

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const monthName = MONTH_NAMES[i];
    const { startDate, endDate } = getMonthBoundaries(year, i);
    const existing = childBudgets.find(
      (b) =>
        b.startDate === startDate ||
        b.name.trim().toLowerCase() === monthName.toLowerCase(),
    );

    if (!existing) {
      const created = await storage.createBudget({
        name: monthName,
        description: null,
        period: "monthly",
        startDate,
        endDate,
        isActive: true,
        sortOrder: i,
        rolloverEnabled: false,
        rolloverAmount: 0,
        parentId: yearFolder.id,
        isFolder: false,
        currency: yearFolder.currency || "USD",
        userId,
      });
      await ensureDefaultCategoriesForBudget(created);
      months.push(created);
      childBudgets.push(created);
      continue;
    }

    const patch: Partial<InsertBudget> = {};
    if (existing.name !== monthName) patch.name = monthName;
    if (existing.startDate !== startDate) patch.startDate = startDate;
    if (existing.endDate !== endDate) patch.endDate = endDate;
    if (existing.period !== "monthly") patch.period = "monthly";
    if (existing.sortOrder !== i) patch.sortOrder = i;

    if (Object.keys(patch).length > 0) {
      const updated = await storage.updateBudget(existing.id, patch, userId);
      const resolved = updated ?? existing;
      await ensureDefaultCategoriesForBudget(resolved);
      months.push(resolved);
    } else {
      await ensureDefaultCategoriesForBudget(existing);
      months.push(existing);
    }
  }

  return months.sort((a, b) => a.sortOrder - b.sortOrder);
}

async function resolveYearFolderContext(budget: Budget, userId: string): Promise<Budget | null> {
  if (isYearFolder(budget)) return budget;

  let current: Budget | undefined = budget;
  const visited = new Set<number>();
  while (current && current.parentId != null) {
    const parentId = current.parentId;
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = await storage.getBudget(parentId, userId);
    if (!parent) break;
    if (isYearFolder(parent)) return parent;
    current = parent;
  }

  return null;
}

async function findOrCreateMonthBudgetForDate(
  yearFolder: Budget,
  dateStr: string,
  userId: string,
): Promise<Budget | null> {
  const parsedDate = parseISO(dateStr);
  if (!isValid(parsedDate)) return null;

  const year = getYearFromFolderName(yearFolder.name);
  if (year === null || getYear(parsedDate) !== year) return null;

  const months = await ensureYearFolderMonths(yearFolder, userId);
  return months[getMonth(parsedDate)] || null;
}

async function remapCategoryToBudget(
  categoryId: number | null | undefined,
  targetBudgetId: number,
): Promise<number | null> {
  if (categoryId == null) return null;

  const sourceCategory = await storage.getCategory(categoryId);
  if (!sourceCategory) return null;
  if (sourceCategory.budgetId === targetBudgetId) return sourceCategory.id;

  const targetCategories = await storage.getCategories(targetBudgetId);
  const byName = targetCategories.find(
    (c) => c.name.trim().toLowerCase() === sourceCategory.name.trim().toLowerCase(),
  );
  if (byName) return byName.id;

  const created = await storage.createCategory({
    budgetId: targetBudgetId,
    name: sourceCategory.name,
    color: sourceCategory.color,
    icon: sourceCategory.icon,
    budgetLimit: sourceCategory.budgetLimit,
    sortOrder: targetCategories.length,
  });
  return created.id;
}

async function resolveRoutedBudgetId(sourceBudgetId: number, dateStr: string, userId: string): Promise<number> {
  const sourceBudget = await storage.getBudget(sourceBudgetId, userId);
  if (!sourceBudget) return sourceBudgetId;

  const yearFolder = await resolveYearFolderContext(sourceBudget, userId);
  if (!yearFolder) return sourceBudgetId;

  const monthBudget = await findOrCreateMonthBudgetForDate(yearFolder, dateStr, userId);
  return monthBudget?.id ?? sourceBudgetId;
}

async function routeEntryForCreate(entry: InsertEntry, userId: string): Promise<InsertEntry> {
  const routedBudgetId = await resolveRoutedBudgetId(entry.budgetId, entry.date, userId);
  const targetEntries = await storage.getEntries(routedBudgetId);
  const remappedCategoryId = await remapCategoryToBudget(entry.categoryId, routedBudgetId);

  return {
    ...entry,
    budgetId: routedBudgetId,
    categoryId: remappedCategoryId,
    sortOrder: targetEntries.length,
  };
}

async function getDefaultRecurringEndDate(sourceBudgetId: number, startDate: string, userId: string): Promise<string> {
  const sourceBudget = await storage.getBudget(sourceBudgetId, userId);
  if (sourceBudget) {
    const yearFolder = await resolveYearFolderContext(sourceBudget, userId);
    const folderYear = getYearFromFolderName(yearFolder?.name || "");
    if (folderYear !== null) {
      return `${folderYear}-12-31`;
    }
  }

  const parsedStart = parseISO(startDate);
  if (isValid(parsedStart)) {
    return format(endOfYear(parsedStart), "yyyy-MM-dd");
  }
  return format(endOfYear(new Date()), "yyyy-MM-dd");
}

async function migrateYearEntriesIntoMonths(yearFolder: Budget, userId: string): Promise<number> {
  const folderYear = getYearFromFolderName(yearFolder.name);
  if (folderYear === null) return 0;

  await ensureYearFolderMonths(yearFolder, userId);
  const directEntries = await storage.getEntries(yearFolder.id);
  let movedCount = 0;

  for (const entry of directEntries) {
    const parsedDate = parseISO(entry.date);
    if (!isValid(parsedDate) || getYear(parsedDate) !== folderYear) {
      continue;
    }

    const targetMonth = await findOrCreateMonthBudgetForDate(yearFolder, entry.date, userId);
    if (!targetMonth || targetMonth.id === yearFolder.id) {
      continue;
    }

    const targetEntries = await storage.getEntries(targetMonth.id);
    const remappedCategoryId = await remapCategoryToBudget(entry.categoryId, targetMonth.id);
    await storage.updateEntry(entry.id, {
      budgetId: targetMonth.id,
      categoryId: remappedCategoryId,
      sortOrder: targetEntries.length,
    });
    movedCount += 1;
  }

  return movedCount;
}

const REMOVED_FEATURE_RESPONSE = { message: "Feature removed" };
const TOOL_IDS = [
  "reports",
  "annual",
  "goals",
  "networth",
  "whatif",
  "history",
  "tags",
  "favorites",
  "compare",
];
const DASHBOARD_CARD_IDS = ["income", "expenses", "balance", "activeBudgets", "starred", "goals", "activity", "watchlists"];
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

function toUniqueStringList(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    if (allowed && !allowed.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeNavigationPreferences(value: unknown): NavigationPreferences {
  const objectValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return {
    hiddenToolIds: toUniqueStringList(objectValue.hiddenToolIds, new Set(TOOL_IDS)),
    moreExpanded: typeof objectValue.moreExpanded === "boolean" ? objectValue.moreExpanded : false,
  };
}

function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const allowedCards = new Set(DASHBOARD_CARD_IDS);
  const objectValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return {
    cardOrder: toUniqueStringList(objectValue.cardOrder, allowedCards),
    hiddenCards: toUniqueStringList(objectValue.hiddenCards, allowedCards),
  };
}

async function getUserPreferenceState(userId: string): Promise<{
  navigation: NavigationPreferences;
  dashboard: DashboardPreferences;
}> {
  const existing = await storage.getUserPreferences(userId);
  return {
    navigation: normalizeNavigationPreferences(existing?.navigation),
    dashboard: normalizeDashboardPreferences(existing?.dashboard),
  };
}

function resolveWatchlistMonthKey(watchlist: DashboardWatchlist, requestedMonthKey?: string): string {
  if (watchlist.monthKeyScope === "fixed" && watchlist.fixedMonthKey && MONTH_KEY_PATTERN.test(watchlist.fixedMonthKey)) {
    return watchlist.fixedMonthKey;
  }
  if (requestedMonthKey && MONTH_KEY_PATTERN.test(requestedMonthKey)) {
    return requestedMonthKey;
  }
  return format(new Date(), "yyyy-MM");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseOptionalInteger(value: unknown): number | null | undefined {
  const num = parseOptionalNumber(value);
  if (num === undefined || num === null) return num;
  return Number.isInteger(num) ? num : undefined;
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
    let budget = await storage.createBudget(parsed.data);
    if (isYearFolder(budget)) {
      const year = getYearFromFolderName(budget.name)!;
      const normalized = await storage.updateBudget(budget.id, {
        period: "yearly",
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      }, userId);
      if (normalized) budget = normalized;
      await ensureYearFolderMonths(budget, userId);
    } else {
      await ensureDefaultCategoriesForBudget(budget);
    }
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

  app.post("/api/budgets/:id/convert-to-year-folder", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const source = await storage.getBudget(Number(req.params.id), userId);
    if (!source) return res.status(404).json({ message: "Budget not found" });

    const year = getYearFromFolderName(source.name);
    if (year === null) {
      return res.status(400).json({ message: "Budget name must be a 4-digit year" });
    }

    let yearFolder = source;
    const converted = await storage.updateBudget(source.id, {
      isFolder: true,
      period: "yearly",
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    }, userId);
    if (converted) yearFolder = converted;

    await ensureYearFolderMonths(yearFolder, userId);
    const movedEntries = await migrateYearEntriesIntoMonths(yearFolder, userId);

    res.json({
      yearFolder,
      movedEntries,
    });
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
    const userId = (req as any).user?.claims?.sub;
    const budgetId = Number(req.params.budgetId);
    const budget = await storage.getBudget(budgetId, userId);
    if (!budget) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await ensureDefaultCategoriesForBudget(budget);
    const data = await storage.getCategories(budgetId);
    res.json(data);
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!(await verifyBudgetOwnership(parsed.data.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const category = await storage.createCategory(parsed.data);
    res.status(201).json(category);
  });

  app.patch("/api/categories/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const existing = await storage.getCategory(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Category not found" });
    if (!(await verifyBudgetOwnership(existing.budgetId, userId))) {
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
    const userId = (req as any).user?.claims?.sub;
    const existing = await storage.getCategory(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Category not found" });
    if (!(await verifyBudgetOwnership(existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
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
    const userId = (req as any).user?.claims?.sub;
    if (!(await verifyBudgetOwnership(Number(req.params.budgetId), userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const data = await storage.getEntries(Number(req.params.budgetId));
    res.json(data);
  });

  app.post("/api/entries", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const parsed = insertEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!(await verifyBudgetOwnership(parsed.data.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const routedData = await routeEntryForCreate(parsed.data, userId);
    const entry = await storage.createEntry(routedData);

    await storage.createHistory({
      entryId: entry.id,
      budgetId: entry.budgetId,
      action: "created",
      previousData: null,
      newData: JSON.stringify(entry),
    });

    if (entry.isRecurring && entry.recurringFrequency) {
      const endDate = entry.recurringEndDate || await getDefaultRecurringEndDate(entry.budgetId, entry.date, userId);
      const dates = generateRecurringDates(entry.date, entry.recurringFrequency, endDate);

      for (const d of dates) {
        const recurringOccurrence = await routeEntryForCreate({
          budgetId: entry.budgetId,
          type: entry.type,
          name: entry.name,
          amount: entry.amount,
          note: entry.note,
          date: d,
          isPaidOrReceived: entry.isPaidOrReceived,
          isStarred: entry.isStarred,
          sortOrder: 0,
          isRecurring: false,
          recurringFrequency: null,
          recurringEndDate: null,
          recurringParentId: entry.id,
          categoryId: entry.categoryId,
          tagIds: entry.tagIds,
        }, userId);
        await storage.createEntry(recurringOccurrence);
      }
    }

    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const existing = await storage.getEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Entry not found" });
    if (!(await verifyBudgetOwnership(existing.budgetId, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { budgetId: _ignoredBudgetId, ...safeEntryBody } = req.body;
    const parsed = insertEntrySchema.partial().safeParse(safeEntryBody);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const effectiveDate = parsed.data.date ?? existing.date;
    const routedBudgetId = await resolveRoutedBudgetId(existing.budgetId, effectiveDate, userId);
    const updateData: Partial<InsertEntry> = { ...parsed.data };

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
      updateData.categoryId = await remapCategoryToBudget(sourceCategoryId, routedBudgetId);
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
    const userId = (req as any).user?.claims?.sub;
    const existing = await storage.getEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Entry not found" });
    if (!(await verifyBudgetOwnership(existing.budgetId, userId))) {
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
    const userId = (req as any).user?.claims?.sub;
    if (!(await verifyBudgetOwnership(Number(req.params.budgetId), userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
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

  app.get("/api/user-preferences/navigation", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const state = await getUserPreferenceState(userId);
    res.json(state.navigation);
  });

  app.patch("/api/user-preferences/navigation", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const payload = asObject(req.body?.navigation ?? req.body);
    if (!payload) return res.status(400).json({ message: "Invalid navigation payload" });

    const current = await getUserPreferenceState(userId);
    const next: NavigationPreferences = {
      hiddenToolIds: current.navigation.hiddenToolIds ?? [],
      moreExpanded: current.navigation.moreExpanded ?? false,
    };

    if (Object.prototype.hasOwnProperty.call(payload, "hiddenToolIds")) {
      next.hiddenToolIds = toUniqueStringList(payload.hiddenToolIds, new Set(TOOL_IDS));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "moreExpanded")) {
      if (typeof payload.moreExpanded !== "boolean") {
        return res.status(400).json({ message: "moreExpanded must be boolean" });
      }
      next.moreExpanded = payload.moreExpanded;
    }

    await storage.upsertUserPreferences(userId, { navigation: next });
    res.json(next);
  });

  app.get("/api/user-preferences/dashboard", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const state = await getUserPreferenceState(userId);
    res.json(state.dashboard);
  });

  app.patch("/api/user-preferences/dashboard", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const payload = asObject(req.body?.dashboard ?? req.body);
    if (!payload) return res.status(400).json({ message: "Invalid dashboard payload" });

    const current = await getUserPreferenceState(userId);
    const next: DashboardPreferences = {
      cardOrder: current.dashboard.cardOrder ?? [],
      hiddenCards: current.dashboard.hiddenCards ?? [],
    };
    const allowedCards = new Set(DASHBOARD_CARD_IDS);

    if (Object.prototype.hasOwnProperty.call(payload, "cardOrder")) {
      next.cardOrder = toUniqueStringList(payload.cardOrder, allowedCards);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "hiddenCards")) {
      next.hiddenCards = toUniqueStringList(payload.hiddenCards, allowedCards);
    }

    await storage.upsertUserPreferences(userId, { dashboard: next });
    res.json(next);
  });

  app.get("/api/dashboard/watchlists", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const requestedMonthKey = typeof req.query.monthKey === "string" ? req.query.monthKey : undefined;
    if (requestedMonthKey && !MONTH_KEY_PATTERN.test(requestedMonthKey)) {
      return res.status(400).json({ message: "monthKey must use YYYY-MM format" });
    }

    const budgets = (await storage.getBudgets(userId)).filter((budget) => !budget.isFolder);
    const budgetById = new Map<number, Budget>(budgets.map((budget) => [budget.id, budget]));
    const categoriesById = new Map<number, Category>();
    const entriesByBudgetId = new Map<number, Entry[]>();

    for (const budget of budgets) {
      const [categories, entries] = await Promise.all([
        storage.getCategories(budget.id),
        storage.getEntries(budget.id),
      ]);
      entriesByBudgetId.set(budget.id, entries);
      for (const category of categories) {
        categoriesById.set(category.id, category);
      }
    }

    const watchlists = await storage.getDashboardWatchlists(userId);
    const enriched = watchlists.map((watchlist) => {
      const monthKey = resolveWatchlistMonthKey(watchlist, requestedMonthKey);
      const sourceBudgetIds = watchlist.budgetId != null
        ? [watchlist.budgetId]
        : budgets.map((budget) => budget.id);
      let actualAmount = 0;

      for (const budgetId of sourceBudgetIds) {
        const entries = entriesByBudgetId.get(budgetId) ?? [];
        for (const entry of entries) {
          if (entry.type !== "expense") continue;
          if (!entry.date.startsWith(monthKey)) continue;
          if (watchlist.categoryId != null && entry.categoryId !== watchlist.categoryId) continue;
          actualAmount += entry.amount;
        }
      }

      return {
        ...watchlist,
        monthKey,
        actualAmount,
        remainingAmount: watchlist.targetAmount - actualAmount,
        progressPercent: watchlist.targetAmount > 0 ? (actualAmount / watchlist.targetAmount) * 100 : null,
        budgetName: watchlist.budgetId != null ? (budgetById.get(watchlist.budgetId)?.name ?? null) : null,
        categoryName: watchlist.categoryId != null ? (categoriesById.get(watchlist.categoryId)?.name ?? null) : null,
      };
    });

    res.json(enriched);
  });

  app.post("/api/dashboard/watchlists", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const payload = asObject(req.body);
    if (!payload) return res.status(400).json({ message: "Invalid watchlist payload" });

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) return res.status(400).json({ message: "name is required" });

    const budgetId = parseOptionalInteger(payload.budgetId);
    if (Object.prototype.hasOwnProperty.call(payload, "budgetId") && budgetId === undefined) {
      return res.status(400).json({ message: "budgetId must be an integer or null" });
    }

    const categoryId = parseOptionalInteger(payload.categoryId);
    if (Object.prototype.hasOwnProperty.call(payload, "categoryId") && categoryId === undefined) {
      return res.status(400).json({ message: "categoryId must be an integer or null" });
    }

    const targetAmount = parseOptionalNumber(payload.targetAmount);
    if (Object.prototype.hasOwnProperty.call(payload, "targetAmount") && targetAmount === undefined) {
      return res.status(400).json({ message: "targetAmount must be a number" });
    }
    if (targetAmount != null && targetAmount < 0) {
      return res.status(400).json({ message: "targetAmount must be >= 0" });
    }

    const sortOrder = parseOptionalInteger(payload.sortOrder);
    if (Object.prototype.hasOwnProperty.call(payload, "sortOrder") && sortOrder === undefined) {
      return res.status(400).json({ message: "sortOrder must be an integer" });
    }

    const monthKeyScope = payload.monthKeyScope === "fixed" ? "fixed" : "current";
    if (
      Object.prototype.hasOwnProperty.call(payload, "monthKeyScope")
      && payload.monthKeyScope !== "fixed"
      && payload.monthKeyScope !== "current"
    ) {
      return res.status(400).json({ message: "monthKeyScope must be 'current' or 'fixed'" });
    }

    const fixedMonthKey = typeof payload.fixedMonthKey === "string" ? payload.fixedMonthKey.trim() : null;
    if (fixedMonthKey && !MONTH_KEY_PATTERN.test(fixedMonthKey)) {
      return res.status(400).json({ message: "fixedMonthKey must use YYYY-MM format" });
    }
    if (monthKeyScope === "fixed" && !fixedMonthKey) {
      return res.status(400).json({ message: "fixedMonthKey is required when monthKeyScope is fixed" });
    }

    const isActive = typeof payload.isActive === "boolean" ? payload.isActive : true;

    if (budgetId != null) {
      const budget = await storage.getBudget(budgetId, userId);
      if (!budget || budget.isFolder) {
        return res.status(400).json({ message: "budgetId must point to a valid budget" });
      }
    }

    if (categoryId != null) {
      const category = await storage.getCategory(categoryId);
      if (!category) {
        return res.status(400).json({ message: "categoryId must point to an existing category" });
      }
      const categoryBudget = await storage.getBudget(category.budgetId, userId);
      if (!categoryBudget || categoryBudget.isFolder) {
        return res.status(400).json({ message: "categoryId must belong to your budget" });
      }
      if (budgetId != null && category.budgetId !== budgetId) {
        return res.status(400).json({ message: "categoryId must belong to budgetId" });
      }
    }

    const existing = await storage.getDashboardWatchlists(userId);
    const created = await storage.createDashboardWatchlist({
      userId,
      name,
      budgetId: budgetId ?? null,
      categoryId: categoryId ?? null,
      targetAmount: targetAmount ?? 0,
      monthKeyScope,
      fixedMonthKey: monthKeyScope === "fixed" ? fixedMonthKey : null,
      sortOrder: sortOrder ?? existing.length,
      isActive,
    });

    res.status(201).json(created);
  });

  app.patch("/api/dashboard/watchlists/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    const watchlistId = Number(req.params.id);
    const existing = await storage.getDashboardWatchlist(watchlistId, userId);
    if (!existing) return res.status(404).json({ message: "Watchlist not found" });

    const payload = asObject(req.body);
    if (!payload) return res.status(400).json({ message: "Invalid watchlist payload" });

    const patch: {
      name?: string;
      budgetId?: number | null;
      categoryId?: number | null;
      targetAmount?: number;
      sortOrder?: number;
      isActive?: boolean;
      monthKeyScope?: string;
      fixedMonthKey?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(payload, "name")) {
      if (typeof payload.name !== "string" || !payload.name.trim()) {
        return res.status(400).json({ message: "name must be a non-empty string" });
      }
      patch.name = payload.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, "budgetId")) {
      const parsedBudgetId = parseOptionalInteger(payload.budgetId);
      if (parsedBudgetId === undefined) {
        return res.status(400).json({ message: "budgetId must be an integer or null" });
      }
      patch.budgetId = parsedBudgetId;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "categoryId")) {
      const parsedCategoryId = parseOptionalInteger(payload.categoryId);
      if (parsedCategoryId === undefined) {
        return res.status(400).json({ message: "categoryId must be an integer or null" });
      }
      patch.categoryId = parsedCategoryId;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "targetAmount")) {
      const parsedTargetAmount = parseOptionalNumber(payload.targetAmount);
      if (parsedTargetAmount === undefined || parsedTargetAmount === null) {
        return res.status(400).json({ message: "targetAmount must be a number" });
      }
      if (parsedTargetAmount < 0) {
        return res.status(400).json({ message: "targetAmount must be >= 0" });
      }
      patch.targetAmount = parsedTargetAmount;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "sortOrder")) {
      const parsedSortOrder = parseOptionalInteger(payload.sortOrder);
      if (parsedSortOrder === undefined || parsedSortOrder === null) {
        return res.status(400).json({ message: "sortOrder must be an integer" });
      }
      patch.sortOrder = parsedSortOrder;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "isActive")) {
      if (typeof payload.isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be boolean" });
      }
      patch.isActive = payload.isActive;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "monthKeyScope")) {
      if (payload.monthKeyScope !== "current" && payload.monthKeyScope !== "fixed") {
        return res.status(400).json({ message: "monthKeyScope must be 'current' or 'fixed'" });
      }
      patch.monthKeyScope = payload.monthKeyScope;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "fixedMonthKey")) {
      if (payload.fixedMonthKey === null || payload.fixedMonthKey === "") {
        patch.fixedMonthKey = null;
      } else if (typeof payload.fixedMonthKey === "string" && MONTH_KEY_PATTERN.test(payload.fixedMonthKey)) {
        patch.fixedMonthKey = payload.fixedMonthKey;
      } else {
        return res.status(400).json({ message: "fixedMonthKey must use YYYY-MM format or null" });
      }
    }

    const finalBudgetId = Object.prototype.hasOwnProperty.call(patch, "budgetId") ? patch.budgetId ?? null : existing.budgetId;
    const finalCategoryId = Object.prototype.hasOwnProperty.call(patch, "categoryId") ? patch.categoryId ?? null : existing.categoryId;
    const finalMonthKeyScope = patch.monthKeyScope ?? existing.monthKeyScope;
    const finalFixedMonthKey = Object.prototype.hasOwnProperty.call(patch, "fixedMonthKey")
      ? patch.fixedMonthKey ?? null
      : existing.fixedMonthKey;

    if (finalBudgetId != null) {
      const budget = await storage.getBudget(finalBudgetId, userId);
      if (!budget || budget.isFolder) {
        return res.status(400).json({ message: "budgetId must point to a valid budget" });
      }
    }

    if (finalCategoryId != null) {
      const category = await storage.getCategory(finalCategoryId);
      if (!category) {
        return res.status(400).json({ message: "categoryId must point to an existing category" });
      }
      const categoryBudget = await storage.getBudget(category.budgetId, userId);
      if (!categoryBudget || categoryBudget.isFolder) {
        return res.status(400).json({ message: "categoryId must belong to your budget" });
      }
      if (finalBudgetId != null && category.budgetId !== finalBudgetId) {
        return res.status(400).json({ message: "categoryId must belong to budgetId" });
      }
    }

    if (finalMonthKeyScope === "fixed" && (!finalFixedMonthKey || !MONTH_KEY_PATTERN.test(finalFixedMonthKey))) {
      return res.status(400).json({ message: "fixedMonthKey is required when monthKeyScope is fixed" });
    }
    if (finalMonthKeyScope !== "fixed") {
      patch.fixedMonthKey = null;
    }

    const updated = await storage.updateDashboardWatchlist(watchlistId, patch, userId);
    if (!updated) return res.status(404).json({ message: "Watchlist not found" });
    res.json(updated);
  });

  app.delete("/api/dashboard/watchlists/:id", isAuthenticated, async (req, res) => {
    const userId = (req as any).user?.claims?.sub;
    await storage.deleteDashboardWatchlist(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.all("/api/coach", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/coach/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/paychecks", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/paychecks/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/bill-reminders", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/bill-reminders/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/bill-occurrences", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/bill-occurrences/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
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
