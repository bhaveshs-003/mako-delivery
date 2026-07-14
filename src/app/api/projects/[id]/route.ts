import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchProjectSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { businessDaysBetween } from "@/lib/business-days";
import { notifyMany } from "@/lib/notifications";

// PATCH /api/projects/[id] — lifecycle actions (spec §5.3, §7.2).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, patchProjectSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      rlConsultants: { select: { userId: true } },
      resources: { select: { userId: true } },
    },
  });
  if (!project) return notFound("Project not found");

  // ── Authorization per action ──────────────────────────────────────────────
  const isArchiveAction = body.action === "archive" || body.action === "unarchive";
  if (isArchiveAction) {
    if (!can(user.role, "project.archive"))
      return badRequest("Only Admins can archive projects");
  } else {
    if (!can(user.role, "project.edit") || !canActOnProject(user, project))
      return badRequest("You do not have permission to modify this project");
  }

  try {
    const actor = toAuditActor(user, req);
    const now = new Date();

    switch (body.action) {
      case "archive": {
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({
            where: { id: project.id },
            data: { isArchived: true, archivedAt: now, archivedBy: user.id },
          });
          await writeAudit(
            { actor, action: "project.archive", entityType: "project", entityId: project.id, before: { isArchived: false }, after: { isArchived: true } },
            tx
          );
          return u;
        });
        return ok(updated);
      }

      case "unarchive": {
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({
            where: { id: project.id },
            data: { isArchived: false, archivedAt: null, archivedBy: null },
          });
          await writeAudit({ actor, action: "project.unarchive", entityType: "project", entityId: project.id, after: { isArchived: false } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "start": {
        if (project.status !== "not_started")
          return badRequest("Only a not-started project can be started");
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({ where: { id: project.id }, data: { status: "in_progress" } });
          await writeAudit({ actor, action: "project.start", entityType: "project", entityId: project.id, before: { status: "not_started" }, after: { status: "in_progress" } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "complete": {
        // Spec §7.2: cannot complete with open dependencies or pending approvals.
        const openDeps = await prisma.dependency.count({
          where: { projectId: project.id, status: { not: "received" } },
        });
        const pendingApprovals = await prisma.approvalRequest.count({
          where: { projectId: project.id, status: "pending" },
        });
        if (openDeps > 0 || pendingApprovals > 0)
          return badRequest(
            `Cannot complete: ${openDeps} open dependency(ies) and ${pendingApprovals} pending approval(s) remain`
          );
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({
            where: { id: project.id },
            data: { status: "completed", actualCompletionDate: now },
          });
          await writeAudit({ actor, action: "project.complete", entityType: "project", entityId: project.id, before: { status: project.status }, after: { status: "completed" } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "pause": {
        if (project.status === "paused")
          return badRequest("Project is already paused");
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({
            where: { id: project.id },
            data: {
              status: "paused",
              currentPauseReasonCategory: body.reasonCategory,
              currentPauseReasonComment: body.reasonComment,
              pausedAt: now,
            },
          });
          await tx.pauseHistory.create({
            data: {
              projectId: project.id,
              pausedAt: now,
              reasonCategory: body.reasonCategory,
              reasonComment: body.reasonComment,
              pausedBy: user.id,
            },
          });
          await writeAudit({ actor, action: "project.pause", entityType: "project", entityId: project.id, before: { status: project.status }, after: { status: "paused", reason: body.reasonCategory } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "resume": {
        if (project.status !== "paused")
          return badRequest("Project is not paused");
        const updated = await prisma.$transaction(async (tx) => {
          const openPause = await tx.pauseHistory.findFirst({
            where: { projectId: project.id, resumedAt: null },
            orderBy: { pausedAt: "desc" },
          });
          if (openPause) {
            await tx.pauseHistory.update({
              where: { id: openPause.id },
              data: {
                resumedAt: now,
                resumedBy: user.id,
                pauseDurationDays: businessDaysBetween(openPause.pausedAt, now),
              },
            });
          }
          const u = await tx.project.update({
            where: { id: project.id },
            data: {
              status: "in_progress",
              currentPauseReasonCategory: null,
              currentPauseReasonComment: null,
              pausedAt: null,
            },
          });
          await writeAudit({ actor, action: "project.resume", entityType: "project", entityId: project.id, before: { status: "paused" }, after: { status: "in_progress" } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "edit": {
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.project.update({
            where: { id: project.id },
            data: {
              title: body.title ?? undefined,
              description: body.description ?? undefined,
              rlStartDate: body.rlStartDate ?? undefined,
              rlCommittedDeadline: body.rlCommittedDeadline ?? undefined,
              makoStartDate: body.makoStartDate ?? undefined,
              makoInternalDeadline: body.makoInternalDeadline ?? undefined,
              projectLeadId: body.projectLeadId ?? undefined,
            },
          });
          await writeAudit({ actor, action: "project.edit", entityType: "project", entityId: project.id, after: { title: u.title } }, tx);
          return u;
        });
        return ok(updated);
      }

      case "assign": {
        // Validate roles server-side (spec §6.3): consultants must be rl_user,
        // resources must be resource.
        if (body.rlConsultantIds?.length) {
          const c = await prisma.user.count({
            where: { id: { in: body.rlConsultantIds }, role: "rl_user" },
          });
          if (c !== body.rlConsultantIds.length)
            return badRequest("All RL consultants must be RL users");
        }
        if (body.resourceIds?.length) {
          const c = await prisma.user.count({
            where: { id: { in: body.resourceIds }, role: "resource" },
          });
          if (c !== body.resourceIds.length)
            return badRequest("All resources must be Resource users");
        }

        // Notify only the newly-added resources (not the existing ones).
        const existingRes = new Set(project.resources.map((r) => r.userId));
        const addedResources = (body.resourceIds ?? []).filter((id) => !existingRes.has(id));

        const updated = await prisma.$transaction(async (tx) => {
          if (body.rlConsultantIds) {
            await tx.projectRlConsultant.deleteMany({ where: { projectId: project.id } });
            await tx.projectRlConsultant.createMany({
              data: body.rlConsultantIds.map((userId) => ({ projectId: project.id, userId, assignedBy: user.id })),
            });
          }
          if (body.resourceIds) {
            await tx.projectResource.deleteMany({ where: { projectId: project.id } });
            await tx.projectResource.createMany({
              data: body.resourceIds.map((userId) => ({ projectId: project.id, userId, assignedBy: user.id })),
            });
          }
          await writeAudit({ actor, action: "project.assign", entityType: "project", entityId: project.id, after: { rlConsultants: body.rlConsultantIds, resources: body.resourceIds } }, tx);
          return tx.project.findUnique({ where: { id: project.id } });
        });

        if (addedResources.length) {
          await notifyMany(addedResources, {
            type: "resource_assigned",
            title: `Assigned to ${project.title}`,
            body: `You have been assigned to project ${project.title}.`,
            entityType: "project",
            entityId: project.id,
            projectId: project.id,
            deepLinkPath: `/projects/${project.id}`,
          });
        }
        return ok(updated);
      }
    }
  } catch (e) {
    return serverError(e);
  }
}
