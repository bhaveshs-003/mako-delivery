import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { reorderMilestonesSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// POST /api/projects/[id]/milestone-order — persist a drag-drop reorder. The
// body is the full ordered list of milestone ids; sortOrder is rewritten to
// match. Allowed only while the plan is still editable (pre-approval).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "milestone.crud"))
    return badRequest("You do not have permission to reorder milestones");

  const parsed = await readJson(req, reorderMilestonesSchema);
  if ("response" in parsed) return parsed.response;
  const { orderedIds } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!canActOnProject(user, project)) return badRequest("You are not assigned to this project");

  if (project.milestonePlanStatus === "approved" || project.milestonePlanStatus === "pending_approval")
    return badRequest("The milestone plan is locked and can't be reordered");

  const milestones = await prisma.milestone.findMany({
    where: { projectId: project.id, isArchived: false },
    select: { id: true },
  });
  const known = new Set(milestones.map((m) => m.id));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id)))
    return badRequest("The order must contain exactly the project's milestones");

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.milestone.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } });
      }
      await writeAudit(
        { actor: toAuditActor(user, req), action: "milestone.reorder", entityType: "project", entityId: project.id, after: { orderedIds } },
        tx
      );
    });
    return ok({ reordered: true });
  } catch (e) {
    return serverError(e);
  }
}
