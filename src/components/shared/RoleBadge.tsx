import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-2",
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
