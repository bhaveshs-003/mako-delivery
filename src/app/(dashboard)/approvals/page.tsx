import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

type Row = {
  key: string;
  projectId: string;
  projectTitle: string;
  item: string;
  kind: string;
  who: string;
  deadline: Date | null;
  breached: boolean;
  tab: string;
};

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const scope = projectScopeWhere(user);

  // Three kinds of RL decision surface here: individual milestone approvals,
  // scope-understanding documents, and whole milestone plans.
  const [approvals, scopeDocs, planProjects] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { status: "pending", project: scope },
      orderBy: { slaDeadline: "asc" },
      include: {
        project: { select: { id: true, title: true } },
        milestone: { select: { name: true } },
        requestedBy: { select: { name: true } },
      },
    }),
    prisma.scopeDocument.findMany({
      where: { status: "pending", project: scope },
      orderBy: { submittedAt: "asc" },
      include: { project: { select: { id: true, title: true } } },
    }),
    prisma.project.findMany({
      where: { milestonePlanStatus: "pending_approval", ...scope },
      orderBy: { milestonePlanSubmittedAt: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const rows: Row[] = [
    ...scopeDocs.map((d) => ({
      key: `scope-${d.id}`,
      projectId: d.project.id,
      projectTitle: d.project.title,
      item: d.title || d.filename,
      kind: d.kind === "change_request" ? "Change Request" : "Scope Understanding",
      who: "—",
      deadline: null,
      breached: false,
      tab: "scope",
    })),
    ...planProjects.map((p) => ({
      key: `plan-${p.id}`,
      projectId: p.id,
      projectTitle: p.title,
      item: "Milestone plan",
      kind: "Milestone Plan",
      who: "—",
      deadline: null,
      breached: false,
      tab: "lifecycle",
    })),
    ...approvals.map((a) => ({
      key: `appr-${a.id}`,
      projectId: a.project.id,
      projectTitle: a.project.title,
      item: a.milestone.name,
      kind: "Milestone",
      who: a.requestedBy.name,
      deadline: a.slaDeadline,
      breached: !!(a.slaDeadline && now > a.slaDeadline),
      tab: "approvals",
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Pending Approvals</h1>
        <p className="text-sm text-slate">{rows.length} awaiting decision</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No pending approvals" subtitle="Approval requests awaiting your decision will appear here." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Requested By</th>
                <th className="px-4 py-3 font-medium">SLA Deadline</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-b border-border last:border-0 ${r.breached ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-3 text-navy">{r.projectTitle}</td>
                  <td className="px-4 py-3 text-slate">{r.item}</td>
                  <td className="px-4 py-3 text-slate">{r.kind}</td>
                  <td className="px-4 py-3 text-slate">{r.who}</td>
                  <td className={`px-4 py-3 ${r.breached ? "font-medium text-danger" : "text-slate"}`}>
                    {r.deadline ? `${formatDate(r.deadline)}${r.breached ? " · overdue" : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.breached ? "overdue" : "pending"} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/projects/${r.projectId}?tab=${r.tab}`} className="text-sm text-info hover:underline">
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
