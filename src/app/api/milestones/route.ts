import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createMilestoneSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { allocationPoolDays } from "@/lib/allocation";
import { recomputeDueDates } from "@/lib/milestone-scheduling";

// POST /api/milestones — add a milestone (Sub-admin scoped / Admin+ full),
// optionally with inline subtasks. Enforces the day-allocation hierarchy:
// milestone days <= project's unallocated days; subtask days <= milestone days.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "milestone.crud"))
    return badRequest("You do not have permission to add milestones");

  const parsed = await readJson(req, createMilestoneSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!canActOnProject(user, project))
    return badRequest("You are not assigned to this project");

  // ── Scope + plan gating ───────────────────────────────────────────────────
  // Milestones can only be created once the scope understanding is approved.
  if (!project.scopeApproved)
    return badRequest("The scope understanding must be approved by RL before milestones can be created");

  const planApproved = project.milestonePlanStatus === "approved";
  if (project.milestonePlanStatus === "pending_approval")
    return badRequest("The milestone plan is awaiting RL approval and is locked");

  // Before plan approval only main-scope milestones may be added; after approval
  // the plan is locked and further work comes only via Change Request / delta.
  if (planApproved && input.type === "main_scope")
    return badRequest("The plan is approved — add new milestones via a Change Request or delta scope");
  if (!planApproved && input.type !== "main_scope")
    return badRequest("Change Request / delta milestones can only be added after the plan is approved");

  // A linked change request (for CR/delta milestones) must belong to this project.
  if (input.changeRequestId) {
    const cr = await prisma.changeRequest.count({
      where: { id: input.changeRequestId, projectId: input.projectId },
    });
    if (cr === 0) return badRequest("The linked change request is not on this project");
  }

  // Assigned resources must belong to the project.
  const projectResourceIds = new Set(project.resources.map((r) => r.userId));
  if (input.ownerId && !projectResourceIds.has(input.ownerId))
    return badRequest("The owner must be a resource assigned to this project");
  for (const s of input.subtasks) {
    if (s.assignedToId && !projectResourceIds.has(s.assignedToId))
      return badRequest("Subtask assignees must be resources on this project");
  }

  // ── Time-allocation hierarchy ─────────────────────────────────────────────
  if (input.allocatedDays != null) {
    // Enforce the project cap only when a timeline (Mako or RL) defines a pool.
    const total = allocationPoolDays(project);
    if (total > 0) {
      const existing = await prisma.milestone.aggregate({
        where: { projectId: input.projectId, isArchived: false },
        _sum: { allocatedDays: true },
      });
      const used = existing._sum.allocatedDays ?? 0;
      if (used + input.allocatedDays > total)
        return badRequest(
          `Over-allocates the timeline: ${used} of ${total} day(s) already allocated, ${total - used} remaining.`
        );
    }

    const subSum = input.subtasks.reduce((s, t) => s + (t.allocatedDays ?? 0), 0);
    if (subSum > input.allocatedDays)
      return badRequest(
        `Subtasks allocate ${subSum} day(s) but the milestone only has ${input.allocatedDays}.`
      );
  }

  try {
    const count = await prisma.milestone.count({ where: { projectId: input.projectId } });
    const milestone = await prisma.$transaction(async (tx) => {
      const m = await tx.milestone.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description || null,
          parentStage: input.parentStage || null,
          type: input.type,
          changeRequestId: input.changeRequestId ?? null,
          ownerId: input.ownerId ?? null,
          dueDate: input.dueDate ?? null,
          allocatedDays: input.allocatedDays ?? null,
          // All milestones start Upcoming; execution begins after the plan (main
          // scope) or the individual milestone (CR/delta) is approved.
          status: "yet_to_start",
          sortOrder: count,
          createdBy: user.id,
        },
      });
      if (input.subtasks.length) {
        await tx.subtask.createMany({
          data: input.subtasks.map((s, i) => ({
            milestoneId: m.id,
            title: s.title,
            assignedToId: s.assignedToId ?? null,
            allocatedDays: s.allocatedDays ?? null,
            sortOrder: i,
            createdBy: user.id,
          })),
        });
      }
      await writeAudit(
        { actor: toAuditActor(user, req), action: "milestone.create", entityType: "milestone", entityId: m.id, after: { name: m.name, type: m.type, allocatedDays: m.allocatedDays, subtasks: input.subtasks.length }, metadata: { projectId: input.projectId } },
        tx
      );
      // Auto-derive due dates now that a milestone was added.
      await recomputeDueDates(tx, input.projectId);
      return m;
    });
    return ok(milestone, 201);
  } catch (e) {
    return serverError(e);
  }
}
