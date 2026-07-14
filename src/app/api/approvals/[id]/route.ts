import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { decideApprovalSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";

// PATCH /api/approvals/[id] — RL approve/reject (mandatory comment), or escalate.
// Reject does NOT restart the SLA timer (spec §2.7, §5.3.4): slaDeadline is
// left untouched so the resubmission gap remains part of RL's turnaround.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, decideApprovalSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const approval = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } },
      milestone: { select: { name: true } },
    },
  });
  if (!approval) return notFound("Approval request not found");

  const actor = toAuditActor(user, req);

  if (body.action === "escalate") {
    if (!can(user.role, "ticket.escalate"))
      return badRequest("Only Admins can escalate");
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.approvalRequest.update({
        where: { id: approval.id },
        data: { escalated: true, escalatedAt: new Date(), escalatedBy: user.id },
      });
      await writeAudit({ actor, action: "approval.escalate", entityType: "approval_request", entityId: a.id, metadata: { projectId: approval.projectId } }, tx);
      return a;
    });
    await notifyMany2(approval.project.rlConsultants.map((c) => c.userId), approval, "This approval has been escalated.");
    return ok(updated);
  }

  // approve / reject
  if (!can(user.role, "approval.decide") || !canActOnProject(user, approval.project))
    return badRequest("Only the assigned RL user can decide this approval");
  if (approval.status !== "pending")
    return badRequest("This approval has already been decided");
  // Requestor cannot decide their own request (spec §3.3.1).
  if (approval.requestedById === user.id)
    return badRequest("You cannot decide your own approval request");
  if (!body.decisionComment?.trim())
    return badRequest("A decision comment is required");

  try {
    const approved = body.action === "approve";
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: approved ? "approved" : "rejected",
          decidedBy: user.id,
          decidedAt: new Date(),
          decisionComment: body.decisionComment,
          // NOTE: slaDeadline intentionally NOT modified on reject.
        },
      });
      const current = await tx.milestone.findUnique({
        where: { id: approval.milestoneId },
        select: { sortOrder: true },
      });
      await tx.milestone.update({
        where: { id: approval.milestoneId },
        data: {
          approvalStatus: approved ? "approved" : "rejected",
          approvedBy: approved ? user.id : null,
          approvedAt: approved ? new Date() : null,
          approvalComment: body.decisionComment,
          // Approved → Completed; rejected → back to In Progress for rework.
          status: approved ? "completed" : "ongoing",
        },
      });

      // Sequential progression: approving a milestone moves the next one to
      // In-Progress (the previous approval gates the next milestone).
      if (approved && current) {
        const next = await tx.milestone.findFirst({
          where: {
            projectId: approval.projectId,
            isArchived: false,
            sortOrder: { gt: current.sortOrder },
            approvalStatus: { not: "approved" },
          },
          orderBy: { sortOrder: "asc" },
        });
        if (next) await tx.milestone.update({ where: { id: next.id }, data: { status: "ongoing" } });
      }

      await writeAudit(
        { actor, action: approved ? "approval.approve" : "approval.reject", entityType: "approval_request", entityId: a.id, before: { status: "pending" }, after: { status: a.status }, metadata: { projectId: approval.projectId } },
        tx
      );
      return a;
    });

    // Notify the requesting Sub-admin.
    await notify({
      recipientId: approval.requestedById,
      type: "approval_decided",
      title: `Approval ${approved ? "approved" : "rejected"}: ${approval.milestone.name}`,
      body: `${user.name} ${approved ? "approved" : "rejected"} your request. "${body.decisionComment}"`,
      entityType: "approval_request",
      entityId: approval.id,
      projectId: approval.projectId,
      deepLinkPath: `/projects/${approval.projectId}?tab=approvals`,
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// local helpers -------------------------------------------------------------
async function notifyMany2(
  ids: string[],
  approval: { id: string; projectId: string; milestone: { name: string } },
  body: string
) {
  await notifyMany(ids, {
    type: "escalation",
    title: `Escalation: ${approval.milestone.name}`,
    body,
    entityType: "approval_request",
    entityId: approval.id,
    projectId: approval.projectId,
    deepLinkPath: `/projects/${approval.projectId}?tab=approvals`,
  });
}
