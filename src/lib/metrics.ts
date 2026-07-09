/**
 * Dashboard metric aggregation (spec §5.1). All calculations are scoped by the
 * caller's role via projectScopeWhere, and all day-counts are BUSINESS days.
 */
import { subDays } from "date-fns";
import { prisma } from "./db";
import { projectScopeWhere, type SessionUser } from "./permissions";
import { deriveDependencyState } from "./sla";
import { calcBurnDays } from "./business-days";
import type { AttributionDatum } from "@/components/charts/DelayAttributionDonut";

export type DashboardMetrics = {
  totalProjects: number;
  active: number;
  atRisk: number;
  delayed: number;
  totalBurn30: number;
  rlSharePct: number;
  attribution: AttributionDatum[];
  statusCounts: Record<string, number>;
  openDependencies: number;
  breachedDependencies: number;
  pendingApprovals: number;
};

export async function getDashboardMetrics(
  user: SessionUser
): Promise<DashboardMetrics> {
  const scope = projectScopeWhere(user);
  const now = new Date();
  const windowStart = subDays(now, 30);

  const projects = await prisma.project.findMany({
    where: { ...scope, isArchived: false },
    select: {
      id: true,
      status: true,
      rlCommittedDeadline: true,
      actualCompletionDate: true,
      dependencies: {
        select: {
          dateRequested: true,
          dateReceived: true,
          slaThresholdDays: true,
          status: true,
          rootCauseCategory: true,
          requestedFromParty: true,
        },
      },
      pauseHistory: {
        select: {
          reasonCategory: true,
          pauseDurationDays: true,
          pausedAt: true,
          resumedAt: true,
        },
      },
      approvals: { select: { status: true }, where: { status: "pending" } },
    },
  });

  const attribution: Record<string, number> = {
    mako: 0,
    rl: 0,
    client_via_rl: 0,
    product_bug: 0,
  };
  const statusCounts: Record<string, number> = {};

  let active = 0;
  let atRisk = 0;
  let delayed = 0;
  let totalBurn30 = 0;
  let openDependencies = 0;
  let breachedDependencies = 0;
  let pendingApprovals = 0;

  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    if (p.status === "in_progress") active++;
    pendingApprovals += p.approvals.length;

    let hasBreach = false;
    let hasNearBreach = false;

    for (const d of p.dependencies) {
      const state = deriveDependencyState(
        {
          dateRequested: d.dateRequested,
          dateReceived: d.dateReceived,
          slaThresholdDays: d.slaThresholdDays,
          status: d.status,
          rootCauseCategory: d.rootCauseCategory,
        },
        now
      );
      if (d.status !== "received") openDependencies++;
      if (state.slaBreached) {
        hasBreach = true;
        breachedDependencies++;
      }
      if (state.slaAtRisk) hasNearBreach = true;

      // Attribution: prefer explicit root cause; else fall back to the party
      // the dependency was requested from (mapped into the palette).
      const party =
        d.rootCauseCategory ??
        (d.requestedFromParty === "mako"
          ? "mako"
          : d.requestedFromParty === "rl"
            ? "rl"
            : "client_via_rl");
      const burn = state.burnDays;
      if (party in attribution) attribution[party] += burn;

      // 30-day rolling burn across open dependencies.
      if (d.status !== "received" && d.dateRequested >= windowStart) {
        totalBurn30 += calcBurnDays(d.dateRequested, null, now);
      } else if (d.status !== "received") {
        totalBurn30 += calcBurnDays(windowStart, null, now);
      }
    }

    // Pause durations feed attribution too (spec §2.15).
    for (const pause of p.pauseHistory) {
      const days = pause.pauseDurationDays ?? 0;
      const cat = pause.reasonCategory;
      if (cat && cat in attribution) attribution[cat] += days;
    }

    // Health signal.
    const past = !p.actualCompletionDate && now > p.rlCommittedDeadline;
    if (hasBreach || p.status === "paused" || past) delayed++;
    else if (hasNearBreach) atRisk++;
  }

  const attribution4: AttributionDatum[] = [
    { party: "mako", days: attribution.mako },
    { party: "rl", days: attribution.rl },
    { party: "client_via_rl", days: attribution.client_via_rl },
    { party: "product_bug", days: attribution.product_bug },
  ];
  const totalAttr = attribution4.reduce((s, d) => s + d.days, 0);
  const rlSharePct = totalAttr > 0 ? Math.round((attribution.rl / totalAttr) * 100) : 0;

  return {
    totalProjects: projects.length,
    active,
    atRisk,
    delayed,
    totalBurn30,
    rlSharePct,
    attribution: attribution4,
    statusCounts,
    openDependencies,
    breachedDependencies,
    pendingApprovals,
  };
}
