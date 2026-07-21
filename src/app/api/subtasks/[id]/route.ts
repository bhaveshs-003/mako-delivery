import { requireUser, toAuditActor } from "@/lib/session";
import { canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchSubtaskSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

// PATCH /api/subtasks/[id] — update status. Resources may update only their own
// assigned subtasks; PMs/Admins may update any within their project. Marking
// 'blocked' requires a reason (spec §3.3.2) and pings the PM (spec §7.5).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, patchSubtaskSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const subtask = await prisma.subtask.findUnique({
    where: { id: params.id },
    include: {
      milestone: {
        include: { project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } } },
      },
    },
  });
  if (!subtask) return notFound("Subtask not found");

  const project = subtask.milestone.project;
  const isOwnResourceTask =
    user.role === "resource" && subtask.assignedToId === user.id;
  const isManager =
    (user.role === "super_admin" || user.role === "admin" || user.role === "sub_admin") &&
    canActOnProject(user, project);
  if (!isOwnResourceTask && !isManager) {
    return badRequest("You do not have permission to update this subtask");
  }
  if (project.status !== "in_progress")
    return badRequest("Start the project before changing task statuses");

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.subtask.update({
        where: { id: subtask.id },
        data: {
          status: body.status,
          blockedReason: body.status === "blocked" ? body.blockedReason : null,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "subtask.status_change", entityType: "subtask", entityId: s.id, before: { status: subtask.status }, after: { status: s.status }, metadata: { projectId: project.id } },
        tx
      );
      return s;
    });

    if (body.status === "blocked" && project.projectLeadId) {
      await notify({
        recipientId: project.projectLeadId,
        type: "subtask_blocked",
        title: `Task blocked on ${project.title}`,
        body: `"${subtask.title}" was marked blocked: ${body.blockedReason}`,
        entityType: "subtask",
        entityId: subtask.id,
        projectId: project.id,
        deepLinkPath: `/projects/${project.id}?tab=lifecycle`,
      });
    }
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
