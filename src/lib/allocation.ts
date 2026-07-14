/**
 * Timeline day derivations & planning-day allocation.
 *
 * Each side has a start + end date; the day count is derived (calendar days).
 * Milestones allocate planning days from a pool (Mako's promised days, or RL's
 * proposed days if Mako's aren't set). These are planning days — distinct from
 * the business-day BURN math used for SLA/attribution.
 */
import { addDays, differenceInCalendarDays } from "date-fns";

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

/** The date milestone scheduling is anchored to (Mako start preferred). */
export function scheduleAnchor(p: ProjectDates): Date | null {
  return p.makoStartDate ?? p.rlStartDate ?? null;
}

/**
 * Auto-derive each milestone's due date from its allocated days, chained: the
 * first runs `days[0]` from the anchor; each subsequent one runs its days from
 * the previous milestone's completion. Milestones without days yield a null due
 * date but don't advance the cursor.
 */
export function chainDueDates(
  anchor: Date,
  ordered: { allocatedDays: number | null }[]
): (Date | null)[] {
  let cursor = anchor;
  return ordered.map((m) => {
    const d = m.allocatedDays ?? 0;
    if (d <= 0) return null;
    cursor = addDays(cursor, d);
    return cursor;
  });
}
