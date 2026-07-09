/**
 * Business-day utilities (spec §7.1).
 *
 * ALL burn-day / SLA calculations in this platform use BUSINESS DAYS
 * (Mon–Fri) only, excluding weekends. This module is the single source of
 * truth for that arithmetic so every report, badge, and dashboard agrees.
 *
 * We deliberately wrap date-fns rather than call it ad hoc, so we can extend
 * with a holiday calendar later without touching call sites.
 */
import {
  differenceInBusinessDays,
  addBusinessDays,
  isWeekend,
  startOfDay,
} from "date-fns";

/** Optional org holiday list (ISO yyyy-mm-dd). Extend via org settings later. */
const HOLIDAYS: Set<string> = new Set<string>([]);

function isHoliday(d: Date): boolean {
  return HOLIDAYS.has(startOfDay(d).toISOString().slice(0, 10));
}

/** True if the date is a working day (not weekend, not a configured holiday). */
export function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !isHoliday(d);
}

/**
 * Count business days elapsed between two dates (inclusive of neither endpoint's
 * partial time — we normalise to start-of-day). Never returns negative.
 *
 * date-fns' differenceInBusinessDays excludes weekends; we then subtract any
 * configured holidays that fall in the (from, to] window.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  if (b <= a) return 0;

  let diff = Math.abs(differenceInBusinessDays(b, a));

  if (HOLIDAYS.size > 0) {
    let cursor = new Date(a);
    while (cursor < b) {
      cursor = addBusinessDays(cursor, 1);
      if (cursor <= b && isHoliday(cursor)) diff -= 1;
    }
  }
  return Math.max(0, diff);
}

/**
 * Burn days for a dependency/ticket.
 * - If received/fulfilled: business days between requested and received.
 * - If still open: business days between requested and today.
 */
export function calcBurnDays(
  dateRequested: Date,
  dateReceived?: Date | null,
  now: Date = new Date()
): number {
  const end = dateReceived ?? now;
  return businessDaysBetween(dateRequested, end);
}

/** Add N business days to a date (used for SLA deadline anchoring). */
export function addBusinessDaysTo(date: Date, days: number): Date {
  let result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result = addBusinessDays(result, 1);
    if (isHoliday(result)) continue; // skip holidays, keep consuming
    remaining -= 1;
  }
  return result;
}
