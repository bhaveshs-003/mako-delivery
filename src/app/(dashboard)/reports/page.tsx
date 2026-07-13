import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getAttributionReport } from "@/lib/reports";
import { can } from "@/lib/permissions";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttributionStackedBar } from "@/components/charts/AttributionStackedBar";
import { AttributionBadge } from "@/components/shared/AttributionBadge";
import { Download } from "lucide-react";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const report = await getAttributionReport(user);
  const { totals, rows } = report;
  const canExport = can(user.role, "report.export");
  const pct = (n: number) => (totals.total > 0 ? Math.round((n / totals.total) * 100) : 0);

  const parties: { key: keyof typeof ATTRIBUTION_COLORS; value: number }[] = [
    { key: "mako", value: totals.mako },
    { key: "rl", value: totals.rl },
    { key: "client_via_rl", value: totals.client_via_rl },
    { key: "product_bug", value: totals.product_bug },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Timeline Break-up</h1>
          <p className="text-sm text-slate">Business-day delay ownership across your projects</p>
        </div>
        {canExport && (
          <a href="/api/reports/attribution" className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-navy hover:bg-bg">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs text-slate">Total Days Burnt</p>
          <p className="mt-1 text-3xl font-bold text-navy">{totals.total}</p>
        </Card>
        {parties.map((p) => (
          <Card key={p.key} className="p-4">
            <p className="text-xs text-slate">{ATTRIBUTION_LABELS[p.key]}</p>
            <p className="mt-1 text-3xl font-bold" style={{ color: ATTRIBUTION_COLORS[p.key] }}>{p.value}</p>
            <p className="text-xs text-slate">{pct(p.value)}%</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Timeline Break-up by Project</CardTitle></CardHeader>
        <CardContent>
          <AttributionStackedBar rows={rows} />
        </CardContent>
      </Card>

      {/* Drill-down table */}
      <Card>
        <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Mako</th>
                <th className="px-4 py-3 font-medium">RL</th>
                <th className="px-4 py-3 font-medium">Client-via-RL</th>
                <th className="px-4 py-3 font-medium">Product Bug</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-navy">{r.title}</td>
                  <td className="px-4 py-3 text-slate">{r.mako}</td>
                  <td className="px-4 py-3 text-slate">{r.rl}</td>
                  <td className="px-4 py-3 text-slate">{r.client_via_rl}</td>
                  <td className="px-4 py-3 text-slate">{r.product_bug}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{r.total}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/projects/${r.projectId}/report`} className="text-sm text-info hover:underline">
                      Post-mortem →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate">No projects in scope.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs text-slate">
        Legend:
        {parties.map((p) => (
          <AttributionBadge key={p.key} party={p.key} />
        ))}
      </div>
    </div>
  );
}
