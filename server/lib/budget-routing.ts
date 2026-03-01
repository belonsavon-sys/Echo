import type { Budget } from "@shared/schema";
import { addDays, addMonths, addWeeks, addYears, endOfMonth, format, getMonth, getYear, isBefore, isValid, parseISO, startOfMonth } from "date-fns";

const YEAR_FOLDER_PATTERN = /^\d{4}$/;
export const MONTH_NAMES = [
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

export function getYearFromFolderName(name: string): number | null {
  if (!YEAR_FOLDER_PATTERN.test(name)) return null;
  const year = Number(name);
  return Number.isInteger(year) ? year : null;
}

export function isYearFolder(
  budget: Pick<Budget, "isFolder" | "name"> | null | undefined,
): boolean {
  if (!budget || !budget.isFolder) return false;
  return getYearFromFolderName(budget.name) !== null;
}

export function getMonthBoundaries(
  year: number,
  monthIndex: number,
): { startDate: string; endDate: string } {
  const monthDate = new Date(year, monthIndex, 1);
  return {
    startDate: format(startOfMonth(monthDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(monthDate), "yyyy-MM-dd"),
  };
}

export function getNextDate(date: Date, frequency: string): Date {
  switch (frequency) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addWeeks(date, 1);
    case "biweekly":
      return addWeeks(date, 2);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
}

export function generateRecurringDates(
  startDate: string,
  frequency: string,
  options: {
    endDate?: string;
    maxOccurrences?: number;
  },
): string[] {
  const dates: string[] = [];
  let current = parseISO(startDate);
  const hasEndDate = !!options.endDate;
  const end = hasEndDate ? parseISO(options.endDate as string) : null;
  const maxOccurrences =
    typeof options.maxOccurrences === "number" && options.maxOccurrences >= 0
      ? Math.floor(options.maxOccurrences)
      : null;

  current = getNextDate(current, frequency);

  while (true) {
    if (maxOccurrences !== null && dates.length >= maxOccurrences) break;
    if (hasEndDate && end) {
      const currentDate = format(current, "yyyy-MM-dd");
      if (!isBefore(current, end) && currentDate !== options.endDate) {
        break;
      }
    }
    dates.push(format(current, "yyyy-MM-dd"));
    current = getNextDate(current, frequency);
  }

  return dates;
}

function resolveYearFolderFromBudget(
  sourceBudget: Budget,
  budgetsById: Map<number, Budget>,
): Budget | null {
  if (isYearFolder(sourceBudget)) return sourceBudget;

  let current: Budget | undefined = sourceBudget;
  const visited = new Set<number>();
  while (current && current.parentId != null) {
    const parentId = current.parentId;
    if (visited.has(parentId)) break;
    visited.add(parentId);

    const parent = budgetsById.get(parentId);
    if (!parent) break;
    if (isYearFolder(parent)) return parent;
    current = parent;
  }

  return null;
}

export function findRoutedMonthBudgetId(
  sourceBudgetId: number,
  dateStr: string,
  budgets: Budget[],
): number | null {
  const sourceBudget = budgets.find((budget) => budget.id === sourceBudgetId);
  if (!sourceBudget) return null;

  const parsedDate = parseISO(dateStr);
  if (!isValid(parsedDate)) return null;

  const budgetsById = new Map<number, Budget>(budgets.map((budget) => [budget.id, budget]));
  const yearFolder = resolveYearFolderFromBudget(sourceBudget, budgetsById);
  if (!yearFolder) return null;

  const year = getYearFromFolderName(yearFolder.name);
  if (year === null || getYear(parsedDate) !== year) return null;

  const monthIndex = getMonth(parsedDate);
  const monthName = MONTH_NAMES[monthIndex].toLowerCase();
  const expectedStartDate = getMonthBoundaries(year, monthIndex).startDate;
  const monthBudget = budgets.find(
    (budget) =>
      budget.parentId === yearFolder.id &&
      !budget.isFolder &&
      (budget.startDate === expectedStartDate ||
        budget.name.trim().toLowerCase() === monthName),
  );
  return monthBudget?.id ?? null;
}
