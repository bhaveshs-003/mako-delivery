"use client";

import dynamic from "next/dynamic";

// Recharts is a large dependency. Code-split it out of the initial page JS and
// render a skeleton until it hydrates — pages paint immediately, the chart
// bundle loads on the client only where a chart actually appears.

const donutFallback = (
  <div className="flex items-center gap-5">
    <div className="h-[168px] w-[168px] shrink-0 animate-pulse rounded-full bg-surface-2" />
    <div className="flex-1 space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-3 w-full animate-pulse rounded bg-surface-2" />
      ))}
    </div>
  </div>
);

export const LazyDelayAttributionDonut = dynamic(
  () => import("./DelayAttributionDonut").then((m) => m.DelayAttributionDonut),
  { ssr: false, loading: () => donutFallback }
);

export const LazyAttributionStackedBar = dynamic(
  () => import("./AttributionStackedBar").then((m) => m.AttributionStackedBar),
  {
    ssr: false,
    loading: () => <div className="h-56 w-full animate-pulse rounded-lg bg-surface-2" />,
  }
);
