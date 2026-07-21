/**
 * Working-day arithmetic for project timelines and milestone allocation.
 *
 * A "working day" is any calendar day in the range that is not a weekend
 * (Sat/Sun) — unless the project opts to include weekends — and is not an
 * organisation holiday. Pure and client-safe: callers pass the holiday set
 * (ISO yyyy-mm-dd strings) and the includeWeekends flag.
 */
import { addDays, eachDayOfInterval, isWeekend, startOfDay } from "date-fns";

export type WorkingDayOpts = { includeWeekends?: boolean; holidays?: Set<string> | string[] };

const EMPTY = new Set<string>();
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function toSet(h?: Set<string> | string[]): Set<string> {
  if (!h) return EMPTY;
  return h instanceof Set ? h : new Set(h);
}

/**
 * Count working days in the half-open interval (start, end] — matching the
 * calendar-day difference when every day is a working day. Returns null when
 * either endpoint is missing, 0 when end <= start.
 */
export function workingDaysBetween(
  start?: Date | string | null,
  end?: Date | string | null,
  opts: WorkingDayOpts = {}
): number | null {
  if (!start || !end) return null;
  const s = startOfDay(new Date(start));
  const e = startOfDay(new Date(end));
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  if (e <= s) return 0;
  const holidays = toSet(opts.holidays);
  return eachDayOfInterval({ start: addDays(s, 1), end: e }).filter(
    (d) => (opts.includeWeekends || !isWeekend(d)) && !holidays.has(isoOf(d))
  ).length;
}
