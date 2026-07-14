import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { readJson, ok, badRequest, serverError } from "@/lib/api";
import { createProjectSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { toAuditActor } from "@/lib/session";
import { notifyMany } from "@/lib/notifications";

// POST /api/projects — create a project (Admin/Super Admin only, spec §3.1).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "project.create")) {
    return badRequest("You do not have permission to create projects");
  }

  const parsed = await readJson(req, createProjectSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  try {
    // Validate assignment roles server-side (spec §6.3): consultants must be
    // rl_user, resources must be resource, lead must be sub_admin.
    if (input.projectLeadId) {
      const lead = await prisma.user.findUnique({ where: { id: input.projectLeadId } });
      if (!lead || lead.role !== "sub_admin")
        return badRequest("Project lead must be a Sub-admin");
    }
    if (input.rlConsultantIds.length) {
      const count = await prisma.user.count({
        where: { id: { in: input.rlConsultantIds }, role: "rl_user" },
      });
      if (count !== input.rlConsultantIds.length)
        return badRequest("All RL consultants must be RL users");
    }
    if (input.resourceIds.length) {
      const count = await prisma.user.count({
        where: { id: { in: input.resourceIds }, role: "resource" },
      });
      if (count !== input.resourceIds.length)
        return badRequest("All resources must be Resource users");
    }

    // Freeze the active template snapshot at creation (spec §2.2).
    const template = await prisma.lifecycleTemplate.findFirst({
      where: { projectType: input.type, isActive: true },
      orderBy: { version: "desc" },
    });

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          title: input.title,
          description: input.description || null,
          type: input.type,
          rlCommittedDeadline: input.rlCommittedDeadline ?? null,
          makoInternalDeadline: input.makoInternalDeadline ?? null,
          rlProjectId: input.rlProjectId || null,
          templateSnapshotId: template?.id ?? null,
          projectLeadId: input.projectLeadId ?? null,
          createdBy: user.id,
          rlConsultants: {
            create: input.rlConsultantIds.map((userId) => ({
              userId,
              assignedBy: user.id,
            })),
          },
          resources: {
            create: input.resourceIds.map((userId) => ({
              userId,
              assignedBy: user.id,
            })),
          },
        },
      });

      // No milestones are seeded from the template. The PM creates milestones
      // manually and submits each to the RL POC for approval. (templateSnapshotId
      // above still records which template version was active, for reference.)

      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: "project.create",
          entityType: "project",
          entityId: p.id,
          after: { title: p.title, type: p.type, status: p.status },
        },
        tx
      );

      return p;
    });

    // Notify lead, resources, and RL consultants (best-effort).
    await notifyMany(
      [
        ...(input.projectLeadId ? [input.projectLeadId] : []),
        ...input.resourceIds,
        ...input.rlConsultantIds,
      ],
      {
        type: "project_created",
        title: `New project: ${project.title}`,
        body: `You have been assigned to ${project.title}.`,
        entityType: "project",
        entityId: project.id,
        projectId: project.id,
        deepLinkPath: `/projects/${project.id}`,
      }
    );

    return ok(project, 201);
  } catch (e) {
    return serverError(e);
  }
}
