import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchMilestoneSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

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

  // Spec §7.2: a milestone cannot be 'submitted' while it has blocked subtasks.
  if (body.action === "status" && body.status === "submitted") {
    const blocked = await prisma.subtask.count({
      where: { milestoneId: milestone.id, status: "blocked" },
    });
    if (blocked > 0)
      return badRequest(`Cannot submit: ${blocked} subtask(s) are still blocked`);
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
