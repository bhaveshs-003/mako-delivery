import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Every list/table view needs one of these (spec §4.2). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-slate">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-navy">{title}</h3>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
