import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createSubtaskSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

// POST /api/subtasks — add a subtask under a milestone (Sub-admin scoped).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "milestone.crud"))
    return badRequest("You do not have permission to add subtasks");

  const parsed = await readJson(req, createSubtaskSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const milestone = await prisma.milestone.findUnique({
    where: { id: input.milestoneId },
    include: {
      project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } },
    },
  });
  if (!milestone) return notFound("Milestone not found");
  if (!canActOnProject(user, milestone.project))
    return badRequest("You are not assigned to this project");

  try {
    const count = await prisma.subtask.count({ where: { milestoneId: input.milestoneId } });
    const subtask = await prisma.$transaction(async (tx) => {
      const s = await tx.subtask.create({
        data: {
          milestoneId: input.milestoneId,
          title: input.title,
          assignedToId: input.assignedToId ?? null,
          dueDate: input.dueDate ?? null,
          sortOrder: count,
          createdBy: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "subtask.create", entityType: "subtask", entityId: s.id, after: { title: s.title }, metadata: { projectId: milestone.projectId } },
        tx
      );
      return s;
    });

    if (input.assignedToId) {
      await notify({
        recipientId: input.assignedToId,
        type: "subtask_assigned",
        title: `New task: ${input.title}`,
        body: `You have been assigned a task on ${milestone.project.title}.`,
        entityType: "subtask",
        entityId: subtask.id,
        projectId: milestone.projectId,
        deepLinkPath: `/tasks`,
      });
    }
    return ok(subtask, 201);
  } catch (e) {
    return serverError(e);
  }
}
