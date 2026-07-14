import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { milestonePlanSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";

// PATCH /api/projects/[id]/milestone-plan — submit the WHOLE milestone plan for
// RL approval (PM), or approve/reject it (RL). Once approved, milestones lock.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, milestonePlanSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");

  const actor = toAuditActor(user, req);

  try {
    // ── Submit (PM) ─────────────────────────────────────────────────────────
    if (body.action === "submit") {
      if (!can(user.role, "milestone.crud") || !canActOnProject(user, project))
        return badRequest("You do not have permission to submit this plan");
      if (project.milestonePlanStatus === "approved")
        return badRequest("The plan is already approved");
      if (project.milestonePlanStatus === "pending_approval")
        return badRequest("The plan is already awaiting RL approval");

      const count = await prisma.milestone.count({
        where: { projectId: project.id, isArchived: false },
      });
      if (count === 0) return badRequest("Add at least one milestone before submitting");

      const updated = await prisma.$transaction(async (tx) => {
        const p = await tx.project.update({
          where: { id: project.id },
          data: {
            milestonePlanStatus: "pending_approval",
            milestonePlanSubmittedAt: new Date(),
            milestonePlanSubmittedBy: user.id,
            milestonePlanDecisionComment: null,
          },
        });
        await writeAudit({ actor, action: "milestone_plan.submit", entityType: "project", entityId: project.id, after: { status: "pending_approval", milestones: count } }, tx);
        return p;
      });
      await notifyMany(project.rlConsultants.map((c) => c.userId), {
        type: "approval_requested",
        title: `Milestone plan submitted: ${project.title}`,
        body: `${user.name} submitted the milestone plan (${count} milestones) for your approval.`,
        entityType: "project",
        entityId: project.id,
        projectId: project.id,
        deepLinkPath: `/projects/${project.id}?tab=lifecycle`,
      });
      return ok(updated);
    }

    // ── Approve / Reject (RL) ───────────────────────────────────────────────
    if (!can(user.role, "approval.decide") || !canActOnProject(user, project))
      return badRequest("Only the assigned RL user can decide this plan");
    if (project.milestonePlanStatus !== "pending_approval")
      return badRequest("This plan is not awaiting a decision");

    const approved = body.action === "approve";
    if (!approved && !body.decisionComment?.trim())
      return badRequest("A reason is required to reject the plan");

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.project.update({
        where: { id: project.id },
        data: {
          milestonePlanStatus: approved ? "approved" : "rejected",
          milestonePlanDecidedAt: new Date(),
          milestonePlanDecidedBy: user.id,
          milestonePlanDecisionComment: body.decisionComment ?? null,
        },
      });
      await writeAudit({ actor, action: approved ? "milestone_plan.approve" : "milestone_plan.reject", entityType: "project", entityId: project.id, before: { status: "pending_approval" }, after: { status: p.milestonePlanStatus } }, tx);
      return p;
    });

    if (project.milestonePlanSubmittedBy) {
      await notify({
        recipientId: project.milestonePlanSubmittedBy,
        type: "approval_decided",
        title: `Milestone plan ${approved ? "approved" : "rejected"}: ${project.title}`,
        body: approved
          ? `${user.name} approved the milestone plan. It is now locked.`
          : `${user.name} rejected the plan: "${body.decisionComment}"`,
        entityType: "project",
        entityId: project.id,
        projectId: project.id,
        deepLinkPath: `/projects/${project.id}?tab=lifecycle`,
      });
    }
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
