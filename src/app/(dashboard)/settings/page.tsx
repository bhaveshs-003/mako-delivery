import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { verifyRowHash } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyChainButton } from "@/components/settings/VerifyChainButton";
import { formatDate } from "@/lib/utils";

const SETTINGS_SECTIONS = [
  { name: "Users", href: "/settings/users", phase: "Ready", desc: "Create, edit, deactivate users (history preserved)." },
  { name: "SLA Rules", href: "/settings/sla", phase: "Ready", desc: "Per-dependency SLA thresholds & approval turnaround." },
  { name: "Lifecycle Templates", href: null, phase: "Planned", desc: "Versioned stage templates per project type." },
  { name: "Hard Delete Console", href: "/settings/hard-delete", phase: "Ready", desc: "Irreversible deletion with mandatory tombstone." },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard?denied=1");

  // Live audit-log tail with per-row hash verification.
  const rows = await prisma.auditLog.findMany({
    orderBy: { sequenceNumber: "desc" },
    take: 15,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Org Settings</h1>
        <p className="text-sm text-slate">Super Admin console</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_SECTIONS.map((s) => {
          const inner = (
            <Card className={`p-4 ${s.href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}>
              <p className="text-sm font-semibold text-navy">{s.name}</p>
              <p className="mt-1 text-xs text-slate">{s.desc}</p>
              <span
                className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  s.phase === "Ready" ? "bg-green-50 text-success" : "bg-bg text-slate"
                }`}
              >
                {s.phase}
              </span>
            </Card>
          );
          return s.href ? (
            <Link key={s.name} href={s.href}>
              {inner}
            </Link>
          ) : (
            <div key={s.name}>{inner}</div>
          );
        })}
      </div>

      {/* Audit Log viewer — LIVE (spec §5.7) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Audit Log — Tamper-Evident Ledger</CardTitle>
            <VerifyChainButton />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate">
              No audit entries yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-slate">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Entity</th>
                    <th className="px-3 py-2 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const valid = verifyRowHash(r);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-slate">
                          {r.sequenceNumber.toString()}
                        </td>
                        <td className="px-3 py-2 text-slate">
                          {formatDate(r.timestamp)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-navy">{r.actorEmail}</span>
                          <span className="ml-1 text-xs text-slate">
                            ({r.actorRole})
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-steel">
                          {r.action}
                        </td>
                        <td className="px-3 py-2 text-slate">
                          {r.entityType}
                          {r.isTombstone && (
                            <span className="ml-1 rounded bg-red-50 px-1 text-[10px] font-medium text-danger">
                              TOMBSTONE
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {valid ? (
                            <span
                              className="inline-flex items-center gap-1 text-success"
                              title={r.rowHash}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="font-mono text-xs">
                                {r.rowHash.slice(0, 8)}…
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-danger">
                              <XCircle className="h-4 w-4" />
                              tampered
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
