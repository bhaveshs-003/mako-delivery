import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { projectScopeWhere, can, type SessionUser } from "@/lib/permissions";
import { RaiseTicketForm } from "@/components/forms/RaiseTicketForm";
import { TicketList } from "@/components/tickets/TicketList";

export async function TicketsTab({
  projectId,
  user,
}: {
  projectId: string;
  user: SessionUser;
}) {
  const [tickets, availableProjects, rlUsers] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectLinks: { some: { projectId } } },
      orderBy: { createdAt: "desc" },
      include: {
        raisedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        projectLinks: { include: { project: { select: { id: true, title: true } } } },
      },
    }),
    prisma.project.findMany({
      where: { ...projectScopeWhere(user), isArchived: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({ where: { role: "rl_user" as UserRole, isActive: true }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Tickets</h2>
        {can(user.role, "ticket.raise") && (
          <RaiseTicketForm availableProjects={availableProjects} rlUsers={rlUsers} defaultProjectId={projectId} />
        )}
      </div>
      <TicketList tickets={tickets} userId={user.id} role={user.role} />
    </div>
  );
}
