import { requireUser, toAuditActor } from "@/lib/session";
import { can } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchTicketSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

// PATCH /api/tickets/[id] — respond (RL), escalate (Admin), or close (raiser/Admin).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, patchTicketSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { projectLinks: { select: { projectId: true } } },
  });
  if (!ticket) return notFound("Ticket not found");

  const actor = toAuditActor(user, req);

  try {
    if (body.action === "respond") {
      // RL responds and sets status; comment mandatory (spec §5.3.5).
      if (!can(user.role, "ticket.respond"))
        return badRequest("Only RL users can respond to tickets");
      const isResolution = body.status === "resolved" || body.status === "workaround_applied";
      const updated = await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: body.status,
            resolutionComment: body.comment,
            resolvedAt: isResolution ? new Date() : null,
            resolvedBy: isResolution ? user.id : null,
          },
        });
        await writeAudit({ actor, action: "ticket.respond", entityType: "ticket", entityId: t.id, before: { status: ticket.status }, after: { status: t.status } }, tx);
        return t;
      });
      await notify({
        recipientId: ticket.raisedById,
        type: "ticket_response",
        title: `Ticket updated: ${ticket.title}`,
        body: `${user.name} set the ticket to ${body.status.replace(/_/g, " ")}. "${body.comment}"`,
        entityType: "ticket",
        entityId: ticket.id,
        deepLinkPath: `/tickets`,
      });
      return ok(updated);
    }

    if (body.action === "escalate") {
      if (!can(user.role, "ticket.escalate"))
        return badRequest("Only Admins can escalate tickets");
      const updated = await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.update({ where: { id: ticket.id }, data: { priority: "critical" } });
        await writeAudit({ actor, action: "ticket.escalate", entityType: "ticket", entityId: t.id, after: { priority: "critical" }, metadata: { comment: body.comment } }, tx);
        return t;
      });
      if (ticket.assignedToId)
        await notify({ recipientId: ticket.assignedToId, type: "escalation", title: `Ticket escalated: ${ticket.title}`, body: body.comment ?? "This ticket has been escalated to critical.", entityType: "ticket", entityId: ticket.id, deepLinkPath: `/tickets` });
      return ok(updated);
    }

    // close — only the original raiser or an Admin/Super Admin (spec §5.3.5).
    const isRaiser = ticket.raisedById === user.id;
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    if (!isRaiser && !isAdmin)
      return badRequest("Only the ticket raiser or an Admin can close a ticket");
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.update({ where: { id: ticket.id }, data: { status: "closed" } });
      await writeAudit({ actor, action: "ticket.close", entityType: "ticket", entityId: t.id, before: { status: ticket.status }, after: { status: "closed" } }, tx);
      return t;
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
