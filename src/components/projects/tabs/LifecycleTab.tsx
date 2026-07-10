import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { SubtaskStatusControl } from "@/components/projects/SubtaskStatusControl";
import { MilestoneStatusControl } from "@/components/projects/MilestoneStatusControl";
import { AddMilestoneForm } from "@/components/forms/AddMilestoneForm";
import { MilestoneDetail } from "@/components/projects/MilestoneDetail";
import { getDownloadUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { ListChecks, AlertTriangle } from "lucide-react";

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
  const milestones = await prisma.milestone.findMany({
    where: { projectId, isArchived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      owner: { select: { name: true, isActive: true } },
      subtasks: { orderBy: { sortOrder: "asc" }, include: { assignedTo: { select: { name: true } } } },
    },
  });

  // Per-milestone comments, attachments, and the project's assignable resources
  // (used for owner assignment + comment tagging).
  const [commentRows, attachmentRows, projectResources] = await Promise.all([
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

  const resources = projectResources.map((r) => ({ id: r.user.id, name: r.user.name }));
  const commentsByMilestone = new Map<string, typeof commentRows>();
  for (const c of commentRows) {
    if (!c.milestoneId) continue;
    (commentsByMilestone.get(c.milestoneId) ?? commentsByMilestone.set(c.milestoneId, []).get(c.milestoneId)!).push(c);
  }
  const docsByMilestone = new Map<string, { id: string; filename: string; url: string; uploadedByName: string }[]>();
  for (const a of attachmentRows) {
    if (!a.milestoneId) continue;
    const url = await getDownloadUrl(a.fileKey);
    const list = docsByMilestone.get(a.milestoneId) ?? docsByMilestone.set(a.milestoneId, []).get(a.milestoneId)!;
    list.push({ id: a.id, filename: a.filename, url, uploadedByName: a.uploadedBy.name });
  }

  // Group milestones by their parent template stage.
  const stages = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const key = m.parentStage ?? "Ungrouped";
    if (!stages.has(key)) stages.set(key, []);
    stages.get(key)!.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy">Lifecycle & Milestones</h2>
          <p className="text-sm text-slate">{milestones.length} milestones</p>
        </div>
        {canManage && <AddMilestoneForm projectId={projectId} />}
      </div>

      {milestones.length === 0 ? (
        <EmptyState icon={ListChecks} title="No milestones yet" subtitle="Add milestones or load them from the project's lifecycle template." />
      ) : (
        <div className="space-y-4">
          {Array.from(stages.entries()).map(([stage, list]) => {
            const allDone = list.every((m) => m.status === "completed");
            return (
              <div
                key={stage}
                className={`rounded-lg border-l-4 bg-surface shadow-card ${allDone ? "border-l-success" : "border-l-steel"}`}
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="font-semibold text-navy">{stage}</h3>
                  {allDone && <StatusBadge status="completed" />}
                </div>
                <div className="divide-y divide-border">
                  {list.map((m) => (
                    <div key={m.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-navy">{m.name}</span>
                          {m.approvalStatus !== "not_required" && (
                            <StatusBadge status={m.approvalStatus} />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {m.owner && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate">
                              <UserAvatar name={m.owner.name} deactivated={!m.owner.isActive} size="sm" />
                              {m.owner.name}
                            </span>
                          )}
                          {m.dueDate && (
                            <span className="text-xs text-slate">{formatDate(m.dueDate)}</span>
                          )}
                          {canManage ? (
                            <MilestoneStatusControl milestoneId={m.id} status={m.status} />
                          ) : (
                            <StatusBadge status={m.status} />
                          )}
                        </div>
                      </div>

                      {m.subtasks.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-4">
                          {m.subtasks.map((s) => {
                            const canEditSubtask =
                              canManage || (userRole === "resource" && s.assignedToId === userId);
                            return (
                              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  {s.status === "blocked" && <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
                                  <span className="text-sm text-navy">{s.title}</span>
                                  {s.assignedTo && (
                                    <span className="text-xs text-slate">· {s.assignedTo.name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {s.status === "blocked" && s.blockedReason && (
                                    <span className="max-w-[240px] truncate text-xs text-danger" title={s.blockedReason}>
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
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
