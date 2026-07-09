import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const approvals = await prisma.approvalRequest.findMany({
    where: { status: "pending", project: projectScopeWhere(user) },
    orderBy: { slaDeadline: "asc" },
    include: {
      project: { select: { id: true, title: true } },
      milestone: { select: { name: true } },
      requestedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Pending Approvals</h1>
        <p className="text-sm text-slate">{approvals.length} awaiting decision</p>
      </div>

      {approvals.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No pending approvals" subtitle="Approval requests awaiting your decision will appear here." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Milestone</th>
                <th className="px-4 py-3 font-medium">Requested By</th>
                <th className="px-4 py-3 font-medium">SLA Deadline</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => {
                const breached = a.slaDeadline && now > a.slaDeadline;
                return (
                  <tr key={a.id} className={`border-b border-border last:border-0 ${breached ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 text-navy">{a.project.title}</td>
                    <td className="px-4 py-3 text-slate">{a.milestone.name}</td>
                    <td className="px-4 py-3 text-slate">{a.requestedBy.name}</td>
                    <td className={`px-4 py-3 ${breached ? "font-medium text-danger" : "text-slate"}`}>
                      {formatDate(a.slaDeadline)} {breached && "· overdue"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={breached ? "overdue" : "pending"} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/projects/${a.project.id}?tab=approvals`} className="text-sm text-info hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
