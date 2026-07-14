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
  size = 76,
}: {
  rlDays: number | null;
  makoDays: number | null;
  size?: number;
}) {
  const max = Math.max(rlDays ?? 0, makoDays ?? 0, 1);
  const stroke = 7;
  const gap = 3;
  const rOuter = size / 2 - stroke / 2;
  const rInner = rOuter - stroke - gap;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;
  const center = size / 2;
  const headline = makoDays ?? rlDays;

  const ring = (r: number, c: number, value: number | null, color: string) => (
    <>
      <circle cx={center} cy={center} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
      {value != null && value > 0 && (
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(value / max) * c} ${c}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
    </>
  );

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          {ring(rOuter, cOuter, rlDays, ATTRIBUTION_COLORS.rl)}
          {ring(rInner, cInner, makoDays, ATTRIBUTION_COLORS.mako)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-base font-semibold leading-none text-ink">
            {headline ?? "—"}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-muted">Days</span>
        </div>
      </div>
      <div className="space-y-1 text-2xs">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.rl }} />
          RL proposed <span className="tabular font-medium text-ink">{rlDays != null ? `${rlDays}d` : "—"}</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTRIBUTION_COLORS.mako }} />
          Mako promised <span className="tabular font-medium text-ink">{makoDays != null ? `${makoDays}d` : "—"}</span>
        </span>
      </div>
    </div>
  );
}
