import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RaiseCRForm } from "@/components/forms/RaiseCRForm";
import { CRDecision } from "@/components/projects/CRDecision";
import { formatDate } from "@/lib/utils";
import { GitPullRequest } from "lucide-react";

export async function ChangeRequestsTab({
  projectId,
  canRaise,
  canDecide,
}: {
  projectId: string;
  canRaise: boolean;
  canDecide: boolean;
}) {
  const crs = await prisma.changeRequest.findMany({
    where: { projectId },
    orderBy: { raisedAt: "desc" },
    include: { raisedBy: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Change Requests</h2>
        {canRaise && <RaiseCRForm projectId={projectId} />}
      </div>

      {crs.length === 0 ? (
        <EmptyState icon={GitPullRequest} title="No change requests" subtitle="Formalize scope changes so timeline impact is tracked and RL-approved." />
      ) : (
        <div className="space-y-3">
          {crs.map((cr) => {
            const border =
              cr.status === "approved" ? "border-l-success" : cr.status === "rejected" ? "border-l-danger" : "border-l-steel";
            return (
              <div key={cr.id} className={`rounded-lg border border-l-4 border-border bg-surface p-4 shadow-card ${border}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={cr.status} />
                  <span className="text-xs text-slate">
                    {cr.raisedBy.name} · {formatDate(cr.raisedAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-navy"><span className="font-medium">Scope:</span> {cr.scopeDelta}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate">
                  <span>Timeline impact: <span className="font-medium text-navy">+{cr.timelineImpactDays ?? 0} days</span></span>
                  {cr.effortImpactDescription && <span>Effort: {cr.effortImpactDescription}</span>}
                </div>
                {cr.timelineAdjusted && (
                  <p className="mt-1 text-xs text-success">✓ Timeline auto-adjusted on approval</p>
                )}
                {cr.status !== "pending_rl_approval" && cr.decisionComment && (
                  <div className="mt-2 border-t border-border pt-2 text-sm">
                    <span className="font-medium text-navy">RL decision:</span> <span className="text-slate">{cr.decisionComment}</span>
                  </div>
                )}
                {canDecide && cr.status === "pending_rl_approval" && <CRDecision crId={cr.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
