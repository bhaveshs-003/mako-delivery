"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact day-allocation control: −/+ steppers around a number field, with a
 * live "remaining" bar so users see how the allocation fits the available pool.
 */
export function DayStepper({
  value,
  onChange,
  poolTotal,
  poolUsedByOthers = 0,
  step = 1,
  over = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Total pool this allocation draws from (0 = no cap / hide the bar). */
  poolTotal?: number;
  /** Days already used by siblings (excludes this field's value). */
  poolUsedByOthers?: number;
  step?: number;
  over?: boolean;
}) {
  const num = Number(value) || 0;
  const set = (n: number) => onChange(String(Math.max(0, n)));

  const showBar = (poolTotal ?? 0) > 0;
  const total = poolTotal ?? 0;
  const used = poolUsedByOthers + num;
  const pct = total > 0 ? Math.min(100, (poolUsedByOthers / total) * 100) : 0;
  const thisPct = total > 0 ? Math.min(100 - pct, (num / total) * 100) : 0;
  const remaining = total - used;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => set(num - step)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong disabled:opacity-40"
          disabled={num <= 0}
          aria-label="Decrease days"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-8 w-full rounded-md border bg-surface px-2 text-center text-sm tabular text-ink outline-none focus:border-brand",
              over ? "border-danger" : "border-line"
            )}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted">
            days
          </span>
        </div>
        <button
          type="button"
          onClick={() => set(num + step)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong"
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
