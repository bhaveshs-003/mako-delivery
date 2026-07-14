import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { SubtaskStatusControl } from "@/components/projects/SubtaskStatusControl";
import { MilestoneStatusControl } from "@/components/projects/MilestoneStatusControl";
import { SubmitMilestoneApproval } from "@/components/projects/SubmitMilestoneApproval";
import { MilestoneReorder } from "@/components/projects/MilestoneReorder";
import { MilestonePlanSubmit } from "@/components/projects/MilestonePlanSubmit";
import { AddMilestoneForm } from "@/components/forms/AddMilestoneForm";
import { EditMilestoneForm } from "@/components/forms/EditMilestoneForm";
import { MilestoneDetail } from "@/components/projects/MilestoneDetail";
import { getDownloadUrl } from "@/lib/storage";
import { allocationPoolDays } from "@/lib/allocation";
import { formatDate } from "@/lib/utils";
import { MILESTONE_TYPE_LABELS } from "@/lib/constants";
import { ListChecks, AlertTriangle, ShieldAlert } from "lucide-react";

// Small status → dot color, for the leading indicators in the list.
const DOT: Record<string, string> = {
  completed: "bg-success",
  done: "bg-success",
  ongoing: "bg-brand",
  in_progress: "bg-brand",
  submitted: "bg-brand",
  revision_requested: "bg-warning",
  blocked: "bg-danger",
  yet_to_start: "bg-muted",
  not_started: "bg-muted",
};

export async function LifecycleTab({
  projectId,
  canManage,
  canDecidePlan = false,
  userId,
  userRole,
}: {
  projectId: string;
  canManage: boolean;
  canDecidePlan?: boolean;
  userId: string;
  userRole: UserRole;
}) {
  const now = new Date();
  const milestones = await prisma.milestone.findMany({
    where: { projectId, isArchived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      owner: { select: { name: true, isActive: true } },
      subtasks: { orderBy: { sortOrder: "asc" }, include: { assignedTo: { select: { name: true } } } },
    },
  });

  const [project, commentRows, attachmentRows, projectResources, approvedCRs] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        rlStartDate: true,
        rlCommittedDeadline: true,
        makoStartDate: true,
        makoInternalDeadline: true,
        scopeApproved: true,
        milestonePlanStatus: true,
        milestonePlanApprovalDays: true,
        milestonePlanDecisionComment: true,
      },
    }),
    prisma.comment.findMany({
      where: { milestoneId: { in: milestones.map((m) => m.id) } },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true } } },
    }),
    prisma.attachment.findMany({
      where: { milestoneId: { in: milestones.map((m) => m.id) }, isCurrent: true },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    prisma.projectResource.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.changeRequest.findMany({
      where: { projectId, status: "approved" },
      select: { id: true, scopeDelta: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalDays = project ? allocationPoolDays(project) : 0;
  const usedDays = milestones.reduce((s, m) => s + (m.allocatedDays ?? 0), 0);

  const scopeApproved = project?.scopeApproved ?? false;
  const planStatus = (project?.milestonePlanStatus ?? "draft") as
    | "draft" | "pending_approval" | "approved" | "rejected";
  const planApproved = planStatus === "approved";
  const planLocked = planApproved || planStatus === "pending_approval";
  const mainScopeCount = milestones.filter((m) => m.type === "main_scope").length;

  const resources = projectResources.map((r) => ({ id: r.user.id, name: r.user.name }));
  const changeRequests = approvedCRs.map((c) => ({
    id: c.id,
    label: c.scopeDelta.length > 60 ? `${c.scopeDelta.slice(0, 60)}…` : c.scopeDelta,
  }));

  const commentsByMilestone = new Map<string, typeof commentRows>();
  for (const c of commentRows) {
    if (!c.milestoneId) continue;
    (commentsByMilestone.get(c.milestoneId) ?? commentsByMilestone.set(c.milestoneId, []).get(c.milestoneId)!).push(c);
  }
  const signed = await Promise.all(
    attachmentRows.map(async (a) => ({ a, url: await getDownloadUrl(a.fileKey) }))
  );
  const docsByMilestone = new Map<string, { id: string; filename: string; url: string; uploadedByName: string }[]>();
  for (const { a, url } of signed) {
    if (!a.milestoneId) continue;
    const list = docsByMilestone.get(a.milestoneId) ?? docsByMilestone.set(a.milestoneId, []).get(a.milestoneId)!;
    list.push({ id: a.id, filename: a.filename, url, uploadedByName: a.uploadedBy.name });
  }

  const doneMilestones = milestones.filter((m) => m.status === "completed").length;
  const overallPct = milestones.length ? Math.round((doneMilestones / milestones.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header + overall progress */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Lifecycle &amp; Milestones</h2>
            <span className="tabular text-xs font-medium text-ink-2">
              {doneMilestones}/{milestones.length} complete
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${overallPct}%` }} />
          </div>
          {totalDays > 0 && (
            <p className="tabular mt-1.5 text-2xs text-muted">
              {usedDays} of {totalDays} timeline days allocated
              {usedDays < totalDays && ` · ${totalDays - usedDays} unallocated`}
              {usedDays > totalDays && (
                <span className="font-medium text-danger"> · over-allocated by {usedDays - totalDays}</span>
              )}
            </p>
          )}
        </div>
        {canManage && (
          <AddMilestoneForm
            projectId={projectId}
            resources={resources}
            totalDays={totalDays}
            usedDays={usedDays}
            planApproved={planApproved}
            changeRequests={changeRequests}
          />
        )}
      </div>

      {/* Scope reminder — informational; the project can't START until scope is approved. */}
      {!scopeApproved && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You can build the milestone plan now, but the project can’t be started until the RL POC
            approves the <span className="font-medium">scope understanding</span> in the{" "}
            <span className="font-medium">Scope Understanding</span> tab.
          </p>
        </div>
      )}

      {milestones.length === 0 ? (
        <EmptyState icon={ListChecks} title="No milestones yet" subtitle="Add milestones, then submit the whole plan to RL for approval." />
      ) : (
        <ol className="space-y-2">
          {milestones.map((m, idx) => {
            const subDone = m.subtasks.filter((s) => s.status === "done").length;
            const overdue = m.dueDate && m.status !== "completed" && new Date(m.dueDate) < now;
            const isMain = m.type === "main_scope";

            // Structural editing is allowed pre-approval; execution (status) post-approval.
            const editable = isMain
              ? canManage && !planLocked
              : canManage && m.approvalStatus !== "approved" && m.approvalStatus !== "pending";
            const reorderable = isMain && canManage && !planLocked;
            const submittable = !isMain && canManage && (m.approvalStatus === "not_required" || m.approvalStatus === "rejected");
            const executable = canManage && (isMain ? planApproved : m.approvalStatus === "approved");

            return (
              <li key={m.id} className="rounded-lg border border-line bg-surface transition-shadow hover:shadow-xs">
                {/* Milestone header */}
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {reorderable && (
                      <MilestoneReorder milestoneId={m.id} isFirst={idx === 0} isLast={idx === milestones.length - 1} />
                    )}
                    <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-2">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[m.status] ?? "bg-muted"}`} />
                        <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                        {!isMain && (
                          <span className="shrink-0 rounded-md bg-attr-client/10 px-1.5 py-0.5 text-2xs font-medium text-attr-client">
                            {MILESTONE_TYPE_LABELS[m.type]}
                          </span>
                        )}
                        {m.allocatedDays != null && (
                          <span className="tabular shrink-0 rounded-md bg-brand/10 px-1.5 py-0.5 text-2xs font-medium text-brand-ink">
                            {m.allocatedDays} Days
                          </span>
                        )}
                        {m.approvalStatus !== "not_required" && <StatusBadge status={m.approvalStatus} />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-2xs text-muted">
                        {m.subtasks.length > 0 && <span className="tabular">{subDone}/{m.subtasks.length} subtasks</span>}
                        {m.dueDate && (
                          <span className={overdue ? "font-medium text-danger" : ""}>Due {formatDate(m.dueDate)}</span>
                        )}
                        {m.approvalDurationDays != null && (
                          <span className="tabular">Approved in {m.approvalDurationDays}d</span>
                        )}
                        {m.owner && (
                          <span className="inline-flex items-center gap-1">
                            <UserAvatar name={m.owner.name} deactivated={!m.owner.isActive} size="sm" />
                            {m.owner.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {editable && (
                      <EditMilestoneForm
                        milestoneId={m.id}
                        resources={resources}
                        initial={{
                          name: m.name,
                          description: m.description ?? "",
                          ownerId: m.ownerId ?? "",
                          allocatedDays: m.allocatedDays != null ? String(m.allocatedDays) : "",
                        }}
                        initialSubtasks={m.subtasks.map((s) => ({
                          title: s.title,
                          assignedToId: s.assignedToId ?? "",
                          days: s.allocatedDays != null ? String(s.allocatedDays) : "",
                        }))}
                        poolTotal={totalDays}
                        poolUsedByOthers={usedDays - (m.allocatedDays ?? 0)}
                      />
                    )}
                    {submittable && (
                      <SubmitMilestoneApproval
                        projectId={projectId}
                        milestoneId={m.id}
                        resubmit={m.approvalStatus === "rejected"}
                      />
                    )}
                    {executable ? (
                      <MilestoneStatusControl milestoneId={m.id} status={m.status} />
                    ) : (
                      <StatusBadge status={m.status} />
                    )}
                  </div>
                </div>

                {/* Subtasks */}
                {m.subtasks.length > 0 && (
                  <div className="space-y-0.5 border-t border-line bg-surface-2/40 px-3 py-2">
                    {m.subtasks.map((s) => {
                      const canEditSubtask =
                        canManage || (userRole === "resource" && s.assignedToId === userId);
                      return (
                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-surface">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.status] ?? "bg-muted"}`} />
                            {s.status === "blocked" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />}
                            <span className="truncate text-sm text-ink-2">{s.title}</span>
                            {s.assignedTo && <span className="shrink-0 text-2xs text-muted">· {s.assignedTo.name}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {s.allocatedDays != null && (
                              <span className="tabular shrink-0 text-2xs text-muted">{s.allocatedDays} Days</span>
                            )}
                            {s.status === "blocked" && s.blockedReason && (
                              <span className="max-w-[220px] truncate text-2xs text-danger" title={s.blockedReason}>
                                {s.blockedReason}
                              </span>
                            )}
                            {canEditSubtask ? (
                              <SubtaskStatusControl subtaskId={s.id} status={s.status} />
                            ) : (
                              <StatusBadge status={s.status} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Owner / comments / documents */}
                <div className="border-t border-line px-3 py-2">
                  <MilestoneDetail
                    milestoneId={m.id}
                    ownerId={m.ownerId}
                    canManage={canManage}
                    resources={resources}
                    comments={(commentsByMilestone.get(m.id) ?? []).map((c) => ({
                      id: c.id,
                      authorId: c.authorId,
                      authorName: c.author.name,
                      content: c.content,
                      createdAt: c.createdAt.toISOString(),
                      isEdited: c.isEdited,
                    }))}
                    documents={docsByMilestone.get(m.id) ?? []}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Whole-plan approval footer */}
      {scopeApproved && mainScopeCount > 0 && (
        <MilestonePlanSubmit
          projectId={projectId}
          status={planStatus}
          milestoneCount={mainScopeCount}
          decisionComment={project?.milestonePlanDecisionComment ?? null}
          approvalDays={project?.milestonePlanApprovalDays ?? null}
          canManage={canManage}
          canDecide={canDecidePlan}
        />
      )}
    </div>
  );
}
