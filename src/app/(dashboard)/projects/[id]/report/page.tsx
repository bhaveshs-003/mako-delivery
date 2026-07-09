import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";
import { getAttributionReport } from "@/lib/reports";
import { deriveDependencyState } from "@/lib/sla";
import { businessDaysBetween } from "@/lib/business-days";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS, PROJECT_TYPE_LABELS } from "@/lib/constants";
import { PrintButton } from "@/components/shared/PrintButton";
import { formatDate } from "@/lib/utils";

// Post-mortem report (spec §5.5.3): the one-click evidence export for disputes.
export default async function PostMortemPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { id: params.id, ...projectScopeWhere(user) },
    include: {
      projectLead: { select: { name: true } },
      dependencies: true,
      pauseHistory: true,
      approvals: { include: { milestone: { select: { name: true } } } },
      changeRequests: true,
      meetings: true,
      ticketLinks: { include: { ticket: true } },
    },
  });
  if (!project) notFound();

  const now = new Date();
  const attr = await getAttributionReport(user, { projectId: project.id });
  const totals = attr.totals;

  const momOnTime = project.meetings.filter((m) => m.momStatus === "submitted").length;
  const momLate = project.meetings.filter((m) => m.momStatus === "late").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-slate hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
        <PrintButton />
      </div>

      {/* Report header */}
      <div className="border-b border-border pb-4">
        <p className="text-xs uppercase tracking-wide text-slate">Mako Governance · Post-Mortem</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">{project.title}</h1>
        <p className="mt-1 text-sm text-slate">
          {PROJECT_TYPE_LABELS[project.type]} · Lead {project.projectLead?.name ?? "—"} · Generated {formatDate(now)}
        </p>
      </div>

      {/* Timeline summary */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-navy">Timeline</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate">RL Committed</p><p className="font-medium text-navy">{formatDate(project.rlCommittedDeadline)}</p></div>
          <div><p className="text-slate">Mako Target</p><p className="font-medium text-navy">{formatDate(project.makoInternalDeadline)}</p></div>
          <div><p className="text-slate">Actual Completion</p><p className="font-medium text-navy">{formatDate(project.actualCompletionDate)}</p></div>
        </div>
      </section>

      {/* Attribution summary */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-navy">Delay Attribution — {totals.total} business days</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {(["mako", "rl", "client_via_rl", "product_bug"] as const).map((k) => (
            <span key={k} className="rounded-md border border-border px-3 py-1">
              <span className="font-medium" style={{ color: ATTRIBUTION_COLORS[k] }}>{ATTRIBUTION_LABELS[k]}</span>: {totals[k]}d
              {totals.total > 0 && ` (${Math.round((totals[k] / totals.total) * 100)}%)`}
            </span>
          ))}
        </div>
        {totals.total > 0 && (
          <p className="mt-2 text-sm text-slate">
            Of {totals.total} business days lost,{" "}
            <span className="font-medium text-navy">{totals.total - totals.mako}</span> were attributable to non-Mako parties.
          </p>
        )}
      </section>

      {/* Dependencies */}
      <ReportTable
        title="Dependencies"
        headers={["Type", "From", "Requested", "Received", "Burn", "SLA", "Root Cause"]}
        rows={project.dependencies.map((d) => {
          const s = deriveDependencyState({ dateRequested: d.dateRequested, dateReceived: d.dateReceived, slaThresholdDays: d.slaThresholdDays, status: d.status, rootCauseCategory: d.rootCauseCategory }, now);
          return [
            d.type.replace(/_/g, " "),
            d.requestedFromParty.replace(/_/g, " "),
            formatDate(d.dateRequested),
            formatDate(d.dateReceived),
            `${s.burnDays}d${s.slaBreached ? " ⚠" : ""}`,
            `${d.slaThresholdDays}d`,
            d.rootCauseCategory ? ATTRIBUTION_LABELS[d.rootCauseCategory] : "—",
          ];
        })}
      />

      {/* Pauses */}
      <ReportTable
        title="Pauses"
        headers={["Paused", "Resumed", "Duration", "Reason", "Comment"]}
        rows={project.pauseHistory.map((p) => [
          formatDate(p.pausedAt),
          p.resumedAt ? formatDate(p.resumedAt) : "ongoing",
          `${p.pauseDurationDays ?? businessDaysBetween(p.pausedAt, now)}d`,
          ATTRIBUTION_LABELS[p.reasonCategory] ?? p.reasonCategory,
          p.reasonComment,
        ])}
      />

      {/* Approvals */}
      <ReportTable
        title="Approvals"
        headers={["Milestone", "Requested", "Decided", "Turnaround", "Status"]}
        rows={project.approvals.map((a) => [
          a.milestone.name,
          formatDate(a.requestedAt),
          formatDate(a.decidedAt),
          a.decidedAt ? `${businessDaysBetween(a.requestedAt, a.decidedAt)}d` : "pending",
          a.status,
        ])}
      />

      {/* Tickets */}
      <ReportTable
        title="Tickets"
        headers={["Title", "Type", "Priority", "Status"]}
        rows={project.ticketLinks.map((tl) => [tl.ticket.title, tl.ticket.type.replace(/_/g, " "), tl.ticket.priority, tl.ticket.status])}
      />

      {/* Change Requests */}
      <ReportTable
        title="Change Requests"
        headers={["Scope", "Impact (days)", "Status"]}
        rows={project.changeRequests.map((c) => [c.scopeDelta, String(c.timelineImpactDays ?? 0), c.status])}
      />

      {/* MoM compliance */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-navy">MoM Compliance</h2>
        <p className="text-sm text-slate">
          On time: <span className="font-medium text-success">{momOnTime}</span> · Late:{" "}
          <span className="font-medium text-danger">{momLate}</span> · Total meetings: {project.meetings.length}
        </p>
      </section>

      <p className="border-t border-border pt-4 text-xs text-slate">
        This report is compiled from the tamper-evident Mako Governance ledger. All timestamps are server-generated.
      </p>
    </div>
  );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-navy">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate">None recorded.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                {headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((cell, j) => <td key={j} className="px-3 py-2 text-slate">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
