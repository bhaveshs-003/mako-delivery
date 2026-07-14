import { ATTRIBUTION_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { TimelineDaysDonut } from "@/components/projects/TimelineDaysDonut";

/**
 * Compact visual of the RL vs Mako timelines on a shared date axis, with a
 * "today" marker and an optional actual-completion marker. Pure markup (no
 * client JS); bars carry native tooltips.
 */
export function ProjectTimelineBar({
  rlStart,
  rlEnd,
  makoStart,
  makoEnd,
  actual,
  rlDays,
  makoDays,
  now,
}: {
  rlStart: Date | null;
  rlEnd: Date | null;
  makoStart: Date | null;
  makoEnd: Date | null;
  actual: Date | null;
  rlDays: number | null;
  makoDays: number | null;
  now: Date;
}) {
  const all = [rlStart, rlEnd, makoStart, makoEnd, actual, now].filter(Boolean) as Date[];
  if (all.length <= 1) {
    return <p className="text-xs text-muted">No timeline set yet.</p>;
  }
  const min = Math.min(...all.map((d) => d.getTime()));
  const max = Math.max(...all.map((d) => d.getTime()));
  const span = Math.max(1, max - min);
  const pct = (d: Date) => ((d.getTime() - min) / span) * 100;
  const todayIn = now.getTime() >= min && now.getTime() <= max;

  const rows = [
    { label: "RL", color: ATTRIBUTION_COLORS.rl, start: rlStart, end: rlEnd, days: rlDays },
    { label: "Mako", color: ATTRIBUTION_COLORS.mako, start: makoStart, end: makoEnd, days: makoDays },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {/* Compact days donut */}
      <TimelineDaysDonut rlDays={rlDays} makoDays={makoDays} />

      {/* Date-axis bars */}
      <div className="min-w-[220px] flex-1 space-y-1.5">
        {rows.map((r) => {
          const hasBar = r.start && r.end;
          return (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-2xs font-medium text-muted">{r.label}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-surface-2">
                {todayIn && (
                  <span className="absolute inset-y-0 z-10 w-px bg-ink/40" style={{ left: `${pct(now)}%` }} />
                )}
                {hasBar ? (
                  <div
                    className="absolute inset-y-[3px] rounded-sm"
                    style={{
                      left: `${pct(r.start!)}%`,
                      width: `${Math.max(1.5, pct(r.end!) - pct(r.start!))}%`,
                      backgroundColor: r.color,
                    }}
                    title={`${formatDate(r.start)} → ${formatDate(r.end)}`}
                  />
                ) : (
                  (r.start || r.end) && (
                    <span
                      className="absolute inset-y-[3px] w-1 rounded-sm"
                      style={{ left: `${pct((r.start || r.end)!)}%`, backgroundColor: r.color }}
                    />
                  )
                )}
                {actual && (
                  <span
                    className="absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-success ring-2 ring-surface"
                    style={{ left: `${pct(actual)}%` }}
                    title={`Completed ${formatDate(actual)}`}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* axis */}
        <div className="flex items-center justify-between pl-11 text-2xs text-muted">
          <span>{formatDate(new Date(min))}</span>
          {todayIn && <span className="text-ink-2">Today</span>}
          <span>{formatDate(new Date(max))}</span>
        </div>
      </div>
    </div>
  );
}
