import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere, can, canActOnProject } from "@/lib/permissions";
import { PROJECT_TYPE_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ProjectActions } from "@/components/projects/ProjectActions";
import { AssignResourcesDialog } from "@/components/projects/AssignResourcesDialog";
import { ProjectTimelineBar } from "@/components/projects/ProjectTimelineBar";
import { ScopeUnderstandingCard } from "@/components/projects/ScopeUnderstandingCard";
import { DependenciesTab } from "@/components/projects/tabs/DependenciesTab";
import { LifecycleTab } from "@/components/projects/tabs/LifecycleTab";
import { OverviewTab } from "@/components/projects/tabs/OverviewTab";
import { ApprovalsTab } from "@/components/projects/tabs/ApprovalsTab";
import { TicketsTab } from "@/components/projects/tabs/TicketsTab";
import { MomsTab } from "@/components/projects/tabs/MomsTab";
import { CommentsTab } from "@/components/projects/tabs/CommentsTab";
import { DocumentsTab } from "@/components/projects/tabs/DocumentsTab";
import { cn } from "@/lib/utils";
import { rlProposedDays, makoPromisedDays } from "@/lib/allocation";

const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "scope", label: "Scope Understanding" },
  { key: "lifecycle", label: "Lifecycle & Milestones" },
  { key: "dependencies", label: "Dependencies" },
  { key: "approvals", label: "Approvals" },
  { key: "tickets", label: "Tickets" },
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
  const canAssign = can(user.role, "project.assign") && canActOnProject(user, project);
  const activeTab = TABS.some((t) => t.key === searchParams.tab)
    ? searchParams.tab!
    : "overview";

  const rlDays = rlProposedDays(project);
  const makoDays = makoPromisedDays(project);

  return (
    <div className="space-y-4">
      {/* Project header */}
      <div className="rounded-xl bg-surface p-3.5 shadow-card">
          {/* Title + timeline donut + actions */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-2">
                  {PROJECT_TYPE_LABELS[project.type]}
                </span>
                <StatusBadge status={project.status} />
                {project.isArchived && (
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted">
                    Archived
                  </span>
                )}
              </div>
              <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                {project.title}
              </h1>
            </div>

            {/* Timeline summary — occupies the centre of the header */}
            <div className="flex flex-1 justify-center">
              <ProjectTimelineBar
                rlStart={project.rlStartDate}
                rlEnd={project.rlCommittedDeadline}
                makoStart={project.makoStartDate}
                makoEnd={project.makoInternalDeadline}
                actual={project.actualCompletionDate}
                rlDays={rlDays}
                makoDays={makoDays}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAssign && (
                <AssignResourcesDialog
                  projectId={project.id}
                  currentResourceIds={project.resources.map((r) => r.userId)}
                  currentConsultantIds={project.rlConsultants.map((c) => c.userId)}
                />
              )}
              <ProjectActions
                projectId={project.id}
                status={project.status}
                canManage={canManage}
                canArchive={canArchive}
                isArchived={project.isArchived}
                scopeApproved={project.scopeApproved}
                planApproved={project.milestonePlanStatus === "approved"}
              />
            </div>
          </div>

          {project.status === "paused" && project.currentPauseReasonComment && (
            <div className="mt-2.5 rounded-md border-l-2 border-warning bg-warning/5 px-3 py-1.5 text-xs text-warning">
              <span className="font-medium">Paused</span> ·{" "}
              {project.currentPauseReasonCategory?.replace(/_/g, " ")} —{" "}
              {project.currentPauseReasonComment}
            </div>
          )}

          {/* People — single compact row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line pt-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted">Lead</span>
              {project.projectLead ? (
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <UserAvatar name={project.projectLead.name} deactivated={!project.projectLead.isActive} size="sm" />
                  {project.projectLead.name}
                </span>
              ) : (
                <span className="text-muted">Unassigned</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted">RL POC</span>
              {project.rlConsultants.length > 0 ? (
                <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {project.rlConsultants.map((c) => (
                    <span key={c.userId} className="inline-flex items-center gap-1.5 text-ink">
                      <UserAvatar name={c.user.name} deactivated={!c.user.isActive} size="sm" />
                      {c.user.name}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </span>
            {project.rlProjectId && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted">RL ID</span>
                <span className="tabular text-ink">{project.rlProjectId}</span>
              </span>
            )}
          </div>
      </div>

      {/* Sticky tab bar pinned to the top of the scroll area */}
      <div className="sticky top-0 z-20 -mx-6 border-b border-line bg-canvas/85 px-6 backdrop-blur">
        <nav className="scroll-slim flex gap-5 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/projects/${project.id}?tab=${tab.key}`}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-0.5 py-2.5 text-sm transition-colors",
                  active
                    ? "border-brand font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab projectId={project.id} description={project.description} />
      )}
      {activeTab === "scope" && (
        <ScopeUnderstandingCard
          projectId={project.id}
          canSubmit={canManage}
          canDecide={can(user.role, "approval.decide") && canActOnProject(user, project)}
          decerId={user.id}
        />
      )}
      {activeTab === "lifecycle" && (
        <LifecycleTab
          projectId={project.id}
          canManage={canManage}
          canDecidePlan={can(user.role, "approval.decide") && canActOnProject(user, project)}
          userId={user.id}
          userRole={user.role}
        />
      )}
      {activeTab === "dependencies" && <DependenciesTab projectId={project.id} role={user.role} canManage={canManage} />}
      {activeTab === "approvals" && (
        <ApprovalsTab
          projectId={project.id}
          userId={user.id}
          canRequest={can(user.role, "approval.request") && canManage}
          canDecide={can(user.role, "approval.decide") && canActOnProject(user, project)}
        />
      )}
      {activeTab === "tickets" && <TicketsTab projectId={project.id} user={user} />}
      {activeTab === "moms" && (
        <MomsTab projectId={project.id} userId={user.id} canLog={can(user.role, "meeting.log") && canActOnProject(user, project)} />
      )}
      {activeTab === "comments" && <CommentsTab projectId={project.id} userId={user.id} />}
      {activeTab === "documents" && (
        <DocumentsTab projectId={project.id} canUpload={canActOnProject(user, project)} />
      )}
    </div>
  );
}

