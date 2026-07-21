import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createTimelineProposalSchema, decideTimelineSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { daysBetween } from "@/lib/allocation";
import { notify, notifyMany } from "@/lib/notifications";

// POST /api/projects/[id]/timeline — PM proposes an RL + Mako timeline (date
// ranges). The project's real dates are NOT changed until the RL POC approves.
// A new pending proposal supersedes any earlier pending one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, createTimelineProposalSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!can(user.role, "project.edit") || !canActOnProject(user, project))
    return badRequest("You do not have permission to propose a timeline");

  try {
    const proposal = await prisma.$transaction(async (tx) => {
      // Supersede any earlier pending proposal — only one awaits decision at a time.
      await tx.timelineProposal.updateMany({
        where: { projectId: project.id, status: "pending" },
        data: { status: "superseded" },
      });
      const p = await tx.timelineProposal.create({
        data: {
          projectId: project.id,
          rlStartDate: body.rlStartDate ?? null,
          rlCommittedDeadline: body.rlCommittedDeadline ?? null,
          makoStartDate: body.makoStartDate ?? null,
          makoInternalDeadline: body.makoInternalDeadline ?? null,
          includeWeekends: body.includeWeekends,
          note: body.note ?? null,
          status: "pending",
          submittedById: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "timeline.submit", entityType: "project", entityId: project.id, after: { timelineProposalId: p.id } },
        tx
      );
      return p;
    });

    await notifyMany(project.rlConsultants.map((c) => c.userId), {
      type: "approval_requested",
      title: `Timeline proposed: ${project.title}`,
      body: `${user.name} proposed a project timeline for your approval.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=scope`,
    });
    return ok({ id: proposal.id });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH /api/projects/[id]/timeline — RL POC approves/rejects a proposal. On
// approval the proposed dates are written to the project.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, decideTimelineSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!can(user.role, "approval.decide") || !canActOnProject(user, project))
    return badRequest("Only the assigned RL POC can decide this");

  const proposal = await prisma.timelineProposal.findFirst({
    where: { id: body.proposalId, projectId: project.id },
  });
  if (!proposal) return notFound("Proposal not found");
  if (proposal.status !== "pending") return badRequest("This proposal has already been decided");
  if (proposal.submittedById === user.id)
    return badRequest("You cannot decide your own submission");

  const approved = body.action === "approve";
  if (!approved && !body.decisionComment?.trim())
    return badRequest("A reason is required to reject");

  try {
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.timelineProposal.update({
        where: { id: proposal.id },
        data: {
          status: approved ? "approved" : "rejected",
          decidedById: user.id,
          decidedAt: now,
          decisionComment: body.decisionComment ?? null,
          approvalDurationDays: daysBetween(proposal.submittedAt, now),
        },
      });
      if (approved) {
        // Apply only the dates the proposal actually set.
        await tx.project.update({
          where: { id: project.id },
          data: {
            rlStartDate: proposal.rlStartDate ?? undefined,
            rlCommittedDeadline: proposal.rlCommittedDeadline ?? undefined,
            makoStartDate: proposal.makoStartDate ?? undefined,
            makoInternalDeadline: proposal.makoInternalDeadline ?? undefined,
            includeWeekends: proposal.includeWeekends,
          },
        });
      }
      await writeAudit(
        { actor: toAuditActor(user, req), action: `timeline.${approved ? "approve" : "reject"}`, entityType: "project", entityId: project.id, after: { status: p.status } },
        tx
      );
      return p;
    });

    await notify({
      recipientId: proposal.submittedById,
      type: "approval_decided",
      title: `Timeline ${approved ? "approved" : "rejected"}: ${project.title}`,
      body: approved
        ? `${user.name} approved the project timeline. It is now in effect.`
        : `${user.name} rejected the timeline: "${body.decisionComment}". You can propose a revised timeline.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=scope`,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
