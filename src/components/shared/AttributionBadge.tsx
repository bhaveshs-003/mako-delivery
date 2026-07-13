import { cn } from "@/lib/utils";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

/**
 * Delay-owner badge. Uses the SACRED validated attribution palette. Dot carries
 * the hue (identity is never color-alone — the label is always present).
 */
export function AttributionBadge({
  party,
  className,
}: {
  party: keyof typeof ATTRIBUTION_COLORS;
  className?: string;
}) {
  const color = ATTRIBUTION_COLORS[party];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {ATTRIBUTION_LABELS[party] ?? party}
    </span>
  );
}
