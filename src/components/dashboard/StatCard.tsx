import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Dashboard metric card (spec §4.2). Clickable when `href` is provided. */
export function StatCard({
  label,
  value,
  sub,
  subTone = "muted",
  href,
  pulse = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTone?: "muted" | "success" | "danger" | "warning" | "rl";
  href?: string;
  pulse?: boolean;
}) {
  const toneClass = {
    muted: "text-slate",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    rl: "text-[#7C3AED]",
  }[subTone];

  const body = (
    <Card
      className={cn(
        "p-6 transition-shadow",
        href && "cursor-pointer hover:shadow-md",
        pulse && "animate-pulse-amber"
      )}
    >
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-1 text-3xl font-bold text-navy">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", toneClass)}>{sub}</p>}
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
