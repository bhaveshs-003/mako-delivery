import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { AddUserForm } from "@/components/settings/AddUserForm";
import { UserRowActions } from "@/components/settings/UserRowActions";
import { formatDate } from "@/lib/utils";

export default async function UsersSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard?denied=1");

  const users = await prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Users</h1>
          <p className="text-sm text-slate">
            {users.filter((u) => u.isActive).length} active · {users.length} total
          </p>
        </div>
        <AddUserForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <UserAvatar name={u.name} deactivated={!u.isActive} size="sm" />
                    <span className={u.isActive ? "text-navy" : "text-slate line-through"}>
                      {u.name}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-slate">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="text-success">Active</span>
                  ) : (
                    <span className="text-slate">Deactivated {formatDate(u.deactivatedAt)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate">{formatDate(u.lastLoginAt)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== user.id && <UserRowActions userId={u.id} isActive={u.isActive} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
