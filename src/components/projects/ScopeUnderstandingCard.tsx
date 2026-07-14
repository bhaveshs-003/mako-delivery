import { prisma } from "@/lib/db";
import type { ScopeDocument } from "@prisma/client";
import { getDownloadUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UploadScopeForm } from "@/components/forms/UploadScopeForm";
import { ScopeDecision } from "@/components/projects/ScopeDecision";
import { FileText, ShieldCheck, GitPullRequestArrow } from "lucide-react";

type SignedDoc = { doc: ScopeDocument; url: string };

/**
 * Scope Understanding gate + change requests. The PM uploads the scope doc; the
 * RL POC approves/rejects it. Once approved the scope is LOCKED (no re-upload) —
 * further changes are raised as Change Request documents that follow the exact
 * same approval flow, each shown as its own card.
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
  const [project, docs] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { scopeApproved: true } }),
    prisma.scopeDocument.findMany({ where: { projectId }, orderBy: { submittedAt: "desc" } }),
  ]);
  const signed = await Promise.all(
    docs.map(async (d) => ({ doc: d, url: await getDownloadUrl(d.fileKey) }))
  );

  const scopeDocs = signed.filter((s) => s.doc.kind === "scope");
  const crDocs = signed.filter((s) => s.doc.kind === "change_request");

  const scopeApproved = project?.scopeApproved ?? false;
  const scopePending = scopeDocs.some((s) => s.doc.status === "pending");
  const canUploadScope = canSubmit && !scopeApproved && !scopePending;
  const canRaiseCR = canSubmit && scopeApproved;

  const renderDoc = ({ doc, url }: SignedDoc, isLatest: boolean) => (
    <div
      key={doc.id}
      className={`rounded-lg border px-3 py-2.5 ${
        isLatest ? "border-line bg-surface" : "border-line/60 bg-surface-2/40 opacity-90"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {doc.title && <p className="truncate text-sm font-medium text-ink">{doc.title}</p>}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink hover:underline"
          >
            <FileText className="h-4 w-4" /> {doc.filename}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {doc.timelineImpactDays != null && doc.timelineImpactDays > 0 && (
            <span className="tabular rounded-md bg-warning/10 px-1.5 py-0.5 text-2xs font-medium text-warning">
              {doc.timelineAdjusted ? "+" : "±"}{doc.timelineImpactDays}d timeline
            </span>
          )}
          <StatusBadge status={doc.status} />
          <span className="text-2xs text-muted">
            {formatDate(doc.submittedAt)}
            {doc.approvalDurationDays != null && ` · ${doc.approvalDurationDays}d to decide`}
          </span>
        </div>
      </div>

      {doc.note && <p className="mt-2 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-ink-2">{doc.note}</p>}

      {doc.status === "rejected" && doc.decisionComment && (
        <p className="mt-2 text-xs">
          <span className="font-medium text-danger">Rejected:</span>{" "}
          <span className="text-ink-2">{doc.decisionComment}</span>
        </p>
      )}
      {doc.status === "approved" && doc.decisionComment && (
        <p className="mt-2 text-xs text-success">“{doc.decisionComment}”</p>
      )}

      {doc.status === "pending" && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <p className="text-xs text-muted">
            {canDecide ? "Review and decide this submission." : "Awaiting RL POC approval."}
          </p>
          {canDecide && doc.submittedById !== decerId && (
            <ScopeDecision projectId={projectId} scopeDocumentId={doc.id} />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Scope understanding */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted" /> Scope Understanding
          </CardTitle>
          <div className="flex items-center gap-2">
            {scopeDocs[0] && <StatusBadge status={scopeDocs[0].doc.status} />}
            {canUploadScope && (
              <UploadScopeForm projectId={projectId} resubmit={scopeDocs.length > 0} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {scopeDocs.length === 0 ? (
            <p className="text-sm text-muted">
              No scope document uploaded yet. Milestones and starting the project are locked until
              the RL POC approves a scope understanding document.
            </p>
          ) : (
            <>
              {scopeDocs.map((s, i) => renderDoc(s, i === 0))}
              {scopeApproved && (
                <p className="text-xs text-success">
                  Scope is approved and locked — raise a change request below to change it.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Change requests (only once scope is approved or some exist) */}
      {(scopeApproved || crDocs.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <GitPullRequestArrow className="h-4 w-4 text-muted" /> Change Requests
            </CardTitle>
            {canRaiseCR && <UploadScopeForm projectId={projectId} kind="change_request" />}
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {crDocs.length === 0 ? (
              <p className="text-sm text-muted">
                No change requests. Raise one to propose a change to the approved scope — it follows
                the same RL approval flow.
              </p>
            ) : (
              crDocs.map((s, i) => renderDoc(s, i === 0))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
