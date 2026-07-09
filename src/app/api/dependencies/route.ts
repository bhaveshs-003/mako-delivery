import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createDependencySchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { deriveDependencyState } from "@/lib/sla";

// POST /api/dependencies — log a dependency (Sub-admin scoped / Admin+ full).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "dependency.log")) {
    return badRequest("You do not have permission to log dependencies");
  }

  const parsed = await readJson(req, createDependencySchema);
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
    // Derive burn/breach at creation (supports retroactive logging, spec §5.3.3).
    const state = deriveDependencyState({
      dateRequested: input.dateRequested,
      dateReceived: null,
      slaThresholdDays: input.slaThresholdDays,
      status: "awaiting",
    });

    const dep = await prisma.$transaction(async (tx) => {
      const d = await tx.dependency.create({
        data: {
          projectId: input.projectId,
          milestoneId: input.milestoneId ?? null,
          type: input.type,
          description: input.description,
          requestedFromParty: input.requestedFromParty,
          dateRequested: input.dateRequested,
          slaThresholdDays: input.slaThresholdDays,
          status: state.slaBreached ? "overdue" : "awaiting",
          burnDays: state.burnDays,
          slaBreached: state.slaBreached,
          createdBy: user.id,
        },
      });
      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: "dependency.create",
          entityType: "dependency",
          entityId: d.id,
          after: { type: d.type, requestedFrom: d.requestedFromParty, sla: d.slaThresholdDays },
          metadata: { projectId: input.projectId },
        },
        tx
      );
      return d;
    });

    return ok(dep, 201);
  } catch (e) {
    return serverError(e);
  }
}
