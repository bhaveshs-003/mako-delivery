"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

// Derive breadcrumbs from the pathname (spec §4.1). Detail IDs are shortened.
function useCrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let href = "";
  for (const part of parts) {
    href += `/${part}`;
    const isId = /^[0-9a-f]{8}-/.test(part);
    crumbs.push({
      label: isId
        ? part.slice(0, 8)
        : part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "),
      href,
    });
  }
  return crumbs;
}

export function Header() {
  const crumbs = useCrumbs();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-surface px-6">
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <span className="text-border-strong">/</span>}
            <Link
              href={c.href}
              className={
                i === crumbs.length - 1
                  ? "font-medium text-navy"
                  : "text-slate hover:text-navy"
              }
            >
              {c.label}
            </Link>
          </Fragment>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch />
        <NotificationBell />
      </div>
    </header>
  );
}
