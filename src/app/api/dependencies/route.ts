import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createDependencySchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { deriveDependencyState } from "@/lib/sla";
import { notifyMany } from "@/lib/notifications";

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

  // The milestone must belong to this project; the optional subtask must belong
  // to that milestone.
  const milestone = await prisma.milestone.findFirst({
    where: { id: input.milestoneId, projectId: input.projectId },
    select: { id: true },
  });
  if (!milestone) return badRequest("The linked milestone is not on this project");
  if (input.subtaskId) {
    const subtask = await prisma.subtask.findFirst({
      where: { id: input.subtaskId, milestoneId: input.milestoneId },
      select: { id: true },
    });
    if (!subtask) return badRequest("The linked subtask is not in that milestone");
  }

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
          milestoneId: input.milestoneId,
          subtaskId: input.subtaskId ?? null,
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

    // Notify the party the dependency is requested from so it surfaces to them.
    // RL-requested → the RL POCs; otherwise the Mako project lead.
    const recipients =
      input.requestedFromParty === "mako"
        ? project.projectLeadId
          ? [project.projectLeadId]
          : []
        : project.rlConsultants.map((c) => c.userId);
    if (recipients.length) {
      await notifyMany(recipients, {
        type: "dependency_requested",
        title: `Dependency requested on ${project.title}`,
        body: `${user.name} logged a ${input.type.replace(/_/g, " ")} dependency requested from ${input.requestedFromParty.replace(/_/g, " ")}.`,
        entityType: "dependency",
        entityId: dep.id,
        projectId: input.projectId,
        deepLinkPath: `/dependencies`,
      });
    }

    return ok(dep, 201);
  } catch (e) {
    return serverError(e);
  }
}
