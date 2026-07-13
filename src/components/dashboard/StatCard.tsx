import Link from "next/link";
import { cn } from "@/lib/utils";

/** Compact KPI tile (dataviz stat-tile). Big tabular number, quiet label, one
 *  sub-line for context. Clickable when `href` is provided. */
export function StatCard({
  label,
  value,
  sub,
  subTone = "muted",
  href,
  accent,
  pulse = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTone?: "muted" | "success" | "danger" | "warning" | "brand";
  href?: string;
  accent?: string; // optional left hue (e.g. attribution color)
  pulse?: boolean;
}) {
  const toneClass = {
    muted: "text-muted",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    brand: "text-brand",
  }[subTone];

  const body = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-surface px-4 py-3.5 shadow-card transition-all",
        href && "cursor-pointer hover:shadow-card-hover"
      )}
    >
      {accent && (
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: accent }}
        />
      )}
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      {sub && (
        <p className={cn("mt-0.5 text-xs", toneClass, pulse && "animate-pulse-soft")}>
          {sub}
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
