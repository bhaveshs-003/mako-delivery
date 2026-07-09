import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createChangeRequestSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";

// POST /api/change-requests — raise a scope-change request (Sub-admin scoped).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "cr.raise"))
    return badRequest("You do not have permission to raise change requests");

  const parsed = await readJson(req, createChangeRequestSchema);
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
    const cr = await prisma.$transaction(async (tx) => {
      const c = await tx.changeRequest.create({
        data: {
          projectId: input.projectId,
          scopeDelta: input.scopeDelta,
          timelineImpactDays: input.timelineImpactDays ?? null,
          effortImpactDescription: input.effortImpactDescription || null,
          status: "pending_rl_approval",
          raisedById: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "cr.raise", entityType: "change_request", entityId: c.id, after: { timelineImpactDays: c.timelineImpactDays }, metadata: { projectId: input.projectId } },
        tx
      );
      return c;
    });

    await notifyMany(project.rlConsultants.map((c) => c.userId), {
      type: "cr_raised",
      title: `Change request on ${project.title}`,
      body: `${user.name} raised a change request (+${input.timelineImpactDays ?? 0} days impact) for your review.`,
      entityType: "change_request",
      entityId: cr.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=change-requests`,
    });

    return ok(cr, 201);
  } catch (e) {
    return serverError(e);
  }
}
