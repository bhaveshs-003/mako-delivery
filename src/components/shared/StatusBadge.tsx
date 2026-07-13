import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

// Modern status pill: a colored dot + label on a neutral chip. Dot color carries
// the state; the chip stays quiet so tables don't turn into a rainbow.
const DOT: Record<string, string> = {
  not_started: "bg-muted",
  yet_to_start: "bg-muted",
  draft: "bg-muted",
  not_required: "bg-muted",
  in_progress: "bg-brand",
  ongoing: "bg-brand",
  in_review: "bg-brand",
  open: "bg-brand",
  paused: "bg-warning",
  pending: "bg-warning",
  pending_rl_approval: "bg-warning",
  awaiting: "bg-warning",
  at_risk: "bg-warning",
  submitted: "bg-brand",
  revision_requested: "bg-warning",
  completed: "bg-success",
  delivered: "bg-success",
  approved: "bg-success",
  resolved: "bg-success",
  received: "bg-success",
  done: "bg-success",
  on_time: "bg-success",
  on_track: "bg-success",
  workaround_applied: "bg-attr-client",
  rejected: "bg-danger",
  blocked: "bg-danger",
  overdue: "bg-danger",
  late: "bg-danger",
  delayed: "bg-danger",
  closed: "bg-muted",
  archived: "bg-muted",
};

const ATTENTION = new Set(["overdue", "blocked", "late", "delayed", "rejected"]);

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const dot = DOT[status] ?? "bg-muted";
  const label = STATUS_LABELS[status] ?? status;
  const loud = ATTENTION.has(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs font-medium",
        loud ? "bg-danger/5 text-danger" : "bg-surface-2 text-ink-2",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
