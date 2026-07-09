import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

// Full status → color map per spec §4.2. Keyed by raw enum value.
const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600 border-gray-200",
  yet_to_start: "bg-gray-100 text-gray-600 border-gray-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  ongoing: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-purple-50 text-purple-700 border-purple-200",
  revision_requested: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-gray-50 text-gray-400 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending_rl_approval: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  not_required: "bg-gray-50 text-gray-400 border-gray-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_review: "bg-purple-50 text-purple-700 border-purple-200",
  resolved: "bg-green-50 text-green-700 border-green-200",
  workaround_applied: "bg-teal-50 text-teal-700 border-teal-200",
  closed: "bg-gray-100 text-gray-500 border-gray-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  done: "bg-green-50 text-green-700 border-green-200",
  awaiting: "bg-yellow-50 text-yellow-700 border-yellow-200",
  received: "bg-green-50 text-green-700 border-green-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  late: "bg-red-50 text-red-700 border-red-200",
  on_time: "bg-green-50 text-green-700 border-green-200",
  on_track: "bg-green-50 text-green-700 border-green-200",
  at_risk: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse-amber",
  delayed: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
