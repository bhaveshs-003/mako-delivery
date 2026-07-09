import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { decideChangeRequestSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { addBusinessDaysTo } from "@/lib/business-days";
import { notify } from "@/lib/notifications";

// PATCH /api/change-requests/[id] — RL approve/reject (mandatory comment).
// On approval the project's Mako internal deadline auto-extends by the
// timeline impact (spec §2.9, §5.3.6).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "cr.decide"))
    return badRequest("Only RL users can decide change requests");

  const parsed = await readJson(req, decideChangeRequestSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const cr = await prisma.changeRequest.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } },
    },
  });
  if (!cr) return notFound("Change request not found");
  if (!canActOnProject(user, cr.project))
    return badRequest("You are not assigned to this project");
  if (cr.status === "approved" || cr.status === "rejected")
    return badRequest("This change request has already been decided");

  try {
    const approved = body.action === "approve";
    const result = await prisma.$transaction(async (tx) => {
      const c = await tx.changeRequest.update({
        where: { id: cr.id },
        data: {
          status: approved ? "approved" : "rejected",
          decidedBy: user.id,
          decidedAt: new Date(),
          decisionComment: body.decisionComment,
          timelineAdjusted: approved && !!cr.timelineImpactDays,
        },
      });

      let newDeadline: Date | null = null;
      if (approved && cr.timelineImpactDays && cr.timelineImpactDays > 0) {
        const base = cr.project.makoInternalDeadline ?? cr.project.rlCommittedDeadline;
        newDeadline = addBusinessDaysTo(base, cr.timelineImpactDays);
        await tx.project.update({
          where: { id: cr.projectId },
          data: { makoInternalDeadline: newDeadline },
        });
      }

      await writeAudit(
        { actor: toAuditActor(user, req), action: approved ? "cr.approve" : "cr.reject", entityType: "change_request", entityId: c.id, before: { status: cr.status }, after: { status: c.status, timelineAdjusted: c.timelineAdjusted }, metadata: { projectId: cr.projectId, newDeadline } },
        tx
      );
      return { c, newDeadline };
    });

    await notify({
      recipientId: cr.raisedById,
      type: "cr_decided",
      title: `Change request ${approved ? "approved" : "rejected"}`,
      body: approved
        ? `Approved. ${result.newDeadline ? `Timeline extended to ${result.newDeadline.toDateString()}.` : ""} "${body.decisionComment}"`
        : `Rejected: "${body.decisionComment}"`,
      entityType: "change_request",
      entityId: cr.id,
      projectId: cr.projectId,
      deepLinkPath: `/projects/${cr.projectId}?tab=change-requests`,
    });

    return ok(result.c);
  } catch (e) {
    return serverError(e);
  }
}
