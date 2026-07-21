import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";
import { deriveDependencyState } from "@/lib/sla";
import { getDownloadUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttributionBadge } from "@/components/shared/AttributionBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { MarkReceivedButton } from "@/components/forms/MarkReceivedForm";
import { Link2, AlertTriangle, FileText } from "lucide-react";

// Dependencies allocated to the current user across their projects. RL users see
// the RL-requested dependencies they must fulfil; managers see all in scope.
export default async function DependenciesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const isManager = ["super_admin", "admin", "sub_admin"].includes(user.role);
  const deps = await prisma.dependency.findMany({
    where: {
      project: projectScopeWhere(user),
      ...(user.role === "rl_user" ? { requestedFromParty: "rl" } : {}),
    },
    orderBy: [{ status: "asc" }, { dateRequested: "desc" }],
    include: {
      project: { select: { id: true, title: true } },
      milestone: { select: { name: true } },
    },
  });

  const rows = await Promise.all(
    deps.map(async (d) => ({
      d,
      docUrl: d.fulfillmentDocKey ? await getDownloadUrl(d.fulfillmentDocKey) : null,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Dependencies</h1>
        <p className="text-sm text-slate">
          {user.role === "rl_user"
            ? "Dependencies assigned to you to fulfil. Attach a document and note before marking sent."
            : "Dependencies across your projects. Burn is counted in business days."}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Link2} title="No dependencies" subtitle="Dependencies allocated to you will appear here." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                  <th className="px-3 py-3 font-medium">Project</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">Requested</th>
                  <th className="px-3 py-3 font-medium">SLA</th>
                  <th className="px-3 py-3 font-medium">Burn</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, docUrl }) => {
                  const state = deriveDependencyState(
                    { dateRequested: d.dateRequested, dateReceived: d.dateReceived, slaThresholdDays: d.slaThresholdDays, status: d.status, rootCauseCategory: d.rootCauseCategory },
                    now
                  );
                  const overdue = state.slaBreached && d.status !== "received";
                  const burnColor = state.slaBreached ? "text-danger font-semibold" : state.slaAtRisk ? "text-warning font-medium" : "text-success";
                  return (
                    <tr key={d.id} className={`border-b border-border last:border-0 ${overdue ? "bg-red-50/40" : ""}`}>
                      <td className="px-3 py-3">
                        <Link href={`/projects/${d.project.id}?tab=dependencies`} className="text-info hover:underline">{d.project.title}</Link>
                      </td>
                      <td className="px-3 py-3 capitalize text-navy">{d.type.replace(/_/g, " ")}</td>
                      <td className="max-w-[260px] px-3 py-3 text-slate">
                        <p className="truncate" title={d.description}>{d.description}</p>
                        {d.milestone && <p className="mt-0.5 truncate text-2xs text-muted">{d.milestone.name}</p>}
                        {docUrl && (
                          <a href={docUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-2xs text-brand-ink hover:underline">
                            <FileText className="h-3 w-3" /> {d.fulfillmentDocName}
                          </a>
                        )}
                        {d.fulfillmentComment && <p className="mt-0.5 text-2xs text-ink-2">“{d.fulfillmentComment}”</p>}
                      </td>
                      <td className="px-3 py-3 text-slate">{formatDate(d.dateRequested)}</td>
                      <td className="px-3 py-3 text-slate">{d.slaThresholdDays}d</td>
                      <td className={`px-3 py-3 ${burnColor}`}>
                        <span className="inline-flex items-center gap-1">
                          {state.slaBreached && <AlertTriangle className="h-3.5 w-3.5" />}{state.burnDays}d
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {d.rootCauseCategory ? <AttributionBadge party={d.rootCauseCategory} /> : <StatusBadge status={overdue ? "overdue" : d.status} />}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {d.status !== "received" && (
                          <MarkReceivedButton
                            dependencyId={d.id}
                            dateRequested={d.dateRequested.toISOString().slice(0, 10)}
                            slaThresholdDays={d.slaThresholdDays}
                            requestedFromParty={d.requestedFromParty}
                            role={user.role}
                            canManage={isManager}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
