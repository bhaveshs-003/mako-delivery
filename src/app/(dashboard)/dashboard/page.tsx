import { getCurrentUser } from "@/lib/session";
import { getDashboardMetrics } from "@/lib/metrics";
import { ROLE_LABELS, ATTRIBUTION_COLORS, STATUS_LABELS } from "@/lib/constants";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LazyDelayAttributionDonut } from "@/components/charts/lazy";
import { redirect } from "next/navigation";

// Quiet status dot colors for the compact status list.
const STATUS_DOT: Record<string, string> = {
  not_started: "#8a93a2",
  in_progress: "#2a78d6",
  paused: "#c98500",
  completed: "#0ca30c",
  delivered: "#0ca30c",
  archived: "#8a93a2",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const m = await getDashboardMetrics(user);
  const isOrgWide = user.role === "super_admin" || user.role === "admin";
  const maxStatus = Math.max(1, ...Object.values(m.statusCounts));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {isOrgWide ? "Organization Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-muted">
          Welcome back, {user.name} · {ROLE_LABELS[user.role]}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={isOrgWide ? "Total Projects" : "My Projects"}
          value={m.totalProjects}
          sub={`${m.active} active`}
          href="/projects"
        />
        <StatCard
          label="Open Dependencies"
          value={m.openDependencies}
          sub={m.breachedDependencies > 0 ? `${m.breachedDependencies} SLA breached` : "all within SLA"}
          subTone={m.breachedDependencies > 0 ? "danger" : "success"}
          accent={m.breachedDependencies > 0 ? ATTRIBUTION_COLORS.product_bug : undefined}
        />
        <StatCard
          label="At-Risk / Delayed"
          value={m.atRisk + m.delayed}
          sub={`${m.delayed} delayed`}
          subTone={m.delayed > 0 ? "danger" : "muted"}
          pulse={m.atRisk + m.delayed > 0}
          accent={m.atRisk + m.delayed > 0 ? "#c98500" : undefined}
        />
        <StatCard
          label="Days Burnt (30d)"
          value={m.totalBurn30}
          sub={`${m.rlSharePct}% RL-caused`}
          subTone="brand"
          accent={ATTRIBUTION_COLORS.rl}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Timeline Break-up — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <LazyDelayAttributionDonut data={m.attribution} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {Object.keys(m.statusCounts).length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted">
                No projects yet
              </div>
            ) : (
              <div className="space-y-2.5 py-1">
                {Object.entries(m.statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2.5">
                      <span className="flex w-28 items-center gap-1.5 text-xs text-ink-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: STATUS_DOT[status] ?? "#8a93a2" }}
                        />
                        {STATUS_LABELS[status] ?? status}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / maxStatus) * 100}%`,
                            backgroundColor: STATUS_DOT[status] ?? "#8a93a2",
                          }}
                        />
                      </div>
                      <span className="tabular w-5 text-right text-sm font-medium text-ink">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
