import {
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";

export type ReportPeriodType = "month" | "year";

export type ReportPeriodContext = {
  selectedDate: Date;
  selectedStart: Date;
  selectedEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  comparisonStart: Date;
  comparisonEnd: Date;
  isCurrentPeriod: boolean;
  predictionsEnabled: boolean;
};

export function resolveReportPeriodContext(
  periodType: ReportPeriodType,
  selectedYear: number,
  selectedMonth: number,
  now: Date,
): ReportPeriodContext {
  const nowDate = new Date(now);
  const selectedDate =
    periodType === "year"
      ? new Date(selectedYear, 0, 1)
      : new Date(selectedYear, selectedMonth - 1, 1);

  if (periodType === "year") {
    const selectedStart = startOfYear(selectedDate);
    const selectedEnd = endOfYear(selectedDate);
    const previousStart = startOfYear(subYears(selectedDate, 1));
    const previousEnd = endOfYear(subYears(selectedDate, 1));
    return {
      selectedDate,
      selectedStart,
      selectedEnd,
      previousStart,
      previousEnd,
      comparisonStart: previousStart,
      comparisonEnd: previousEnd,
      isCurrentPeriod: isSameYear(selectedDate, nowDate),
      predictionsEnabled: false,
    };
  }

  const selectedStart = startOfMonth(selectedDate);
  const selectedEnd = endOfMonth(selectedDate);
  const previousStart = startOfMonth(subMonths(selectedDate, 1));
  const previousEnd = endOfMonth(subMonths(selectedDate, 1));
  const comparisonStart = startOfMonth(subYears(selectedDate, 1));
  const comparisonEnd = endOfMonth(subYears(selectedDate, 1));
  return {
    selectedDate,
    selectedStart,
    selectedEnd,
    previousStart,
    previousEnd,
    comparisonStart,
    comparisonEnd,
    isCurrentPeriod: isSameYear(selectedDate, nowDate) && isSameMonth(selectedDate, nowDate),
    predictionsEnabled: isSameYear(selectedDate, nowDate) && isSameMonth(selectedDate, nowDate),
  };
}

export function getTrendMonthsForPeriod(periodType: ReportPeriodType, selectedDate: Date): Date[] {
  if (periodType === "year") {
    return eachMonthOfInterval({
      start: startOfYear(selectedDate),
      end: endOfYear(selectedDate),
    });
  }

  return eachMonthOfInterval({
    start: startOfMonth(subMonths(selectedDate, 5)),
    end: startOfMonth(selectedDate),
  });
}
