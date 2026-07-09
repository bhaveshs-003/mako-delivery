import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { HardDeleteConsole } from "@/components/settings/HardDeleteConsole";

export default async function HardDeletePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard?denied=1");

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-navy">Hard Delete Console</h1>
        <p className="text-sm text-slate">Irreversible deletion with mandatory tombstone.</p>
      </div>
      <div className="max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-card">
        <HardDeleteConsole />
      </div>
    </div>
  );
}
