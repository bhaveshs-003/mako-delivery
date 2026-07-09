import { requireUser, toAuditActor } from "@/lib/session";
import { can, projectScopeWhere } from "@/lib/permissions";
import { readJson, ok, badRequest, serverError } from "@/lib/api";
import { createTicketSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";

// POST /api/tickets — raise a ticket linked to ≥1 project (spec §2.8).
// A multi-project ticket notifies every linked project's lead + RL POCs.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "ticket.raise"))
    return badRequest("You do not have permission to raise tickets");

  const parsed = await readJson(req, createTicketSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  // Scoped roles may only link projects they can access (spec §3.2).
  const allowed = await prisma.project.findMany({
    where: { id: { in: input.projectIds }, ...projectScopeWhere(user) },
    select: { id: true, title: true, projectLeadId: true, rlConsultants: { select: { userId: true } } },
  });
  if (allowed.length !== input.projectIds.length)
    return badRequest("You can only link projects you are assigned to");

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId } });
    if (!assignee || assignee.role !== "rl_user")
      return badRequest("Tickets can only be assigned to RL users");
  }

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          raisedById: user.id,
          assignedToId: input.assignedToId ?? null,
          projectLinks: { create: input.projectIds.map((projectId) => ({ projectId })) },
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "ticket.create", entityType: "ticket", entityId: t.id, after: { title: t.title, type: t.type, projects: input.projectIds.length } },
        tx
      );
      return t;
    });

    // Fan out to all leads + RL POCs across linked projects (spec §7.5).
    const recipients = [
      ...allowed.flatMap((p) => (p.projectLeadId ? [p.projectLeadId] : [])),
      ...allowed.flatMap((p) => p.rlConsultants.map((c) => c.userId)),
      ...(input.assignedToId ? [input.assignedToId] : []),
    ];
    await notifyMany(recipients, {
      type: input.projectIds.length > 1 ? "ticket_multi_project" : "ticket_raised",
      title: `Ticket raised: ${input.title}`,
      body: `A ${input.type.replace(/_/g, " ")} ticket was raised affecting ${allowed.length} project(s).`,
      entityType: "ticket",
      entityId: ticket.id,
      deepLinkPath: `/tickets`,
    });

    return ok(ticket, 201);
  } catch (e) {
    return serverError(e);
  }
}
