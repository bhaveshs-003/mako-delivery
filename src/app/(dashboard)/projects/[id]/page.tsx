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
import { AssignResourcesDialog } from "@/components/projects/AssignResourcesDialog";
import { DependenciesTab } from "@/components/projects/tabs/DependenciesTab";
import { LifecycleTab } from "@/components/projects/tabs/LifecycleTab";
import { OverviewTab } from "@/components/projects/tabs/OverviewTab";
import { ApprovalsTab } from "@/components/projects/tabs/ApprovalsTab";
import { TicketsTab } from "@/components/projects/tabs/TicketsTab";
import { ChangeRequestsTab } from "@/components/projects/tabs/ChangeRequestsTab";
import { MomsTab } from "@/components/projects/tabs/MomsTab";
import { CommentsTab } from "@/components/projects/tabs/CommentsTab";
import { DocumentsTab } from "@/components/projects/tabs/DocumentsTab";
import { cn, formatDate } from "@/lib/utils";

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
  const canAssign = can(user.role, "project.assign") && canActOnProject(user, project);
  const activeTab = TABS.some((t) => t.key === searchParams.tab)
    ? searchParams.tab!
    : "overview";

  const now = new Date();
  const pastDeadline =
    !project.actualCompletionDate && now > project.rlCommittedDeadline;

  return (
    <div className="space-y-4">
      {/* Compact header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>

        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                {project.title}
              </h1>
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

            {/* Meta: people + the three timelines, inline & compact */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {project.projectLead && (
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <UserAvatar
                    name={project.projectLead.name}
                    deactivated={!project.projectLead.isActive}
                    size="sm"
                  />
                  {project.projectLead.name}
                </span>
              )}
              {project.rlConsultants.length > 0 && (
                <span>RL: {project.rlConsultants.map((c) => c.user.name).join(", ")}</span>
              )}
              <span className="hidden text-line-strong sm:inline">•</span>
              <span className={pastDeadline ? "text-danger" : "text-ink-2"}>
                <span className="text-muted">RL</span> {formatDate(project.rlCommittedDeadline)}
              </span>
              <span className="text-ink-2">
                <span className="text-muted">Mako</span> {formatDate(project.makoInternalDeadline)}
              </span>
              <span className="text-ink-2">
                <span className="text-muted">Actual</span> {formatDate(project.actualCompletionDate)}
              </span>
              {project.rlProjectId && (
                <span className="text-ink-2">
                  <span className="text-muted">ID</span> {project.rlProjectId}
                </span>
              )}
            </div>
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
            />
          </div>
        </div>

        {project.status === "paused" && project.currentPauseReasonComment && (
          <div className="mt-3 rounded-md border-l-2 border-warning bg-warning/5 px-3 py-1.5 text-xs text-warning">
            <span className="font-medium">Paused</span> ·{" "}
            {project.currentPauseReasonCategory?.replace(/_/g, " ")} —{" "}
            {project.currentPauseReasonComment}
          </div>
        )}
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
      {activeTab === "overview" && <OverviewTab projectId={project.id} description={project.description} />}
      {activeTab === "lifecycle" && <LifecycleTab projectId={project.id} canManage={canManage} userId={user.id} userRole={user.role} />}
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
      {activeTab === "change-requests" && (
        <ChangeRequestsTab
          projectId={project.id}
          canRaise={can(user.role, "cr.raise") && canManage}
          canDecide={can(user.role, "cr.decide") && canActOnProject(user, project)}
        />
      )}
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
