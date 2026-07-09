import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { markDependencySchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { calcBurnDays } from "@/lib/business-days";
import { notifyMany } from "@/lib/notifications";

// PATCH /api/dependencies/[id] — mark received (Mako) or fulfilled (RL).
// When the burn exceeds SLA, root-cause tagging is MANDATORY (spec §2.5).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, markDependencySchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const dep = await prisma.dependency.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } }, },
      },
    },
  });
  if (!dep) return notFound("Dependency not found");
  if (dep.status === "received") return badRequest("Dependency already fulfilled");

  // Authorization: RL fulfils only rl-requested deps; Mako side marks received.
  if (input.action === "fulfill") {
    if (!can(user.role, "dependency.markFulfilled"))
      return badRequest("Only RL users can fulfil dependencies");
    if (dep.requestedFromParty !== "rl")
      return badRequest("Only RL-requested dependencies can be fulfilled by RL");
    if (!canActOnProject(user, dep.project))
      return badRequest("You are not assigned to this project");
  } else {
    if (!can(user.role, "dependency.markReceived") || !canActOnProject(user, dep.project))
      return badRequest("You do not have permission to mark this dependency received");
  }

  // Recompute burn at the received date; enforce mandatory root cause on breach.
  const burnDays = calcBurnDays(dep.dateRequested, input.dateReceived);
  const slaBreached = burnDays > dep.slaThresholdDays;
  if (slaBreached && (!input.rootCauseCategory || !input.rootCauseComment?.trim())) {
    return badRequest(
      "This dependency breached its SLA — a root-cause category and comment are required"
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.dependency.update({
        where: { id: dep.id },
        data: {
          status: "received",
          dateReceived: input.dateReceived,
          burnDays,
          slaBreached,
          rootCauseCategory: slaBreached ? input.rootCauseCategory : null,
          rootCauseComment: slaBreached ? input.rootCauseComment : null,
          fulfilledBy: user.id,
          fulfilledAt: new Date(),
        },
      });
      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: slaBreached ? "dependency.received_breached" : "dependency.received",
          entityType: "dependency",
          entityId: d.id,
          before: { status: dep.status, slaBreached: dep.slaBreached },
          after: { status: "received", burnDays, slaBreached, rootCause: d.rootCauseCategory },
          metadata: { projectId: dep.projectId },
        },
        tx
      );
      return d;
    });

    if (slaBreached) {
      // Notify PM + admins of the breach for the record (spec §7.5).
      const recipients = [
        ...(dep.project.projectLeadId ? [dep.project.projectLeadId] : []),
      ];
      await notifyMany(recipients, {
        type: "dependency_sla_breach",
        title: `Dependency SLA breach on ${dep.project.title}`,
        body: `A ${dep.type.replace(/_/g, " ")} dependency took ${burnDays} business days (SLA ${dep.slaThresholdDays}). Root cause: ${input.rootCauseCategory}.`,
        entityType: "dependency",
        entityId: dep.id,
        projectId: dep.projectId,
        deepLinkPath: `/projects/${dep.projectId}?tab=dependencies`,
      });
    }

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
