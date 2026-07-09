import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { TicketActions } from "@/components/tickets/TicketActions";
import { formatDate } from "@/lib/utils";
import { Ticket as TicketIcon, ChevronUp } from "lucide-react";

type TicketRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  raisedById: string;
  createdAt: Date;
  raisedBy: { name: string };
  assignedTo: { name: string } | null;
  projectLinks: { project: { id: string; title: string } }[];
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-slate",
  medium: "text-info",
  high: "text-warning",
  critical: "text-danger",
};

export function TicketList({
  tickets,
  userId,
  role,
}: {
  tickets: TicketRow[];
  userId: string;
  role: UserRole;
}) {
  if (tickets.length === 0)
    return (
      <EmptyState
        icon={TicketIcon}
        title="No tickets"
        subtitle="Raise a ticket for product bugs, API changes, or blocked dependencies."
      />
    );

  const isAdmin = role === "admin" || role === "super_admin";

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <div key={t.id} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              <span className={`text-xs font-semibold uppercase ${PRIORITY_COLOR[t.priority]}`}>
                {t.priority === "critical" && <ChevronUp className="mr-0.5 inline h-3 w-3" />}
                {t.priority}
              </span>
              <span className="font-medium text-navy">{t.title}</span>
            </div>
            <span className="text-xs text-slate">{formatDate(t.createdAt)}</span>
          </div>

          <p className="mt-1 text-xs capitalize text-slate">
            {t.type.replace(/_/g, " ")} · raised by {t.raisedBy.name}
            {t.assignedTo && ` · assigned to ${t.assignedTo.name}`}
          </p>

          <p className="mt-2 text-sm text-slate">{t.description}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.projectLinks.map((pl) => (
              <Link
                key={pl.project.id}
                href={`/projects/${pl.project.id}?tab=tickets`}
                className="rounded-full bg-bg px-2 py-0.5 text-xs text-steel hover:underline"
              >
                {pl.project.title}
              </Link>
            ))}
          </div>

          <div className="mt-3">
            <TicketActions
              ticketId={t.id}
              status={t.status}
              canRespond={role === "rl_user"}
              canEscalate={isAdmin}
              canClose={t.raisedById === userId || isAdmin}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
