"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

export type AttributionDatum = { party: keyof typeof ATTRIBUTION_COLORS; days: number };

/**
 * Delay-attribution donut (dataviz: magnitude-of-parts). Validated palette,
 * 2px surface gap between arcs, hero total in the hole, legend-with-values, and
 * a per-arc hover tooltip. Empty state is a quiet ring, never a broken chart.
 */
export function DelayAttributionDonut({
  data,
  size = 168,
}: {
  data: AttributionDatum[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.days, 0);
  const rows = data
    .filter((d) => d.days > 0)
    .map((d) => ({
      key: d.party,
      name: ATTRIBUTION_LABELS[d.party],
      value: d.days,
      color: ATTRIBUTION_COLORS[d.party],
    }));

  if (total === 0) {
    return (
      <div className="flex items-center gap-4 py-2">
        <div
          className="shrink-0 rounded-full border-[10px] border-line"
          style={{ width: size, height: size }}
        />
        <p className="text-sm text-muted">No delays recorded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="98%"
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              formatter={(v) => {
                const n = Number(v);
                return [`${n} business days · ${((n / total) * 100).toFixed(0)}%`, ""];
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--line)",
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                fontSize: 12,
                padding: "6px 10px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-2xl font-semibold tracking-tight text-ink">
            {total}
          </span>
          <span className="text-2xs uppercase tracking-wide text-muted">days burnt</span>
        </div>
      </div>

      {/* Legend with values (identity never color-alone) */}
      <ul className="min-w-[150px] flex-1 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: r.color }} />
            <span className="flex-1 text-ink-2">{r.name}</span>
            <span className="tabular font-medium text-ink">{r.value}</span>
            <span className="tabular w-9 text-right text-2xs text-muted">
              {((r.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
