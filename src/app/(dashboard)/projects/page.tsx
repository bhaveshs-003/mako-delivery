import { ClickableRow } from "@/components/shared/ClickableRow";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";
import { deriveDependencyState, deriveProjectHealth } from "@/lib/sla";
import { PROJECT_TYPE_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreateProjectForm } from "@/components/forms/CreateProjectForm";
import { ProjectsFilters } from "@/components/projects/ProjectsFilters";
import { formatDate } from "@/lib/utils";
import { FolderKanban } from "lucide-react";
import type { Prisma } from "@prisma/client";

const HEALTH_DOT: Record<string, string> = {
  on_track: "bg-success",
  at_risk: "bg-warning",
  delayed: "bg-danger",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; q?: string; archived?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "resource") redirect("/tasks");

  const canCreate = user.role === "super_admin" || user.role === "admin";
  const showArchived = searchParams.archived === "1";

  const filters: Prisma.ProjectWhereInput = {
    ...projectScopeWhere(user),
    ...(showArchived ? {} : { isArchived: false }),
    ...(searchParams.type ? { type: searchParams.type as never } : {}),
    ...(searchParams.status ? { status: searchParams.status as never } : {}),
    ...(searchParams.q
      ? { title: { contains: searchParams.q, mode: "insensitive" } }
      : {}),
  };

  const now = new Date();
  const projects = await prisma.project.findMany({
    where: filters,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      isArchived: true,
      rlCommittedDeadline: true,
      makoInternalDeadline: true,
      actualCompletionDate: true,
      projectLead: { select: { name: true, isActive: true } },
      rlConsultants: {
        select: { user: { select: { name: true, isActive: true } } },
      },
      dependencies: {
        select: {
          dateRequested: true,
          dateReceived: true,
          slaThresholdDays: true,
          status: true,
          rootCauseCategory: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            {canCreate ? "Projects" : "My Projects"}
          </h1>
          <p className="text-sm text-slate">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && <CreateProjectForm />}
      </div>

      <ProjectsFilters />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            searchParams.type || searchParams.status || searchParams.q
              ? "No results match your filters"
              : "No projects yet"
          }
          subtitle={
            searchParams.type || searchParams.status || searchParams.q
              ? "Try clearing or adjusting the filters above."
              : canCreate
                ? "Create your first project to start tracking."
                : "Projects you lead or are assigned to will appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">RL POC</th>
                  <th className="px-4 py-3 font-medium">RL Deadline</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const hasBreach = p.dependencies.some(
                    (d) =>
                      deriveDependencyState(
                        {
                          dateRequested: d.dateRequested,
                          dateReceived: d.dateReceived,
                          slaThresholdDays: d.slaThresholdDays,
                          status: d.status,
                          rootCauseCategory: d.rootCauseCategory,
                        },
                        now
                      ).slaBreached
                  );
                  const hasNear = p.dependencies.some(
                    (d) =>
                      deriveDependencyState(
                        {
                          dateRequested: d.dateRequested,
                          dateReceived: d.dateReceived,
                          slaThresholdDays: d.slaThresholdDays,
                          status: d.status,
                          rootCauseCategory: d.rootCauseCategory,
                        },
                        now
                      ).slaAtRisk
                  );
                  const health = deriveProjectHealth({
                    status: p.status,
                    rlCommittedDeadline: p.rlCommittedDeadline,
                    makoInternalDeadline: p.makoInternalDeadline,
                    actualCompletionDate: p.actualCompletionDate,
                    hasBreachedDependency: hasBreach,
                    hasDependencyNearBreach: hasNear,
                    now,
                  });
                  const pastDeadline =
                    !!p.rlCommittedDeadline &&
                    !p.actualCompletionDate &&
                    now > p.rlCommittedDeadline;

                  return (
                    <ClickableRow
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className={`border-b border-border last:border-0 hover:bg-bg ${p.isArchived ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium text-navy ${p.isArchived ? "line-through" : ""}`}
                        >
                          {p.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate">
                        {PROJECT_TYPE_LABELS[p.type]}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${HEALTH_DOT[health]}`}
                          />
                          <span className="capitalize text-slate">
                            {health.replace("_", " ")}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.projectLead ? (
                          <span className="inline-flex items-center gap-2">
                            <UserAvatar
                              name={p.projectLead.name}
                              deactivated={!p.projectLead.isActive}
                              size="sm"
                            />
                            <span className="text-slate">
                              {p.projectLead.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1.5">
                          {p.rlConsultants.slice(0, 2).map((c, i) => (
                            <UserAvatar
                              key={i}
                              name={c.user.name}
                              deactivated={!c.user.isActive}
                              size="sm"
                              className="ring-2 ring-surface"
                            />
                          ))}
                          {p.rlConsultants.length > 2 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg text-[10px] font-medium text-slate ring-2 ring-surface">
                              +{p.rlConsultants.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 ${pastDeadline ? "font-medium text-danger" : "text-slate"}`}
                      >
                        {formatDate(p.rlCommittedDeadline)}
                      </td>
                    </ClickableRow>
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
