import { prisma } from "@/lib/db";
import { deriveDependencyState } from "@/lib/sla";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DelayAttributionDonut, type AttributionDatum } from "@/components/charts/DelayAttributionDonut";

export async function OverviewTab({
  projectId,
  description,
}: {
  projectId: string;
  description: string | null;
}) {
  const now = new Date();
  const [milestones, dependencies, pendingApprovals, openTickets, changeRequests, pauses] =
    await Promise.all([
      prisma.milestone.findMany({ where: { projectId }, select: { status: true } }),
      prisma.dependency.findMany({ where: { projectId } }),
      prisma.approvalRequest.count({ where: { projectId, status: "pending" } }),
      prisma.ticketProject.count({ where: { projectId, ticket: { status: { notIn: ["closed", "resolved"] } } } }),
      prisma.changeRequest.count({ where: { projectId, status: { notIn: ["approved", "rejected"] } } }),
      prisma.pauseHistory.findMany({ where: { projectId }, select: { reasonCategory: true, pauseDurationDays: true } }),
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

  const cards = [
    { label: "Milestones", value: `${doneMilestones}/${milestones.length}`, sub: "done" },
    { label: "Open Deps", value: openDeps, sub: `${breached} breached`, danger: breached > 0 },
    { label: "Pending Approvals", value: pendingApprovals },
    { label: "Open Tickets", value: openTickets },
    { label: "Change Requests", value: changeRequests },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-slate">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-navy">{c.value}</p>
            {c.sub && (
              <p className={`text-xs ${c.danger ? "text-danger" : "text-slate"}`}>{c.sub}</p>
            )}
          </Card>
        ))}
      </div>

      {description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate">{description}</p>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Delay Attribution</CardTitle>
        </CardHeader>
        <CardContent>
          <DelayAttributionDonut data={attrData} />
        </CardContent>
      </Card>
    </div>
  );
}
