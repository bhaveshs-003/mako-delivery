"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ArrowLeft } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

// Derive breadcrumbs from the pathname (spec §4.1). ID segments (e.g. a project
// UUID) are omitted; on those detail pages a back arrow links to the parent.
function useCrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let href = "";
  let onDetail = false;
  for (const part of parts) {
    href += `/${part}`;
    if (/^[0-9a-f]{8}-/.test(part)) {
      onDetail = true; // skip the raw ID crumb
      continue;
    }
    crumbs.push({
      label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "),
      href,
    });
  }
  // On a detail page, back goes to the parent listing (the last visible crumb).
  const backHref = onDetail ? crumbs[crumbs.length - 1]?.href ?? "/" : null;
  return { crumbs, backHref };
}

export function Header() {
  const { crumbs, backHref } = useCrumbs();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-line bg-surface/80 px-5 backdrop-blur">
      <nav className="flex items-center gap-1.5 text-sm">
        {backHref && (
          <Link
            href={backHref}
            className="mr-0.5 inline-flex items-center text-muted transition-colors hover:text-ink"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <span className="text-line-strong">/</span>}
            <Link
              href={c.href}
              className={
                i === crumbs.length - 1
                  ? "font-medium text-ink"
                  : "text-muted transition-colors hover:text-ink"
              }
            >
              {c.label}
            </Link>
          </Fragment>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <NotificationBell />
      </div>
    </header>
  );
}
