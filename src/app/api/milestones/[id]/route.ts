import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchMilestoneSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

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

  // Structural edits (name/description/owner/days) are locked once the plan is
  // submitted or approved. Work-status changes remain allowed (execution).
  const planLocked =
    milestone.project.milestonePlanStatus === "approved" ||
    milestone.project.milestonePlanStatus === "pending_approval";
  if (planLocked && (body.action === "edit" || body.action === "assign_owner"))
    return badRequest("The milestone plan is locked; milestones can't be edited");

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
                dueDate: body.dueDate ?? undefined,
                allocatedDays: body.allocatedDays ?? undefined,
              },
      });
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
