/**
 * SLA evaluation logic (spec §2.5, §7.1).
 *
 * A dependency's SLA state is derived, not stored authoritatively — we
 * recompute burn/breach on read (and via cron) so the UI never shows a stale
 * counter. `slaBreached` flips true the moment burnDays > slaThresholdDays.
 */
import { calcBurnDays } from "./business-days";

export type DerivedDependencyState = {
  burnDays: number;
  slaBreached: boolean;
  /** true once burn reaches 80% of threshold — used for amber warning UI. */
  slaAtRisk: boolean;
  /** true when breached and root-cause tagging becomes mandatory on receipt. */
  rootCauseRequired: boolean;
};

export function deriveDependencyState(dep: {
  dateRequested: Date;
  dateReceived?: Date | null;
  slaThresholdDays: number;
  status: "awaiting" | "received" | "overdue";
  rootCauseCategory?: string | null;
}, now: Date = new Date()): DerivedDependencyState {
  const burnDays = calcBurnDays(dep.dateRequested, dep.dateReceived, now);
  const slaBreached = burnDays > dep.slaThresholdDays;
  const slaAtRisk =
    !slaBreached && burnDays >= Math.ceil(dep.slaThresholdDays * 0.8);

  // Root cause becomes REQUIRED once breached AND the dependency is fulfilled.
  const rootCauseRequired =
    slaBreached && dep.status === "received" && !dep.rootCauseCategory;

  return { burnDays, slaBreached, slaAtRisk, rootCauseRequired };
}

/** 80%-of-SLA threshold used for "approaching breach" reminders. */
export function slaWarningThreshold(slaDays: number): number {
  return Math.ceil(slaDays * 0.8);
}

/**
 * Project health signal (spec §5.2). Order matters: delayed > at-risk > on-track.
 */
export type ProjectHealth = "on_track" | "at_risk" | "delayed";

export function deriveProjectHealth(input: {
  status: string;
  rlCommittedDeadline: Date | null;
  makoInternalDeadline?: Date | null;
  actualCompletionDate?: Date | null;
  hasBreachedDependency: boolean;
  hasDependencyNearBreach: boolean;
  now?: Date;
}): ProjectHealth {
  const now = input.now ?? new Date();
  const deadline = input.rlCommittedDeadline;

  // Delayed: any breached dependency OR past deadline OR paused.
  if (
    input.hasBreachedDependency ||
    input.status === "paused" ||
    (!!deadline && !input.actualCompletionDate && now > deadline)
  ) {
    return "delayed";
  }

  // At risk: dependency within 1 day of breach, or timeline within 3 days.
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const nearDeadline =
    !!deadline &&
    !input.actualCompletionDate &&
    deadline.getTime() - now.getTime() <= threeDaysMs;
  if (input.hasDependencyNearBreach || nearDeadline) {
    return "at_risk";
  }

  return "on_track";
}
