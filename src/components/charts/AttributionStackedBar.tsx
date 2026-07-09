"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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

export function AttributionStackedBar({ rows }: { rows: Row[] }) {
  if (rows.length === 0 || rows.every((r) => r.mako + r.rl + r.client_via_rl + r.product_bug === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate">
        No delay data for the selected scope
      </div>
    );
  }

  const data = rows.map((r) => ({
    name: r.title.length > 24 ? r.title.slice(0, 22) + "…" : r.title,
    Mako: r.mako,
    Rocketlane: r.rl,
    "Client-via-RL": r.client_via_rl,
    "Product Bug": r.product_bug,
  }));

  return (
    <div style={{ height: Math.max(240, data.length * 48 + 60) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E6EB" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#5B6774" }} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12, fill: "#1A1A1A" }} />
          <Tooltip
            contentStyle={{ borderRadius: 6, border: "1px solid #E2E6EB", fontSize: 12 }}
            formatter={(v) => [`${Number(v)} days`, ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Mako" stackId="a" fill={ATTRIBUTION_COLORS.mako} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Rocketlane" stackId="a" fill={ATTRIBUTION_COLORS.rl} />
          <Bar dataKey="Client-via-RL" stackId="a" fill={ATTRIBUTION_COLORS.client_via_rl} />
          <Bar dataKey="Product Bug" stackId="a" fill={ATTRIBUTION_COLORS.product_bug} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">{ATTRIBUTION_LABELS.mako}</p>
    </div>
  );
}
