"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LogOut,
  ChevronsLeft,
  LayoutDashboard,
  FolderKanban,
  Ticket,
  BarChart3,
  Users,
  Settings,
  Bell,
  CheckSquare,
  ClipboardList,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { NAV_BY_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";

// Only the icons the nav actually uses — avoids bundling all of lucide.
const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Ticket,
  BarChart3,
  Users,
  Settings,
  Bell,
  CheckSquare,
  ClipboardList,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICONS[name] ?? Circle;
  return <Icon className={className} />;
}

const STORAGE_KEY = "mako.sidebar.collapsed";

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
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
      setCollapsed(true);
    }
  }, []);
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, mounted]);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[236px]"
      )}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-14 items-center px-3">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white transition-transform hover:scale-105"
          >
            M
          </button>
        ) : (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
              M
            </div>
            <div className="ml-2 leading-none">
              <p className="text-sm font-semibold tracking-tight text-ink">Mako</p>
              <p className="text-2xs text-muted">Governance</p>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="px-3">
        <div className="h-px bg-line" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {!collapsed && (
          <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted">
            Menu
          </p>
        )}
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "gap-2.5 px-2.5",
                active
                  ? "bg-brand/10 text-brand-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <NavIcon
                name={item.icon}
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-brand" : "text-muted group-hover:text-ink-2"
                )}
              />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-line p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <UserAvatar name={name} />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Logout"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/5 hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
}
