"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

export type AttributionDatum = { party: keyof typeof ATTRIBUTION_COLORS; days: number };

/**
 * Delay-attribution donut (spec §5.1.1 Chart A). Uses the SACRED palette.
 * Empty state renders a neutral gray ring rather than a broken chart.
 */
export function DelayAttributionDonut({ data }: { data: AttributionDatum[] }) {
  const total = data.reduce((s, d) => s + d.days, 0);

  if (total === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-sm text-slate">
        <div className="mb-3 h-24 w-24 rounded-full border-8 border-border" />
        No delays recorded
      </div>
    );
  }

  const chartData = data
    .filter((d) => d.days > 0)
    .map((d) => ({
      name: ATTRIBUTION_LABELS[d.party],
      value: d.days,
      color: ATTRIBUTION_COLORS[d.party],
    }));

  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const n = Number(value);
              return [`${n} days (${((n / total) * 100).toFixed(1)}%)`, ""];
            }}
            contentStyle={{
              borderRadius: 6,
              border: "1px solid #E2E6EB",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-xs text-slate">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-9">
        <span className="text-3xl font-bold text-navy">{total}</span>
        <span className="text-xs text-slate">days burnt</span>
      </div>
    </div>
  );
}
