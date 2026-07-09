import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveDependencyState } from "@/lib/sla";
import { STATUS_LABELS } from "@/lib/constants";
import { AttributionBadge } from "@/components/shared/AttributionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LogDependencyForm } from "@/components/forms/LogDependencyForm";
import { MarkReceivedButton } from "@/components/forms/MarkReceivedForm";
import { formatDate } from "@/lib/utils";
import { Link2, AlertTriangle } from "lucide-react";

export async function DependenciesTab({
  projectId,
  role,
  canManage,
}: {
  projectId: string;
  role: UserRole;
  canManage: boolean;
}) {
  const now = new Date();
  const [dependencies, slaConfigs, milestones] = await Promise.all([
    prisma.dependency.findMany({
      where: { projectId },
      orderBy: { dateRequested: "desc" },
    }),
    prisma.slaConfig.findMany(),
    prisma.milestone.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const slaDefaults = Object.fromEntries(
    slaConfigs.map((c) => [c.dependencyType, c.thresholdDays])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy">Dependencies</h2>
          <p className="text-sm text-slate">
            The core delay-tracking ledger. Burn is counted in business days.
          </p>
        </div>
        {canManage && (
          <LogDependencyForm
            projectId={projectId}
            slaDefaults={slaDefaults}
            milestones={milestones}
          />
        )}
      </div>

      {dependencies.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No dependencies logged"
          subtitle="Log the credentials, source sheets, approvals, and clarifications this project waits on."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">From</th>
                  <th className="px-3 py-3 font-medium">Requested</th>
                  <th className="px-3 py-3 font-medium">SLA</th>
                  <th className="px-3 py-3 font-medium">Received</th>
                  <th className="px-3 py-3 font-medium">Burn</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Root Cause</th>
                  <th className="px-3 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map((d) => {
                  const state = deriveDependencyState(
                    {
                      dateRequested: d.dateRequested,
                      dateReceived: d.dateReceived,
                      slaThresholdDays: d.slaThresholdDays,
                      status: d.status,
                      rootCauseCategory: d.rootCauseCategory,
                    },
                    now
                  );
                  const burnColor = state.slaBreached
                    ? "text-danger font-semibold"
                    : state.slaAtRisk
                      ? "text-warning font-medium"
                      : "text-success";
                  const displayStatus = state.slaBreached && d.status !== "received" ? "overdue" : d.status;

                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-border last:border-0 ${state.slaBreached && d.status !== "received" ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-3 py-3 capitalize text-navy">
                        {d.type.replace(/_/g, " ")}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate" title={d.description}>
                        {d.description}
                      </td>
                      <td className="px-3 py-3 capitalize text-slate">
                        {d.requestedFromParty.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-3 text-slate">{formatDate(d.dateRequested)}</td>
                      <td className="px-3 py-3 text-slate">{d.slaThresholdDays}d</td>
                      <td className="px-3 py-3 text-slate">{formatDate(d.dateReceived)}</td>
                      <td className={`px-3 py-3 ${burnColor}`}>
                        <span className="inline-flex items-center gap-1">
                          {state.slaBreached && <AlertTriangle className="h-3.5 w-3.5" />}
                          {state.burnDays}d
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td className="px-3 py-3">
                        {d.rootCauseCategory ? (
                          <AttributionBadge party={d.rootCauseCategory} />
                        ) : state.slaBreached && d.status === "received" ? (
                          <span className="text-xs font-medium text-danger">Required</span>
                        ) : (
                          <span className="text-slate">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {d.status !== "received" && (
                          <MarkReceivedButton
                            dependencyId={d.id}
                            dateRequested={d.dateRequested.toISOString().slice(0, 10)}
                            slaThresholdDays={d.slaThresholdDays}
                            requestedFromParty={d.requestedFromParty}
                            role={role}
                            canManage={canManage}
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
      <p className="text-xs text-slate">
        {STATUS_LABELS.overdue} rows are tinted red. Burn turns amber at 80% of
        SLA and red on breach — when a breached dependency is received, a
        root-cause tag becomes mandatory.
      </p>
    </div>
  );
}
