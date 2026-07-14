/**
 * Timeline day derivations & planning-day allocation.
 *
 * Each side has a start + end date; the day count is derived (calendar days).
 * Milestones allocate planning days from a pool (Mako's promised days, or RL's
 * proposed days if Mako's aren't set). These are planning days — distinct from
 * the business-day BURN math used for SLA/attribution.
 */
import { differenceInCalendarDays } from "date-fns";

type ProjectDates = {
  rlStartDate: Date | null;
  rlCommittedDeadline: Date | null;
  makoStartDate: Date | null;
  makoInternalDeadline: Date | null;
};

/** Calendar days between two dates, or null if either is missing. */
export function daysBetween(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, differenceInCalendarDays(end, start));
}

/** Days proposed by RL (RL start → RL end), or null. */
export function rlProposedDays(p: ProjectDates): number | null {
  return daysBetween(p.rlStartDate, p.rlCommittedDeadline);
}

/** Days promised by Mako (Mako start → Mako end), or null. */
export function makoPromisedDays(p: ProjectDates): number | null {
  return daysBetween(p.makoStartDate, p.makoInternalDeadline);
}

/**
 * The day pool milestones allocate from: Mako's promised days preferred (it's
 * Mako's internal plan), falling back to RL's proposed days, else 0.
 */
export function allocationPoolDays(p: ProjectDates): number {
  return makoPromisedDays(p) ?? rlProposedDays(p) ?? 0;
}
