"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Fragment } from "react";

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
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
          <input
            type="search"
            placeholder="Search…"
            className="h-9 w-56 rounded-md border border-border bg-bg pl-8 pr-3 text-sm text-navy placeholder:text-slate focus:border-border-strong focus:outline-none"
          />
        </div>
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-navy"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
