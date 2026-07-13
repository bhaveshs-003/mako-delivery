"use client";

import { useState } from "react";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

export type PauseSegment = {
  pausedAtISO: string;
  resumedAtISO: string | null;
  reasonCategory: keyof typeof ATTRIBUTION_COLORS | string;
  reasonComment: string;
  days: number; // business days
};

const ACTIVE = "#1baf7a"; // teal — "running"
function pauseColor(reason: string): string {
  return (ATTRIBUTION_COLORS as Record<string, string>)[reason] ?? "#c98500";
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Active vs Paused timeline. The full track is "running"; each pause is an
 * overlaid segment positioned by calendar time and colored by its reason
 * (attribution palette). Hover a segment for its reason, dates, and duration.
 */
export function PauseActiveTimeline({
  startISO,
  endISO,
  nowISO,
  pauses,
  activeDays,
  pausedDays,
  ongoing,
}: {
  startISO: string;
  endISO: string;
  nowISO: string;
  pauses: PauseSegment[];
  activeDays: number;
  pausedDays: number;
  ongoing: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const now = new Date(nowISO).getTime();
  const span = end - start;

  if (span <= 0) {
    return <p className="text-sm text-muted">Not enough timeline recorded yet.</p>;
  }

  const pct = (t: number) => Math.max(0, Math.min(100, ((t - start) / span) * 100));
  const totalDays = activeDays + pausedDays;
  const pausedShare = totalDays > 0 ? Math.round((pausedDays / totalDays) * 100) : 0;

  // Distinct reasons present, for the legend.
  const reasons = Array.from(new Set(pauses.map((p) => p.reasonCategory)));

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: ACTIVE }} />
          <span className="text-ink-2">Active</span>
          <span className="tabular font-semibold text-ink">{activeDays}d</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-warning" />
          <span className="text-ink-2">Paused</span>
          <span className="tabular font-semibold text-ink">{pausedDays}d</span>
          {pausedDays > 0 && <span className="text-2xs text-muted">({pausedShare}% of elapsed)</span>}
        </span>
      </div>

      {/* Track */}
      <div className="relative">
        <div
          className="relative h-9 w-full overflow-hidden rounded-lg ring-1 ring-inset ring-black/5"
          style={{ backgroundColor: `${ACTIVE}22` }}
        >
          {/* running fill (subtle) */}
          <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(45deg, ${ACTIVE}14 0 8px, transparent 8px 16px)` }} />

          {/* pause segments */}
          {pauses.map((p, i) => {
            const s = new Date(p.pausedAtISO).getTime();
            const e = p.resumedAtISO ? new Date(p.resumedAtISO).getTime() : now;
            const left = pct(s);
            const width = Math.max(0.8, pct(e) - left);
            const color = pauseColor(p.reasonCategory);
            return (
              <div
                key={i}
                className="absolute inset-y-0 cursor-pointer border-x border-surface transition-[filter] hover:brightness-95"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {/* today marker (only while ongoing) */}
          {ongoing && (
            <div
              className="absolute inset-y-0 w-px bg-ink/50"
              style={{ left: `${pct(now)}%` }}
              title="Today"
            />
          )}
        </div>

        {/* hover tooltip */}
        {hover !== null && pauses[hover] && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${pct(new Date(pauses[hover].pausedAtISO).getTime())}%` }}
          >
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pauseColor(pauses[hover].reasonCategory) }} />
              Paused · {ATTRIBUTION_LABELS[pauses[hover].reasonCategory] ?? pauses[hover].reasonCategory}
              <span className="tabular text-muted">{pauses[hover].days}d</span>
            </div>
            <div className="mt-0.5 text-muted">
              {fmt(pauses[hover].pausedAtISO)} → {pauses[hover].resumedAtISO ? fmt(pauses[hover].resumedAtISO!) : "ongoing"}
            </div>
            {pauses[hover].reasonComment && (
              <div className="mt-0.5 max-w-[220px] text-ink-2">{pauses[hover].reasonComment}</div>
            )}
          </div>
        )}

        {/* axis labels */}
        <div className="mt-1 flex justify-between text-2xs text-muted">
          <span>{fmt(startISO)}</span>
          <span>{ongoing ? "Today" : fmt(endISO)}</span>
        </div>
      </div>

      {/* reason legend (only if paused) */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
          {reasons.map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-2xs text-ink-2">
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: pauseColor(r) }} />
              {ATTRIBUTION_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
