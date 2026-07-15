import { addDays, eachMonthOfInterval, format } from "date-fns";
import { formatDate } from "@/lib/utils";

type GanttMilestone = {
  id: string;
  name: string;
  status: string;
  type: string;
  allocatedDays: number | null;
};

// Bar fill by work status.
const BAR: Record<string, string> = {
  completed: "bg-success",
  ongoing: "bg-brand",
  yet_to_start: "bg-brand/35",
};

/**
 * Gantt view of the milestone plan across the project's date timeline. Each
 * milestone runs its allocated days from the previous milestone's end, chained
 * from the project start anchor (mirrors the auto-scheduled due dates).
 */
export function MilestoneGantt({
  milestones,
  anchor,
  projectEnd,
  now,
}: {
  milestones: GanttMilestone[];
  anchor: Date | null;
  projectEnd: Date | null;
  now: Date;
}) {
  if (!anchor) {
    return (
      <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-muted">
        Set the project start date to see the plan on a timeline.
      </p>
    );
  }

  // Chain each milestone's [start, end] from the anchor by allocated days.
  let cursor = anchor;
  const segs = milestones.map((m) => {
    const d = m.allocatedDays ?? 0;
    if (d <= 0) return { m, start: null as Date | null, end: null as Date | null };
    const start = cursor;
    const end = addDays(cursor, d);
    cursor = end;
    return { m, start, end };
  });

  const ends = segs.map((s) => s.end).filter(Boolean) as Date[];
  const maxEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : addDays(anchor, 1);
  const min = anchor;
  const max = projectEnd && projectEnd.getTime() > maxEnd.getTime() ? projectEnd : maxEnd;
  const span = Math.max(1, max.getTime() - min.getTime());
  const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - min.getTime()) / span) * 100));
  const todayIn = now.getTime() >= min.getTime() && now.getTime() <= max.getTime();
  const months = eachMonthOfInterval({ start: min, end: max }).filter((d) => d.getTime() >= min.getTime());

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="space-y-1.5">
        {segs.map(({ m, start, end }) => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="flex w-36 shrink-0 items-center gap-1.5 text-2xs text-ink-2" title={m.name}>
              {m.type !== "main_scope" && (
                <span className="shrink-0 rounded bg-attr-client/10 px-1 text-[9px] font-medium text-attr-client">
                  {m.type === "change_request" ? "CR" : "Δ"}
                </span>
              )}
              <span className="truncate">{m.name}</span>
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-surface-2">
              {/* month gridlines */}
              {months.map((mo, i) => (
                <span key={i} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(mo)}%` }} />
              ))}
              {todayIn && (
                <span className="absolute inset-y-0 z-10 w-px bg-ink/40" style={{ left: `${pct(now)}%` }} />
              )}
              {start && end && (
                <div
                  className={`absolute inset-y-[3px] rounded-sm ${BAR[m.status] ?? "bg-brand/35"}`}
                  style={{ left: `${pct(start)}%`, width: `${Math.max(1.5, pct(end) - pct(start))}%` }}
                  title={`${m.name}: ${formatDate(start)} → ${formatDate(end)}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* axis: month labels aligned under the track */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="w-36 shrink-0" />
        <div className="relative h-4 flex-1 text-2xs text-muted">
          {months.map((mo, i) => (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(mo)}%` }}>
              {format(mo, "MMM")}
            </span>
          ))}
          {todayIn && (
            <span className="absolute -translate-x-1/2 font-medium text-ink-2" style={{ left: `${pct(now)}%`, top: "0.9rem" }}>
              Today
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
