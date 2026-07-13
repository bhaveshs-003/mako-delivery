"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

type Row = {
  title: string;
  mako: number;
  rl: number;
  client_via_rl: number;
  product_bug: number;
};

const SERIES: { key: keyof typeof ATTRIBUTION_COLORS; label: string }[] = [
  { key: "mako", label: ATTRIBUTION_LABELS.mako },
  { key: "rl", label: ATTRIBUTION_LABELS.rl },
  { key: "client_via_rl", label: ATTRIBUTION_LABELS.client_via_rl },
  { key: "product_bug", label: ATTRIBUTION_LABELS.product_bug },
];

/**
 * Delay attribution by project (dataviz: magnitude, stacked). Validated palette,
 * 2px surface gap between segments, rounded outer data-end, recessive grid,
 * per-segment hover. Legend lives outside (rendered by the page) so it can carry
 * the same swatches used elsewhere.
 */
export function AttributionStackedBar({ rows }: { rows: Row[] }) {
  const empty =
    rows.length === 0 ||
    rows.every((r) => r.mako + r.rl + r.client_via_rl + r.product_bug === 0);

  if (empty) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted">
        No delay data for the selected scope
      </div>
    );
  }

  const data = rows.map((r) => ({
    name: r.title.length > 26 ? r.title.slice(0, 24) + "…" : r.title,
    Mako: r.mako,
    Rocketlane: r.rl,
    "Client-via-RL": r.client_via_rl,
    "Product Bug": r.product_bug,
  }));

  return (
    <div style={{ height: Math.max(200, data.length * 44 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap={10} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" horizontal={false} stroke="var(--grid)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fontSize: 12, fill: "var(--ink)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            formatter={(v, n) => [`${Number(v)} days`, n as string]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--line)",
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              fontSize: 12,
              padding: "6px 10px",
            }}
          />
          <Bar dataKey="Mako" stackId="a" fill={ATTRIBUTION_COLORS.mako} stroke="var(--surface)" strokeWidth={2} />
          <Bar dataKey="Rocketlane" stackId="a" fill={ATTRIBUTION_COLORS.rl} stroke="var(--surface)" strokeWidth={2} />
          <Bar dataKey="Client-via-RL" stackId="a" fill={ATTRIBUTION_COLORS.client_via_rl} stroke="var(--surface)" strokeWidth={2} />
          <Bar dataKey="Product Bug" stackId="a" fill={ATTRIBUTION_COLORS.product_bug} stroke="var(--surface)" strokeWidth={2} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Shared legend row (used beside/under the chart). */
export function AttributionLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: ATTRIBUTION_COLORS[s.key] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
