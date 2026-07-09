import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere, can } from "@/lib/permissions";
import { RaiseTicketForm } from "@/components/forms/RaiseTicketForm";
import { TicketList } from "@/components/tickets/TicketList";

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const scope = projectScopeWhere(user);
  const isOrgWide = user.role === "super_admin" || user.role === "admin";

  const [tickets, availableProjects, rlUsers] = await Promise.all([
    prisma.ticket.findMany({
      where: isOrgWide
        ? {}
        : { projectLinks: { some: { project: scope } } },
      orderBy: { createdAt: "desc" },
      include: {
        raisedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        projectLinks: { include: { project: { select: { id: true, title: true } } } },
      },
    }),
    prisma.project.findMany({
      where: { ...scope, isArchived: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({ where: { role: "rl_user", isActive: true }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Tickets</h1>
          <p className="text-sm text-slate">{tickets.length} ticket(s)</p>
        </div>
        {can(user.role, "ticket.raise") && availableProjects.length > 0 && (
          <RaiseTicketForm availableProjects={availableProjects} rlUsers={rlUsers} />
        )}
      </div>
      <TicketList tickets={tickets} userId={user.id} role={user.role} />
    </div>
  );
}
