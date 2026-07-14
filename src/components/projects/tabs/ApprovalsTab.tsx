import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RequestApprovalForm } from "@/components/forms/RequestApprovalForm";
import { ApprovalDecision } from "@/components/projects/ApprovalDecision";
import { formatDate } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

export async function ApprovalsTab({
  projectId,
  userId,
  canRequest,
  canDecide,
}: {
  projectId: string;
  userId: string;
  canRequest: boolean;
  canDecide: boolean;
}) {
  const now = new Date();
  const [approvals, milestones] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { projectId },
      orderBy: { requestedAt: "desc" },
      include: {
        milestone: { select: { name: true } },
        requestedBy: { select: { name: true } },
      },
    }),
    prisma.milestone.findMany({
      // Only CR / delta milestones are individually approvable here; main-scope
      // is approved via the whole milestone plan.
      where: { projectId, isArchived: false, type: { not: "main_scope" } },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Approvals</h2>
        {canRequest && milestones.length > 0 && (
          <RequestApprovalForm projectId={projectId} milestones={milestones} />
        )}
      </div>

      {approvals.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No approval requests" subtitle="Request RL sign-off on a completed milestone to start the SLA clock." />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => {
            const breached = a.status === "pending" && a.slaDeadline && now > a.slaDeadline;
            const daysLeft = a.slaDeadline
              ? Math.ceil((a.slaDeadline.getTime() - now.getTime()) / 86400000)
              : null;
            const borderColor =
              a.status === "approved"
                ? "border-l-success"
                : a.status === "rejected"
                  ? "border-l-danger"
                  : breached
                    ? "border-l-danger"
                    : "border-l-steel";
            // The RL user who is NOT the requester may decide (spec §3.3.1).
            const showDecision =
              canDecide && a.status === "pending" && a.requestedById !== userId;

            return (
              <div key={a.id} className={`rounded-lg border border-l-4 border-border bg-surface p-4 shadow-card ${borderColor}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    <span className="font-medium text-navy">{a.milestone.name}</span>
                    {breached && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-danger">
                        SLA BREACHED
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate">
                    {a.status === "pending" && daysLeft !== null
                      ? breached
                        ? `${Math.abs(daysLeft)}d overdue`
                        : `${daysLeft}d remaining`
                      : formatDate(a.decidedAt)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate">
                  Requested by {a.requestedBy.name} · {formatDate(a.requestedAt)}
                </p>
                <p className="mt-2 rounded-md bg-bg px-3 py-2 text-sm text-navy">
                  {a.requestComment}
                </p>

                {a.status !== "pending" && a.decisionComment && (
                  <div className="mt-2 border-t border-border pt-2 text-sm">
                    <span className="font-medium text-navy">RL decision:</span>{" "}
                    <span className="text-slate">{a.decisionComment}</span>
                  </div>
                )}

                {showDecision && <ApprovalDecision approvalId={a.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
