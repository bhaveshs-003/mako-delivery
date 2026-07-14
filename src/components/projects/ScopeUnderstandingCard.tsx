import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UploadScopeForm } from "@/components/forms/UploadScopeForm";
import { ScopeDecision } from "@/components/projects/ScopeDecision";
import { FileText, ShieldCheck } from "lucide-react";

/**
 * Scope Understanding gate. The PM uploads a scope document; the RL POC
 * approves/rejects it. Milestone creation and project start are blocked until it
 * is approved. A rejection lets the PM upload a revised document (new cycle).
 */
export async function ScopeUnderstandingCard({
  projectId,
  canSubmit,
  canDecide,
  decerId,
}: {
  projectId: string;
  canSubmit: boolean;
  canDecide: boolean;
  decerId: string;
}) {
  const doc = await prisma.scopeDocument.findFirst({
    where: { projectId, status: { not: "superseded" } },
    orderBy: { submittedAt: "desc" },
  });
  const url = doc ? await getDownloadUrl(doc.fileKey) : null;
  const status = doc?.status ?? null;
  const ownSubmission = doc?.submittedById === decerId;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted" /> Scope Understanding
        </CardTitle>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} />}
          {canSubmit && (status === null || status === "rejected") && (
            <UploadScopeForm projectId={projectId} resubmit={status === "rejected"} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {!doc ? (
          <p className="text-sm text-muted">
            No scope document uploaded yet. Milestones and starting the project are locked until
            the RL POC approves a scope understanding document.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink hover:underline"
              >
                <FileText className="h-4 w-4" /> {doc.filename}
              </a>
              <span className="text-2xs text-muted">
                Submitted {formatDate(doc.submittedAt)}
                {doc.decidedAt && ` · decided ${formatDate(doc.decidedAt)}`}
                {doc.approvalDurationDays != null && ` · ${doc.approvalDurationDays}d to decide`}
              </span>
            </div>

            {doc.note && (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">{doc.note}</p>
            )}

            {status === "pending" && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-sm text-muted">
                  {canDecide ? "Review and decide this scope submission." : "Awaiting RL POC approval."}
                </p>
                {canDecide && !ownSubmission && <ScopeDecision projectId={projectId} />}
              </div>
            )}

            {status === "rejected" && doc.decisionComment && (
              <div className="border-t border-line pt-3 text-sm">
                <span className="font-medium text-danger">Rejected:</span>{" "}
                <span className="text-ink-2">{doc.decisionComment}</span>
              </div>
            )}

            {status === "approved" && (
              <p className="border-t border-line pt-3 text-sm text-success">
                Approved by RL — milestones and project start are unlocked.
                {doc.decisionComment && <span className="text-ink-2"> “{doc.decisionComment}”</span>}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
