import { endOfYear, format, getMonth, getYear, isValid, parseISO } from "date-fns";
import {
  type Budget,
  type InsertBudget,
  type InsertEntry,
} from "@shared/schema";
import type { IStorage } from "../storage";
import {
  findRoutedMonthBudgetId,
  generateRecurringDates,
  getMonthBoundaries,
  getYearFromFolderName,
  isYearFolder,
  MONTH_NAMES,
} from "./budget-routing";

const DEFAULT_BUDGET_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: "Shopping", color: "#f97316" },
  { name: "Credit", color: "#ef4444" },
  { name: "Subscriptions", color: "#6366f1" },
  { name: "Debt", color: "#b91c1c" },
  { name: "Investing", color: "#059669" },
  { name: "Food", color: "#f59e0b" },
  { name: "Bill", color: "#2563eb" },
  { name: "Other", color: "#6b7280" },
];

export function getDefaultBudgetCategories(): Array<{ name: string; color: string }> {
  return DEFAULT_BUDGET_CATEGORIES.map((template) => ({ ...template }));
}

export async function verifyBudgetOwnership(
  storage: IStorage,
  budgetId: number,
  userId: string,
): Promise<boolean> {
  const budget = await storage.getBudget(budgetId, userId);
  return !!budget;
}

export async function ensureDefaultCategoriesForBudget(
  storage: IStorage,
  budget: Budget,
): Promise<void> {
  if (budget.isFolder) return;

  const existing = await storage.getCategories(budget.id);
  const existingByName = new Set(
    existing.map((category) => category.name.trim().toLowerCase()),
  );
  let nextSortOrder =
    existing.reduce(
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

export async function ensureYearFolderMonths(
  storage: IStorage,
  yearFolder: Budget,
  userId: string,
): Promise<Budget[]> {
  const year = getYearFromFolderName(yearFolder.name);
  if (year === null) return [];

  const allBudgets = await storage.getBudgets(userId);
  const childBudgets = allBudgets.filter(
    (budget) => budget.parentId === yearFolder.id && !budget.isFolder,
  );
  const months: Budget[] = [];

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const monthName = MONTH_NAMES[i];
    const { startDate, endDate } = getMonthBoundaries(year, i);
    const existing = childBudgets.find(
      (budget) =>
        budget.startDate === startDate ||
        budget.name.trim().toLowerCase() === monthName.toLowerCase(),
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
      await ensureDefaultCategoriesForBudget(storage, created);
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
      await ensureDefaultCategoriesForBudget(storage, resolved);
      months.push(resolved);
    } else {
      await ensureDefaultCategoriesForBudget(storage, existing);
      months.push(existing);
    }
  }

  return months.sort((left, right) => left.sortOrder - right.sortOrder);
}

async function resolveYearFolderContext(
  storage: IStorage,
  budget: Budget,
  userId: string,
): Promise<Budget | null> {
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
  storage: IStorage,
  yearFolder: Budget,
  dateStr: string,
  userId: string,
): Promise<Budget | null> {
  const parsedDate = parseISO(dateStr);
  if (!isValid(parsedDate)) return null;

  const year = getYearFromFolderName(yearFolder.name);
  if (year === null || getYear(parsedDate) !== year) return null;

  const months = await ensureYearFolderMonths(storage, yearFolder, userId);
  return months[getMonth(parsedDate)] || null;
}

export async function remapCategoryToBudget(
  storage: IStorage,
  categoryId: number | null | undefined,
  targetBudgetId: number,
): Promise<number | null> {
  if (categoryId == null) return null;

  const sourceCategory = await storage.getCategory(categoryId);
  if (!sourceCategory) return null;
  if (sourceCategory.budgetId === targetBudgetId) return sourceCategory.id;

  const targetCategories = await storage.getCategories(targetBudgetId);
  const byName = targetCategories.find(
    (category) =>
      category.name.trim().toLowerCase() ===
      sourceCategory.name.trim().toLowerCase(),
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

export async function resolveRoutedBudgetId(
  storage: IStorage,
  sourceBudgetId: number,
  dateStr: string,
  userId: string,
): Promise<number> {
  const allBudgets = await storage.getBudgets(userId);
  const fastRoutedBudgetId = findRoutedMonthBudgetId(
    sourceBudgetId,
    dateStr,
    allBudgets,
  );
  if (fastRoutedBudgetId !== null) return fastRoutedBudgetId;

  const sourceBudget = allBudgets.find((budget) => budget.id === sourceBudgetId);
  if (!sourceBudget) return sourceBudgetId;

  const yearFolder = await resolveYearFolderContext(storage, sourceBudget, userId);
  if (!yearFolder) return sourceBudgetId;

  const monthBudget = await findOrCreateMonthBudgetForDate(
    storage,
    yearFolder,
    dateStr,
    userId,
  );
  return monthBudget?.id ?? sourceBudgetId;
}

export async function routeEntryForCreate(
  storage: IStorage,
  entry: InsertEntry,
  userId: string,
): Promise<InsertEntry> {
  const routedBudgetId = await resolveRoutedBudgetId(
    storage,
    entry.budgetId,
    entry.date,
    userId,
  );
  const targetEntries = await storage.getEntries(routedBudgetId);
  const remappedCategoryId = await remapCategoryToBudget(
    storage,
    entry.categoryId,
    routedBudgetId,
  );

  return {
    ...entry,
    budgetId: routedBudgetId,
    categoryId: remappedCategoryId,
    sortOrder: targetEntries.length,
  };
}

export async function getDefaultRecurringEndDate(
  storage: IStorage,
  sourceBudgetId: number,
  startDate: string,
  userId: string,
): Promise<string> {
  const sourceBudget = await storage.getBudget(sourceBudgetId, userId);
  if (sourceBudget) {
    const yearFolder = await resolveYearFolderContext(storage, sourceBudget, userId);
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

export function getRecurringChildLimit(
  amount: number,
  recurringEndAmount: number | null | undefined,
): number | undefined {
  if (recurringEndAmount == null) return undefined;
  if (!(amount > 0) || !(recurringEndAmount > 0)) return 0;

  const totalOccurrences = Math.floor((recurringEndAmount + 1e-9) / amount);
  return Math.max(totalOccurrences - 1, 0);
}

export async function migrateYearEntriesIntoMonths(
  storage: IStorage,
  yearFolder: Budget,
  userId: string,
): Promise<number> {
  const folderYear = getYearFromFolderName(yearFolder.name);
  if (folderYear === null) return 0;

  await ensureYearFolderMonths(storage, yearFolder, userId);
  const directEntries = await storage.getEntries(yearFolder.id);
  let movedCount = 0;

  for (const entry of directEntries) {
    const parsedDate = parseISO(entry.date);
    if (!isValid(parsedDate) || getYear(parsedDate) !== folderYear) {
      continue;
    }

    const targetMonth = await findOrCreateMonthBudgetForDate(
      storage,
      yearFolder,
      entry.date,
      userId,
    );
    if (!targetMonth || targetMonth.id === yearFolder.id) {
      continue;
    }

    const targetEntries = await storage.getEntries(targetMonth.id);
    const remappedCategoryId = await remapCategoryToBudget(
      storage,
      entry.categoryId,
      targetMonth.id,
    );
    await storage.updateEntry(entry.id, {
      budgetId: targetMonth.id,
      categoryId: remappedCategoryId,
      sortOrder: targetEntries.length,
    });
    movedCount += 1;
  }

  return movedCount;
}

export { generateRecurringDates, getYearFromFolderName, isYearFolder };
