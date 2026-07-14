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
 * is approved. Every submission is kept as its own card (history preserved): a
 * rejection stays visible and re-uploading adds a new card on top.
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
  const docs = await prisma.scopeDocument.findMany({
    where: { projectId },
    orderBy: { submittedAt: "desc" },
  });
  const signed = await Promise.all(
    docs.map(async (d) => ({ doc: d, url: await getDownloadUrl(d.fileKey) }))
  );

  const hasPending = docs.some((d) => d.status === "pending");
  const latestStatus = docs[0]?.status ?? null;
  const canUpload = canSubmit && !hasPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted" /> Scope Understanding
        </CardTitle>
        <div className="flex items-center gap-2">
          {latestStatus && <StatusBadge status={latestStatus} />}
          {canUpload && (
            <UploadScopeForm projectId={projectId} resubmit={docs.length > 0} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {docs.length === 0 ? (
          <p className="text-sm text-muted">
            No scope document uploaded yet. Milestones and starting the project are locked until
            the RL POC approves a scope understanding document.
          </p>
        ) : (
          signed.map(({ doc, url }, i) => {
            const isLatest = i === 0;
            return (
              <div
                key={doc.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  isLatest ? "border-line bg-surface" : "border-line/60 bg-surface-2/40 opacity-90"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink hover:underline"
                  >
                    <FileText className="h-4 w-4" /> {doc.filename}
                  </a>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.status} />
                    <span className="text-2xs text-muted">
                      {formatDate(doc.submittedAt)}
                      {doc.approvalDurationDays != null && ` · ${doc.approvalDurationDays}d to decide`}
                    </span>
                  </div>
                </div>

                {doc.note && (
                  <p className="mt-2 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-ink-2">{doc.note}</p>
                )}

                {doc.status === "rejected" && doc.decisionComment && (
                  <p className="mt-2 text-xs">
                    <span className="font-medium text-danger">Rejected:</span>{" "}
                    <span className="text-ink-2">{doc.decisionComment}</span>
                  </p>
                )}
                {doc.status === "approved" && (
                  <p className="mt-2 text-xs text-success">
                    Approved by RL — milestones and project start are unlocked.
                    {doc.decisionComment && <span className="text-ink-2"> “{doc.decisionComment}”</span>}
                  </p>
                )}

                {doc.status === "pending" && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                    <p className="text-xs text-muted">
                      {canDecide ? "Review and decide this scope submission." : "Awaiting RL POC approval."}
                    </p>
                    {canDecide && doc.submittedById !== decerId && <ScopeDecision projectId={projectId} />}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
