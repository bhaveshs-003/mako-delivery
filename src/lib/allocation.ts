/**
 * Planning-day allocation helpers.
 *
 * The project's timeline is a fixed pool of days (project start → RL committed
 * deadline). Milestones draw days from that pool; subtasks draw from their
 * milestone's days. These are planning days (calendar), distinct from the
 * business-day BURN math used for SLA/attribution.
 */
import { differenceInCalendarDays } from "date-fns";

/** Total planning days in the project timeline (start → RL deadline). */
export function projectTotalDays(start: Date, rlDeadline: Date): number {
  return Math.max(0, differenceInCalendarDays(rlDeadline, start));
}
