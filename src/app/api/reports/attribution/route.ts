import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getAttributionReport } from "@/lib/reports";

// GET /api/reports/attribution — CSV export (Admin/Super Admin only, spec §5.5.1).
export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  if (!can(guard.user.role, "report.export"))
    return new Response("Forbidden", { status: 403 });

  const { rows, totals } = await getAttributionReport(guard.user);
  const header = ["Project", "Mako", "Rocketlane", "Client-via-RL", "Product Bug", "Total"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [csv(r.title), r.mako, r.rl, r.client_via_rl, r.product_bug, r.total].join(",")
    ),
    ["TOTAL", totals.mako, totals.rl, totals.client_via_rl, totals.product_bug, totals.total].join(","),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="delay-attribution-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
