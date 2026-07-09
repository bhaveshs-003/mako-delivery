import { cn } from "@/lib/utils";
import { ATTRIBUTION_COLORS, ATTRIBUTION_LABELS } from "@/lib/constants";

/**
 * Delay-owner badge. Always uses the SACRED 4-color attribution palette
 * (spec §6.1). Colors are applied inline from the shared constant so they can
 * never drift from the chart palette.
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        color,
        backgroundColor: `${color}1a`, // ~10% opacity
        borderColor: `${color}4d`, // ~30% opacity
      }}
    >
      {ATTRIBUTION_LABELS[party] ?? party}
    </span>
  );
}
