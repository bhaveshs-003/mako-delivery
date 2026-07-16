import type { ReactNode } from "react";
import { differenceInCalendarDays, eachDayOfInterval, format } from "date-fns";
import { ATTRIBUTION_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type GanttSubtask = {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  start: Date | null;
  end: Date | null;
};
type GanttMilestone = {
  id: string;
  name: string;
  type: string;
  status: string;
  start: Date | null;
  end: Date | null;
  subtasks: GanttSubtask[];
};

const BAR: Record<string, string> = {
  completed: "bg-success",
  ongoing: "bg-brand",
  yet_to_start: "bg-brand/35",
  in_progress: "bg-brand",
  done: "bg-success",
  blocked: "bg-danger",
  not_started: "bg-brand/25",
};

const COL = 42; // px per day
const LABEL = 224; // px label column

/**
 * Gantt of the milestone plan across the project date timeline. RL & Mako
 * reference bars sit on top; each milestone (numbered) and its subtasks are
 * placed by their allocated date range over a per-day column grid.
 */
export function MilestoneGantt({
  milestones,
  rlStart,
  rlEnd,
  makoStart,
  makoEnd,
  now,
  addButton,
}: {
  milestones: GanttMilestone[];
  rlStart: Date | null;
  rlEnd: Date | null;
  makoStart: Date | null;
  makoEnd: Date | null;
  now: Date;
  addButton?: ReactNode;
}) {
  const all: Date[] = [rlStart, rlEnd, makoStart, makoEnd].filter(Boolean) as Date[];
  for (const m of milestones) {
    if (m.start) all.push(m.start);
    if (m.end) all.push(m.end);
    for (const s of m.subtasks) {
      if (s.start) all.push(s.start);
      if (s.end) all.push(s.end);
    }
  }
  if (all.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-muted">
        Declare the project timeline in the Scope Understanding tab, then allocate milestone dates to see the plan here.
      </p>
    );
  }

  const min = new Date(Math.min(...all.map((d) => d.getTime())));
  const max = new Date(Math.max(...all.map((d) => d.getTime())));
  const days = eachDayOfInterval({ start: min, end: max });
  const trackW = days.length * COL;
  const idx = (d: Date) => differenceInCalendarDays(d, min);
  const barStyle = (start: Date | null, end: Date | null) => {
    if (!start || !end) return null;
    const left = idx(start) * COL;
    const width = Math.max(COL, (idx(end) - idx(start)) * COL);
    return { left, width };
  };
  const todayIdx = now >= min && now <= max ? idx(now) : null;

  const Row = ({
    label,
    children,
    tint = false,
  }: {
    label: ReactNode;
    children?: ReactNode;
    tint?: boolean;
  }) => (
    <div className={`flex border-b border-line last:border-0 ${tint ? "bg-surface-2/40" : ""}`}>
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-surface px-3 py-2"
        style={{ width: LABEL }}
      >
        {label}
      </div>
      <div className="relative" style={{ width: trackW, height: 36 }}>
        {/* day gridlines */}
        <div className="absolute inset-0 flex">
          {days.map((d, i) => (
            <div
              key={i}
              className="h-full border-r border-line/50"
              style={{ width: COL, backgroundColor: [0, 6].includes(d.getDay()) ? "rgba(0,0,0,0.015)" : undefined }}
            />
          ))}
        </div>
        {todayIdx !== null && (
          <div className="absolute inset-y-0 z-10 w-0.5 bg-ink/40" style={{ left: todayIdx * COL + COL / 2 }} />
        )}
        {children}
      </div>
    </div>
  );

  const refBar = (start: Date | null, end: Date | null, color: string, label: string) => {
    const s = barStyle(start, end);
    if (!s) return null;
    return (
      <div
        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
        style={{ left: s.left, width: s.width, backgroundColor: color }}
        title={`${label}: ${formatDate(start)} → ${formatDate(end)}`}
      />
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div style={{ minWidth: LABEL + trackW }}>
        {/* Header */}
        <div className="flex border-b border-line bg-surface-2/60">
          <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-surface-2/60 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted" style={{ width: LABEL }}>
            Timeline
          </div>
          <div className="flex" style={{ width: trackW }}>
            {days.map((d, i) => {
              const today = todayIdx === i;
              return (
                <div key={i} className={`flex flex-col items-center justify-center border-r border-line/50 py-1 text-2xs ${today ? "bg-brand/10" : ""}`} style={{ width: COL }}>
                  <span className="text-muted">{format(d, "EEEEE")}</span>
                  <span className={today ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white" : "text-ink-2"}>{format(d, "d")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reference timelines */}
        <Row label={<span className="flex items-center gap-1.5 text-2xs font-medium text-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.rl }} />RL proposed</span>}>
          {refBar(rlStart, rlEnd, ATTRIBUTION_COLORS.rl, "RL")}
        </Row>
        <Row label={<span className="flex items-center gap-1.5 text-2xs font-medium text-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.mako }} />Mako promised</span>}>
          {refBar(makoStart, makoEnd, ATTRIBUTION_COLORS.mako, "Mako")}
        </Row>

        {/* Milestones + subtasks */}
        {milestones.map((m, i) => {
          const s = barStyle(m.start, m.end);
          const days2 = m.start && m.end ? Math.max(1, idx(m.end) - idx(m.start)) : null;
          return (
            <div key={m.id}>
              <Row
                label={
                  <span className="flex items-center gap-2 truncate text-xs text-ink" title={m.name}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-2xs font-semibold text-ink-2">{i + 1}</span>
                    {m.type !== "main_scope" && (
                      <span className="shrink-0 rounded bg-attr-client/10 px-1 text-[9px] font-medium text-attr-client">{m.type === "change_request" ? "CR" : "Δ"}</span>
                    )}
                    <span className="truncate">{m.name}</span>
                  </span>
                }
              >
                {s && (
                  <div
                    className={`absolute top-1/2 flex h-5 -translate-y-1/2 items-center rounded-md px-2 text-[10px] font-medium text-white ${BAR[m.status] ?? "bg-brand/35"}`}
                    style={{ left: s.left, width: s.width }}
                    title={`${m.name}: ${formatDate(m.start)} → ${formatDate(m.end)}`}
                  >
                    <span className="truncate">{m.name}{days2 ? ` · ${days2}d` : ""}</span>
                  </div>
                )}
              </Row>
              {m.subtasks.map((st) => {
                const ss = barStyle(st.start, st.end);
                return (
                  <Row
                    key={st.id}
                    tint
                    label={
                      <span className="flex items-center gap-1.5 truncate pl-6 text-2xs text-ink-2" title={st.title}>
                        <span className="shrink-0 text-muted">↳</span>
                        <span className="truncate">{st.title}</span>
                        {st.assignee && <span className="shrink-0 text-muted">· {st.assignee}</span>}
                      </span>
                    }
                  >
                    {ss ? (
                      <div
                        className={`absolute top-1/2 h-3 -translate-y-1/2 rounded ${BAR[st.status] ?? "bg-brand/25"}`}
                        style={{ left: ss.left, width: ss.width }}
                        title={`${st.title}: ${formatDate(st.start)} → ${formatDate(st.end)}`}
                      />
                    ) : (
                      <div className="absolute top-1/2 flex h-3 -translate-y-1/2 items-center rounded border border-dashed border-line-strong px-2 text-[9px] text-muted" style={{ left: 4 }}>
                        No dates
                      </div>
                    )}
                  </Row>
                );
              })}
            </div>
          );
        })}

        {/* Add milestone row */}
        {addButton && (
          <div className="flex">
            <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-surface px-3 py-2" style={{ width: LABEL }}>
              {addButton}
            </div>
            <div style={{ width: trackW }} />
          </div>
        )}
      </div>
    </div>
  );
}
