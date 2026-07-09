import { getCurrentUser } from "@/lib/session";
import { getDashboardMetrics } from "@/lib/metrics";
import { ROLE_LABELS } from "@/lib/constants";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DelayAttributionDonut } from "@/components/charts/DelayAttributionDonut";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const m = await getDashboardMetrics(user);
  const isOrgWide = user.role === "super_admin" || user.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          {isOrgWide ? "Organization Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-slate">
          Welcome back, {user.name} · {ROLE_LABELS[user.role]}
        </p>
      </div>

      {/* Row 1 — stat cards (spec §5.1.1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isOrgWide ? "Total Projects" : "My Projects"}
          value={m.totalProjects}
          sub={`${m.active} active`}
          href="/projects"
        />
        <StatCard
          label="Open Dependencies"
          value={m.openDependencies}
          sub={`${m.breachedDependencies} SLA breached`}
          subTone={m.breachedDependencies > 0 ? "danger" : "muted"}
        />
        <StatCard
          label="At-Risk / Delayed"
          value={m.atRisk + m.delayed}
          sub={`${m.delayed} delayed`}
          subTone={m.delayed > 0 ? "danger" : "muted"}
          pulse={m.atRisk + m.delayed > 0}
        />
        <StatCard
          label="Days Burnt (30d)"
          value={m.totalBurn30}
          sub={`${m.rlSharePct}% RL-caused`}
          subTone="rl"
        />
      </div>

      {/* Row 2 — charts (spec §5.1.1) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delay Attribution — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <DelayAttributionDonut data={m.attribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(m.statusCounts).length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate">
                No projects yet
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {Object.entries(m.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                      <div
                        className="h-full rounded-full bg-steel"
                        style={{
                          width: `${(count / m.totalProjects) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm font-medium text-navy">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate">
        Foundation scaffold · Phase 1. Feature tabs (Dependencies, Approvals,
        Tickets, MoMs, Reports) are wired next.
      </p>
    </div>
  );
}
