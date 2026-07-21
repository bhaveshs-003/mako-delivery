import { formatDate } from "@/lib/utils";
import { TimelineDaysDonut } from "@/components/projects/TimelineDaysDonut";

/**
 * Compact timeline summary for the project header: a days donut (RL vs Mako)
 * beside a small start → end date summary for each side. No bar/axis — the
 * donut carries the day comparison and the text carries the dates.
 */
export function ProjectTimelineBar({
  rlStart,
  rlEnd,
  makoStart,
  makoEnd,
  actual,
  rlDays,
  makoDays,
  timelineApproved = false,
}: {
  rlStart: Date | null;
  rlEnd: Date | null;
  makoStart: Date | null;
  makoEnd: Date | null;
  actual: Date | null;
  rlDays: number | null;
  makoDays: number | null;
  timelineApproved?: boolean;
}) {
  const hasAny = rlStart || rlEnd || makoStart || makoEnd;
  if (!hasAny && rlDays == null && makoDays == null) {
    return <p className="text-xs text-muted">No timeline set yet.</p>;
  }

  const range = (s: Date | null, e: Date | null) =>
    s || e ? `${s ? formatDate(s) : "—"} → ${e ? formatDate(e) : "—"}` : "—";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <TimelineDaysDonut rlDays={rlDays} makoDays={makoDays} size={62} single={timelineApproved} />

      <div className="space-y-1 text-2xs">
        {/* Once approved, only the agreed timeline is displayed. */}
        {!timelineApproved && (
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-muted">RL</span>
            <span className="tabular text-ink-2">{range(rlStart, rlEnd)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-muted">{timelineApproved ? "Timeline" : "Mako"}</span>
          <span className="tabular text-ink-2">{range(makoStart, makoEnd)}</span>
        </div>
        {actual && (
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-muted">Done</span>
            <span className="tabular text-success">{formatDate(actual)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
