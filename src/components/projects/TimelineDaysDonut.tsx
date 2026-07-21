import { ATTRIBUTION_COLORS } from "@/lib/constants";

/**
 * Compact two-ring donut comparing the RL-proposed vs Mako-promised day counts
 * on a shared scale. Outer ring = RL, inner ring = Mako; the centre shows the
 * Mako figure (the plan Mako commits to), falling back to RL. Pure SVG — no
 * charting lib, so it stays cheap in the project header.
 */
export function TimelineDaysDonut({
  rlDays,
  makoDays,
  size = 64,
  single = false,
}: {
  rlDays: number | null;
  makoDays: number | null;
  size?: number;
  // When true, only the agreed (Mako) timeline is shown — no RL comparison.
  single?: boolean;
}) {
  const max = Math.max(rlDays ?? 0, makoDays ?? 0, 1);
  const stroke = 5;
  const gap = 3.5;
  const rOuter = (size - stroke) / 2;
  const rInner = rOuter - stroke - gap;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;
  const center = size / 2;
  const headline = makoDays ?? rlDays;

  const ring = (r: number, c: number, value: number | null, color: string, label: string) => {
    const frac = value != null ? Math.min(1, value / max) : 0;
    return (
      <>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-2"
        />
        {frac > 0 && (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${frac * c} ${c}`}
            transform={`rotate(-90 ${center} ${center})`}
          >
            <title>{`${label}: ${value} days`}</title>
          </circle>
        )}
      </>
    );
  };

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          {!single && ring(rOuter, cOuter, rlDays, ATTRIBUTION_COLORS.rl, "RL proposed")}
          {ring(single ? rOuter : rInner, single ? cOuter : cInner, makoDays, ATTRIBUTION_COLORS.mako, single ? "Timeline" : "Mako promised")}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="tabular text-[17px] font-semibold text-ink">{headline ?? "—"}</span>
          <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.08em] text-muted">Days</span>
        </div>
      </div>

      <div className="grid grid-cols-[auto_auto] items-center gap-x-2.5 gap-y-1.5 text-2xs">
        {!single && (
          <>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.rl }} />
              RL proposed
            </span>
            <span className="tabular text-right font-semibold text-ink">{rlDays != null ? `${rlDays}d` : "—"}</span>
          </>
        )}
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.mako }} />
          {single ? "Timeline" : "Mako promised"}
        </span>
        <span className="tabular text-right font-semibold text-ink">{makoDays != null ? `${makoDays}d` : "—"}</span>
      </div>
    </div>
  );
}
