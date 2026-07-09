import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createMilestoneSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// POST /api/milestones — add a milestone (Sub-admin scoped / Admin+ full).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "milestone.crud"))
    return badRequest("You do not have permission to add milestones");

  const parsed = await readJson(req, createMilestoneSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!canActOnProject(user, project))
    return badRequest("You are not assigned to this project");

  try {
    const count = await prisma.milestone.count({ where: { projectId: input.projectId } });
    const milestone = await prisma.$transaction(async (tx) => {
      const m = await tx.milestone.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description || null,
          parentStage: input.parentStage || null,
          ownerId: input.ownerId ?? null,
          dueDate: input.dueDate ?? null,
          sortOrder: count,
          createdBy: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "milestone.create", entityType: "milestone", entityId: m.id, after: { name: m.name }, metadata: { projectId: input.projectId } },
        tx
      );
      return m;
    });
    return ok(milestone, 201);
  } catch (e) {
    return serverError(e);
  }
}
