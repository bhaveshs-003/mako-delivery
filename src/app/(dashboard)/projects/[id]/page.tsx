import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere, can, canActOnProject } from "@/lib/permissions";
import { PROJECT_TYPE_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ProjectActions } from "@/components/projects/ProjectActions";
import { DependenciesTab } from "@/components/projects/tabs/DependenciesTab";
import { LifecycleTab } from "@/components/projects/tabs/LifecycleTab";
import { OverviewTab } from "@/components/projects/tabs/OverviewTab";
import { PhasePlaceholder } from "@/components/shared/PhasePlaceholder";
import { formatDate } from "@/lib/utils";

const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "lifecycle", label: "Lifecycle & Milestones" },
  { key: "dependencies", label: "Dependencies" },
  { key: "approvals", label: "Approvals" },
  { key: "tickets", label: "Tickets" },
  { key: "change-requests", label: "Change Requests" },
  { key: "moms", label: "MoMs" },
  { key: "comments", label: "Comments" },
  { key: "documents", label: "Documents" },
];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Scope is enforced in the query: a user cannot load a project outside their
  // assignments even by guessing the id (spec §3.2).
  const project = await prisma.project.findFirst({
    where: { id: params.id, ...projectScopeWhere(user) },
    include: {
      projectLead: { select: { name: true, isActive: true } },
      rlConsultants: {
        select: { userId: true, user: { select: { name: true, isActive: true } } },
      },
      resources: { select: { userId: true } },
    },
  });

  if (!project) notFound();

  const canManage =
    can(user.role, "project.edit") && canActOnProject(user, project);
  const canArchive = can(user.role, "project.archive");
  const activeTab = TABS.some((t) => t.key === searchParams.tab)
    ? searchParams.tab!
    : "overview";

  const now = new Date();
  const pastDeadline =
    !project.actualCompletionDate && now > project.rlCommittedDeadline;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-slate hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      {/* Project header (spec §5.3) */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-bg px-2 py-0.5 text-xs font-medium text-slate">
                {PROJECT_TYPE_LABELS[project.type]}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl font-bold text-navy">
              {project.title}
              {project.isArchived && (
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 align-middle text-xs font-medium text-gray-500">
                  Archived
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate">
              {project.projectLead && (
                <span className="inline-flex items-center gap-1.5">
                  Lead:
                  <UserAvatar
                    name={project.projectLead.name}
                    deactivated={!project.projectLead.isActive}
                    size="sm"
                  />
                  {project.projectLead.name}
                </span>
              )}
              {project.rlConsultants.length > 0 && (
                <span>
                  · RL: {project.rlConsultants.map((c) => c.user.name).join(", ")}
                </span>
              )}
            </p>
          </div>
          <ProjectActions
            projectId={project.id}
            status={project.status}
            canManage={canManage}
            canArchive={canArchive}
            isArchived={project.isArchived}
          />
        </div>

        {project.status === "paused" && project.currentPauseReasonComment && (
          <div className="mt-4 rounded-md border-l-4 border-warning bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="font-medium">Paused</span> ·{" "}
            {project.currentPauseReasonCategory?.replace(/_/g, " ")} —{" "}
            {project.currentPauseReasonComment}
          </div>
        )}

        {/* The THREE timelines */}
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-md border border-border bg-bg p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">
              RL Deadline
            </p>
            <p
              className={`text-sm font-semibold ${pastDeadline ? "text-danger" : "text-navy"}`}
            >
              {formatDate(project.rlCommittedDeadline)}
            </p>
            <p className="text-[10px] text-slate">fixed</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">
              Mako Target
            </p>
            <p className="text-sm font-semibold text-navy">
              {formatDate(project.makoInternalDeadline)}
            </p>
            <p className="text-[10px] text-slate">adjustable</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">
              Actual Completion
            </p>
            <p className="text-sm font-semibold text-navy">
              {formatDate(project.actualCompletionDate)}
            </p>
            <p className="text-[10px] text-slate">auto-calc</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">
              RL Project ID
            </p>
            <p className="text-sm font-semibold text-navy">
              {project.rlProjectId ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar — navigable via ?tab= (spec §5.3) */}
      <div className="border-b border-border">
        <div className="flex flex-wrap gap-4 overflow-x-auto text-sm">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/projects/${project.id}?tab=${tab.key}`}
                className={`whitespace-nowrap border-b-2 pb-2 ${
                  active
                    ? "border-navy font-medium text-navy"
                    : "border-transparent text-slate hover:text-navy"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab projectId={project.id} description={project.description} />}
      {activeTab === "lifecycle" && <LifecycleTab projectId={project.id} canManage={canManage} userId={user.id} userRole={user.role} />}
      {activeTab === "dependencies" && <DependenciesTab projectId={project.id} role={user.role} canManage={canManage} />}
      {activeTab === "approvals" && <PhasePlaceholder title="Approvals" phase="Phase 4" description="Approval requests with SLA tracking and mandatory decision comments." />}
      {activeTab === "tickets" && <PhasePlaceholder title="Tickets" phase="Phase 4" description="Multi-project tickets with RL response flow." />}
      {activeTab === "change-requests" && <PhasePlaceholder title="Change Requests" phase="Phase 5" description="Scope-change gate with timeline auto-adjustment." />}
      {activeTab === "moms" && <PhasePlaceholder title="MoMs" phase="Phase 5" description="Meeting minutes with deadline enforcement and late-reason attribution." />}
      {activeTab === "comments" && <PhasePlaceholder title="Comments" phase="Phase 5" description="Threaded comments with edit history and @mentions." />}
      {activeTab === "documents" && <PhasePlaceholder title="Documents" phase="Phase 5" description="File uploads backed by S3 (or local fallback in dev)." />}
    </div>
  );
}
