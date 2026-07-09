/**
 * Reporting aggregations (spec §5.5). All day-counts are business days and
 * attribution uses the SACRED 4-party palette. These power the Reports page,
 * CSV export, and the per-project post-mortem.
 */
import { prisma } from "./db";
import { projectScopeWhere, type SessionUser } from "./permissions";
import { deriveDependencyState } from "./sla";

export type AttributionRow = {
  projectId: string;
  title: string;
  mako: number;
  rl: number;
  client_via_rl: number;
  product_bug: number;
  total: number;
};

export type AttributionReport = {
  rows: AttributionRow[];
  totals: { mako: number; rl: number; client_via_rl: number; product_bug: number; total: number };
};

/** Per-project delay attribution across dependencies, pauses, and late MoMs. */
export async function getAttributionReport(
  user: SessionUser,
  filters?: { projectId?: string }
): Promise<AttributionReport> {
  const now = new Date();
  const projects = await prisma.project.findMany({
    where: {
      ...projectScopeWhere(user),
      isArchived: false,
      ...(filters?.projectId ? { id: filters.projectId } : {}),
    },
    select: {
      id: true,
      title: true,
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
      pauseHistory: { select: { reasonCategory: true, pauseDurationDays: true } },
      meetings: { select: { momLateReasonCategory: true } },
    },
  });

  const rows: AttributionRow[] = [];
  const totals = { mako: 0, rl: 0, client_via_rl: 0, product_bug: 0, total: 0 };

  for (const p of projects) {
    const row: AttributionRow = {
      projectId: p.id,
      title: p.title,
      mako: 0,
      rl: 0,
      client_via_rl: 0,
      product_bug: 0,
      total: 0,
    };
    const add = (party: string, days: number) => {
      if (party in row && party !== "projectId" && party !== "title" && party !== "total") {
        (row as unknown as Record<string, number>)[party] += days;
      }
    };

    for (const d of p.dependencies) {
      const state = deriveDependencyState(
        { dateRequested: d.dateRequested, dateReceived: d.dateReceived, slaThresholdDays: d.slaThresholdDays, status: d.status, rootCauseCategory: d.rootCauseCategory },
        now
      );
      const party =
        d.rootCauseCategory ??
        (d.requestedFromParty === "mako" ? "mako" : d.requestedFromParty === "rl" ? "rl" : "client_via_rl");
      add(party, state.burnDays);
    }
    for (const pause of p.pauseHistory) {
      if (pause.reasonCategory) add(pause.reasonCategory, pause.pauseDurationDays ?? 0);
    }
    // Each late MoM caused by RL compression counts as 1 RL-attributed day.
    for (const m of p.meetings) {
      if (m.momLateReasonCategory === "rl_delay_compressed_timeline") add("rl", 1);
    }

    row.total = row.mako + row.rl + row.client_via_rl + row.product_bug;
    rows.push(row);

    totals.mako += row.mako;
    totals.rl += row.rl;
    totals.client_via_rl += row.client_via_rl;
    totals.product_bug += row.product_bug;
  }
  totals.total = totals.mako + totals.rl + totals.client_via_rl + totals.product_bug;

  rows.sort((a, b) => b.total - a.total);
  return { rows, totals };
}
