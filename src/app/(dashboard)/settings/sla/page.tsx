import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { SlaEditor } from "@/components/settings/SlaEditor";

const ALL_TYPES = [
  "credential",
  "source_sheet",
  "approval",
  "clarification",
  "confirmation",
  "other",
] as const;

export default async function SlaSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard?denied=1");

  const configs = await prisma.slaConfig.findMany();
  const byType = new Map(configs.map((c) => [c.dependencyType, c]));

  // Ensure every dependency type has an editable row (default 5/3 if unset).
  const rows = ALL_TYPES.map((t) => ({
    dependencyType: t,
    thresholdDays: byType.get(t)?.thresholdDays ?? 5,
    approvalSlaDays: byType.get(t)?.approvalSlaDays ?? 3,
  }));

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-navy">SLA Rules</h1>
        <p className="text-sm text-slate">
          Per-dependency SLA thresholds. These auto-fill new dependencies and drive breach detection.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <SlaEditor initial={rows} />
      </div>
    </div>
  );
}
