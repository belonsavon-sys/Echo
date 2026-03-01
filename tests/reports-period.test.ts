import assert from "node:assert/strict";
import test from "node:test";
import { format } from "date-fns";
import {
  getTrendMonthsForPeriod,
  resolveReportPeriodContext,
} from "../client/src/lib/reports-period";

test("reports period: month mode resolves bounds and enables prediction only for current month", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");
  const march = resolveReportPeriodContext("month", 2026, 3, now);
  const april = resolveReportPeriodContext("month", 2026, 4, now);

  assert.equal(format(march.selectedStart, "yyyy-MM-dd"), "2026-03-01");
  assert.equal(format(march.selectedEnd, "yyyy-MM-dd"), "2026-03-31");
  assert.equal(format(march.previousStart, "yyyy-MM-dd"), "2026-02-01");
  assert.equal(format(march.comparisonStart, "yyyy-MM-dd"), "2025-03-01");
  assert.equal(march.predictionsEnabled, true);
  assert.equal(april.predictionsEnabled, false);
});

test("reports period: year mode resolves full-year bounds and disables prediction", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");
  const context = resolveReportPeriodContext("year", 2027, 1, now);

  assert.equal(format(context.selectedStart, "yyyy-MM-dd"), "2027-01-01");
  assert.equal(format(context.selectedEnd, "yyyy-MM-dd"), "2027-12-31");
  assert.equal(format(context.previousStart, "yyyy-MM-dd"), "2026-01-01");
  assert.equal(format(context.previousEnd, "yyyy-MM-dd"), "2026-12-31");
  assert.equal(context.predictionsEnabled, false);
});

test("reports period: trend months return 6 months for month mode and 12 for year mode", () => {
  const monthTrend = getTrendMonthsForPeriod("month", new Date("2026-07-01T00:00:00.000Z"));
  const yearTrend = getTrendMonthsForPeriod("year", new Date("2026-07-01T00:00:00.000Z"));

  assert.equal(monthTrend.length, 6);
  assert.equal(yearTrend.length, 12);
  assert.equal(format(yearTrend[0], "yyyy-MM-dd"), "2026-01-01");
  assert.equal(format(yearTrend[11], "yyyy-MM-dd"), "2026-12-01");
});
