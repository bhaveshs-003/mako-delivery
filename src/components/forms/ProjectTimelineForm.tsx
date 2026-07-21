"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/http";
import { workingDaysBetween } from "@/lib/working-days";

/**
 * Propose the project timeline (RL proposed + Mako promised date ranges). This
 * lives in the Scope Understanding tab — the timeline is set as part of scoping.
 * A proposal is submitted for RL POC approval; the project's real dates only
 * change once the RL POC approves it. Day counts are WORKING days (excluding
 * weekends unless opted in, and always excluding org holidays).
 */
export function ProjectTimelineForm({
  projectId,
  initial,
  canEdit,
  hasPending,
  approved = false,
  holidays = [],
}: {
  projectId: string;
  initial: { rlStart: string; rlEnd: string; makoStart: string; makoEnd: string; includeWeekends: boolean };
  canEdit: boolean;
  hasPending: boolean;
  approved?: boolean;
  holidays?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rlStart, setRlStart] = useState(initial.rlStart);
  const [rlEnd, setRlEnd] = useState(initial.rlEnd);
  const [makoStart, setMakoStart] = useState(initial.makoStart);
  const [makoEnd, setMakoEnd] = useState(initial.makoEnd);
  const [includeWeekends, setIncludeWeekends] = useState(initial.includeWeekends);

  const dayCount = (a: string, b: string) =>
    a && b ? workingDaysBetween(a, b, { includeWeekends, holidays }) : null;
  const rlDays = dayCount(rlStart, rlEnd);
  const makoDays = dayCount(makoStart, makoEnd);
  const dirty =
    rlStart !== initial.rlStart || rlEnd !== initial.rlEnd ||
    makoStart !== initial.makoStart || makoEnd !== initial.makoEnd ||
    includeWeekends !== initial.includeWeekends;
  const anySet = !!(rlStart || rlEnd || makoStart || makoEnd);

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${projectId}/timeline`, {
        method: "POST",
        body: JSON.stringify({
          rlStartDate: rlStart || null,
          rlCommittedDeadline: rlEnd || null,
          makoStartDate: makoStart || null,
          makoInternalDeadline: makoEnd || null,
          includeWeekends,
        }),
      });
      toast.success("Timeline submitted to RL for approval");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit timeline");
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !canEdit || hasPending || approved;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2.6rem_1fr_1fr_2.6rem] items-center gap-x-2 gap-y-1.5 text-2xs">
        <span />
        <span className="text-muted">Start</span>
        <span className="text-muted">End</span>
        <span className="text-right text-muted">Days</span>

        <span className="font-medium text-muted">RL</span>
        <Input type="date" className="h-8 text-xs" value={rlStart} max={rlEnd || undefined} disabled={readOnly} onChange={(e) => setRlStart(e.target.value)} />
        <Input type="date" className="h-8 text-xs" value={rlEnd} min={rlStart || undefined} disabled={readOnly} onChange={(e) => setRlEnd(e.target.value)} />
        <span className="tabular text-right font-semibold text-brand-ink">{rlDays ?? "—"}</span>

        <span className="font-medium text-muted">Mako</span>
        <Input type="date" className="h-8 text-xs" value={makoStart} max={makoEnd || undefined} disabled={readOnly} onChange={(e) => setMakoStart(e.target.value)} />
        <Input type="date" className="h-8 text-xs" value={makoEnd} min={makoStart || undefined} disabled={readOnly} onChange={(e) => setMakoEnd(e.target.value)} />
        <span className="tabular text-right font-semibold text-brand-ink">{makoDays ?? "—"}</span>
      </div>

      <label className="flex items-center gap-2 text-2xs text-ink-2">
        <input
          type="checkbox"
          checked={includeWeekends}
          disabled={readOnly}
          onChange={(e) => setIncludeWeekends(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line"
        />
        Include weekends (Sat &amp; Sun) as working days
      </label>

      {canEdit && !hasPending && !approved && (
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-2xs text-muted">
            <CalendarRange className="h-3.5 w-3.5" /> The RL POC must approve the timeline before it takes effect.
          </p>
          <Button size="sm" onClick={submit} disabled={busy || !dirty || !anySet}>
            {busy ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      )}
      {canEdit && hasPending && !approved && (
        <p className="flex items-center gap-1.5 text-2xs text-warning">
          <CalendarRange className="h-3.5 w-3.5" /> A proposed timeline is awaiting RL POC approval.
        </p>
      )}
      {approved && (
        <p className="flex items-center gap-1.5 text-2xs text-success">
          <CalendarRange className="h-3.5 w-3.5" /> Timeline approved and locked — weekends and holidays can no longer be changed. Raise a Change Request to adjust it.
        </p>
      )}
    </div>
  );
}
