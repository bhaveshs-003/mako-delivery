import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchMilestoneSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { workingDaysBetween } from "@/lib/working-days";
import { holidaySet } from "@/lib/holidays";

// PATCH /api/milestones/[id] — edit or change work status.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "milestone.crud"))
    return badRequest("You do not have permission to modify milestones");

  const parsed = await readJson(req, patchMilestoneSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const milestone = await prisma.milestone.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } },
    },
  });
  if (!milestone) return notFound("Milestone not found");
  if (!canActOnProject(user, milestone.project))
    return badRequest("You are not assigned to this project");

  // A milestone is locked from structural edits/reordering once its plan (main
  // scope) or its own approval (CR/delta) is submitted or approved. Work-status
  // changes remain allowed (execution).
  const planLocked =
    milestone.project.milestonePlanStatus === "approved" ||
    milestone.project.milestonePlanStatus === "pending_approval";
  const mLocked =
    milestone.type === "main_scope"
      ? planLocked
      : milestone.approvalStatus === "approved" || milestone.approvalStatus === "pending";
  if (mLocked && (body.action === "edit" || body.action === "assign_owner" || body.action === "reorder"))
    return badRequest("This milestone is locked (submitted or approved) and can't be edited");

  // ── Reorder: swap sortOrder with the adjacent sibling ─────────────────────
  if (body.action === "reorder") {
    if (!body.direction) return badRequest("A direction is required to reorder");
    const siblings = await prisma.milestone.findMany({
      where: { projectId: milestone.projectId, isArchived: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });
    const idx = siblings.findIndex((s) => s.id === milestone.id);
    const swapIdx = body.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length)
      return badRequest("Milestone is already at the edge");
    const a = siblings[idx];
    const b = siblings[swapIdx];
    await prisma.$transaction(async (tx) => {
      await tx.milestone.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } });
      await tx.milestone.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "milestone.reorder", entityType: "milestone", entityId: a.id, after: { direction: body.direction }, metadata: { projectId: milestone.projectId } },
        tx
      );
    });
    return ok({ reordered: true });
  }

  // The project must be started before any milestone status can change.
  if (body.action === "status" && milestone.project.status !== "in_progress")
    return badRequest("Start the project before changing milestone statuses");

  // Spec §7.2: a milestone cannot be 'submitted' while it has blocked subtasks.
  if (body.action === "status" && body.status === "submitted") {
    const blocked = await prisma.subtask.count({
      where: { milestoneId: milestone.id, status: "blocked" },
    });
    if (blocked > 0)
      return badRequest(`Cannot submit: ${blocked} subtask(s) are still blocked`);
  }

  // Assign (or clear) the milestone owner — must be a resource on this project.
  if (body.action === "assign_owner") {
    if (body.ownerId) {
      const isProjectResource = milestone.project.resources.some((r) => r.userId === body.ownerId);
      if (!isProjectResource)
        return badRequest("The owner must be a resource assigned to this project");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.milestone.update({
        where: { id: milestone.id },
        data: { ownerId: body.ownerId ?? null },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "milestone.assign_owner", entityType: "milestone", entityId: m.id, before: { ownerId: milestone.ownerId }, after: { ownerId: m.ownerId }, metadata: { projectId: milestone.projectId } },
        tx
      );
      return m;
    });
    if (body.ownerId) {
      await notify({
        recipientId: body.ownerId,
        type: "subtask_assigned",
        title: `Assigned milestone: ${milestone.name}`,
        body: `You were assigned as owner of "${milestone.name}" on ${milestone.project.title}.`,
        entityType: "milestone",
        entityId: milestone.id,
        projectId: milestone.projectId,
        deepLinkPath: `/projects/${milestone.projectId}?tab=lifecycle`,
      });
    }
    return ok(updated);
  }

  const holidays = await holidaySet(milestone.projectId);
  const wd = (s?: Date | null, e?: Date | null) =>
    workingDaysBetween(s, e, { includeWeekends: milestone.project.includeWeekends, holidays });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.milestone.update({
        where: { id: milestone.id },
        data:
          body.action === "status"
            ? { status: body.status }
            : {
                name: body.name ?? undefined,
                description: body.description ?? undefined,
                ownerId: body.ownerId ?? undefined,
                startDate: body.startDate ?? undefined,
                dueDate: body.dueDate ?? undefined,
                allocatedDays:
                  body.startDate !== undefined || body.dueDate !== undefined
                    ? wd(body.startDate ?? milestone.startDate, body.dueDate ?? milestone.dueDate)
                    : undefined,
              },
      });

      // Replace subtasks when an explicit set is supplied on an edit.
      if (body.action === "edit" && body.subtasks) {
        await tx.subtask.deleteMany({ where: { milestoneId: milestone.id } });
        if (body.subtasks.length) {
          await tx.subtask.createMany({
            data: body.subtasks.map((s, i) => ({
              milestoneId: milestone.id,
              title: s.title,
              description: s.description ?? null,
              assignedToId: s.assignedToId ?? null,
              startDate: s.startDate ?? null,
              dueDate: s.dueDate ?? null,
              allocatedDays: wd(s.startDate, s.dueDate),
              sortOrder: i,
              createdBy: user.id,
            })),
          });
        }
      }

      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: body.action === "status" ? "milestone.status_change" : "milestone.edit",
          entityType: "milestone",
          entityId: m.id,
          before: { status: milestone.status },
          after: { status: m.status, name: m.name },
          metadata: { projectId: milestone.projectId },
        },
        tx
      );
      return m;
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
