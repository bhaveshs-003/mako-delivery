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
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
          M
        </div>
        <div className="leading-none">
          <p className="text-sm font-semibold tracking-tight text-ink">Mako</p>
          <p className="text-2xs text-muted">Governance</p>
        </div>
      </div>

      <div className="px-3">
        <div className="h-px bg-line" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted">
          Menu
        </p>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/10 text-brand-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <NavIcon
                name={item.icon}
                className={cn("h-[18px] w-[18px]", active ? "text-brand" : "text-muted group-hover:text-ink-2")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <UserAvatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-2xs text-muted">{email}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between px-1.5">
          <RoleBadge role={role} />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs text-muted transition-colors hover:bg-danger/5 hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
