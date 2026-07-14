import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createApprovalSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { addBusinessDaysTo } from "@/lib/business-days";
import { notifyMany } from "@/lib/notifications";

// POST /api/approvals — request RL approval for a milestone (Sub-admin scoped).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "approval.request"))
    return badRequest("You do not have permission to request approvals");

  const parsed = await readJson(req, createApprovalSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!canActOnProject(user, project))
    return badRequest("You are not assigned to this project");

  const milestone = await prisma.milestone.findFirst({
    where: { id: input.milestoneId, projectId: input.projectId },
  });
  if (!milestone) return notFound("Milestone not found");
  // Main-scope milestones are approved as part of the whole milestone plan, not
  // individually; only change-request / delta-scope milestones are approved here.
  if (milestone.type === "main_scope")
    return badRequest("Main-scope milestones are approved via the whole milestone plan");

  try {
    // SLA deadline anchored at creation (spec §7.1: stored absolute, not recomputed).
    const slaConfig = await prisma.slaConfig.findFirst({ where: { dependencyType: "approval" } });
    const slaDays = slaConfig?.approvalSlaDays ?? 3;
    const now = new Date();
    const slaDeadline = addBusinessDaysTo(now, slaDays);

    const approval = await prisma.$transaction(async (tx) => {
      const a = await tx.approvalRequest.create({
        data: {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          requestedById: user.id,
          requestComment: input.requestComment,
          slaDeadline,
        },
      });
      // Reflect pending approval on the milestone (spec §2.4).
      await tx.milestone.update({
        where: { id: input.milestoneId },
        data: { approvalStatus: "pending", approvalSlaStartedAt: now },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "approval.request", entityType: "approval_request", entityId: a.id, after: { milestoneId: input.milestoneId }, metadata: { projectId: input.projectId } },
        tx
      );
      return a;
    });

    await notifyMany(project.rlConsultants.map((c) => c.userId), {
      type: "approval_requested",
      title: `Approval requested: ${milestone.name}`,
      body: `${user.name} requested your approval on ${project.title}. SLA deadline ${slaDeadline.toDateString()}.`,
      entityType: "approval_request",
      entityId: approval.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=approvals`,
    });

    return ok(approval, 201);
  } catch (e) {
    return serverError(e);
  }
}
