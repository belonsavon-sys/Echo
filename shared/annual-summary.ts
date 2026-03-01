import type { Entry } from "./schema";

export const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type AnnualMonthlyBreakdownRow = {
  month: (typeof SHORT_MONTH_NAMES)[number];
  Income: number;
  Expenses: number;
  Savings: number;
};

export type AnnualSummary = {
  yearEntries: Entry[];
  monthlyBreakdown: AnnualMonthlyBreakdownRow[];
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
};

export function computeAnnualSummary(entries: Entry[], year: number): AnnualSummary {
  const yearPrefix = `${year}-`;
  const yearEntries = entries.filter((entry) => entry.date.startsWith(yearPrefix));

  const incomeByMonth = new Array<number>(12).fill(0);
  const expenseByMonth = new Array<number>(12).fill(0);

  for (const entry of yearEntries) {
    const monthSegment = entry.date.slice(5, 7);
    const monthIndex = Number(monthSegment) - 1;
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) continue;
    if (entry.type === "income") {
      incomeByMonth[monthIndex] += entry.amount;
    } else if (entry.type === "expense") {
      expenseByMonth[monthIndex] += entry.amount;
    }
  }

  const monthlyBreakdown = SHORT_MONTH_NAMES.map((month, index) => {
    const income = incomeByMonth[index];
    const expenses = expenseByMonth[index];
    return {
      month,
      Income: income,
      Expenses: expenses,
      Savings: income - expenses,
    };
  });

  const totalIncome = incomeByMonth.reduce((sum, amount) => sum + amount, 0);
  const totalExpenses = expenseByMonth.reduce((sum, amount) => sum + amount, 0);
  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  return {
    yearEntries,
    monthlyBreakdown,
    totalIncome,
    totalExpenses,
    totalSavings,
    savingsRate,
    avgMonthlyIncome: totalIncome / 12,
    avgMonthlyExpenses: totalExpenses / 12,
  };
}
