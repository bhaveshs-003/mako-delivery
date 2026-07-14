import { prisma } from "@/lib/db";
import { deriveDependencyState } from "@/lib/sla";
import { businessDaysBetween } from "@/lib/business-days";
import { allocationPoolDays, rlProposedDays, makoPromisedDays } from "@/lib/allocation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttributionDatum } from "@/components/charts/DelayAttributionDonut";
import { LazyDelayAttributionDonut } from "@/components/charts/lazy";
import { PauseActiveTimeline, type PauseSegment } from "@/components/charts/PauseActiveTimeline";

export async function OverviewTab({
  projectId,
  description,
}: {
  projectId: string;
  description: string | null;
}) {
  const now = new Date();
  const [project, milestones, dependencies, pendingApprovals, openTickets, changeRequests, pauses] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          createdAt: true,
          status: true,
          actualCompletionDate: true,
          rlStartDate: true,
          rlCommittedDeadline: true,
          makoStartDate: true,
          makoInternalDeadline: true,
        },
      }),
      prisma.milestone.findMany({ where: { projectId }, select: { status: true, allocatedDays: true } }),
      prisma.dependency.findMany({ where: { projectId } }),
      prisma.approvalRequest.count({ where: { projectId, status: "pending" } }),
      prisma.ticketProject.count({ where: { projectId, ticket: { status: { notIn: ["closed", "resolved"] } } } }),
      prisma.scopeDocument.count({ where: { projectId, kind: "change_request" } }),
      prisma.pauseHistory.findMany({
        where: { projectId },
        orderBy: { pausedAt: "asc" },
        select: { pausedAt: true, resumedAt: true, reasonCategory: true, reasonComment: true, pauseDurationDays: true },
      }),
    ]);

  const doneMilestones = milestones.filter((m) => m.status === "completed").length;
  let openDeps = 0;
  let breached = 0;
  const attribution: Record<string, number> = { mako: 0, rl: 0, client_via_rl: 0, product_bug: 0 };

  for (const d of dependencies) {
    const state = deriveDependencyState(
      { dateRequested: d.dateRequested, dateReceived: d.dateReceived, slaThresholdDays: d.slaThresholdDays, status: d.status, rootCauseCategory: d.rootCauseCategory },
      now
    );
    if (d.status !== "received") openDeps++;
    if (state.slaBreached) breached++;
    const party = d.rootCauseCategory ?? (d.requestedFromParty === "mako" ? "mako" : d.requestedFromParty === "rl" ? "rl" : "client_via_rl");
    if (party in attribution) attribution[party] += state.burnDays;
  }
  for (const p of pauses) {
    if (p.reasonCategory && p.reasonCategory in attribution)
      attribution[p.reasonCategory] += p.pauseDurationDays ?? 0;
  }

  const attrData: AttributionDatum[] = [
    { party: "mako", days: attribution.mako },
    { party: "rl", days: attribution.rl },
    { party: "client_via_rl", days: attribution.client_via_rl },
    { party: "product_bug", days: attribution.product_bug },
  ];

  // ── Active vs Paused timeline ─────────────────────────────────────────────
  const start = project?.createdAt ?? now;
  const end = project?.actualCompletionDate ?? now;
  const ongoing = !project?.actualCompletionDate;
  const segments: PauseSegment[] = pauses.map((p) => ({
    pausedAtISO: p.pausedAt.toISOString(),
    resumedAtISO: p.resumedAt ? p.resumedAt.toISOString() : null,
    reasonCategory: p.reasonCategory,
    reasonComment: p.reasonComment,
    days: p.pauseDurationDays ?? businessDaysBetween(p.pausedAt, p.resumedAt ?? now),
  }));
  const pausedDays = segments.reduce((s, seg) => s + seg.days, 0);
  const elapsed = businessDaysBetween(start, end);
  const activeDays = Math.max(0, elapsed - pausedDays);

  // Derived RL / Mako day counts + allocation pool.
  const rlDays = project ? rlProposedDays(project) : null;
  const makoDays = project ? makoPromisedDays(project) : null;
  const poolDays = project ? allocationPoolDays(project) : 0;
  const allocatedDays = milestones.reduce((s, m) => s + (m.allocatedDays ?? 0), 0);

  const cards = [
    { label: "RL Proposed", value: rlDays != null ? `${rlDays} Days` : "—", sub: "RL start → end" },
    {
      label: "Mako Promised",
      value: makoDays != null ? `${makoDays} Days` : "—",
      sub: poolDays > 0 ? `${allocatedDays} Days allocated` : "Mako start → end",
      danger: allocatedDays > poolDays && poolDays > 0,
    },
    { label: "Milestones", value: `${doneMilestones}/${milestones.length}`, sub: "done" },
    { label: "Open Deps", value: openDeps, sub: `${breached} breached`, danger: breached > 0 },
    { label: "Pending Approvals", value: pendingApprovals },
    { label: "Open Tickets", value: openTickets },
    { label: "Change Requests", value: changeRequests },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{c.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{c.value}</p>
            {c.sub && (
              <p className={`text-xs ${c.danger ? "text-danger" : "text-muted"}`}>{c.sub}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Active vs Paused timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Active &amp; Paused Timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <PauseActiveTimeline
            startISO={start.toISOString()}
            endISO={end.toISOString()}
            nowISO={now.toISOString()}
            pauses={segments}
            activeDays={activeDays}
            pausedDays={pausedDays}
            ongoing={ongoing}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timeline Break-up</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <LazyDelayAttributionDonut data={attrData} />
          </CardContent>
        </Card>

        {description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-2">{description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
