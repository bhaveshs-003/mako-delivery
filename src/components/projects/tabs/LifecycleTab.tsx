import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { SubtaskStatusControl } from "@/components/projects/SubtaskStatusControl";
import { MilestoneStatusControl } from "@/components/projects/MilestoneStatusControl";
import { SubmitMilestoneApproval } from "@/components/projects/SubmitMilestoneApproval";
import { AddMilestoneForm } from "@/components/forms/AddMilestoneForm";
import { MilestoneDetail } from "@/components/projects/MilestoneDetail";
import { getDownloadUrl } from "@/lib/storage";
import { projectTotalDays } from "@/lib/allocation";
import { formatDate } from "@/lib/utils";
import { ListChecks, AlertTriangle, Check } from "lucide-react";

// Small status → dot color, for the leading indicators in the hierarchy.
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
  userId,
  userRole,
}: {
  projectId: string;
  canManage: boolean;
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

  const [project, commentRows, attachmentRows, projectResources] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { createdAt: true, rlCommittedDeadline: true },
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
  ]);

  // Planning-day budget: total project days vs. what's allocated to milestones.
  const totalDays = project?.rlCommittedDeadline
    ? projectTotalDays(project.createdAt, project.rlCommittedDeadline)
    : 0;
  const usedDays = milestones.reduce((s, m) => s + (m.allocatedDays ?? 0), 0);

  const resources = projectResources.map((r) => ({ id: r.user.id, name: r.user.name }));
  const commentsByMilestone = new Map<string, typeof commentRows>();
  for (const c of commentRows) {
    if (!c.milestoneId) continue;
    (commentsByMilestone.get(c.milestoneId) ?? commentsByMilestone.set(c.milestoneId, []).get(c.milestoneId)!).push(c);
  }
  // Sign all download URLs in parallel (S3 presign is fast but sequential
  // awaits still add up when a project has many attachments).
  const signed = await Promise.all(
    attachmentRows.map(async (a) => ({ a, url: await getDownloadUrl(a.fileKey) }))
  );
  const docsByMilestone = new Map<string, { id: string; filename: string; url: string; uploadedByName: string }[]>();
  for (const { a, url } of signed) {
    if (!a.milestoneId) continue;
    const list = docsByMilestone.get(a.milestoneId) ?? docsByMilestone.set(a.milestoneId, []).get(a.milestoneId)!;
    list.push({ id: a.id, filename: a.filename, url, uploadedByName: a.uploadedBy.name });
  }

  // Group milestones by their parent template stage (preserve order).
  const stages: [string, typeof milestones][] = [];
  const stageIndex = new Map<string, number>();
  for (const m of milestones) {
    const key = m.parentStage ?? "Ungrouped";
    if (!stageIndex.has(key)) {
      stageIndex.set(key, stages.length);
      stages.push([key, []]);
    }
    stages[stageIndex.get(key)!][1].push(m);
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
          />
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState icon={ListChecks} title="No milestones yet" subtitle="Add milestones or load them from the project's lifecycle template." />
      ) : (
        <ol className="mt-1">
          {stages.map(([stage, list], si) => {
            const total = list.length;
            const done = list.filter((m) => m.status === "completed").length;
            const state =
              done === total ? "complete" : list.some((m) => m.status !== "yet_to_start") ? "active" : "pending";
            const isLast = si === stages.length - 1;

            return (
              <li key={stage} className="grid grid-cols-[24px_1fr] gap-x-3">
                {/* Rail + node */}
                <div className="relative flex justify-center">
                  {!isLast && (
                    <span className="absolute left-1/2 top-6 bottom-0 w-px -translate-x-1/2 bg-line" />
                  )}
                  <span
                    className={`relative z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold ring-4 ring-canvas ${
                      state === "complete"
                        ? "bg-success text-white"
                        : state === "active"
                          ? "bg-brand text-white"
                          : "border border-line-strong bg-surface text-muted"
                    }`}
                  >
                    {state === "complete" ? <Check className="h-3.5 w-3.5" /> : si + 1}
                  </span>
                </div>

                {/* Stage content */}
                <div className={isLast ? "pb-1" : "pb-5"}>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <h3 className="text-sm font-semibold text-ink">{stage}</h3>
                    <span className="tabular rounded-full bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted">
                      {done}/{total}
                    </span>
                    {state === "complete" && <StatusBadge status="completed" />}
                  </div>

                  <div className="mt-2 space-y-2">
                    {list.map((m) => {
                      const subDone = m.subtasks.filter((s) => s.status === "done").length;
                      const overdue =
                        m.dueDate && m.status !== "completed" && new Date(m.dueDate) < now;
                      return (
                        <div
                          key={m.id}
                          className="rounded-lg border border-line bg-surface transition-shadow hover:shadow-xs"
                        >
                          {/* Milestone header */}
                          <div className="flex items-start justify-between gap-3 p-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[m.status] ?? "bg-muted"}`} />
                                <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                                {m.allocatedDays != null && (
                                  <span className="tabular shrink-0 rounded-md bg-brand/10 px-1.5 py-0.5 text-2xs font-medium text-brand-ink">
                                    {m.allocatedDays}d
                                  </span>
                                )}
                                {m.approvalStatus !== "not_required" && (
                                  <StatusBadge status={m.approvalStatus} />
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-2xs text-muted">
                                {m.subtasks.length > 0 && (
                                  <span className="tabular">{subDone}/{m.subtasks.length} subtasks</span>
                                )}
                                {m.dueDate && (
                                  <span className={overdue ? "font-medium text-danger" : ""}>
                                    Due {formatDate(m.dueDate)}
                                  </span>
                                )}
                                {m.owner && (
                                  <span className="inline-flex items-center gap-1">
                                    <UserAvatar name={m.owner.name} deactivated={!m.owner.isActive} size="sm" />
                                    {m.owner.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {canManage &&
                                (m.approvalStatus === "not_required" ||
                                  m.approvalStatus === "rejected") && (
                                  <SubmitMilestoneApproval
                                    projectId={projectId}
                                    milestoneId={m.id}
                                    resubmit={m.approvalStatus === "rejected"}
                                  />
                                )}
                              {canManage ? (
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
                                  <div
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-surface"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.status] ?? "bg-muted"}`} />
                                      {s.status === "blocked" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />}
                                      <span className="truncate text-sm text-ink-2">{s.title}</span>
                                      {s.assignedTo && (
                                        <span className="shrink-0 text-2xs text-muted">· {s.assignedTo.name}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {s.allocatedDays != null && (
                                        <span className="tabular shrink-0 text-2xs text-muted">{s.allocatedDays}d</span>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
