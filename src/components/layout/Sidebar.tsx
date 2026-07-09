"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";
import { LogOut } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { NAV_BY_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";

// Resolve a lucide icon by its string name from the nav config.
function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

export function Sidebar({
  role,
  name,
  email,
}: {
  role: UserRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold tracking-tight text-navy">Mako</span>
        <span className="ml-2 text-xs font-medium text-slate">Governance</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-steel text-white"
                  : "text-slate hover:bg-bg hover:text-navy"
              )}
            >
              <NavIcon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <UserAvatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy">{name}</p>
            <p className="truncate text-xs text-slate">{email}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between px-2">
          <RoleBadge role={role} />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate hover:bg-bg hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
