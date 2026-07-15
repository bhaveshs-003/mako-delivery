"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Day-allocation control: −/+ steppers around a number field. In the default
 * size it can show a "remaining pool" bar; the `compact` variant is a tight
 * inline control (e.g. subtask rows) with no bar or suffix.
 */
export function DayStepper({
  value,
  onChange,
  poolTotal,
  poolUsedByOthers = 0,
  step = 1,
  over = false,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Total pool this allocation draws from (0 = no cap / hide the bar). */
  poolTotal?: number;
  /** Days already used by siblings (excludes this field's value). */
  poolUsedByOthers?: number;
  step?: number;
  over?: boolean;
  /** Tight inline variant (no bar, no suffix, smaller controls). */
  compact?: boolean;
}) {
  const num = Number(value) || 0;
  const set = (n: number) => onChange(String(Math.max(0, n)));

  const showBar = !compact && (poolTotal ?? 0) > 0;
  const total = poolTotal ?? 0;
  const used = poolUsedByOthers + num;
  const pct = total > 0 ? Math.min(100, (poolUsedByOthers / total) * 100) : 0;
  const thisPct = total > 0 ? Math.min(100 - pct, (num / total) * 100) : 0;
  const remaining = total - used;

  const btnSize = compact ? "h-7 w-7" : "h-8 w-8";
  const fieldH = compact ? "h-7" : "h-8";

  return (
    <div className={compact ? "" : "space-y-1.5"}>
      <div className={cn("flex items-center gap-1", compact ? "w-fit" : "gap-1.5")}>
        <button
          type="button"
          onClick={() => set(num - step)}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong disabled:opacity-40",
            btnSize
          )}
          disabled={num <= 0}
          aria-label="Decrease days"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className={cn("relative", compact ? "w-14" : "flex-1")}>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full rounded-md border bg-surface text-center text-sm tabular text-ink outline-none focus:border-brand",
              fieldH,
              compact ? "px-1" : "px-2",
              over ? "border-danger" : "border-line"
            )}
          />
          {!compact && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted">
              days
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => set(num + step)}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong",
            btnSize
          )}
          aria-label="Increase days"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showBar && (
        <>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <span className="h-full bg-line-strong" style={{ width: `${pct}%` }} />
            <span
              className={cn("h-full", over ? "bg-danger" : "bg-brand")}
              style={{ width: `${thisPct}%` }}
            />
          </div>
          <p className={cn("text-2xs", over ? "font-medium text-danger" : "text-muted")}>
            {over
              ? `Over by ${used - total} of ${total} days`
              : `${remaining} of ${total} days remaining`}
          </p>
        </>
      )}
    </div>
  );
}
